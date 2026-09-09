"""Storage abstraction: StorageService -> Local | Supabase.

- LocalStorageProvider: dev — giữ nguyên pipeline Pillow + URL /uploads hiện tại
  (backward-compat: bill cũ vẫn xem được).
- SupabaseStorageProvider: production — Supabase Storage bucket PRIVATE.
  Mọi gọi API dùng service_role key, CHỈ ở backend (httpx sẵn có, không thêm dep).
  Frontend không bao giờ gọi Supabase trực tiếp; đọc ảnh qua backend proxy
  GET /sb/* (JWT + ownership). Key users/{uid}/expenses/{eid}/bill.ext —
  DB chỉ lưu ref/metadata, không đổi schema, không lưu binary.
- Business logic KHÔNG gọi storage trực tiếp.
"""
import io
import logging
import os
import uuid
from ..config import settings

log = logging.getLogger("spendshot.storage")

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB (§photo storage hiện tại)
AVATAR_MAX = 2 * 1024 * 1024


def _ext_for(content_type: str) -> str:
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    return ".jpg"


def _resize_jpeg(data: bytes, box: tuple, quality: int) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(data))
    img.thumbnail(box)
    buf = io.BytesIO()
    # Lưu buffer phải chỉ rõ format (lưu file thì PIL tự đoán qua đuôi file)
    img.save(buf, format=img.format if img.format in ("PNG", "WEBP", "JPEG") else "JPEG",
             quality=quality, optimize=True)
    return buf.getvalue()


def is_remote_ref(ref: str) -> bool:
    """True nếu ref là URL ngoài (picsum/blob/data...) — không thuộc storage quản lý."""
    if not ref:
        return True
    r = ref.strip()
    return r.startswith("http://") or r.startswith("https://") or r.startswith("blob:") or r.startswith("data:")


class StorageService:
    name = "base"

    def save_expense_photo(self, user_id: str, data: bytes, content_type: str):
        """Trả (photo_ref, thumb_ref, expense_id). Raise ValueError nếu file lỗi."""
        raise NotImplementedError

    def save_avatar(self, user_id: str, data: bytes) -> str:
        raise NotImplementedError

    # --- Admin Storage Management (chỉ object thuộc storage quản lý) ---
    def is_stored_ref(self, ref: str) -> bool:
        """Ref có phải object do storage này quản lý (xóa/đo được) không."""
        raise NotImplementedError

    def object_size(self, ref: str):
        """Dung lượng bytes của 1 ref, None nếu không tồn tại/không đo được."""
        raise NotImplementedError

    def delete_ref(self, ref: str) -> int:
        """Xóa 1 ref, trả bytes đã giải phóng (0 nếu file không tồn tại)."""
        raise NotImplementedError

    def list_user_objects(self, user_id: str) -> list:
        """Liệt kê [(ref, size)] object của 1 user (kể cả orphan)."""
        raise NotImplementedError

    def list_all_objects(self) -> list:
        """Liệt kê [(canon_key, size)] toàn bộ object (phục vụ orphan scan)."""
        raise NotImplementedError

    def canon(self, ref: str) -> str:
        """Chuẩn hóa ref về key so sánh được (phục vụ orphan scan)."""
        return (ref or "").strip()


class LocalStorageProvider(StorageService):
    """Giữ nguyên 100% behavior hiện tại: resize 1024 + thumb 480, URL /uploads/*."""
    name = "local"

    def __init__(self, root: str | None = None):
        self.root = root or os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
        os.makedirs(self.root, exist_ok=True)

    def save_expense_photo(self, user_id: str, data: bytes, content_type: str):
        if content_type not in ALLOWED_MIME:
            raise ValueError("Định dạng ảnh không hợp lệ")
        if len(data) > MAX_SIZE:
            raise ValueError("Ảnh vượt quá 5MB")
        eid = str(uuid.uuid4())
        ext = _ext_for(content_type)
        user_dir = os.path.join(self.root, user_id)
        os.makedirs(user_dir, exist_ok=True)
        photo_path = os.path.join(user_dir, f"{eid}{ext}")
        thumb_path = os.path.join(user_dir, f"{eid}_thumb{ext}")
        try:
            with open(photo_path, "wb") as f:
                f.write(_resize_jpeg(data, (1024, 1024), 85))
            with open(thumb_path, "wb") as f:
                f.write(_resize_jpeg(data, (480, 480), 82))
        except Exception:
            with open(photo_path, "wb") as f:
                f.write(data)
            with open(thumb_path, "wb") as f:
                f.write(data)
        return f"/uploads/{user_id}/{eid}{ext}", f"/uploads/{user_id}/{eid}_thumb{ext}", eid

    def save_avatar(self, user_id: str, data: bytes) -> str:
        if len(data) > AVATAR_MAX:
            raise ValueError("Ảnh đại diện vượt quá 2MB")
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(data)).convert("RGB")
            img.thumbnail((256, 256))
            adir = os.path.join(self.root, "avatars")
            os.makedirs(adir, exist_ok=True)
            img.save(os.path.join(adir, f"{user_id}.jpg"), quality=85, optimize=True)
        except Exception:
            raise ValueError("Không đọc được ảnh")
        return f"/uploads/avatars/{user_id}.jpg"

    # --- Admin Storage Management (local) ---
    def _local_path(self, ref: str):
        """Map ref /uploads/... -> path thật, None nếu path lạ/traversal."""
        from pathlib import PurePosixPath
        if not ref or not ref.startswith("/uploads/"):
            return None
        p = PurePosixPath(ref)
        parts = [s for s in p.parts if s not in ("/",)]
        if not parts or parts[0] != "uploads" or ".." in parts or any(not s for s in parts):
            return None
        root = os.path.realpath(self.root)
        full = os.path.realpath(os.path.join(root, *parts[1:]))
        try:
            if os.path.commonpath([root, full]) != root:
                return None
        except ValueError:
            return None
        return full

    def is_stored_ref(self, ref: str) -> bool:
        return self._local_path(ref) is not None

    def object_size(self, ref: str):
        full = self._local_path(ref)
        if not full or not os.path.isfile(full):
            return None
        try:
            return os.path.getsize(full)
        except OSError:
            return None

    def delete_ref(self, ref: str) -> int:
        full = self._local_path(ref)
        if not full or not os.path.isfile(full):
            return 0
        try:
            size = os.path.getsize(full)
        except OSError:
            size = 0
        try:
            os.remove(full)
        except OSError:
            return 0
        log.info("STORAGE_DEL ref=%s bytes=%s", ref, size)
        return size

    def list_user_objects(self, user_id: str) -> list:
        out = []
        root = os.path.realpath(self.root)
        udir = os.path.join(root, user_id)
        if os.path.isdir(udir):
            for f in sorted(os.listdir(udir)):
                full = os.path.join(udir, f)
                if os.path.isfile(full):
                    try:
                        out.append((f"/uploads/{user_id}/{f}", os.path.getsize(full)))
                    except OSError:
                        pass
        av = os.path.join(root, "avatars", f"{user_id}.jpg")
        if os.path.isfile(av):
            try:
                out.append((f"/uploads/avatars/{user_id}.jpg", os.path.getsize(av)))
            except OSError:
                pass
        return out

    def list_all_objects(self) -> list:
        out = []
        root = os.path.realpath(self.root)
        if not os.path.isdir(root):
            return out
        for dirpath, _, files in os.walk(root):
            for f in files:
                full = os.path.join(dirpath, f)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                try:
                    out.append((f"/uploads/{rel}", os.path.getsize(full)))
                except OSError:
                    pass
        return out


class SupabaseStorageProvider(StorageService):
    """Production: Supabase Storage bucket PRIVATE (mặc định "spendshot").

    - Key users/{uid}/expenses/{eid}/bill.ext — cùng layout cũ, DB không đổi.
    - Ref trả về /sb/{key}; frontend <img> qua backend proxy GET /sb/* (JWT + ownership).
    - service_role key CHỈ dùng ở backend qua REST (httpx sẵn có).
    """
    name = "supabase"

    def __init__(self):
        self.base = (settings.SUPABASE_URL or "").rstrip("/")
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        self.bucket = settings.SUPABASE_BUCKET or "spendshot"
        if not (self.base and self.key and self.bucket):
            raise RuntimeError("Thiếu cấu hình Supabase (SUPABASE_URL/SERVICE_ROLE/BUCKET)")

    def _h(self, content_type: str = "") -> dict:
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}
        if content_type:
            h["Content-Type"] = content_type
        return h

    def _obj_url(self, key: str) -> str:
        return f"{self.base}/storage/v1/object/{self.bucket}/{key}"

    def _put(self, key: str, data: bytes, content_type: str, upsert: bool = False):
        import httpx
        h = self._h(content_type)
        if upsert:
            h["x-upsert"] = "true"
        r = httpx.put(self._obj_url(key), content=data, headers=h, timeout=30)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"Supabase upload lỗi HTTP_{r.status_code}")
        log.info("STORAGE_PUT key=%s bytes=%s", key, len(data))

    def _ref(self, key: str) -> str:
        return f"/sb/{key}"

    def save_expense_photo(self, user_id: str, data: bytes, content_type: str):
        if content_type not in ALLOWED_MIME:
            raise ValueError("Định dạng ảnh không hợp lệ")
        if len(data) > MAX_SIZE:
            raise ValueError("Ảnh vượt quá 5MB")
        eid = str(uuid.uuid4())
        ext = _ext_for(content_type)
        try:
            photo = _resize_jpeg(data, (1024, 1024), 85)
            thumb = _resize_jpeg(data, (480, 480), 82)
        except Exception:
            photo, thumb = data, data
        mime = "image/jpeg" if ext == ".jpg" else content_type
        k1 = f"users/{user_id}/expenses/{eid}/bill{ext}"
        k2 = f"users/{user_id}/expenses/{eid}/thumb{ext}"
        self._put(k1, photo, mime)
        self._put(k2, thumb, mime)
        return self._ref(k1), self._ref(k2), eid

    def save_avatar(self, user_id: str, data: bytes) -> str:
        if len(data) > AVATAR_MAX:
            raise ValueError("Ảnh đại diện vượt quá 2MB")
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(data)).convert("RGB")
            img.thumbnail((256, 256))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            raw = buf.getvalue()
        except Exception:
            raise ValueError("Không đọc được ảnh")
        key = f"users/{user_id}/avatar.jpg"
        self._put(key, raw, "image/jpeg", upsert=True)
        return self._ref(key)

    def key_from_ref(self, ref: str):
        r = (ref or "").strip()
        if not r:
            return None
        if r.startswith("/sb/"):
            r = r[len("/sb/"):]
        elif r.startswith("/"):
            return None
        if r.startswith("http://") or r.startswith("https://"):
            return None  # bucket private: URL ngoài không thuộc storage
        if ".." in r.split("/"):
            return None
        return r.lstrip("/")

    def is_stored_ref(self, ref: str) -> bool:
        if not ref or is_remote_ref(ref):
            return False
        return self.key_from_ref(ref) is not None

    def canon(self, ref: str) -> str:
        return self.key_from_ref(ref) or ""

    def _list_prefix(self, prefix: str) -> list:
        """List objects theo prefix, trả [(key, size)]. API list chỉ trả 1 cấp nên
        đệ quy vào từng folder (entry không có id). Name có thể tương đối theo
        prefix đang query nên luôn ghép về key đầy đủ."""
        import httpx
        out = []
        stack = [prefix]
        while stack:
            pre = stack.pop()
            offset = 0
            while True:
                r = httpx.post(
                    f"{self.base}/storage/v1/object/list/{self.bucket}",
                    json={"prefix": pre, "limit": 100, "offset": offset},
                    headers=self._h("application/json"), timeout=30)
                if r.status_code != 200:
                    raise RuntimeError(f"Supabase list lỗi HTTP_{r.status_code}")
                items = r.json() or []
                if not items:
                    break
                for e in items:
                    if not isinstance(e, dict):
                        continue
                    name = e.get("name") or ""
                    full = name if name.startswith(pre) else pre + name
                    if not e.get("id"):
                        if full and full not in (pre, ""):
                            stack.append(full.rstrip("/") + "/")
                        continue  # folder placeholder, không phải file
                    try:
                        size = int((e.get("metadata") or {}).get("size") or 0)
                    except (TypeError, ValueError):
                        size = 0
                    out.append((full, size))
                if len(items) < 100:
                    break
                offset += 100
        return out

    def object_size(self, ref: str):
        key = self.key_from_ref(ref)
        if not key:
            return None
        parent = key.rsplit("/", 1)[0] + "/" if "/" in key else ""
        try:
            for k, size in self._list_prefix(parent):
                if k == key:
                    return size
        except Exception as e:
            log.warning("STORAGE_SIZE key=%s err=%s", key, type(e).__name__)
        return None

    def fetch_ref(self, ref: str):
        """Tải object cho backend proxy. Trả (bytes, content_type) hoặc None."""
        key = self.key_from_ref(ref)
        if not key:
            return None
        try:
            import httpx
            r = httpx.get(self._obj_url(key), headers=self._h(), timeout=30)
            if r.status_code != 200:
                return None
            ctype = r.headers.get("Content-Type") or ""
            if ";" in ctype:
                ctype = ctype.split(";")[0].strip()
            if not ctype or ctype == "application/octet-stream":
                import mimetypes as _mt
                ctype = _mt.guess_type(key)[0] or "application/octet-stream"
            return r.content, ctype
        except Exception as e:
            log.warning("STORAGE_FETCH key=%s err=%s", key, type(e).__name__)
            return None

    def delete_ref(self, ref: str) -> int:
        key = self.key_from_ref(ref)
        if not key:
            return 0
        size = self.object_size(ref) or 0
        try:
            import httpx
            # httpx.delete() không nhận body -> dùng request("DELETE", ..., json=...)
            r = httpx.request(
                "DELETE", f"{self.base}/storage/v1/object/{self.bucket}",
                json={"prefixes": [key]}, headers=self._h("application/json"), timeout=30)
            if r.status_code in (200, 201, 204):
                log.info("STORAGE_DEL key=%s bytes=%s", key, size)
                return size
        except Exception as e:
            log.warning("STORAGE_DEL key=%s err=%s", key, type(e).__name__)
        return 0

    def list_user_objects(self, user_id: str) -> list:
        return [(f"/sb/{k}", s) for k, s in self._list_prefix(f"users/{user_id}/")]

    def list_all_objects(self) -> list:
        return self._list_prefix("")


def get_storage() -> StorageService:
    if (settings.STORAGE_PROVIDER or "local").lower() == "supabase":
        return SupabaseStorageProvider()
    return LocalStorageProvider()
