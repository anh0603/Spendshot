const CACHE_NAME = "spendshot-v2";
const OFFLINE_URL = "/offline.html";
const ASSETS = ["/", "/manifest.json", "/offline.html"];

// API không bao giờ được cache — dữ liệu phải realtime
const API_PATHS = ["/auth", "/jars", "/expenses", "/sync", "/subscription", "/ads", "/admin", "/push", "/notifications", "/uploads", "/sb"];
function isApiRequest(url) {
  try {
    const u = new URL(url);
    // API backend khác origin (localhost:8000) → luôn network
    if (u.port === "8000") return true;
    return API_PATHS.some((p) => u.pathname.startsWith(p));
  } catch { return false; }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c)=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((ks)=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method!=="GET") return;
  // API: network-only, không cache, không đọc cache cũ
  if (isApiRequest(event.request.url)) {
    event.respondWith(fetch(event.request));
    return;
  }
  // navigation: network first, fallback to cache/offline
  if (event.request.mode==="navigate") {
    event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE_URL)));
    return;
  }
  // static assets: cache first then network
  event.respondWith(caches.match(event.request).then((cached)=>{
    const fetchPromise = fetch(event.request).then((res)=>{
      const clone=res.clone();
      caches.open(CACHE_NAME).then((c)=>c.put(event.request, clone));
      return res;
    }).catch(()=>cached);
    return cached || fetchPromise;
  }));
});
self.addEventListener("push", (event)=>{
  const data = event.data ? event.data.json() : {title:"SpendShot", body:"Bạn có thông báo mới"};
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon:"/favicon.svg", badge:"/favicon.svg", data: {url:"/"} }));
});
self.addEventListener("notificationclick", (event)=>{
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  // Focus tab SpendShot đang mở nếu có, không thì mở mới
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        try {
          const u = new URL(c.url);
          if (u.pathname === url || (url === "/" && u.origin === location.origin)) {
            return c.focus();
          }
        } catch { /* bỏ qua */ }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
