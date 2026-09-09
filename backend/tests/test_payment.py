from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def admin_h():
    t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}

def get_user(email=None):
    if not email: email = f"pay_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    return r.json()["access_token"], email

def test_payment_settings_admin_only():
    t, _ = get_user()
    r = client.put("/admin/payment-settings", json={"bank_id": "MB"}, headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 403
    r = client.put("/admin/payment-settings", json={"bank_id": "VCB", "account_no": "1234567890", "account_name": "TEST USER", "amount": 19000}, headers=admin_h())
    assert r.status_code == 200
    assert r.json()["bank_id"] == "VCB"
    r = client.get("/admin/payment-settings", headers=admin_h())
    assert r.json()["account_no"] == "1234567890"

def test_pay_code_unique_and_stable():
    t1, _ = get_user()
    t2, _ = get_user()
    h1 = {"Authorization": f"Bearer {t1}"}
    h2 = {"Authorization": f"Bearer {t2}"}
    c1 = client.get("/subscription/payment-info", headers=h1).json()["code"]
    c2 = client.get("/subscription/payment-info", headers=h2).json()["code"]
    assert c1 != c2
    assert c1.startswith("SS-")
    # stable across calls
    assert client.get("/subscription/payment-info", headers=h1).json()["code"] == c1

def test_payment_request_approve_flow():
    t, email = get_user()
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/subscription/payment-request", headers=h)
    assert r.status_code == 200
    # duplicate request returns existing pending
    r2 = client.post("/subscription/payment-request", headers=h)
    assert r2.json()["status"] == "PENDING"
    reqs = client.get("/admin/upgrade-requests?status=PENDING", headers=admin_h()).json()["requests"]
    rid = [x for x in reqs if x["email"] == email][0]["id"]
    r = client.post(f"/admin/upgrade-requests/{rid}/approve", headers=admin_h())
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    assert r.json()["user"]["role"] == "PREMIUM"

def test_reject_flow():
    t, email = get_user()
    h = {"Authorization": f"Bearer {t}"}
    client.post("/subscription/payment-request", headers=h)
    reqs = client.get("/admin/upgrade-requests?status=PENDING", headers=admin_h()).json()["requests"]
    rid = [x for x in reqs if x["email"] == email][0]["id"]
    r = client.post(f"/admin/upgrade-requests/{rid}/reject", headers=admin_h())
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    assert r.json()["user"]["role"] == "FREE"

def test_search_user_by_code():
    t, _ = get_user()
    h = {"Authorization": f"Bearer {t}"}
    code = client.get("/subscription/payment-info", headers=h).json()["code"]
    r = client.get(f"/admin/users?search={code}", headers=admin_h())
    assert r.json()["total"] == 1

def test_premium_cannot_request_again():
    t, email = get_user()
    h = {"Authorization": f"Bearer {t}"}
    client.post("/subscription/payment-request", headers=h)
    reqs = client.get("/admin/upgrade-requests?status=PENDING", headers=admin_h()).json()["requests"]
    rid = [x for x in reqs if x["email"] == email][0]["id"]
    client.post(f"/admin/upgrade-requests/{rid}/approve", headers=admin_h())
    # need fresh token (role changed)
    t = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    r = client.post("/subscription/payment-request", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 400
