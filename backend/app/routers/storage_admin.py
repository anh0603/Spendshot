"""ADMIN STORAGE MANAGEMENT (chỉ ADMIN/SUPER_ADMIN, RBAC server-side).

- Chỉ xóa STORAGE OBJECTS, KHÔNG xóa expense/jar/user (trừ endpoint full-wipe riêng).
- Xóa ảnh xong: photo/thumbnail ref trong DB đặt "" (schema hiện tại), expense/amount/date giữ nguyên.
- Mọi thao tác xóa đều ghi AuditLog kèm details JSON.
- Không hard-code quota: STORAGE_LIMIT_BYTES (trống = không rõ), local fallback disk.
"""
import json
import os
import shutil
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.audit_log import AuditLog
from ..models.expense import Expense
from ..models.jar import Jar
from ..models.jar_transaction import JarTransaction
from ..models.user import User, UserRole
from ..config import settings
from .admin import require_admin

router = APIRouter(prefix="/admin/storage", tags=["admin-storage"])


def _storage():
    from ..services.storage_service import get_storage
    try:
        return get_storage()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


def _is_stored(storage, ref: str) -> bool:
    try:
        return bool(ref) and storage.is_stored_ref(ref)
    except Exception:
        return False


def _ref_size(storage, ref: str):
    if not _is_stored(storage, ref):
        return None
    try:
        return storage.object_size(ref)
    except Exception:
        return None


def _expense_sizes(storage, exp: Expense) -> dict:
    pb = _ref_size(storage, exp.photo or "")
    tb = _ref_size(storage, exp.thumbnail or "")
    return {
        "has_photo": _is_stored(storage, exp.photo or ""),
        "has_thumb": _is_stored(storage, exp.thumbnail or ""),
        "photo_bytes": pb if pb is not None else 0,
        "thumb_bytes": tb if tb is not None else 0,
        "photo_missing": _is_stored(storage, exp.photo or "") and pb is None,
        "thumb_missing": _is_stored(storage, exp.thumbnail or "") and tb is None,
    }


def _has_image(storage, exp: Expense) -> bool:
    return _is_stored(storage, exp.photo or "") or _is_stored(storage, exp.thumbnail or "")


def _parse_date(s: Optional[str], name: str):
    if not s:
        return None
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Ngày {name} phải dạng YYYY-MM-DD")


def _audit(db: Session, admin: User, action: str, target: str, details: dict, result: str = "SUCCESS"):
    db.add(AuditLog(admin_email=admin.email, action=action, target=target, result=result,
                    details=json.dumps(details, ensure_ascii=False, default=str)))


def _quota() -> dict:
    """limit_bytes + nguồn. Không giả mạo số liệu khi provider không cho biết."""
    from ..services.storage_service import get_storage as _gs
    limit = None
    source = "unknown"
    raw = (settings.STORAGE_LIMIT_BYTES or "").strip()
    if raw:
        try:
            limit = max(0, int(raw))
            source = "configured"
        except ValueError:
            pass
    provider = "local"
    try:
        provider = _gs().name
    except Exception:
        pass
    disk_total = None
    if provider == "local":
        try:
            import os
            root = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
            disk_total = shutil.disk_usage(root if os.path.exists(root) else ".").total
        except Exception:
            disk_total = None
        if limit is None and disk_total:
            limit, source = disk_total, "disk"
    return {"provider": provider, "limit_bytes": limit, "limit_source": source}


def _status(total: int, limit) -> str:
    if not limit:
        return "UNKNOWN"
    pct = (total / limit * 100) if limit > 0 else 0
    if pct >= settings.STORAGE_CRITICAL_THRESHOLD:
        return "CRITICAL"
    if pct >= settings.STORAGE_WARN_THRESHOLD:
        return "WARNING"
    return "NORMAL"


@router.get("/overview")
def overview(sort: str = Query("storage_desc", pattern="^(storage_desc|storage_asc|expenses_desc|oldest|newest)$"),
             db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    storage = _storage()
    users = db.query(User).all()
    rows = []
    total_bytes, total_objects, exp_with_photos = 0, 0, 0
    for u in users:
        exps = db.query(Expense).filter(Expense.user_id == u.id).all()
        with_img = [e for e in exps if _has_image(storage, e)]
        ubytes, uobjs = 0, 0
        oldest, newest = None, None
        for e in with_img:
            s = _expense_sizes(storage, e)
            ubytes += s["photo_bytes"] + s["thumb_bytes"]
            uobjs += (1 if s["has_photo"] else 0) + (1 if s["has_thumb"] else 0)
            if e.created_at:
                oldest = e.created_at if oldest is None or e.created_at < oldest else oldest
                newest = e.created_at if newest is None or e.created_at > newest else newest
        total_bytes += ubytes
        total_objects += uobjs
        exp_with_photos += len(with_img)
        rows.append({
            "user_id": u.id, "email": u.email,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "expenses_with_photos": len(with_img), "image_objects": uobjs,
            "bytes_used": ubytes,
            "oldest": str(oldest) if oldest else None,
            "newest": str(newest) if newest else None,
        })
    rows = [r for r in rows if r["expenses_with_photos"] > 0]
    key = {"storage_desc": (lambda r: r["bytes_used"], True),
           "storage_asc": (lambda r: r["bytes_used"], False),
           "expenses_desc": (lambda r: r["expenses_with_photos"], True),
           "oldest": (lambda r: (r["oldest"] is None, r["oldest"] or ""), False),
           "newest": (lambda r: (r["newest"] is None, r["newest"] or ""), True)}[sort]
    rows.sort(key=key[0], reverse=key[1])
    q = _quota()
    pct = round(total_bytes / q["limit_bytes"] * 100, 2) if q["limit_bytes"] else None
    return {
        "provider": q["provider"],
        "total_bytes": total_bytes, "total_objects": total_objects,
        "limit_bytes": q["limit_bytes"], "limit_source": q["limit_source"],
        "usage_percent": pct, "status": _status(total_bytes, q["limit_bytes"]),
        "warn_threshold": settings.STORAGE_WARN_THRESHOLD,
        "critical_threshold": settings.STORAGE_CRITICAL_THRESHOLD,
        "users_with_data": len(rows), "expenses_with_photos": exp_with_photos,
        "image_objects": total_objects, "users": rows,
    }


def _user_expenses(db: Session, user_id: str):
    return db.query(Expense).filter(Expense.user_id == user_id).all()


@router.get("/users/{user_id}")
def user_detail(user_id: str, date_from: Optional[str] = Query(default=None, alias="from"),
                date_to: Optional[str] = Query(default=None, alias="to"),
                sort: str = Query("newest", pattern="^(oldest|newest)$"),
                limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
                db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    storage = _storage()
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    dfrom, dto = _parse_date(date_from, "from"), _parse_date(date_to, "to")
    if dfrom and dto and dfrom > dto:
        raise HTTPException(status_code=400, detail="From date phải <= To date")
    items = []
    for e in _user_expenses(db, user_id):
        if not _has_image(storage, e):
            continue
        day = e.created_at.date() if e.created_at else None
        if dfrom and (day is None or day < dfrom):
            continue
        if dto and (day is None or day > dto):
            continue
        s = _expense_sizes(storage, e)
        items.append({"id": e.id, "created_at": str(e.created_at) if e.created_at else None,
                      "amount": e.amount, "photo": e.photo or "", "thumbnail": e.thumbnail or "",
                      **s, "total_bytes": s["photo_bytes"] + s["thumb_bytes"]})
    items.sort(key=lambda x: (x["created_at"] is None, x["created_at"] or ""),
               reverse=(sort == "newest"))
    total = len(items)
    page = items[offset:offset + limit]
    return {
        "user_id": u.id, "email": u.email,
        "total_bytes": sum(i["total_bytes"] for i in items),
        "total_objects": sum((1 if i["has_photo"] else 0) + (1 if i["has_thumb"] else 0) for i in items),
        "expenses_with_photos": total,
        "oldest": items[-1]["created_at"] if sort == "newest" and items else (items[0]["created_at"] if items else None),
        "newest": items[0]["created_at"] if sort == "newest" and items else (items[-1]["created_at"] if items else None),
        "items": page, "limit": limit, "offset": offset, "total": total,
    }


def _select(db: Session, storage, user_id: str, mode: str,
            date_from: Optional[str], date_to: Optional[str], n: Optional[int]):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    if mode == "date_range":
        dfrom, dto = _parse_date(date_from, "from"), _parse_date(date_to, "to")
        if not dfrom or not dto:
            raise HTTPException(status_code=400, detail="DATE_RANGE cần from + to (YYYY-MM-DD)")
        if dfrom > dto:
            raise HTTPException(status_code=400, detail="From date phải <= To date")
        sel = []
        for e in _user_expenses(db, user_id):
            if not _has_image(storage, e):
                continue
            day = e.created_at.date() if e.created_at else None
            if day is None or day < dfrom or day > dto:
                continue
            sel.append(e)
        sel.sort(key=lambda e: (e.created_at is None, e.created_at or datetime.min))
        return sel, {"mode": "DATE_RANGE", "from": str(dfrom), "to": str(dto)}
    if mode in ("oldest", "newest"):
        if not n or n < 1:
            raise HTTPException(status_code=400, detail="Cần n >= 1")
        n = min(int(n), 1000)
        sel = [e for e in _user_expenses(db, user_id) if _has_image(storage, e)]
        sel.sort(key=lambda e: (e.created_at is None, e.created_at or datetime.min),
                 reverse=(mode == "newest"))
        return sel[:n], {"mode": mode.upper(), "n": n}
    raise HTTPException(status_code=400, detail="mode phải là date_range|oldest|newest")


def _preview_of(storage, sel) -> dict:
    main = sum(1 for e in sel if _is_stored(storage, e.photo or ""))
    thumbs = sum(1 for e in sel if _is_stored(storage, e.thumbnail or ""))
    jb = 0
    for e in sel:
        for ref in (e.photo or "", e.thumbnail or ""):
            if _is_stored(storage, ref):
                jb += _ref_size(storage, ref) or 0
    dates = [e.created_at for e in sel if e.created_at]
    return {"expenses": len(sel), "main_images": main, "thumbnails": thumbs,
            "objects": main + thumbs, "bytes_to_free": jb,
            "oldest": str(min(dates)) if dates else None,
            "newest": str(max(dates)) if dates else None}


@router.post("/preview")
def delete_preview(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    storage = _storage()
    sel, info = _select(db, storage, payload.get("user_id", ""),
                        payload.get("mode", ""), payload.get("from"), payload.get("to"),
                        payload.get("n"))
    out = _preview_of(storage, sel)
    out.update({**info, "target_user": payload.get("user_id", "")})
    return out


@router.post("/delete")
def delete_images(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Chỉ xóa STORAGE OBJECTS + null ref trong DB. Expense/Jar/User giữ nguyên."""
    if payload.get("confirm") is not True:
        raise HTTPException(status_code=400, detail="Cần confirm=true để xóa")
    storage = _storage()
    user_id = payload.get("user_id", "")
    sel, info = _select(db, storage, user_id, payload.get("mode", ""),
                        payload.get("from"), payload.get("to"), payload.get("n"))
    objects, freed, skipped_remote = 0, 0, 0
    for e in sel:
        for field in ("photo", "thumbnail"):
            ref = getattr(e, field) or ""
            if not ref:
                continue
            if not _is_stored(storage, ref):
                skipped_remote += 1
                continue
            freed += storage.delete_ref(ref) or 0
            objects += 1
            setattr(e, field, "")
    db.commit()
    details = {**info, "admin_id": admin.id, "target_user": user_id,
               "expenses": len(sel), "objects": objects, "bytes_freed": freed,
               "skipped_remote": skipped_remote}
    _audit(db, admin, "ADMIN_STORAGE_DELETE", user_id, details)
    db.commit()
    return {"message": f"Đã xóa {objects} objects (~{freed} bytes), giữ nguyên {len(sel)} expenses",
            **details}


def _referenced_keys(db: Session, storage) -> set:
    refs = set()
    for e in db.query(Expense).all():
        for ref in (e.photo or "", e.thumbnail or ""):
            if _is_stored(storage, ref):
                try:
                    refs.add(storage.canon(ref))
                except Exception:
                    pass
    for u in db.query(User).all():
        av = getattr(u, "avatar", "") or ""
        if _is_stored(storage, av):
            try:
                refs.add(storage.canon(av))
            except Exception:
                pass
    return refs


@router.get("/orphans/preview")
def orphans_preview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    storage = _storage()
    refs = _referenced_keys(db, storage)
    orphans = []
    for ref, size in storage.list_all_objects():
        try:
            key = storage.canon(ref)
        except Exception:
            continue
        if key not in refs:
            orphans.append({"ref": ref, "bytes": size})
    orphans.sort(key=lambda o: o["ref"])
    return {"objects": len(orphans), "bytes": sum(o["bytes"] for o in orphans),
            "sample": orphans[:20]}


@router.post("/orphans/cleanup")
def orphans_cleanup(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Chỉ xóa object KHÔNG còn DB nào tham chiếu. Không đụng ảnh của expense tồn tại."""
    if payload.get("confirm") is not True:
        raise HTTPException(status_code=400, detail="Cần confirm=true để dọn")
    storage = _storage()
    refs = _referenced_keys(db, storage)
    objects, freed = 0, 0
    for ref, _size in storage.list_all_objects():
        try:
            key = storage.canon(ref)
        except Exception:
            continue
        if key in refs:
            continue
        freed += storage.delete_ref(ref) or 0
        objects += 1
    details = {"admin_id": admin.id, "objects": objects, "bytes_freed": freed}
    _audit(db, admin, "ADMIN_STORAGE_ORPHAN_CLEANUP", "-", details)
    db.commit()
    return {"message": f"Đã dọn {objects} orphan objects (~{freed} bytes)", **details}


def wipe_user_data(db: Session, admin: User, target: User) -> dict:
    """Dùng chung cho DELETE /admin/users/{id}/data (định nghĩa trong admin.py).
    RIÊNG BIỆT với Delete images: xóa toàn bộ dữ liệu 1 user."""
    from ..models.notifications import PushSubscription, NotificationHistory, EmailReminderLog
    from ..models.payment import UpgradeRequest
    from ..models.jar_transaction import JarTransaction
    user_id = target.id
    storage = _storage()
    freed = 0
    try:
        for ref, _s in storage.list_user_objects(user_id):
            freed += storage.delete_ref(ref) or 0
        av = getattr(target, "avatar", "") or ""
        if _is_stored(storage, av):
            freed += storage.delete_ref(av) or 0
    except Exception:
        pass
    # Xóa cả thư mục uploads/{uid} rỗng còn sót (local)
    try:
        from ..services.storage_service import LocalStorageProvider
        if isinstance(storage, LocalStorageProvider):
            import shutil as _shutil
            _shutil.rmtree(os.path.join(storage.root, user_id), ignore_errors=True)
    except Exception:
        pass
    n_exp = db.query(Expense).filter(Expense.user_id == user_id).count()
    n_jar = db.query(Jar).filter(Jar.user_id == user_id).count()
    jar_ids = [j.id for j in db.query(Jar.id).filter(Jar.user_id == user_id).all()]
    if jar_ids:
        db.query(JarTransaction).filter(JarTransaction.jar_id.in_(jar_ids)).delete(synchronize_session=False)
    db.query(Expense).filter(Expense.user_id == user_id).delete(synchronize_session=False)
    db.query(Jar).filter(Jar.user_id == user_id).delete(synchronize_session=False)
    n_push = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete(synchronize_session=False)
    db.query(NotificationHistory).filter(NotificationHistory.user_id == user_id).delete(synchronize_session=False)
    db.query(EmailReminderLog).filter(EmailReminderLog.user_id == user_id).delete(synchronize_session=False)
    db.query(UpgradeRequest).filter(UpgradeRequest.user_id == user_id).delete(synchronize_session=False)
    email = target.email
    db.delete(target)
    details = {"admin_id": admin.id, "target_user": user_id, "email": email,
               "expenses": n_exp, "jars": n_jar, "push_subscriptions": n_push,
               "bytes_freed": freed}
    _audit(db, admin, "ADMIN_USER_DATA_DELETE", user_id, details)
    db.commit()
    return {"message": f"Đã xóa toàn bộ dữ liệu của {email}", **details}