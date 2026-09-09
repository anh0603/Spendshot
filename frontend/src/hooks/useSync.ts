import { useEffect, useState, useCallback, useRef } from "react";
import { db } from "../db";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function auth(){ return localStorage.getItem("spendshot_token")||""; }

export function useSync() {
  const [queue, setQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem("last_sync"));

  const refresh = useCallback(async ()=> setQueue(await db.syncQueue.toArray()), []);

  const push = useCallback(async ()=>{
    const items = await db.syncQueue.where("status").anyOf(["PENDING","FAILED"]).toArray();
    if (items.length===0) return;
    for (const it of items) if(it.id) await db.syncQueue.update(it.id,{status:"SYNCING"});
    await refresh();
    const expenses = items.filter(i=>i.entity==="expense").map(i=> i.payload);
    const jars = items.filter(i=>i.entity==="jar").map(i=> i.payload);
    try{
      const r = await fetch(`${API}/sync/push`, { method:"POST", headers:{Authorization:`Bearer ${auth()}`, "Content-Type":"application/json"}, body: JSON.stringify({ expenses, jars })});
      await r.json();
      if (r.ok) {
        for (const it of items) if(it.id) await db.syncQueue.update(it.id,{status:"SYNCED"});
        // pull after push
        const pr = await fetch(`${API}/sync/pull`, { headers:{Authorization:`Bearer ${auth()}`}});
        if(pr.ok){
          const pd = await pr.json();
          const u=JSON.parse(localStorage.getItem("spendshot_user")||"null");
          for(const j of pd.jars||[]) await db.jars.put({...j, user_id:u?.id||"", sync_status:"SYNCED"});
          for(const e of pd.expenses||[]) await db.expenses.put({...e, user_id:u?.id||"", sync_status:"SYNCED"});
          const ts = pd.timestamp || new Date().toISOString();
          localStorage.setItem("last_sync", ts);
          setLastSync(ts);
        }
      } else throw new Error("push failed");
    } catch {
      for (const it of items) if(it.id) await db.syncQueue.update(it.id,{status:"FAILED", retries:(it.retries||0)+1});
    }
    await refresh();
  },[refresh]);

  const pull = useCallback(async ()=>{
    try{
      const r = await fetch(`${API}/sync/pull?since=${lastSync||""}`, { headers:{Authorization:`Bearer ${auth()}`}});
      if(!r.ok) return;
      const d=await r.json();
      const u=JSON.parse(localStorage.getItem("spendshot_user")||"null");
      for(const j of d.jars||[]) await db.jars.put({...j, user_id:u?.id||"", sync_status:"SYNCED"});
      for(const e of d.expenses||[]) await db.expenses.put({...e, user_id:u?.id||"", sync_status:"SYNCED"});
      localStorage.setItem("last_sync", d.timestamp);
      setLastSync(d.timestamp);
    }catch{}
  },[lastSync]);

  const sync = useCallback(async ()=>{
    if(isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    await push();
    if(navigator.onLine) await pull();
    setIsSyncing(false);
    await refresh();
  },[isSyncing, push, pull, refresh]);

  // Effect chỉ chạy 1 lần — dùng ref để tránh vòng lặp:
  // pull() đổi lastSync → sync() mới → effect chạy lại → pull tiếp vô hạn.
  // Lịch sync thưa (1 máy 1 tài khoản): mở app, ẩn/đóng app, có việc tồn thì đẩy,
  // treo máy thì 6h kéo 1 lần. Không poll 30s để nhẹ server/pin/mạng.
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(()=>{
    refresh();
    // Mở app / có mạng lại → sync ngay
    const onOnline = ()=> syncRef.current();
    window.addEventListener("online", onOnline);
    // Ẩn/đóng app (cuối ngày) → đẩy nốt dữ liệu tồn
    const onHidden = ()=>{ if (document.visibilityState === "hidden") syncRef.current(); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onOnline);
    // Có bản ghi chờ (vừa ghi offline) → sync, kiểm tra mỗi 60s, chỉ gọi server khi có việc
    const watchId = setInterval(async ()=>{
      if (!navigator.onLine) return;
      try {
        const n = await db.syncQueue.where("status").anyOf(["PENDING","FAILED"]).count();
        if (n > 0) syncRef.current();
      } catch { /* bỏ qua */ }
    }, 60000);
    // Treo máy cả ngày → 6h kéo 1 lần cho tươi
    const pullId = setInterval(()=>{ if(navigator.onLine) pull(); }, 6 * 60 * 60 * 1000);
    // initial sync (đầu ngày)
    if(navigator.onLine) syncRef.current();
    return ()=>{
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onOnline);
      clearInterval(watchId);
      clearInterval(pullId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async (id:number)=>{ await db.syncQueue.update(id,{status:"PENDING"}); sync(); };

  return { queue, isSyncing, lastSync, sync, pull, retry, refresh };
}
