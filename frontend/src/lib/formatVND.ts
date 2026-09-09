export function formatVND(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return sign + abs.toLocaleString("vi-VN") + " ₫";
}

export function formatVNDInput(value: string): string {
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
}

export function parseVND(formatted: string): number {
  return parseInt(formatted.replace(/\./g, "").replace(/\D/g, ""), 10) || 0;
}
