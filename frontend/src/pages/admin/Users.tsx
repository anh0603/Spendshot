import { useEffect, useState } from "react";
import { Crown, Lock, Download } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { listUsers, getUserDetail, updateUser, setUserPassword } from "../../lib/admin";
import { formatVND } from "../../lib/formatVND";
import { photoUrl } from "../../lib/photo";
import { NoPhoto } from "../../components/expense/NoPhoto";
import { parseServerTime } from "../../lib/time";

export function AdminUsers(){
  const [data,setData]=useState<any>(null);
  const [search,setSearch]=useState("");
  const [plan,setPlan]=useState("");
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<any>(null);
  const [newPw,setNewPw]=useState("");
  const [pwMsg,setPwMsg]=useState("");

  const fetch = async()=>{
    const r=await listUsers({search, plan, page:String(page), limit:"10"});
    setData(r);
  };
  useEffect(()=>{ fetch(); },[page, plan]);

  const open = async(id:string)=>{
    setNewPw(""); setPwMsg("");
    const d=await getUserDetail(id);
    setSelected(d);
  };

  const exportCSV = async()=>{
    const all = await listUsers({ search, plan, page: "1", limit: "50" });
    const rows = [["Email", "Ten", "Goi", "Trang thai", "Ngay tao"]];
    for (const u of all.users || []) {
      rows.push([u.email, u.name || "", u.role, u.status, u.created_at]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "spendshot-users.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doSetPassword = async()=>{
    setPwMsg("");
    if(newPw.length < 6){ setPwMsg("Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    try{
      await setUserPassword(selected.id, newPw);
      setPwMsg("Đã đặt mật khẩu mới cho người dùng");
      setNewPw("");
    }catch(e:any){ setPwMsg(e.message); }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Người dùng</h1>
      <form onSubmit={(e)=>{ e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2 mb-4 flex-wrap">
        <input placeholder="Tìm email hoặc mã code (SS-...)" value={search} onChange={e=>setSearch(e.target.value)} className="h-10 px-4 border-0 rounded-lg bg-white shadow-sm w-64 max-w-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400"/>
        <button type="submit" className="px-4 h-10 bg-primary text-white rounded-lg active:scale-[0.97] transition-transform">Tìm</button>
        <select value={plan} onChange={e=>setPlan(e.target.value)} className="h-10 px-3 border-0 rounded-lg bg-white shadow-sm text-sm focus:outline-none">
          <option value="">Tất cả gói</option><option value="FREE">FREE</option><option value="PREMIUM">PREMIUM</option>
        </select>
        <button type="button" onClick={exportCSV} className="h-10 px-4 rounded-lg bg-white shadow-sm text-sm font-medium flex items-center gap-2 hover:shadow-md active:scale-[0.97] transition-all">
          <Download size={17} /> Xuất CSV
        </button>
      </form>
      {/* Mobile: thẻ gọn thay bảng */}
      <div className="md:hidden flex flex-col gap-3">
        {data?.users?.map((u:any)=>(
          <button key={u.id} onClick={()=>open(u.id)} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
            {photoUrl(u.avatar) ? (
              <img src={photoUrl(u.avatar)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] flex items-center justify-center text-white font-bold shrink-0">{u.email[0].toUpperCase()}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{u.email}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${u.role==="PREMIUM" ? "bg-primary text-white" : "bg-gray-100"}`}>{u.role}</span>
                {" • "}{u.status==="ACTIVE"?"Hoạt động":"Bị khóa"}
              </p>
            </div>
            <span className="text-blue-600 text-sm font-medium shrink-0">Xem ›</span>
          </button>
        ))}
        {data && data.users?.length===0 && <p className="text-center text-sm text-text-secondary py-8">Không có người dùng nào</p>}
      </div>
      <Reveal delay={60}>
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-x-auto hover:shadow-md transition-shadow">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Ảnh</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3">Gói</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Ngày tạo</th><th className="px-4 py-3">Hành động</th></tr></thead>
          <tbody>
            {data?.users?.map((u:any)=>(
              <tr key={u.id} className="border-b border-slate-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4">
                  {photoUrl(u.avatar) ? (
                    <img src={photoUrl(u.avatar)} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] flex items-center justify-center text-white text-xs font-bold">{u.email[0].toUpperCase()}</div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <p>{u.email}</p>
                  {u.name && <p className="text-xs text-text-secondary">{u.name}</p>}
                </td>
                <td className="px-4 py-4 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role==="PREMIUM" ? "bg-gradient-to-r from-primary to-[#FF8A5C] text-white" : "bg-gray-100"}`}>{u.role}</span></td>
                <td className="px-4 py-4 text-center"><span className={`w-2 h-2 inline-block rounded-full ${u.status==="ACTIVE"?"bg-success":"bg-danger"}`}/> {u.status==="ACTIVE"?"Hoạt động":"Bị khóa"}</td>
                <td className="px-4 py-4">{parseServerTime(u.created_at).toLocaleDateString("vi-VN")}</td>
                <td className="px-4 py-4"><button onClick={()=>open(u.id)} className="text-blue-600 hover:text-blue-800 font-medium">Xem</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Reveal>
      <div className="flex gap-2 mt-4">
        <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 h-9 border rounded disabled:opacity-30">Trước</button>
        <span className="px-3 h-9 flex items-center text-sm">Trang {page} / {Math.ceil((data?.total||0)/10)||1}</span>
        <button onClick={()=>setPage(p=>p+1)} className="px-3 h-9 border rounded">Sau</button>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={()=>setSelected(null)}/>
          <div className="relative bg-white rounded-modal w-full max-w-[560px] max-h-[90vh] overflow-auto animate-scale-in">
            <div className="bg-gradient-to-br from-primary to-[#FF8A5C] p-6 text-white flex items-center gap-4">
              {photoUrl(selected.avatar) ? (
                <img src={photoUrl(selected.avatar)} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-2xl font-bold">
                  {selected.email[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold truncate">{selected.name || selected.email.split("@")[0]}</p>
                <p className="text-xs opacity-80 truncate">{selected.email}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${selected.role!=="FREE" ? "bg-white text-primary" : "bg-white/20"}`}>
                  {selected.role === "PREMIUM" ? (
                    <span className="flex items-center gap-1"><Crown size={12} strokeWidth={2}/> PREMIUM</span>
                  ) : selected.role}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Trạng thái</p><p className="font-medium mt-0.5">{selected.status==="ACTIVE"?"Hoạt động":"Bị khóa"}</p></div>
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Ngày tạo</p><p className="font-medium mt-0.5">{parseServerTime(selected.created_at).toLocaleString("vi-VN")}</p></div>
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Hoạt động cuối</p><p className="font-medium mt-0.5">{selected.last_activity ? parseServerTime(selected.last_activity).toLocaleString("vi-VN") : "—"}</p></div>
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Tổng đã chi</p><p className="font-medium mt-0.5 text-primary">{formatVND(selected.total_spent || 0)}</p></div>
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Số Hũ</p><p className="font-medium mt-0.5">{selected.jars}</p></div>
                <div className="bg-bg rounded-md p-3"><p className="text-xs text-text-secondary">Số khoản chi</p><p className="font-medium mt-0.5">{selected.expenses}</p></div>
                <div className="bg-bg rounded-md p-3 col-span-2"><p className="text-xs text-text-secondary">Mã code thanh toán (chỉ admin thấy)</p><p className="font-mono font-bold mt-0.5 text-primary">{selected.pay_code || "—"}</p></div>
              </div>

              {selected.recent_expenses?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Chi tiêu gần đây</p>
                  <div className="grid grid-cols-5 gap-2">
                    {selected.recent_expenses.map((e:any)=>(
                      photoUrl(e.thumbnail || e.photo) ? (
                        <img key={e.id} src={photoUrl(e.thumbnail || e.photo)} alt={formatVND(e.amount)} title={formatVND(e.amount)} className="w-full aspect-square object-cover rounded-md" loading="lazy"/>
                      ) : (
                        <NoPhoto key={e.id} className="w-full aspect-square rounded-md" title={formatVND(e.amount)} />
                      )
                    ))}
                  </div>
                </div>
              )}

              {(selected.role === "FREE" || selected.role === "PREMIUM") ? (
              <>
              <div className="flex gap-2 mt-5 flex-wrap">
                <button onClick={async()=>{ await updateUser(selected.id,{role: selected.role==="FREE"?"PREMIUM":"FREE"}); const d=await getUserDetail(selected.id); setSelected(d); fetch();}} className="px-4 h-10 bg-primary text-white rounded-button text-sm font-medium active:scale-[0.97] transition-transform">Đổi gói</button>
                <button onClick={async()=>{ await updateUser(selected.id,{status: selected.status==="ACTIVE"?"SUSPENDED":"ACTIVE"}); const d=await getUserDetail(selected.id); setSelected(d); fetch();}} className="px-4 h-10 border border-border rounded-button text-sm active:scale-[0.97] transition-transform">{selected.status==="ACTIVE"?"Khóa":"Mở khóa"}</button>
                <button onClick={()=>setSelected(null)} className="px-4 h-10 border border-border rounded-button text-sm">Đóng</button>
              </div>

              <div className="mt-5 p-4 rounded-lg bg-[#FEF2F2] border border-danger/20">
                <p className="text-sm font-medium flex items-center gap-2"><Lock size={16}/> Đặt mật khẩu mới cho tài khoản này</p>
                <form onSubmit={(e)=>{ e.preventDefault(); doSetPassword(); }} className="flex gap-2 mt-3">
                  <input type="text" value={newPw} onChange={(e)=>setNewPw(e.target.value)} placeholder="Mật khẩu mới (ít nhất 6 ký tự)" className="flex-1 h-10 px-3 border border-border rounded-md text-sm focus:border-danger outline-none bg-white" />
                  <button type="submit" className="px-4 h-10 bg-danger text-white rounded-button text-sm font-medium active:scale-[0.97] transition-transform">Đặt</button>
                </form>
                {pwMsg && <p className="text-xs mt-2 text-text-secondary">{pwMsg}</p>}
              </div>
              </>
              ) : (
              <div className="mt-5">
                <p className="text-sm text-text-secondary text-center p-3 bg-bg rounded-md">Tài khoản quản trị — chỉ xem, không thể thay đổi ở đây.</p>
                <button onClick={()=>setSelected(null)} className="px-4 h-10 border border-border rounded-button text-sm w-full mt-3">Đóng</button>
              </div>
              )}
              <p className="text-xs text-text-secondary mt-3">Không hiển thị mật khẩu hiện tại của người dùng.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
