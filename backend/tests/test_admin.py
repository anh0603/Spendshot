from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def get_token(email, pwd="123456"):
    client.post("/auth/register", json={"email": email, "password": pwd})
    r=client.post("/auth/login", json={"email": email, "password": pwd})
    return r.json()["access_token"]

def test_rbac_free_403():
    t=get_token(f"rbac_free_{uuid.uuid4().hex[:6]}@gmail.com")
    r=client.get("/admin/dashboard", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code==403
    r=client.get("/admin/users", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code==403

def test_rbac_premium_403():
    email=f"rbac_prem_{uuid.uuid4().hex[:6]}@gmail.com"
    t=get_token(email)
    client.post("/subscription/upgrade", headers={"Authorization": f"Bearer {t}"})
    r=client.get("/admin/dashboard", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code==403

def test_admin_allowed():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    r=client.get("/admin/dashboard", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code==200
    assert "total_users" in r.json()
    assert "free_users" in r.json()
    assert "total_jars" in r.json()

def test_admin_users_search_filter_pagination():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    h={"Authorization": f"Bearer {t}"}
    # SUPER_ADMIN không còn trong danh sách quản lý
    r=client.get("/admin/users?search=admin@spendshot", headers=h)
    assert r.json()["total"]==0
    r=client.get("/admin/users?plan=FREE&page=1&limit=2", headers=h)
    assert r.json()["limit"]==2
    r=client.get("/admin/users/00000000-0000-0000-0000-000000000000", headers=h)
    assert r.status_code==404

def test_admin_user_detail_and_actions():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    h={"Authorization": f"Bearer {t}"}
    email=f"adm_act_{uuid.uuid4().hex[:6]}@gmail.com"
    get_token(email)
    uid=client.get(f"/admin/users?search={email}", headers=h).json()["users"][0]["id"]
    r=client.get(f"/admin/users/{uid}", headers=h)
    assert r.status_code==200
    assert "jars" in r.json()
    assert "password" not in r.text.lower()
    r=client.patch(f"/admin/users/{uid}", json={"role":"PREMIUM"}, headers=h)
    assert r.status_code==200
    r=client.patch(f"/admin/users/{uid}", json={"status":"SUSPENDED"}, headers=h)
    assert r.status_code==200
    # audit log should have entries
    r=client.get("/admin/audit-logs", headers=h)
    assert r.json()["total"]>=2
    # no password hash/secret in audit (action name RESET_PASSWORD is allowed, but no hash)
    assert "password_hash" not in r.text.lower()
    assert "Temp123!" not in r.text
    # reset password not leaking
    r=client.post(f"/admin/users/{uid}/reset-password", headers=h)
    assert "password_hash" not in r.text.lower()

def test_super_admin_protected():
    t = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    # SUPER_ADMIN không có trong danh sách quản lý
    r = client.get("/admin/users?search=admin@spendshot", headers=h)
    assert all(u["role"] != "SUPER_ADMIN" for u in r.json()["users"])
    # Lấy id super admin trực tiếp để thử đổi
    from app.database import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    sid = db.query(User).filter(User.email == "admin@spendshot.local").first().id
    db.close()
    # Không khóa được
    r = client.patch(f"/admin/users/{sid}", json={"status": "SUSPENDED"}, headers=h)
    assert r.status_code == 400
    # Không hạ cấp được
    r = client.patch(f"/admin/users/{sid}", json={"role": "FREE"}, headers=h)
    assert r.status_code == 400
    # Không đổi mật khẩu được
    r = client.post(f"/admin/users/{sid}/reset-password", json={"new_password": "Hack12345"}, headers=h)
    assert r.status_code == 400
    # Vẫn đăng nhập được
    r = client.post("/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"})
    assert r.status_code == 200

def test_idor_not_via_admin():
    # FREE cannot access admin user detail even if they guess id
    admin_t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    users=client.get("/admin/users?limit=1", headers={"Authorization": f"Bearer {admin_t}"}).json()["users"]
    target_id=users[0]["id"]
    free_t=get_token(f"idor_free_{uuid.uuid4().hex[:6]}@gmail.com")
    r=client.get(f"/admin/users/{target_id}", headers={"Authorization": f"Bearer {free_t}"})
    assert r.status_code==403

def test_no_jwt_leak_in_admin():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    r=client.get("/admin/dashboard", headers={"Authorization": f"Bearer {t}"})
    assert "jwt" not in r.text.lower()

def test_storage_and_sync_monitor():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    h={"Authorization": f"Bearer {t}"}
    r=client.get("/admin/storage", headers=h)
    assert "photos" in r.json()
    r=client.get("/admin/sync-monitor", headers=h)
    assert "pending" in r.json()
