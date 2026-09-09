"""Hourly scheduler (§23): 1 job chạy định kỳ, app tự kiểm tra có phải giờ gửi không.

- run_push: 6 slot/ngày Asia/Ho_Chi_Minh, random không trùng trong ngày (§6),
  idempotency user+date+slot (§7), sub 404/410 → is_active=false (§11).
- run_email: inactive >= 3 ngày, 1 mail/ngày, tối đa 7, dừng khi user quay lại (§14-§18).
- run_cleanup: xóa history kỹ thuật quá hạn (§46), KHÔNG xóa dữ liệu user/bill.
- Job lock bằng DB (§63), cron endpoint bảo vệ bằng CRON_SECRET (§62).
"""
import logging
import random
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .config import settings
from .models.user import User
from .models.notifications import (
    PushSubscription, NotificationHistory, EmailReminderLog, SchedulerLock,
)
from .services.reminder_messages import REMINDER_MESSAGES
from .services.timeutil import utcnow_naive, vn_date_str, vn_slot_str
from .services.push_service import get_push_provider, build_bill_payload
from .services.email_service import get_email_provider
from .services.email_templates import render_reminder_email

log = logging.getLogger("spendshot.scheduler")

EMAIL_SEQ_MAX = 7
INACTIVE_DAYS = 3
LOCK_STALE_MINUTES = 120


# --- lock (§63) ---

def acquire_lock(db: Session, name: str, owner: str = "cron") -> bool:
    row = db.query(SchedulerLock).filter(SchedulerLock.name == name).first()
    now = utcnow_naive()
    if row is None:
        db.add(SchedulerLock(name=name, locked_at=now, owner=owner))
        db.commit()
        return True
    if (now - (row.locked_at or now)) >= timedelta(minutes=LOCK_STALE_MINUTES):
        row.locked_at = now
        row.owner = owner
        db.commit()
        return True
    return False


def release_lock(db: Session, name: str):
    db.query(SchedulerLock).filter(SchedulerLock.name == name).delete()
    db.commit()


# --- push (§5-§7) ---

def pick_message(db: Session, user_id: str, date: str) -> int:
    """Random 1 trong 30 câu chưa gửi hôm nay (§6). Luôn còn dư (6 slot < 30)."""
    rows = db.query(NotificationHistory.message_id).filter(
        NotificationHistory.user_id == user_id,
        NotificationHistory.channel == "PUSH",
        NotificationHistory.dedup_key.like(f"{date}#%"),
    ).all()
    sent = {r[0] for r in rows}
    remaining = [i for i in range(len(REMINDER_MESSAGES)) if str(i) not in sent]
    return random.choice(remaining or list(range(len(REMINDER_MESSAGES))))


def run_push(db: Session, now_utc=None, provider=None, only_user_ids=None) -> dict:
    slot = vn_slot_str(now_utc)
    date = vn_date_str(now_utc)
    if slot not in settings.push_slots():
        return {"job": "push", "slot": slot, "sent": 0, "skipped": "not_scheduled"}
    provider = provider or get_push_provider()
    sent = failed = skipped = 0
    q = db.query(User).filter(User.status == "ACTIVE")
    if only_user_ids is not None:
        q = q.filter(User.id.in_(only_user_ids))
    users = q.all()
    for u in users:
        if not getattr(u, "push_enabled", True):
            continue
        subs = db.query(PushSubscription).filter(
            PushSubscription.user_id == u.id, PushSubscription.is_active == True).all()  # noqa: E712
        if not subs:
            continue
        dedup = f"{date}#{slot}"
        hist = NotificationHistory(user_id=u.id, type="BILL_REMINDER", channel="PUSH",
                                   scheduled_at=slot, dedup_key=dedup, status="PENDING")
        db.add(hist)
        try:
            db.flush()  # unique vi phạm = cron chạy lại → bỏ qua (§7, §41)
        except IntegrityError:
            db.rollback()
            skipped += 1
            continue
        msg_idx = pick_message(db, u.id, date)
        hist.message_id = str(msg_idx)
        payload = build_bill_payload(REMINDER_MESSAGES[msg_idx])
        ok_any = False
        for s in subs:
            try:
                res = provider.send(
                    {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}},
                    payload)
            except Exception as e:
                log.warning("PUSH_FAILED user=%s error_code=%s", u.id, type(e).__name__)
                s.last_failure_at = utcnow_naive()
                continue
            if res.ok:
                ok_any = True
                s.last_success_at = utcnow_naive()
                log.info("PUSH_SENT user=%s slot=%s msg=%s%s",
                         u.id, slot, msg_idx, " provider=mock" if res.mocked else "")
            else:
                s.last_failure_at = utcnow_naive()
                if res.expired:  # §11
                    s.is_active = False
                    log.info("PUSH_INVALID_SUBSCRIPTION user=%s error_code=%s",
                             u.id, res.error_code)
                else:
                    log.warning("PUSH_FAILED user=%s error_code=%s", u.id, res.error_code)
        hist.status = "SENT" if ok_any else "FAILED"
        hist.sent_at = utcnow_naive()
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            skipped += 1
            continue
        sent += 1 if ok_any else 0
        failed += 0 if ok_any else 1
    return {"job": "push", "slot": slot, "sent": sent, "failed": failed, "skipped": skipped}


# --- email (§14-§18) ---

def run_email(db: Session, now_utc=None, provider=None, only_user_ids=None) -> dict:
    now = now_utc or utcnow_naive()
    today = vn_date_str(now)
    provider = provider or get_email_provider()
    sent = failed = stopped = 0
    # §22 — quota tính trước và trừ dần trong loop, không bao giờ vượt.
    day_left = settings.EMAIL_DAILY_LIMIT - db.query(EmailReminderLog).filter(
        EmailReminderLog.reminder_date == today).count()
    month_left = settings.EMAIL_MONTHLY_LIMIT - db.query(EmailReminderLog).filter(
        EmailReminderLog.reminder_date.like(f"{today[:7]}%")).count()
    if day_left <= 0 or month_left <= 0:
        log.warning("EMAIL_QUOTA_EXCEEDED date=%s", today)
        return {"job": "email", "sent": 0, "skipped": "quota_exceeded"}
    q = db.query(User).filter(User.status == "ACTIVE")
    if only_user_ids is not None:
        q = q.filter(User.id.in_(only_user_ids))
    users = q.all()
    for u in users:
        last = u.last_activity
        try:
            inactive_days = (now - (last.replace(tzinfo=None) if last else now)).days
        except Exception:
            inactive_days = 0
        count = u.email_reminder_count or 0
        if inactive_days < INACTIVE_DAYS:
            if count or u.email_reminder_started_at or u.email_reminder_last_sent_at:
                u.email_reminder_count = 0
                u.email_reminder_started_at = None
                u.email_reminder_last_sent_at = None
                db.commit()
                stopped += 1
                log.info("REMINDER_STOPPED user=%s (đã quay lại app)", u.id)
            continue
        if not getattr(u, "email_enabled", True):
            continue
        if count >= EMAIL_SEQ_MAX:
            continue  # đã đủ 7 mail (§16)
        exists = db.query(EmailReminderLog).filter(
            EmailReminderLog.user_id == u.id,
            EmailReminderLog.reminder_date == today).first()
        if exists:
            continue  # idempotency 1 mail/ngày (§18, §41)
        day = count + 1
        if day_left <= 0 or month_left <= 0:
            log.warning("EMAIL_QUOTA_EXCEEDED date=%s", today)
            break
        subject, html = render_reminder_email(day, settings.FRONTEND_URL)
        try:
            res = provider.send(u.email, subject, html)
        except Exception as e:
            log.warning("EMAIL_FAILED user=%s error_code=%s", u.id, type(e).__name__)
            failed += 1
            continue
        if not res.ok:
            if res.skipped_quota:
                log.warning("EMAIL_QUOTA_EXCEEDED")
                break
            log.warning("EMAIL_FAILED user=%s error_code=%s", u.id, res.error_code)
            failed += 1
            continue
        db.add(EmailReminderLog(user_id=u.id, reminder_date=today, seq_no=day))
        db.add(NotificationHistory(user_id=u.id, type="INACTIVE_REMINDER", channel="EMAIL",
                                   message_id=str(day), dedup_key=today, status="SENT",
                                   sent_at=utcnow_naive()))
        if count == 0:
            u.email_reminder_started_at = now
            log.info("REMINDER_STARTED user=%s", u.id)
        u.email_reminder_count = day
        u.email_reminder_last_sent_at = now
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # cron chạy lại cùng ngày (§41)
            continue
        if day >= EMAIL_SEQ_MAX:
            log.info("REMINDER_MAX_REACHED user=%s", u.id)
        log.info("EMAIL_SENT user=%s day=%s%s", u.id, day,
                 " provider=mock" if res.mocked else "")
        sent += 1
        day_left -= 1
        month_left -= 1
    return {"job": "email", "sent": sent, "failed": failed, "stopped": stopped}


# --- cleanup (§46) ---

def run_cleanup(db: Session, now_utc=None) -> dict:
    now = now_utc or utcnow_naive()
    cutoff = now - timedelta(days=settings.NOTIFICATION_HISTORY_RETENTION_DAYS)
    h = db.query(NotificationHistory).filter(NotificationHistory.sent_at < cutoff).delete()
    e = db.query(EmailReminderLog).filter(EmailReminderLog.sent_at < cutoff).delete()
    db.commit()
    return {"job": "cleanup", "history_deleted": h, "email_logs_deleted": e}


def run_all(db: Session, jobs=("push", "email", "cleanup"), now_utc=None) -> dict:
    log.info("SCHEDULER_STARTED jobs=%s", list(jobs))
    out = {}
    runners = {"push": run_push, "email": run_email, "cleanup": run_cleanup}
    for name in jobs:
        fn = runners.get(name)
        if not fn:
            out[name] = {"skipped": "unknown_job"}
            continue
        if not acquire_lock(db, name):
            out[name] = {"skipped": "locked"}
            continue
        try:
            out[name] = fn(db, now_utc)
        except Exception as e:  # job lỗi không crash scheduler (§48)
            log.error("SCHEDULER job=%s error=%s", name, type(e).__name__)
            out[name] = {"error": type(e).__name__}
        finally:
            release_lock(db, name)
    log.info("SCHEDULER_FINISHED")
    return out
