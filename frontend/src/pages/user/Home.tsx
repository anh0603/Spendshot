import { Header } from "../../components/layout/Header";
import { JarCard } from "../../components/jar/JarCard";
import { ExpenseCard, ExpenseGrid } from "../../components/expense/ExpenseCard";
import { AdsBanner, NativeAdCard } from "../../components/ads/AdsBanner";
import { PremiumUpsellBanner } from "../../components/ads/PremiumUpsellBanner";
import { useState, useEffect, lazy, Suspense, useRef } from "react";
// Overlay nặng chỉ tải khi mở — trang chủ hiện nhanh hơn
const JarActions = lazy(() => import("../../components/jar/JarActions").then((m) => ({ default: m.JarActions })));
const ExpenseModal = lazy(() => import("../../components/expense/ExpenseModal").then((m) => ({ default: m.ExpenseModal })));
const CameraOverlay = lazy(() => import("../../components/expense/CameraOverlay").then((m) => ({ default: m.CameraOverlay })));
const PremiumUpsell = lazy(() => import("../../components/expense/CameraOverlay").then((m) => ({ default: m.PremiumUpsell })));
import { useSearchParams } from "react-router-dom";
import { getUser, refreshUser } from "../../lib/auth";
import { parseServerTime } from "../../lib/time";
import { listJars, createJar } from "../../lib/jar";
import { listExpenses, deleteExpense } from "../../lib/expense";
import { Button } from "../../components/ui/Button";
import { SyncIndicator } from "../../components/SyncIndicator";
import { saveJarLocal } from "../../lib/localFirst";
import { db } from "../../db";
import { photoUrl } from "../../lib/photo";
import { AmountField } from "../../components/ui/AmountField";
import { PiggyBank, Camera, CalendarRange } from "lucide-react";
import { PhotoViewer } from "../../components/expense/PhotoViewer";
import { MonthsSheet } from "../../components/expense/MonthsSheet";

export function Home() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [jar, setJar] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [showMonths, setShowMonths] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captured, setCaptured] = useState<File | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState(getUser());

  // Mở camera trực tiếp khi vào /?camera=1 (nút FAB mobile).
  // Lắng nghe searchParams để bấm FAB ngay trên trang chủ cũng mở được.
  useEffect(() => {
    if (searchParams.get("camera") === "1") {
      setCameraOpen(true);
      searchParams.delete("camera");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Chống đua request: lần tải cũ về sau sẽ bị bỏ, không ghi đè dữ liệu mới
  const fetchSeq = useRef(0);

  const fetchAll = async () => {
    const seq = ++fetchSeq.current;
    const alive = () => seq === fetchSeq.current;
    try {
      // Làm mới thông tin user (role sau khi admin duyệt/hạ cấp, tên mới...) để UI nhận ngay
      const fresh = await refreshUser();
      if (!alive()) return;
      if (fresh) setMe(fresh);
      const u = fresh || JSON.parse(localStorage.getItem("spendshot_user")||"null");
      // try local first if offline
      if (!navigator.onLine && u) {
        const localJars = await db.jars.where("user_id").equals(u.id).toArray();
        if (!alive()) return;
        if (localJars.length>0) { setJar(localJars[0]); const exps=await db.expenses.where("jar_id").equals(localJars[0].id).toArray(); if (!alive()) return; setExpenses(exps); }
      } else {
        const jars = await listJars();
        if (!alive()) return;
        if (jars.length > 0) {
          setJar(jars[0]);
          // cache to IndexedDB
          for(const j of jars) await db.jars.put({...j, user_id: u?.id||"", sync_status:"SYNCED"});
          const exps = await listExpenses(jars[0].id);
          if (!alive()) return;
          setExpenses(exps);
          for(const e of exps) await db.expenses.put({...e, user_id: u?.id||"", sync_status:"SYNCED"});
        } else setJar(null);
      }
    } catch {
      // fallback to local
      try{ const u=JSON.parse(localStorage.getItem("spendshot_user")||"null"); if(u){ const lj=await db.jars.where("user_id").equals(u.id).toArray(); if(lj.length && alive()) setJar(lj[0]); }}catch{}
    }
    if (alive()) setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    // Đổi tên/avatar ở Hồ sơ thì trang chủ cập nhật ngay, khỏi tải lại
    const onUserUpdated = () => setMe(getUser());
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("spendshot:user-updated", onUserUpdated);
    window.addEventListener("focus", onUserUpdated);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("spendshot:user-updated", onUserUpdated); window.removeEventListener("focus", onUserUpdated); };
  }, []);

  const [showCreateJar, setShowCreateJar] = useState(false);
  const [newJarName, setNewJarName] = useState("");
  const [newJarBudget, setNewJarBudget] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [creating, setCreating] = useState(false);

  // Cập nhật UI ngay từ dữ liệu server trả về — không chờ tải lại
  const applyJar = (j: any) => {
    if (!j || !j.id) return;
    setJar((prev: any) => ({ ...(prev || {}), ...j }));
  };

  const handleCreate = async () => {
    const budget = parseInt(newJarBudget.replace(/\D/g, ""), 10);
    if (!budget || budget <= 0) { setCreateErr("Vui lòng nhập số tiền ngân sách"); return; }
    const nm = newJarName.trim() || `Hũ ${new Date().toISOString().slice(0, 7)}`;
    setCreating(true); setCreateErr("");
    try {
      const u = JSON.parse(localStorage.getItem("spendshot_user") || "null");
      if (!navigator.onLine) {
        const jar = { id: crypto.randomUUID(), user_id: u.id, name: nm, budget, spent: 0, month: new Date().toISOString().slice(0, 7), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: "PENDING" as const };
        await saveJarLocal(jar);
        setJar(jar);
      } else {
        const created = await createJar(budget, undefined, nm);
        setJar(created);
        setExpenses([]);
      }
      setShowCreateJar(false);
      setNewJarName(""); setNewJarBudget("");
      fetchAll();
    } catch (e: any) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const handleExpenseCreated = (exp: any) => {
    if (exp?.id) {
      setExpenses((prev) => [exp, ...prev]);
      setJar((prev: any) => (prev ? { ...prev, spent: (prev.spent || 0) + exp.amount } : prev));
    }
    setCaptured(null);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa khoản chi này?")) return;
    const target = expenses.find((e) => e.id === id);
    try {
      await deleteExpense(id);
      if (target) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        setJar((prev: any) => (prev ? { ...prev, spent: Math.max(0, (prev.spent || 0) - target.amount) } : prev));
      }
    } catch { /* báo lỗi nhưng giữ dữ liệu cũ */ }
    fetchAll();
    setSelIdx(null);
  };

  const handleJarUpdated = (j: any) => {
    if (j === null) {
      // Đã xóa Hũ
      setJar(null);
      setExpenses([]);
    } else {
      applyJar(j);
    }
    fetchAll();
  };

  const handleGallery = ()=>{
    const u=JSON.parse(localStorage.getItem("spendshot_user")||"null");
    if(u?.role==="FREE"){ setUpsell(true); return; }
    // open file picker
    const inp=document.createElement("input");
    inp.type="file"; inp.accept="image/jpeg,image/png,image/webp";
    inp.onchange=()=>{ const f=inp.files?.[0]; if(f){ setCaptured(f); setCameraOpen(false); setShowExpense(true); } };
    inp.click();
  };

  // Chụp xong vào thẳng màn hình nhập tiền — không qua bước trung gian
  const handleCapture = (file: File)=>{
    setCaptured(file);
    setCameraOpen(false);
    setShowExpense(true);
  };

  const handleRetake = ()=>{
    setCaptured(null);
    setShowExpense(false);
    setCameraOpen(true);
  };

  const displayName = me?.name || me?.email?.split("@")[0] || "Bạn";

  const [filter, setFilter] = useState<"today" | "week">("today");
  const filteredExpenses = expenses.filter((e) => {
    const d = parseServerTime(e.created_at);
    const now = new Date();
    if (filter === "today") return d.toDateString() === now.toDateString();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  });

  // Xem ảnh: index trong danh sách đang lọc (vuốt trong PhotoViewer)
  const selSafe = selIdx != null && filteredExpenses.length > 0 ? Math.min(selIdx, filteredExpenses.length - 1) : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header offline={offline} userName={displayName} avatar={me?.avatar} />
      <div className="max-w-[1200px] mx-auto p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex justify-between items-center mb-4 hidden lg:flex">
          <h1 className="text-2xl font-bold">Trang chủ</h1>
          <div className="flex items-center gap-3">
            <SyncIndicator/>
            {jar && (
              <button onClick={()=>setCameraOpen(true)} aria-label="Chụp khoản chi" className="h-11 px-5 rounded-button bg-gradient-to-br from-primary to-[#FF8A5C] text-white text-sm font-semibold flex items-center gap-2 shadow hover:shadow-lg active:scale-[0.97] transition-all">
                <Camera size={19} strokeWidth={1.8}/> Chụp chi tiêu
              </button>
            )}
          </div>
        </div>
        <div className="lg:hidden flex justify-end mb-2"><SyncIndicator/></div>
        {loading ? <div className="h-40 bg-white rounded-modal animate-pulse"/> : jar ? (
          <JarCard budget={jar.budget} spent={jar.spent} onClick={() => setShowActions(true)} />
        ) : (
          <div className="bg-white rounded-modal p-8 text-center border border-border">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary-light text-primary flex items-center justify-center"><PiggyBank size={28} strokeWidth={1.8}/></div>
            <p className="font-medium">Chưa có Hũ nào</p>
            <p className="text-sm text-text-secondary mb-4">Tạo Hũ tháng để bắt đầu quản lý chi tiêu</p>
            <Button onClick={() => { setCreateErr(""); setShowCreateJar(true); }}>Tạo Hũ mới</Button>
          </div>
        )}

        {showCreateJar && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setShowCreateJar(false)} />
            <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-sheet lg:rounded-modal p-6 animate-slide-up">
              <h3 className="font-bold text-lg mb-4">Tạo Hũ mới</h3>
              <form onSubmit={(e)=>{ e.preventDefault(); handleCreate(); }}>
              <label className="block text-sm font-medium mb-2">Tên Hũ</label>
              <input value={newJarName} onChange={(e) => setNewJarName(e.target.value)} placeholder="VD: Hũ tháng 9, Ăn uống..." maxLength={50} className="w-full h-12 px-4 border border-border rounded-md focus:border-primary outline-none mb-4" />
              <label className="block text-sm font-medium mb-2">Ngân sách (₫)</label>
              <div className="mb-3"><AmountField value={newJarBudget} onChange={setNewJarBudget} placeholder="VD: 2.000.000" /></div>
              <div className="flex gap-2 justify-center mb-4 flex-wrap">
                {[500000, 1000000, 2000000, 5000000].map((v) => (
                  <button key={v} type="button" onClick={() => { const cur = parseInt((newJarBudget || "").replace(/\D/g, ""), 10) || 0; setNewJarBudget(String(cur + v)); }} className="px-3 h-8 rounded-full bg-primary-light text-primary text-xs font-medium hover:bg-primary hover:text-white transition-colors">
                    {v >= 1000000 ? `+${v / 1000000}Tr` : `+${v / 1000}K`}
                  </button>
                ))}
              </div>
              {createErr && <p className="text-sm text-danger mb-3 text-center">{createErr}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreateJar(false)}>Hủy</Button>
                <Button type="submit" className="flex-1" loading={creating}>Tạo Hũ</Button>
              </div>
              </form>
            </div>
          </div>
        )}

        {showActions && jar && (
          <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={()=>setShowActions(false)}/>
            <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-sheet lg:rounded-modal max-h-[80vh] overflow-auto animate-slide-up">
              <JarActions jarId={jar.id} onClose={()=>setShowActions(false)} onUpdated={handleJarUpdated}/>
            </div>
          </div>
          </Suspense>
        )}
        {showExpense && jar && (
          <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={()=>{setShowExpense(false); setCaptured(null);}}/>
            <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-sheet lg:rounded-modal max-h-[80vh] overflow-auto animate-slide-up">
              <ExpenseModal jarId={jar.id} initialFile={captured} onRetake={captured ? handleRetake : undefined} onClose={()=>{setShowExpense(false); setCaptured(null);}} onCreated={(exp)=>{setShowExpense(false); handleExpenseCreated(exp);}}/>
            </div>
          </div>
          </Suspense>
        )}
        {cameraOpen && !captured && <Suspense fallback={null}><CameraOverlay onCapture={handleCapture} onClose={()=>setCameraOpen(false)} onGallery={handleGallery} onSkip={()=>{ setCameraOpen(false); setShowExpense(true); }}/></Suspense>}
        {upsell && (
          <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={()=>setUpsell(false)}/>
            <div className="relative bg-white w-full lg:max-w-[480px] rounded-t-sheet lg:rounded-modal animate-slide-up"><PremiumUpsell onClose={()=>setUpsell(false)} onUpgrade={()=>{setUpsell(false); window.location.href="/premium";}}/></div>
          </div>
          </Suspense>
        )}
        {selSafe != null && (
          <PhotoViewer
            items={filteredExpenses}
            index={selSafe}
            onNav={(i) => setSelIdx(i)}
            onClose={() => setSelIdx(null)}
            onDelete={handleDelete}
          />
        )}
        {showMonths && (
          <Suspense fallback={null}>
            <MonthsSheet
              items={filteredExpenses}
              onClose={() => setShowMonths(false)}
              onSelect={(id) => {
                const i = filteredExpenses.findIndex((x) => x.id === id);
                if (i >= 0) {
                  setShowMonths(false);
                  setSelIdx(i);
                }
              }}
            />
          </Suspense>
        )}

        <div className="mt-6">
          <PremiumUpsellBanner />
        </div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              {(["today", "week"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium min-h-[36px] active:scale-95 transition-all ${filter === f ? "bg-primary text-white shadow" : "bg-white border border-border text-text-secondary hover:border-primary"}`}
                >
                  {f === "today" ? "Hôm nay" : "Tuần này"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{filteredExpenses.length} khoản</span>
              <button
                onClick={() => setShowMonths(true)}
                aria-label="Xem ảnh theo tháng"
                title="Xem ảnh theo tháng"
                className="h-9 px-3 rounded-lg flex items-center gap-1.5 bg-white border border-border text-text-secondary text-xs font-medium hover:border-primary active:scale-95 transition-all"
              >
                <CalendarRange size={18} /> Theo tháng
              </button>
            </div>
          </div>
          {filteredExpenses.length===0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
              <img src="/piggy-bank-illustration.png" alt="Empty" className="w-40 h-40 mx-auto object-contain" />
              <p className="text-lg text-gray-500 mt-4">{expenses.length === 0 ? "Chưa có khoản chi nào" : filter === "today" ? "Hôm nay chưa có khoản chi nào" : "Tuần này chưa có khoản chi nào"}</p>
              {jar && expenses.length === 0 && <Button className="mt-4" onClick={()=>setCameraOpen(true)}>Chụp khoản chi đầu tiên</Button>}
            </div>
          ) : (
            <>
              <ExpenseGrid>
                {filteredExpenses.map((e, idx) => (
                  <>
                    <ExpenseCard key={e.id} photo={photoUrl(e.thumbnail || e.photo)} amount={e.amount} time={parseServerTime(e.created_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} onClick={()=>setSelIdx(idx)} enterDelay={idx * 50}/>
                    {(idx+1)%8===0 && <NativeAdCard key={`ad-${idx}`}/>}
                  </>
                ))}
              </ExpenseGrid>
              <div className="mt-6"><AdsBanner/></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
