import { useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, ChartColumn, Crown, User, LogOut } from "lucide-react";
import { Logo } from "../ui/Logo";
import { logout } from "../../lib/auth";

const navItems = [
  { label: "Trang chủ", path: "/", Icon: Home, chip: "bg-primary-light text-primary" },
  { label: "Thống kê", path: "/statistics", Icon: ChartColumn, chip: "bg-blue-50 text-info" },
  { label: "Premium", path: "/premium", Icon: Crown, chip: "bg-[#FEF3C7] text-warning" },
  { label: "Hồ sơ", path: "/profile", Icon: User, chip: "bg-green-50 text-success" },
];

export function DesktopSidebar() {
  // Tablet 768-1023: collapsible 72px icon-only, Desktop >=1024: 280px full
  // Mặc định collapsed trên tablet, expand trên desktop
  const collapsedDefault = typeof window !== "undefined" ? window.innerWidth < 1024 && window.innerWidth >= 768 : false;
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const nav = useNavigate();

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-white border-r border-border transition-all duration-200 ${
        collapsed ? "w-[72px]" : "w-[280px]"
      }`}
    >
      <div className={`h-16 flex items-center gap-3 border-b border-border ${collapsed ? "justify-center px-2" : "px-6"}`}>
        <Logo size={32} />
        {!collapsed && <span className="font-bold text-lg tracking-tight">SpendShot</span>}
      </div>
      {/* Toggle button — chỉ hiện trên tablet */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
        className="xl:hidden mx-auto mt-2 w-10 h-10 rounded-md hover:bg-gray-100 flex items-center justify-center text-text-secondary"
      >
        {collapsed ? "→" : "←"}
      </button>
      <nav className="flex-1 p-2 lg:p-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 h-11 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
                collapsed ? "justify-center px-0" : "px-4"
              } ${isActive ? "bg-primary-light text-primary border-l-[3px] border-primary" : "text-text-secondary hover:bg-gray-50"}`
            }
          >
            <span className={`w-9 h-9 rounded-full ${item.chip} flex items-center justify-center shrink-0`} aria-hidden><item.Icon size={19} strokeWidth={1.8} /></span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={`p-4 border-t border-border flex flex-col gap-2 ${collapsed ? "items-center" : ""}`}>
        {collapsed ? (
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" title="Đã đồng bộ" />
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Đã đồng bộ
          </div>
        )}
        <button
          onClick={() => setConfirmLogout(true)}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className={`flex items-center gap-3 h-11 rounded-md text-sm font-medium text-danger hover:bg-[#FEF2F2] transition-colors min-h-[44px] ${collapsed ? "justify-center w-11" : "px-4 w-full"}`}
        >
          <span className="shrink-0" aria-hidden><LogOut size={19} strokeWidth={1.8} /></span>
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
      {confirmLogout && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 w-full max-w-[360px] text-center animate-scale-in">
            <h3 className="font-bold">Đăng xuất?</h3>
            <p className="text-sm text-text-secondary mt-2">Dữ liệu local trên thiết bị vẫn được giữ lại.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 h-11 border border-border rounded-button font-medium hover:bg-gray-50 active:scale-[0.97] transition-all">Hủy</button>
              <button onClick={() => { logout(); nav("/welcome"); }} className="flex-1 h-11 bg-danger text-white rounded-button font-medium hover:bg-red-600 active:scale-[0.97] transition-all">Đăng xuất</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
