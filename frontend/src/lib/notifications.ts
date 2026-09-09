/** Notification helpers (§8, §9, §55 + iOS PWA).
 * Không crash khi browser thiếu API (§59). Không spam xin quyền (§55). */
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function h() {
  return {
    Authorization: `Bearer ${localStorage.getItem("spendshot_token")}`,
    "Content-Type": "application/json",
  };
}

export interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  active_subscriptions: number;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const r = await fetch(`${API}/notifications/settings`, { headers: h() });
  if (!r.ok) throw new Error("Không tải được cài đặt thông báo");
  return r.json();
}

export async function updateNotificationSettings(
  data: Partial<Pick<NotificationSettings, "push_enabled" | "email_enabled">>
): Promise<NotificationSettings> {
  const r = await fetch(`${API}/notifications/settings`, {
    method: "PATCH",
    headers: h(),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Không lưu được cài đặt");
  return r.json();
}

export async function testPush(): Promise<{ sent: number; devices: number; mocked: boolean }> {
  const r = await fetch(`${API}/notifications/push/test`, { method: "POST", headers: h() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Chưa có subscription nào");
  return d;
}

/** Phát hiện iOS/iPadOS (kể cả iPadOS giả desktop). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ báo Mac nhưng có cảm ứng
  return /Mac/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
}

/** Đang chạy từ Home Screen (standalone) hay browser thường. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if ((window.navigator as any).standalone === true) return true; // iOS cũ
  } catch { /* bỏ qua */ }
  return false;
}

/** iOS dùng Safari nhưng chưa Add to Home Screen → push không khả dụng. */
export function needsAddToHomeScreen(): boolean {
  return isIOS() && !isStandalone();
}

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PermissionState;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/**
 * Xin quyền + subscribe push, lưu nhiều device (§9).
 * Trả {ok} hoặc {ok:false, reason} — không throw, không spam (§55, §59).
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (typeof Notification === "undefined") return { ok: false, reason: "unsupported" };
    if (needsAddToHomeScreen())
      return { ok: false, reason: "ios-a2hs" };
    if (Notification.permission === "denied") return { ok: false, reason: "blocked" };
    if (Notification.permission === "default") {
      const p = await withTimeout(Notification.requestPermission(), 10000);
      if (p !== "granted") return { ok: false, reason: p === "denied" ? "blocked" : "dismissed" };
    }
    if (!("serviceWorker" in navigator)) return { ok: false, reason: "unsupported" };
    let vapidKey = "";
    try {
      const vr = await withTimeout(fetch(`${API}/push/vapid`), 8000);
      if (vr.ok) vapidKey = (await vr.json()).public_key || "";
    } catch { /* backend chưa sẵn sàng */ }
    if (!vapidKey) return { ok: false, reason: "no-vapid" };
    const reg = await withTimeout(navigator.serviceWorker.ready, 10000);
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }),
        15000
      ));
    const pr = await withTimeout(
      fetch(`${API}/notifications/push/subscribe`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({
          ...(sub.toJSON() as object),
          user_agent: navigator.userAgent,
          device_name: isIOS() ? "iPhone/iPad" : "Trình duyệt",
        }),
      }),
      8000
    );
    if (!pr.ok) return { ok: false, reason: "server" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
