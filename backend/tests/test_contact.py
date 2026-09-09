from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def admin_h():
    t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}

def test_public_contact():
    r = client.get("/contact")
    assert r.status_code == 200
    assert set(["hotline", "email", "facebook", "address"]) <= set(r.json().keys())

def test_contact_admin_only():
    email = f"ct_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    t = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    assert client.get("/admin/contact-settings", headers=h).status_code == 403
    assert client.put("/admin/contact-settings", json={"hotline": "090"}, headers=h).status_code == 403

def test_contact_roundtrip():
    h = admin_h()
    payload = {"hotline": "0901234567", "email": "hotro@spendshot.vn", "facebook": "spendshot.vn", "address": "Ha Noi"}
    r = client.put("/admin/contact-settings", json=payload, headers=h)
    assert r.status_code == 200
    for k, v in payload.items():
        assert r.json()[k] == v
    r = client.get("/contact")
    for k, v in payload.items():
        assert r.json()[k] == v
