"""Email provider abstraction (§19, §39): EmailService -> ResendProvider | MockEmailProvider.

- ResendProvider: gọi Resend API qua httpx (không thêm dependency).
- MockEmailProvider: dev hoặc chưa có RESEND_API_KEY — chỉ log.
- Quota free-tier (§22): EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT, vượt → skip + log.
- Business logic KHÔNG gọi resend trực tiếp.
"""
import logging
from dataclasses import dataclass
from ..config import settings

log = logging.getLogger("spendshot.email")


@dataclass
class EmailResult:
    ok: bool
    error_code: str = ""
    mocked: bool = False
    skipped_quota: bool = False


class EmailProvider:
    name = "base"

    def send(self, to_email: str, subject: str, html: str) -> EmailResult:
        raise NotImplementedError


class ResendProvider(EmailProvider):
    name = "resend"

    def send(self, to_email: str, subject: str, html: str) -> EmailResult:
        import httpx
        try:
            r = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={"from": settings.EMAIL_FROM, "to": [to_email],
                      "subject": subject, "html": html},
                timeout=15,
            )
            if r.status_code in (200, 201, 202):
                return EmailResult(ok=True)
            log.warning("EMAIL_FAILED provider=resend error_code=HTTP_%s", r.status_code)
            return EmailResult(ok=False, error_code=f"HTTP_{r.status_code}")
        except Exception as e:
            log.warning("EMAIL_FAILED provider=resend error_code=%s", type(e).__name__)
            return EmailResult(ok=False, error_code=type(e).__name__)


class MockEmailProvider(EmailProvider):
    name = "mock"

    def send(self, to_email: str, subject: str, html: str) -> EmailResult:
        log.info("EMAIL_SENT provider=mock (không gửi thật)")
        return EmailResult(ok=True, mocked=True)


def get_email_provider() -> EmailProvider:
    if settings.RESEND_API_KEY:
        return ResendProvider()
    return MockEmailProvider()
