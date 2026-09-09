from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User, UserRole
from ..models.jar import Jar
from ..models.expense import Expense
from ..models.audit_log import AuditLog
import os

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(user: User = Depends(get_current_user)):
    role = user.role.value if hasattr(user.role,'value') else str(user.role)
    if role not in ("ADMIN","SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Không có quyền Admin")
    return user

def audit(db: Session, admin: User, action: str, target: str, result: str="SUCCESS"):
    log = AuditLog(admin_email=admin.email, action=action, target=target, result=result)
    db.add(log)
    db.commit()

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total_users = db.query(User).count()
    free_users = db.query(User).filter(User.role==UserRole.FREE).count()
    premium_users = db.query(User).filter(User.role==UserRole.PREMIUM).count()
    active_users = db.query(User).filter(User.status=="ACTIVE").count()
    suspended_users = db.query(User).filter(User.status=="SUSPENDED").count()
    total_jars = db.query(Jar).count()
    total_expenses = db.query(Expense).count()
    # Storage: sum file sizes in uploads
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    storage_used = 0
    if os.path.exists(upload_dir):
        for root,_,files in os.walk(upload_dir):
            for f in files:
                try: storage_used += os.path.getsize(os.path.join(root,f))
                except: pass
    # Sync failures: count audit logs with FAILED? For now 0
    sync_failures = 0
    ads_status = "Bật" if free_users>0 else "Tắt"
    return {
        "total_users": total_users,
        "free_users": free_users,
        "premium_users": premium_users,
        "active_users": active_users,
        "suspended_users": suspended_users,
        "total_jars": total_jars,
        "total_expenses": total_expenses,
        "storage_used": storage_used,
        "sync_failures": sync_failures,
        "ads_status": ads_status
    }

@router.get("/stats/monthly")
def stats_monthly(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    """6 tháng gần nhất: user mới, Hũ mới, khoản chi, tổng tiền chi.
    Dùng extract() portable SQLite + PostgreSQL (không strftime SQLite-only)."""
    from datetime import datetime
    from sqlalchemy import extract
    out = []
    now = datetime.now()
    for i in range(5, -1, -1):
        y = now.year + (now.month - 1 - i) // 12
        m = (now.month - 1 - i) % 12 + 1
        label = f"{m:02d}/{y}"
        users = db.query(User).filter(extract("year", User.created_at) == y, extract("month", User.created_at) == m).count()
        jars = db.query(Jar).filter(extract("year", Jar.created_at) == y, extract("month", Jar.created_at) == m).count()
        exps = db.query(Expense).filter(extract("year", Expense.created_at) == y, extract("month", Expense.created_at) == m).all()
        out.append({"month": label, "users": users, "jars": jars, "expenses": len(exps), "amount": sum(e.amount for e in exps)})
    return {"months": out}

@router.get("/stats/overview")
def stats_overview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Top chi tiêu, user mới nhất, yêu cầu Premium chờ duyệt."""
    from ..models.payment import UpgradeRequest
    users = db.query(User).filter(User.role != UserRole.SUPER_ADMIN).all()
    rows = []
    for u in users:
        exps = db.query(Expense).filter(Expense.user_id == u.id).all()
        rows.append({
            "id": u.id, "email": u.email, "name": getattr(u, "name", "") or "",
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "expenses": len(exps), "total_spent": sum(e.amount for e in exps),
        })
    rows.sort(key=lambda r: r["total_spent"], reverse=True)
    recent = db.query(User).filter(User.role != UserRole.SUPER_ADMIN).order_by(User.created_at.desc()).limit(5).all()
    pending = db.query(UpgradeRequest).filter(UpgradeRequest.status == "PENDING").count()
    return {
        "top_users": rows[:5],
        "recent_users": [{"id": u.id, "email": u.email, "role": u.role.value if hasattr(u.role, 'value') else str(u.role), "created_at": str(u.created_at)} for u in recent],
        "pending_requests": pending,
    }

@router.get("/users")
def list_users(search: Optional[str]=None, plan: Optional[str]=None, status: Optional[str]=None, page: int=Query(1, ge=1), limit: int=Query(10, ge=1, le=50), db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    # Quản lý người dùng không bao gồm tài khoản SUPER_ADMIN
    q = db.query(User).filter(User.role != UserRole.SUPER_ADMIN)
    if search:
        q = q.filter(or_(User.email.contains(search), User.pay_code == search.strip().upper()))
    if plan:
        try: q = q.filter(User.role==UserRole(plan))
        except: pass
    if status:
        q = q.filter(User.status==status)
    total = q.count()
    users = q.offset((page-1)*limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "users": [{"id":u.id,"email":u.email,"name":getattr(u,"name","") or "","avatar":getattr(u,"avatar","") or "","role":u.role.value if hasattr(u.role,'value') else str(u.role),"status":u.status.value if hasattr(u.status,'value') else str(u.status),"created_at":str(u.created_at),"last_activity":str(u.last_activity)} for u in users]
    }

@router.get("/users/{user_id}")
def get_user_detail(user_id: str, db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    u = db.query(User).filter(User.id==user_id).first()
    if not u: raise HTTPException(status_code=404, detail="Không tìm thấy user")
    jars = db.query(Jar).filter(Jar.user_id==user_id).all()
    expenses = db.query(Expense).filter(Expense.user_id==user_id).order_by(Expense.created_at.desc()).limit(5).all()
    total_spent = sum(e.amount for e in db.query(Expense).filter(Expense.user_id==user_id).all())
    return {
        "id":u.id,"email":u.email,"name":getattr(u,"name","") or "","avatar":getattr(u,"avatar","") or "","pay_code":getattr(u,"pay_code",None),
        "role":u.role.value if hasattr(u.role,'value') else str(u.role),
        "status":u.status.value if hasattr(u.status,'value') else str(u.status),
        "created_at":str(u.created_at),"last_activity":str(u.last_activity),
        "jars":len(jars),"expenses":db.query(Expense).filter(Expense.user_id==user_id).count(),
        "total_spent":total_spent,
        "recent_expenses":[{"id":e.id,"amount":e.amount,"thumbnail":e.thumbnail,"created_at":str(e.created_at)} for e in expenses],
        "storage":0,
    }

def _is_super_admin(u: User) -> bool:
    role = u.role.value if hasattr(u.role, 'value') else str(u.role)
    return role == "SUPER_ADMIN"

@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: dict, db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    u = db.query(User).filter(User.id==user_id).first()
    if not u: raise HTTPException(status_code=404, detail="Không tìm thấy user")
    # SUPER_ADMIN là cấp cao nhất — không ai được đổi gói/khóa
    if _is_super_admin(u) and ("role" in payload or "status" in payload):
        raise HTTPException(status_code=400, detail="Không thể thay đổi tài khoản SUPER_ADMIN")
    if "role" in payload:
        try: u.role = UserRole(payload["role"])
        except: raise HTTPException(status_code=400, detail="Role không hợp lệ")
        audit(db, admin, "CHANGE_PLAN", user_id)
    if "status" in payload:
        from ..models.user import UserStatus
        try: u.status = UserStatus(payload["status"])
        except: raise HTTPException(status_code=400, detail="Status không hợp lệ")
        audit(db, admin, "SUSPEND" if payload["status"]=="SUSPENDED" else "ACTIVATE", user_id)
    db.commit()
    return {"message":"Đã cập nhật"}

@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, payload: dict = {}, db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    u = db.query(User).filter(User.id==user_id).first()
    if not u: raise HTTPException(status_code=404, detail="Không tìm thấy user")
    if _is_super_admin(u):
        raise HTTPException(status_code=400, detail="Không thể đổi mật khẩu tài khoản SUPER_ADMIN")
    # Admin đặt mật khẩu mới cho user (mặc định Temp123!). Không bao giờ trả password.
    from ..auth import hash_password
    new_pw = (payload.get("new_password") or "Temp123!") if isinstance(payload, dict) else "Temp123!"
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải ít nhất 6 ký tự")
    u.password_hash = hash_password(new_pw)
    db.commit()
    audit(db, admin, "RESET_PASSWORD", user_id)
    return {"message":"Đã đặt mật khẩu mới cho người dùng"}

@router.delete("/users/{user_id}/data")
def delete_user_data(user_id: str, payload: dict, db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    """RIÊNG BIỆT với Delete images: xóa toàn bộ dữ liệu 1 user (cần confirm + đúng email)."""
    if not isinstance(payload, dict) or payload.get("confirm") is not True:
        raise HTTPException(status_code=400, detail="Cần confirm=true")
    u = db.query(User).filter(User.id==user_id).first()
    if not u: raise HTTPException(status_code=404, detail="Không tìm thấy user")
    if _is_super_admin(u):
        raise HTTPException(status_code=400, detail="Không thể xóa SUPER_ADMIN")
    if (payload.get("email") or "").strip().lower() != (u.email or "").lower():
        raise HTTPException(status_code=400, detail="Email xác nhận không khớp")
    from .storage_admin import wipe_user_data
    return wipe_user_data(db, admin, u)

@router.get("/subscriptions")
def subscriptions(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    free = db.query(User).filter(User.role==UserRole.FREE).count()
    premium = db.query(User).filter(User.role==UserRole.PREMIUM).count()
    return {"free": free, "premium": premium, "total": free+premium}

@router.get("/ads")
def ads_admin(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    return {"enabled": True, "impressions": 1234}

@router.get("/storage")
def storage(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    total=0
    if os.path.exists(upload_dir):
        for root,_,files in os.walk(upload_dir):
            for f in files:
                try: total+=os.path.getsize(os.path.join(root,f))
                except: pass
    return {"photos": total, "local": 0, "total": total, "warning": total > 80*1024*1024}

@router.get("/sync-monitor")
def sync_monitor(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    total_exp = db.query(Expense).count()
    return {"pending":0,"syncing":0,"synced":total_exp,"failed":0,"last_sync":None}

@router.get("/audit-logs")
def audit_logs(page: int=1, limit: int=20, db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    logs = db.query(AuditLog).order_by(AuditLog.time.desc()).offset((page-1)*limit).limit(limit).all()
    total = db.query(AuditLog).count()
    return {"total": total, "logs": [{"time":str(l.time),"admin":l.admin_email,"action":l.action,"target":l.target,"result":l.result} for l in logs]}

@router.get("/notifications/overview")
def notifications_overview(db: Session=Depends(get_db), admin: User=Depends(require_admin)):
    """§26 — stats push/email cho Admin (không gửi broadcast ở đây, §27)."""
    from ..models.notifications import PushSubscription, NotificationHistory, EmailReminderLog
    from ..services.timeutil import vn_date_str
    today = vn_date_str()
    push_on = db.query(User).filter(User.push_enabled == True).count()  # noqa: E712
    push_off = db.query(User).filter(User.push_enabled == False).count()  # noqa: E712
    email_on = db.query(User).filter(User.email_enabled == True).count()  # noqa: E712
    active_subs = db.query(PushSubscription).filter(PushSubscription.is_active == True).count()  # noqa: E712
    in_seq = db.query(User).filter((User.email_reminder_count > 0)).count()
    push_today = db.query(NotificationHistory).filter(
        NotificationHistory.channel == "PUSH", NotificationHistory.status == "SENT",
        NotificationHistory.dedup_key.like(f"{today}#%")).count()
    email_today = db.query(EmailReminderLog).filter(
        EmailReminderLog.reminder_date == today).count()
    failed_push = db.query(NotificationHistory).filter(
        NotificationHistory.channel == "PUSH", NotificationHistory.status == "FAILED",
        NotificationHistory.dedup_key.like(f"{today}#%")).count()
    failed_email = db.query(EmailReminderLog).filter(
        EmailReminderLog.reminder_date == today,
        EmailReminderLog.status != "SENT").count()
    return {
        "total_users": db.query(User).count(),
        "push_enabled": push_on, "push_disabled": push_off,
        "active_subscriptions": active_subs,
        "email_enabled": email_on,
        "in_reminder_sequence": in_seq,
        "push_sent_today": push_today, "email_sent_today": email_today,
        "failed_push_today": failed_push, "failed_email_today": failed_email,
    }
