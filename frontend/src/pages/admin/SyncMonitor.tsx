import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";
import { parseServerTime } from "../../lib/time";
import { getSyncMonitor } from "../../lib/admin";

export function SyncMonitorPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { getSyncMonitor().then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6">Đang tải...</div>;
  const cols: [string, number, string][] = [
    ["Chưa đồng bộ", data.pending, "bg-warning"],
    ["Đang đồng bộ", data.syncing, "bg-info"],
    ["Đã đồng bộ", data.synced, "bg-success"],
    ["Thất bại", data.failed, "bg-danger"],
  ];
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Giám sát đồng bộ</h1>
      <Reveal delay={60}>
      <div className="bg-white shadow-sm rounded-xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-4 gap-4 hover:shadow-md transition-shadow">
        {cols.map(([k, v, c], i) => (
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
        Lần đồng bộ gần nhất: {data.last_sync ? parseServerTime(data.last_sync).toLocaleString("vi-VN") : "Chưa có"}
      </p>
    </div>
  );
}
