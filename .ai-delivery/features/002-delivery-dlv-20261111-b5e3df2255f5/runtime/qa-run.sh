#!/usr/bin/env bash
set -uo pipefail

: "${QA_RESULT_PATH:?QA_RESULT_PATH is required}"

export QA_DELIVERY_ID QA_CANDIDATE_SHA QA_BASE_URL QA_HEALTH_PATH
export QA_PLAN_COMMIT_SHA QA_PLAN_HASH QA_RESULT_PATH

node --input-type=module <<'EOF'
import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const requiredNames = [
  "QA_DELIVERY_ID",
  "QA_CANDIDATE_SHA",
  "QA_BASE_URL",
  "QA_HEALTH_PATH",
  "QA_PLAN_COMMIT_SHA",
  "QA_PLAN_HASH",
  "QA_RESULT_PATH",
];
const env = process.env;
const missing = requiredNames.filter((name) => !env[name]);
const scenarioIds = Array.from({ length: 8 }, (_, index) =>
  `IQA-${String(index + 1).padStart(3, "0")}`,
);
const scenarios = scenarioIds.map((id) => ({
  id,
  passed: false,
  externalServices: [],
  evidence: "尚未执行。",
}));
const defects = [];
const testGaps = [];
const evidence = [];
const metrics = {};
let browser;
let environmentFailure;

class TestGap extends Error {}

function now() {
  return new Date().toISOString();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function concise(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function setScenario(id, passed, detail) {
  const scenario = scenarios.find((item) => item.id === id);
  scenario.passed = passed;
  scenario.evidence = detail;
}

async function runScenario(id, execute) {
  try {
    const detail = await execute();
    setScenario(id, true, detail);
  } catch (error) {
    const detail = concise(error);
    setScenario(id, false, detail);
    if (error instanceof TestGap) {
      testGaps.push(`${id}: ${detail}`);
    } else {
      defects.push(`${id}: ${detail}`);
    }
  }
}

async function waitForCandidate(baseUrl, healthPath, deliveryId, candidateSha) {
  const deadline = Date.now() + 300_000;
  let lastDiagnostic = "尚未发起检查";
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(10_000, Math.max(1, deadline - Date.now())),
    );
    try {
      const healthUrl = new URL(healthPath, baseUrl);
      const health = await fetch(healthUrl, {
        redirect: "error",
        signal: controller.signal,
      });
      if (health.status !== 204) {
        throw new Error(`readiness HTTP ${health.status}`);
      }

      const identityUrl = new URL("/candidate-identity", baseUrl);
      const identityResponse = await fetch(identityUrl, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
      if (identityResponse.status !== 200) {
        throw new Error(`identity HTTP ${identityResponse.status}`);
      }
      const identity = await identityResponse.json();
      if (
        identity?.deliveryId !== deliveryId ||
        identity?.candidateSha !== candidateSha
      ) {
        throw new Error(
          `identity mismatch: deliveryId=${String(identity?.deliveryId)}, candidateSha=${String(identity?.candidateSha)}`,
        );
      }
      return `第 ${attempts} 次检查通过；readiness=204；Candidate identity 与平台输入一致；时间=${now()}`;
    } catch (error) {
      lastDiagnostic = concise(error);
    } finally {
      clearTimeout(timeout);
    }
    const retryDelay = Math.min(5_000, Math.max(0, deadline - Date.now()));
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  throw new Error(
    `Candidate 在五分钟内未就绪；尝试次数=${attempts}；最后诊断=${lastDiagnostic}`,
  );
}

async function newPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

try {
  if (missing.length > 0) {
    throw new Error(`缺少 QA Runner 输入：${missing.join(", ")}`);
  }

  const baseUrl = new URL(env.QA_BASE_URL);
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("QA_BASE_URL 必须使用 HTTP 或 HTTPS");
  }
  if (!env.QA_HEALTH_PATH.startsWith("/")) {
    throw new Error("QA_HEALTH_PATH 必须是绝对路径");
  }

  evidence.push(
    await waitForCandidate(
      baseUrl,
      env.QA_HEALTH_PATH,
      env.QA_DELIVERY_ID,
      env.QA_CANDIDATE_SHA,
    ),
  );

  browser = await chromium.launch({ headless: true });

  await runScenario("IQA-001", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    let requestRecord = "";
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/status", async (route) => {
      requestCount += 1;
      requestRecord = `${route.request().method()} ${route.request().url()}`;
      await hold;
      await route.continue();
    });
    const openedAt = Date.now();
    try {
      await page.goto(baseUrl.href);
      await page
        .getByRole("heading", { level: 1, name: "最小流程验证" })
        .waitFor();
      const status = page.getByRole("status");
      await status.waitFor();
      await status.filter({ hasText: /^正在获取状态$/ }).waitFor();
      const pageReadyMs = Date.now() - openedAt;
      assert(pageReadyMs <= 2_000, `页面主体耗时 ${pageReadyMs}ms，超过 2000ms`);
      assert((await status.count()) === 1, "处理中状态区域不是唯一");
      assert(requestCount === 1, `处理中请求数为 ${requestCount}，预期 1`);
      assert(
        (await page.getByText("ok", { exact: true }).count()) === 0 &&
          (await page.getByRole("alert").count()) === 0,
        "结果未决期间提前显示成功或失败",
      );
      metrics.pageReadyMs = pageReadyMs;
      return `页面主体 ${pageReadyMs}ms 可用；标题正确；唯一状态区域显示“正在获取状态”；请求=${requestRecord}；次数=1；时间=${now()}`;
    } finally {
      release();
      await context.close();
    }
  });

  await runScenario("IQA-002", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    let requestedAt;
    let requestMethod;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/status") {
        requestCount += 1;
        requestedAt ??= Date.now();
        requestMethod = request.method();
      }
    });
    const openedAt = Date.now();
    try {
      await page.goto(baseUrl.href);
      await page
        .getByRole("heading", { level: 1, name: "最小流程验证" })
        .waitFor();
      const status = page.getByRole("status");
      await status.filter({ hasText: /^ok$/ }).waitFor();
      const completedAt = Date.now();
      const pageReadyMs = completedAt - openedAt;
      const statusMs = completedAt - requestedAt;
      assert(requestedAt !== undefined, "未观察到 GET /api/status");
      assert(requestMethod === "GET", `状态请求 method=${String(requestMethod)}，预期 GET`);
      assert(statusMs <= 3_000, `首次状态耗时 ${statusMs}ms，超过 3000ms`);
      assert(requestCount === 1, `首次成功请求数为 ${requestCount}，预期 1`);
      assert((await status.count()) === 1, "成功状态区域不是唯一");
      assert((await page.getByRole("button").count()) === 0, "成功状态存在重试按钮");
      await page.waitForTimeout(200);
      assert(requestCount === 1, "成功后发生自动刷新");
      metrics.success = { pageReadyMs, statusMs };
      return `一次 GET /api/status 后唯一状态区域仅显示“ok”；页面=${pageReadyMs}ms；状态=${statusMs}ms；200ms 观察期无自动刷新；时间=${now()}`;
    } finally {
      await context.close();
    }
  });

  await runScenario("IQA-003", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    let requestedAt;
    await page.route("**/api/status", async (route) => {
      requestCount += 1;
      requestedAt ??= Date.now();
      await route.abort("connectionfailed");
    });
    try {
      await page.goto(baseUrl.href);
      const alert = page.getByRole("alert");
      await alert.filter({ hasText: /^状态获取失败，请重试$/ }).waitFor();
      const failureMs = Date.now() - requestedAt;
      assert(failureMs <= 3_000, `失败状态耗时 ${failureMs}ms，超过 3000ms`);
      assert(requestCount === 1, `首次失败请求数为 ${requestCount}，预期 1`);
      assert((await alert.count()) === 1, "失败提示不是唯一");
      assert(
        (await page.getByRole("button", { name: "重试" }).count()) === 1,
        "人工重试按钮不是唯一",
      );
      assert((await page.getByText("ok", { exact: true }).count()) === 0, "失败被显示为 ok");
      await page.waitForTimeout(200);
      assert(requestCount === 1, "失败后发生自动重试");
      metrics.failure = { statusMs: failureMs };
      return `真实 GET /api/status 被网络 abort；${failureMs}ms 后显示唯一安全失败提示和重试按钮；200ms 观察期无自动重试；时间=${now()}`;
    } finally {
      await context.close();
    }
  });

  await runScenario("IQA-004", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    let retryRequestedAt;
    let pendingRetryRoute;
    let releasePendingRoute;
    const pendingRoute = new Promise((resolve) => {
      releasePendingRoute = resolve;
    });
    await page.route("**/api/status", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.abort("connectionfailed");
        return;
      }
      retryRequestedAt = Date.now();
      pendingRetryRoute = route;
      releasePendingRoute();
    });
    try {
      await page.goto(baseUrl.href);
      await page.getByRole("alert").waitFor();
      await page.getByRole("button", { name: "重试" }).click();
      await page
        .getByRole("status")
        .filter({ hasText: /^正在获取状态$/ })
        .waitFor();
      await Promise.race([
        pendingRoute,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("重试请求未在 3 秒内触发")), 3_000),
        ),
      ]);
      assert(pendingRetryRoute !== undefined, "重试未触发新的 GET /api/status");
      await pendingRetryRoute.continue();
      await page.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
      const retryMs = Date.now() - retryRequestedAt;
      assert(retryMs <= 3_000, `人工恢复耗时 ${retryMs}ms，超过 3000ms`);
      assert(requestCount === 2, `失败恢复总请求数为 ${requestCount}，预期 2`);
      metrics.recovery = { statusMs: retryMs };
      return `首次请求网络失败；一次点击触发一次新 GET /api/status；先显示处理中，${retryMs}ms 后原页显示“ok”；时间=${now()}`;
    } finally {
      if (pendingRetryRoute) {
        await pendingRetryRoute.abort().catch(() => undefined);
      }
      await context.close();
    }
  });

  await runScenario("IQA-005", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    const durations = [];
    let requestStartedAt;
    await page.route("**/api/status", async (route) => {
      requestCount += 1;
      requestStartedAt = Date.now();
      if (requestCount <= 2) {
        await route.abort("connectionfailed");
      } else {
        await route.continue();
      }
    });
    try {
      await page.goto(baseUrl.href);
      await page.getByRole("alert").waitFor();
      durations.push(Date.now() - requestStartedAt);
      await page.getByRole("button", { name: "重试" }).click();
      await page.getByRole("alert").waitFor();
      durations.push(Date.now() - requestStartedAt);
      assert(
        (await page.getByRole("button", { name: "重试" }).count()) === 1,
        "连续失败后重试按钮不是唯一",
      );
      await page.waitForTimeout(200);
      assert(requestCount === 2, "连续失败后发生自动重试");
      await page.getByRole("button", { name: "重试" }).click();
      await page.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
      durations.push(Date.now() - requestStartedAt);
      assert(requestCount === 3, `连续恢复总请求数为 ${requestCount}，预期 3`);
      assert(durations.every((value) => value <= 3_000), `存在超过 3000ms 的状态转换：${durations.join(",")}ms`);
      assert((await page.getByRole("link").count()) === 0, "页面出现额外导航");
      metrics.consecutive = { statusMs: durations };
      return `两次用户点击分别触发新请求；前两次网络失败后仍为单一失败/重试；第三次请求恢复“ok”；耗时=${durations.join("/")}ms；无自动请求和导航；时间=${now()}`;
    } finally {
      await context.close();
    }
  });

  await runScenario("IQA-006", async () => {
    const { context, page } = await newPage();
    let requestCount = 0;
    await page.route("**/api/status", async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.abort("connectionfailed");
      } else {
        await route.continue();
      }
    });
    try {
      await page.goto(baseUrl.href);
      await page.getByRole("alert").waitFor();
      const failureText = (await page.locator("body").innerText())
        .split(/\s+/)
        .filter(Boolean)
        .join("|");
      assert(
        failureText === "最小流程验证|状态获取失败，请重试|重试",
        `失败页面出现范围外内容：${failureText}`,
      );
      assert((await page.locator("input, textarea, select, form, a").count()) === 0, "页面出现登录、输入、表单或导航控件");
      await page.getByRole("button", { name: "重试" }).click();
      await page.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
      const successText = (await page.locator("body").innerText())
        .split(/\s+/)
        .filter(Boolean)
        .join("|");
      assert(successText === "最小流程验证|ok", `成功页面出现范围外内容：${successText}`);
      assert((await page.getByRole("button").count()) === 0, "成功页面存在业务操作");
      return `失败页面内容=${failureText}；成功页面内容=${successText}；无登录、输入、表单、导航、写入、敏感值或技术错误；时间=${now()}`;
    } finally {
      await context.close();
    }
  });

  await runScenario("IQA-007", async () => {
    const { context, page } = await newPage();
    let fail = true;
    await page.route("**/api/status", async (route) => {
      if (fail) {
        await route.abort("connectionfailed");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.continue();
      }
    });
    try {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(baseUrl.href);
      await page.getByRole("alert").waitFor();
      const failureAxe = await new AxeBuilder({ page }).analyze();
      assert(failureAxe.violations.length === 0, `失败视图 axe violations=${failureAxe.violations.length}`);
      await page.keyboard.press("Tab");
      const retry = page.getByRole("button", { name: "重试" });
      await retry.waitFor();
      assert(await retry.evaluate((element) => element.matches(":focus-visible")), "重试按钮焦点不可见");
      const outline = await retry.evaluate((element) => getComputedStyle(element).outlineStyle);
      assert(outline !== "none", "焦点 computed style 无 outline");
      fail = false;
      await page.keyboard.press("Enter");
      await page.getByRole("status").filter({ hasText: /^正在获取状态$/ }).waitFor();
      await page.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
      const successAxe = await new AxeBuilder({ page }).analyze();
      assert(successAxe.violations.length === 0, `成功视图 axe violations=${successAxe.violations.length}`);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "200%";
      });
      const narrowOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert(narrowOverflow <= 1, `320px/200% 出现 ${narrowOverflow}px 横向溢出`);
      await page.setViewportSize({ width: 1_440, height: 900 });
      const wideOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert(wideOverflow <= 1, `1440px/200% 出现 ${wideOverflow}px 横向溢出`);
      assert(
        (await page.getByRole("heading", { level: 1, name: "最小流程验证" }).count()) === 1 &&
          (await page.getByRole("status").count()) === 1,
        "缩放后标题或状态语义丢失",
      );
      throw new TestGap(
        `自动化检查通过（axe failure/success=0/0、键盘重试、焦点 outline=${outline}、320/1440px@200% overflow=${narrowOverflow}/${wideOverflow}px、live/alert 语义存在），但 QA Runner 未提供规格要求的人工辅助技术观察证据，不能声明完整 WCAG 2.2 AA`,
      );
    } finally {
      await context.close();
    }
  });

  await runScenario("IQA-008", async () => {
    for (const id of ["IQA-001", "IQA-002", "IQA-003", "IQA-004", "IQA-005"]) {
      assert(scenarios.find((item) => item.id === id).passed, `${id} 未通过，无法形成 3/3 质量结论`);
    }
    assert(metrics.pageReadyMs <= 2_000, `页面主体耗时 ${metrics.pageReadyMs}ms`);
    const statusDurations = [
      metrics.success.statusMs,
      metrics.failure.statusMs,
      metrics.recovery.statusMs,
      ...metrics.consecutive.statusMs,
    ];
    assert(statusDurations.every((value) => value <= 3_000), `状态计时超限：${statusDurations.join(",")}ms`);
    return `同一 Candidate 的成功、失败、恢复 3/3 通过；页面主体=${metrics.pageReadyMs}ms（<=2000ms）；状态耗时=${statusDurations.join("/")}ms（均<=3000ms）；时间=${now()}`;
  });
} catch (error) {
  environmentFailure = concise(error);
  defects.length = 0;
  testGaps.length = 0;
  for (const scenario of scenarios) {
    scenario.passed = false;
    scenario.evidence = `环境前置失败，未执行：${environmentFailure}`;
  }
  evidence.push(`环境失败：${environmentFailure}；时间=${now()}`);
} finally {
  await browser?.close().catch(() => undefined);
}

const allScenariosPassed = scenarios.every((scenario) => scenario.passed);
const passed =
  !environmentFailure &&
  allScenariosPassed &&
  defects.length === 0 &&
  testGaps.length === 0;
const summary = environmentFailure
  ? "Independent QA 因环境前置失败未执行功能验收。"
  : passed
    ? "Independent QA 的八个批准场景全部通过。"
    : `Independent QA 未通过：${defects.length} 个产品缺陷，${testGaps.length} 个测试缺口，${scenarios.filter((scenario) => !scenario.passed).length} 个场景未通过。`;

const result = {
  passed,
  testedCommitSha: env.QA_CANDIDATE_SHA ?? "",
  environmentUrl: env.QA_BASE_URL ?? "",
  summary,
  qaPlanCommitSha: env.QA_PLAN_COMMIT_SHA ?? "",
  qaPlanHash: env.QA_PLAN_HASH ?? "",
  defects,
  testGaps,
  evidence,
  bugfixResults: [],
  scenarios,
};

await writeFile(env.QA_RESULT_PATH, `${JSON.stringify(result)}\n`, "utf8");
EOF
