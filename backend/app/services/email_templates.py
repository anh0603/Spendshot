"""7 email template nhắc quay lại app (§57): HTML đơn giản, responsive,
hiển thị tốt Gmail/Outlook/iPhone/Android, ít hình ảnh, CTA Mở SpendShot."""

_SUBJECTS = {
    1: "SpendShot nhớ bạn! 📸",
    2: "Bạn chưa lưu bill hôm nay?",
    3: "Đừng để những khoản chi tiêu bị quên nhé!",
    4: "Hũ ngân sách của bạn đang chờ...",
    5: "Mới 1 phút là xong — chụp bill hôm nay đi!",
    6: "Bạn đã bỏ lỡ 6 ngày theo dõi chi tiêu",
    7: "Đây là lời nhắc cuối cùng trong chuỗi này",
}

_BODIES = {
    1: ("Lâu rồi không gặp!",
        "Bạn đã 3 ngày chưa mở SpendShot. Chụp nhanh món đồ vừa mua để Hũ tháng luôn chính xác nhé."),
    2: ("Bạn chưa lưu bill hôm nay?",
        "Mỗi bill bỏ sót là một lỗ hổng trong ngân sách. Mở app và chụp bill trong 1 phút thôi."),
    3: ("Đừng để những khoản chi tiêu bị quên nhé!",
        "Hũ tháng này của bạn đang thiếu dữ liệu. Quay lại và lưu các khoản chi gần đây nào."),
    4: ("Hũ ngân sách của bạn đang chờ...",
        "Số dư Hũ chỉ đúng khi bạn chụp đủ bill. Dành 1 phút để cập nhật nhé."),
    5: ("Mới 1 phút là xong!",
        "Chụp bill hôm nay đi — SpendShot sẽ tự trừ tiền vào Hũ giúp bạn, khỏi ghi chép."),
    6: ("Bạn đã bỏ lỡ 6 ngày theo dõi",
        "Quay lại ngay hôm nay để tháng này không bị vượt ngân sách lúc nào không hay."),
    7: ("Đây là lời nhắc cuối cùng trong chuỗi này",
        "Sau email này chúng tôi sẽ không nhắc nữa. Mở SpendShot bất cứ lúc nào bạn cần nhé."),
}


def render_reminder_email(day: int, app_url: str) -> tuple[str, str]:
    """Trả về (subject, html). day 1..7."""
    day = max(1, min(7, int(day)))
    title, body = _BODIES[day]
    return _SUBJECTS[day], f"""<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#FAFBFC;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
<div style="background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
<div style="font-size:22px;font-weight:bold;color:#111827;">📸 Spend<span style="color:#FF6B35;">Shot</span></div>
<h1 style="font-size:20px;color:#111827;margin:18px 0 8px;">{title}</h1>
<p style="font-size:14px;line-height:1.6;color:#6B7280;">{body}</p>
<a href="{app_url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#FF6B35;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold;font-size:15px;">Mở SpendShot</a>
</div>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin-top:16px;">Bạn nhận email này vì đã bật nhắc email trong SpendShot.<br>Tắt trong Cài đặt &gt; Thông báo bất cứ lúc nào.</p>
</div></body></html>"""
