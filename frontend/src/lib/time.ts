/**
 * Giờ server (SQLite) lưu dạng UTC "YYYY-MM-DD HH:mm:ss" không múi giờ.
 * Trình duyệt hiểu nhầm thành giờ local → hiển thị sớm 7 tiếng (giờ VN).
 * Hàm này ép hiểu đúng là UTC để hiển thị giờ địa phương chính xác.
 */
export function parseServerTime(s?: string | null): Date {
  if (!s) return new Date(NaN);
  const t = s.trim();
  // Đã có múi giờ (Z hoặc ±hh:mm) thì giữ nguyên
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(t)) return new Date(t);
  const iso = t.replace(" ", "T");
  const d = new Date(iso + "Z");
  return isNaN(d.getTime()) ? new Date(t) : d;
}
