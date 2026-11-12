import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { buildApp } from "../../src/server/app.js";

test("IQA-001 loads the single status page and keeps a pending request visible", async ({
  context,
  page,
}, testInfo) => {
  const app = buildApp(undefined, { registerStatusRoutes: false });
  let requestCount = 0;
  let releaseStatus = (): void => undefined;
  const pendingStatus = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  app.get("/api/status", async (_request, reply) => {
    requestCount += 1;
    await pendingStatus;
    return reply.send();
  });
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const tracePath = testInfo.outputPath("iqa-001-trace.zip");

  await context.tracing.start({ screenshots: true, snapshots: true });
  try {
    const startedAt = Date.now();
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { level: 1, name: "最小流程验证" }),
    ).toBeVisible();
    const status = page.getByRole("status");
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText("正在获取状态");
    expect(Date.now() - startedAt).toBeLessThanOrEqual(2_000);
    await expect.poll(() => requestCount).toBe(1);
    await expect(page.getByText("ok", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("iqa-001-loading.png"),
      fullPage: true,
    });
  } finally {
    await context.tracing.stop({ path: tracePath });
    releaseStatus();
    await app.close();
  }
});

test("IQA-002 shows exact success within three seconds after one request", async ({
  context,
  page,
}, testInfo) => {
  const app = buildApp();
  let requestCount = 0;
  app.addHook("onRequest", async (request) => {
    if (request.url === "/api/status") {
      requestCount += 1;
    }
  });

  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const tracePath = testInfo.outputPath("iqa-002-trace.zip");

  await context.tracing.start({ screenshots: true, snapshots: true });
  try {
    const requestedAt = Date.now();
    await page.goto(origin);
    const status = page.getByRole("status");
    await expect(status).toHaveText("ok");
    expect(Date.now() - requestedAt).toBeLessThanOrEqual(3_000);
    expect(requestCount).toBe(1);
    await expect(page.getByText("ok", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button")).toHaveCount(0);
    await page.waitForTimeout(100);
    expect(requestCount).toBe(1);
    await page.screenshot({
      path: testInfo.outputPath("iqa-002-success.png"),
      fullPage: true,
    });
  } finally {
    await context.tracing.stop({ path: tracePath });
    await app.close();
  }
});

test("IQA-003 and IQA-004 expose a safe failure and recover only after retry", async ({
  context,
  page,
}, testInfo) => {
  const app = buildApp();
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  let requestCount = 0;
  let releaseRecovery = (): void => undefined;
  const pendingRecovery = new Promise<void>((resolve) => {
    releaseRecovery = resolve;
  });
  await page.route("**/api/status", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.abort("connectionfailed");
      return;
    }
    await pendingRecovery;
    await route.continue();
  });
  const tracePath = testInfo.outputPath("iqa-003-004-trace.zip");

  await context.tracing.start({ screenshots: true, snapshots: true });
  try {
    const firstRequestedAt = Date.now();
    await page.goto(origin);
    await expect(page.getByRole("alert")).toHaveText("状态获取失败，请重试");
    expect(Date.now() - firstRequestedAt).toBeLessThanOrEqual(3_000);
    await expect(page.getByRole("button", { name: "重试" })).toHaveCount(1);
    await expect(page.getByText("ok", { exact: true })).toHaveCount(0);
    expect(requestCount).toBe(1);
    await page.waitForTimeout(100);
    expect(requestCount).toBe(1);

    const retryRequestedAt = Date.now();
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByRole("status")).toHaveText("正在获取状态");
    releaseRecovery();
    await expect(page.getByRole("status")).toHaveText("ok");
    expect(Date.now() - retryRequestedAt).toBeLessThanOrEqual(3_000);
    expect(requestCount).toBe(2);
    await page.screenshot({
      path: testInfo.outputPath("iqa-004-recovered.png"),
      fullPage: true,
    });
  } finally {
    releaseRecovery();
    await context.tracing.stop({ path: tracePath });
    await app.close();
  }
});

test("IQA-005 recovers after consecutive failures without automatic requests", async ({
  page,
}, testInfo) => {
  const app = buildApp();
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  let requestCount = 0;
  await page.route("**/api/status", async (route) => {
    requestCount += 1;
    if (requestCount <= 2) {
      await route.abort("connectionfailed");
      return;
    }
    await route.continue();
  });

  try {
    await page.goto(origin);
    await expect(page.getByRole("alert")).toBeVisible();
    expect(requestCount).toBe(1);
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(requestCount).toBe(2);
    await page.waitForTimeout(100);
    expect(requestCount).toBe(2);
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByRole("status")).toHaveText("ok");
    expect(requestCount).toBe(3);
    await page.screenshot({
      path: testInfo.outputPath("iqa-005-consecutive-recovery.png"),
      fullPage: true,
    });
  } finally {
    await app.close();
  }
});

test("IQA-006 and IQA-007 keep recovery minimal, keyboard-operable, and perceivable", async ({
  page,
}, testInfo) => {
  const app = buildApp();
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  let failRequest = true;
  await page.route("**/api/status", async (route) => {
    if (failRequest) {
      await route.abort("connectionfailed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    await route.continue();
  });

  try {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(origin);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "重试" })).toHaveCount(1);
    await expect(page.getByRole("link")).toHaveCount(0);
    await expect(page.locator("input")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.keyboard.press("Tab");
    const retry = page.getByRole("button", { name: "重试" });
    await expect(retry).toBeFocused();
    expect(
      await retry.evaluate((element) => element.matches(":focus-visible")),
    ).toBe(true);
    failRequest = false;
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("正在获取状态");
    await expect(page.getByRole("status")).toHaveText("ok");

    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "最小流程验证" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await page.setViewportSize({ width: 1_440, height: 900 });
    await expect(page.getByRole("status")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("iqa-006-007-accessibility.png"),
      fullPage: true,
    });
  } finally {
    await app.close();
  }
});
