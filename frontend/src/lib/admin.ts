const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function h(){ return { Authorization: `Bearer ${localStorage.getItem("spendshot_token")}` }; }
export async function getDashboard(){ const r=await fetch(`${API}/admin/dashboard`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json(); }
export async function listUsers(params: Record<string,string> = {}){
  const qs=new URLSearchParams(params).toString();
  const r=await fetch(`${API}/admin/users?${qs}`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json();
}
export async function getUserDetail(id:string){ const r=await fetch(`${API}/admin/users/${id}`, {headers:h()}); return r.json(); }
export async function updateUser(id:string, data:any){ const r=await fetch(`${API}/admin/users/${id}`, {method:"PATCH", headers:{...h(), "Content-Type":"application/json"}, body:JSON.stringify(data)}); return r.json(); }
export async function getAudit(){ const r=await fetch(`${API}/admin/audit-logs`, {headers:h()}); return r.json(); }
export async function getStorage(){ const r=await fetch(`${API}/admin/storage`, {headers:h()}); return r.json(); }
export async function storageOverview(sort="storage_desc"){ const r=await fetch(`${API}/admin/storage/overview?sort=${sort}`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json(); }
export async function storageUser(id:string, params: Record<string,string> = {}){
  const qs=new URLSearchParams(params).toString();
  const r=await fetch(`${API}/admin/storage/users/${id}?${qs}`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json();
}
async function storagePost(path:string, body:any){
  const r=await fetch(`${API}${path}`, {method:"POST", headers:{...h(), "Content-Type":"application/json"}, body:JSON.stringify(body)});
  const d=await r.json(); if(!r.ok) throw new Error(d.detail || "Thất bại"); return d;
}
export async function storagePreview(body:any){ return storagePost("/admin/storage/preview", body); }
export async function storageDelete(body:any){ return storagePost("/admin/storage/delete", body); }
export async function storageOrphans(){ const r=await fetch(`${API}/admin/storage/orphans/preview`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json(); }
export async function storageOrphanCleanup(){ return storagePost("/admin/storage/orphans/cleanup", {confirm:true}); }
export async function deleteUserData(id:string, body:any){
  const r=await fetch(`${API}/admin/users/${id}/data`, {method:"DELETE", headers:{...h(), "Content-Type":"application/json"}, body:JSON.stringify(body)});
  const d=await r.json(); if(!r.ok) throw new Error(d.detail || "Xóa thất bại"); return d;
}
export async function getSyncMonitor(){ const r=await fetch(`${API}/admin/sync-monitor`, {headers:h()}); return r.json(); }
export async function getNotificationsOverview(){ const r=await fetch(`${API}/admin/notifications/overview`, {headers:h()}); if(!r.ok) throw new Error("403"); return r.json(); }
export async function setUserPassword(id:string, new_password:string){
  const r=await fetch(`${API}/admin/users/${id}/reset-password`, {method:"POST", headers:{...h(), "Content-Type":"application/json"}, body:JSON.stringify({new_password})});
  const d=await r.json();
  if(!r.ok) throw new Error(d.detail || "Đặt mật khẩu thất bại");
  return d;
}
