interface Props {
  /** Chuỗi số thô (chỉ chữ số) */
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  large?: boolean;
}

/** Ô nhập tiền tự chia hàng nghìn kiểu Việt Nam (1.000.000) khi gõ. */
export function AmountField({ value, onChange, placeholder = "0", large = true }: Props) {
  const digits = value.replace(/\D/g, "");
  const display = digits ? Number(digits).toLocaleString("vi-VN") : "";

  return (
    <div className="relative">
      <input
        value={display}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        pattern="[0-9.]*"
        placeholder={placeholder}
        aria-label="Số tiền"
        className={`w-full border border-border rounded-lg focus:border-primary outline-none text-center font-bold placeholder:text-gray-300 placeholder:font-normal ${
          large ? "text-[28px] py-3" : "h-12 px-4 text-lg"
        }`}
      />
      {digits ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded-full pointer-events-none">₫</span>
      ) : null}
    </div>
  );
}
