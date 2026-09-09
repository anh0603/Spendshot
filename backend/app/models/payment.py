import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base

class PaymentSettings(Base):
    __tablename__ = "payment_settings"
    id = Column(Integer, primary_key=True, default=1)
    bank_id = Column(String, default="")      # VD: MB, VCB, TCB
    account_no = Column(String, default="")   # số tài khoản
    account_name = Column(String, default="") # chủ tài khoản
    amount = Column(Integer, default=19000)   # 19.000đ/tháng
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class UpgradeRequest(Base):
    __tablename__ = "upgrade_requests"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    pay_code = Column(String, nullable=False, index=True)
    amount = Column(Integer, default=19000)
    status = Column(String, default="PENDING")  # PENDING / APPROVED / REJECTED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ContactSettings(Base):
    __tablename__ = "contact_settings"
    id = Column(Integer, primary_key=True, default=1)
    hotline = Column(String, default="")
    email = Column(String, default="")
    facebook = Column(String, default="")
    address = Column(String, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
