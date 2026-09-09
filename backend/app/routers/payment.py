import random
import string
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User, UserRole
from ..models.payment import PaymentSettings, UpgradeRequest, ContactSettings

router = APIRouter(tags=["payment"])

def gen_code(db: Session) -> str:
    for _ in range(10):
        code = "SS-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not db.query(User).filter(User.pay_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Không tạo được mã, thử lại")

def get_settings(db: Session) -> PaymentSettings:
    s = db.query(PaymentSettings).filter(PaymentSettings.id == 1).first()
    if not s:
        s = PaymentSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

def qr_url(bank_id: str, account_no: str, account_name: str, amount: int, code: str) -> str:
    base = f"https://img.vietqr.io/image/{bank_id}-{account_no}-compact.png"
    return f"{base}?amount={amount}&addInfo={quote(code)}&accountName={quote(account_name)}"

@router.get("/subscription/payment-info")
def payment_info(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not user.pay_code:
        user.pay_code = gen_code(db)
        db.commit()
        db.refresh(user)
    s = get_settings(db)
    configured = bool(s.bank_id and s.account_no)
    return {
        "code": user.pay_code,
        "amount": s.amount,
        "bank_id": s.bank_id,
        "account_no": s.account_no,
        "account_name": s.account_name,
        "configured": configured,
        "qr_url": qr_url(s.bank_id, s.account_no, s.account_name, s.amount, user.pay_code) if configured else None,
    }

@router.post("/subscription/payment-request")
def payment_request(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role != "FREE":
        raise HTTPException(status_code=400, detail="Bạn đã là Premium")
    if not user.pay_code:
        user.pay_code = gen_code(db)
        db.commit()
    existing = db.query(UpgradeRequest).filter(UpgradeRequest.user_id == user.id, UpgradeRequest.status == "PENDING").first()
    if existing:
        return {"message": "Yêu cầu đang chờ duyệt", "request_id": existing.id, "status": "PENDING"}
    s = get_settings(db)
    req = UpgradeRequest(user_id=user.id, pay_code=user.pay_code, amount=s.amount, status="PENDING")
    db.add(req)
    db.commit()
    return {"message": "Đã gửi yêu cầu, chờ admin duyệt", "request_id": req.id, "status": "PENDING"}

def require_admin(user: User = Depends(get_current_user)):
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Không có quyền Admin")
    return user

@router.get("/admin/upgrade-requests")
def list_requests(status: str = "", db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    q = db.query(UpgradeRequest).order_by(UpgradeRequest.created_at.desc())
    if status:
        q = q.filter(UpgradeRequest.status == status)
    out = []
    for r in q.all():
        u = db.query(User).filter(User.id == r.user_id).first()
        out.append({"id": r.id, "user_id": r.user_id, "email": u.email if u else "", "pay_code": r.pay_code, "amount": r.amount, "status": r.status, "created_at": str(r.created_at)})
    return {"total": len(out), "requests": out}

@router.post("/admin/upgrade-requests/{req_id}/approve")
def approve_request(req_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from ..models.audit_log import AuditLog
    r = db.query(UpgradeRequest).filter(UpgradeRequest.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    u = db.query(User).filter(User.id == r.user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    from ..auth import grant_premium
    grant_premium(u)
    r.status = "APPROVED"
    db.add(AuditLog(admin_email=admin.email, action="APPROVE_PREMIUM", target=u.id, result="SUCCESS"))
    db.commit()
    return {"message": "Đã duyệt Premium"}

@router.post("/admin/upgrade-requests/{req_id}/reject")
def reject_request(req_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from ..models.audit_log import AuditLog
    r = db.query(UpgradeRequest).filter(UpgradeRequest.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu")
    r.status = "REJECTED"
    db.add(AuditLog(admin_email=admin.email, action="REJECT_PREMIUM", target=r.user_id, result="SUCCESS"))
    db.commit()
    return {"message": "Đã từ chối yêu cầu"}

@router.get("/admin/payment-settings")
def get_payment_settings(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    s = get_settings(db)
    return {"bank_id": s.bank_id, "account_no": s.account_no, "account_name": s.account_name, "amount": s.amount}

def get_contact(db: Session) -> ContactSettings:
    c = db.query(ContactSettings).filter(ContactSettings.id == 1).first()
    if not c:
        c = ContactSettings(id=1)
        db.add(c)
        db.commit()
        db.refresh(c)
    return c

@router.get("/contact")
def public_contact(db: Session = Depends(get_db)):
    c = get_contact(db)
    return {"hotline": c.hotline, "email": c.email, "facebook": c.facebook, "address": c.address}

@router.get("/admin/contact-settings")
def get_contact_settings(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    c = get_contact(db)
    return {"hotline": c.hotline, "email": c.email, "facebook": c.facebook, "address": c.address}

@router.put("/admin/contact-settings")
def update_contact_settings(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from ..models.audit_log import AuditLog
    c = get_contact(db)
    for field in ("hotline", "email", "facebook", "address"):
        if field in payload and isinstance(payload[field], str):
            setattr(c, field, payload[field].strip()[:200])
    db.add(AuditLog(admin_email=admin.email, action="UPDATE_CONTACT", target="contact", result="SUCCESS"))
    db.commit()
    return {"message": "Đã lưu thông tin liên hệ", "hotline": c.hotline, "email": c.email, "facebook": c.facebook, "address": c.address}

@router.put("/admin/payment-settings")
def update_payment_settings(payload: dict, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    from ..models.audit_log import AuditLog
    s = get_settings(db)
    if "bank_id" in payload:
        s.bank_id = str(payload["bank_id"]).strip().upper()
    if "account_no" in payload:
        s.account_no = str(payload["account_no"]).strip()
    if "account_name" in payload:
        s.account_name = str(payload["account_name"]).strip()[:100]
    if "amount" in payload:
        try:
            s.amount = max(1000, int(payload["amount"]))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Số tiền không hợp lệ")
    db.add(AuditLog(admin_email=admin.email, action="UPDATE_PAYMENT_SETTINGS", target="payment", result="SUCCESS"))
    db.commit()
    return {"message": "Đã lưu cài đặt QR", "bank_id": s.bank_id, "account_no": s.account_no, "account_name": s.account_name, "amount": s.amount}
