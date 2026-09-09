import {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  House,
  Zap,
  Droplets,
  PartyPopper,
  Pencil,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
}

export const CATEGORIES: Category[] = [
  { value: "An uong", label: "Ăn uống", Icon: UtensilsCrossed, color: "#FF6B35" },
  { value: "Di chuyen", label: "Di chuyển", Icon: Car, color: "#3B82F6" },
  { value: "Mua sam", label: "Mua sắm", Icon: ShoppingBag, color: "#8B5CF6" },
  { value: "Tien nha", label: "Tiền nhà", Icon: House, color: "#10B981" },
  { value: "Dien", label: "Điện", Icon: Zap, color: "#F59E0B" },
  { value: "Nuoc", label: "Nước", Icon: Droplets, color: "#06B6D4" },
  { value: "Giai tri", label: "Giải trí", Icon: PartyPopper, color: "#EC4899" },
  { value: "Khac", label: "Khác", Icon: Pencil, color: "#6B7280" },
];

const byValue = new Map(CATEGORIES.map((c) => [c.value, c]));

/** Tên hiển thị: danh mục có sẵn → tiếng Việt; nội dung tự nhập → giữ nguyên */
export function categoryLabel(v?: string | null): string {
  if (!v) return "Không có danh mục";
  return byValue.get(v)?.label || v;
}

export function categoryColor(v?: string | null): string {
  if (!v) return "#6B7280";
  return byValue.get(v)?.color || "#6B7280";
}
