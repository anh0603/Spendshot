from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./spendshot.db"
    JWT_SECRET: str = "change-me-in-production-use-env"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@spendshot.local"
    # Test/dev: cho lưu chi tiêu không cần ảnh. Production: bắt buộc True.
    REQUIRE_PHOTO: bool = False
    # --- Notifications (§25, §29) ---
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    # CORS: danh sách origin bổ sung, phân tách bằng dấu phẩy (không hardcode domain prod).
    CORS_EXTRA_ORIGINS: str = ""
    PUSH_SCHEDULE: str = "08:00,10:00,12:00,15:00,18:00,20:00"
    DEFAULT_TIMEZONE: str = "Asia/Ho_Chi_Minh"
    # Email (Resend free-tier; trống = dùng Mock, chỉ log không gửi thật)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "SpendShot <nhac@spendshot.local>"
    EMAIL_DAILY_LIMIT: int = 100
    EMAIL_MONTHLY_LIMIT: int = 3000
    NOTIFICATION_HISTORY_RETENTION_DAYS: int = 90
    # Secret bảo vệ endpoint cron nội bộ (§62). Trống = từ chối mọi lệnh chạy.
    CRON_SECRET: str = ""
    # Storage: "local" (dev) | "supabase" (production, Supabase Storage bucket PRIVATE).
    # Frontend không bao giờ gọi Supabase trực tiếp — mọi đọc/ghi đi qua backend
    # (upload API + proxy GET /sb/* có JWT + ownership), nên chỉ cần service_role ở server.
    STORAGE_PROVIDER: str = "local"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "spendshot"
    # Storage quota (§ADMIN-STORAGE): giới hạn bytes do admin cấu hình (trống = không rõ).
    # Local không cấu hình thì dùng dung lượng disk. Không hard-code 10GB vào logic.
    STORAGE_LIMIT_BYTES: str = ""
    STORAGE_WARN_THRESHOLD: int = 80
    STORAGE_CRITICAL_THRESHOLD: int = 90

    def push_slots(self) -> list:
        return [s.strip() for s in (self.PUSH_SCHEDULE or "").split(",") if s.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
