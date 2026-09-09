import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, BadgeCheck, UserPlus, TrendingUp } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { parseServerTime } from "../../lib/time";
import { getDashboard } from "../../lib/admin";
import { formatVND } from "../../lib/formatVND";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h() { return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }

/** Vòng donut FREE/PREMIUM */
function PlanDonut({ free, premium }: { free: number; premium: number }) {
  const total = Math.max(1, free + premium);
  const R = 44;
  const C = 2 * Math.PI * R;
  const premLen = (premium / total) * C;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
        <circle cx={60} cy={60} r={R} fill="none" stroke="#F3F4F6" strokeWidth={16} />
        <circle cx={60} cy={60} r={R} fill="none" stroke="#FF6B35" strokeWidth={16} strokeLinecap="round"
          strokeDasharray={`${premLen} ${C}`} transform="rotate(-90 60 60)" />
        <text x={60} y={58} textAnchor="middle" fontSize={18} fontWeight={700} fill="#111827">{Math.round((premium / total) * 100)}%</text>
        <text x={60} y={74} textAnchor="middle" fontSize={10} fill="#6B7280">Premium</text>
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> PREMIUM: <b>{premium}</b></span>
        <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> FREE: <b>{free}</b></span>
      </div>
    </div>
  );
}

export function AdminDashboard(){
  const [data,setData]=useState<any>(null);
  const [err,setErr]=useState("");
  const [months,setMonths]=useState<any[]>([]);
  const [overview,setOverview]=useState<any>(null);
  useEffect(()=>{
    getDashboard().then(setData).catch(()=>setErr("Không có quyền"));
    fetch(`${API}/admin/stats/monthly`, { headers: h() }).then((r)=>r.json()).then((d)=>setMonths(d.months||[])).catch(()=>{});
    fetch(`${API}/admin/stats/overview`, { headers: h() }).then((r)=>r.json()).then(setOverview).catch(()=>{});
  },[]);
  if(err) return <div className="p-8 text-center"><div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center"><ShieldAlert size={30} strokeWidth={1.8}/></div><p className="font-bold mt-4">403 — Không có quyền Admin</p></div>;
  if(!data) return <div className="p-8">Đang tải...</div>;
  const cards: [string, string | number, string][]=[
    ["Tổng người dùng", data.total_users, "bg-info"],
    ["Gói FREE", data.free_users, "bg-text-secondary"],
    ["Gói PREMIUM", data.premium_users, "bg-primary"],
    ["Đang hoạt động", data.active_users, "bg-success"],
    ["Bị khóa", data.suspended_users, "bg-danger"],
    ["Tổng Hũ", data.total_jars, "bg-warning"],
    ["Tổng khoản chi", data.total_expenses, "bg-info"],
    ["Dung lượng dùng", `${(data.storage_used/1024).toFixed(1)} KB`, "bg-primary"],
    ["Lỗi đồng bộ", data.sync_failures, "bg-danger"],
    ["Quảng cáo", data.ads_status === "Bật" ? "Bật" : "Tắt", "bg-success"],
  ];
  const maxUsers = Math.max(1, ...months.map((m) => m.users));
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Bảng điều khiển</h1>

      {overview && overview.pending_requests > 0 && (
        <Link to="/admin/requests" className="mb-4 p-4 rounded-xl bg-[#FEF3C7] border border-warning/30 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="w-10 h-10 rounded-full bg-warning text-white flex items-center justify-center shrink-0"><BadgeCheck size={20} /></span>
          <div>
            <p className="font-bold text-sm">Có {overview.pending_requests} yêu cầu Premium chờ duyệt</p>
            <p className="text-xs text-text-secondary">Bấm để xem và duyệt ngay →</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(([k,v,color],i)=>(
          <Reveal key={k} delay={(i % 3) * 60}>
          <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <p className="text-xs text-text-secondary">{k}</p>
            </div>
            <p className="text-xl font-bold mt-1">{v as string}</p>
          </div>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Reveal delay={0}>
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow h-full">
          <h2 className="font-semibold text-sm mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-primary" /> Người dùng mới theo tháng</h2>
          <p className="text-xs text-text-secondary mb-4">6 tháng gần nhất</p>
          {months.length === 0 ? <p className="text-sm text-text-secondary">Chưa có dữ liệu</p> : (
            <div className="flex items-end gap-2 h-36">
              {months.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="text-[10px] font-semibold text-primary">{m.users > 0 ? m.users : ""}</span>
                  <div
                    className="w-full max-w-[48px] rounded-t-lg"
                    style={{ height: `${Math.max(m.users > 0 ? 10 : 2, (m.users / maxUsers) * 100)}px`, background: "linear-gradient(to top, rgba(255,107,53,0.35), #FF6B35)" }}
                    title={`${m.users} người dùng`}
                  />
                  <span className="text-[10px] text-text-secondary">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        </Reveal>
        <Reveal delay={80}>
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow h-full">
          <h2 className="font-semibold text-sm mb-4">Tỉ lệ gói FREE / Premium</h2>
          <PlanDonut free={data.free_users} premium={data.premium_users} />
        </div>
        </Reveal>
      </div>

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Reveal delay={0}>
          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Top chi tiêu</h2>
              <Link to="/admin/users" className="text-xs text-blue-600 hover:text-blue-800 font-medium">Xem tất cả →</Link>
            </div>
            {overview.top_users.length === 0 ? <p className="text-sm text-text-secondary">Chưa có dữ liệu</p> : (
              <div className="flex flex-col">
                {overview.top_users.map((u: any, i: number) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary text-white" : "bg-gray-100 text-text-secondary"}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                      <p className="text-xs text-text-secondary">{u.expenses} khoản chi</p>
                    </div>
                    <p className="text-sm font-bold text-primary">{formatVND(u.total_spent)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          </Reveal>
          <Reveal delay={80}>
          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2"><UserPlus size={16} className="text-success" /> Người dùng mới nhất</h2>
              <Link to="/admin/users" className="text-xs text-blue-600 hover:text-blue-800 font-medium">Xem tất cả →</Link>
            </div>
            {overview.recent_users.length === 0 ? <p className="text-sm text-text-secondary">Chưa có dữ liệu</p> : (
              <div className="flex flex-col">
                {overview.recent_users.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.email}</p>
                      <p className="text-xs text-text-secondary">{parseServerTime(u.created_at).toLocaleDateString("vi-VN")}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "PREMIUM" ? "bg-primary text-white" : "bg-gray-100"}`}>{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </Reveal>
        </div>
      )}
    </div>
  );
}
