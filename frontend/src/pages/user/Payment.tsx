import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Copy, Check, Clock, Crown } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { getPaymentInfo, sendPaymentRequest } from "../../lib/payment";
import { refreshUser } from "../../lib/auth";
import { formatVND } from "../../lib/formatVND";
import { Button } from "../../components/ui/Button";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function PaymentPage() {
  const nav = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    getPaymentInfo().then(setInfo).catch((e: any) => setErr(e.message));
  }, []);

  // Polling: admin duyệt xong là hiện ngay, không cần đăng nhập lại
  useEffect(() => {
    if (!sent || approved) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${API}/subscription/me`, { headers: { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` } });
        if (!r.ok) return;
        const d = await r.json();
        if (d.plan && d.plan !== "FREE") {
          await refreshUser();
          setApproved(true);
          clearInterval(id);
        }
      } catch { /* thử lại kỳ sau */ }
    }, 5000);
    return () => clearInterval(id);
  }, [sent, approved]);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1500); }
    catch { /* bỏ qua */ }
  };

  const send = async () => {
    setSending(true); setErr("");
    try { await sendPaymentRequest(); setSent(true); }
    catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  };

  if (err && !info) return <div className="p-8 text-center text-danger">{err}</div>;
  if (!info) return <div className="p-8"><div className="h-64 bg-white rounded-modal animate-pulse" /></div>;

  const row = (label: string, value: string, key: string) => (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-0 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium flex items-center gap-2">
        {value}
        <button onClick={() => copy(value, key)} aria-label={`Sao chép ${label}`} className="w-8 h-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-text-secondary active:scale-95 transition-all">
          {copied === key ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        </button>
      </span>
    </div>
  );

  return (
    <div className="max-w-[560px] mx-auto p-4 lg:p-8 pb-20 lg:pb-8">
      <h1 className="text-xl font-bold mb-4">Thanh toán Premium</h1>
      <div className="bg-gradient-to-br from-primary to-[#FF8A5C] rounded-modal p-6 text-white text-center animate-fade-in">
        <p className="text-sm opacity-90">Gói Premium / tháng</p>
        <p className="text-3xl font-bold mt-1">{formatVND(info.amount)}</p>
      </div>

      {!info.configured ? (
        <Reveal delay={100}>
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 mt-4 text-center text-sm text-text-secondary">
          Admin chưa cấu hình tài khoản nhận. Vui lòng quay lại sau.
        </div>
        </Reveal>
      ) : (
        <Reveal delay={100}>
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 mt-4 animate-slide-up hover:shadow-md transition-shadow">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2"><QrCode size={18} className="text-primary" /> Quét mã để chuyển khoản</p>
          <img src={info.qr_url} alt="Mã QR thanh toán" className="w-56 h-56 mx-auto rounded-lg border border-border object-contain" loading="lazy" />
          <div className="mt-4">
            {row("Ngân hàng", info.bank_id, "bank")}
            {row("Số tài khoản", info.account_no, "acc")}
            {row("Chủ tài khoản", info.account_name, "name")}
            {row("Số tiền", formatVND(info.amount), "amount")}
            {row("Nội dung", info.code, "code")}
          </div>
          <p className="text-xs text-text-secondary mt-3 text-center">
            Nội dung chuyển khoản <b className="text-primary">{info.code}</b> là mã riêng của tài khoản bạn — nhớ ghi đúng để admin duyệt nhanh.
          </p>
          {approved ? (
            <div className="mt-4 animate-pop">
              <div className="p-3 rounded-md bg-green-50 border border-success/30 text-sm text-center flex items-center justify-center gap-2 text-success font-medium">
                <Crown size={16} /> Admin đã duyệt — bạn là Premium!
              </div>
              <Button className="w-full mt-3" onClick={() => nav("/")}>Về trang chủ</Button>
            </div>
          ) : sent ? (
            <div className="mt-4 p-3 rounded-md bg-[#FEF3C7] border border-warning/30 text-sm text-center flex items-center justify-center gap-2 animate-fade-in">
              <Clock size={16} className="animate-spin" style={{ animationDuration: "3s" }} /> Đã gửi yêu cầu — trang tự cập nhật khi admin duyệt, không cần tải lại.
            </div>
          ) : (
            <Button className="w-full mt-4" loading={sending} onClick={send}>Tôi đã chuyển khoản</Button>
          )}
          {err && <p className="text-sm text-danger mt-2 text-center">{err}</p>}
        </div>
        </Reveal>
      )}
    </div>
  );
}
