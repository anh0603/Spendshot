const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Ảnh backend trả về dạng "/uploads/..." (tương đối) hoặc URL đầy đủ/picsum/blob.
 * CRITICAL-2: /uploads yêu cầu JWT nên <img> phải kèm ?token= (header không gửi được qua img). */
export function photoUrl(u?: string | null): string {
  if (!u) return "";
  if (u.startsWith("http") || u.startsWith("blob:") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) {
    const token = localStorage.getItem("spendshot_token");
    if (!token) return `${API}${u}`;
    const sep = u.includes("?") ? "&" : "?";
    return `${API}${u}${sep}token=${encodeURIComponent(token)}`;
  }
  return u;
}
