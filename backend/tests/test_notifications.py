"""Tests push notification (§40-§42): settings, subscription, scheduler slots,
random không trùng, idempotency, opt-out, invalid sub, cron security, RBAC."""
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.notifications import PushSubscription, NotificationHistory
from app import scheduler
from app.services.push_service import MockPushProvider

client = TestClient(app)
MOCK = MockPushProvider()
# Thứ 2 07/09/2026. Slot VN 08:00 = UTC 01:00 (UTC+7, không DST).
MON_01UTC = datetime(2026, 9, 7, 1, 0, 0)
SLOT_UTC = [1, 3, 5, 8, 11, 13]  # 6 slot push quy ra giờ UTC


def _token(email, pw="123456"):
    client.post("/auth/register", json={"email": email, "password": pw})
    return client.post("/auth/login", json={"email": email, "password": pw}).json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _clean(email):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.query(NotificationHistory).filter(NotificationHistory.user_id == u.id).delete()
            db.query(PushSubscription).filter(PushSubscription.user_id == u.id).delete()
            db.query(User).filter(User.id == u.id).delete()
            db.commit()
    finally:
        db.close()


def _uid(email):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first().id
    finally:
        db.close()


def _hist(uid, date="2026-09-07"):
    db = SessionLocal()
    try:
        return db.query(NotificationHistory).filter(
            NotificationHistory.user_id == uid,
            NotificationHistory.channel == "PUSH",
            NotificationHistory.dedup_key.like(f"{date}#%")).all()
    finally:
        db.close()


def test_settings_default_on_and_patch():
    email = "notif_settings@gmail.com"
    _clean(email)
    t = _token(email)
    r = client.get("/notifications/settings", headers=_h(t))
    assert r.status_code == 200
    assert r.json()["push_enabled"] is True
    assert r.json()["email_enabled"] is True
    r = client.patch("/notifications/settings", json={"push_enabled": False}, headers=_h(t))
    assert r.json()["push_enabled"] is False
    r = client.patch("/notifications/settings", json={"email_enabled": False}, headers=_h(t))
    assert r.json()["email_enabled"] is False
    client.patch("/notifications/settings",
                 json={"push_enabled": True, "email_enabled": True}, headers=_h(t))


def test_subscribe_duplicate_and_unsubscribe():
    email = "notif_sub@gmail.com"
    _clean(email)
    t = _token(email)
    ep = "https://push.example.com/notif-sub-1"
    for _ in range(2):  # duplicate subscription
        r = client.post("/notifications/push/subscribe",
                        json={"endpoint": ep, "keys": {"p256dh": "p", "auth": "a"}},
                        headers=_h(t))
        assert r.status_code == 200
    db = SessionLocal()
    try:
        n = db.query(PushSubscription).filter(PushSubscription.endpoint == ep).count()
        assert n == 1
    finally:
        db.close()
    r = client.request("DELETE", "/notifications/push/subscribe", json={"endpoint": ep}, headers=_h(t))
    assert r.json()["deleted"] is True
    r = client.request("DELETE", "/notifications/push/subscribe", json={"endpoint": ep}, headers=_h(t))
    assert r.json()["deleted"] is False


def test_endpoint_conflict_and_idor():
    a, b = "notif_a@gmail.com", "notif_b@gmail.com"
    _clean(a)
    _clean(b)
    ta, tb = _token(a), _token(b)
    ep = "https://push.example.com/notif-conflict"
    assert client.post("/notifications/push/subscribe", json={"endpoint": ep},
                       headers=_h(ta)).status_code == 200
    r = client.post("/notifications/push/subscribe", json={"endpoint": ep}, headers=_h(tb))
    assert r.status_code == 409  # endpoint của user khác
    r = client.request("DELETE", "/notifications/push/subscribe", json={"endpoint": ep}, headers=_h(tb))
    assert r.json()["deleted"] is False  # B không xóa được sub của A
    db = SessionLocal()
    try:
        assert db.query(PushSubscription).filter(PushSubscription.endpoint == ep).count() == 1
    finally:
        db.close()


def test_push_not_scheduled_outside_slots():
    db = SessionLocal()
    try:
        out = scheduler.run_push(db, datetime(2026, 9, 7, 2, 0, 0), provider=MOCK)  # 09:00 VN
        assert out["skipped"] == "not_scheduled" and out["sent"] == 0
    finally:
        db.close()


def test_push_slot_sends_and_idempotent():
    email = "notif_slot@gmail.com"
    _clean(email)
    t = _token(email)
    client.post("/notifications/push/subscribe",
                json={"endpoint": "https://push.example.com/notif-slot"}, headers=_h(t))
    uid = _uid(email)
    db = SessionLocal()
    try:
        out = scheduler.run_push(db, MON_01UTC, provider=MOCK, only_user_ids=[uid])
        assert out["slot"] == "08:00" and out["sent"] == 1
        out2 = scheduler.run_push(db, MON_01UTC, provider=MOCK, only_user_ids=[uid])  # cron chạy lại
        rows = _hist(uid)
        assert len(rows) == 1  # chỉ 1 notification (§7, §41)
        assert out2["sent"] == 0  # cron chạy lại không gửi thêm
    finally:
        db.close()


def test_push_six_slots_distinct_messages():
    email = "notif_distinct@gmail.com"
    _clean(email)
    t = _token(email)
    client.post("/notifications/push/subscribe",
                json={"endpoint": "https://push.example.com/notif-distinct"}, headers=_h(t))
    uid = _uid(email)
    db = SessionLocal()
    try:
        for h_utc in SLOT_UTC:
            scheduler.run_push(db, datetime(2026, 9, 7, h_utc, 0, 0), provider=MOCK, only_user_ids=[uid])
        msgs = [r.message_id for r in _hist(uid)]
        assert len(msgs) == 6
        assert len(set(msgs)) == 6  # không trùng trong ngày (§6)
    finally:
        db.close()


def test_push_opt_out_and_no_subs_skipped():
    email = "notif_off@gmail.com"
    _clean(email)
    t = _token(email)
    client.post("/notifications/push/subscribe",
                json={"endpoint": "https://push.example.com/notif-off"}, headers=_h(t))
    client.patch("/notifications/settings", json={"push_enabled": False}, headers=_h(t))
    uid = _uid(email)
    db = SessionLocal()
    try:
        scheduler.run_push(db, MON_01UTC, provider=MOCK, only_user_ids=[uid])
        assert _hist(uid) == []
    finally:
        db.close()


def test_expired_sub_deactivated():
    from app.services.push_service import PushResult

    class Expired:
        name = "expired-fake"

        def send(self, sub, payload):
            return PushResult(ok=False, expired=True, error_code="HTTP_410")

    email = "notif_expired@gmail.com"
    _clean(email)
    t = _token(email)
    client.post("/notifications/push/subscribe",
                json={"endpoint": "https://push.example.com/notif-expired"}, headers=_h(t))
    uid = _uid(email)
    db = SessionLocal()
    try:
        scheduler.run_push(db, MON_01UTC, provider=Expired(), only_user_ids=[uid])
        s = db.query(PushSubscription).filter(PushSubscription.user_id == uid).first()
        assert s.is_active is False  # §11
    finally:
        db.close()


def test_cron_security():
    r = client.post("/internal/cron", json={"jobs": ["cleanup"]})
    assert r.status_code == 403  # không secret (§62)
    r = client.post("/internal/cron", json={"jobs": ["cleanup"]},
                    headers={"X-Cron-Secret": "sai"})
    assert r.status_code == 403


def test_cron_with_secret_runs(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "CRON_SECRET", "test-secret-123")
    r = client.post("/internal/cron", json={"jobs": ["cleanup"]},
                    headers={"X-Cron-Secret": "test-secret-123"})
    assert r.status_code == 200
    assert "cleanup" in r.json()


def test_admin_notifications_overview_rbac():
    email = "notif_rbac@gmail.com"
    _clean(email)
    t = _token(email)
    r = client.get("/admin/notifications/overview", headers=_h(t))
    assert r.status_code == 403  # FREE không vào Admin
    ta = client.post("/auth/login",
                     json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    r = client.get("/admin/notifications/overview", headers=_h(ta))
    assert r.status_code == 200
    for k in ("total_users", "push_enabled", "active_subscriptions", "email_enabled",
              "in_reminder_sequence", "push_sent_today", "email_sent_today"):
        assert k in r.json()
