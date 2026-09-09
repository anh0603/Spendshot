"""Tests storage abstraction: local roundtrip, validation, Supabase refs (mock transport)."""
import os
from PIL import Image
import io
import pytest


def _img_bytes(fmt="JPEG", size=(800, 600), color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return buf.getvalue()


def test_local_expense_roundtrip(tmp_path):
    from app.services.storage_service import LocalStorageProvider
    p = LocalStorageProvider(root=str(tmp_path))
    photo, thumb, eid = p.save_expense_photo("u1", _img_bytes(), "image/jpeg")
    assert photo == f"/uploads/u1/{eid}.jpg"
    assert thumb == f"/uploads/u1/{eid}_thumb.jpg"
    assert os.path.exists(tmp_path / "u1" / f"{eid}.jpg")
    im = Image.open(tmp_path / "u1" / f"{eid}.jpg")
    assert max(im.size) <= 1024  # resize giữ nguyên pipeline
    th = Image.open(tmp_path / "u1" / f"{eid}_thumb.jpg")
    assert max(th.size) <= 480


def test_local_validation():
    from app.services.storage_service import LocalStorageProvider
    import tempfile
    p = LocalStorageProvider(root=tempfile.mkdtemp())
    with pytest.raises(ValueError):
        p.save_expense_photo("u1", b"xxx", "image/gif")
    with pytest.raises(ValueError):
        p.save_expense_photo("u1", b"x" * (6 * 1024 * 1024), "image/jpeg")


def test_local_avatar(tmp_path):
    from app.services.storage_service import LocalStorageProvider
    p = LocalStorageProvider(root=str(tmp_path))
    ref = p.save_avatar("u9", _img_bytes("PNG"))
    assert ref == "/uploads/avatars/u9.jpg"
    assert os.path.exists(tmp_path / "avatars" / "u9.jpg")


def _sb_provider(monkeypatch):
    from app.config import settings
    from app.services.storage_service import SupabaseStorageProvider
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://xyz.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET", "spendshot")
    return SupabaseStorageProvider()


def test_supabase_missing_config_raises(monkeypatch):
    from app.config import settings
    from app.services.storage_service import SupabaseStorageProvider
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    with pytest.raises(RuntimeError):
        SupabaseStorageProvider()


def test_supabase_ref_format_and_keys(monkeypatch):
    p = _sb_provider(monkeypatch)
    assert p.key_from_ref("/sb/users/u1/expenses/e1/bill.jpg") == "users/u1/expenses/e1/bill.jpg"
    assert p.key_from_ref("/sb/../secret") is None
    assert p.key_from_ref("https://picsum.photos/seed/x/400/400") is None
    assert p.is_stored_ref("/sb/users/u1/expenses/e1/bill.jpg") is True
    assert p.is_stored_ref("https://picsum.photos/seed/x/400/400") is False
    assert p.is_stored_ref("") is False
    assert p.canon("/sb/users/u1/avatar.jpg") == "users/u1/avatar.jpg"


def test_supabase_save_layout(monkeypatch):
    p = _sb_provider(monkeypatch)
    calls = []

    def fake_put(key, data, content_type, upsert=False):
        calls.append((key, content_type, upsert))

    monkeypatch.setattr(p, "_put", fake_put)
    photo, thumb, eid = p.save_expense_photo("u1", _img_bytes(), "image/jpeg")
    assert photo == f"/sb/users/u1/expenses/{eid}/bill.jpg"
    assert thumb == f"/sb/users/u1/expenses/{eid}/thumb.jpg"
    assert calls[0][0].endswith("/bill.jpg") and calls[0][2] is False
    ref = p.save_avatar("u1", _img_bytes("PNG"))
    assert ref == "/sb/users/u1/avatar.jpg"
    assert calls[-1][2] is True  # avatar ghi đè cùng key -> upsert
    with pytest.raises(ValueError):
        p.save_expense_photo("u1", b"xxx", "image/gif")


def test_supabase_size_list_delete(monkeypatch):
    import httpx
    p = _sb_provider(monkeypatch)

    class FakeResp:
        def __init__(self, status=200, payload=None):
            self.status_code = status
            self._payload = payload if payload is not None else []

        def json(self):
            return self._payload

    listed = [
        {"id": "a", "name": "users/u1/expenses/e1/bill.jpg", "metadata": {"size": 1000}},
        {"id": "b", "name": "users/u1/expenses/e1/thumb.jpg", "metadata": {"size": 200}},
    ]
    monkeypatch.setattr(httpx, "post", lambda *a, **k: FakeResp(200, listed))
    assert p.object_size("/sb/users/u1/expenses/e1/bill.jpg") == 1000
    assert p.object_size("/sb/users/u1/nope.jpg") is None
    objs = p.list_user_objects("u1")
    assert ("/sb/users/u1/expenses/e1/bill.jpg", 1000) in objs
    assert p.list_all_objects() == [("users/u1/expenses/e1/bill.jpg", 1000),
                                    ("users/u1/expenses/e1/thumb.jpg", 200)]

    deleted = []

    class FakeDel:
        status_code = 200

    def fake_request(method, url, json=None, headers=None, timeout=None):
        assert method == "DELETE"
        deleted.extend(json["prefixes"])
        return FakeDel()

    monkeypatch.setattr(httpx, "request", fake_request)
    assert p.delete_ref("/sb/users/u1/expenses/e1/bill.jpg") == 1000
    assert deleted == ["users/u1/expenses/e1/bill.jpg"]
    assert p.delete_ref("https://picsum.photos/x.jpg") == 0  # remote: không đụng


def test_sb_proxy_auth_and_ownership(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)

    class FakeSB:
        name = "supabase"

        def fetch_ref(self, ref):
            return (b"sb-bytes", "image/jpeg")

    monkeypatch.setattr("app.services.storage_service.get_storage", lambda: FakeSB())
    import uuid as _uuid

    def _user():
        email = f"sbsync_{_uuid.uuid4().hex[:6]}@gmail.com"
        c.post("/auth/register", json={"email": email, "password": "123456"})
        tok = c.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
        uid = c.get("/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()["id"]
        return tok, uid

    tokA, uidA = _user()
    tokB, _ = _user()
    url = f"/sb/users/{uidA}/expenses/e1/bill.jpg"
    assert c.get(url).status_code == 401
    assert c.get("/sb/users/other/expenses/e1/bill.jpg", headers={"Authorization": f"Bearer {tokB}"}).status_code == 404
    assert c.get("/sb/../app/main.py", headers={"Authorization": f"Bearer {tokA}"}).status_code == 404
    r = c.get(url, headers={"Authorization": f"Bearer {tokA}"})
    assert r.status_code == 200 and r.content == b"sb-bytes"


def test_get_storage_defaults_local():
    from app.config import settings
    from app.services.storage_service import get_storage, LocalStorageProvider
    assert (settings.STORAGE_PROVIDER or "local").lower() == "local"
    assert isinstance(get_storage(), LocalStorageProvider)
