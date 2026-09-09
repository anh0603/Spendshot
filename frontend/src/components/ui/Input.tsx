import React, { useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", type, ...props }: InputProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-text-primary">{label}</label>}
      <div className="relative">
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          className={`w-full h-12 px-4 bg-white border-0 rounded-xl text-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-text-secondary ${error ? "ring-2 ring-danger/40 bg-[#FEF2F2]" : ""} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? "Ẩn" : "Hiện"}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function AmountInput({ value, onChange, ...props }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="flex flex-col gap-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="w-full text-[32px] font-bold text-center py-4 border rounded-lg focus:border-primary focus:outline-none placeholder:text-gray-300"
        {...props}
      />
      <div className="flex gap-2 justify-center flex-wrap">
        {["+100K", "+200K", "+500K", "+1Tr"].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              const add = chip === "+100K" ? 100000 : chip === "+200K" ? 200000 : chip === "+500K" ? 500000 : 1000000;
              const current = parseInt(value.replace(/\D/g, ""), 10) || 0;
              onChange((current + add).toString());
            }}
            className="px-4 h-9 rounded-full bg-primary-light text-primary text-sm font-medium border border-primary/20 hover:bg-primary hover:text-white transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
