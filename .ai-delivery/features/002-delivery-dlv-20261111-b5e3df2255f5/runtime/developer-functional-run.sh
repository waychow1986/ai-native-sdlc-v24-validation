#!/usr/bin/env bash
set -euo pipefail

: "${AIDELIVERY_DELIVERY_ID:?AIDELIVERY_DELIVERY_ID is required}"
: "${AIDELIVERY_CANDIDATE_SHA:?AIDELIVERY_CANDIDATE_SHA is required}"
: "${DEV_FUNCTIONAL_BASE_URL:?DEV_FUNCTIONAL_BASE_URL is required}"
: "${DEV_FUNCTIONAL_RESULT_PATH:?DEV_FUNCTIONAL_RESULT_PATH is required}"

export AIDELIVERY_DELIVERY_ID
export AIDELIVERY_CANDIDATE_SHA
export DEV_FUNCTIONAL_BASE_URL
export DEV_FUNCTIONAL_RESULT_PATH

node --input-type=module <<'EOF'
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const {
  AIDELIVERY_DELIVERY_ID: deliveryId,
  AIDELIVERY_CANDIDATE_SHA: candidateSha,
  DEV_FUNCTIONAL_BASE_URL: baseUrlValue,
  DEV_FUNCTIONAL_RESULT_PATH: resultPath,
} = process.env;

const baseUrl = new URL(baseUrlValue);
if (!["http:", "https:"].includes(baseUrl.protocol)) {
  throw new Error("DEV_FUNCTIONAL_BASE_URL must use HTTP or HTTPS");
}

const scenarios = [];
const evidence = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });

  const identityResponse = await fetch(
    new URL("/candidate-identity", baseUrl),
    { headers: { Accept: "application/json" } },
  );
  const identity = await identityResponse.json();
  if (
    identityResponse.status !== 200 ||
    identity.deliveryId !== deliveryId ||
    identity.candidateSha !== candidateSha
  ) {
    throw new Error("Candidate identity does not match platform inputs");
  }

  const successPage = await browser.newPage();
  await successPage.goto(baseUrl.href);
  await successPage
    .getByRole("heading", { level: 1, name: "最小流程验证" })
    .waitFor();
  await successPage.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
  scenarios.push({
    id: "status-success",
    passed: true,
    externalServices: [],
    evidence: "真实浏览器显示规定标题，唯一状态区域显示 ok。",
  });
  evidence.push("Candidate identity 与平台输入一致；成功旅程通过。");
  await successPage.close();

  const recoveryPage = await browser.newPage();
  let statusRequests = 0;
  await recoveryPage.route("**/api/status", async (route) => {
    statusRequests += 1;
    if (statusRequests === 1) {
      await route.abort("connectionfailed");
      return;
    }
    await route.continue();
  });
  await recoveryPage.goto(baseUrl.href);
  await recoveryPage
    .getByRole("alert")
    .filter({ hasText: "状态获取失败，请重试" })
    .waitFor();
  await recoveryPage.getByRole("button", { name: "重试" }).click();
  await recoveryPage.getByRole("status").filter({ hasText: /^ok$/ }).waitFor();
  if (statusRequests !== 2) {
    throw new Error("Recovery journey did not issue exactly two requests");
  }
  scenarios.push({
    id: "status-manual-recovery",
    passed: true,
    externalServices: [],
    evidence: "真实浏览器网络失败后显示明确提示，人工重试恢复为 ok。",
  });
  evidence.push("失败与人工恢复旅程通过，未使用外部服务。");

  await writeFile(
    resultPath,
    `${JSON.stringify({ passed: true, scenarios, evidence })}\n`,
    "utf8",
  );
} catch (error) {
  await writeFile(
    resultPath,
    `${JSON.stringify({
      passed: false,
      scenarios,
      evidence: [...evidence, "Developer functional validation failed."],
    })}\n`,
    "utf8",
  );
  throw error;
} finally {
  await browser?.close();
}
EOF
