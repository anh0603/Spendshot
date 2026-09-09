import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h() { return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }

export function AdsPage() {
  const [data, setData] = useState<any>(null);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    fetch(`${API}/admin/ads`, { headers: h() }).then((r) => r.json()).then((d) => { setData(d); setEnabled(d.enabled); }).catch(() => {});
  }, []);
  if (!data) return <div className="p-6">Đang tải...</div>;
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Quảng cáo</h1>
      <Reveal delay={60}>
      <div className="bg-white shadow-sm rounded-xl p-6 md:p-8 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Bật quảng cáo cho FREE</p>
            <p className="text-xs text-text-secondary mt-1">PREMIUM luôn tắt quảng cáo</p>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            aria-label={enabled ? "Tắt quảng cáo" : "Bật quảng cáo"}
            className={`w-14 h-8 rounded-full transition-colors relative ${enabled ? "bg-success" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="rounded-lg bg-blue-50 border border-info/20 p-4 text-center">
            <p className="text-xl font-bold text-info">{data.impressions?.toLocaleString("vi-VN") || 0}</p>
            <p className="text-xs text-text-secondary">Lượt hiển thị</p>
          </div>
          <div className="rounded-lg bg-primary-light border border-primary/20 p-4 text-center">
            <p className="text-xl font-bold text-primary">{enabled ? "Đang bật" : "Đang tắt"}</p>
            <p className="text-xs text-text-secondary">Trạng thái</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary mt-4">Quảng cáo không bao giờ che camera, ảnh hay ô nhập tiền.</p>
      </div>
      </Reveal>
    </div>
  );
}
