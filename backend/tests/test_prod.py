"""Production required fixes: fail-loud DB, seed env, Supabase private refs/proxy, stats PG-compat."""
import io
import uuid
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.database import SessionLocal, resolve_database_url
from app.models.user import User

client = TestClient(app)


def test_fail_loud_branches():
    # dev cho sqlite
    assert resolve_database_url("development", "sqlite:///./x.db").startswith("sqlite")
    # production sqlite -> fail
    with pytest.raises(RuntimeError):
        resolve_database_url("production", "sqlite:///./x.db")
    # production thiếu -> fail
    with pytest.raises(RuntimeError):
        resolve_database_url("production", "")
    # production postgres -> ok + chuẩn hóa driver psycopg v3
    url = "postgresql://u:p@localhost:5432/db"
    assert resolve_database_url("production", url) == "postgresql+psycopg://u:p@localhost:5432/db"
    assert resolve_database_url("production", "postgresql+psycopg://u:p@localhost:5432/db").startswith("postgresql+psycopg://")
    # URL pooler Supabase kèm pgbouncer=true -> lược bỏ param lạ với libpq
    assert resolve_database_url(
        "production", "postgresql://u:p@aws-0.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
    ) == "postgresql+psycopg://u:p@aws-0.pooler.supabase.com:6543/postgres?sslmode=require"
    # engine dùng pool_pre_ping cho non-sqlite, tắt cho sqlite
    from app import database as dbmod
    is_pg = dbmod.engine.dialect.name == "postgresql"
    assert dbmod.engine.pool._pre_ping is is_pg


def test_seed_requires_env(monkeypatch):
    import seed as seed_mod
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    with pytest.raises(SystemExit):
        seed_mod.seed_super_admin()
    # có env + email mới -> tạo SUPER_ADMIN (dọn sau)
    email = f"seedprod_{uuid.uuid4().hex[:6]}@gmail.com"
    monkeypatch.setenv("ADMIN_EMAIL", email)
    monkeypatch.setenv("ADMIN_PASSWORD", "StrongPass123!")
    seed_mod.seed_super_admin()
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        from app.models.user import UserRole
        assert u is not None and u.role == UserRole.SUPER_ADMIN
        db.delete(u)
        db.commit()
    finally:
        db.close()


def test_sb_ref_helpers(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://xyz.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET", "spendshot")
    from app.services.storage_service import SupabaseStorageProvider
    p = SupabaseStorageProvider()
    # private: ref dạng /sb/key (không lộ key trần, frontend dùng được ngay)
    assert p._ref("users/u1/expenses/e1/bill.jpg") == "/sb/users/u1/expenses/e1/bill.jpg"
    assert p.key_from_ref("/sb/users/u1/expenses/e1/bill.jpg") == "users/u1/expenses/e1/bill.jpg"
    assert p.key_from_ref("users/u1/avatar.jpg") == "users/u1/avatar.jpg"
    assert p.key_from_ref("/sb/../secret") is None
    assert p.is_stored_ref("/sb/users/u1/expenses/e1/bill.jpg") is True
    assert p.is_stored_ref("https://picsum.photos/seed/x/400/400") is False


def _user(email=None):
    if not email:
        email = f"prodsb_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    r = client.post("/auth/login", json={"email": email, "password": "123456"})
    return r.json()["access_token"], email


def test_sb_proxy_auth_and_ownership(monkeypatch):
    class FakeSB:
        name = "supabase"

        def fetch_ref(self, ref):
            return (b"fake-bytes", "image/jpeg")

    monkeypatch.setattr("app.services.storage_service.get_storage", lambda: FakeSB())
    tokA, _ = _user()
    tokB, _ = _user()
    # cần uidA: lấy từ token A
    meA = client.get("/auth/me", headers={"Authorization": f"Bearer {tokA}"}).json()
    uidA = meA["id"]
    url_owner = f"/sb/users/{uidA}/expenses/e1/bill.jpg"
    url_other = "/sb/users/other-user-id/expenses/e1/bill.jpg"
    # anon -> 401
    assert client.get(url_owner).status_code == 401
    # user khác -> 404 (không oracle)
    assert client.get(url_other, headers={"Authorization": f"Bearer {tokB}"}).status_code == 404
    # traversal -> 404
    assert client.get("/sb/../app/main.py", headers={"Authorization": f"Bearer {tokA}"}).status_code == 404
    # owner -> 200 đúng content-type
    r = client.get(url_owner, headers={"Authorization": f"Bearer {tokA}"})
    assert r.status_code == 200 and r.content == b"fake-bytes"
    assert "image/jpeg" in r.headers.get("content-type", "")


def test_production_storage_fail_loud(monkeypatch):
    from app.config import settings
    import app.main as main_mod
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "supabase")
    for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"):
        monkeypatch.setattr(settings, k, "")
    import pytest as _pt
    with _pt.raises(RuntimeError):
        main_mod._validate_production_storage()
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://xyz.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET", "spendshot")
    main_mod._validate_production_storage()  # đủ creds -> không raise
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "bogus")
    with _pt.raises(RuntimeError):
        main_mod._validate_production_storage()


def test_stats_monthly_works():
    h = {"Authorization": "Bearer " + client.post(
        "/auth/login", json={"email": "admin@spendshot.local", "password": "Admin123!"}).json()["access_token"]}
    r = client.get("/admin/stats/monthly", headers=h)
    assert r.status_code == 200
    months = r.json()["months"]
    assert len(months) == 6 and all({"month", "users", "jars", "expenses", "amount"} <= set(m) for m in months)
