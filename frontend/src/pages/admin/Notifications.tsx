import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";
import { getNotificationsOverview } from "../../lib/admin";

export function NotificationsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { getNotificationsOverview().then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6">Đang tải...</div>;
  const tiles: [string, number, string][] = [
    ["Push đang bật", data.push_enabled, "bg-success"],
    ["Push đang tắt", data.push_disabled, "bg-gray-400"],
    ["Subscription hoạt động", data.active_subscriptions, "bg-info"],
    ["Email đang bật", data.email_enabled, "bg-success"],
    ["Đang trong chuỗi nhắc", data.in_reminder_sequence, "bg-warning"],
    ["Push đã gửi hôm nay", data.push_sent_today, "bg-primary"],
    ["Email đã gửi hôm nay", data.email_sent_today, "bg-primary"],
    ["Push lỗi hôm nay", data.failed_push_today, "bg-danger"],
    ["Email lỗi hôm nay", data.failed_email_today, "bg-danger"],
  ];
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Thông báo</h1>
      <Reveal delay={60}>
      <div className="bg-white shadow-sm rounded-xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 hover:shadow-md transition-shadow">
        {tiles.map(([k, v, c], i) => (
          <Reveal key={k} delay={i * 60}>
          <div className="bg-slate-50 rounded-xl p-6 text-center hover:shadow-sm transition-shadow">
            <span className={`inline-block w-3 h-3 rounded-full ${c} animate-pop`} />
            <p className="text-xl font-bold mt-1">{v}</p>
            <p className="text-xs text-text-secondary">{k}</p>
          </div>
          </Reveal>
        ))}
      </div>
      </Reveal>
      <p className="text-xs text-text-secondary mt-4">
        Tổng người dùng: {data.total_users} · Push nhắc chụp bill 6 lần/ngày (08:00, 10:00, 12:00, 15:00, 18:00, 20:00 giờ VN) · Email nhắc khi 3 ngày không mở app (tối đa 7 mail).
      </p>
    </div>
  );
}
