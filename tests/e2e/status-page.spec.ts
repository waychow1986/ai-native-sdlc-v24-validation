import { expect, test } from "@playwright/test";

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
