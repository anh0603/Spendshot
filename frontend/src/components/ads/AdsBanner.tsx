import { useEffect, useState } from "react";

export function AdsBanner() {
  const [show, setShow] = useState(false);
  useEffect(()=>{
    const u = JSON.parse(localStorage.getItem("spendshot_user")|| "null");
    setShow(u?.role==="FREE");
  },[]);
  if (!show) return null;
  return (
    <div className="w-full h-[50px] bg-gradient-to-r from-gray-100 to-gray-200 border border-border rounded-md flex items-center justify-center text-xs text-text-secondary">
      Quảng cáo • SpendShot FREE <span className="ml-2 px-2 py-0.5 bg-warning text-white rounded text-[10px]">Quảng cáo</span>
    </div>
  );
}

export function NativeAdCard() {
  const u = JSON.parse(localStorage.getItem("spendshot_user")|| "null");
  if (u?.role!=="FREE") return null;
  return (
    <div className="bg-white rounded-lg border border-warning/30 p-4 flex flex-col gap-2">
      <span className="text-[10px] px-2 py-0.5 bg-warning text-white rounded-full w-fit">Quảng cáo</span>
      <p className="text-sm font-medium">Nâng cấp Premium để tắt quảng cáo</p>
      <a href="/premium" className="text-xs text-primary">Tìm hiểu →</a>
    </div>
  );
}
