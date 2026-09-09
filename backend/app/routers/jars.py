from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..database import get_db
from ..models.jar import Jar
from ..models.jar_transaction import JarTransaction
from ..auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/jars", tags=["jars"])

class JarCreate(BaseModel):
    name: Optional[str] = "Hũ tháng"
    budget: int = 0
    month: Optional[str] = None  # YYYY-MM, default current

class JarUpdate(BaseModel):
    name: Optional[str] = None
    budget: Optional[int] = None

class AmountOp(BaseModel):
    amount: int
    note: Optional[str] = ""

def current_month():
    return datetime.now().strftime("%Y-%m")

def check_owner(jar: Jar, user: User):
    if jar.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")

@router.get("", response_model=List[dict])
def list_jars(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jars = db.query(Jar).filter(Jar.user_id == user.id).order_by(Jar.month.desc()).all()
    return [{"id": j.id, "name": j.name, "budget": j.budget, "spent": j.spent, "remaining": j.budget - j.spent, "month": j.month, "percentage": (j.spent / j.budget * 100) if j.budget else 0} for j in jars]

@router.post("", status_code=201)
def create_jar(payload: JarCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    month = payload.month or current_month()
    # 1 jar / month / user
    existing = db.query(Jar).filter(Jar.user_id == user.id, Jar.month == month).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Đã có Hũ cho tháng {month}")
    jar = Jar(user_id=user.id, name=payload.name or f"Hũ {month}", budget=payload.budget, spent=0, month=month)
    db.add(jar)
    db.commit()
    db.refresh(jar)
    tx = JarTransaction(jar_id=jar.id, user_id=user.id, type="create", amount=payload.budget, note="Tạo Hũ")
    db.add(tx)
    db.commit()
    return {"id": jar.id, "name": jar.name, "budget": jar.budget, "spent": jar.spent, "remaining": jar.budget - jar.spent, "month": jar.month, "percentage": 0}

@router.get("/{jar_id}")
def get_jar(jar_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    return {"id": jar.id, "name": jar.name, "budget": jar.budget, "spent": jar.spent, "remaining": jar.budget - jar.spent, "month": jar.month, "percentage": (jar.spent / jar.budget * 100) if jar.budget else 0, "created_at": str(jar.created_at)}

@router.delete("/{jar_id}")
def delete_jar(jar_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models.expense import Expense
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    exp_count = db.query(Expense).filter(Expense.jar_id == jar_id).count()
    db.query(Expense).filter(Expense.jar_id == jar_id).delete()
    db.query(JarTransaction).filter(JarTransaction.jar_id == jar_id).delete()
    db.delete(jar)
    db.commit()
    return {"message": "Đã xóa Hũ", "deleted_expenses": exp_count}

@router.patch("/{jar_id}")
def update_jar(jar_id: str, payload: JarUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    if payload.name is not None:
        jar.name = payload.name
    if payload.budget is not None:
        if payload.budget < 0:
            raise HTTPException(status_code=400, detail="Ngân sách không hợp lệ")
        old = jar.budget
        jar.budget = payload.budget
        tx = JarTransaction(jar_id=jar.id, user_id=user.id, type="edit", amount=payload.budget - old, note=f"Sửa Hũ {old} -> {payload.budget}")
        db.add(tx)
    db.commit()
    db.refresh(jar)
    return {"id": jar.id, "name": jar.name, "budget": jar.budget, "spent": jar.spent, "remaining": jar.budget - jar.spent, "month": jar.month}

@router.post("/{jar_id}/add")
def add_money(jar_id: str, payload: AmountOp, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải > 0")
    jar.budget += payload.amount
    tx = JarTransaction(jar_id=jar.id, user_id=user.id, type="add", amount=payload.amount, note=payload.note or "Thêm tiền")
    db.add(tx)
    db.commit()
    db.refresh(jar)
    return {"id": jar.id, "budget": jar.budget, "spent": jar.spent, "remaining": jar.budget - jar.spent}

@router.post("/{jar_id}/withdraw")
def withdraw_money(jar_id: str, payload: AmountOp, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải > 0")
    # Allow withdraw even if remaining negative — just reduce budget
    jar.budget -= payload.amount
    tx = JarTransaction(jar_id=jar.id, user_id=user.id, type="withdraw", amount=payload.amount, note=payload.note or "Rút tiền")
    db.add(tx)
    db.commit()
    db.refresh(jar)
    return {"id": jar.id, "budget": jar.budget, "spent": jar.spent, "remaining": jar.budget - jar.spent}

@router.get("/{jar_id}/history")
def jar_history(jar_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jar = db.query(Jar).filter(Jar.id == jar_id).first()
    if not jar:
        raise HTTPException(status_code=404, detail="Không tìm thấy Hũ")
    check_owner(jar, user)
    txs = db.query(JarTransaction).filter(JarTransaction.jar_id == jar_id).order_by(JarTransaction.created_at.desc()).all()
    return [{"id": t.id, "type": t.type, "amount": t.amount, "note": t.note, "created_at": str(t.created_at)} for t in txs]
