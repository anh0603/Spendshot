import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

/** Chuyển trang mờ dần — mỗi route hiện mượt thay vì đơ */
function PageFade({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div key={loc.pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
import { DesktopSidebar } from "./components/layout/DesktopSidebar";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { Home } from "./pages/user/Home";
import { Welcome } from "./pages/auth/Welcome";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { lazy, Suspense } from "react";
// Lazy-load trang nặng để mở app nhanh — chỉ tải khi vào trang đó
const PremiumPage = lazy(() => import("./pages/user/Premium").then((m) => ({ default: m.PremiumPage })));
const ProfilePage = lazy(() => import("./pages/user/Profile").then((m) => ({ default: m.ProfilePage })));
const StatisticsPage = lazy(() => import("./pages/user/Statistics").then((m) => ({ default: m.StatisticsPage })));
const PaymentPage = lazy(() => import("./pages/user/Payment").then((m) => ({ default: m.PaymentPage })));
const SubscriptionsPage = lazy(() => import("./pages/admin/Subscriptions").then((m) => ({ default: m.SubscriptionsPage })));
const UpgradeRequestsPage = lazy(() => import("./pages/admin/Requests").then((m) => ({ default: m.UpgradeRequestsPage })));
const AdsPage = lazy(() => import("./pages/admin/Ads").then((m) => ({ default: m.AdsPage })));
const SyncMonitorPage = lazy(() => import("./pages/admin/SyncMonitor").then((m) => ({ default: m.SyncMonitorPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/Settings").then((m) => ({ default: m.AdminSettingsPage })));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard").then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import("./pages/admin/Users").then((m) => ({ default: m.AdminUsers })));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs").then((m) => ({ default: m.AuditLogs })));
const StoragePage = lazy(() => import("./pages/admin/Storage").then((m) => ({ default: m.StoragePage })));
const NotificationsAdminPage = lazy(() => import("./pages/admin/Notifications").then((m) => ({ default: m.NotificationsPage })));

function PageLoader() {
  return (
    <div className="p-8 max-w-[600px] mx-auto">
      <div className="h-8 w-40 rounded skeleton mb-4" />
      <div className="h-40 rounded-modal skeleton" />
    </div>
  );
}
import { AdminSidebar } from "./components/admin/AdminSidebar";
import { AdminMobileNav } from "./components/admin/AdminMobileNav";
import { PWAInstallBanner, PushPermissionModal } from "./components/PWAInstallBanner";
import { ShieldAlert } from "lucide-react";
import { getUser } from "./lib/auth";
import { useState, useEffect } from "react";

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const user = getUser();
  const token = localStorage.getItem("spendshot_token");
  if (!token || !user) return <Navigate to="/welcome" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-bg text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center"><ShieldAlert size={30} strokeWidth={1.8}/></div>
        <h1 className="text-2xl font-bold">403 — Không có quyền truy cập</h1>
        <p className="text-text-secondary mt-2">Bạn không có quyền vào trang Admin</p>
        <a href="/" className="mt-4 px-6 h-11 inline-flex items-center rounded-button bg-primary text-white">Về trang chủ</a>
      </div>
    );
  }
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <DesktopSidebar />
      <main className="flex-1 min-w-0 pb-16 lg:pb-0 bg-[#F9FAFB]">{children}</main>
      <MobileBottomNav />
    </div>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-16 lg:pb-0 bg-slate-50">{children}</main>
      <AdminMobileNav />
    </div>
  );
}

export default function App() {
  const [pushOpen, setPushOpen]=useState(false);
  useEffect(()=>{
    // Đăng ký service worker 1 lần để push + offline hoạt động
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
    // show push pre-prompt after 3s if not decided (persist decision)
    try{
      if(localStorage.getItem("push_decided")==="1") return;
    }catch{/* bỏ qua */}
    if(typeof Notification !== "undefined" && Notification.permission==="default"){
      const t=setTimeout(()=>setPushOpen(true), 3000);
      return ()=>clearTimeout(t);
    }
  },[]);
  return (
    <BrowserRouter>
      <PWAInstallBanner/>
      <PushPermissionModal open={pushOpen} onClose={()=>setPushOpen(false)}/>
      <Suspense fallback={<PageLoader />}>
      <PageFade>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Protected><Layout><Home /></Layout></Protected>} />
        <Route path="/statistics" element={<Protected><Layout><StatisticsPage /></Layout></Protected>} />
        <Route path="/premium" element={<Protected><Layout><PremiumPage /></Layout></Protected>} />
        <Route path="/payment" element={<Protected><Layout><PaymentPage /></Layout></Protected>} />
        <Route path="/admin/requests" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><UpgradeRequestsPage /></AdminLayout></Protected>} />
        <Route path="/profile" element={<Protected><Layout><ProfilePage /></Layout></Protected>} />
        <Route path="/admin" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><AdminDashboard /></AdminLayout></Protected>} />
        <Route path="/admin/users" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><AdminUsers /></AdminLayout></Protected>} />
        <Route path="/admin/audit" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><AuditLogs /></AdminLayout></Protected>} />
        <Route path="/admin/storage" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><StoragePage /></AdminLayout></Protected>} />
        <Route path="/admin/subscriptions" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><SubscriptionsPage /></AdminLayout></Protected>} />
        <Route path="/admin/ads" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><AdsPage /></AdminLayout></Protected>} />
        <Route path="/admin/sync" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><SyncMonitorPage /></AdminLayout></Protected>} />
        <Route path="/admin/notifications" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><NotificationsAdminPage /></AdminLayout></Protected>} />
        <Route path="/admin/settings" element={<Protected roles={["ADMIN","SUPER_ADMIN"]}><AdminLayout><AdminSettingsPage /></AdminLayout></Protected>} />
        <Route path="*" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold">404</h1><p>Không tìm thấy trang</p></div>} />
      </Routes>
      </PageFade>
      </Suspense>
    </BrowserRouter>
  );
}
