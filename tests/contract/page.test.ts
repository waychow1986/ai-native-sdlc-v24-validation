import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";

describe("page contract", () => {
  const apps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map(async (app) => app.close()));
  });

  it("serves the only application page with one mount point and strict CSP", async () => {
    const staticRoot = await mkdtemp(join(tmpdir(), "status-page-"));
    await mkdir(join(staticRoot, "assets"));
    await writeFile(
      join(staticRoot, "index.html"),
      '<!doctype html><html lang="zh-CN"><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
    );
    await writeFile(join(staticRoot, "assets", "app.js"), "export {};");
    const app = buildApp(undefined, { staticRoot });
    apps.push(app);

    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toMatch(/^text\/html/);
    expect(page.headers["content-security-policy"]).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    expect(page.body.match(/id="root"/g)).toHaveLength(1);
    expect(page.body).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(page.body).not.toMatch(/<style|style=/);

    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["content-type"]).toMatch(/^text\/javascript/);

    for (const path of ["/missing", "/login", "/admin", "/status"]) {
      const missing = await app.inject({ method: "GET", url: path });
      expect(missing.statusCode).toBe(404);
      expect(missing.headers["content-type"]).toMatch(/^text\/plain/);
    }
  });
});
