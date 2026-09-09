import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { AuthSplit } from "../../components/auth/AuthSplit";
import { isValidEmail, normalizeEmail, GMAIL_ERROR } from "../../lib/validateEmail";
import { register, saveAuth, redirectByRole } from "../../lib/auth";

export function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [confirmErr, setConfirmErr] = useState("");
  const [banner, setBanner] = useState("");
  const [loading, setLoading] = useState(false);

  const normalized = normalizeEmail(email);
  const valid = email === "" || isValidEmail(normalized);
  const liveGmailError = !valid && touched ? GMAIL_ERROR : "";

  const clearErrors = () => {
    setEmailErr("");
    setPassErr("");
    setConfirmErr("");
    setBanner("");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    // Sai dòng nào báo dòng đó
    if (!isValidEmail(normalized)) {
      setEmailErr(GMAIL_ERROR);
      return;
    }
    if (password.length < 6) {
      setPassErr("Mật khẩu phải ít nhất 6 ký tự");
      return;
    }
    if (password !== confirm) {
      setConfirmErr("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    try {
      const data = await register(normalized, password);
      saveAuth(data.access_token, data.user);
      nav(redirectByRole(data.user.role));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng ký thất bại";
      // Lỗi server liên quan email (vd "Email đã tồn tại") thì báo ngay dòng Email
      if (/email/i.test(msg)) {
        setEmailErr(msg);
      } else {
        setBanner(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Nút luôn bấm được (trừ lúc đang gọi API): sai đâu báo đó qua handleRegister.
  return (
    <AuthSplit>
      <h1 className="text-2xl font-bold mb-2">Đăng ký</h1>
      <p className="text-sm text-text-secondary mb-6">Chỉ chấp nhận @gmail.com</p>
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="ban@gmail.com" value={email} onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }} onBlur={() => setTouched(true)} error={emailErr || liveGmailError || undefined} />
        <Input label="Mật khẩu" type="password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); if (passErr) setPassErr(""); }} error={passErr || undefined} />
        <Input label="Xác nhận mật khẩu" type="password" placeholder="••••••••" value={confirm} onChange={(e) => { setConfirm(e.target.value); if (confirmErr) setConfirmErr(""); }} error={confirmErr || undefined} />
        {banner && <div className="p-3 bg-[#FEF2F2] border border-danger/20 rounded-md text-sm text-danger">{banner}</div>}
        <Button type="submit" loading={loading} className="w-full">Đăng ký</Button>
        <Link to="/login" className="text-sm text-center text-primary">Đã có tài khoản? Đăng nhập</Link>
      </form>
    </AuthSplit>
  );
}
