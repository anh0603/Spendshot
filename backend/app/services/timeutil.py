"""Timezone helpers (§24): DB lưu naive UTC, chỉ convert khi tính lịch gửi."""
from datetime import datetime, timezone, timedelta
from ..config import settings

try:
    from zoneinfo import ZoneInfo
    _VN_TZ = ZoneInfo(settings.DEFAULT_TIMEZONE or "Asia/Ho_Chi_Minh")
except Exception:
    _VN_TZ = timezone(timedelta(hours=7))  # fallback Asia/Ho_Chi_Minh


def utcnow_naive() -> datetime:
    """now() UTC naive — khớp SQLite CURRENT_TIMESTAMP (func.now)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def vn_now(now_utc: datetime | None = None) -> datetime:
    base = now_utc or utcnow_naive()
    return base.replace(tzinfo=timezone.utc).astimezone(_VN_TZ)


def vn_date_str(now_utc: datetime | None = None) -> str:
    return vn_now(now_utc).strftime("%Y-%m-%d")


def vn_slot_str(now_utc: datetime | None = None) -> str:
    return vn_now(now_utc).strftime("%H:%M")
