from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models.user import User, UserRole
from ..schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut, PasswordResetRequest, ChangePasswordRequest
from ..auth import normalize_email, is_valid_email, hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

def to_user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, name=getattr(u, "name", "") or "", avatar=getattr(u, "avatar", "") or "",
        role=u.role.value if hasattr(u.role, 'value') else str(u.role),
        status=u.status.value if hasattr(u.status, 'value') else str(u.status),
        created_at=str(u.created_at) if u.created_at else None,
    )

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    # Backend enforce Gmail
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận @gmail.com")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    # CRITICAL-4: public register KHÔNG BAO GIỜ được tạo SUPER_ADMIN/ADMIN.
    # admin@spendshot.local chỉ được tạo bởi seed/bootstrap (backend/seed.py).
    # Role không bao giờ lấy từ request body (RegisterRequest không có field role).
    if email == "admin@spendshot.local":
        raise HTTPException(status_code=403, detail="Email này chỉ được tạo bởi quản trị viên. Vui lòng liên hệ admin.")
    role = UserRole.FREE
    user = User(email=email, password_hash=hash_password(payload.password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id, "role": user.role.value if hasattr(user.role, 'value') else str(user.role)})
    return {"access_token": token, "token_type": "bearer", "user": to_user_out(user)}

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")
    if str(user.status) == "SUSPENDED" or (hasattr(user.status,'value') and user.status.value=="SUSPENDED"):
        raise HTTPException(status_code=403, detail="Tài khoản bị khóa")
    # update last_activity
    from sqlalchemy.sql import func
    user.last_activity = func.now()
    db.commit()
    role_val = user.role.value if hasattr(user.role,'value') else str(user.role)
    token = create_access_token({"sub": user.id, "role": role_val})
    return {"access_token": token, "token_type": "bearer", "user": to_user_out(user)}

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return to_user_out(current_user)

@router.patch("/me", response_model=UserOut)
async def update_me(
    name: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if name is not None:
        name = name.strip()[:50]
        if not name:
            raise HTTPException(status_code=400, detail="Tên không được để trống")
        current_user.name = name
    if avatar is not None:
        if avatar.content_type not in ("image/jpeg", "image/png", "image/webp", "image/jpg"):
            raise HTTPException(status_code=400, detail="Ảnh đại diện không hợp lệ")
        data = await avatar.read()
        if len(data) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Ảnh đại diện vượt quá 2MB")
        from ..services.storage_service import get_storage
        try:
            current_user.avatar = get_storage().save_avatar(current_user.id, data)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(current_user)
    return to_user_out(current_user)

@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Đã đổi mật khẩu"}

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT — client discards token
    return {"message": "Đã đăng xuất"}

@router.post("/password-reset/request")
def password_reset_request(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận @gmail.com")
    # Do not reveal existence
    return {"message": "Nếu email tồn tại, hướng dẫn đã được gửi"}

@router.post("/password-reset/confirm")
def password_reset_confirm(payload: dict, db: Session = Depends(get_db)):
    # Placeholder — will verify token and update password
    return {"message": "Mật khẩu đã được đặt lại (mock)"}
