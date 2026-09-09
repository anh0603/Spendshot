from fastapi.testclient import TestClient
from app.main import app
import uuid, io
from PIL import Image

client = TestClient(app)

def get_user(email=None):
    if not email: email = f"prof_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    return r.json()["access_token"], email

def test_update_name():
    t, _ = get_user()
    h = {"Authorization": f"Bearer {t}"}
    r = client.patch("/auth/me", data={"name": "Nguyen Van A"}, headers=h)
    assert r.status_code == 200
    assert r.json()["name"] == "Nguyen Van A"
    r = client.get("/auth/me", headers=h)
    assert r.json()["name"] == "Nguyen Van A"
    # empty name rejected
    r = client.patch("/auth/me", data={"name": "   "}, headers=h)
    assert r.status_code == 400

def test_update_avatar():
    t, _ = get_user()
    h = {"Authorization": f"Bearer {t}"}
    img = Image.new("RGB", (400, 400), color="green")
    buf = io.BytesIO(); img.save(buf, format="JPEG"); buf.seek(0)
    r = client.patch("/auth/me", files={"avatar": ("av.jpg", buf, "image/jpeg")}, headers=h)
    assert r.status_code == 200
    assert r.json()["avatar"].startswith("/uploads/avatars/")
    # invalid mime rejected
    buf2 = io.BytesIO(b"not image")
    r = client.patch("/auth/me", files={"avatar": ("a.txt", buf2, "text/plain")}, headers=h)
    assert r.status_code == 400

def test_change_password():
    t, email = get_user()
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/auth/change-password", json={"current_password": "wrong", "new_password": "Moi12345"}, headers=h)
    assert r.status_code == 400
    r = client.post("/auth/change-password", json={"current_password": "123456", "new_password": "123"}, headers=h)
    assert r.status_code == 422
    r = client.post("/auth/change-password", json={"current_password": "123456", "new_password": "Moi12345"}, headers=h)
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": "Moi12345"})
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    assert r.status_code == 401

def test_admin_set_password():
    admin_t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    h = {"Authorization": f"Bearer {admin_t}"}
    email = f"admset_{uuid.uuid4().hex[:6]}@gmail.com"
    get_user(email)
    uid = client.get(f"/admin/users?search={email}", headers=h).json()["users"][0]["id"]
    r = client.post(f"/admin/users/{uid}/reset-password", json={"new_password": "Admin123"}, headers=h)
    assert r.status_code == 200
    assert "password_hash" not in r.text.lower()
    assert "Admin123" not in r.text
    r = client.post("/auth/login", json={"email": email, "password": "Admin123"})
    assert r.status_code == 200
    # too short rejected
    r = client.post(f"/admin/users/{uid}/reset-password", json={"new_password": "123"}, headers=h)
    assert r.status_code == 400

def test_admin_detail_rich():
    admin_t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    h = {"Authorization": f"Bearer {admin_t}"}
    email = f"rich_{uuid.uuid4().hex[:6]}@gmail.com"
    get_user(email)
    uid = client.get(f"/admin/users?search={email}", headers=h).json()["users"][0]["id"]
    r = client.get(f"/admin/users/{uid}", headers=h)
    d = r.json()
    assert "name" in d and "total_spent" in d and "recent_expenses" in d
    assert "password" not in r.text.lower()
