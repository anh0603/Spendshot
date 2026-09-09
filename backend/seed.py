"""Seed Super Admin từ environment (không hard-code password).

Yêu cầu:
    ADMIN_EMAIL=admin@spendshot.local
    ADMIN_PASSWORD=<mật khẩu mạnh>

Thiếu 1 trong 2 → fail rõ ràng, không tự tạo password mặc định.
Dev local: đặt 2 biến trong backend/.env (file này gitignored).
"""
import os
import sys

from app.database import Base
import app.models  # noqa: F401 -- CRITICAL-1: register đủ tables trước create_all
from app.models.user import User, UserRole, UserStatus
from app.auth import hash_password, normalize_email


def _seed_engine():
    """Engine riêng cho seed: ưu tiên DIRECT_URL (session-mode, tương thích
    prepared statements của psycopg). DATABASE_URL transaction pooler (:6543)
    giữ nguyên cho runtime — seed không đụng tới."""
    direct = os.environ.get("DIRECT_URL", "").strip()
    if direct:
        if direct.startswith("postgresql://"):
            direct = "postgresql+psycopg://" + direct[len("postgresql://"):]
        from sqlalchemy import create_engine
        return create_engine(direct, pool_pre_ping=True)
    from app.database import engine as _runtime_engine
    return _runtime_engine


_seed_engine_obj = _seed_engine()
from sqlalchemy.orm import sessionmaker as _sessionmaker
SessionLocal = _sessionmaker(autocommit=False, autoflush=False, bind=_seed_engine_obj)

Base.metadata.create_all(bind=_seed_engine_obj)


def seed_super_admin():
    email = normalize_email(os.environ.get("ADMIN_EMAIL", ""))
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        print("SEED FAILED: thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD trong environment.", file=sys.stderr)
        print("Dev: thêm 2 biến vào backend/.env. Prod: cấu hình Environment Variables.", file=sys.stderr)
        sys.exit(1)
    if len(password) < 6:
        print("SEED FAILED: ADMIN_PASSWORD phải ít nhất 6 ký tự.", file=sys.stderr)
        sys.exit(1)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"Super Admin already exists: {email} role={existing.role}")
            # Ensure role is SUPER_ADMIN
            if str(existing.role) != "SUPER_ADMIN" and existing.role != UserRole.SUPER_ADMIN:
                existing.role = UserRole.SUPER_ADMIN
                db.commit()
                print("Updated to SUPER_ADMIN")
            return
        user = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE
        )
        db.add(user)
        db.commit()
        print(f"Seeded Super Admin: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_super_admin()
