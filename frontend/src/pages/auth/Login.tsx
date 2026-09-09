import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { AuthSplit } from "../../components/auth/AuthSplit";
import { login, saveAuth, redirectByRole } from "../../lib/auth";
import { isValidEmail, normalizeEmail } from "../../lib/validateEmail";

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const norm = normalizeEmail(email);
    if (!isValidEmail(norm)) {
      setError("Chỉ chấp nhận @gmail.com");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }
    setLoading(true);
    try {
      const data = await login(norm, password);
      saveAuth(data.access_token, data.user);
      nav(redirectByRole(data.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Email hoặc mật khẩu không chính xác");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplit>
      <h1 className="text-2xl font-bold mb-2">Đăng nhập</h1>
      <p className="text-sm text-text-secondary mb-6">Chào mừng trở lại!</p>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="ban@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Mật khẩu" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="p-3 bg-[#FEF2F2] border border-danger/20 rounded-md text-sm text-danger">{error}</div>}
        <Button type="submit" loading={loading} className="w-full">Đăng nhập</Button>
        <Link to="/register" className="text-sm text-center text-primary">Chưa có tài khoản? Đăng ký</Link>
        <Link to="/welcome" className="text-sm text-center text-text-secondary">← Về trang chào mừng</Link>
      </form>
    </AuthSplit>
  );
}
