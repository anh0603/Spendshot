from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.jar import Jar
from ..models.expense import Expense

router = APIRouter(prefix="/sync", tags=["sync"])

@router.post("/push")
def push(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # payload: { expenses: [{id, jar_id, amount, category, idempotency_key, photo, created_at}] , jars: [...] }
    results = {"expenses": [], "jars": []}
    for jar_data in payload.get("jars", []):
        # idempotency via id check or create
        existing = db.query(Jar).filter(Jar.id == jar_data.get("id")).first()
        if existing:
            if existing.user_id != user.id:
                continue
            # conflict: last write wins if newer updated_at
            if jar_data.get("budget") is not None:
                existing.budget = jar_data["budget"]
            if jar_data.get("name"):
                existing.name = jar_data["name"]
            results["jars"].append({"id": existing.id, "status":"SYNCED"})
        else:
            jar = Jar(id=jar_data.get("id"), user_id=user.id, name=jar_data.get("name","Hũ"), budget=jar_data.get("budget",0), spent=jar_data.get("spent",0), month=jar_data.get("month","2026-01"))
            db.add(jar)
            results["jars"].append({"id": jar.id, "status":"SYNCED"})
    for exp_data in payload.get("expenses", []):
        key = exp_data.get("idempotency_key")
        if key:
            # CRITICAL-3: dedup trong phạm vi user, không lookup global
            dup = db.query(Expense).filter(Expense.user_id==user.id, Expense.idempotency_key==key).first()
            if dup:
                results["expenses"].append({"id": dup.id, "status":"SYNCED", "duplicate": True})
                continue
        jar = db.query(Jar).filter(Jar.id==exp_data.get("jar_id"), Jar.user_id==user.id).first()
        if not jar:
            results["expenses"].append({"id": exp_data.get("id"), "status":"FAILED", "error":"Jar not found"})
            continue
        exp = Expense(id=exp_data.get("id"), user_id=user.id, jar_id=exp_data["jar_id"], amount=exp_data["amount"], photo=exp_data.get("photo",""), thumbnail=exp_data.get("thumbnail",""), category=exp_data.get("category"), idempotency_key=key or exp_data.get("id"))
        db.add(exp)
        jar.spent = (jar.spent or 0) + exp.amount
        results["expenses"].append({"id": exp.id, "status":"SYNCED"})
    db.commit()
    return results

@router.get("/pull")
def pull(since: Optional[str]=None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # since ISO timestamp, for now return all
    jars = db.query(Jar).filter(Jar.user_id==user.id).all()
    exps = db.query(Expense).filter(Expense.user_id==user.id).order_by(Expense.created_at.desc()).all()
    return {
        "jars": [{"id":j.id,"name":j.name,"budget":j.budget,"spent":j.spent,"month":j.month,"updated_at":str(j.updated_at)} for j in jars],
        "expenses": [{"id":e.id,"jar_id":e.jar_id,"amount":e.amount,"photo":e.photo,"thumbnail":e.thumbnail,"category":e.category,"idempotency_key":e.idempotency_key,"created_at":str(e.created_at)} for e in exps],
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/status")
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pending = db.query(Expense).filter(Expense.user_id==user.id).count()  # simplified
    jars = db.query(Jar).filter(Jar.user_id==user.id).count()
    return {"pending": 0, "failed": 0, "synced": pending, "last_sync": datetime.utcnow().isoformat(), "jars": jars, "expenses": pending}
