import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

interface Props {
  accept?: string;
  onPick: (file: File | null) => void;
  placeholder?: string;
}

export function FilePicker({ accept = "image/jpeg,image/png,image/webp", onPick, placeholder = "Chọn ảnh..." }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setName(f ? f.name : "");
    onPick(f);
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} onChange={handle} className="hidden" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 h-11 px-4 rounded-button border-2 border-dashed border-primary/40 bg-primary-light text-primary text-sm font-medium flex items-center justify-center gap-2 hover:border-primary hover:bg-[#FFE4D6] active:scale-[0.98] transition-all"
        >
          <ImagePlus size={18} strokeWidth={1.8} />
          {name || placeholder}
        </button>
        {name && (
          <button
            type="button"
            aria-label="Bỏ chọn ảnh"
            onClick={() => { setName(""); if (inputRef.current) inputRef.current.value = ""; onPick(null); }}
            className="w-11 h-11 rounded-button border border-border flex items-center justify-center text-text-secondary hover:bg-gray-50 active:scale-95 transition-all shrink-0"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {name && <p className="text-xs text-text-secondary mt-1 truncate">Đã chọn: {name}</p>}
    </div>
  );
}
