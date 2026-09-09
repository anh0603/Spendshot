from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def admin_h():
    t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}

def test_monthly_stats():
    r = client.get("/admin/stats/monthly", headers=admin_h())
    assert r.status_code == 200
    months = r.json()["months"]
    assert len(months) == 6
    for m in months:
        assert set(["month", "users", "jars", "expenses", "amount"]) <= set(m.keys())
    # Tháng hiện tại có ít nhất admin/user
    assert sum(m["users"] for m in months) >= 1

def test_overview():
    r = client.get("/admin/stats/overview", headers=admin_h())
    assert r.status_code == 200
    d = r.json()
    assert "top_users" in d and "recent_users" in d and "pending_requests" in d
    assert all(u["role"] != "SUPER_ADMIN" for u in d["top_users"])
    assert all("total_spent" in u for u in d["top_users"])

def test_stats_rbac():
    email = f"stat_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    t = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    assert client.get("/admin/stats/monthly", headers=h).status_code == 403
    assert client.get("/admin/stats/overview", headers=h).status_code == 403
