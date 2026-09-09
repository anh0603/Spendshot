import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base

class JarTransaction(Base):
    __tablename__ = "jar_transactions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    jar_id = Column(String, ForeignKey("jars.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # add, withdraw, edit, create
    amount = Column(Integer, default=0)
    note = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
