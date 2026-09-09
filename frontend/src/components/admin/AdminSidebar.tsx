import { useState, type ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Crown, BadgeCheck, Megaphone, HardDrive, RefreshCw, ScrollText, BellRing, Settings, LogOut } from "lucide-react";
import { Logo } from "../ui/Logo";
import { logout } from "../../lib/auth";
export const adminNavItems: {
  label: string; path: string; Icon: ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>
}[] = [
  { label: "Bảng điều khiển", path: "/admin", Icon: LayoutDashboard },
  { label: "Người dùng", path: "/admin/users", Icon: Users },
  { label: "Gói đăng ký", path: "/admin/subscriptions", Icon: Crown },
  { label: "Duyệt Premium", path: "/admin/requests", Icon: BadgeCheck },
  { label: "Quảng cáo", path: "/admin/ads", Icon: Megaphone },
  { label: "Lưu trữ", path: "/admin/storage", Icon: HardDrive },
  { label: "Giám sát đồng bộ", path: "/admin/sync", Icon: RefreshCw },
  { label: "Nhật ký kiểm toán", path: "/admin/audit", Icon: ScrollText },
  { label: "Thông báo", path: "/admin/notifications", Icon: BellRing },
  { label: "Cài đặt", path: "/admin/settings", Icon: Settings },
];
export function AdminSidebar(){
  const collapsedDefault = typeof window !== "undefined" ? window.innerWidth < 1024 && window.innerWidth >= 768 : false;
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const nav = useNavigate();
  return (
    <aside className={`hidden md:flex flex-col shrink-0 bg-white border-r border-border h-screen sticky top-0 transition-all duration-200 ${collapsed ? "w-[72px]" : "w-[260px]"}`}>
      <div className={`h-16 flex items-center gap-2 border-b border-border font-bold ${collapsed ? "justify-center px-2" : "px-6"}`}>
        <span title="SpendShot Admin"><Logo size={30} /></span>
        {!collapsed && <span>SpendShot Admin</span>}
      </div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
        className="xl:hidden mx-auto mt-2 w-10 h-10 rounded-md hover:bg-gray-100 flex items-center justify-center text-text-secondary"
      >
        {collapsed ? "→" : "←"}
      </button>
      <nav className="flex-1 p-2 lg:p-3 flex flex-col gap-1">
        {adminNavItems.map(({label,path,Icon})=>(
          <NavLink key={path} to={path} end={path==="/admin"} title={collapsed ? label : undefined} className={({isActive})=>`h-10 flex items-center gap-2 rounded-md text-sm min-h-[44px] ${collapsed ? "justify-center px-0" : "px-3"} ${isActive?"bg-primary-light text-primary":"text-text-secondary hover:bg-gray-50"}`}>
            <span aria-hidden><Icon size={19} strokeWidth={1.8} /></span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 lg:p-3 border-t border-border">
        <button
          onClick={() => { if(confirm("Đăng xuất khỏi trang Admin?")){ logout(); nav("/welcome"); } }}
          title="Đăng xuất"
          className={`h-11 flex items-center gap-2 rounded-md text-sm font-medium text-danger hover:bg-[#FEF2F2] min-h-[44px] w-full ${collapsed ? "justify-center px-0" : "px-3"}`}
        >
          <span aria-hidden><LogOut size={19} strokeWidth={1.8} /></span>
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}
