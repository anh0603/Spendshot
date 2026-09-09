import { ImageOff } from "lucide-react";

/** Hiển thị khi expense không còn ảnh (vd bị Admin xóa object) — không crash, không vỡ layout. */
export function NoPhoto({ className = "", title = "Ảnh đã bị xóa" }: { className?: string; title?: string }) {
  return (
    <div title={title} className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>
      <ImageOff size={20} />
    </div>
  );
}
