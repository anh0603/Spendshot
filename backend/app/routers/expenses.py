import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..models.expense import Expense
from ..models.jar import Jar
from ..auth import get_current_user
from ..models.user import User
from ..config import settings

router = APIRouter(prefix="/expenses", tags=["expenses"])

def check_owner(exp: Expense, user: User):
    if exp.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")

def save_photo(file: UploadFile, user_id: str) -> tuple[str, str]:
    from ..services.storage_service import get_storage, ALLOWED_MIME, MAX_SIZE
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Định dạng ảnh không hợp lệ")
    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Ảnh vượt quá 5MB")
    try:
        return get_storage().save_expense_photo(user_id, data, file.content_type or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
def list_expenses(jar_id: Optional[str]=None, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    q = db.query(Expense).filter(Expense.user_id==user.id)
    if jar_id:
        q = q.filter(Expense.jar_id==jar_id)
    exps = q.order_by(Expense.created_at.desc()).all()
    return [{"id":e.id,"jar_id":e.jar_id,"amount":e.amount,"photo":e.photo,"thumbnail":e.thumbnail,"category":e.category,"idempotency_key":e.idempotency_key,"created_at":str(e.created_at)} for e in exps]

@router.post("")
async def create_expense(
    jar_id: str = Form(...),
    amount: int = Form(...),
    category: Optional[str] = Form(None),
    idempotency_key: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    source: Optional[str] = Form(None),  # camera or gallery
    db: Session=Depends(get_db), user: User=Depends(get_current_user)
):
    # Gallery enforcement: FREE cannot use gallery
    if source == "gallery":
        role = user.role.value if hasattr(user.role, 'value') else str(user.role)
        if role == "FREE":
            raise HTTPException(status_code=403, detail="Gallery chỉ dành cho Premium")
    jar = db.query(Jar).filter(Jar.id==jar_id).first()
    if not jar or jar.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải > 0")
    key = idempotency_key or str(uuid.uuid4())
    # idempotency check — CRITICAL-3: luôn filter theo user, không lookup global
    existing = db.query(Expense).filter(Expense.user_id==user.id, Expense.idempotency_key==key).first()
    if existing:
        return {"id": existing.id, "jar_id": existing.jar_id, "amount": existing.amount, "photo": existing.photo, "thumbnail": existing.thumbnail, "category": existing.category, "idempotency_key": existing.idempotency_key}
    photo_url = ""
    thumb_url = ""
    eid = str(uuid.uuid4())
    if photo:
        photo_url, thumb_url, eid = save_photo(photo, user.id)
    else:
        # Production bắt buộc có ảnh (REQUIRE_PHOTO=true). Dev/test cho qua với ảnh giữ chỗ.
        if settings.REQUIRE_PHOTO:
            raise HTTPException(status_code=400, detail="Vui lòng chụp hoặc tải ảnh lên trước khi lưu")
        photo_url = f"https://picsum.photos/seed/{eid}/400/400"
        thumb_url = photo_url
    exp = Expense(id=eid, user_id=user.id, jar_id=jar_id, amount=amount, photo=photo_url, thumbnail=thumb_url, category=category, idempotency_key=key)
    db.add(exp)
    # update jar spent
    jar.spent = (jar.spent or 0) + amount
    try:
        db.commit()
    except Exception as _e:
        # Race retry cùng key: unique(user_id, idempotency_key) -> trả expense đã có của user
        from sqlalchemy.exc import IntegrityError
        db.rollback()
        if isinstance(_e, IntegrityError):
            dup = db.query(Expense).filter(Expense.user_id==user.id, Expense.idempotency_key==key).first()
            if dup:
                return {"id": dup.id, "jar_id": dup.jar_id, "amount": dup.amount, "photo": dup.photo, "thumbnail": dup.thumbnail, "category": dup.category, "idempotency_key": dup.idempotency_key}
        raise
    db.refresh(exp)
    return {"id": exp.id, "jar_id": exp.jar_id, "amount": exp.amount, "photo": exp.photo, "thumbnail": exp.thumbnail, "category": exp.category, "idempotency_key": exp.idempotency_key, "created_at": str(exp.created_at)}

@router.get("/{exp_id}")
def get_expense(exp_id: str, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    exp = db.query(Expense).filter(Expense.id==exp_id).first()
    if not exp: raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")
    check_owner(exp, user)
    return {"id":exp.id,"jar_id":exp.jar_id,"amount":exp.amount,"photo":exp.photo,"thumbnail":exp.thumbnail,"category":exp.category,"idempotency_key":exp.idempotency_key,"created_at":str(exp.created_at)}

@router.patch("/{exp_id}")
def update_expense(exp_id: str, payload: dict, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    exp = db.query(Expense).filter(Expense.id==exp_id).first()
    if not exp: raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")
    check_owner(exp, user)
    if "amount" in payload:
        old = exp.amount
        new = int(payload["amount"])
        if new <=0: raise HTTPException(status_code=400, detail="Số tiền không hợp lệ")
        # adjust jar spent
        jar = db.query(Jar).filter(Jar.id==exp.jar_id).first()
        if jar:
            jar.spent = (jar.spent or 0) - old + new
        exp.amount = new
    if "category" in payload:
        exp.category = payload["category"]
    db.commit()
    db.refresh(exp)
    return {"id":exp.id,"amount":exp.amount,"category":exp.category}

@router.delete("/{exp_id}")
def delete_expense(exp_id: str, db: Session=Depends(get_db), user: User=Depends(get_current_user)):
    exp = db.query(Expense).filter(Expense.id==exp_id).first()
    if not exp: raise HTTPException(status_code=404, detail="Không tìm thấy khoản chi")
    check_owner(exp, user)
    jar = db.query(Jar).filter(Jar.id==exp.jar_id).first()
    if jar:
        jar.spent = max(0, (jar.spent or 0) - exp.amount)
    db.delete(exp)
    db.commit()
    return {"message":"Đã xóa"}
