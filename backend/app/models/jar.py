import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base

class Jar(Base):
    __tablename__ = "jars"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, default="Hũ tháng")
    budget = Column(Integer, default=0)
    spent = Column(Integer, default=0)
    month = Column(String, nullable=False)  # YYYY-MM
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
