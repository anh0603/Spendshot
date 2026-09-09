import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ShieldCheck, BadgeCheck, Hand, Camera, Crown, Pencil, Lock } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { FilePicker } from "../../components/ui/FilePicker";
import { getUser, logout, updateMe, changePassword } from "../../lib/auth";
import { photoUrl } from "../../lib/photo";
import { listJars } from "../../lib/jar";
import { listExpenses } from "../../lib/expense";
import { Button } from "../../components/ui/Button";

export function ProfilePage() {
  const nav = useNavigate();
  const [user, setUser] = useState(getUser());
  const [stats, setStats] = useState({ jars: 0, expenses: 0 });
  const [confirm, setConfirm] = useState(false);
  // Sửa tên + avatar
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // photoUrl tự kèm ?token= vì /uploads yêu cầu JWT
  const [avatarPreview, setAvatarPreview] = useState(photoUrl(user?.avatar));
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  // Đổi mật khẩu
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  // Thông báo mặc định BẬT, không chỉnh ở đây — tắt (nếu cần) do Admin thực hiện.

  useEffect(() => {
    (async () => {
      try {
        const jars = await listJars();
        let totalExp = 0;
        for (const j of jars.slice(0, 5)) {
          try { const exps = await listExpenses(j.id); totalExp += exps.length; } catch { /* bỏ qua */ }
        }
        setStats({ jars: jars.length, expenses: totalExp });
      } catch { /* offline — giữ 0 */ }
    })();
  }, []);

  const doLogout = () => {
    logout();
    nav("/welcome");
  };

  const pickAvatar = (f: File | null) => {
    if (!f) { setAvatarFile(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setSaveMsg("Ảnh không hợp lệ (jpg/png/webp)"); return; }
    if (f.size > 2 * 1024 * 1024) { setSaveMsg("Ảnh vượt quá 2MB"); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
    setSaveMsg("");
  };

  const saveProfile = async () => {
    if (!name.trim()) { setSaveMsg("Tên không được để trống"); return; }
    setSaving(true); setSaveMsg("");
    try {
      const u = await updateMe({ name: name.trim(), ...(avatarFile ? { avatar: avatarFile } : {}) });
      setUser(u);
      setAvatarFile(null);
      setAvatarPreview(photoUrl(u.avatar));
      setEditing(false);
      setSaveMsg("Đã lưu thông tin");
    } catch (e: any) { setSaveMsg(e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    setPwMsg(""); setPwErr("");
    if (next.length < 6) { setPwErr("Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    if (next !== next2) { setPwErr("Nhập lại mật khẩu không khớp"); return; }
    try {
      await changePassword(cur, next);
      setPwMsg("Đã đổi mật khẩu");
      setCur(""); setNext(""); setNext2("");
    } catch (e: any) { setPwErr(e.message); }
  };

  if (!user) return null;
  const isPremium = user.role !== "FREE";
  const displayName = user.name || user.email.split("@")[0];

  return (
    <div className="max-w-[1000px] mx-auto p-4 lg:p-8 pb-20 lg:pb-8">
      <h1 className="text-xl font-bold mb-4 hidden lg:block">Hồ sơ cá nhân</h1>
      <div className="bg-gradient-to-br from-primary to-[#FF8A5C] rounded-modal p-6 text-white flex items-center gap-4 animate-fade-in">
        <div className="relative shrink-0">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Ảnh đại diện" className="w-20 h-20 rounded-full object-cover border-2 border-white" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-3xl font-bold">
              {displayName[0].toUpperCase()}
            </div>
          )}
          <button onClick={() => setEditing(true)} aria-label="Đổi ảnh đại diện" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shadow active:scale-95 transition-transform">
            <Camera size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg truncate">{displayName}</p>
          <p className="text-xs opacity-80 truncate">{user.email}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${isPremium ? "bg-white text-primary" : "bg-white/20"}`}>
            {isPremium ? (
              <span className="flex items-center gap-1"><Crown size={12} strokeWidth={2}/> PREMIUM</span>
            ) : "FREE"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <Reveal delay={0}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 text-center border-t-4 hover:-translate-y-0.5 hover:shadow-md transition-all" style={{borderTopColor: "#FF6B35"}}>
          <p className="text-2xl font-bold text-primary">{stats.jars}</p>
          <p className="text-xs text-text-secondary mt-1">Hũ ngân sách</p>
        </div>
        </Reveal>
        <Reveal delay={80}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 text-center border-t-4 hover:-translate-y-0.5 hover:shadow-md transition-all" style={{borderTopColor: "#3B82F6"}}>
          <p className="text-2xl font-bold text-info">{stats.expenses}</p>
          <p className="text-xs text-text-secondary mt-1">Khoản chi</p>
        </div>
        </Reveal>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start mt-4">
      <Reveal delay={0}>
      <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] divide-y divide-gray-100 hover:shadow-md transition-shadow">
        <div className="px-4 min-h-[56px] py-2 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center shrink-0"><Mail size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Email</span>
          <span className="text-text-secondary text-xs truncate">{user.email}</span>
        </div>
        <div className="px-4 min-h-[56px] py-2 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-green-50 text-success flex items-center justify-center shrink-0"><ShieldCheck size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Vai trò</span>
          <span className="text-text-secondary text-xs">{user.role}</span>
        </div>
        <div className="px-4 min-h-[56px] py-2 flex items-center gap-3 text-sm">
          <span className="w-8 h-8 rounded-full bg-blue-50 text-info flex items-center justify-center shrink-0"><BadgeCheck size={17} strokeWidth={1.8}/></span>
          <span className="flex-1">Trạng thái</span>
          <span className="text-text-secondary text-xs">Hoạt động</span>
        </div>
        <button onClick={() => { setEditing((v) => !v); setSaveMsg(""); setName(user.name || ""); }} className="w-full px-4 min-h-[56px] flex items-center gap-3 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all text-left">
          <span className="w-8 h-8 rounded-full bg-[#FEF3C7] text-warning flex items-center justify-center shrink-0"><Pencil size={17} strokeWidth={1.8}/></span>
          <span className="flex-1 font-medium">Sửa tên / ảnh đại diện</span>
          <span className="text-text-secondary">{editing ? "▲" : "▼"}</span>
        </button>
        {editing && (
          <form onSubmit={(e)=>{ e.preventDefault(); saveProfile(); }} className="p-4 flex flex-col gap-3 animate-slide-up">
            <label className="text-sm font-medium">Tên hiển thị</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" maxLength={50} className="h-11 px-3 border-0 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <label className="text-sm font-medium">Ảnh đại diện (jpg/png/webp, tối đa 2MB)</label>
            <FilePicker onPick={pickAvatar} placeholder="Chọn ảnh đại diện..." />
            {saveMsg && <p className="text-sm text-text-secondary">{saveMsg}</p>}
            <Button type="submit" loading={saving}>Lưu thay đổi</Button>
          </form>
        )}
      </div>
      </Reveal>

      <Reveal delay={100}>
      <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-4 lg:mt-0 p-4 hover:shadow-md transition-shadow">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Lock size={17} className="text-primary"/> Đổi mật khẩu</h3>
        <form onSubmit={(e)=>{ e.preventDefault(); savePassword(); }} className="flex flex-col gap-3">
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Mật khẩu hiện tại" className="h-11 px-3 border-0 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Mật khẩu mới (ít nhất 6 ký tự)" className="h-11 px-3 border-0 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="h-11 px-3 border-0 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {pwErr && <p className="text-sm text-danger">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-success">{pwMsg}</p>}
          <Button type="submit" variant="secondary">Đổi mật khẩu</Button>
        </form>
      </div>
      </Reveal>
      </div>

      <Reveal delay={150}>
      <div className="lg:max-w-md lg:mx-auto">
      <button onClick={() => setConfirm(true)} className="w-full mt-6 h-12 rounded-button bg-transparent border border-red-500 text-red-500 font-semibold hover:bg-red-50 hover:shadow-md active:scale-[0.97] transition-all">Đăng xuất</button>
      </div>
      </Reveal>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setConfirm(false)} />
          <div className="relative bg-white rounded-modal p-6 w-full max-w-[360px] text-center animate-scale-in">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-light text-primary flex items-center justify-center"><Hand size={26} strokeWidth={1.8}/></div>
            <h3 className="font-bold">Đăng xuất?</h3>
            <p className="text-sm text-text-secondary mt-2">Dữ liệu local trên thiết bị vẫn được giữ lại.</p>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Hủy</Button>
              <Button variant="danger" className="flex-1" onClick={doLogout}>Đăng xuất</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
