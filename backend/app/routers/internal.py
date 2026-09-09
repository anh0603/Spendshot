"""Cron nội bộ (§62, §63): cron-job.org gọi mỗi giờ kèm X-Cron-Secret.

KHÔNG để endpoint chạy scheduler cho internet gọi tự do.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..config import settings
from .. import scheduler

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/cron")
def run_cron(payload: dict | None = None,
             x_cron_secret: Optional[str] = Header(default=None, alias="X-Cron-Secret"),
             db: Session = Depends(get_db)):
    if not settings.CRON_SECRET or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Cron secret không hợp lệ")
    jobs = (payload or {}).get("jobs", ["push", "email", "cleanup"])
    return scheduler.run_all(db, jobs=tuple(jobs))
