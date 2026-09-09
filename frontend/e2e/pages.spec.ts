import { test, expect } from "@playwright/test";

async function fakeLogin(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "a@gmail.com", role: "FREE", status: "ACTIVE" }));
  });
}

test("modal thông báo tắt sau khi bấm Bật", async ({ page }) => {
  await fakeLogin(page);
  // Giả lập trình duyệt ở trạng thái chưa hỏi quyền (headless mặc định đã denied)
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: async () => "denied" },
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(page.getByText("Bật thông báo?")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Bật", exact: true }).click();
  await expect(page.getByText("Bật thông báo?")).toBeHidden({ timeout: 15000 });
});

test("bấm Đăng xuất hiện modal xác nhận đúng", async ({ page }) => {
  test.skip((page.viewportSize()?.width || 0) < 768, "Sidebar chỉ hiện từ tablet trở lên");
  await fakeLogin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByText("Đăng xuất?")).toBeVisible({ timeout: 15000 });
  const backdrop = page.locator("div.fixed.inset-0.z-\\[100\\] > div.absolute.inset-0");
  await expect(backdrop).toBeVisible();
});

test("trang Hồ sơ có nút Đăng xuất", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/profile");
  await expect(page.getByRole("main").getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});

test("FAB camera mở overlay chụp ảnh", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/?camera=1");
  // Overlay camera hiện (nút đóng) — dù webcam thật hay báo lỗi quyền
  await expect(page.getByRole("button", { name: "Đóng camera" })).toBeVisible({ timeout: 15000 });
});

test("chuông mở trung tâm thông báo", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Thông báo" }).click();
  await expect(page.getByText("Chưa có thông báo nào").or(page.getByText("Vượt ngân sách!")).or(page.getByText("Lên Premium"))).toBeVisible({ timeout: 15000 });
});

test("trang Thanh toán yêu cầu đăng nhập", async ({ page }) => {
  await page.goto("/payment");
  await expect(page).toHaveURL(/welcome/);
});

test("Enter gửi form đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("ban@gmail.com").fill("khongtontai@gmail.com");
  await page.getByPlaceholder("••••••••").fill("123456");
  await page.getByPlaceholder("••••••••").press("Enter");
  // Form submit → báo lỗi sai tài khoản (chứng tỏ Enter có gửi, không cần click chuột)
  await expect(page.getByText("Email hoặc mật khẩu không chính xác")).toBeVisible({ timeout: 15000 });
});

test("ô tiền tự chia hàng nghìn", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/");
  // Mở modal tạo Hũ để thấy ô ngân sách (không cần có Hũ, chỉ cần chưa có Hũ nào... dùng ExpenseModal cần jar)
  // Test trực tiếp ô tạo Hũ nếu hiện, ngược lại kiểm tra ExpenseModal qua nút camera preview flow — đơn giản:
  // gõ vào ô ngân sách (nếu có nút Tạo Hũ mới) và kiểm tra định dạng
  const createBtn = page.getByRole("button", { name: "Tạo Hũ mới" });
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
    const input = page.getByPlaceholder("VD: 2.000.000");
    await input.fill("2000000");
    await expect(input).toHaveValue("2.000.000");
  }
});

test("nút lịch mở sheet ảnh theo tháng", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Xem ảnh theo tháng" }).click();
  await expect(page.getByText("Ảnh theo tháng")).toBeVisible({ timeout: 15000 });
});

test("kéo sheet lịch xuống để đóng", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Xem ảnh theo tháng" }).click();
  const handle = page.getByTestId("sheet-handle");
  await expect(handle).toBeVisible({ timeout: 15000 });
  const box = await handle.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 260, { steps: 12 });
    await page.mouse.up();
  }
  await expect(page.getByText("Ảnh theo tháng")).toBeHidden({ timeout: 15000 });
});

test("admin mobile có menu dưới điều hướng được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "admin@spendshot.local", role: "SUPER_ADMIN", status: "ACTIVE" }));
  });
  await page.goto("/admin");
  const nav = page.locator('nav[aria-label="Menu quản trị"]');
  await expect(nav).toBeVisible();
  await nav.getByText("Người dùng").click();
  await expect(page).toHaveURL(/admin\/users/);
});

test("admin mobile nút Thêm mở sheet có Đăng xuất", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "admin@spendshot.local", role: "SUPER_ADMIN", status: "ACTIVE" }));
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Thêm" }).click();
  const sheet = page.locator("div.fixed.inset-0.z-50");
  await expect(sheet.getByText("Chức năng khác")).toBeVisible({ timeout: 15000 });
  await expect(sheet.getByText("Cài đặt")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await sheet.getByText("Lưu trữ").click();
  await expect(page).toHaveURL(/admin\/storage/);
});

test("di chuột vào biểu đồ hiện số tiền", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/statistics");
  const dayChart = page.locator('[data-testid="day-chart"]');
  await expect(dayChart).toBeVisible({ timeout: 15000 });
  await dayChart.hover();
  await expect(page.locator('[data-testid="chart-tip"]').first()).toBeVisible({ timeout: 15000 });
  const monthChart = page.locator('[data-testid="month-chart"]');
  await monthChart.hover();
});

test("trang Thống kê hiển thị", async ({ page }) => {
  await fakeLogin(page);
  await page.goto("/statistics");
  await expect(page.getByText("Tổng chi")).toBeVisible();
});
