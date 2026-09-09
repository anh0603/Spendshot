from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User, UserRole

router = APIRouter(prefix="/subscription", tags=["subscription"])

@router.get("/me")
def get_sub(user: User=Depends(get_current_user)):
    role = user.role.value if hasattr(user.role,'value') else str(user.role)
    return {"plan": role, "ads": role=="FREE", "gallery": role!="FREE"}

@router.post("/upgrade")
def upgrade(user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    # Mock upgrade — set to PREMIUM (no real payment per spec §33 abstraction)
    if user.role != UserRole.FREE:
        raise HTTPException(status_code=400, detail="Bạn đã là Premium")
    user.role = UserRole.PREMIUM
    db.commit()
    return {"message":"Nâng cấp Premium thành công","plan":"PREMIUM"}

@router.post("/downgrade")
def downgrade(user: User=Depends(get_current_user), db: Session=Depends(get_db)):
    user.role = UserRole.FREE
    db.commit()
    return {"message":"Đã hạ cấp về FREE","plan":"FREE"}
