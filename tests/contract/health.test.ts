import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health endpoints", () => {
  it.each(["/health/live", "/health/ready"])(
    "returns an empty 204 response from GET %s",
    async (url) => {
      const app = buildApp();
      apps.push(app);

      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(response.headers["content-type"]).toBeUndefined();
      expect(response.headers).not.toHaveProperty("x-powered-by");
    },
  );

  it("keeps health routes separate from the product API", async () => {
    const app = buildApp();
    apps.push(app);

    const productNamespace = await app.inject({
      method: "GET",
      url: "/api/health/ready",
    });

    expect(productNamespace.statusCode).toBe(404);
    expect(productNamespace.json()).toEqual({ error: "not_found" });
  });
});
