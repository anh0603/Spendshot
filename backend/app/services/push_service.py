"""Push provider abstraction (§39): NotificationService -> WebPushProvider | MockPushProvider.

- WebPushProvider: gửi thật qua pywebpush + VAPID. 404/410 → sub hết hạn (§11).
- MockPushProvider: dev/test hoặc khi chưa cấu hình VAPID — chỉ log, không gửi.
- Business logic KHÔNG gọi pywebpush trực tiếp.
"""
import json
import logging
from dataclasses import dataclass
from ..config import settings

log = logging.getLogger("spendshot.push")

PUSH_TITLE = "SpendShot"


@dataclass
class PushResult:
    ok: bool
    expired: bool = False  # sub 404/410 → đánh dấu is_active=false (§11)
    error_code: str = ""
    mocked: bool = False


class PushProvider:
    name = "base"

    def send(self, subscription: dict, payload: dict) -> PushResult:
        raise NotImplementedError


class WebPushProvider(PushProvider):
    name = "webpush"

    def send(self, subscription: dict, payload: dict) -> PushResult:
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            log.error("PUSH_FAILED provider=webpush error_code=PYWEBPUSH_MISSING")
            return PushResult(ok=False, error_code="PYWEBPUSH_MISSING")
        try:
            webpush(
                subscription_info=subscription,
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            return PushResult(ok=True)
        except Exception as e:  # WebPushException + network errors
            status = getattr(getattr(e, "response", None), "status_code", None)
            code = f"HTTP_{status}" if status else type(e).__name__
            expired = status in (404, 410)
            log.warning("PUSH_FAILED provider=webpush error_code=%s expired=%s", code, expired)
            return PushResult(ok=False, expired=expired, error_code=code)


class MockPushProvider(PushProvider):
    name = "mock"

    def send(self, subscription: dict, payload: dict) -> PushResult:
        log.info("PUSH_SENT provider=mock (không gửi thật)")
        return PushResult(ok=True, mocked=True)


def get_push_provider() -> PushProvider:
    """Chưa VAPID key (dev) → mock. Không bao giờ crash (§38, §59)."""
    if settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY:
        return WebPushProvider()
    return MockPushProvider()


def build_bill_payload(body: str) -> dict:
    """§12 — payload tối thiểu."""
    return {"title": PUSH_TITLE, "body": body, "url": "/"}
