import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h() { return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }

export function SubscriptionsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/admin/subscriptions`, { headers: h() }).then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  if (!data) return <div className="p-6">Đang tải...</div>;
  const total = Math.max(1, data.total);
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Gói đăng ký</h1>
      <Reveal delay={60}>
      <div className="max-w-xl bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4">
          <p className="text-xs text-text-secondary">Gói FREE</p>
          <p className="text-xl font-bold">{data.free}</p>
          <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-text-secondary rounded-full" style={{ width: `${(data.free / total) * 100}%` }} /></div>
        </div>
        <div className="bg-gradient-to-br from-primary to-[#FFB088] rounded-xl p-4 text-white">
          <p className="text-xs opacity-90">Gói PREMIUM</p>
          <p className="text-xl font-bold">{data.premium}</p>
          <div className="h-2 bg-white/30 rounded-full mt-2 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${(data.premium / total) * 100}%` }} /></div>
        </div>
      </div>
      </div>
      </Reveal>
      <p className="text-xs text-text-secondary mt-4">Chưa tích hợp thanh toán thật — Liên hệ admin để nâng cấp thủ công.</p>
    </div>
  );
}
