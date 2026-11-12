import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";

describe("status API contract", () => {
  const apps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map(async (app) => app.close()));
  });

  it("returns the exact non-cacheable success representation", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/status" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toBe('{"status":"ok"}');
    expect(Object.keys(response.json())).toEqual(["status"]);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects %s with a stable method error",
    async (method) => {
      const app = buildApp();
      apps.push(app);

      const response = await app.inject({ method, url: "/api/status" });

      expect(response.statusCode).toBe(405);
      expect(response.headers.allow).toBe("GET");
      expect(response.json()).toEqual({ error: "method_not_allowed" });
    },
  );

  it("rejects a request body without exposing its contents", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/status",
      headers: { "content-type": "application/json" },
      payload: { secret: "must-not-appear" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_request" });
    expect(response.body).not.toContain("must-not-appear");
  });

  it("keeps unknown API errors stable and non-sensitive", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/unknown?secret=must-not-appear",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
    expect(response.body).not.toContain("must-not-appear");
  });

  it("maps unexpected status failures to the stable product error", async () => {
    const app = buildApp();
    apps.push(app);
    app.addHook("preHandler", async (request) => {
      if (request.url === "/api/status") {
        throw new Error("secret internal detail");
      }
    });

    const response = await app.inject({ method: "GET", url: "/api/status" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "status_unavailable" });
    expect(response.body).not.toContain("secret internal detail");
  });
});
