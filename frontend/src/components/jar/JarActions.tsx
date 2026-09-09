import { useState } from "react";
import { CirclePlus, CircleMinus, Pencil, History, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { AmountField } from "../ui/AmountField";
import { addMoney, withdrawMoney, getHistory, updateJar, deleteJar } from "../../lib/jar";
import { formatVND } from "../../lib/formatVND";

export function JarActions({ jarId, onClose, onUpdated }: { jarId: string; onClose: () => void; onUpdated: (jar?: any) => void }) {
  const [view, setView] = useState<"menu" | "add" | "withdraw" | "edit" | "history" | "delete">("menu");
  const [amount, setAmount] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [editBudget, setEditBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleAdd = async () => {
    const n = parseInt(amount.replace(/\D/g, ""), 10);
    if (!n) return;
    setLoading(true); setErr("");
    try { const d = await addMoney(jarId, n); onUpdated({ id: jarId, ...d }); onClose(); } catch(e:any){ setErr(e.message);} finally{ setLoading(false);}
  };
  const handleWithdraw = async () => {
    const n = parseInt(amount.replace(/\D/g, ""), 10);
    if (!n) return;
    setLoading(true); setErr("");
    try { const d = await withdrawMoney(jarId, n); onUpdated({ id: jarId, ...d }); onClose(); } catch(e:any){ setErr(e.message);} finally{ setLoading(false);}
  };
  const handleHistory = async () => {
    const h = await getHistory(jarId);
    setHistory(h); setView("history");
  };
  const handleEdit = async () => {
    const n = parseInt(editBudget.replace(/\D/g, ""), 10);
    if (isNaN(n)) return;
    setLoading(true);
    try { const d = await updateJar(jarId, { budget: n }); onUpdated(d); onClose(); } catch(e:any){ setErr(e.message);} finally{ setLoading(false);}
  };

  const quick = [100000,200000,500000,1000000];
  const fmt = (n:number)=> (n>=1000000? "1Tr" : n>=1000? `${n/1000}K` : `${n}`);

  if (view === "add" || view === "withdraw") {
    const isAdd = view==="add";
    const submit = isAdd ? handleAdd : handleWithdraw;
    return (
      <div className="p-6">
        <h3 className="font-bold text-lg mb-2">{isAdd ? "Thêm tiền" : "Rút tiền"}</h3>
        <form onSubmit={(e)=>{ e.preventDefault(); submit(); }}>
        <AmountField value={amount} onChange={setAmount} />
        <div className="flex gap-2 justify-center my-3 flex-wrap">
          {quick.map(q=> <button key={q} type="button" onClick={()=>{ const cur=parseInt(amount.replace(/\D/g,""),10)||0; setAmount(String(cur+q));}} className="px-4 h-9 rounded-full bg-primary-light text-primary text-sm font-medium">+{fmt(q)}</button>)}
        </div>
        {err && <p className="text-sm text-danger text-center">{err}</p>}
        <div className="flex gap-3 mt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={()=>setView("menu")}>Hủy</Button>
          <Button type="submit" className="flex-1" loading={loading}>{isAdd? "Thêm": "Rút"}</Button>
        </div>
        </form>
      </div>
    );
  }
  if (view === "edit") {
    return (
      <div className="p-6">
        <h3 className="font-bold text-lg mb-2">Sửa Hũ</h3>
        <form onSubmit={(e)=>{ e.preventDefault(); handleEdit(); }}>
        <label className="text-sm">Ngân sách mới</label>
        <div className="mt-1"><AmountField value={editBudget} onChange={setEditBudget} large={false} placeholder="2.000.000" /></div>
        {err && <p className="text-sm text-danger mt-2">{err}</p>}
        <div className="flex gap-3 mt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={()=>setView("menu")}>Hủy</Button>
          <Button type="submit" className="flex-1" loading={loading}>Lưu</Button>
        </div>
        </form>
      </div>
    );
  }
  const handleDelete = async () => {
    setLoading(true); setErr("");
    try { await deleteJar(jarId); onUpdated(null); onClose(); } catch(e:any){ setErr(e.message); setView("menu"); } finally{ setLoading(false); }
  };

  if (view === "delete") {
    return (
      <div className="p-6 text-center animate-scale-in">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center"><Trash2 size={26} strokeWidth={1.8}/></div>
        <h3 className="font-bold text-lg">Xóa Hũ này?</h3>
        <p className="text-sm text-text-secondary mt-2">Toàn bộ khoản chi trong Hũ cũng bị xóa vĩnh viễn. Không thể hoàn tác.</p>
        {err && <p className="text-sm text-danger mt-2">{err}</p>}
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={()=>setView("menu")}>Hủy</Button>
          <Button variant="danger" className="flex-1" loading={loading} onClick={handleDelete}>Xóa vĩnh viễn</Button>
        </div>
      </div>
    );
  }
  if (view === "history") {
    return (
      <div className="p-6 max-h-[60vh] overflow-auto">
        <h3 className="font-bold text-lg mb-3">Lịch sử</h3>
        {history.length===0? <p className="text-sm text-text-secondary">Chưa có giao dịch</p> : history.map((h:any)=>
          <div key={h.id} className="flex justify-between py-2 border-b border-border text-sm">
            <span>{h.type} • {h.note}</span>
            <span className="font-medium">{formatVND(h.amount)}</span>
          </div>)}
        <Button variant="secondary" className="w-full mt-4" onClick={()=>setView("menu")}>Đóng</Button>
      </div>
    );
  }
  return (
    <div className="p-2">
      <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-3 lg:hidden"/>
      <button onClick={()=>setView("add")} className="w-full text-left px-4 h-14 hover:bg-gray-50 flex items-center gap-3 active:scale-[0.98] transition-transform"><span className="w-9 h-9 rounded-full bg-green-50 text-success flex items-center justify-center"><CirclePlus size={19} strokeWidth={1.8}/></span> Thêm tiền</button>
      <button onClick={()=>setView("withdraw")} className="w-full text-left px-4 h-14 hover:bg-gray-50 flex items-center gap-3 active:scale-[0.98] transition-transform"><span className="w-9 h-9 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center"><CircleMinus size={19} strokeWidth={1.8}/></span> Rút tiền</button>
      <button onClick={()=>setView("edit")} className="w-full text-left px-4 h-14 hover:bg-gray-50 flex items-center gap-3 active:scale-[0.98] transition-transform"><span className="w-9 h-9 rounded-full bg-blue-50 text-info flex items-center justify-center"><Pencil size={19} strokeWidth={1.8}/></span> Sửa Hũ</button>
      <button onClick={handleHistory} className="w-full text-left px-4 h-14 hover:bg-gray-50 flex items-center gap-3 active:scale-[0.98] transition-transform"><span className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center"><History size={19} strokeWidth={1.8}/></span> Lịch sử</button>
      <button onClick={()=>setView("delete")} className="w-full text-left px-4 h-14 hover:bg-[#FEF2F2] flex items-center gap-3 active:scale-[0.98] transition-transform text-danger"><span className="w-9 h-9 rounded-full bg-[#FEF2F2] text-danger flex items-center justify-center"><Trash2 size={19} strokeWidth={1.8}/></span> Xóa Hũ</button>
    </div>
  );
}
