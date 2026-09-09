"""Premium 30 ngày: thêm users.premium_expires_at (nullable).

Không destructive: chỉ ADD COLUMN nullable, không backfill (NULL = chưa từng có
hạn / FREE). Lazy downgrade xử lý lúc runtime. Chạy được SQLite + PostgreSQL.
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_premium_expires"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    try:
        cols = [c["name"] for c in sa.inspect(bind).get_columns("users")]
    except Exception:
        cols = []
    if "premium_expires_at" not in cols:
        op.add_column("users", sa.Column("premium_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Không drop cột để giữ dữ liệu an toàn.
    pass
