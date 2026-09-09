import re
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings
from .database import get_db
from .models.user import User

security = HTTPBearer()

# §15 — throttle touch last_activity: tối đa 1 write / 15 phút / user.
_TOUCH_INTERVAL = 15 * 60
_last_touch: dict = {}


def touch_activity(db: Session, user: User):
    """Update last_activity + reset chuỗi email khi user quay lại app (§17).
    Không bao giờ làm hỏng request chính (§59)."""
    try:
        from datetime import timezone as _tz
        now = datetime.now(_tz.utc).replace(tzinfo=None)
        if now.timestamp() - _last_touch.get(user.id, 0) < _TOUCH_INTERVAL:
            return
        _last_touch[user.id] = now.timestamp()
        user.last_activity = now
        if getattr(user, "email_reminder_count", 0) or \
                getattr(user, "email_reminder_started_at", None) or \
                getattr(user, "email_reminder_last_sent_at", None):
            user.email_reminder_count = 0
            user.email_reminder_started_at = None
            user.email_reminder_last_sent_at = None
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass

GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$")
ADMIN_EMAIL = "admin@spendshot.local"

def normalize_email(email: str) -> str:
    return email.strip().lower()

def is_valid_email(email: str) -> bool:
    n = normalize_email(email)
    if n == ADMIN_EMAIL:
        return True
    return bool(GMAIL_REGEX.match(n))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

PREMIUM_DAYS = 30


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _as_naive(dt):
    if dt is None:
        return None
    try:
        return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt
    except Exception:
        return None


def _role_of(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def grant_premium(user: User):
    """Cấp/gia hạn Premium 30 ngày, không làm mất ngày còn lại:
    FREE -> now+30d; PREMIUM còn hạn -> hạn cũ+30d; PREMIUM hết hạn -> now+30d.
    Chỉ gán field, caller tự commit. Trả expires_at mới."""
    now = _utcnow_naive()
    exp = _as_naive(getattr(user, "premium_expires_at", None))
    base = exp if (_role_of(user) == "PREMIUM" and exp is not None and exp > now) else now
    from .models.user import UserRole
    user.role = UserRole.PREMIUM
    user.premium_expires_at = base + timedelta(days=PREMIUM_DAYS)
    return user.premium_expires_at


def check_premium_expired(user: User, db: Session) -> bool:
    """Lazy expiration: PREMIUM quá hạn -> FREE + xóa hạn + commit ngay.
    Trả True nếu vừa downgrade. Không cần cron."""
    if _role_of(user) != "PREMIUM":
        return False
    exp = _as_naive(getattr(user, "premium_expires_at", None))
    if exp is None or exp > _utcnow_naive():
        return False
    from .models.user import UserRole
    user.role = UserRole.FREE
    user.premium_expires_at = None
    try:
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    return True


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")
    except jwt.JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Người dùng không tồn tại")
    if user.status == "SUSPENDED":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản bị khóa")
    check_premium_expired(user, db)
    touch_activity(db, user)
    return user

def require_roles(*roles: str):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền truy cập")
        return current_user
    return checker
