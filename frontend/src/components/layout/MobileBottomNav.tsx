import { NavLink, useNavigate } from "react-router-dom";
import { Home, ChartColumn, Camera, Crown, User } from "lucide-react";

export function MobileBottomNav() {
  const navigate = useNavigate();
  const tab = (active: boolean) => `flex flex-col items-center gap-1 text-xs min-w-[56px] min-h-[44px] justify-center ${active ? "text-primary" : "text-text-secondary"}`;
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-border flex items-center justify-around px-2 z-30">
      <NavLink to="/" className={({ isActive }) => tab(isActive)}>
        <Home size={24} strokeWidth={1.8} /> Trang chủ
      </NavLink>
      <NavLink to="/statistics" className={({ isActive }) => tab(isActive)}>
        <ChartColumn size={24} strokeWidth={1.8} /> Thống kê
      </NavLink>
      <div className="relative -top-7">
        <button
          onClick={() => navigate("/?camera=1")}
          aria-label="Chụp khoản chi"
          className="w-16 h-16 rounded-fab bg-gradient-to-br from-primary to-[#FF8A5C] text-white shadow-lg flex items-center justify-center active:scale-95 hover:scale-105 transition-transform min-w-[56px] min-h-[56px] animate-fab-pulse"
        >
          <Camera size={28} strokeWidth={1.8} />
        </button>
      </div>
      <NavLink to="/premium" className={({ isActive }) => tab(isActive)}>
        <Crown size={24} strokeWidth={1.8} /> Premium
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => tab(isActive)}>
        <User size={24} strokeWidth={1.8} /> Hồ sơ
      </NavLink>
    </div>
  );
}
