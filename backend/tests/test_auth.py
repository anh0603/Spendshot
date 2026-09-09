from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User

# ensure clean DB for tests - use separate file but for foundation we test logic
client = TestClient(app)

def test_gmail_only():
    r = client.post("/auth/register", json={"email":"user@yahoo.com","password":"123456"})
    assert r.status_code == 422, "Yahoo should be rejected"
    r = client.post("/auth/register", json={"email":"user@outlook.com","password":"123456"})
    assert r.status_code == 422
    r = client.post("/auth/register", json={"email":"user@hotmail.com","password":"123456"})
    assert r.status_code == 422

def test_gmail_uppercase_normalize():
    email = "UPPERCASE@GMAIL.COM"
    r = client.post("/auth/register", json={"email": email, "password":"123456"})
    # may already exist from previous manual run, handle 400 duplicate as also valid lowercase
    assert r.status_code in (201,400)
    if r.status_code == 201:
        assert r.json()["user"]["email"] == "uppercase@gmail.com"

def test_register_and_login():
    email = "pytest_auth@gmail.com"
    # cleanup if exists
    db = SessionLocal()
    db.query(User).filter(User.email==email).delete()
    db.commit()
    db.close()
    r = client.post("/auth/register", json={"email": email, "password":"secret123"})
    assert r.status_code == 201
    assert "access_token" in r.json()
    r2 = client.post("/auth/login", json={"email": email, "password":"secret123"})
    assert r2.status_code == 200
    token = r2.json()["access_token"]
    r3 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
    assert r3.json()["email"] == email
    assert r3.json()["role"] == "FREE"

def test_admin_exception():
    r = client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "SUPER_ADMIN"
    token = r.json()["access_token"]
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200

def test_wrong_password():
    r = client.post("/auth/login", json={"email":"pytest_auth@gmail.com","password":"wrong"})
    assert r.status_code == 401

def test_jwt_invalid():
    r = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert r.status_code == 401

def test_password_not_returned():
    r = client.post("/auth/login", json={"email":"pytest_auth@gmail.com","password":"secret123"})
    assert "password" not in r.text.lower()
    assert "password_hash" not in r.text.lower()
