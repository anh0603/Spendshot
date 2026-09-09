import { useRef, useState } from "react";
import { X } from "lucide-react";
import { formatVND } from "../../lib/formatVND";
import { photoUrl } from "../../lib/photo";
import { NoPhoto } from "./NoPhoto";
import { parseServerTime } from "../../lib/time";

export interface MonthCell {
  key: string;
  day: number | null;
  expense?: any;
  count: number;
}

export interface MonthCard {
  key: string;
  label: string;
  total: number;
  /** 7 cột/tuần (T2 đầu), ô trống = day null */
  cells: MonthCell[];
}

/** Gom ảnh theo tháng, đặt vào đúng ô ngày trong lưới lịch 7 cột (T2–CN) */
export function groupByMonthCalendar(items: any[]): MonthCard[] {
  const byMonth = new Map<string, any[]>();
  for (const e of items) {
    const d = parseServerTime(e.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }
  const cards: MonthCard[] = [];
  for (const [key, list] of byMonth) {
    const [y, m] = key.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7; // T2 = 0
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = new Map<number, any[]>();
    for (const e of list) {
      const day = parseServerTime(e.created_at).getDate();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(e);
    }
    const cells: MonthCell[] = [];
    for (let i = 0; i < offset; i++) cells.push({ key: `${key}-x${i}`, day: null, count: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const arr = byDay.get(d) || [];
      cells.push({ key: `${key}-d${d}`, day: d, expense: arr[0], count: arr.length });
    }
    const monthName = first.toLocaleDateString("vi-VN", { month: "long" });
    cards.push({
      key,
      label: `${monthName} ${y}`,
      total: list.reduce((s, e) => s + e.amount, 0),
      cells,
    });
  }
  return cards.sort((a, b) => (a.key < b.key ? 1 : -1));
}

interface Props {
  items: any[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

/** Lịch ảnh kiểu Locket: sheet đẩy lên 80%, mỗi tháng 1 lưới lịch, ảnh nằm đúng ô ngày.
 *  Kéo thanh/handle xuống (chuột hoặc tay) để đóng. */
export function MonthsSheet({ items, onClose, onSelect }: Props) {
  const cards = groupByMonthCalendar(items);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  const beginDrag = (e: React.PointerEvent<HTMLElement>) => {
    startY.current = e.clientY;
    setDragging(true);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* bỏ qua */ }
  };
  const moveDrag = (clientY: number) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, clientY - startY.current));
  };
  const endDrag = () => {
    if (startY.current == null) return;
    const shouldClose = dragY > 120;
    startY.current = null;
    setDragging(false);
    setDragY(0);
    if (shouldClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div
        className="relative bg-[#F9FAFB] w-full lg:max-w-[720px] h-[80vh] rounded-t-[24px] flex flex-col animate-slide-up"
        style={dragging ? { transform: `translateY(${dragY}px)`, transition: "none" } : { transform: "translateY(0)", transition: "transform 200ms ease-out" }}
      >
        <div
          data-testid="sheet-handle"
          className="shrink-0 pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={beginDrag}
          onPointerMove={(e) => moveDrag(e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={() => { startY.current = null; setDragging(false); setDragY(0); }}
        >
          <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto" />
        </div>
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <p className="font-bold text-lg">Ảnh theo tháng</p>
          <button onClick={onClose} aria-label="Đóng lịch tháng" className="w-10 h-10 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center active:scale-95 transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 pb-6 flex flex-col gap-4">
          {cards.length === 0 && (
            <p className="text-center text-gray-500 py-16">Chưa có ảnh nào</p>
          )}
          {cards.map((c) => (
            <div key={c.key} className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <p className="font-bold">{c.label}</p>
                <p className="text-xs text-text-secondary">{formatVND(c.total)}</p>
              </div>
              <div className="grid grid-cols-7 gap-1.5 p-3">
                {c.cells.map((cell) =>
                  cell.expense ? (
                    <button
                      key={cell.key}
                      onClick={() => onSelect(cell.expense.id)}
                      className="relative aspect-square overflow-hidden rounded-xl active:scale-[0.96] transition-transform"
                      aria-label={`Xem ${formatVND(cell.expense.amount)}`}
                    >
                      {photoUrl(cell.expense.thumbnail || cell.expense.photo) ? (
                        <img src={photoUrl(cell.expense.thumbnail || cell.expense.photo)} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <NoPhoto className="w-full h-full" />
                      )}
                      {cell.count > 1 && (
                        <span className="absolute bottom-1 right-1 text-[10px] font-bold text-white bg-black/55 px-1.5 py-0.5 rounded-full">+{cell.count - 1}</span>
                      )}
                    </button>
                  ) : (
                    <div key={cell.key} className="aspect-square rounded-xl bg-gray-100" />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
