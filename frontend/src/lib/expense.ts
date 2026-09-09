const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` };
}
export async function listExpenses(jarId?: string) {
  const url = jarId ? `${API}/expenses?jar_id=${jarId}` : `${API}/expenses`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error("Không lấy được chi tiêu");
  return r.json();
}
export async function createExpense(jarId: string, amount: number, category?: string, photo?: File, source: "camera" | "gallery" = "camera") {
  const fd = new FormData();
  fd.append("jar_id", jarId);
  fd.append("amount", String(amount));
  if (category) fd.append("category", category);
  fd.append("idempotency_key", crypto.randomUUID());
  fd.append("source", source);
  if (photo) fd.append("photo", photo);
  const r = await fetch(`${API}/expenses`, { method: "POST", headers: authHeaders(), body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Tạo chi tiêu thất bại");
  return d;
}
export async function deleteExpense(id: string) {
  const r = await fetch(`${API}/expenses/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Xóa thất bại");
  return r.json();
}
export async function updateExpense(id: string, data: { amount?: number; category?: string }) {
  const r = await fetch(`${API}/expenses/${id}`, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail);
  return d;
}
