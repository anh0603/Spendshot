"""Baseline schema SpendShot (12 tables) — SQLite + PostgreSQL.

Dùng checkfirst=True để upgrade an toàn trên DB đã tồn tại (tạo thiếu + stamp version).
Không destructive: không drop/alter gì.
"""
import sqlalchemy as sa
from alembic import op

revision = "0001_baseline"
down_revision = None

def _idx(name: str, table: str, column: str) -> None:
    """CREATE INDEX idempotent (SQLite + PostgreSQL đều hỗ trợ IF NOT EXISTS)."""
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})"))


branch_labels = None
depends_on = None

USER_ROLE = sa.Enum("FREE", "PREMIUM", "ADMIN", "SUPER_ADMIN", name="userrole")
USER_STATUS = sa.Enum("ACTIVE", "SUSPENDED", name="userstatus")




def _create_table(name, *cols, **kw):
    """Idempotent create (DB đã tồn tại thì bỏ qua) — SQLite + PostgreSQL."""
    import sqlalchemy as _sa
    bind = op.get_bind()
    try:
        if _sa.inspect(bind).has_table(name):
            return
    except Exception:
        pass
    op.create_table(name, *cols, **kw)


def upgrade() -> None:
    _create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), server_default="", nullable=True),
        sa.Column("avatar", sa.String(), server_default="", nullable=True),
        sa.Column("pay_code", sa.String(), nullable=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", USER_ROLE, server_default="FREE", nullable=False),
        sa.Column("status", USER_STATUS, server_default="ACTIVE", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("last_activity", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("push_enabled", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("email_enabled", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("email_reminder_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("email_reminder_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_reminder_last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("pay_code"),
    )
    _idx("ix_users_email", "users", "email")
    _idx("ix_users_pay_code", "users", "pay_code")

    _create_table(
        "jars",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), server_default="Hũ tháng", nullable=True),
        sa.Column("budget", sa.Integer(), server_default="0", nullable=True),
        sa.Column("spent", sa.Integer(), server_default="0", nullable=True),
        sa.Column("month", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    _idx("ix_jars_user_id", "jars", "user_id")

    _create_table(
        "expenses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("jar_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("photo", sa.String(), server_default="", nullable=True),
        sa.Column("thumbnail", sa.String(), server_default="", nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("idempotency_key", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["jar_id"], ["jars.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_expenses_user_idempotency"),
    )
    _idx("ix_expenses_idempotency_key", "expenses", "idempotency_key")
    _idx("ix_expenses_jar_id", "expenses", "jar_id")
    _idx("ix_expenses_user_id", "expenses", "user_id")

    _create_table(
        "jar_transactions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("jar_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), server_default="0", nullable=True),
        sa.Column("note", sa.String(), server_default="", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["jar_id"], ["jars.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    _idx("ix_jar_transactions_jar_id", "jar_transactions", "jar_id")
    _idx("ix_jar_transactions_user_id", "jar_transactions", "user_id")

    _create_table(
        "audit_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("time", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("admin_email", sa.String(), nullable=False),
        sa.Column("target", sa.String(), server_default="", nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("result", sa.String(), server_default="SUCCESS", nullable=True),
        sa.Column("details", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    _create_table(
        "payment_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bank_id", sa.String(), server_default="", nullable=True),
        sa.Column("account_no", sa.String(), server_default="", nullable=True),
        sa.Column("account_name", sa.String(), server_default="", nullable=True),
        sa.Column("amount", sa.Integer(), server_default="19000", nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    _create_table(
        "upgrade_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("pay_code", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), server_default="19000", nullable=True),
        sa.Column("status", sa.String(), server_default="PENDING", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    _idx("ix_upgrade_requests_pay_code", "upgrade_requests", "pay_code")
    _idx("ix_upgrade_requests_user_id", "upgrade_requests", "user_id")

    _create_table(
        "contact_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hotline", sa.String(), server_default="", nullable=True),
        sa.Column("email", sa.String(), server_default="", nullable=True),
        sa.Column("facebook", sa.String(), server_default="", nullable=True),
        sa.Column("address", sa.String(), server_default="", nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    _create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("endpoint", sa.String(), nullable=False),
        sa.Column("p256dh", sa.String(), server_default="", nullable=True),
        sa.Column("auth", sa.String(), server_default="", nullable=True),
        sa.Column("user_agent", sa.String(), server_default="", nullable=True),
        sa.Column("device_name", sa.String(), server_default="", nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_failure_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("endpoint"),
        sa.Index("ix_push_subs_user_active", "user_id", "is_active"),
    )
    _idx("ix_push_subscriptions_user_id", "push_subscriptions", "user_id")

    _create_table(
        "notification_history",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), server_default="", nullable=False),
        sa.Column("channel", sa.String(), server_default="", nullable=False),
        sa.Column("message_id", sa.String(), server_default="", nullable=True),
        sa.Column("dedup_key", sa.String(), server_default="", nullable=False),
        sa.Column("scheduled_at", sa.String(), server_default="", nullable=True),
        sa.Column("status", sa.String(), server_default="SENT", nullable=True),
        sa.Column("error_code", sa.String(), server_default="", nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "channel", "dedup_key", name="uq_notif_user_channel_dedup"),
        sa.Index("ix_notif_history_sent", "sent_at"),
    )
    _idx("ix_notification_history_user_id", "notification_history", "user_id")

    _create_table(
        "email_reminder_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("reminder_date", sa.String(), nullable=False),
        sa.Column("seq_no", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), server_default="SENT", nullable=True),
        sa.Column("error_code", sa.String(), server_default="", nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "reminder_date", name="uq_email_user_date"),
    )
    _idx("ix_email_reminder_logs_user_id", "email_reminder_logs", "user_id")

    _create_table(
        "scheduler_locks",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("owner", sa.String(), server_default="", nullable=True),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    # Baseline không hỗ trợ downgrade destructive — giữ dữ liệu an toàn.
    pass
