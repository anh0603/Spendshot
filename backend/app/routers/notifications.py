"""Notification settings + push subscription API (§8, §9, §54, §55, §60)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.notifications import PushSubscription
from ..services.push_service import get_push_provider, build_bill_payload

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/settings")
def get_settings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id, PushSubscription.is_active == True).count()  # noqa: E712
    return {
        "push_enabled": bool(getattr(user, "push_enabled", True)),
        "email_enabled": bool(getattr(user, "email_enabled", True)),
        "active_subscriptions": count,
    }


@router.patch("/settings")
def update_settings(payload: dict, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if "push_enabled" in payload:
        user.push_enabled = bool(payload["push_enabled"])
    if "email_enabled" in payload:
        user.email_enabled = bool(payload["email_enabled"])
    db.commit()
    return {"message": "Đã lưu cài đặt thông báo",
            "push_enabled": bool(user.push_enabled),
            "email_enabled": bool(user.email_enabled)}


@router.post("/push/subscribe")
def subscribe(payload: dict, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    endpoint = (payload.get("endpoint") or "").strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="Thiếu endpoint")
    keys = payload.get("keys") or {}
    # §42: endpoint của user khác thì không được chiếm.
    other = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id != user.id).first()
    if other:
        raise HTTPException(status_code=409, detail="Endpoint đã thuộc user khác")
    sub = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id == user.id).first()
    if sub:
        sub.p256dh = keys.get("p256dh", "") or ""
        sub.auth = keys.get("auth", "") or ""
        sub.user_agent = payload.get("user_agent", "") or ""
        sub.device_name = payload.get("device_name", "") or ""
        sub.is_active = True
    else:
        sub = PushSubscription(user_id=user.id, endpoint=endpoint,
                               p256dh=keys.get("p256dh", "") or "",
                               auth=keys.get("auth", "") or "",
                               user_agent=payload.get("user_agent", "") or "",
                               device_name=payload.get("device_name", "") or "",
                               is_active=True)
        db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Endpoint đã tồn tại")
    return {"message": "Đã đăng ký push"}


@router.delete("/push/subscribe")
def unsubscribe(payload: dict, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    endpoint = (payload.get("endpoint") or "").strip()
    n = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id,
        PushSubscription.endpoint == endpoint).delete()
    db.commit()
    return {"message": "Đã hủy đăng ký", "deleted": n > 0}


@router.post("/push/test")
def test_push(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """User tự test subscription của chính mình (§60)."""
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user.id, PushSubscription.is_active == True).all()  # noqa: E712
    if not subs:
        raise HTTPException(status_code=404, detail="Chưa có subscription nào")
    provider = get_push_provider()
    payload = build_bill_payload("Push hoạt động tốt! SpendShot sẽ nhắc bạn chụp bill. 📸")
    ok = 0
    for s in subs:
        try:
            res = provider.send(
                {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}},
                payload)
            if res.ok:
                ok += 1
            elif res.expired:
                s.is_active = False
        except Exception:
            pass
    db.commit()
    return {"message": "Đã gửi push test", "sent": ok, "devices": len(subs),
            "mocked": provider.name == "mock"}
