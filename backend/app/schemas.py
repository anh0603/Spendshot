from pydantic import BaseModel, field_validator
from typing import Optional
import re

ADMIN_EMAIL = "admin@spendshot.local"
GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$")

def normalize_email(v: str) -> str:
    return v.strip().lower()

def is_valid_email(v: str) -> bool:
    n = normalize_email(v)
    if n == ADMIN_EMAIL:
        return True
    return bool(GMAIL_REGEX.match(n))

class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        n = normalize_email(v)
        if not is_valid_email(n):
            raise ValueError("Chỉ chấp nhận @gmail.com")
        return n

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        if len(v) < 6:
            raise ValueError("Mật khẩu phải ít nhất 6 ký tự")
        return v

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def norm(cls, v):
        return normalize_email(v)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: str
    email: str
    name: str = ""
    avatar: str = ""
    role: str
    status: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v):
        if len(v) < 6:
            raise ValueError("Mật khẩu mới phải ít nhất 6 ký tự")
        return v

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
