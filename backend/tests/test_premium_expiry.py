"""Premium 30 ngày + lazy expiration (không cron)."""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app)


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _mk():
    email = f"exp_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    tok = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    return tok, email


def _set_exp(email, dt):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        u.premium_expires_at = dt
        db.commit()
        return u.id
    finally:
        db.close()


def _wipe(uid, email, admin_h):
    client.request("DELETE", f"/admin/users/{uid}/data",
                   json={"confirm": True, "email": email}, headers=admin_h)


def _admin_h():
    t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def test_free_upgrade_30_days():
    tok, email = _mk()
    h = {"Authorization": f"Bearer {tok}"}
    r = client.post("/subscription/upgrade", headers=h)
    assert r.status_code == 200 and r.json()["plan"] == "PREMIUM"
    me = client.get("/subscription/me", headers=h).json()
    assert me["plan"] == "PREMIUM" and me["gallery"] is True and me["expires_at"]
    exp = datetime.fromisoformat(me["expires_at"])
    assert timedelta(days=29) < exp - _now() <= timedelta(days=30, minutes=5)
    _wipe(client.get("/auth/me", headers=h).json()["id"], email, _admin_h())


def test_renew_extends_not_resets():
    tok, email = _mk()
    h = {"Authorization": f"Bearer {tok}"}
    first = datetime.fromisoformat(client.post("/subscription/upgrade", headers=h).json()["expires_at"])
    second = datetime.fromisoformat(client.post("/subscription/upgrade", headers=h).json()["expires_at"])
    assert timedelta(days=59) < second - _now() <= timedelta(days=60, minutes=5)
    assert second - first > timedelta(days=29)  # giữ ngày còn lại, không reset
    _wipe(client.get("/auth/me", headers=h).json()["id"], email, _admin_h())


def test_expired_auto_free_blocks_gallery():
    tok, email = _mk()
    h = {"Authorization": f"Bearer {tok}"}
    client.post("/subscription/upgrade", headers=h)
    uid = client.get("/auth/me", headers=h).json()["id"]
    jar = client.post("/jars", json={"budget": 1000000, "month": "2026-09"}, headers=h).json()["id"]
    # hết hạn hôm qua (không cron): request tiếp theo tự FREE + gallery 403
    _set_exp(email, _now() - timedelta(days=1))
    me = client.get("/subscription/me", headers=h).json()
    assert me["plan"] == "FREE" and me["gallery"] is False and me["expires_at"] is None
    r = client.post("/expenses", data={"jar_id": jar, "amount": "1000", "source": "gallery"}, headers=h)
    assert r.status_code == 403
    # login lại + reload vẫn FREE
    tok2 = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    h2 = {"Authorization": f"Bearer {tok2}"}
    assert client.get("/subscription/me", headers=h2).json()["plan"] == "FREE"
    assert client.get("/auth/me", headers=h2).json()["role"] == "FREE"
    _wipe(uid, email, _admin_h())


def test_unexpired_stays_premium():
    tok, email = _mk()
    h = {"Authorization": f"Bearer {tok}"}
    client.post("/subscription/upgrade", headers=h)
    uid = client.get("/auth/me", headers=h).json()["id"]
    _set_exp(email, _now() + timedelta(days=10))
    me = client.get("/subscription/me", headers=h).json()
    assert me["plan"] == "PREMIUM" and me["expires_at"] is not None
    _wipe(uid, email, _admin_h())


def test_approve_sets_expiry_and_admin_detail():
    tok, email = _mk()
    h = {"Authorization": f"Bearer {tok}"}
    client.post("/subscription/payment-request", headers=h)
    ah = _admin_h()
    rid = client.get("/admin/upgrade-requests?status=PENDING", headers=ah).json()["requests"][0]["id"]
    assert client.post(f"/admin/upgrade-requests/{rid}/approve", headers=ah).status_code == 200
    uid = client.get("/auth/me", headers=h).json()["id"]
    det = client.get(f"/admin/users/{uid}", headers=ah).json()
    assert det["role"] == "PREMIUM" and det["premium_expires_at"]
    _wipe(uid, email, ah)
