import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from ..database import Base

class Expense(Base):
    __tablename__ = "expenses"
    # CRITICAL-3: idempotency key chỉ unique trong phạm vi 1 user.
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_expenses_user_idempotency"),
    )
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    jar_id = Column(String, ForeignKey("jars.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    photo = Column(String, default="")
    thumbnail = Column(String, default="")
    category = Column(String, nullable=True)
    idempotency_key = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
