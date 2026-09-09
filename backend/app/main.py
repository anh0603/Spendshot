from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .database import Base, engine
# CRITICAL-1: import TOÀN BỘ models trước create_all để fresh DB có đủ bảng.
# (Dùng package app.models — đã gom đủ User/Jar/Expense/JarTransaction/AuditLog/
# PaymentSettings/UpgradeRequest/ContactSettings/PushSubscription/NotificationHistory/
# EmailReminderLog/SchedulerLock; không circular vì models chỉ import Base từ database.)
from .models import (  # noqa: F401
    User, Jar, Expense, JarTransaction, AuditLog,
    PaymentSettings, UpgradeRequest, ContactSettings,
    PushSubscription, NotificationHistory, EmailReminderLog, SchedulerLock,
)
from .config import settings as _settings


def _validate_production_storage() -> None:
    """Production fail-loud: STORAGE_PROVIDER=supabase mà thiếu SUPABASE_* thì crash
    lúc startup, KHÔNG fallback lặng lẽ sang local filesystem (tránh mất ảnh)."""
    if (_settings.APP_ENV or "development").lower() != "production":
        return
    provider = (_settings.STORAGE_PROVIDER or "local").lower()
    if provider not in ("local", "supabase"):
        raise RuntimeError(f"STORAGE_PROVIDER không hỗ trợ: {provider}")
    if provider == "supabase":
        missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET")
                   if not getattr(_settings, k, "")]
        if missing:
            raise RuntimeError(
                f"Production STORAGE_PROVIDER=supabase thiếu: {', '.join(missing)} (không fallback local).")


_validate_production_storage()

_IS_SQLITE = engine.dialect.name == "sqlite"


def _run_migrations():
    """Database → Alembic migration → app startup.
    Alembic baseline tạo schema từ DB trống (SQLite + PG). Dev fallback create_all
    để local không vỡ khi thiếu alembic."""
    try:
        from alembic.config import Config as _AlembicConfig
        from alembic import command as _alembic_cmd
        cfg = _AlembicConfig()
        cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
        _alembic_cmd.upgrade(cfg, "head")
    except Exception as e:
        import logging as _logging
        _logging.getLogger("spendshot.migrate").warning(
            "ALEMBIC_FAILED err=%s — fallback create_all", type(e).__name__)
        Base.metadata.create_all(bind=engine)


_run_migrations()

# Backfill cột cho DB SQLite cũ (giữ tương thích dev; schema mới dùng Alembic revision).
# Chỉ chạy trên SQLite — PostgreSQL dùng Alembic.
if _IS_SQLITE:
    from sqlalchemy import text as _text
    try:
        with engine.connect() as _conn:
            _cols = [r[1] for r in _conn.execute(_text("PRAGMA table_info(users)")).fetchall()]
            if "name" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN name VARCHAR DEFAULT ''"))
            if "avatar" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN avatar VARCHAR DEFAULT ''"))
            if "pay_code" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN pay_code VARCHAR"))
            # §44 — notification settings + email sequence
            if "push_enabled" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN push_enabled BOOLEAN DEFAULT 1"))
            if "email_enabled" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN email_enabled BOOLEAN DEFAULT 1"))
            if "email_reminder_count" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN email_reminder_count INTEGER DEFAULT 0"))
            if "email_reminder_started_at" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN email_reminder_started_at DATETIME"))
            if "email_reminder_last_sent_at" not in _cols:
                _conn.execute(_text("ALTER TABLE users ADD COLUMN email_reminder_last_sent_at DATETIME"))
            _conn.commit()
    except Exception:
        pass

    # Admin Storage audit details (§ADMIN-STORAGE)
    try:
        with engine.connect() as _conn2:
            _acols = [r[1] for r in _conn2.execute(_text("PRAGMA table_info(audit_logs)")).fetchall()]
            if _acols and "details" not in _acols:
                _conn2.execute(_text("ALTER TABLE audit_logs ADD COLUMN details TEXT DEFAULT ''"))
                _conn2.commit()
    except Exception:
        pass

# CRITICAL-3: migrate DB SQLite cũ UNIQUE(idempotency_key) global
# -> UNIQUE(user_id, idempotency_key). Fresh DB đã đúng nhờ model mới/Alembic;
# khối này chỉ chạy cho DB SQLite đã tồn tại từ trước (giữ nguyên dữ liệu).
try:
    if not _IS_SQLITE:
        raise RuntimeError("skip-non-sqlite")
    # Detect bằng inspector (UNIQUE cũ là index riêng ix_expenses_idempotency_key,
    # không nằm inline trong DDL CREATE TABLE nên không thể match string DDL).
    from sqlalchemy import inspect as _inspect2
    _insp = _inspect2(engine)
    _idxs = []
    _unis = []
    try:
        _idxs = _insp.get_indexes("expenses")
    except Exception:
        _idxs = []
    try:
        _unis = _insp.get_unique_constraints("expenses")
    except Exception:
        _unis = []
    _has_old_global = any(
        list(_i.get("column_names") or []) == ["idempotency_key"] and _i.get("unique")
        for _i in _idxs
    )
    _has_composite = any(
        set(_u.get("column_names") or []) == {"user_id", "idempotency_key"}
        for _u in _unis
    )
    if _has_old_global and not _has_composite:
        # DB cũ: rebuild bảng expenses giữ nguyên dữ liệu (không bảng nào FK tới expenses).
        from .database import SessionLocal as _SL2
        from .models.expense import Expense as _Exp2
        _mdb = _SL2()
        try:
            _rows = [{"id": e.id, "user_id": e.user_id, "jar_id": e.jar_id, "amount": e.amount,
                      "photo": e.photo, "thumbnail": e.thumbnail, "category": e.category,
                      "idempotency_key": e.idempotency_key,
                      "created_at": e.created_at, "updated_at": e.updated_at}
                     for e in _mdb.query(_Exp2).all()]
        finally:
            _mdb.close()
        _Exp2.__table__.drop(engine)
        _Exp2.__table__.create(engine)
        if _rows:
            with engine.begin() as _wc:
                _wc.execute(_Exp2.__table__.insert(), _rows)
except Exception:
    pass

# Migrate 1 lần: push_subs.json (file) -> push_subscriptions (DB), rồi dùng DB hẳn.
try:
    from .database import SessionLocal
    import json as _json
    _sub_file = os.path.join(os.path.dirname(__file__), "..", "push_subs.json")
    _db = SessionLocal()
    try:
        if os.path.exists(_sub_file) and _db.query(PushSubscription).count() == 0:
            _old = _json.load(open(_sub_file, encoding="utf-8"))
            for _e in (_old if isinstance(_old, list) else []):
                _p = (_e.get("subscription") or {})
                _ep = _p.get("endpoint") or ""
                if not _ep or not _e.get("user_id"):
                    continue
                _keys = _p.get("keys") or {}
                _db.add(PushSubscription(user_id=_e["user_id"], endpoint=_ep,
                                         p256dh=_keys.get("p256dh", "") or "",
                                         auth=_keys.get("auth", "") or "",
                                         is_active=True))
            _db.commit()
    finally:
        _db.close()
except Exception:
    pass

app = FastAPI(title="SpendShot API", version="1.0.0")

# CRITICAL-5: không dùng wildcard "*" khi bật credentials.
# Whitelist từ FRONTEND_URL (+ CORS_EXTRA_ORIGINS, phân tách dấu phẩy).
# Dev mặc định đã gồm localhost/127.0.0.1:5173; production chỉ dùng origin khai báo.
def _cors_origins() -> list:
    seen: list = []

    def _add(raw: str | None):
        for part in (raw or "").split(","):
            o = part.strip().rstrip("/")
            if o and o not in seen:
                seen.append(o)
    _add(_settings.FRONTEND_URL)
    _add(_settings.CORS_EXTRA_ORIGINS)
    if (_settings.APP_ENV or "development").lower() != "production":
        for _dev in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if _dev not in seen:
                seen.append(_dev)
    return seen

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "SpendShot"}

@app.get("/")
def root():
    return {"message": "SpendShot API đang chạy"}

from .routers import auth, jars, expenses, subscription, ads, sync, admin, push, payment, notifications, internal, files, storage_admin
app.include_router(auth.router)
app.include_router(jars.router)
app.include_router(expenses.router)
app.include_router(subscription.router)
app.include_router(ads.router)
app.include_router(sync.router)
app.include_router(admin.router)
app.include_router(push.router)
app.include_router(payment.router)
app.include_router(notifications.router)
app.include_router(internal.router)
app.include_router(storage_admin.router)
# CRITICAL-2: KHÔNG mount StaticFiles public nữa. File user được serve qua
# GET /uploads/{path} có JWT + verify ownership (routers/files.py).
# Giữ tạo thư mục để StorageProvider ghi file.
upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.include_router(files.router)
