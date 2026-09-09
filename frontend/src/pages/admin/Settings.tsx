import { useEffect, useState } from "react";
import { User, ShieldCheck, BellRing, HardDrive, QrCode, Phone } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { getUser } from "../../lib/auth";
import { getPaymentSettings, savePaymentSettings } from "../../lib/payment";
import { getContactSettings, saveContactSettings } from "../../lib/contact";

export function AdminSettingsPage() {
  const user = getUser();
  const [qr, setQr] = useState({ bank_id: "", account_no: "", account_name: "", amount: 19000 });
  const [qrMsg, setQrMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState({ hotline: "", email: "", facebook: "", address: "" });
  const [ctMsg, setCtMsg] = useState("");
  const [ctSaving, setCtSaving] = useState(false);

  useEffect(() => {
    getPaymentSettings().then((d) => setQr({ bank_id: d.bank_id || "", account_no: d.account_no || "", account_name: d.account_name || "", amount: d.amount || 19000 })).catch(() => {});
    getContactSettings().then((d) => setContact({ hotline: d.hotline || "", email: d.email || "", facebook: d.facebook || "", address: d.address || "" })).catch(() => {});
  }, []);

  const saveQr = async () => {
    setSaving(true); setQrMsg("");
    try {
      const d = await savePaymentSettings(qr);
      setQr({ bank_id: d.bank_id, account_no: d.account_no, account_name: d.account_name, amount: d.amount });
      setQrMsg("Đã lưu mã QR ngân hàng");
    } catch (e: any) { setQrMsg(e.message); }
    finally { setSaving(false); }
  };

  const saveContact = async () => {
    setCtSaving(true); setCtMsg("");
    try {
      const d = await saveContactSettings(contact);
      setContact({ hotline: d.hotline, email: d.email, facebook: d.facebook, address: d.address });
      setCtMsg("Đã lưu thông tin liên hệ");
    } catch (e: any) { setCtMsg(e.message); }
    finally { setCtSaving(false); }
  };

  return (
    <div className="p-6 lg:max-w-[1000px]">
      <h1 className="text-xl font-bold mb-4">Cài đặt</h1>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      <div className="flex flex-col gap-4">
      <Reveal delay={0}>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 hover:shadow-md transition-shadow">
        <div className="px-4 h-14 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center"><User size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Tài khoản quản trị</span>
          <span className="text-text-secondary text-xs">{user?.email}</span>
        </div>
        <div className="px-4 h-14 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-blue-50 text-info flex items-center justify-center"><ShieldCheck size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Vai trò</span>
          <span className="text-text-secondary text-xs">{user?.role}</span>
        </div>
        <div className="px-4 h-14 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-green-50 text-success flex items-center justify-center"><BellRing size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Thông báo hệ thống</span>
          <span className="text-text-secondary text-xs">Đang bật</span>
        </div>
        <div className="px-4 h-14 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-[#FEF3C7] text-warning flex items-center justify-center"><HardDrive size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Phiên bản</span>
          <span className="text-text-secondary text-xs">SpendShot 1.0</span>
        </div>
      </div>
      </Reveal>

      <Reveal delay={150}>
      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 mt-4 hover:shadow-md transition-shadow">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Phone size={17} className="text-primary"/> Thông tin liên hệ trang chào mừng</h3>
        <p className="text-xs text-text-secondary mb-3">Hiện ở mục Liên hệ cho khách chưa đăng nhập xem.</p>
        <form onSubmit={(e)=>{ e.preventDefault(); saveContact(); }} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Hotline</label>
            <input value={contact.hotline} onChange={(e) => setContact({ ...contact, hotline: e.target.value })} placeholder="VD: 0901234567" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="VD: hotro@spendshot.vn" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Facebook</label>
            <input value={contact.facebook} onChange={(e) => setContact({ ...contact, facebook: e.target.value })} placeholder="VD: fb.com/spendshot" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Địa chỉ</label>
            <input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} placeholder="VD: Hà Nội" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          {ctMsg && <p className="text-sm text-text-secondary">{ctMsg}</p>}
          <button type="submit" disabled={ctSaving} className="h-11 rounded-lg bg-orange-500 text-white font-semibold shadow-md hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60">Lưu liên hệ</button>
        </form>
      </div>
      </Reveal>
      </div>

      <div className="flex flex-col gap-4 mt-4 lg:mt-0">
      <Reveal delay={100}>
      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 hover:shadow-md transition-shadow">
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><QrCode size={17} className="text-primary"/> Mã QR ngân hàng nhận Premium</h3>
        <p className="text-xs text-text-secondary mb-3">QR trang thanh toán tạo từ thông tin này. Mã ngân hàng VD: MB, VCB, TCB, ACB...</p>
        <form onSubmit={(e)=>{ e.preventDefault(); saveQr(); }} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Ngân hàng</label>
            <input value={qr.bank_id} onChange={(e) => setQr({ ...qr, bank_id: e.target.value })} placeholder="Mã ngân hàng (VD: MB)" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số tài khoản</label>
            <input value={qr.account_no} onChange={(e) => setQr({ ...qr, account_no: e.target.value })} placeholder="Số tài khoản" inputMode="numeric" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Chủ tài khoản</label>
            <input value={qr.account_name} onChange={(e) => setQr({ ...qr, account_name: e.target.value })} placeholder="Chủ tài khoản (không dấu)" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số tiền (₫)</label>
            <input value={qr.amount} onChange={(e) => setQr({ ...qr, amount: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0 })} placeholder="Số tiền (₫)" inputMode="numeric" className="w-full h-11 px-4 border-0 rounded-xl bg-slate-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          {qrMsg && <p className="text-sm text-text-secondary">{qrMsg}</p>}
          <button type="submit" disabled={saving} className="h-11 rounded-lg bg-orange-500 text-white font-semibold shadow-md hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60">Lưu mã QR</button>
        </form>
      </div>
      </Reveal>
      </div>
    </div>
    </div>
  );
}
