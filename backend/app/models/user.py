import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from ..database import Base
import enum

class UserRole(str, enum.Enum):
    FREE = "FREE"
    PREMIUM = "PREMIUM"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    avatar = Column(String, default="")
    pay_code = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.FREE, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # §8, §44 — notification settings (default ON). last_activity dùng làm last_active_at.
    push_enabled = Column(Boolean, default=True, server_default="1", nullable=False)
    email_enabled = Column(Boolean, default=True, server_default="1", nullable=False)
    # Premium có hạn 30 ngày: hết hạn -> lazy downgrade về FREE (không cần cron).
    premium_expires_at = Column(DateTime(timezone=True), nullable=True)
    # §16-§17 — trạng thái chuỗi email reminder (reset khi user quay lại app).
    email_reminder_count = Column(Integer, default=0, server_default="0", nullable=False)
    email_reminder_started_at = Column(DateTime(timezone=True), nullable=True)
    email_reminder_last_sent_at = Column(DateTime(timezone=True), nullable=True)
