import { test, expect } from "@playwright/test";

// Camera giả lập + backend thật: chụp → nhập tiền → lưu → feed hiện ngay, KHÔNG reload
test.use({
  permissions: ["camera"],
  launchOptions: { channel: "chromium", args: ["--use-fake-device-for-media-stream"] },
});

const API = "http://127.0.0.1:8000";

test("chụp → lưu → feed hiện ngay không cần reload", async ({ page, request }) => {
  const email = `camflow${Date.now()}@gmail.com`;
  await request.post(`${API}/auth/register`, { data: { email, password: "123456" } });
  const login = await request.post(`${API}/auth/login`, { data: { email, password: "123456" } });
  const { access_token, user } = await login.json();
  const jarRes = await request.post(`${API}/jars`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: { budget: 2000000, month: "2032-01" },
  });
  const jar = await jarRes.json();

  await page.addInitScript(
    ({ token, u }) => {
      localStorage.setItem("spendshot_token", token);
      localStorage.setItem("spendshot_user", JSON.stringify(u));
    },
    { token: access_token, u: user }
  );

  await page.goto("/?camera=1");
  // Nút chụp sáng lên khi video sẵn sàng
  const shutter = page.getByRole("button", { name: "Chụp ảnh" });
  await expect(shutter).toBeEnabled({ timeout: 15000 });
  await shutter.click();
  // Vào thẳng màn hình nhập tiền, thấy ảnh vừa chụp
  await expect(page.getByText("Thêm khoản chi")).toBeVisible({ timeout: 15000 });
  // Nhập tiền (tự chia nghìn) và lưu
  await page.getByPlaceholder("0").fill("150000");
  await expect(page.getByPlaceholder("0")).toHaveValue("150.000");
  await page.getByRole("button", { name: "Lưu" }).click();
  // Feed hiện ngay khoản mới + Hũ trừ tiền ngay — không reload
  await expect(page.getByText("150.000 ₫").first()).toBeVisible({ timeout: 15000 });

  // Thêm khoản thứ 2 qua API rồi kéo chuột sang trái để qua ảnh (không nút bấm)
  await request.post(`${API}/expenses`, {
    headers: { Authorization: `Bearer ${access_token}` },
    multipart: { jar_id: jar.id, amount: "99000", idempotency_key: `swipe-${Date.now()}` },
  });
  await page.reload();
  // Bấm thẻ đầu tiên trong lưới (bất kể là khoản nào), kéo sang trái phải qua ảnh,
  // kéo tiếp ở ảnh cuối thì đứng yên (không vòng lặp)
  const viewer = page.locator("div.fixed.inset-0.z-50");
  const viewerAmount = viewer.locator("p.text-xl");
  await page.getByTestId("expense-grid").locator(":scope > div").first().click();
  await expect(viewerAmount).toBeVisible({ timeout: 15000 });
  const dragLeft = async () => {
    const img = viewer.locator("img").first();
    const box = await img.boundingBox();
    if (box) {
      const cy = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.75, cy);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.25, cy, { steps: 12 });
      await page.mouse.up();
    }
  };
  const first = await viewerAmount.innerText();
  await dragLeft();
  // Đã qua ảnh thứ 2 (khác ảnh đầu)
  await expect(viewerAmount).not.toHaveText(first, { timeout: 15000 });
  const atEnd = await viewerAmount.innerText();
  await dragLeft();
  // Kéo tiếp ở ảnh cuối vẫn đứng yên
  await expect(viewerAmount).toHaveText(atEnd, { timeout: 15000 });

  // Xác minh server cũng có (đối chiếu, không phải chỉ UI ảo)
  const list = await request.get(`${API}/expenses?jar_id=${jar.id}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const expenses = await list.json();
  expect(expenses.some((e: any) => e.amount === 150000)).toBe(true);
});
