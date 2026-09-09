import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { parseServerTime } from "../../lib/time";
import { listUpgradeRequests, approveRequest, rejectRequest } from "../../lib/payment";
import { formatVND } from "../../lib/formatVND";

export function UpgradeRequestsPage() {
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState("PENDING");
  const [msg, setMsg] = useState("");

  const fetch = async () => {
    try { setData(await listUpgradeRequests(filter)); } catch { setData(null); }
  };
  useEffect(() => { fetch(); }, [filter]);

  const act = async (id: string, fn: (id: string) => Promise<unknown>, ok: string) => {
    setMsg("");
    try { await fn(id); setMsg(ok); fetch(); }
    catch (e: any) { setMsg(e.message); }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Duyệt Premium</h1>
      <div className="flex gap-2 mb-4">
        {["PENDING", "", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setFilter(s)}
            className={`px-3 h-9 rounded-full text-sm font-medium ${filter === s ? "bg-primary text-white" : "bg-white border border-border"}`}
          >
            {s === "PENDING" ? "Chờ duyệt" : s === "" ? "Tất cả" : s === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-text-secondary mb-3">{msg}</p>}
      {/* Mobile: thẻ gọn thay bảng */}
      <div className="md:hidden flex flex-col gap-3">
        {data?.requests?.map((r: any) => (
          <div key={r.id} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm font-medium truncate">{r.email}</p>
            <p className="text-xs mt-1">Mã code: <span className="font-mono font-bold text-primary">{r.pay_code}</span> • {formatVND(r.amount)}</p>
            {r.status === "PENDING" ? (
              <div className="flex gap-2 mt-3">
                <button onClick={() => act(r.id, approveRequest, "Đã duyệt")} className="flex-1 h-10 rounded-lg bg-success text-white text-sm font-medium active:scale-[0.98] transition-transform">Duyệt</button>
                <button onClick={() => act(r.id, rejectRequest, "Đã từ chối")} className="flex-1 h-10 rounded-lg bg-[#FEF2F2] text-danger text-sm font-medium active:scale-[0.98] transition-transform">Từ chối</button>
              </div>
            ) : (
              <p className="text-xs text-text-secondary mt-2">{r.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}</p>
            )}
          </div>
        ))}
        {data?.requests?.length === 0 && <p className="text-center text-sm text-text-secondary py-8">Không có yêu cầu nào</p>}
      </div>
      <Reveal delay={60}>
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-x-auto hover:shadow-md transition-shadow">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3">Mã code</th><th className="px-4 py-3">Số tiền</th><th className="px-4 py-3">Ngày gửi</th><th className="px-4 py-3">Hành động</th></tr></thead>
          <tbody>
            {data?.requests?.map((r: any) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4">{r.email}</td>
                <td className="px-4 py-4 text-center font-mono font-bold text-primary">{r.pay_code}</td>
                <td className="px-4 py-4 text-center">{formatVND(r.amount)}</td>
                <td className="px-4 py-4 text-center">{parseServerTime(r.created_at).toLocaleString("vi-VN")}</td>
                <td className="px-4 py-4">
                  {r.status === "PENDING" ? (
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => act(r.id, approveRequest, "Đã duyệt")} aria-label="Duyệt" className="w-9 h-9 rounded-md bg-green-50 text-success flex items-center justify-center hover:bg-success hover:text-white active:scale-95 transition-all"><Check size={18} /></button>
                      <button onClick={() => act(r.id, rejectRequest, "Đã từ chối")} aria-label="Từ chối" className="w-9 h-9 rounded-md bg-[#FEF2F2] text-danger flex items-center justify-center hover:bg-danger hover:text-white active:scale-95 transition-all"><X size={18} /></button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-secondary">{r.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}</span>
                  )}
                </td>
              </tr>
            ))}
            {data?.requests?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-text-secondary">Không có yêu cầu nào</td></tr>}
          </tbody>
        </table>
      </div>
      </Reveal>
      <p className="text-xs text-text-secondary mt-3">Đối chiếu mã code với nội dung chuyển khoản trước khi duyệt.</p>
    </div>
  );
}
