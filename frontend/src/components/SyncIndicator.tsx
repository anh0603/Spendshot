import { useSync } from "../hooks/useSync";
import { parseServerTime } from "../lib/time";

export function SyncIndicator() {
  const { queue, lastSync } = useSync();
  const pending = queue.filter((q:any)=>q.status==="PENDING").length;
  const failed = queue.filter((q:any)=>q.status==="FAILED").length;
  const syncing = queue.filter((q:any)=>q.status==="SYNCING").length;
  if (failed>0) return <span className="text-xs px-2 py-1 rounded-full bg-[#FEF2F2] text-danger flex items-center gap-1">Chưa đồng bộ • {failed} thất bại <button onClick={()=>location.reload()} className="ml-1 underline">Thử lại</button></span>;
  if (syncing>0) return <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-info">Đang đồng bộ...</span>;
  if (pending>0) return <span className="text-xs px-2 py-1 rounded-full bg-[#FEF3C7] text-warning">{pending} chưa đồng bộ</span>;
  return <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-success flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success"/> Đã đồng bộ {lastSync? `• ${parseServerTime(lastSync).toLocaleTimeString("vi-VN")}`:""}</span>;
}
