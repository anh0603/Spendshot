import { useState } from "react";
import { Camera, Crown, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { FilePicker } from "../ui/FilePicker";
import { AmountField } from "../ui/AmountField";
import { CATEGORIES } from "../../lib/categories";
import { createExpense } from "../../lib/expense";

export function ExpenseModal({ jarId, onClose, onCreated, initialFile, onRetake }: { jarId: string; onClose: () => void; onCreated: (exp?: any) => void; initialFile?: File | null; onRetake?: () => void }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customCat, setCustomCat] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [photo, setPhoto] = useState<File| null>(initialFile||null);
  const [preview, setPreview] = useState(initialFile? URL.createObjectURL(initialFile): "");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGallery, setIsGallery] = useState(false);
  // Upload ảnh từ thư viện chỉ dành cho Premium — FREE không thấy nút này
  const canUpload = (()=>{
    try{ const u=JSON.parse(localStorage.getItem("spendshot_user")||"null"); return u?.role!=="FREE"; }catch{ return false; }
  })();

  const handlePhoto = (f: File | null) => {
    if (f) {
      if (!["image/jpeg","image/png","image/webp"].includes(f.type)) { setErr("Định dạng ảnh không hợp lệ"); return; }
      if (f.size > 5*1024*1024) { setErr("Ảnh vượt quá 5MB"); return; }
      setErr("");
      setIsGallery(true);
      setPhoto(f);
      setPreview(URL.createObjectURL(f));
    } else {
      setIsGallery(false);
      setPhoto(null);
      setPreview("");
    }
  };

  // Production bắt buộc có ảnh (VITE_REQUIRE_PHOTO=true). Dev/test cho qua.
  const REQUIRE_PHOTO = import.meta.env.VITE_REQUIRE_PHOTO === "true";

  const handleSave = async () => {
    const n = parseInt(amount.replace(/\D/g,""),10);
    if (!n) { setErr("Vui lòng nhập số tiền"); return; }
    if (REQUIRE_PHOTO && !photo) { setErr("Vui lòng chụp hoặc tải ảnh lên trước khi lưu"); return; }
    // Chọn Khác → dùng nội dung tự nhập
    const catToSave = category === "Khac" ? (customCat.trim() || "Khác") : category || undefined;
    setLoading(true); setErr("");
    try { const created = await createExpense(jarId, n, catToSave, photo||undefined, isGallery? "gallery":"camera"); onCreated(created); onClose(); } catch(e:any){ setErr(e.message);} finally{ setLoading(false);}
  };

  const selectedCat = CATEGORIES.find((c) => c.value === category);

  return (
    <div className="p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">Thêm khoản chi</h3>
        {onRetake && (
          <button onClick={onRetake} className="text-sm text-primary font-medium flex items-center gap-1 hover:underline min-h-[44px] px-2">
            <RotateCcw size={16} /> Chụp lại
          </button>
        )}
      </div>
      {preview ? (
        <img src={preview} alt="Ảnh khoản chi" className="w-full h-36 object-cover rounded-lg mb-4 animate-pop" />
      ) : (
        <div className="w-full h-24 rounded-lg bg-bg border border-dashed border-border flex items-center justify-center gap-2 text-text-secondary text-sm mb-4">
          <Camera size={20} />
          {canUpload ? "Chụp ảnh hoặc chọn từ thư viện" : "Chụp ảnh bằng camera để có hình"}
        </div>
      )}
      {REQUIRE_PHOTO && !photo && (
        <p className="text-xs text-warning mb-3 text-center">Bắt buộc: chụp hoặc tải ảnh lên mới lưu được</p>
      )}
      {canUpload && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Ảnh từ thư viện <span className="text-text-secondary font-normal">(tùy chọn)</span></p>
          <FilePicker onPick={handlePhoto} placeholder="Chọn ảnh từ thư viện..." />
        </div>
      )}
      {!canUpload && (
        <button onClick={()=>{ window.location.href="/premium"; }} className="w-full h-10 mb-4 rounded-button bg-[#FEF3C7] text-warning text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#FDE68A] transition-colors">
          <Crown size={18}/> Muốn chọn ảnh có sẵn? Premium chỉ 19.000 ₫/tháng
        </button>
      )}
      <form onSubmit={(e)=>{ e.preventDefault(); handleSave(); }}>
      <label className="block text-sm font-medium mb-2">Số tiền</label>
      <div className="mb-3"><AmountField value={amount} onChange={setAmount} /></div>
      <div className="flex gap-2 justify-center mb-4 flex-wrap">
        {[100000,200000,500000,1000000].map(v=> <button key={v} type="button" onClick={()=>{const cur=parseInt(amount.replace(/\D/g,""),10)||0; setAmount(String(cur+v));}} className="px-3 h-8 rounded-full bg-primary-light text-primary text-xs font-medium">{v>=1000000? "+1Tr": `+${v/1000}K`}</button>)}
      </div>
      <label className="block text-sm font-medium mb-2">Danh mục (tùy chọn)</label>
      <div className="mb-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => setCatOpen((v) => !v)}
          className="w-full h-12 px-3 border-0 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center gap-2.5 text-sm active:scale-[0.99] transition-transform"
        >
          {selectedCat ? (
            <>
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${selectedCat.color}1A`, color: selectedCat.color }}>
                <selectedCat.Icon size={17} strokeWidth={1.8} />
              </span>
              <span className="flex-1 text-left font-medium">{selectedCat.label}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-text-secondary">-- Chọn danh mục --</span>
          )}
          <ChevronDown size={18} className={`text-text-secondary transition-transform ${catOpen ? "rotate-180" : ""}`} />
        </button>
        {catOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-2 grid grid-cols-2 gap-1 max-h-64 overflow-auto animate-scale-in">
            <button
              type="button"
              onClick={() => { setCategory(""); setCatOpen(false); }}
              className={`h-11 px-2 rounded-lg text-sm flex items-center gap-2 ${category === "" ? "bg-primary-light text-primary font-medium" : "hover:bg-gray-50"}`}
            >
              <span className="flex-1 text-left">Không chọn</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { setCategory(c.value); setCatOpen(false); }}
                className={`h-11 px-2 rounded-lg text-sm flex items-center gap-2 active:scale-[0.98] transition-transform ${category === c.value ? "bg-primary-light text-primary font-medium" : "hover:bg-gray-50"}`}
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${c.color}1A`, color: c.color }}>
                  <c.Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {category === "Khac" && (
        <input
          value={customCat}
          onChange={(e) => setCustomCat(e.target.value)}
          placeholder="Nhập danh mục của bạn... VD: Tiền xăng"
          maxLength={50}
          className="w-full h-11 px-3 mt-2 border-0 rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-text-secondary animate-slide-up"
        />
      )}
      </div>
      {err && <p className="text-sm text-danger mb-3">{err}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button type="submit" className="flex-1" loading={loading}>Lưu</Button>
        </div>
      </form>
    </div>
  );
}
