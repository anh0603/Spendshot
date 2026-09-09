import { test, expect } from "@playwright/test";

test("welcome hiển thị tiếng Việt", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "SpendShot" })).toBeVisible();
  await expect(page.getByText("Chụp chi tiêu. Nhìn thấy tiền đi.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("welcome có mục liên hệ khi cuộn", async ({ page }) => {
  await page.goto("/welcome");
  const contact = page.getByText("Cần hỗ trợ? Gọi hoặc nhắn cho chúng tôi.");
  await contact.scrollIntoViewIfNeeded();
  await expect(contact).toBeVisible();
});

test("register chặn non-gmail", async ({ page }) => {
  await page.goto("/register");
  await page.getByPlaceholder("ban@gmail.com").fill("user@yahoo.com");
  await page.getByPlaceholder("ban@gmail.com").blur();
  await expect(page.locator("form span.text-danger")).toContainText("Chỉ chấp nhận @gmail.com");
});

test("login chặn non-gmail trước khi gọi API", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("ban@gmail.com").fill("user@outlook.com");
  await page.getByPlaceholder("••••••••").fill("123456");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Chỉ chấp nhận @gmail.com")).toBeVisible();
});

test("chưa login vào / bị redirect /welcome", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/welcome/);
});

test("FREE/PREMIUM vào /admin bị 403", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "a@gmail.com", role: "FREE", status: "ACTIVE" }));
  });
  await page.goto("/admin");
  await expect(page.getByText("403")).toBeVisible();
  await expect(page.getByText("Về trang chủ")).toBeVisible();
});
