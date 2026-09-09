const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: string;
  status: string;
}

export async function register(email: string, password: string) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Đăng ký thất bại");
  return data;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Đăng nhập thất bại");
  return data;
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Token không hợp lệ");
  return data;
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem("spendshot_token", token);
  localStorage.setItem("spendshot_user", JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem("spendshot_token");
}

export function getUser(): User | null {
  const s = localStorage.getItem("spendshot_user");
  return s ? JSON.parse(s) : null;
}

export function logout() {
  localStorage.removeItem("spendshot_token");
  localStorage.removeItem("spendshot_user");
}

/** Lấy thông tin mới nhất từ server (role sau khi admin duyệt/hạ cấp, tên mới...) */
export async function refreshUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const user = await getMe(token);
    localStorage.setItem("spendshot_user", JSON.stringify(user));
    return user;
  } catch {
    return getUser();
  }
}

export async function updateMe(data: { name?: string; avatar?: File }): Promise<User> {
  const fd = new FormData();
  if (data.name !== undefined) fd.append("name", data.name);
  if (data.avatar) fd.append("avatar", data.avatar);
  const res = await fetch(`${API}/auth/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || "Cập nhật thất bại");
  localStorage.setItem("spendshot_user", JSON.stringify(d));
  try { window.dispatchEvent(new CustomEvent("spendshot:user-updated")); } catch { /* bỏ qua */ }
  return d;
}

export async function changePassword(current: string, next: string) {
  const res = await fetch(`${API}/auth/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: current, new_password: next }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.detail || "Đổi mật khẩu thất bại");
  return d;
}

export function redirectByRole(role: string): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  return "/";
}
