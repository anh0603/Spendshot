# SpendShot — Locket + Budget Jar

> **Chụp chi tiêu. Nhìn thấy tiền đi.** Ứng dụng quản lý chi tiêu cá nhân visual-first, local-first, offline-first, PWA, Premium, Admin cùng 1 app.

## Mục lục
- [Tổng quan](#tổng-quan)
- [Kiến trúc](#kiến-trúc)
- [Frontend](#frontend)
- [Backend](#backend)
- [Database](#database)
- [Auth & Gmail validation](#auth--gmail-validation)
- [JWT](#jwt)
- [FREE/PREMIUM](#freepremium)
- [Camera/Gallery](#cameragallery)
- [Budget Jar](#budget-jar)
- [Expense](#expense)
- [Negative balance](#negative-balance)
- [Local-first & IndexedDB](#local-first--indexeddb)
- [Offline & Sync](#offline--sync)
- [Idempotency & Retry](#idempotency--retry)
- [Admin & RBAC & IDOR](#admin--rbac--idor)
- [Ads](#ads)
- [PWA & Push](#pwa--push)
- [Photo Storage](#photo-storage)
- [API](#api)
- [Responsive](#responsive)
- [Testing](#testing)
- [Environment](#environment)
- [Security](#security)
- [Deployment](#deployment)
- [Cấu trúc project](#cấu-trúc-project)
- [Cách chạy local](#cách-chạy-local)
- [AI Handover](#ai-handover)

---

## Tổng quan
SpendShot = Locket + Budget Jar. Loop: `Mua đồ → Chụp ảnh → Nhập số tiền → Lưu Expense → Trừ tiền khỏi Hũ → Theo dõi số dư`. Mục tiêu: đơn giản, trực quan, nhanh, đẹp, local-first, PWA, Mobile + Desktop.

## Kiến trúc
- **Frontend:** React 18 + TypeScript + Vite 8 + Tailwind 3.4 + Dexie (IndexedDB) + react-router-dom + PWA (manifest + sw.js)
- **Backend:** FastAPI + SQLAlchemy (sync) + SQLite (dev) / PostgreSQL Supabase (prod, qua pooler, driver psycopg v3) + JWT (python-jose) + bcrypt + Pillow + Alembic migration
- **Auth:** Gmail-only, JWT HS256 FastAPI (giữ nguyên, không dùng Supabase Auth), role-based redirect
- **Storage:** dev `uploads/{user_id}/{id}.jpg` + thumbnail (Dexie local); prod Supabase Storage bucket PRIVATE, key `users/{uid}/expenses/{eid}/bill.ext`, đọc qua backend proxy `GET /sb/*` (JWT + ownership). Frontend không gọi Supabase trực tiếp, DB không lưu binary
- **Sync:** Push/Pull + queue + retry + idempotency_key

## Frontend
- Vite + React TS, Tailwind config tokens: primary `#FF6B35`, bg `#FAFBFC`, Be Vietnam Pro, radius 8-28, shadow sm/md/lg
- Components: `Button` (6 variants), `Input` (gmail check, eye toggle, AmountInput quick chips), `JarCard`, `ExpenseCard` (1:1, 3 cols desktop), `DesktopSidebar` (280px), `MobileBottomNav` (64px + FAB 64), `Header`, `CameraOverlay`, `PremiumUpsell`, `AdsBanner`, `SyncIndicator`, `AdminSidebar`
- Pages: `Welcome`, `Login`, `Register`, `Home` (Jar + Expense feed), `PremiumPage`, `Admin/*`
- `src/lib/*`: `validateEmail`, `formatVND`, `auth`, `jar`, `expense`, `admin`, `localFirst`
- `src/db/index.ts`: Dexie v1 `jars, expenses, syncQueue` với `sync_status`
- `src/hooks/useSync.ts`: push/pull + retry + last_sync
- Build: `npm run build` → `dist/` 379KB

## Backend
- `backend/app/main.py` FastAPI + CORS + mount `/uploads`
- `backend/app/config.py` pydantic-settings (DATABASE_URL, JWT_SECRET, VAPID)
- `backend/app/database.py` SQLAlchemy engine
- `backend/app/auth.py` Gmail regex + admin exception + bcrypt + JWT
- `backend/app/models/*`: User (FREE/PREMIUM/ADMIN/SUPER_ADMIN, ACTIVE/SUSPENDED), Jar, Expense, JarTransaction, AuditLog
- `backend/app/routers/*`: auth, jars, expenses, subscription, ads, sync, admin, push
- Seed: `backend/seed.py` đọc `ADMIN_EMAIL`/`ADMIN_PASSWORD` từ environment → SUPER_ADMIN (không hard-code password; thiếu thì seed fail rõ ràng)

## Database
- Dev: `sqlite:///./spendshot.db` (check_same_thread False)
- Prod: PostgreSQL (DATABASE_URL env)
- Tables: users, jars, expenses, jar_transactions, audit_logs
- Không tự đổi schema nếu không cần (§52 Preserve)

## Auth & Gmail validation
- Chỉ `@gmail.com` + exception `admin@spendshot.local` exact
- Regex: `^[a-zA-Z0-9._%+-]+@gmail\.com$`
- Normalize lowercase, FE live validate `validateEmail.ts`, BE enforce 422/400
- Register: email + password>=6 + confirm, Login: email+password, `/auth/me` JWT
- Super Admin seeded, role SUPER_ADMIN → /admin redirect

## JWT
- HS256, secret từ `JWT_SECRET` env (không hardcode, không log), expire 7 ngày, payload `{sub:user.id, role}`
- `get_current_user` Bearer validation, 401 nếu invalid, 403 nếu SUSPENDED
- Logout stateless (client discard token), password reset flow mock `/auth/password-reset/*`

## FREE/PREMIUM
- FREE: Camera ✅, Gallery 🔒 (click → PremiumUpsell), Ads ON
- PREMIUM: Camera ✅, Gallery ✅, Ads OFF, badge
- `UserRole` FREE/PREMIUM/ADMIN/SUPER_ADMIN, upgrade `POST /subscription/upgrade` (abstraction, chưa payment thật §33)

## Camera/Gallery
- Camera: `CameraOverlay` getUserMedia facingMode, shutter 72px, preview + Retake/Use → ExpenseModal
- Gallery: FE check `role===FREE` → Upsell sheet, BE enforce `source==gallery + FREE → 403` (`expenses.py:15`)
- Flow: `FAB → Camera → Capture → Preview → Amount → Save → Feed`

## Budget Jar
- 1 Hũ / tháng / user (`month YYYY-MM`), `budget/spent/remaining/percentage`
- Actions: Thêm tiền (+budget), Rút tiền (-budget), Sửa Hũ (PATCH budget), Lịch sử (JarTransaction)
- Quick chips +100K/+200K/+500K/+1Tr
- `JarCard` progress bar, negative warning "Bạn đã vượt ngân sách..."

## Expense
```ts
interface Expense {
  id: string; user_id: string; jar_id: string;
  amount: number; photo: string; thumbnail: string;
  created_at: string; updated_at: string;
  category?: string; idempotency_key: string;
}
```

### Quy tắc ảnh bắt buộc (production)
- Hiện tại đang test: **không có ảnh vẫn lưu được** (backend tự gắn ảnh giữ chỗ).
- Lên production: **bắt buộc chụp hoặc upload ảnh mới lưu được**:
  - Backend: đặt `REQUIRE_PHOTO=true` trong `.env` (không ảnh → 400 "Vui lòng chụp hoặc tải ảnh lên trước khi lưu").
  - Frontend: đặt `VITE_REQUIRE_PHOTO=true` (nút Lưu chặn + hiện dòng nhắc "Bắt buộc: chụp hoặc tải ảnh lên mới lưu được").
- Dev/test giữ cả 2 cờ là `false` để test nhanh không cần ảnh.
- Feed: Desktop 3 cols gap20, Mobile 2 cols gap12, 6 ảnh first viewport, aspect 1:1, object-cover, hover scale 1.02
- Card: photo + amount + time `HH:mm`, click → detail modal 4:3 + delete
- Categories optional: An uong/Di chuyen/Mua sam/Giai tri/Khac

## Negative balance
- Cho phép âm, hiển thị `-240.000 ₫` đỏ `text-danger`, bg `#FEF2F2`, progress 112% đỏ, warning `#FEF3C7`, không chặn expense

## Local-first & IndexedDB
- Dexie `SpendShotDB` stores `jars (id, user_id, month)`, `expenses (id, user_id, jar_id)`, `syncQueue (entity, status)`
- `lib/localFirst.ts` save*Local + queue PENDING, update jar.spent local
- Mọi thao tác viết local trước, sync sau, UI không chặn vì offline

## Offline & Sync
- Offline indicator chip amber, vẫn cho tạo Hũ/expense/chụp
- Sync states: `PENDING → SYNCING → SYNCED → FAILED` (SyncIndicator)
- Push: `POST /sync/push` (batch expenses+jars), Pull: `GET /sync/pull?since`, Status: `GET /sync/status`
- `useSync` push queue → SYNCING, pull merge Dexie, failed → FAILED + retry, 30s interval + online listener, last_sync stored
- Không xóa local khi sync fail (§25)

## Idempotency & Retry
- `idempotency_key` unique per expense (UUID), BE check duplicate → return existing, không tạo duplicate khi retry
- Retry: `FAILED` → set `PENDING` → push lại, `retries++`

## Admin & RBAC & IDOR
- Cùng app, sidebar 260px: Dashboard/Users/Subscriptions/Ads/Storage/Sync Monitor/Audit Logs/Settings
- Dashboard 10 metrics: Total Users, FREE/PREMIUM, Active/Suspended, Jars, Expenses, Storage, Sync Failures, Ads
- Users: Search (email), Filter plan/status, Pagination 10, table Avatar/Email/Plan/Status/Created/Last Activity/Actions, Detail: jars/expenses/storage/sync, actions Change plan/Suspend/Reset password (không hiện password)
- Subscriptions/Ads (toggle), Storage (photos+local+warning), Sync Monitor (4 cols), Audit Logs (Time/Admin/Action/Target/Result) không ghi password/JWT/secret
- RBAC: `require_admin` → ADMIN/SUPER_ADMIN else 403, FREE/PREMIUM → 403 /admin (FE Protected 403 screen)
- IDOR: `check_owner` jar.user_id != user.id → 404, expense/jar chỉ owner, admin endpoints chỉ admin

## Ads
- FREE: banner 320x50 + native every 8 items (`NativeAdCard`), PREMIUM: không ads
- BE: `GET /ads/config` `{enabled, nativeEvery}`, `GET /admin/ads` authority
- Không che camera/ảnh/input

## PWA & Push
- `public/manifest.json` installable (standalone, theme #FF6B35, icons), `public/sw.js` (install cache, activate claim, fetch navigation network-first + cache-first, push notification), `public/offline.html` tiếng Việt
- `PWAInstallBanner` beforeinstallprompt + Cài đặt/Dismiss, `PushPermissionModal` pre-prompt trước browser prompt
- Push arch: `POST /push/subscribe`, `/unsubscribe`, `/send` (admin only), `/test`, `GET /push/vapid`, lưu `push_subs.json`, mock gửi nếu chưa VAPID thật, không giả vờ real nếu chưa test môi trường

## Photo Storage
- Validate MIME jpeg/png/webp, max 5MB, resize 1024 + thumb 300 via Pillow, lưu `uploads/{user_id}/{id}.jpg`, serve `/uploads` StaticFiles, không expose sai quyền (IDOR)

## API
Nhóm: `/auth`, `/jars`, `/expenses`, `/photos` (via /uploads), `/sync`, `/subscription`, `/ads`, `/admin`, `/push`, `/health`
- Xem `backend/app/main.py` + `backend/app/routers/*`

## Responsive
- Desktop 1440x900 (primary), 1280x800, 1920x1080: sidebar 280 fixed, content max 1200 centered, grid 3 cols 6 ảnh
- Tablet 768-1279 (1024x768 primary): sidebar collapsible 72px icon-only + nút toggle (→/←), mở rộng lại 280px khi cần
- Mobile <768 (390x844, 375x812, 430x932): sidebar ẩn, bottom nav 64 + FAB 64 overlap, amount 28px, touch ≥44px, no horizontal scroll

## Testing
- Thanh toán Premium 19k: mỗi user có mã code riêng (`SS-XXXXXX`, chỉ admin xem được), trang `/payment` hiện QR VietQR + nội dung = mã code, user bấm "Tôi đã chuyển khoản" → admin duyệt ở `/admin/requests` (tìm user bằng mã code), QR ngân hàng chỉnh ở `/admin/settings`. Xem `backend/app/routers/payment.py`.
- Backend: `pytest` (85 tests: 61 cũ + 24 push/email/storage mới)
  - `pytest tests/test_auth.py -v` 7 tests Gmail/JWT
  - `pytest tests/test_jars.py -v` 5 tests jar/add/negative/IDOR
  - `pytest tests/test_expenses.py -v` 6 tests expense/photo/IDOR
  - `pytest tests/test_premium.py -v` 5 tests gallery/ads
  - `pytest tests/test_sync.py -v` 4 tests push/pull/conflict
  - `pytest tests/test_admin.py -v` 8 tests RBAC/dashboard
  - `pytest tests/test_offline.py -v` 3 tests idempotency/offline
  - `pytest tests/test_push.py -v` 3 tests push
  - `pytest tests/test_profile.py -v` 5 tests tên/avatar/đổi MK/admin đặt MK
- Frontend: `npm run build` (TSC + Vite) PASS
- E2E: Playwright `frontend/e2e/*.spec.ts` — 42 tests PASS (3 projects: desktop-1440, tablet-1024, mobile-390)
  - `auth.spec.ts`: welcome TV, register/login chặn non-gmail, redirect /welcome, FREE vào /admin 403
  - `responsive.spec.ts`: tablet sidebar collapsible, desktop 280px, mobile bottom nav + no overflow
- Chạy: `cd backend && python -m pytest -v` , `cd frontend && npm run build` , `cd frontend && npm run test:e2e`

## Environment
- Không hardcode secret, dùng `.env`
- `.env.example` (root + backend + frontend) có: DATABASE_URL, JWT_SECRET, VAPID_PUBLIC/PRIVATE/SUBJECT, VITE_API_URL
- `backend/.env` dev `JWT_SECRET=dev-secret-change-in-prod...`
- `frontend/.env` `VITE_API_URL=http://localhost:8000`

## Security
- bcrypt hash, JWT HS256 env secret, không log password/JWT/API key, không trả password_hash, RBAC BE enforce, IDOR 404, Gmail BE enforce, upload MIME/size, VAPID env

## Deployment
- Free-tier: Cloudflare Pages / Render / Supabase ready, nhưng **KHÔNG DEPLOY** nếu chưa yêu cầu (§56)
- Build: `frontend/dist` static, `backend` uvicorn `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Cấu trúc project
```
spendShot/
├─ desgin system/ (Design System — source of truth, typo folder name giữ nguyên)
│  ├─ SPENDSHOT-FULL-DESIGN-SPEC.md
│  ├─ pc.png / mobile.png / camera.png / admin.png / state.png
│  └─ Preview/SpendShot_Preview.html
├─ frontend/
│  ├─ src/components/{ui,jar,expense,layout,admin,ads}
│  ├─ src/pages/{auth,user,admin}
│  ├─ src/lib/*, src/db/index.ts, src/hooks/useSync.ts
│  ├─ public/manifest.json, sw.js, offline.html
│  ├─ index.html, tailwind.config.js, vite.config.ts
│  └─ .env / .env.example
├─ backend/
│  ├─ app/{main,config,database,auth,models,routers}
│  ├─ uploads/ (gitignored)
│  ├─ tests/test_*.py
│  ├─ requirements.txt, seed.py, push_subs.json
│  └─ .env / .env.example
├─ .env.example
├─ .gitignore
└─ README.md (this)
```

## Cách chạy local
```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py  # cần ADMIN_EMAIL + ADMIN_PASSWORD trong environment (xem backend/.env.example)
python -m uvicorn app.main:app --reload --port 8000  # http://localhost:8000/health

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
npm run build # production

# Tests
cd backend && python -m pytest -v
cd frontend && npm run build
```

## Push & Email Reminder
- **Push:** nhắc chụp bill 6 lần/ngày `08:00,10:00,12:00,15:00,18:00,20:00` giờ `Asia/Ho_Chi_Minh` (config `PUSH_SCHEDULE`), 30 câu message cố định random không trùng trong ngày, idempotency `user+date+slot` unique, sub 404/410 → `is_active=false`. Web Push + VAPID (không Firebase). Chưa có VAPID key → mock (chỉ log).
- **Email:** user không mở app ≥3 ngày → 1 mail/ngày, tối đa 7 mail, quay lại app → dừng + reset ngay. Provider abstraction `EmailService → ResendProvider (httpx) | MockEmailProvider`; chưa `RESEND_API_KEY` → mock. Quota `EMAIL_DAILY_LIMIT=100 / EMAIL_MONTHLY_LIMIT=3000`, vượt → skip + log, không crash.
- **Settings user:** `GET/PATCH /notifications/settings` (`push_enabled/email_enabled`, default ON), `POST/DELETE /notifications/push/subscribe` (multi-device, endpoint unique, 409 nếu của user khác), `POST /notifications/push/test`. UI: Hồ sơ → Thông báo (toggle + Bật thông báo + gửi thử + hướng dẫn iPhone Add to Home Screen).
- **Scheduler:** 1 job hourly — cron ngoài (vd cron-job.org free) gọi `POST /internal/cron` kèm header `X-Cron-Secret: CRON_SECRET`, lock DB chống chạy trùng, cleanup history >90 ngày. `last_activity` tái dùng làm active, throttle 1 write/15p/user.
- **Admin:** `/admin/notifications/overview` + trang `/admin/notifications` (push on/off, subs, email on, in-sequence, sent/failed hôm nay). Không có broadcast toàn user (§27).
- **API cũ `/push/*` giữ nguyên** (giờ lưu DB thay file `push_subs.json`; file cũ migrate 1 lần lúc khởi động).

## Storage
- Abstraction `StorageService → LocalStorageProvider (dev, giữ nguyên pipeline Pillow + URL /uploads) | SupabaseStorageProvider (production, Supabase Storage bucket PRIVATE, cùng key `users/{uid}/expenses/{eid}/bill.ext`, gọi REST bằng service_role key chỉ ở backend)`. Đổi qua `STORAGE_PROVIDER=supabase` + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_BUCKET`. Đọc ảnh qua backend proxy `GET /sb/*` (JWT + ownership, counter `?token=` cho `<img>`), service worker không cache ảnh private. DB không lưu binary (§33). Bucket mặc định `spendshot`, tạo thủ công trong Supabase Dashboard (private, không public). Không dùng Cloudflare R2 nữa.

## Deployment (free-tier, chưa deploy — đợi yêu cầu)
- Frontend → Cloudflare Pages (static `frontend/dist`), Backend → Render free (`uvicorn app.main:app`, working dir `backend/`), DB → Supabase PostgreSQL qua pooler (Alembic migration, không SQLite prod), Cron → cron-job.org gọi `/internal/cron` hourly (giữ Supabase không bị pause), Email → TẮT, Push → Web Push + VAPID tự tạo, Storage → Supabase Storage bucket PRIVATE.
- Free quota hiện tại: Pages unlimited bandwidth, Render 750h/tháng, Supabase 500MB DB (giữ project active bằng cron hourly), cron-job.org free.
- Setup Supabase: tạo project + bucket `spendshot` (private) trong Dashboard, lấy pooler `DATABASE_URL` + `SUPABASE_URL` + service_role key (chỉ backend, không đưa frontend), chạy `alembic upgrade head`, seed admin bằng `ADMIN_EMAIL`/`ADMIN_PASSWORD` env.
- > Thiết kế theo free-tier hiện tại; quota/phí có thể thay đổi theo nhà cung cấp (không cam kết "miễn phí vĩnh viễn").
- Production secrets qua Environment Variables, không commit `.env`.

## AI Handover
**SpendShot là gì:** App Locket + Budget Jar, chụp món đồ → nhập tiền → trừ Hũ tháng, feed ảnh 3 cols, local-first offline PWA, Premium gallery, Admin cùng app.

**Kiến trúc hiện tại:** Frontend React Vite Tailwind Dexie PWA + Backend FastAPI SQLite (prod PostgreSQL) JWT bcrypt Pillow, 41 tests PASS, build 58 modules 379KB PASS, PWA installable + push mock.

**Business rules bắt buộc:** Gmail-only + admin@spendshot.local, FREE/PREMIUM/ADMIN/SUPER_ADMIN, ADMIN→/admin, negative cho phép đỏ warning, 1 jar/tháng, idempotency_key, sync PENDING→SYNCED, Gallery FREE 403 BE, Ads FREE ON.

**UI rules tuyệt đối:** Design System là source of truth (`desgin system/SPENDSHOT-FULL-DESIGN-SPEC.md`), primary #FF6B35, bg #FAFBFC, Be Vietnam Pro, sidebar 280, grid 3 cols 6 ảnh, FAB 64, bottom nav 64, tiếng Việt 100%, không tự redesign.

**Design System location:** `C:\Users\ADMIN\Desktop\spendShot\desgin system` (chú ý typo `desgin`) — chứa 5 PNG + Preview HTML + spec 578 dòng.

**Current implementation:** PHASE 0-9 DONE, PHASE 10 docs, 10 metrics admin, 8 users table, sync push/pull, PWA manifest+sw+offline+install+push.

**Known limitations:** VAPID push mock chưa real test môi trường, payment chưa thật (abstraction), chưa virtualized grid cho 1000+ expenses.

**Cách test:** `backend: pytest -v` (41), `frontend: npm run build`, `frontend: npm run test:e2e` (24 E2E), login admin bằng tài khoản đã seed qua `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

**Việc chưa làm:** Deploy (đợi yêu cầu), Cloudflare Pages config.

> **AI tiếp theo KHÔNG được rewrite project. KHÔNG được redesign UI. Phải đọc Design System trước. Chỉ minimal change, test, báo file thay đổi.**

---
*Version: 1.0 | Date: 28/08/2026 | Stack: React Vite Tailwind Dexie FastAPI SQLite PWA*
