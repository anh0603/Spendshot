import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MoreHorizontal, X, LogOut } from "lucide-react";
import { adminNavItems } from "./AdminSidebar";
import { logout } from "../../lib/auth";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const mainPaths = ["/admin", "/admin/users", "/admin/requests"];

/** Menu mobile gọn: 3 mục chính + nút Thêm mở sheet (chứa Đăng xuất) */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    fetch(`${API}/admin/stats/overview`, { headers: { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPending(d.pending_requests || 0); })
      .catch(() => {});
  }, []);

  const mains = adminNavItems.filter((i) => mainPaths.includes(i.path));
  const mores = adminNavItems.filter((i) => !mainPaths.includes(i.path));

  const doLogout = () => {
    if (confirm("Đăng xuất khỏi trang Admin?")) {
      logout();
      nav("/welcome");
    }
  };

  const tab = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 flex-1 min-h-[60px] rounded-xl text-[11px] font-medium ${active ? "text-primary bg-primary-light" : "text-text-secondary"}`;

  return (
    <>
      <nav aria-label="Menu quản trị" className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-border z-30 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="h-16 flex items-stretch gap-1">
          {mains.map(({ label, path, Icon }) => (
            <NavLink key={path} to={path} end={path === "/admin"} className={({ isActive }) => tab(isActive)}>
              <span className="relative">
                <Icon size={24} strokeWidth={1.8} />
                {path === "/admin/requests" && pending > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                    {pending > 9 ? "9+" : pending}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
          <button onClick={() => setOpen(true)} aria-label="Thêm" className="flex flex-col items-center justify-center gap-1 flex-1 min-h-[60px] rounded-xl text-[11px] font-medium text-text-secondary active:scale-95 transition-transform">
            <MoreHorizontal size={24} strokeWidth={1.8} />
            Thêm
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full rounded-t-[24px] max-h-[70vh] overflow-auto animate-slide-up">
            <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-4 py-2">
              <p className="font-bold">Chức năng khác</p>
              <button onClick={() => setOpen(false)} aria-label="Đóng menu" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 pb-6 flex flex-col">
              {mores.map(({ label, path, Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-2 h-14 rounded-xl text-sm font-medium active:scale-[0.99] transition-all ${isActive ? "text-primary bg-primary-light" : "text-text-primary hover:bg-gray-50"}`}
                >
                  <span className="w-9 h-9 rounded-full bg-gray-100 text-text-secondary flex items-center justify-center shrink-0">
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  {label}
                </NavLink>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onClick={doLogout}
                  className="w-full flex items-center gap-3 px-2 h-14 rounded-xl text-sm font-medium text-danger hover:bg-[#FEF2F2] active:scale-[0.99] transition-all"
                >
                  <span className="w-9 h-9 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
                    <LogOut size={19} strokeWidth={1.8} />
                  </span>
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
