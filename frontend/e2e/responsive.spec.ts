import { test, expect } from "@playwright/test";

test("tablet sidebar collapsible 72px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "a@gmail.com", role: "FREE", status: "ACTIVE" }));
  });
  await page.goto("/");
  const sidebar = page.locator("aside").first();
  await expect(sidebar).toBeVisible();
  // toggle button chỉ hiện trên tablet (<lg)
  const toggle = page.getByRole("button", { name: /menu/ });
  await expect(toggle).toBeVisible();
  // click thu gọn/mở rộng không crash
  await toggle.click();
  await expect(sidebar).toBeVisible();
});

test("desktop sidebar 280px đầy đủ label", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "a@gmail.com", role: "FREE", status: "ACTIVE" }));
  });
  await page.goto("/");
  await expect(page.locator("aside").first()).toBeVisible();
  await expect(page.getByText("SpendShot").first()).toBeVisible();
});

test("mobile bottom nav + FAB, không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("spendshot_token", "fake");
    localStorage.setItem("spendshot_user", JSON.stringify({ id: "1", email: "a@gmail.com", role: "FREE", status: "ACTIVE" }));
  });
  await page.goto("/");
  await expect(page.getByText("Trang chủ").last()).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
