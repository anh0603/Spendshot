import { useEffect, useState } from "react";
import { Bell, TriangleAlert, Info, RefreshCw, Crown, BellOff } from "lucide-react";
import { listJars } from "../../lib/jar";
import { db } from "../../db";
import { formatVND } from "../../lib/formatVND";

interface Item {
  id: string;
  type: "warning" | "info" | "sync" | "premium";
  title: string;
  body: string;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [seen, setSeen] = useState<string>(() => {
    try { return localStorage.getItem("bell_seen") || ""; } catch { return ""; }
  });

  const load = async () => {
    const list: Item[] = [];
    try {
      const jars = await listJars();
      const jar = jars[0];
      if (jar) {
        const remaining = jar.budget - jar.spent;
        if (remaining < 0) {
          list.push({ id: "over", type: "warning", title: "Vượt ngân sách!", body: `Bạn đã vượt ${formatVND(Math.abs(remaining))} tháng này.` });
        } else if (jar.budget > 0 && jar.spent / jar.budget >= 0.8) {
          list.push({ id: "near", type: "warning", title: "Sắp hết Hũ", body: `Đã dùng ${Math.round((jar.spent / jar.budget) * 100)}% ngân sách.` });
        }
      }
    } catch { /* offline — bỏ qua */ }
    try {
      const pending = await db.syncQueue.where("status").anyOf(["PENDING", "FAILED"]).toArray();
      if (!navigator.onLine) {
        list.push({ id: "offline", type: "sync", title: "Đang offline", body: "Dữ liệu vẫn lưu trên thiết bị, sẽ đồng bộ khi có mạng." });
      } else if (pending.length > 0) {
        list.push({ id: "pending", type: "sync", title: "Chưa đồng bộ", body: `${pending.length} mục đang chờ đồng bộ.` });
      }
    } catch { /* bỏ qua */ }
    try {
      const u = JSON.parse(localStorage.getItem("spendshot_user") || "null");
      if (u?.role === "FREE") {
        list.push({ id: "premium", type: "premium", title: "Lên Premium", body: "Mở gallery, tắt quảng cáo chỉ 19.000 ₫/tháng." });
      }
    } catch { /* bỏ qua */ }
    setItems(list);
  };

  useEffect(() => { load(); }, [open]);

  const signature = items.map((i) => i.id).join(",");
  const unread = signature !== "" && signature !== seen;

  const toggle = () => {
    if (!open) {
      try { localStorage.setItem("bell_seen", signature); } catch { /* bỏ qua */ }
      setSeen(signature);
    }
    setOpen((v) => !v);
  };

  const iconFor = (t: Item["type"]) => {
    if (t === "warning") return <span className="w-9 h-9 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center shrink-0"><TriangleAlert size={18} strokeWidth={1.8} /></span>;
    if (t === "sync") return <span className="w-9 h-9 rounded-full bg-blue-50 text-info flex items-center justify-center shrink-0"><RefreshCw size={18} strokeWidth={1.8} /></span>;
    if (t === "premium") return <span className="w-9 h-9 rounded-full bg-[#FEF3C7] text-warning flex items-center justify-center shrink-0"><Crown size={18} strokeWidth={1.8} /></span>;
    return <span className="w-9 h-9 rounded-full bg-gray-100 text-text-secondary flex items-center justify-center shrink-0"><Info size={18} strokeWidth={1.8} /></span>;
  };

  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Thông báo" className="relative w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary hover:bg-[#FFE4D6] active:scale-95 transition-all">
        <Bell size={20} strokeWidth={1.8} />
        {unread && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger animate-pop" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-40 w-[320px] max-w-[85vw] bg-white rounded-modal border border-border shadow-lg overflow-hidden animate-scale-in">
            <p className="font-bold text-sm px-4 py-3 border-b border-border">Thông báo</p>
            <div className="max-h-[50vh] overflow-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-secondary">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center"><BellOff size={20} strokeWidth={1.8} /></div>
                  Chưa có thông báo nào
                </div>
              ) : (
                items.map((n) => (
                  <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                    {iconFor(n.type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{n.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
