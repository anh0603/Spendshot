import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { formatVND } from "../../lib/formatVND";
import { photoUrl } from "../../lib/photo";
import { NoPhoto } from "./NoPhoto";
import { parseServerTime } from "../../lib/time";
import { categoryLabel } from "../../lib/categories";

interface Props {
  items: any[];
  index: number;
  onNav: (i: number) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

/** Xem ảnh kiểu Locket: vuốt ngang (touch + kéo chuột), không nút bấm */
export function PhotoViewer({ items, index, onNav, onClose, onDelete }: Props) {
  const startX = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [enterDir, setEnterDir] = useState<0 | 1 | -1>(0);
  const item = items[index];

  if (!item) return null;

  // Hết ảnh thì dừng lại, không vòng lặp
  const go = (dir: 1 | -1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    setEnterDir(dir);
    onNav(next);
  };

  const reset = () => {
    startX.current = null;
    setOffset(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-scale-in shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div
          className="relative select-none cursor-grab active:cursor-grabbing overflow-hidden"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            startX.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (startX.current == null) return;
            setOffset(e.clientX - startX.current);
          }}
          onPointerUp={(e) => {
            if (startX.current == null) return;
            const dx = e.clientX - startX.current;
            reset();
            if (Math.abs(dx) < 60) return;
            go(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={reset}
        >
          {photoUrl(item.photo) ? (
          <img
            key={item.id}
            src={photoUrl(item.photo)}
            alt=""
            draggable={false}
            className="w-full aspect-video object-cover pointer-events-none"
            style={
              offset !== 0
                ? { transform: `translateX(${offset * 0.6}px)`, transition: "none" }
                : enterDir !== 0
                  ? { animation: enterDir === 1 ? "slide-photo-left 220ms ease-out" : "slide-photo-right 220ms ease-out" }
                  : undefined
            }
          />
          ) : (
            <NoPhoto className="w-full aspect-video" />
          )}
        </div>
        <div className="p-4">
          <p className="text-xl font-bold">{formatVND(item.amount)}</p>
          <p className="text-sm text-text-secondary">{categoryLabel(item.category)} • {parseServerTime(item.created_at).toLocaleString("vi-VN")}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onDelete(item.id)}
              className="flex-1 h-10 rounded-lg bg-[#FEF2F2] text-danger text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FEE2E2] active:scale-[0.98] transition-all"
            >
              <Trash2 size={16} /> Xóa
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg bg-gray-100 text-text-primary text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-200 active:scale-[0.98] transition-all"
            >
              <X size={16} /> Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
