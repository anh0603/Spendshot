const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function authHeaders() {
  const t = localStorage.getItem("spendshot_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
}
// Gộp các listJars() gọi cùng lúc (Home + NotificationCenter mount đồng thời)
// thành 1 request duy nhất. Chỉ share promise đang bay — không cache kết quả
// nên không bao giờ trả dữ liệu cũ, offline-first/sync không ảnh hưởng.
let _inflightJars: Promise<any> | null = null;
export async function listJars() {
  if (!_inflightJars) {
    _inflightJars = (async () => {
      const r = await fetch(`${API}/jars`, { headers: authHeaders() });
      if (!r.ok) throw new Error("Không lấy được Hũ");
      return r.json();
    })().finally(() => { _inflightJars = null; });
  }
  return _inflightJars;
}
export async function createJar(budget: number, month?: string, name?: string) {
  const r = await fetch(`${API}/jars`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ budget, month, name }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Tạo Hũ thất bại");
  return d;
}
export async function addMoney(jarId: string, amount: number) {
  const r = await fetch(`${API}/jars/${jarId}/add`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ amount }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail);
  return d;
}
export async function withdrawMoney(jarId: string, amount: number) {
  const r = await fetch(`${API}/jars/${jarId}/withdraw`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ amount }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail);
  return d;
}
export async function getHistory(jarId: string) {
  const r = await fetch(`${API}/jars/${jarId}/history`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Không lấy được lịch sử");
  return r.json();
}
export async function deleteJar(jarId: string) {
  const r = await fetch(`${API}/jars/${jarId}`, { method: "DELETE", headers: authHeaders() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Xóa Hũ thất bại");
  return d;
}
export async function updateJar(jarId: string, data: { name?: string; budget?: number }) {
  const r = await fetch(`${API}/jars/${jarId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(data) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail);
  return d;
}
