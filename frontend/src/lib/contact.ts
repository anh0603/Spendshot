const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h() { return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }

export interface ContactInfo {
  hotline: string;
  email: string;
  facebook: string;
  address: string;
}

export async function getContact(): Promise<ContactInfo> {
  const r = await fetch(`${API}/contact`);
  if (!r.ok) throw new Error("Không lấy được liên hệ");
  return r.json();
}

export async function getContactSettings(): Promise<ContactInfo> {
  const r = await fetch(`${API}/admin/contact-settings`, { headers: h() });
  if (!r.ok) throw new Error("403");
  return r.json();
}

export async function saveContactSettings(data: ContactInfo) {
  const r = await fetch(`${API}/admin/contact-settings`, {
    method: "PUT",
    headers: { ...h(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Lưu thất bại");
  return d;
}
