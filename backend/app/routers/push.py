"""Legacy /push/* — giữ backward-compat (§61), lưu DB thay vì file.

Logic mới dùng /notifications/* (routers/notifications.py).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.notifications import PushSubscription
from ..config import settings
from ..services.push_service import get_push_provider, build_bill_payload

router = APIRouter(prefix="/push", tags=["push"])


@router.post("/subscribe")
def subscribe(payload: dict, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    endpoint = (payload.get("endpoint") or "").strip()
    keys = payload.get("keys") or {}
    subs = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).all()
    for s in subs:
        if s.user_id != user.id:
            continue
        s.p256dh = keys.get("p256dh", "") or ""
        s.auth = keys.get("auth", "") or ""
        s.is_active = True
        db.commit()
        return {"message": "Đã đăng ký push", "vapid_public": settings.VAPID_PUBLIC_KEY}
    if subs:  # endpoint thuộc user khác
        raise HTTPException(status_code=409, detail="Endpoint đã thuộc user khác")
    if endpoint:
        db.add(PushSubscription(user_id=user.id, endpoint=endpoint,
                                p256dh=keys.get("p256dh", "") or "",
                                auth=keys.get("auth", "") or "", is_active=True))
        db.commit()
    return {"message": "Đã đăng ký push", "vapid_public": settings.VAPID_PUBLIC_KEY}


@router.post("/unsubscribe")
def unsubscribe(payload: dict, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    endpoint = payload.get("endpoint")
    db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.endpoint == endpoint).delete()
    db.commit()
    return {"message": "Đã hủy đăng ký"}


@router.post("/send")
def send_push(payload: dict, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Chỉ Admin được gửi push")
    provider = get_push_provider()
    subs = db.query(PushSubscription).filter(PushSubscription.is_active == True).all()  # noqa: E712
    body = (payload or {}).get("body") or (payload or {}).get("title") or "Bạn có thông báo mới"
    data = build_bill_payload(body)
    ok = 0
    for s in subs:
        try:
            res = provider.send(
                {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}}, data)
            if res.ok:
                ok += 1
            elif res.expired:
                s.is_active = False
        except Exception:
            pass
    db.commit()
    suffix = " (mock)" if provider.name == "mock" else ""
    return {"message": f"Đã gửi tới {ok}/{len(subs)} thiết bị{suffix}",
            "count": len(subs), "sent": ok, "payload": payload}


@router.post("/test")
def test_push(user: User = Depends(get_current_user)):
    return {"message": "Push test thành công (mock)", "user": user.email,
            "vapid": bool(settings.VAPID_PUBLIC_KEY)}


@router.get("/vapid")
def vapid():
    return {"public_key": settings.VAPID_PUBLIC_KEY, "subject": settings.VAPID_SUBJECT}
