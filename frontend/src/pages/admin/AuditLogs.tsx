import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";
import { parseServerTime } from "../../lib/time";
import { getAudit } from "../../lib/admin";
export function AuditLogs(){
  const [data,setData]=useState<any>(null);
  const [action,setAction]=useState("");
  useEffect(()=>{ getAudit().then(setData); },[]);
  const actions = [...new Set((data?.logs || []).map((l: any) => l.action))] as string[];
  const logs = (data?.logs || []).filter((l: any) => !action || l.action === action);
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Nhật ký kiểm toán</h1>
      <div className="flex gap-2 mb-4">
        <select value={action} onChange={(e)=>setAction(e.target.value)} className="h-10 px-3 border-0 rounded-lg bg-white shadow-sm text-sm focus:outline-none">
          <option value="">Tất cả hành động</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <Reveal delay={60}>
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto hover:shadow-md transition-shadow">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Thời gian</th><th className="px-4 py-3 text-left">Quản trị viên</th><th className="px-4 py-3">Hành động</th><th className="px-4 py-3">Đối tượng</th><th className="px-4 py-3">Kết quả</th></tr></thead>
          <tbody>
            {logs.map((l:any,i:number)=>(
              <tr key={i} className="border-b border-slate-100 hover:bg-gray-50 transition-colors"><td className="px-4 py-4">{parseServerTime(l.time).toLocaleString("vi-VN")}</td><td className="px-4 py-4">{l.admin}</td><td className="px-4 py-4">{l.action}</td><td className="px-4 py-4">{l.target}</td><td className="px-4 py-4">{l.result}</td></tr>
            ))}
            {logs.length===0 && <tr><td colSpan={5} className="p-8 text-center text-text-secondary">Chưa có log</td></tr>}
          </tbody>
        </table>
      </div>
      </Reveal>
    </div>
  );
}
