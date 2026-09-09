from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user, grant_premium
from ..models.user import User, UserRole
from ..auth import _as_naive

router = APIRouter(prefix="/subscription", tags=["subscription"])

def _plan_out(user: User):
    role = user.role.value if hasattr(user.role,'value') else str(user.role)
    exp = _as_naive(getattr(user, "premium_expires_at", None))
    return {"plan": role, "ads": role=="FREE", "gallery": role!="FREE",
            "expires_at": str(exp) if role == "PREMIUM" and exp else None}

@router.get("/me")
def get_sub(user: User=Depends(get_current_user)):
    return _plan_out(user)

@router.post("/upgrade")
def upgrade(user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    # Mock upgrade (no real payment per spec §33 abstraction).
    # FREE -> +30d; PREMIUM còn hạn -> cộng thêm 30d (giữ ngày còn lại).
    role = user.role.value if hasattr(user.role,'value') else str(user.role)
    if role not in (UserRole.FREE.value, "FREE", UserRole.PREMIUM.value, "PREMIUM"):
        raise HTTPException(status_code=400, detail="Gói hiện tại không thể nâng cấp")
    exp = grant_premium(user)
    db.commit()
    out = _plan_out(user)
    out["message"] = "Nâng cấp Premium thành công"
    out["expires_at"] = str(exp)
    return out

@router.post("/downgrade")
def downgrade(user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    user.role = UserRole.FREE
    user.premium_expires_at = None
    db.commit()
    return {"message":"Đã hạ cấp về FREE","plan":"FREE"}
