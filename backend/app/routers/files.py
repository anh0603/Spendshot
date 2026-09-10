"""CRITICAL-2: serve file user (bill/avatar) qua authenticated endpoint.

Thay thế StaticFiles public /uploads. Mọi request phải có JWT (header
``Authorization: Bearer`` hoặc ``?token=`` cho thẻ <img>) và phải qua
verify ownership:
- ``avatars/{uid}.jpg`` -> chỉ đúng uid đó, hoặc ADMIN/SUPER_ADMIN
- ``{uid}/...``        -> chỉ đúng uid đó, hoặc ADMIN/SUPER_ADMIN

Thiếu/sai token -> 401. Sai owner / path lạ / file không tồn tại -> 404
(cố ý 404 thay vì 403 để tránh oracle xác nhận sự tồn tại của file người khác).
"""
import mimetypes
import os
from pathlib import PurePosixPath

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response

from ..database import SessionLocal

router = APIRouter(tags=["files"])

UPLOAD_ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))


def _user_from_request(request: Request, db):
    """Giải mã JWT từ header Bearer hoặc ?token=. Raise 401/403, không bao giờ None."""
    from jose import jwt
    from ..config import settings
    from ..models.user import User

    token = ""
    auth = request.headers.get("authorization", "") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        token = (request.query_params.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Thiếu token xác thực")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Người dùng không tồn tại")
    status_val = user.status.value if hasattr(user.status, "value") else str(user.status)
    if status_val == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Tài khoản bị khóa")
    return user


@router.get("/uploads/{file_path:path}")
def get_protected_file(file_path: str, request: Request):
    return _serve_file(file_path, request)


@router.get("/sb/{file_path:path}")
def get_sb_file(file_path: str, request: Request):
    """Supabase Storage private proxy: /sb/users/{uid}/... — cùng JWT + ownership như /uploads."""
    return _serve_file("sb/" + (file_path or ""), request)


def _cache_headers(is_avatar: bool) -> dict:
    # Ảnh expense/thumbnail: ID bất biến vĩnh viễn -> cache 1 năm (kể cả CDN).
    # Avatar: cùng URL nhưng nội dung bị ghi đè khi đổi -> bắt revalidate mỗi lần
    # (FileResponse tự trả 304 qua etag/last-modified nên vẫn nhanh).
    if is_avatar:
        return {"Cache-Control": "private, no-cache"}
    return {"Cache-Control": "public, max-age=31536000, immutable"}


def _serve_file(file_path: str, request: Request):
    db = SessionLocal()
    try:
        user = _user_from_request(request, db)

        # Chặn path traversal / path tuyệt đối / segment rỗng
        p = PurePosixPath(file_path or "")
        parts = p.parts
        if not parts or (file_path or "").startswith("/") or ".." in parts or any(not s for s in parts):
            raise HTTPException(status_code=404, detail="Không tìm thấy file")

        role = user.role.value if hasattr(user.role, "value") else str(user.role)
        is_admin = role in ("ADMIN", "SUPER_ADMIN")
        # Supabase private proxy: /sb/users/{uid}/... — cùng check ownership, JWT (?token= cho <img>).
        # Nhánh này đứng trước check file local vì object Supabase không nằm trên disk.
        if parts[0] == "sb":
            from ..services.storage_service import get_storage
            provider = get_storage()
            fetch = getattr(provider, "fetch_ref", None)
            if fetch is None:
                raise HTTPException(status_code=404, detail="Không tìm thấy file")
            key = "/".join(parts[1:])
            if not key.startswith(f"users/{user.id}/") and not is_admin:
                raise HTTPException(status_code=404, detail="Không tìm thấy file")
            got = fetch("/sb/" + key)
            if not got:
                raise HTTPException(status_code=404, detail="Không tìm thấy file")
            data, media = got
            return Response(content=data, media_type=media or "application/octet-stream",
                            headers=_cache_headers(key.endswith("/avatar.jpg")))

        full = os.path.realpath(os.path.join(UPLOAD_ROOT, *parts))
        try:
            same_root = os.path.commonpath([UPLOAD_ROOT, full]) == UPLOAD_ROOT
        except ValueError:
            same_root = False
        if not same_root or not os.path.isfile(full):
            raise HTTPException(status_code=404, detail="Không tìm thấy file")

        is_avatar = parts[0] == "avatars"
        if is_avatar:
            # avatars/{uid}.jpg — uid đoán được nên bắt buộc check owner
            if len(parts) != 2:
                raise HTTPException(status_code=404, detail="Không tìm thấy file")
            owner = os.path.splitext(parts[1])[0]
            if not owner or (owner != user.id and not is_admin):
                raise HTTPException(status_code=404, detail="Không tìm thấy file")
        else:
            # {uid}/... — segment đầu phải là id của chính requester
            if parts[0] != user.id and not is_admin:
                raise HTTPException(status_code=404, detail="Không tìm thấy file")

        media, _ = mimetypes.guess_type(full)
        return FileResponse(full, media_type=media or "application/octet-stream",
                            headers=_cache_headers(is_avatar))
    finally:
        db.close()
