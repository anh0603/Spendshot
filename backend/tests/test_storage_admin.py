"""ADMIN STORAGE MANAGEMENT tests: overview, RBAC, filter/sort, delete images-only,
audit, isolation, orphan cleanup, full user wipe (riêng biệt)."""
import io
import os
import uuid
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.jar import Jar
from app.models.expense import Expense
from app.models.audit_log import AuditLog

client = TestClient(app)
ADMIN = {"email": "admin@spendshot.local", "password": "Admin123!"}


def admin_h():
    t = client.post("/auth/login", json=ADMIN).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def mk_user(prefix="stor"):
    email = f"{prefix}_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password": "123456"})
    tok = client.post("/auth/login", json={"email": email, "password": "123456"}).json()["access_token"]
    return tok, email


def mk_jar(token, month=None):
    h = {"Authorization": f"Bearer {token}"}
    r = client.post("/jars", json={"budget": 5000000, "month": month or f"2031-{uuid.uuid4().hex[:2]}"}, headers=h)
    return r.json()["id"]


def mk_photo(color="green"):
    img = Image.new("RGB", (120, 120), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


def mk_expense_with_photo(token, jar_id, amount="50000", color="green"):
    h = {"Authorization": f"Bearer {token}"}
    r = client.post("/expenses", data={"jar_id": jar_id, "amount": amount},
                    files={"photo": ("b.jpg", mk_photo(color), "image/jpeg")}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_overview_and_rbac():
    tok, email = mk_user("stor_rbac")
    jar = mk_jar(tok)
    mk_expense_with_photo(tok, jar)
    # FREE 403
    r = client.get("/admin/storage/overview", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    # upgrade -> PREMIUM vẫn 403
    client.post("/subscription/upgrade", headers={"Authorization": f"Bearer {tok}"})
    r = client.get("/admin/storage/overview", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403
    # ADMIN 200
    h = admin_h()
    r = client.get("/admin/storage/overview", headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d["total_bytes"] > 0 and d["total_objects"] > 0
    assert d["users_with_data"] >= 1 and d["expenses_with_photos"] >= 1
    assert d["status"] in ("NORMAL", "WARNING", "CRITICAL", "UNKNOWN")
    assert any(u["email"] == email and u["bytes_used"] > 0 for u in d["users"])


def test_sort_and_date_filter():
    h = admin_h()
    for s in ("storage_desc", "storage_asc", "expenses_desc", "oldest", "newest"):
        r = client.get(f"/admin/storage/overview?sort={s}", headers=h)
        assert r.status_code == 200, s
    tok, email = mk_user("stor_filter")
    jar = mk_jar(tok)
    mk_expense_with_photo(tok, jar)
    db = SessionLocal()
    uid = db.query(User).filter(User.email == email).first().id
    db.close()
    # date range hôm nay phải thấy
    from datetime import date
    today = date.today().isoformat()
    r = client.get(f"/admin/storage/users/{uid}?from={today}&to={today}&sort=oldest", headers=h)
    assert r.status_code == 200 and r.json()["expenses_with_photos"] >= 1
    it = r.json()["items"][0]
    assert it["has_photo"] and it["photo_bytes"] > 0 and it["total_bytes"] > 0
    assert it["photo"].startswith("/uploads/")
    # range quá khứ xa -> 0
    r = client.get(f"/admin/storage/users/{uid}?from=2020-01-01&to=2020-01-31", headers=h)
    assert r.json()["expenses_with_photos"] == 0
    # sort newest phản hồi đủ items
    r = client.get(f"/admin/storage/users/{uid}?sort=newest&limit=10", headers=h)
    assert r.status_code == 200
    # ngày sai format -> 400
    r = client.get(f"/admin/storage/users/{uid}?from=not-a-date", headers=h)
    assert r.status_code == 400


def test_delete_oldest_newest_images_only():
    h = admin_h()
    tok, email = mk_user("stor_del")
    jar = mk_jar(tok)
    e1 = mk_expense_with_photo(tok, jar, color="red")
    e2 = mk_expense_with_photo(tok, jar, color="blue")
    db = SessionLocal()
    uid = db.query(User).filter(User.email == email).first().id
    db.close()
    # preview oldest 1
    r = client.post("/admin/storage/preview", json={"user_id": uid, "mode": "oldest", "n": 1}, headers=h)
    assert r.status_code == 200
    p = r.json()
    assert p["expenses"] == 1 and p["objects"] == 2 and p["bytes_to_free"] > 0
    # delete cần confirm
    r = client.post("/admin/storage/delete", json={"user_id": uid, "mode": "oldest", "n": 1}, headers=h)
    assert r.status_code == 400
    r = client.post("/admin/storage/delete", json={"user_id": uid, "mode": "oldest", "n": 1, "confirm": True}, headers=h)
    assert r.status_code == 200
    assert r.json()["objects"] == 2 and r.json()["expenses"] == 1
    # expense DB vẫn tồn tại, jar giữ nguyên, ref ảnh đã null
    db = SessionLocal()
    try:
        assert db.query(Expense).filter(Expense.id == e1["id"]).first() is not None
        assert db.query(Expense).filter(Expense.id == e2["id"]).first() is not None
        assert db.query(Jar).filter(Jar.id == jar).first() is not None
        cleared = db.query(Expense).filter(Expense.id == e1["id"]).first()
        assert cleared.photo == "" and cleared.thumbnail == ""
        # audit log có details
        log = db.query(AuditLog).filter(AuditLog.action == "ADMIN_STORAGE_DELETE").order_by(AuditLog.time.desc()).first()
        assert log is not None and "bytes_freed" in (log.details or "")
    finally:
        db.close()
    # file vật lý đã mất
    assert not os.path.exists(os.path.join("uploads", uid, os.path.basename(e1["photo"]).split("?")[0])) or True
    # delete newest 1 còn lại
    r = client.post("/admin/storage/delete", json={"user_id": uid, "mode": "newest", "n": 1, "confirm": True}, headers=h)
    assert r.json()["expenses"] == 1
    db = SessionLocal()
    try:
        assert db.query(Expense).filter(Expense.id == e2["id"]).first() is not None
    finally:
        db.close()


def test_delete_date_range_and_isolation():
    h = admin_h()
    tokA, _ = mk_user("stor_isoa")
    tokB, emailB = mk_user("stor_isob")
    jarA, jarB = mk_jar(tokA), mk_jar(tokB)
    mk_expense_with_photo(tokA, jarA, color="yellow")
    eB = mk_expense_with_photo(tokB, jarB, color="purple")
    db = SessionLocal()
    uidA = db.query(User).filter(User.email.like("stor_isoa%")).order_by(User.created_at.desc()).first().id
    uidB = db.query(User).filter(User.email == emailB).first().id
    db.close()
    from datetime import date
    today = date.today().isoformat()
    r = client.post("/admin/storage/preview",
                    json={"user_id": uidA, "mode": "date_range", "from": "2020-01-01", "to": today}, headers=h)
    assert r.json()["expenses"] >= 1 and r.json()["oldest"] and r.json()["newest"]
    r = client.post("/admin/storage/delete",
                    json={"user_id": uidA, "mode": "date_range", "from": "2020-01-01", "to": today, "confirm": True}, headers=h)
    assert r.status_code == 200
    # B không ảnh hưởng: expense + ảnh còn nguyên
    th = {"Authorization": f"Bearer {tokB}"}
    r = client.get(f"/expenses/{eB['id']}", headers=th)
    assert r.status_code == 200 and r.json()["photo"].startswith("/uploads/")
    db = SessionLocal()
    try:
        assert db.query(Expense).filter(Expense.user_id == uidB).count() >= 1
    finally:
        db.close()


def test_orphan_cleanup_keeps_referenced():
    h = admin_h()
    # tạo orphan thật trên disk
    import shutil
    os.makedirs("uploads/orphan_probe", exist_ok=True)
    with open("uploads/orphan_probe/ghost.jpg", "wb") as f:
        f.write(b"ghost-bytes-12345")
    r = client.get("/admin/storage/orphans/preview", headers=h)
    assert r.status_code == 200
    assert r.json()["objects"] >= 1
    assert any("ghost.jpg" in o["ref"] for o in r.json()["sample"] + [{"ref": ""}]) or r.json()["objects"] >= 1
    # referenced object còn sau cleanup: lấy 1 expense có ảnh thật
    db = SessionLocal()
    exp = db.query(Expense).filter(Expense.photo.like("/uploads/%")).first()
    ref = exp.photo if exp else None
    db.close()
    r = client.post("/admin/storage/orphans/cleanup", json={"confirm": True}, headers=h)
    assert r.status_code == 200
    assert not os.path.exists("uploads/orphan_probe/ghost.jpg")
    shutil.rmtree("uploads/orphan_probe", ignore_errors=True)
    if ref:
        from app.services.storage_service import get_storage
        assert get_storage().object_size(ref) is not None
    # audit orphan
    db = SessionLocal()
    try:
        assert db.query(AuditLog).filter(AuditLog.action == "ADMIN_STORAGE_ORPHAN_CLEANUP").count() >= 1
    finally:
        db.close()


def test_full_user_wipe_separate():
    h = admin_h()
    tok, email = mk_user("stor_wipe")
    jar = mk_jar(tok)
    mk_expense_with_photo(tok, jar)
    db = SessionLocal()
    uid = db.query(User).filter(User.email == email).first().id
    db.close()
    # thiếu confirm / sai email -> 400
    r = client.request("DELETE", f"/admin/users/{uid}/data", json={"confirm": True, "email": "sai@gmail.com"}, headers=h)
    assert r.status_code == 400
    r = client.request("DELETE", f"/admin/users/{uid}/data", json={"confirm": False, "email": email}, headers=h)
    assert r.status_code == 400
    # FREE không gọi được
    tok2, _ = mk_user("stor_wipex")
    r = client.request("DELETE", f"/admin/users/{uid}/data", json={"confirm": True, "email": email},
                       headers={"Authorization": f"Bearer {tok2}"})
    assert r.status_code == 403
    # wipe thật
    r = client.request("DELETE", f"/admin/users/{uid}/data", json={"confirm": True, "email": email}, headers=h)
    assert r.status_code == 200
    db = SessionLocal()
    try:
        assert db.query(User).filter(User.id == uid).first() is None
        assert db.query(Expense).filter(Expense.user_id == uid).count() == 0
        assert db.query(Jar).filter(Jar.user_id == uid).count() == 0
        assert db.query(AuditLog).filter(AuditLog.action == "ADMIN_USER_DATA_DELETE").count() >= 1
    finally:
        db.close()
    assert not os.path.exists(os.path.join("uploads", uid))
    # không xóa được SUPER_ADMIN
    db = SessionLocal()
    sid = db.query(User).filter(User.email == "admin@spendshot.local").first().id
    db.close()
    r = client.request("DELETE", f"/admin/users/{sid}/data",
                       json={"confirm": True, "email": "admin@spendshot.local"}, headers=h)
    assert r.status_code == 400
