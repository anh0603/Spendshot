import { useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Logo } from "./ui/Logo";
import { needsAddToHomeScreen } from "../lib/notifications";

export function PWAInstallBanner(){
  const [prompt, setPrompt] = useState<any>(null);
  const promptRef = useRef<any>(null);
  const [dismissed, setDismissed] = useState(localStorage.getItem("pwa_dismiss")==="1");

  useEffect(()=>{
    const handler = (e:any)=>{ e.preventDefault(); promptRef.current = e; setPrompt(e); };
    // Nút "Cài đặt" ở trang chào mừng kích hoạt install ngay
    const trigger = async ()=>{
      setDismissed(false);
      try { localStorage.removeItem("pwa_dismiss"); } catch { /* bỏ qua */ }
      const p = promptRef.current;
      if (p) {
        try { await p.prompt(); } catch { /* bỏ qua */ } finally { promptRef.current = null; setPrompt(null); }
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("spendshot:install", trigger);
    return ()=> {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("spendshot:install", trigger);
    };
  },[]);

  if (dismissed || !prompt) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 bg-white border border-border rounded-lg shadow-lg p-4 flex items-center gap-3 z-40 max-w-sm">
      <Logo size={40} />
      <div className="flex-1">
        <p className="text-sm font-medium">Thêm SpendShot vào màn hình chính</p>
        <p className="text-xs text-text-secondary">Truy cập nhanh, hoạt động offline</p>
      </div>
      <button onClick={async()=>{ try{ await prompt.prompt(); }catch{/* bỏ qua */}finally{ setPrompt(null); } }} className="px-4 h-9 bg-primary text-white rounded-md text-sm font-medium">Cài đặt</button>
      <button onClick={()=>{ setDismissed(true); localStorage.setItem("pwa_dismiss","1"); }} aria-label="Đóng" className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-gray-100 rounded-full active:scale-95 transition-all"><X size={18} strokeWidth={1.8}/></button>
    </div>
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export function PushPermissionModal({ open, onClose }: { open:boolean; onClose:()=>void }){
  const [status, setStatus]=useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [busy, setBusy]=useState(false);
  if(!open) return null;
  const close = ()=>{
    try{ localStorage.setItem("push_decided","1"); }catch{/* bỏ qua */}
    onClose();
  };
  const request = async()=>{
    if(busy) return;
    setBusy(true);
    try{
      if(typeof Notification === "undefined"){ return; }
      const p = await withTimeout(Notification.requestPermission(), 10000);
      setStatus(p);
      if(p==="granted" && "serviceWorker" in navigator){
        try{
          // Lấy VAPID key từ backend — chưa có key thì bỏ qua subscribe (tránh treo)
          const API=import.meta.env.VITE_API_URL||"http://localhost:8000";
          let vapidKey = "";
          try{
            const vr = await withTimeout(fetch(`${API}/push/vapid`), 8000);
            if(vr.ok) vapidKey = (await vr.json()).public_key || "";
          }catch{/* backend chưa sẵn sàng — bỏ qua subscribe */}
          if(vapidKey){
            const reg = await withTimeout(navigator.serviceWorker.ready, 10000);
            const sub = await withTimeout(
              reg.pushManager.getSubscription().then((s) => s || reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(vapidKey)})),
              15000
            );
            await withTimeout(fetch(`${API}/notifications/push/subscribe`, {method:"POST", headers:{Authorization:`Bearer ${localStorage.getItem("spendshot_token")}`, "Content-Type":"application/json"}, body: JSON.stringify({...sub.toJSON(), user_agent: navigator.userAgent})}), 8000);
          }
        }catch{/* subscribe thất bại vẫn đóng modal */}
      }
    }catch{/* requestPermission lỗi vẫn đóng modal */}
    finally{
      setBusy(false);
      close();
    }
  };
  function urlBase64ToUint8Array(base64String:string){
    const padding="=".repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
    const raw=atob(base64);
    const out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
    return out;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close}/>
      <div className="relative bg-white rounded-modal p-6 w-full max-w-[400px] text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-light text-primary flex items-center justify-center animate-pop"><BellRing size={26} strokeWidth={1.8}/></div>
        <h3 className="font-bold">Bật thông báo?</h3>
        {needsAddToHomeScreen() ? (
          <>
            <p className="text-sm text-text-secondary mt-2">Để nhận thông báo trên iPhone, hãy thêm SpendShot vào Màn hình chính trước (nút Chia sẻ → Thêm vào MH chính), rồi mở app từ MH chính để bật.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={close} className="flex-1 h-11 bg-primary text-white rounded-button font-medium">Đã hiểu</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary mt-2">Nhận cảnh báo vượt ngân sách, nhắc nhở hàng ngày, đồng bộ.</p>
        <div className="flex gap-3 mt-6">
          <button onClick={close} disabled={busy} className="flex-1 h-11 border rounded-button disabled:opacity-40">Để sau</button>
          <button onClick={request} disabled={busy} className="flex-1 h-11 bg-primary text-white rounded-button font-medium disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {busy ? "Đang bật..." : "Bật"}
          </button>
        </div>
        <p className="text-xs text-text-secondary mt-2">Trạng thái: {status}</p>
          </>
        )}
      </div>
    </div>
  );
}
