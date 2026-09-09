import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon" | "fab";
type Size = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: Props) {
  const base = "inline-flex items-center justify-center font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";
  const variants: Record<Variant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
    secondary: "bg-white border border-border text-text-primary hover:bg-gray-50",
    ghost: "bg-transparent text-text-primary hover:bg-gray-100",
    danger: "bg-danger text-white hover:bg-red-600",
    icon: "w-10 h-10 bg-white border border-border",
    fab: "w-16 h-16 rounded-fab bg-gradient-to-br from-primary to-[#FF8A5C] text-white shadow-lg hover:shadow-xl",
  };
  const sizes: Record<Size, string> = {
    sm: "h-9 px-4 text-sm rounded-button",
    md: "h-12 px-6 text-sm rounded-button",
    lg: "h-14 px-8 text-base rounded-button",
  };
  const fabSize = variant === "fab" ? "" : sizes[size];
  const radius = variant === "fab" || variant === "icon" ? "" : "";
  const variantCls = variants[variant];

  return (
    <button
      className={`${base} ${variantCls} ${fabSize} ${radius} ${className} ${variant === "icon" ? "rounded-button" : ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
