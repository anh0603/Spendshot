const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h() { return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }

export async function getPaymentInfo() {
  const r = await fetch(`${API}/subscription/payment-info`, { headers: h() });
  if (!r.ok) throw new Error("Không lấy được thông tin thanh toán");
  return r.json();
}
export async function sendPaymentRequest() {
  const r = await fetch(`${API}/subscription/payment-request`, { method: "POST", headers: h() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Gửi yêu cầu thất bại");
  return d;
}
export async function listUpgradeRequests(status = "") {
  const r = await fetch(`${API}/admin/upgrade-requests${status ? `?status=${status}` : ""}`, { headers: h() });
  if (!r.ok) throw new Error("403");
  return r.json();
}
export async function approveRequest(id: string) {
  const r = await fetch(`${API}/admin/upgrade-requests/${id}/approve`, { method: "POST", headers: h() });
  if (!r.ok) throw new Error("Duyệt thất bại");
  return r.json();
}
export async function rejectRequest(id: string) {
  const r = await fetch(`${API}/admin/upgrade-requests/${id}/reject`, { method: "POST", headers: h() });
  if (!r.ok) throw new Error("Từ chối thất bại");
  return r.json();
}
export async function getPaymentSettings() {
  const r = await fetch(`${API}/admin/payment-settings`, { headers: h() });
  if (!r.ok) throw new Error("403");
  return r.json();
}
export async function savePaymentSettings(data: { bank_id: string; account_no: string; account_name: string; amount: number }) {
  const r = await fetch(`${API}/admin/payment-settings`, { method: "PUT", headers: { ...h(), "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Lưu thất bại");
  return d;
}
