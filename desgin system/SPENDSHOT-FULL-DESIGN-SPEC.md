# SPENDSHOT — FULL PACKAGE — SINGLE FILE

> Gói này chứa toàn bộ 4 tài liệu + lưu ý tiếng Việt. Dùng 1 file này để handoff cho AI coding agent.

---



# ===== FILE: UI_UX_SPEC.md =====

# SPENDSHOT - UI/UX SPECIFICATION
Version: 1.0 | Date: 28/08/2026 | Role: Senior Product Designer

---

## 1. PRODUCT OVERVIEW
SpendShot = Locket + Budget Jar. Core loop: Mở app → Chụp món đồ → Nhập số tiền → Trừ vào Hũ tháng.
- Ảnh là trung tâm
- Hũ là trung tâm quản lý
- Camera là primary action
- Local-first, Offline, PWA, Premium, Admin cùng 1 app

## 2. PHILOSOPHY
Keywords: Friendly, Modern, Clean, Fast, Simple, Personal, Visual, Premium không phô trương.
Anti-patterns: Không accounting, không ERP, không SaaS dashboard đầy số.

## 3. DESIGN SYSTEM

### 3.1 Colors
- Primary: #FF6B35 (CTA, FAB, active states, jar progress >50%)
- Background: #FAFBFC
- Surface: #FFFFFF
- Text Primary: #111827
- Text Secondary: #6B7280
- Border: #E5E7EB
- Semantic:
  Success #10B981, Warning #F59E0B, Danger #EF4444, Info #3B82F6
- Usage rule: Primary chỉ dùng cho 1 action chính / màn hình. Không lạm dụng.
- Negative balance: Danger #EF4444 cho amount, background #FEF2F2

### 3.2 Typography
Primary: Be Vietnam Pro (VN), Fallback Plus Jakarta Sans
Scale:
- Display 32/40 Bold
- H1 28/36 Bold
- H2 24/32 SemiBold
- H3 20/28 SemiBold
- H4 18/26 Medium
- Body Large 16/24 Regular
- Body 14/20 Regular
- Body Small 12/16 Regular
- Caption 11/14 Medium Uppercase
- Label 14/20 Medium
- Button 14/20 SemiBold

### 3.3 Spacing
System: 4,8,12,16,20,24,32,40,48,64. Tất cả margin/padding phải dùng token này.

### 3.4 Radius
- Small 8px (badge, chip)
- Medium 12px (input)
- Large 16px (card)
- Button 12px
- Input 12px
- Modal 20px
- Bottom Sheet 24px top
- FAB 28px
- Expense Card 16px

### 3.5 Shadow
- sm: 0 1px 2px rgba(0,0,0,0.05)
- md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.06)
- lg: 0 10px 15px -3px rgba(0,0,0,0.08)
Không dùng shadow nặng.

### 3.6 Iconography
Lucide outline, stroke 1.8, size 20 default, 24 for nav.

## 4. RESPONSIVE RULES
- Desktop: 1440x900 (primary), 1280x800, 1920x1080. Sidebar 280px fixed, content max 1200px centered. Expense grid 3 columns, gap 20px. Show 6 images in first viewport (2 rows).
- Tablet 1024x768: Sidebar collapsible to 72px icon-only, grid 3 columns gap 16px.
- Mobile: 390x844 primary, 375x812, 430x932. No horizontal scroll. Bottom Nav 64px height, FAB 64px centered above nav, overlapping. Amount input font 28px.

## 5. COMPONENT LIBRARY

### 5.1 Navigation
- Desktop Sidebar: Logo SpendShot (32px), Nav items (Dashboard/Home, Statistics, Profile, Premium), Jar summary mini at bottom, sync status dot. Active state: bg #FFF1EB + text #FF6B35 + left border 3px #FF6B35.
- Mobile Bottom Nav: 4 tabs: Home, Statistics, Premium, Profile. Center FAB Camera. Active: #FF6B35 icon + label.
- Header: Mobile header 56px with greeting "Xin chào 👋 + name", notification bell, offline indicator chip.

### 5.2 Buttons
Variants: Primary (bg #FF6B35 white text), Secondary (white border), Ghost (transparent), Danger (red), Icon (40x40), FAB (64x64 gradient #FF6B35→#FF8A5C shadow lg).
States: default, hover (darken 8%), focus (ring 2px #FF6B35 30%), pressed (scale 0.97), disabled (opacity 40%), loading (spinner).

### 5.3 Inputs
- Email: type email, validation gmail.com only (regex), error "Chỉ chấp nhận @gmail.com"
- Password: eye toggle
- Amount: large numeric, auto format VND, quick chips +100K +200K +500K +1Tr, prefix ₫ suffix. Font 32 bold. Focus border #FF6B35.
- Search: icon left, clear right
States: default border #E5E7EB, focus #FF6B35, filled bg #F9FAFB, error #EF4444, disabled.

### 5.4 Cards
- Jar Card: White rounded 20px, header Ngân sách + amount total 2.000.000₫, progress bar 62% #FF6B35, stats Đã chi / Còn lại 2 columns, warning text if negative.
- Expense Card: Aspect 1:1 photo, radius 16, overlay gradient bottom for amount 125.000₫ white bold, time 14:32 secondary. Hover: scale 1.02, shadow md.
- Premium Card: Gradient #FF6B35→#FFB088, badge PREMIUM, benefits list.
- Statistics Card: Number + chart mini.

### 5.5 Feedback
- Toast: bottom center desktop, top mobile, 4 types with icon, auto dismiss 3s.
- Empty: Illustration + text "Chưa có khoản chi nào 📸" + CTA button.
- Loading: skeleton for grid (shimmer), spinner 24px for button.

### 5.6 Overlay
- Modal 480px width desktop, bottom sheet mobile (drag handle 40x4). Radius 20/24.
- Image Viewer: full screen black 90%, amount overlay, edit/delete bottom.
- Camera Overlay: full screen, shutter button 72px white ring, close X top left, flash top right, switch camera.

## 6. AUTHENTICATION
- Welcome: centered logo 64px #FF6B35, tagline "Chụp chi tiêu. Nhìn thấy tiền đi.", 2 buttons: Đăng nhập (primary), Đăng ký (secondary), min height 48.
- Login: fields email/password, error inline "Email hoặc mật khẩu không chính xác" red bg #FEF2F2, forgot link.
- Register: email, password, confirm, rule check @gmail.com live, exception admin@spendshot.local allowed (UI hint only for admin path). Button disabled until valid.
- Password Reset: 4 steps UI with progress dots.

## 7. USER ROLES & ROUTING
FREE: Camera YES, Gallery LOCKED, Ads YES
PREMIUM: Camera YES, Gallery YES, Ads NO
ADMIN/SUPER_ADMIN: Login → role check → auto redirect /admin. If FREE/PREMIUM access /admin → Forbidden screen illustration 403 + button "Về trang chủ".

## 8. HOME SCREEN (Most Important)
Desktop: Header greeting 28px + name 20px secondary. Jar Card top 100% width, below Expense Feed 3 columns. Right rail optional Statistics mini.
Mobile: Greeting top, Jar Card, Filter chips (Hôm nay, Tuần này), Expense Grid 2 columns mobile (but desktop spec requires 3).
Jar details: Ngân sách 2.000.000₫, Đã chi 1.240.000₫, Còn lại 760.000₫, Progress 62%. Click Jar → Actions: Thêm tiền, Rút tiền, Sửa Hũ, Lịch sử.

Negative: Amount -240.000₫ red bold, progress 112%, bar red, text "Bạn đã vượt ngân sách tháng này 240.000₫." Yellow warning box #FEF3C7.

## 9. EXPENSE FEED
Locket-like. Desktop 3 columns, gap 20. Each card: Photo 1:1, amount 14 bold, time Caption 11 "Hôm nay · 14:32". No extra info.
Interaction: Click → Expense Detail modal (desktop) / full page mobile. Detail: large image 4:3, amount 24 bold, time, category chip, jar name, edit/delete icons top right.

## 10. CAMERA FLOW
Primary FAB #FF6B35. Flow: Click FAB → Camera permission check → Camera preview full screen → Capture button → Preview + Retake/Use → Amount screen (photo thumbnail top, amount input large, category optional) → Confirm → Success animation (checkmark) → Back to feed with new expense top.
Gallery button inside camera: if FREE → lock icon + tap shows Premium Upsell Bottom Sheet. If PREMIUM → open system file picker.

## 11. PREMIUM
Page: Hero gradient, badge, list benefits: ✓ Chọn ảnh từ thư viện, ✓ Không quảng cáo, ✓ Thống kê nâng cao, ✓ Sắp ra mắt. CTA "Nâng cấp Premium - 49.000₫/tháng". No fake payment if backend missing: show "Liên hệ admin" placeholder.

## 12. ADS
FREE: Banner 320x50 bottom above nav (mobile) / sidebar bottom desktop. Native ad in feed every 8 items (card styled but labeled "Quảng cáo"). Never cover camera, input. PREMIUM: no ads placeholder.

## 13. LOCAL-FIRST / OFFLINE / SYNC / PWA
- Offline indicator: chip small "Offline" amber dot top header, not blocking.
- Local save allowed always.
- Sync states chip: Synced green dot, Syncing spinner, Pending clock, Failed red, Offline gray. Position header right or jar card footer small 12px.
- Sync failure toast + persistent card in settings: "Chưa đồng bộ được. Dữ liệu của bạn vẫn được lưu trên thiết bị." CTA Thử lại.
- PWA Install: banner bottom "Thêm SpendShot vào màn hình chính" + CTA Cài đặt + dismiss X. Offline page: illustration, text "Bạn đang offline", button "Xem dữ liệu đã lưu".
- Push permission: custom pre-prompt modal explaining benefit before browser prompt.

## 14. NOTIFICATION CENTER
Bell icon with unread dot. List: Budget warning (red), Daily reminder (blue), Sync complete (green), Premium info (orange). States unread bold + dot, read opacity 60%, empty illustration.

## 15. PROFILE / SETTINGS / STORAGE
Profile: Avatar 80px, name, email, badge FREE/PREMIUM, stats: total expenses, jars. Settings sections list with icons: Account, Notifications, Privacy, Storage (Photos 420MB + Local 12MB + progress bar warning at 80%), Sync, PWA, About, Logout (danger). Logout → confirmation modal.

## 16. ADMIN DESIGN
Same branding #FF6B35 but layout professional. Sidebar 260px: SpendShot Admin, Dashboard, Users, Subscriptions, Ads, Storage, Sync Monitor, Audit Logs, Settings.
Header: admin name, notification, logout.
Dashboard cards: 10 metrics in grid 3 columns: Total Users, FREE, PREMIUM, Active, Suspended, Total Jars, Total Expenses, Storage Used, Sync Failures, Ads Status. Charts: User growth line, FREE/PREMIUM donut.
Users table: Avatar 32, Email, Plan badge, Status dot, Created, Last activity, Actions (eye, suspend). Filters top, search, pagination 10/25/50.
User Detail: 2 columns, left info card, right stats. Actions: Change plan, Suspend/Activate, Reset password (never show password).
Subscriptions, Ads (toggle Enable/Disable big switch), Storage, Sync Monitor (4 status columns + table), Audit Logs (Time, Admin, Action, Target, Result) no secrets.
Mobile Admin: Drawer hamburger, table horizontal scroll with sticky first column.

## 17. STATES
All empty/error/loading/forbidden designed:
- Empty Jar: "Chưa có Hũ nào" + illustration + CTA Tạo Hũ
- Empty Expense: "Chưa có khoản chi nào 📸" + CTA Chụp khoản chi đầu tiên
- Empty Notification, Search, Users, Logs
- Errors: Login error, Register error (gmail rule), Network error (retry), Upload error, Sync error, Permission denied, Forbidden 403, Session expired (login again), Server error 500, Premium required (upsell)
- Loading: skeleton grid 6 cards, skeleton jar, spinner button.

## 18. ACCESSIBILITY & MICRO-INTERACTIONS
Touch target ≥44px, focus ring 2px, contrast AA, not color only.
Animations: button press scale 0.97 100ms, card hover lift 2px 200ms, camera shutter scale, expense added pop 300ms, sync success checkmark.

## 19. DESIGN TOKENS SUMMARY
Export as CSS variables: --primary #FF6B35, --bg #FAFBFC, --radius-card 16px, --shadow-md, --spacing 4-64.

---
END SPEC


> ⚠️ QUY TẮC NGÔN NGỮ: Toàn bộ UI phải tiếng Việt. Xem DESIGN_HANDOFF.md mục LƯU Ý TIẾNG VIỆT.


---


# ===== FILE: FIGMA_STRUCTURE.md =====

# FIGMA STRUCTURE — SpendShot
File Organization for Professional Handoff

```
File: SpendShot Design System 1.0
```

## 00 — Cover
Frame 1440x900: Logo, title "SpendShot - Locket + Budget Jar", version, date, author Senior Product Designer. Thumbnail for Figma file.

## 01 — Design System
Page containing:
- Colors: Primary #FF6B35 swatches, Background #FAFBFC, Semantic colors with names and usage notes.
- Typography: Text styles Display/H1/H2/H3/H4/Body Large/Body/Body Small/Caption/Label/Button with Be Vietnam Pro. Hierarchy example.
- Spacing: Visual scale 4-64 with auto layout examples.
- Radius: Visual tokens Small 8, Medium 12, Large 16, Button 12, Modal 20, Sheet 24, FAB 28, Card 16.
- Shadow: sm/md/lg samples on white cards.
- Icons: Lucide set 20px/24px.
- Grid: Desktop 12-col 1200px max, Tablet 8-col, Mobile 4-col. Gutter 20 desktop, 16 mobile.
- Responsive rules table: Breakpoints 375,390,430,768,1024,1280,1440,1920.

Components as Figma Components with Variants.

## 02 — Components
Frames organized in auto layout vertical with 32 gap.

- Navigation: Desktop Sidebar (default/collapsed), Mobile Bottom Nav (default/active), Header (online/offline), Page Header, User Menu dropdown.
  Variants: state default/hover/active, role FREE/PREMIUM/ADMIN.
- Buttons: Primary/Secondary/Ghost/Danger/Icon/FAB. Variants: state default/hover/focus/pressed/disabled/loading, size sm/md/lg, icon left/right/only.
- Inputs: Email, Password, Amount, Search, Text, Category. Variants: default/focus/filled/error/disabled/loading. Show error message slot.
- Cards: Jar Card (normal/negative/warning), Expense Card (grid), Premium Card, Statistics Card, Admin Stat Card, User Card. Variants: desktop/mobile, FREE/PREMIUM.
- Feedback: Toast (success/warning/error/info), Alert, Empty states (8 types), Loading skeletons.
- Overlay: Modal 480w, Confirmation Dialog, Bottom Sheet (with drag handle), Image Viewer, Camera Overlay, PWA Install Banner, Push Permission Modal, Premium Upsell Sheet.

Each component uses Auto Layout, Constraints center, min-width.

## 03 — Authentication
Frames:
- Welcome 1440, 390
- Login 1440, 390 (default/error/loading)
- Register 1440, 390 (gmail validation states)
- Forgot Password (email input)
- Verification Code
- New Password
- Success
- Error states
All with prototype connections.

## 04 — User Desktop (1440x900 primary, variants 1280x800, 1920x1080)
Frames:
- Home: Sidebar 280 + Header + Jar Card + Expense Grid 3 cols 6 images visible. Show synced status.
- Expense Grid empty / filled / with ads (native ad every 8th)
- Expense Detail Modal (image left, info right) + Edit/Delete actions
- Jar Detail Modal: budget, spent, remaining, progress 62%, actions Add/Withdraw/Edit/History, quick chips +100K...
- Jar History list
- Statistics: chart spend by day, category donut
- Profile
- Settings (sections)
- Negative balance version of Home + warning

## 05 — User Mobile (390x844 primary, 375x812, 430x932)
Frames vertical:
- Home
- Camera (permission, preview, capture)
- Camera Preview (retake/use)
- Add Expense (photo thumb + amount large + category + confirm)
- Expense Detail full page
- Jar + Jar Bottom Sheet (actions)
- Statistics
- Profile
- Settings
- Premium Locked Sheet
- Ads Banner placement
- Offline indicator
- Sync states
- PWA Install banner
Bottom Nav + FAB visible on Home.

## 06 — Premium
Frames desktop+mobile:
- Premium Landing hero gradient
- Benefits list
- Gallery Locked (camera vs gallery comparison FREE/PREMIUM)
- Premium Upsell Bottom Sheet
- Premium Active (badge, gallery unlocked)
- Upgrade state (loading/success/error)

## 07 — Offline + PWA
Frames:
- Offline Indicator chip variations
- Offline Page (illustration)
- Sync Pending list
- Sync Failed card + retry
- Sync Success toast
- PWA Install prompt desktop+mobile
- Push permission pre-prompt + browser prompt flow

## 08 — Admin (Desktop-first 1440x900)
Frames:
- Admin Dashboard: 10 stat cards grid, charts (user growth line, FREE/PREMIUM donut)
- Users Table (default/filtered/search/pagination)
- User Detail (2 cols)
- Subscriptions
- Ads Management (toggle + config)
- Storage (usage bar)
- Sync Monitor (4 status kanban + table)
- Audit Logs table
- Admin Settings
- Forbidden 403
- Loading skeletons
- Empty states (no users, no logs, no sync failures)
- Error states
- Mobile Admin: Drawer version 390

## 09 — States
Dedicated page showing all states as components:
- Empty: Jar, Expense, Notification, Search, User, Audit Log, Sync Failure (with illustration + text + CTA)
- Error: Login, Register gmail rule, Network, Upload, Sync, Permission denied, Forbidden, Session expired, Server error, Premium required
- Loading: Button spinner, Image loading (blur + shimmer), Skeleton grid (6 cards), Dashboard skeleton, Table skeleton
- Confirmation: Delete expense, Suspend user, Logout, Reset data

## 10 — Prototype
Prototype flows with connections:
- User Flow: Welcome → Register → Login → Home → Camera → Capture → Preview → Amount → Save → Feed
- Premium Flow: Home → Gallery → Locked → Premium Page → Upgrade → Premium → Gallery unlocked
- Admin Flow: Login → Role Detection → /admin → Dashboard → Users → User Detail
- Offline Flow: Home → Offline → Camera → Create Expense → Save Local → Pending Sync → Online → Sync → Synced
- Error Flows: Login error, Register gmail error, Forbidden
- PWA Flow: Banner → Install → Offline

Prototype settings: Smart animate 200ms ease-out, overlay for modals.

## Figma Tokens Export
- Variables collection: Colors, Spacing, Radius, Shadow, Typography.
- Ready for Tokens Studio export to CSS.

## Auto Layout & Constraints Rules
- All frames use auto layout vertical/horizontal.
- Buttons hug contents.
- Cards fill container.
- Sidebar fixed width 280, content fill.
- Expense grid: fixed 3 columns desktop using auto layout wrap or grid (Figma 2024 grid support).
- Responsive: use min/max width, fill container.

## Naming Convention
- 00_Cover / 01_DesignSystem / etc.
- Component names: Button/Primary/Default, Input/Amount/Error, Card/Jar/Negative, etc.
- Frame names: Desktop/Home/Default, Mobile/Camera/Preview, Admin/Dashboard.

END FIGMA STRUCTURE


> ⚠️ QUY TẮC NGÔN NGỮ: Toàn bộ UI phải tiếng Việt. Xem DESIGN_HANDOFF.md mục LƯU Ý TIẾNG VIỆT.


---


# ===== FILE: DESIGN_HANDOFF.md =====

# DESIGN HANDOFF — For AI Coding Agent
SpendShot — Locket + Budget Jar — Handoff Spec

> AI Coding Agent phải đọc toàn bộ 4 file trước khi code. Không tự suy đoán.

Files:
- UI_UX_SPEC.md
- FIGMA_STRUCTURE.md
- DESIGN_HANDOFF.md (this)
- DESIGN_IMPROVEMENT_SUGGESTIONS.md

## AI HANDOVER

### Project
SpendShot là app quản lý chi tiêu cá nhân visual-first. Người dùng chụp ảnh món đồ vừa mua, nhập số tiền, tiền trừ vào Hũ ngân sách tháng. Locket-like feed. Local-first, offline, PWA, Premium, Admin cùng app.

### Architecture (Frontend mental model)
- Frontend: React + PWA (Vite), Local-first storage (IndexedDB + localForage), Sync queue, Camera API, File System.
- Backend: API for sync, auth, admin. Không sửa backend ở giai đoạn design.
- Local-first: mọi thao tác viết local trước, sync sau. UI không bao giờ chặn vì offline.
- PWA: install prompt, offline page, push.

### Business Rules (BẮT BUỘC)
- Gmail only: chỉ @gmail.com + admin@spendshot.local. Regex /^[a-zA-Z0-9._%+-]+@gmail\.com$/ và exact admin@spendshot.local. Frontend validate live, backend enforce.
- FREE: Camera YES, Gallery LOCKED (click → Premium Upsell Sheet), Ads YES.
- PREMIUM: Camera YES, Gallery YES, Ads NO.
- ADMIN/SUPER_ADMIN: login → check role → auto redirect /admin. FREE/PREMIUM vào /admin → Forbidden UI 403.
- Budget Jar: 1 hũ / tháng / user. Ngân sách 2.000.000₫ example, đã chi, còn lại, % = đã chi / ngân sách *100.
- Negative balance: cho phép âm, hiển thị -240.000₫ đỏ, không chặn giao dịch, warning "Bạn đã vượt ngân sách tháng này 240.000₫."
- Expense: id, user_id, jar_id, amount, photo, thumbnail, created_at, updated_at, category?, idempotency_key.
- Offline: indicator nhỏ, vẫn cho mọi action, lưu local.
- Sync: states Synced/Syncing/Pending/Failed/Offline, UI nhỏ, không xóa local khi fail.

### UI Rules (TUYỆT ĐỐI KHÔNG ĐỔI)
- Primary #FF6B35 luôn là màu nhận diện chính.
- Không bỏ Desktop. Desktop phải đẹp hoàn chỉnh 1440x900 primary, sidebar 280 fixed, 3-column expense grid, 6 ảnh visible.
- Mobile phải đẹp, bottom nav + FAB 64.
- Ảnh trung tâm, cùng kích thước, cùng aspect 1:1, không méo.
- Camera là action chính, mở camera trực tiếp không chọn file trước.
- FREE không bypass Gallery bằng frontend hack.
- Admin cùng app, không tách app riêng.

### Coding Rules for AI Agent
- Đọc spec trước, không rewrite, không redesign, không phá business logic, không tự thêm feature.
- Nếu phát hiện bug: Find cause → Minimal fix → Test → Report → Stop.
- Dùng spacing system 4,8,12,16,20,24,32,40,48,64.
- Radius system: card 16, button 12, modal 20, sheet 24 top.
- Shadow nhẹ only.
- Typography Be Vietnam Pro.

---

## WHAT TO CODE (Component List)

### Core Design Tokens (code first)
```ts
colors: primary #FF6B35, bg #FAFBFC, surface #FFF, text #111827/#6B7280, border #E5E7EB, success #10B981, warning #F59E0B, danger #EF4444, info #3B82F6
spacing: [4,8,12,16,20,24,32,40,48,64]
radius: { sm:8, md:12, lg:16, button:12, modal:20, sheet:24, fab:28 }
shadow: { sm, md, lg }
typography: as spec
```

### Components to Code
1. Button: variants primary/secondary/ghost/danger/icon/fab, states default/hover/focus/pressed/disabled/loading. Props: variant, size, loading, icon.
2. Input: Email (gmail validation), Password (eye toggle), Amount (large, quick chips), Search, Text, Category (select). States default/focus/filled/error/disabled.
3. Card: JarCard (props: total, spent, remaining, percentage, negative boolean), ExpenseCard (photo, amount, time), PremiumCard, StatCard, AdminStatCard, UserCard.
4. Navigation: DesktopSidebar (items, active, jarMini, syncStatus), MobileBottomNav (activeTab, fabAction), Header (greeting, offline, notification).
5. Overlay: Modal (480px desktop, bottom sheet mobile), ConfirmationDialog, BottomSheet (drag handle), ImageViewer, CameraOverlay.
6. Feedback: ToastProvider, EmptyState (type: jar/expense/notification/search/user/logs/sync), Skeleton (grid/jar/table).
7. Ads: BannerAd (show if FREE), NativeAdCard (every 8 items).
8. SyncIndicator: dot + text Synced/Syncing/Pending/Failed/Offline.
9. PWAInstallBanner, PushPermissionModal.

### Screens to Code
**Auth:** Welcome, Login (error handling "Email hoặc mật khẩu không chính xác"), Register (gmail rule live), ForgotPassword, Verification, NewPassword, Success.

**User Desktop (1440):** Home (greeting, JarCard, Expense Grid 3 cols), ExpenseDetail Modal, Jar Modal + History, Statistics, Profile, Settings, Premium page, Forbidden, Offline page.

**User Mobile (390):** Same but BottomSheet for Jar actions, full page camera, full page add expense.

**Admin Desktop (1440):** AdminLayout (sidebar 260), Dashboard (10 cards + charts), Users Table (search/filter/pagination), User Detail, Subscriptions, Ads Management (toggle), Storage, Sync Monitor, Audit Logs, Settings, Forbidden, Loading, Empty, Error.

**Mobile Admin:** Drawer + same functionality.

### Responsive Behavior (code spec)
- Breakpoints: mobile <768, tablet 768-1023, desktop >=1024.
- Desktop Sidebar: fixed 280px, content max-width 1200 centered, padding 32.
- Tablet Sidebar: collapsible 72px icon-only, toggle button.
- Expense Grid: desktop 3 cols gap 20, tablet 3 cols gap 16, mobile 2 cols gap 12. First viewport must show ~6 images desktop.
- Images: object-fit cover, aspect 1:1, width 100%, no distortion.
- Bottom Nav mobile: height 64, FAB 64 centered top -28 overlap.
- Amount Input: font 32 bold, inputMode numeric, pattern [0-9]*.
- Touch target min 44px all interactive.

### Interactions & Animations
- Button press: scale 0.97 100ms.
- Card hover desktop: translateY -2px shadow md 200ms.
- Camera capture: shutter scale 0.9 then 1 150ms + flash white overlay.
- Expense added: pop scale 0.8→1 300ms spring.
- Sync completed: checkmark animation.
- Modal: fade + scale 0.95→1 200ms ease-out, backdrop 50% black.
- Bottom Sheet: slide up 300ms.

### States Implementation
- Empty: illustration component (emoji based for MVP) + text + CTA button.
- Error: inline for inputs, toast for network, full page for 403/500.
- Loading: skeleton shimmer CSS animation.
- Offline: chip amber, still allow all actions.
- Sync failure: persistent card in settings + toast + retry button.

### Business Logic Enforcement (frontend, but backend also)
- Email validation: function isValidEmail(email) => /@gmail\.com$/ or admin@spendshot.local exact.
- Role check: after login, if role ADMIN/SUPER_ADMIN → navigate /admin else /.
- Gallery lock: if user.plan === FREE and action === openGallery → show PremiumUpsell sheet, return.
- Ads: if user.plan === FREE → render ads, else hide.
- Negative balance: if remaining <0 → JarCard negative variant, progress >100%, bar danger, warning text.
- Amount formatting: VND format 2.000.000 ₫, allow negative -240.000 ₫.

### File Structure Suggested (for AI)
```
/src
  /components
    /ui (Button, Input, Card, Modal, Toast...)
    /jar (JarCard, JarActions, JarHistory)
    /expense (ExpenseCard, ExpenseGrid, ExpenseDetail, CameraOverlay)
    /premium (PremiumCard, UpsellSheet)
    /admin (AdminSidebar, StatCard, UsersTable...)
  /pages
    /auth (Welcome, Login, Register...)
    /user (Home, Statistics, Profile, Settings, Premium)
    /admin (Dashboard, Users, UserDetail, Subscriptions, Ads, Storage, Sync, AuditLogs)
  /hooks (useCamera, useLocalFirst, useSync, usePWA)
  /lib (formatVND, validateEmail, syncQueue)
  /styles (tokens.css)
```

### Acceptance Checklist (AI must verify)
- Desktop 1440x900 shows sidebar + 3-col grid + 6 images.
- Mobile 390 no horizontal scroll, FAB clickable, amount input large.
- Gmail validation works, admin@spendshot.local allowed.
- Role redirect to /admin for ADMIN.
- FREE gallery locked, PREMIUM unlocked.
- Negative balance red, warning, not blocked.
- Offline indicator small, actions still work.
- Sync states visible.
- Admin full features same app.

END HANDOFF


---
## ⚠️ LƯU Ý BẮT BUỘC CHO AI CODING AGENT — TIẾNG VIỆT

**TOÀN BỘ UI TEXT PHẢI DÙNG TIẾNG VIỆT.**

- Mọi label, button, placeholder, toast, empty state, error message, modal, notification đều phải tiếng Việt.
- Ví dụ:
  - Button: "Đăng nhập", "Đăng ký", "Chụp khoản chi", "Thêm tiền", "Lưu", "Hủy", "Thử lại", "Nâng cấp Premium"
  - Empty: "Chưa có khoản chi nào 📸", "Chưa có Hũ nào", "Không có kết quả tìm kiếm"
  - Error: "Email hoặc mật khẩu không chính xác", "Chỉ chấp nhận @gmail.com", "Bạn đã vượt ngân sách tháng này 240.000 ₫"
  - Jar: "Ngân sách", "Đã chi", "Còn lại", "Đã sử dụng 62%"
  - Sync: "Đã đồng bộ", "Đang đồng bộ", "Chưa đồng bộ", "Offline"
- Không dùng tiếng Anh cho user-facing text (trừ logo SpendShot, email).
- Code comments và tên biến có thể tiếng Anh, nhưng UI render phải 100% tiếng Việt.
- Admin UI cũng tiếng Việt, trừ các thuật ngữ kỹ thuật nếu cần giữ nguyên (ví dụ: API key thì không dịch nhưng label vẫn tiếng Việt).
- Đây là yêu cầu bắt buộc, nếu AI code ra tiếng Anh là FAIL review.


---


# ===== FILE: DESIGN_IMPROVEMENT_SUGGESTIONS.md =====

# DESIGN IMPROVEMENT SUGGESTIONS — SpendShot
> Chỉ chứa đề xuất chưa áp dụng. Không tự áp dụng khi đang thiết kế.

## 1. Jar Suggestions
- Cho phép tạo nhiều hũ theo mục đích (Ăn uống, Di chuyển) trong tương lai, nhưng hiện tại giữ 1 hũ/tháng để đơn giản.
- Thêm tính năng tự động reset hũ vào ngày 1 hàng tháng với animation confetti nhẹ.
- Quick add bằng giọng nói "Thêm 50k cà phê" — cần cân nhắc privacy.

## 2. Expense Feed
- Thêm chế độ xem Timeline theo ngày với sticky date header giống Locket.
- Filter theo category nhanh bằng horizontal chips.
- Long press để multi-select delete.

## 3. Camera & Visual
- Hỗ trợ nhận diện số tiền từ hóa đơn bằng OCR on-device (giữ local-first).
- Thêm filter màu nhẹ cho ảnh giống Locket để tăng tính cá nhân.
- Thumbnail generation Web Worker để không block UI.

## 4. Premium & Monetization
- Thêm lifetime plan ngoài monthly.
- Family sharing cho hũ chung (vợ chồng).
- Cho phép FREE dùng gallery 3 lần đầu như trial.

## 5. PWA & Offline
- Background sync API cho sync khi online lại tự động.
- Share target API để nhận ảnh từ app khác.
- Widget cho Android/iOS PWA.

## 6. Admin
- Thêm chart chi phí lưu trữ theo thời gian.
- Bulk actions cho users (suspend nhiều user).
- Export audit logs CSV.

## 7. Accessibility
- Haptic feedback cho camera shutter trên mobile.
- VoiceOver labels đầy đủ cho expense grid.

## 8. Performance
- Virtualized grid cho 1000+ expenses.
- Image lazy loading + blur placeholder.

Tất cả đề xuất trên chỉ là ý tưởng, không được tự thêm vào thiết kế hiện tại nếu chưa có phê duyệt.


---
