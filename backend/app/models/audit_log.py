import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from ..database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    time = Column(DateTime(timezone=True), server_default=func.now())
    admin_email = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target = Column(String, default="")
    result = Column(String, default="SUCCESS")
    # Chi tiết JSON cho audit storage (admin/target/mode/objects/bytes...) — nullable để tương thích log cũ.
    details = Column(String, nullable=True)
