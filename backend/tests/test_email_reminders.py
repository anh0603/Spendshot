"""Tests email reminder (§40-§41): quy tắc 3 ngày, chuỗi 7 mail, dừng khi quay lại,
sequence mới, OFF, idempotency, quota."""
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.notifications import EmailReminderLog, NotificationHistory
from app import scheduler
from app.services.email_service import MockEmailProvider

client = TestClient(app)
MOCK = MockEmailProvider()
BASE = datetime(2026, 9, 10, 3, 0, 0)  # naive UTC


def _token(email, pw="123456"):
    client.post("/auth/register", json={"email": email, "password": pw})
    return client.post("/auth/login", json={"email": email, "password": pw}).json()["access_token"]


def _clean(email):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.query(EmailReminderLog).filter(EmailReminderLog.user_id == u.id).delete()
            db.query(NotificationHistory).filter(
                NotificationHistory.user_id == u.id,
                NotificationHistory.channel == "EMAIL").delete()
            db.query(User).filter(User.id == u.id).delete()
            db.commit()
    finally:
        db.close()


def _set_state(email, last_activity=None, count=0, started=None, last_sent=None):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if last_activity is not None:
            u.last_activity = last_activity
        u.email_reminder_count = count
        u.email_reminder_started_at = started
        u.email_reminder_last_sent_at = last_sent
        db.commit()
        return u.id
    finally:
        db.close()


def _logs(uid):
    db = SessionLocal()
    try:
        return db.query(EmailReminderLog).filter(
            EmailReminderLog.user_id == uid).order_by(EmailReminderLog.seq_no).all()
    finally:
        db.close()


def _count(uid):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == uid).first().email_reminder_count
    finally:
        db.close()


def test_active_user_no_email():
    email = "mail_active@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE)
    db = SessionLocal()
    try:
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])
        assert _logs(uid) == [] and _count(uid) == 0  # < 3 ngày
    finally:
        db.close()


def test_exactly_3_days_sends_day1():
    email = "mail_day1@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE - timedelta(days=3))
    db = SessionLocal()
    try:
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])
        logs = _logs(uid)
        assert len(logs) == 1 and logs[0].seq_no == 1  # = 3 ngày → gửi
        assert _count(uid) == 1
    finally:
        db.close()


def test_sequence_to_seven_then_stop():
    email = "mail_seq@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE - timedelta(days=10))
    db = SessionLocal()
    try:
        for i in range(7):
            scheduler.run_email(db, BASE + timedelta(days=i), provider=MOCK, only_user_ids=[uid])
            assert _count(uid) == i + 1
        logs = _logs(uid)
        assert [l.seq_no for l in logs] == [1, 2, 3, 4, 5, 6, 7]
        scheduler.run_email(db, BASE + timedelta(days=7), provider=MOCK, only_user_ids=[uid])
        assert _logs(uid) and len(_logs(uid)) == 7  # không có Email #8 (§16)
        assert _count(uid) == 7
    finally:
        db.close()


def test_return_resets_sequence():
    email = "mail_back@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE, count=3,
                     started=BASE - timedelta(days=8), last_sent=BASE - timedelta(days=8))
    db = SessionLocal()
    try:
        # user quay lại app → dừng + reset (§17)
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])
        assert _count(uid) == 0
        # inactive lại 3 ngày → sequence mới từ #1
        _set_state(email, last_activity=BASE - timedelta(days=3))
        scheduler.run_email(db, BASE + timedelta(days=1), provider=MOCK, only_user_ids=[uid])
        assert _count(uid) == 1
    finally:
        db.close()


def test_email_off_skips():
    email = "mail_off@gmail.com"
    _clean(email)
    t = _token(email)
    client.patch("/notifications/settings", json={"email_enabled": False},
                 headers={"Authorization": f"Bearer {t}"})
    uid = _set_state(email, last_activity=BASE - timedelta(days=10))
    db = SessionLocal()
    try:
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])
        assert _logs(uid) == []  # OFF → không gửi (§21)
    finally:
        db.close()


def test_double_run_one_email():
    email = "mail_double@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE - timedelta(days=5))
    db = SessionLocal()
    try:
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])
        scheduler.run_email(db, BASE, provider=MOCK, only_user_ids=[uid])  # cron chạy lại
        assert len(_logs(uid)) == 1  # 1 email (§18, §41)
    finally:
        db.close()


def test_quota_protection(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "EMAIL_DAILY_LIMIT", 0)
    email = "mail_quota@gmail.com"
    _clean(email)
    _token(email)
    uid = _set_state(email, last_activity=BASE - timedelta(days=5))
    db = SessionLocal()
    try:
        out = scheduler.run_email(db, BASE, provider=MOCK)
        assert out["skipped"] == "quota_exceeded"  # §22, không crash
        assert _logs(uid) == []
    finally:
        db.close()
