from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings


def resolve_database_url(app_env: str | None = None, database_url: str | None = None) -> str:
    """Production bắt buộc DATABASE_URL PostgreSQL — thiếu hoặc sqlite thì fail rõ ràng,
    không fallback lặng lẽ (tránh mất dữ liệu ảo trên disk ephemeral).
    Chuẩn hóa scheme postgresql:// -> postgresql+psycopg:// để dùng đúng driver
    psycopg v3 đã khai báo (SQLAlchemy mặc định tìm psycopg2)."""
    env = (app_env if app_env is not None else settings.APP_ENV or "development").lower()
    url = database_url if database_url is not None else settings.DATABASE_URL
    if env == "production" and (not url or url.strip().startswith("sqlite")):
        raise RuntimeError("Production yêu cầu DATABASE_URL PostgreSQL (không fallback SQLite).")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    # Supabase pooler URL có thể kèm ?pgbouncer=true (quy ước Prisma) — libpq không
    # hiểu param này nên lược bỏ, giữ lại sslmode... Pool dùng transaction mode của
    # Supabase vẫn tương thích vì app chỉ dùng câu lệnh đơn giản + lock bằng row DB.
    if "pgbouncer=" in url:
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        u = urlparse(url)
        qs = [(k, v) for k, v in parse_qsl(u.query) if k.lower() != "pgbouncer"]
        url = urlunparse((u.scheme, u.netloc, u.path, u.params, urlencode(qs), u.fragment))
    return url


_resolved_url = resolve_database_url()
connect_args = {"check_same_thread": False} if _resolved_url.startswith("sqlite") else {}
# pool_pre_ping: free-tier (Neon scale-to-zero, Render sleep) hay đóng idle connection —
# kiểm tra trước mỗi checkout để request đầu sau idle không rớt.
engine = create_engine(
    _resolved_url,
    connect_args=connect_args,
    pool_pre_ping=not _resolved_url.startswith("sqlite"),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
