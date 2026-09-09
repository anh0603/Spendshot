import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { Button } from "../../components/ui/Button";

export function PremiumPage() {
  const nav = useNavigate();
  const [role, setRole] = useState("FREE");
  useEffect(()=>{
    const u = JSON.parse(localStorage.getItem("spendshot_user")|| "null");
    setRole(u?.role||"FREE");
    // fetch subscription
    const t = localStorage.getItem("spendshot_token");
    if(t) fetch(`${import.meta.env.VITE_API_URL||"http://localhost:8000"}/subscription/me`, {headers:{Authorization:`Bearer ${t}`}}).then(r=>r.json()).then(d=>setRole(d.plan)).catch(()=>{});
  },[]);
  const isPremium = role==="PREMIUM"||role==="ADMIN"||role==="SUPER_ADMIN";
  return (
    <div className="max-w-[600px] mx-auto p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl p-6 text-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] animate-fade-in">
        <span className="text-xs px-2 py-1 bg-white/20 rounded-full flex items-center gap-1 w-fit"><Crown size={13} strokeWidth={2}/> PREMIUM</span>
        <h1 className="text-2xl font-bold mt-3">SpendShot Premium</h1>
        <p className="text-sm opacity-90 mt-2">Trải nghiệm trọn vẹn không giới hạn</p>
      </div>
      <Reveal delay={100}>
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] px-6 py-2 mt-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
          <span>Tính năng</span>
          <span>Premium</span>
        </div>
        <ul className="text-sm">
          {[ "Chọn ảnh từ thư viện", "Không quảng cáo", "Thống kê nâng cao", "Sắp ra mắt" ].map((b, i)=>(
            <Reveal key={b} delay={i * 70}>
            <li className="flex justify-between items-center border-b border-gray-100 py-3 last:border-0">
              <span>{b}</span>
              <Check size={18} strokeWidth={2.5} className="text-green-500 shrink-0"/>
            </li>
            </Reveal>
          ))}
        </ul>
        {isPremium ? <p className="my-4 p-3 bg-success/10 text-success rounded-xl text-sm flex items-center gap-2"><Crown size={16} strokeWidth={2}/> Bạn đang là Premium</p> :
          <Button className="w-full my-4 hover:shadow-lg hover:-translate-y-0.5" onClick={()=>nav("/payment")}>Nâng cấp Premium - 19.000 ₫/tháng</Button>}
      </div>
      </Reveal>
    </div>
  );
}
