"""Notification/Email scheduler models (§10, §44, §45, §63).

Tất cả thời gian lưu DB là naive UTC (SQLite CURRENT_TIMESTAMP cũng là UTC).
Chỉ convert sang timezone user khi tính lịch gửi.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from ..database import Base


class PushSubscription(Base):
    """§10 — 1 user có thể có nhiều device, endpoint UNIQUE toàn cục."""
    __tablename__ = "push_subscriptions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    endpoint = Column(String, unique=True, nullable=False)
    p256dh = Column(String, default="")
    auth = Column(String, default="")
    user_agent = Column(String, default="")
    device_name = Column(String, default="")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_push_subs_user_active", "user_id", "is_active"),
    )


class NotificationHistory(Base):
    """§7, §45 — history push + email. Unique(user_id, channel, dedup_key)
    chống gửi trùng khi cron chạy lại (§7, §18, §41)."""
    __tablename__ = "notification_history"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False, default="")  # BILL_REMINDER | INACTIVE_REMINDER
    channel = Column(String, nullable=False, default="")  # PUSH | EMAIL
    message_id = Column(String, default="")  # index câu push (0-29) hoặc email day (1-7)
    dedup_key = Column(String, nullable=False, default="")  # user+date+slot (§7) | user+date (§18)
    scheduled_at = Column(String, default="")  # slot "HH:MM" (push) hoặc "" (email)
    status = Column(String, default="SENT")  # SENT | FAILED | SKIPPED
    error_code = Column(String, default="")
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "channel", "dedup_key", name="uq_notif_user_channel_dedup"),
        Index("ix_notif_history_sent", "sent_at"),
    )


class EmailReminderLog(Base):
    """§16-§18 — 1 dòng = 1 email đã gửi. Unique(user_id, reminder_date)
    bảo đảm tối đa 1 email/ngày (§18)."""
    __tablename__ = "email_reminder_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    reminder_date = Column(String, nullable=False)  # YYYY-MM-DD (Asia/Ho_Chi_Minh)
    seq_no = Column(Integer, nullable=False)  # 1..7
    status = Column(String, default="SENT")
    error_code = Column(String, default="")
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "reminder_date", name="uq_email_user_date"),
    )


class SchedulerLock(Base):
    """§63 — tránh 2 instance chạy job đồng thời. Không dùng Redis."""
    __tablename__ = "scheduler_locks"
    name = Column(String, primary_key=True)  # vd "push", "email", "cleanup"
    locked_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = Column(String, default="")
