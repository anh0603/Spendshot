import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, PiggyBank, ChartColumn, ArrowRight, ShieldCheck, Zap, BellRing, Crown, Heart, Coins, Download, ChevronDown, Phone, Mail, Share2, MapPin, Copy, Check, Star, Wallet, Sparkles, EyeOff, Lock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { Reveal } from "../../components/ui/Reveal";
import { getContact, type ContactInfo } from "../../lib/contact";

const features = [
  { Icon: Camera, bg: "bg-primary-light text-primary", title: "Chụp là xong", body: "Thấy gì mua đó — chụp ảnh, nhập tiền, xong." },
  { Icon: PiggyBank, bg: "bg-green-50 text-success", title: "Hũ tự trừ", body: "Tiền tự trừ vào Hũ tháng, khỏi ghi chép." },
  { Icon: ChartColumn, bg: "bg-blue-50 text-info", title: "Nhìn là hiểu", body: "Ảnh + số dư + thống kê màu sắc trực quan." },
];

const heroTags = [
  { label: "19K/tháng", Icon: Crown, iconCls: "text-amber-500", cls: "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[-8deg]", pos: "left-[13%] top-[22%]", side: -1 as const, dist: 130 },
  { label: "Offline 100%", Icon: Zap, iconCls: "text-amber-400", cls: "bg-black text-white rotate-[6deg]", pos: "left-[11%] top-[58%]", side: -1 as const, dist: 150 },
  { label: "Không quảng cáo", Icon: EyeOff, iconCls: "text-primary", cls: "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[8deg]", pos: "right-[13%] top-[24%]", side: 1 as const, dist: 130 },
  { label: "Bảo mật", Icon: Lock, iconCls: "", cls: "bg-gradient-to-r from-primary to-[#FF8A5C] text-white rotate-[-6deg] shadow-lg shadow-orange-500/25", pos: "right-[11%] top-[60%]", side: 1 as const, dist: 150 },
];

// 2 ô đỏ trong mockup điện thoại: mỗi ô xoay 3 ảnh CỐ ĐỊNH mỗi 5s.
// Ảnh local trong public/welcome (ảnh món đồ đúng concept SpendShot), preload trước nên không lag, offline vẫn hiện.
const ROTATE_TOP_LEFT = [
  { src: "/welcome/exp-dau.jpg", amount: "125.000 ₫" },
  { src: "/welcome/exp-cafe.jpg", amount: "65.000 ₫" },
  { src: "/welcome/exp-mamxoi.jpg", amount: "89.000 ₫" },
];
const ROTATE_BOTTOM_RIGHT = [
  { src: "/welcome/exp-phukien.jpg", amount: "210.000 ₫" },
  { src: "/welcome/exp-anan.jpg", amount: "55.000 ₫" },
  { src: "/welcome/exp-goclamviec.jpg", amount: "850.000 ₫" },
];

function Sticker({ className = "", style, dx = 0, dy = 0, fade = 1, zoom = 1, children }: { className?: string; style?: React.CSSProperties; dx?: number; dy?: number; fade?: number; zoom?: number; children: React.ReactNode }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ transform: `translate(${dx}px, ${dy}px) scale(${zoom})`, opacity: fade, willChange: "transform, opacity" }}
      aria-hidden
    >
      <div className="animate-float" style={style}>
        {children}
      </div>
    </div>
  );
}

function ContactSection() {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    getContact().then(setContact).catch(() => setContact(null));
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* bỏ qua */ }
  };

  const rows = [
    { key: "hotline", label: "Hotline", Icon: Phone, value: contact?.hotline || "" },
    { key: "email", label: "Email", Icon: Mail, value: contact?.email || "" },
    { key: "facebook", label: "Facebook", Icon: Share2, value: contact?.facebook || "" },
    { key: "address", label: "Địa chỉ", Icon: MapPin, value: contact?.address || "" },
  ].filter((r) => r.value);

  return (
    <section id="lien-he" className="max-w-6xl mx-auto px-4 lg:px-8 pb-12">
      <Reveal>
        <div className="bg-white rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 md:p-8">
          <div className="text-center">
            <h2 className="font-bold text-xl">Liên hệ</h2>
            <p className="text-sm text-text-secondary mt-1">Cần hỗ trợ? Gọi hoặc nhắn cho chúng tôi.</p>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-text-secondary mt-4 text-center py-4">Thông tin liên hệ đang cập nhật — vui lòng quay lại sau.</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {rows.map(({ key, label, Icon, value }) => (
                <div key={key} className="rounded-2xl bg-[#F9FAFB] p-4 flex flex-col items-center text-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <span className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <Icon size={26} strokeWidth={1.8} />
                  </span>
                  <p className="text-xs text-text-secondary">{label}</p>
                  <p className="text-sm font-bold truncate w-full" title={value}>{value}</p>
                  <button
                    onClick={() => copy(value, key)}
                    aria-label={`Sao chép ${label}`}
                    className="h-9 px-4 rounded-full bg-white shadow-sm text-xs font-medium flex items-center gap-1.5 text-text-secondary hover:text-primary active:scale-95 transition-all"
                  >
                    {copied === key ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                    {copied === key ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

// Ô ảnh xoay crossfade: xếp chồng 3 ảnh, ảnh active opacity-100 + scale-100,
// ảnh cũ mờ dần + zoom nhẹ trong 700ms nên chuyển cảnh mượt, không chớp.
function CrossfadeCell({ items, index }: { items: { src: string; amount: string }[]; index: number }) {
  return (
    <div className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
      {items.map((t, i) => (
        <img
          key={t.src}
          src={t.src}
          alt="Ảnh chi tiêu"
          loading="eager"
          aria-hidden={i !== index}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${i === index ? "opacity-100 scale-100" : "opacity-0 scale-110"}`}
        />
      ))}
      <span
        key={items[index].amount}
        style={{ animation: "fade-in 500ms ease-out" }}
        className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded"
      >
        {items[index].amount}
      </span>
    </div>
  );
}

export function Welcome() {
  const installApp = () => {
    window.dispatchEvent(new CustomEvent("spendshot:install"));
  };

  // Xoay 2 ảnh mockup mỗi 5s (index 0→1→2→0...). Preload 6 ảnh local khi mount nên đổi ảnh tức thì.
  const [rotateIdx, setRotateIdx] = useState(0);
  useEffect(() => {
    [...ROTATE_TOP_LEFT, ...ROTATE_BOTTOM_RIGHT].forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setRotateIdx((i) => (i + 1) % 3), 5000);
    return () => clearInterval(id);
  }, []);

  // Parallax nhẹ + nền nhạt dần khi cuộn (rAF, chỉ transform nên không lag)
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScroll(window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const fade = Math.min(scroll / 600, 1);
  const bg = `rgb(255, ${Math.round(248 + (255 - 248) * fade)}, ${Math.round(231 + (255 - 231) * fade)})`;
  // Cuộn xuống: sticker dạt ra 2 bên + mờ dần; thẻ tag mở dần (unroll)
  const spread = Math.min(scroll / 500, 1);
  const out = (side: -1 | 1, base: number) => side * spread * base;
  const dim = 1 - spread * 0.9;
  const unroll = Math.min(scroll / 400, 1);

  return (
    <div className="min-h-screen text-text-primary overflow-x-hidden transition-colors duration-300" style={{ backgroundColor: bg }}>
      {/* Thanh trên */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-4 lg:px-8 h-16">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-bold text-lg">SpendShot</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
          <a href="#tinh-nang" className="hover:text-primary transition-colors">Tính năng</a>
          <a href="#goi-premium" className="hover:text-primary transition-colors">Premium</a>
          <a href="#lien-he" className="hover:text-primary transition-colors">Liên hệ</a>
        </nav>
        <button onClick={installApp} className="h-10 px-5 rounded-full bg-black/5 hover:bg-black/10 text-sm font-semibold flex items-center gap-2 active:scale-95 transition-all">
          <Download size={17} /> Cài đặt
        </button>
      </header>

      {/* Hero kiểu Locket full màn hình */}
      <section className="relative max-w-6xl mx-auto px-4 lg:px-8 pt-6 pb-10 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
        <Sticker className="left-[4%] top-[8%] hidden sm:block" style={{ animationDelay: "0.4s" }} dx={out(-1, 110)} dy={scroll * 0.12} fade={dim}>
          <span className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[-10deg]">
            <Heart size={30} className="text-amber-400" fill="currentColor" />
          </span>
        </Sticker>
        <Sticker className="left-[1%] top-[58%] hidden lg:block" style={{ animationDelay: "1.9s" }} dx={out(-1, 160)} dy={scroll * 0.1} fade={dim}>
          <img src="https://picsum.photos/seed/spendshot-food/224/224" alt="Ăn uống" loading="lazy" className="w-28 h-28 rounded-3xl object-cover shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[10deg]" />
        </Sticker>
        <Sticker className="left-[2%] top-[30%] hidden lg:block" style={{ animationDelay: "1.1s" }} dx={out(-1, 150)} dy={scroll * 0.1} fade={dim}>
          <span className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[18deg]">
            <Star size={22} className="text-white" fill="currentColor" />
          </span>
        </Sticker>
        <Sticker className="left-[8%] top-[46%]" style={{ animationDelay: "1.4s" }} dx={out(-1, 90)} dy={scroll * 0.08} fade={dim}>
          <span className="px-4 py-2 rounded-2xl bg-amber-400 text-black text-xs font-black rotate-[-12deg] shadow-[0_4px_20px_rgba(0,0,0,0.05)] inline-block">TIÊU THÔNG<br />MINH</span>
        </Sticker>
        <Sticker className="left-[16%] bottom-[10%] hidden md:block" style={{ animationDelay: "2.2s" }} dx={out(-1, 120)} dy={scroll * 0.15} fade={dim}>
          <span className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[12deg]">
            <Coins size={26} className="text-white" />
          </span>
        </Sticker>
        <Sticker className="left-[26%] bottom-[4%] hidden xl:block" style={{ animationDelay: "2.9s" }} dx={out(-1, 100)} dy={scroll * 0.11} fade={dim}>
          <span className="w-12 h-12 rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[-14deg]">
            <Wallet size={22} className="text-primary" />
          </span>
        </Sticker>
        <Sticker className="right-[6%] top-[6%] hidden sm:block" style={{ animationDelay: "0.9s" }} dx={out(1, 110)} dy={scroll * 0.1} fade={dim}>
          <span className="px-3 py-2 rounded-2xl bg-black text-amber-400 text-xs font-black rotate-[10deg] shadow-[0_4px_20px_rgba(0,0,0,0.05)] inline-flex items-center gap-1">
            <Crown size={14} /> PREMIUM
          </span>
        </Sticker>
        <Sticker className="right-[2%] top-[28%] hidden lg:block" style={{ animationDelay: "1.6s" }} dx={out(1, 150)} dy={scroll * 0.12} fade={dim}>
          <span className="w-12 h-12 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[-16deg]">
            <Sparkles size={22} className="text-amber-500" />
          </span>
        </Sticker>
        <Sticker className="right-[3%] top-[48%] hidden md:block" style={{ animationDelay: "1.8s" }} dx={out(1, 120)} dy={scroll * 0.14} fade={dim}>
          <span className="w-16 h-16 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center rotate-[14deg]">
            <Heart size={34} className="text-primary" fill="currentColor" />
          </span>
        </Sticker>
        <Sticker className="right-[1%] top-[30%] hidden lg:block" style={{ animationDelay: "2.1s" }} dx={out(1, 160)} dy={scroll * 0.11} fade={dim}>
          <img src="https://picsum.photos/seed/spendshot-travel/224/224" alt="Di chuyển" loading="lazy" className="w-28 h-28 rounded-3xl object-cover shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[-10deg]" />
        </Sticker>
        <Sticker className="right-[14%] bottom-[8%] hidden md:block" style={{ animationDelay: "2.6s" }} dx={out(1, 90)} dy={scroll * 0.09} fade={dim}>
          <img src="https://picsum.photos/seed/spendshot-hero/192/192" alt="" loading="lazy" className="w-24 h-24 rounded-2xl object-cover shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[-8deg]" />
        </Sticker>
        <Sticker className="left-[10%] bottom-[6%] hidden lg:block" style={{ animationDelay: "3s" }} dx={out(-1, 130)} dy={scroll * 0.13} fade={dim}>
          <img src="https://picsum.photos/seed/spendshot-shop/192/192" alt="Mua sắm" loading="lazy" className="w-24 h-24 rounded-2xl object-cover shadow-[0_4px_20px_rgba(0,0,0,0.05)] rotate-[8deg]" />
        </Sticker>
        {/* Thẻ tag 2 bên điện thoại (desktop): cuộn thì dạt ra + mở dần */}
        {heroTags.map((t, i) => (
          <Sticker
            key={t.label}
            className={`${t.pos} hidden lg:block`}
            style={{ animationDelay: `${0.6 + i * 0.3}s` }}
            dx={out(t.side, unroll * t.dist)}
            dy={scroll * 0.07}
            fade={1 - unroll * 0.85}
            zoom={0.85 + unroll * 0.2}
          >
            <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${t.cls}`}>
              <t.Icon size={14} className={t.iconCls} /> {t.label}
            </span>
          </Sticker>
        ))}

        <div className="relative mx-auto w-[260px] sm:w-[360px] animate-fade-up">
          <div className="relative z-10 rounded-[3rem] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-[6px] border-black/80 overflow-hidden">
            <div className="bg-gradient-to-b from-sky-100 to-white px-4 pt-3 pb-4">
              <p className="text-center text-xs font-semibold text-text-secondary">9:41</p>
              <div className="mt-2 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] text-white text-xs font-bold flex items-center justify-center">B</span>
                  <div>
                    <p className="text-[11px] text-text-secondary">Xin chào</p>
                    <p className="text-xs font-bold text-primary">Bạn</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary mt-2">Ngân sách</p>
                <p className="text-base font-bold">2.000.000 ₫</p>
                <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-primary to-[#FF8A5C]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {/* Ô xoay 1: trên-trái — crossfade mượt mỗi 5s */}
                <CrossfadeCell items={ROTATE_TOP_LEFT} index={rotateIdx} />
                {/* Ô tĩnh: trên-phải */}
                <div className="relative rounded-xl overflow-hidden aspect-square">
                  <img src="https://picsum.photos/seed/spendshot-b/200/200" alt="" loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">89.000 ₫</span>
                </div>
                {/* Ô tĩnh: dưới-trái */}
                <div className="relative rounded-xl overflow-hidden aspect-square">
                  <img src="https://picsum.photos/seed/spendshot-c/200/200" alt="" loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">45.000 ₫</span>
                </div>
                {/* Ô xoay 2: dưới-phải — crossfade mượt mỗi 5s */}
                <CrossfadeCell items={ROTATE_BOTTOM_RIGHT} index={rotateIdx} />
              </div>
            </div>
          </div>
        {/* Tag thò ra sau điện thoại trên mobile: lớp ngoài theo cuộn, lớp trong bay */}
        <div className="lg:hidden absolute -z-10 -left-16 top-20" style={{ transform: `translateX(${-unroll * 36}px) scale(${1 + unroll * 0.12})`, opacity: 1 - unroll * 0.7 }}>
          <div className="rotate-[-8deg] animate-float">
            <span className="px-4 py-2 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
              <Crown size={18} className="text-amber-500" /> 19K/tháng
            </span>
          </div>
        </div>
        <div className="lg:hidden absolute -z-10 -right-16 top-20" style={{ transform: `translateX(${unroll * 36}px) scale(${1 + unroll * 0.12})`, opacity: 1 - unroll * 0.7 }}>
          <div className="rotate-[8deg] animate-float" style={{ animationDelay: "0.7s" }}>
            <span className="px-4 py-2 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
              <EyeOff size={18} className="text-primary" /> Không quảng cáo
            </span>
          </div>
        </div>
        <div className="lg:hidden absolute -z-10 -left-16 bottom-24" style={{ transform: `translateX(${-unroll * 44}px) scale(${1 + unroll * 0.12})`, opacity: 1 - unroll * 0.7 }}>
          <div className="rotate-[6deg] animate-float" style={{ animationDelay: "1.3s" }}>
            <span className="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
              <Zap size={18} className="text-amber-400" /> Offline 100%
            </span>
          </div>
        </div>
        <div className="lg:hidden absolute -z-10 -right-16 bottom-24" style={{ transform: `translateX(${unroll * 44}px) scale(${1 + unroll * 0.12})`, opacity: 1 - unroll * 0.7 }}>
          <div className="rotate-[-6deg] animate-float" style={{ animationDelay: "1.9s" }}>
            <span className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-[#FF8A5C] text-white text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-lg shadow-orange-500/25">
              <Lock size={18} /> Bảo mật
            </span>
          </div>
        </div>
        </div>

        <div className="text-center mt-8">
          <div className="flex items-center justify-center gap-2 animate-fade-up">
            <Logo size={40} />
            <h1 className="text-4xl font-black tracking-tight">
              Spend<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#FF8A5C]">Shot</span>
            </h1>
          </div>
          <p className="text-text-secondary mt-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Chụp chi tiêu. Nhìn thấy tiền đi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 max-w-md mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <Link to="/login" className="flex-1">
              <Button className="w-full !h-[52px] !rounded-2xl !text-base bg-gradient-to-r from-primary to-[#FF8A5C] shadow-lg shadow-orange-500/30 hover:shadow-xl hover:-translate-y-0.5">
                <span className="flex items-center gap-2">Đăng nhập <ArrowRight size={18} /></span>
              </Button>
            </Link>
            <Link to="/register" className="flex-1">
              <Button variant="secondary" className="w-full !h-[52px] !rounded-2xl !text-base shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:-translate-y-0.5">Đăng ký</Button>
            </Link>
          </div>
          <div className="flex gap-2 justify-center mt-5 animate-fade-up" style={{ animationDelay: "0.25s" }}>
            {[
              { Icon: ShieldCheck, label: "Riêng tư" },
              { Icon: Zap, label: "Offline" },
              { Icon: BellRing, label: "Nhắc nhở" },
            ].map(({ Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-white px-3 py-1.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <Icon size={14} className="text-primary" /> {label}
              </span>
            ))}
          </div>
          <ChevronDown size={28} className="mx-auto mt-8 text-text-secondary animate-bounce" />
        </div>
      </section>

      {/* Tính năng */}
      <section id="tinh-nang" className="max-w-md mx-auto px-4 pb-6 flex flex-col gap-3">
        {features.map(({ Icon, bg, title, body }, i) => (
          <div
            key={title}
            className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <span className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{title} <span className="text-text-secondary font-normal">#{i + 1}</span></p>
              <p className="text-xs text-text-secondary">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Premium teaser */}
      <section id="goi-premium" className="max-w-md mx-auto px-4 pb-6">
        <Reveal>
        <Link to="/register" className="block bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl p-5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-lg hover:-translate-y-0.5 transition-all">
          <p className="font-bold">Premium chỉ 19.000 ₫/tháng</p>
          <p className="text-sm opacity-90 mt-1">Mở gallery, tắt quảng cáo →</p>
        </Link>
        </Reveal>
      </section>

      <ContactSection />

      {/* Liên hệ */}
      <footer className="text-center pb-10 text-xs text-text-secondary">
        SpendShot — chụp chi tiêu, nhìn thấy tiền đi.
      </footer>
    </div>
  );
}
