import { useEffect, useRef, useState } from "react";
import { X, SwitchCamera, Image as ImageIcon, RotateCcw, Camera as CameraIcon, Ban } from "lucide-react";
import { Button } from "../ui/Button";

function friendlyError(e: any): string {
  const name = e?.name || "";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Không tìm thấy camera trên thiết bị này. Bạn vẫn có thể thêm khoản chi không cần ảnh.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Bạn đã chặn quyền camera. Hãy bấm biểu tượng 🔒 trên thanh địa chỉ để cấp quyền, rồi thử lại.";
  if (name === "NotReadableError")
    return "Camera đang bận (có thể do ứng dụng khác dùng). Hãy đóng app khác rồi thử lại.";
  return "Không thể mở camera. Bạn vẫn có thể thêm khoản chi không cần ảnh.";
}

export function CameraOverlay({ onCapture, onClose, onGallery, onSkip }: { onCapture: (file: File)=>void; onClose: ()=>void; onGallery?: ()=>void; onSkip?: ()=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(false);
  const [captureErr, setCaptureErr] = useState("");
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user"|"environment">("environment");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(()=>{
    let stream: MediaStream;
    let alive = true;
    async function start(){
      setErr("");
      try{
        if (!navigator.mediaDevices?.getUserMedia) throw { name: "SecurityError" };
        // Xin độ phân giải cao để ảnh chụp nét (trình duyệt tự chọn mức gần nhất).
        // facingMode để ideal để máy không có camera sau vẫn mở được camera trước.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (alive && videoRef.current) videoRef.current.srcObject = stream;
      } catch(e:any){ if (alive) setErr(friendlyError(e)); }
    }
    start();
    return ()=> { alive = false; stream?.getTracks().forEach(t=>t.stop()); };
  }, [facing, retryKey]);

  const capture = ()=>{
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0 || v.videoHeight === 0) {
      setCaptureErr("Chưa chụp được — camera chưa sẵn sàng, đợi 1 giây rồi thử lại.");
      return;
    }
    setCaptureErr("");
    // Hiệu ứng chớp flash khi chụp
    setFlash(true);
    setTimeout(()=>setFlash(false), 250);
    c.width = v.videoWidth; c.height = v.videoHeight;
    try {
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v,0,0);
    } catch {
      setCaptureErr("Chụp thất bại — hãy thử lại.");
      return;
    }
    c.toBlob(b=>{
      if(b){ const f=new File([b], "capture.jpg", {type:"image/jpeg"}); onCapture(f); }
      else setCaptureErr("Chụp thất bại — hãy thử lại.");
    },"image/jpeg",0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {flash && <div className="absolute inset-0 bg-white z-10 animate-flash pointer-events-none" />}
      <div className="flex justify-between p-4 text-white shrink-0">
        <button onClick={onClose} aria-label="Đóng camera" className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all">
          <X size={22} />
        </button>
        {!err && (
          <button onClick={()=>setFacing(f=>f==="environment"?"user":"environment")} aria-label="Đổi camera" className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all">
            <SwitchCamera size={22} />
          </button>
        )}
      </div>
      {err ? (
        <div className="flex-1 min-h-0 overflow-auto flex flex-col items-center justify-center p-6 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/70 mb-4">
            <Ban size={28} />
          </div>
          <p className="text-white text-sm max-w-xs">{err}</p>
          <div className="flex flex-col gap-3 w-full max-w-xs mt-6">
            <Button className="w-full" onClick={()=>setRetryKey(k=>k+1)}>
              <span className="flex items-center gap-2"><RotateCcw size={18}/> Thử lại</span>
            </Button>
            {onSkip && (
              <button onClick={onSkip} className="w-full h-11 rounded-button border border-white/30 text-white text-sm font-medium hover:bg-white/10 active:scale-[0.97] transition-all">
                Thêm không cần ảnh
              </button>
            )}
          </div>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted onCanPlay={()=>setReady(true)} className="flex-1 min-h-0 min-w-0 w-full object-cover md:object-contain bg-black" />
      )}
      <canvas ref={canvasRef} className="hidden"/>
      {!err && (
        <div className="flex flex-col bg-black shrink-0">
          {captureErr && <p className="text-center text-xs text-[#FCA5A5] px-6 pt-2">{captureErr}</p>}
          <div className="flex justify-around items-center p-6">
            {onGallery ? (
              <button onClick={onGallery} aria-label="Chọn ảnh từ thư viện" className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition-all">
                <ImageIcon size={22} />
              </button>
            ) : <div className="w-12"/>}
            <button onClick={capture} disabled={!ready} aria-label="Chụp ảnh" className="w-[72px] h-[72px] rounded-full bg-white border-4 border-primary flex items-center justify-center hover:scale-105 active:scale-90 transition-transform shadow-lg disabled:opacity-50 disabled:scale-100">
              <CameraIcon size={28} className="text-primary" />
            </button>
            <div className="w-12"/>
          </div>
        </div>
      )}
    </div>
  );
}

export function PremiumUpsell({ onClose, onUpgrade }: { onClose:()=>void; onUpgrade:()=>void}) {
  return (
    <div className="p-6 text-center animate-slide-up">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary to-[#FFB088] flex items-center justify-center text-white">
        <ImageIcon size={22} />
      </div>
      <h3 className="font-bold text-lg">Gallery dành cho Premium</h3>
      <p className="text-sm text-text-secondary mt-2">Nâng cấp để chọn ảnh từ thư viện, không quảng cáo và nhiều tính năng hơn.</p>
      <ul className="text-sm text-left mt-4 space-y-2">
        <li>✓ Chọn ảnh từ thư viện</li>
        <li>✓ Không quảng cáo</li>
        <li>✓ Thống kê nâng cao</li>
        <li>✓ Sắp ra mắt</li>
      </ul>
      <Button className="w-full mt-6" onClick={onUpgrade}>Nâng cấp Premium - 19.000 ₫/tháng</Button>
      <button onClick={onClose} className="w-full mt-3 text-sm text-text-secondary">Để sau</button>
    </div>
  );
}
