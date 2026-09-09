from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/ads", tags=["ads"])

@router.get("/config")
def ads_config(user: User=Depends(get_current_user)):
    role = user.role.value if hasattr(user.role,'value') else str(user.role)
    enabled = role == "FREE"
    return {"enabled": enabled, "banner": enabled, "nativeEvery": 8 if enabled else 0}
