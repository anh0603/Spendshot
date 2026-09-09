import { useEffect, useState } from "react";
import { Reveal } from "../../components/ui/Reveal";
import { NoPhoto } from "../../components/expense/NoPhoto";
import { photoUrl } from "../../lib/photo";
import { formatVND } from "../../lib/formatVND";
import {
  storageOverview, storageUser, storagePreview, storageDelete,
  storageOrphans, storageOrphanCleanup, deleteUserData,
} from "../../lib/admin";

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const SORTS = [
  { v: "storage_desc", l: "Dung lượng lớn → nhỏ" },
  { v: "storage_asc", l: "Dung lượng nhỏ → lớn" },
  { v: "expenses_desc", l: "Nhiều expense → ít" },
  { v: "oldest", l: "Cũ nhất" },
  { v: "newest", l: "Mới nhất" },
];

export function StoragePage() {
  const [ov, setOv] = useState<any>(null);
  const [sort, setSort] = useState("storage_desc");
  const [err, setErr] = useState("");
  // detail
  const [uid, setUid] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState("newest");
  // delete flow
  const [n, setN] = useState("100");
  const [preview, setPreview] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [msg, setMsg] = useState("");
  // orphans + wipe
  const [orphans, setOrphans] = useState<any>(null);
  const [wipeEmail, setWipeEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOv = (s = sort) => {
    setErr("");
    storageOverview(s).then(setOv).catch(() => setErr("Không tải được storage (cần quyền Admin)"));
  };
  useEffect(() => { loadOv(); storageOrphans().then(setOrphans).catch(() => {}); }, []);

  const openUser = (id: string, f = from, t = to, o = order) => {
    setUid(id); setMsg(""); setPreview(null); setPending(null);
    storageUser(id, { from: f, to: t, sort: o, limit: "100" }).then(setDetail).catch(() => setErr("Không tải được user"));
  };

  const doPreview = async (mode: string) => {
    if (!uid) return;
    setMsg("");
    try {
      const body: any = { user_id: uid, mode };
      if (mode === "date_range") { body.from = from; body.to = to; }
      else body.n = parseInt(n, 10) || 0;
      const p = await storagePreview(body);
      setPreview(p); setPending({ ...body });
    } catch (e: any) { setMsg(e.message); }
  };

  const doDelete = async () => {
    if (!pending) return;
    if (!window.confirm(`Xóa ${preview?.objects || 0} objects (~${fmtBytes(preview?.bytes_to_free || 0)})? Expense DB được giữ nguyên.`)) return;
    setBusy(true);
    try {
      const r = await storageDelete({ ...pending, confirm: true });
      setMsg(r.message); setPreview(null); setPending(null);
      loadOv(); openUser(uid);
      storageOrphans().then(setOrphans).catch(() => {});
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const doOrphanCleanup = async () => {
    if (!orphans?.objects) return;
    if (!window.confirm(`Dọn ${orphans.objects} orphan objects (~${fmtBytes(orphans.bytes || 0)})? Chỉ xóa object không còn DB tham chiếu.`)) return;
    setBusy(true);
    try {
      const r = await storageOrphanCleanup();
      setMsg(r.message); loadOv();
      storageOrphans().then(setOrphans).catch(() => {});
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const doWipe = async () => {
    if (!uid) return;
    if (!window.confirm("XÓA TOÀN BỘ DỮ LIỆU USER (expenses, jars, ảnh, avatar, push...)? Không thể hoàn tác!")) return;
    setBusy(true);
    try {
      const r = await deleteUserData(uid, { confirm: true, email: wipeEmail });
      setMsg(r.message); setUid(""); setDetail(null); setWipeEmail(""); loadOv();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  if (!ov && !err) return <div className="p-6">Đang tải...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Quản lý lưu trữ</h1>
      {err && <p className="text-sm text-danger mb-3">{err}</p>}
      {msg && <p className="text-sm text-primary font-medium mb-3">{msg}</p>}

      {ov && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-text-secondary">Đã dùng ({ov.provider})</p>
              <p className="text-lg font-bold">{fmtBytes(ov.total_bytes)}</p>
              <p className="text-xs text-text-secondary">{ov.total_objects} objects</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-text-secondary">Giới hạn ({ov.limit_source})</p>
              <p className="text-lg font-bold">{ov.limit_bytes ? fmtBytes(ov.limit_bytes) : "Không rõ"}</p>
              <p className={`text-xs font-bold ${ov.status === "CRITICAL" ? "text-danger" : ov.status === "WARNING" ? "text-warning" : "text-success"}`}>
                {ov.status}{ov.usage_percent != null ? ` • ${ov.usage_percent}%` : ""}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-text-secondary">Users có dữ liệu</p>
              <p className="text-lg font-bold">{ov.users_with_data}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-text-secondary">Expense có ảnh</p>
              <p className="text-lg font-bold">{ov.expenses_with_photos}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-bold">Dung lượng theo user</h2>
              <select value={sort} onChange={(e) => { setSort(e.target.value); loadOv(e.target.value); }} className="h-10 px-3 border border-border rounded-md text-sm">
                {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text-secondary text-xs">
                  <th className="py-2 pr-3">Email</th><th className="pr-3">Expense có ảnh</th>
                  <th className="pr-3">Objects</th><th className="pr-3">Dung lượng</th>
                  <th className="pr-3">Cũ nhất</th><th>Mới nhất</th>
                </tr></thead>
                <tbody>
                  {ov.users.map((u: any) => (
                    <tr key={u.user_id} onClick={() => openUser(u.user_id)} className="border-t border-border hover:bg-bg cursor-pointer">
                      <td className="py-2 pr-3 font-medium text-primary break-all">{u.email}</td>
                      <td className="pr-3">{u.expenses_with_photos}</td>
                      <td className="pr-3">{u.image_objects}</td>
                      <td className="pr-3 font-bold">{fmtBytes(u.bytes_used)}</td>
                      <td className="pr-3 text-xs">{u.oldest?.slice(0, 10) || "—"}</td>
                      <td className="text-xs">{u.newest?.slice(0, 10) || "—"}</td>
                    </tr>
                  ))}
                  {ov.users.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-text-secondary">Chưa có dữ liệu ảnh</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {detail && (
        <Reveal>
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold break-all">{detail.email}</h2>
            <button onClick={() => { setUid(""); setDetail(null); }} className="text-sm text-text-secondary">← Danh sách</button>
          </div>
          <p className="text-xs text-text-secondary break-all mb-1">{detail.user_id}</p>
          <p className="text-sm mb-3">Tổng <b>{fmtBytes(detail.total_bytes)}</b> • {detail.expenses_with_photos} expense có ảnh • {detail.total_objects} objects
            • Cũ nhất {detail.oldest?.slice(0, 10) || "—"} • Mới nhất {detail.newest?.slice(0, 10) || "—"}</p>

          <div className="flex gap-2 flex-wrap items-end mb-3">
            <label className="text-xs">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 px-2 border border-border rounded-md text-sm ml-1" /></label>
            <label className="text-xs">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 px-2 border border-border rounded-md text-sm ml-1" /></label>
            <select value={order} onChange={(e) => setOrder(e.target.value)} className="h-10 px-3 border border-border rounded-md text-sm">
              <option value="newest">Mới nhất → cũ nhất</option>
              <option value="oldest">Cũ nhất → mới nhất</option>
            </select>
            <button onClick={() => openUser(uid)} className="h-10 px-4 rounded-md bg-gray-100 text-sm font-medium">Lọc</button>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-secondary text-xs">
                <th className="py-2 pr-2">Ảnh</th><th className="pr-2">Ngày</th><th className="pr-2">Tiền</th>
                <th className="pr-2">Main</th><th className="pr-2">Thumb</th><th>Tổng</th>
              </tr></thead>
              <tbody>
                {detail.items.map((it: any) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="py-1 pr-2 w-12">
                      {photoUrl(it.photo || it.thumbnail) ? (
                        <img src={photoUrl(it.thumbnail || it.photo)} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
                      ) : <NoPhoto className="w-10 h-10 rounded" />}
                    </td>
                    <td className="pr-2 text-xs">{it.created_at?.slice(0, 16) || "—"}</td>
                    <td className="pr-2">{formatVND(it.amount)}</td>
                    <td className="pr-2 text-xs">{it.has_photo ? fmtBytes(it.photo_bytes) : "—"}</td>
                    <td className="pr-2 text-xs">{it.has_thumb ? fmtBytes(it.thumb_bytes) : "—"}</td>
                    <td className="text-xs font-bold">{fmtBytes(it.total_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-text-secondary mt-1">Hiện {detail.items.length}/{detail.total}</p>
          </div>

          <div className="border-t border-border pt-3 flex gap-2 flex-wrap items-end">
            <button onClick={() => doPreview("date_range")} className="h-10 px-4 rounded-md bg-gray-100 text-sm font-medium">Preview theo ngày</button>
            <label className="text-xs">N <input type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} className="h-10 w-24 px-2 border border-border rounded-md text-sm ml-1" /></label>
            <button onClick={() => doPreview("oldest")} className="h-10 px-4 rounded-md bg-gray-100 text-sm font-medium">Preview {n} cũ nhất</button>
            <button onClick={() => doPreview("newest")} className="h-10 px-4 rounded-md bg-gray-100 text-sm font-medium">Preview {n} mới nhất</button>
          </div>

          {preview && (
            <div className="mt-3 p-4 bg-bg rounded-md text-sm">
              <p className="font-bold mb-1">Delete preview ({preview.mode})</p>
              <p>Expenses: {preview.expenses} • Main: {preview.main_images} • Thumbs: {preview.thumbnails} • Objects: {preview.objects}</p>
              <p>Dự kiến giải phóng: <b>~{fmtBytes(preview.bytes_to_free)}</b></p>
              <p>Cũ nhất: {preview.oldest?.slice(0, 10) || "—"} • Mới nhất: {preview.newest?.slice(0, 10) || "—"}</p>
              <p className="text-xs text-text-secondary mt-1">Chỉ xóa ảnh + thumbnail, GIỮ expense DB.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setPreview(null); setPending(null); }} className="h-10 px-4 rounded-md bg-white border border-border text-sm">Cancel</button>
                <button onClick={doDelete} disabled={busy} className="h-10 px-4 rounded-md bg-danger text-white text-sm font-bold">Confirm xóa ảnh</button>
              </div>
            </div>
          )}

          <div className="border-t border-danger/30 mt-4 pt-3">
            <p className="font-bold text-danger text-sm mb-2">Xóa toàn bộ dữ liệu user (RIÊNG BIỆT — gồm expenses, jars, ảnh, avatar, push)</p>
            <div className="flex gap-2 flex-wrap items-end">
              <label className="text-xs">Nhập email để xác nhận <input value={wipeEmail} onChange={(e) => setWipeEmail(e.target.value)} placeholder={detail.email} className="h-10 px-3 border border-border rounded-md text-sm ml-1 w-64" /></label>
              <button onClick={doWipe} disabled={busy} className="h-10 px-4 rounded-md bg-danger text-white text-sm font-bold">Xóa toàn bộ</button>
            </div>
          </div>
        </div>
        </Reveal>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="font-bold mb-1">Orphan cleanup (riêng biệt)</h2>
        <p className="text-xs text-text-secondary mb-2">Chỉ xóa object không còn DB tham chiếu. Không đụng ảnh của expense tồn tại.</p>
        {orphans
          ? <p className="text-sm mb-2">{orphans.objects} objects • ~{fmtBytes(orphans.bytes)}</p>
          : <p className="text-sm text-text-secondary mb-2">Đang tải...</p>}
        <button onClick={doOrphanCleanup} disabled={busy || !orphans?.objects} className="h-10 px-4 rounded-md bg-gray-100 text-sm font-medium disabled:opacity-50">Dọn orphans</button>
      </div>
    </div>
  );
}
