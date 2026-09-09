import { useState } from "react";
import { Crown, X, ArrowRight, BellOff, Image as ImageIcon, Star, Sparkles, Smartphone } from "lucide-react";

/**
 * Internal Premium upsell banner — chỉ FREE thấy.
 * Hiện lại mỗi lần reload (state trong phiên, KHÔNG lưu localStorage/DB).
 * CTA đi flow Premium hiện có (/premium). Không đụng AdsBanner/NativeAdCard/backend.
 */
export function PremiumUpsellBanner() {
  // Mặc định mở mỗi lần mount (reload/app mở lại) — không persist theo yêu cầu.
  const [open, setOpen] = useState(true);
  const role = (() => {
    try {
      return (JSON.parse(localStorage.getItem("spendshot_user") || "null") as any)?.role;
    } catch {
      return null;
    }
  })();
  if (role !== "FREE" || !open) return null;

  const perks = [
    { icon: <BellOff size={18} strokeWidth={1.8} />, label: "Không quảng cáo" },
    { icon: <ImageIcon size={18} strokeWidth={1.8} />, label: "Mở khóa Gallery" },
    { icon: <Star size={18} strokeWidth={1.8} />, label: "Nhiều tính năng Premium hấp dẫn khác" },
  ];

  return (
    <div
      data-testid="premium-upsell-banner"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF5A1F] via-primary to-[#FF8A5C] text-white shadow animate-fade-in"
    >
      {/* Họa tiết trang trí */}
      <div className="pointer-events-none absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-1/3 -top-20 w-72 h-72 rounded-full bg-[#FFD9A8]/30 blur-2xl" />
      <Sparkles size={14} className="pointer-events-none absolute left-[46%] top-4 text-yellow-200/90" />
      <Sparkles size={11} className="pointer-events-none absolute left-[58%] bottom-6 text-yellow-100/80" />
      <Sparkles size={12} className="pointer-events-none absolute right-[38%] top-8 text-white/70" />

      <button
        onClick={() => setOpen(false)}
        aria-label="Đóng banner"
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center transition-colors"
      >
        <X size={16} />
      </button>

      <div className="relative flex items-center gap-4 md:gap-8 p-4 md:p-6">
        {/* Cột trái: nội dung */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <Crown size={22} className="text-white" />
            </span>
            <span className="text-xs md:text-sm font-semibold bg-white/20 border border-white/30 rounded-full px-3 py-1">
              Nâng cấp Premium
            </span>
          </div>
          <p className="mt-2 font-bold text-lg md:text-2xl leading-snug">
            Trải nghiệm đầy đủ tính năng
            <br />
            cùng <span className="text-yellow-200">SpendShot Premium</span>
          </p>
          <ul className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-5 gap-y-1.5">
            {perks.map((p) => (
              <li key={p.label} className="flex items-center gap-1.5 text-xs md:text-sm text-white/95">
                <span className="w-6 h-6 rounded-full border border-white/60 flex items-center justify-center shrink-0">
                  {p.icon}
                </span>
                {p.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Cột phải: minh họa phone + CTA */}
        <div className="hidden sm:flex flex-col items-center gap-2 shrink-0">
          <div className="relative">
            {/* Phone mockup vẽ bằng CSS */}
            <div className="w-28 md:w-36 rounded-[1.4rem] bg-[#1F2937] p-1.5 shadow-lg rotate-3">
              <div className="rounded-[1.1rem] overflow-hidden bg-gradient-to-b from-sky-200 to-sky-100">
                <div className="flex items-center justify-between px-2 pt-1 text-[8px] text-gray-700">
                  <span>9:41</span>
                  <span className="flex gap-0.5">
                    <span className="w-2 h-1.5 rounded-[1px] bg-gray-700/70" />
                    <span className="w-2 h-1.5 rounded-[1px] bg-gray-700/70" />
                  </span>
                </div>
                <div className="m-1.5 rounded-lg bg-gradient-to-br from-emerald-200 via-teal-100 to-amber-100 h-12 md:h-16 relative overflow-hidden">
                  <Smartphone size={14} className="absolute left-1.5 top-1.5 text-white/90" />
                  <div className="absolute bottom-1 left-1.5 right-1.5 h-4 rounded bg-white/85 flex items-center px-1 gap-1">
                    <span className="w-3 h-3 rounded bg-primary flex items-center justify-center">
                      <Crown size={8} className="text-white" />
                    </span>
                    <span className="h-1 flex-1 rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>
            {/* Badge crown bay */}
            <span className="absolute -right-3 top-6 w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 border-2 border-white/70 shadow flex items-center justify-center -rotate-12">
              <Crown size={20} className="text-white" />
            </span>
          </div>
          <button
            onClick={() => { window.location.href = "/premium"; }}
            className="h-10 px-5 rounded-full bg-white text-primary text-sm font-bold flex items-center gap-1.5 shadow hover:bg-primary-light active:scale-[0.98] transition-all"
          >
            Nâng cấp Premium <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* CTA cho mobile (cột phải ẩn) */}
      <div className="relative px-4 pb-4 sm:hidden">
        <button
          onClick={() => { window.location.href = "/premium"; }}
          className="w-full h-11 rounded-full bg-white text-primary text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
        >
          Nâng cấp Premium <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
