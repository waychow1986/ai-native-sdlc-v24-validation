import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildApp,
  parseServerConfig,
  serializeError,
  serializeRequest,
  serializeResponse,
} from "../../src/server/app.js";
import {
  installGracefulShutdown,
  startFromEnvironment,
} from "../../src/server/index.js";

describe("server foundation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses only the approved configuration values", () => {
    expect(parseServerConfig({})).toEqual({
      port: 3000,
      logLevel: "info",
      trustProxy: false,
    });
    expect(
      parseServerConfig({
        PORT: "65535",
        LOG_LEVEL: "warn",
        TRUST_PROXY: "2",
      }),
    ).toEqual({ port: 65535, logLevel: "warn", trustProxy: 2 });

    for (const env of [
      { PORT: "0" },
      { PORT: "65536" },
      { PORT: "3000.5" },
      { PORT: " 3000" },
      { LOG_LEVEL: "debug" },
      { TRUST_PROXY: "true" },
      { TRUST_PROXY: "0" },
      { TRUST_PROXY: "-1" },
    ]) {
      expect(() => parseServerConfig(env)).toThrow(
        "Invalid server configuration",
      );
    }
  });

  it("serializes logs through an approved field whitelist", () => {
    expect(
      serializeRequest({
        id: "request-1",
        method: "GET",
        routeOptions: { url: "/health/live" },
        headers: { authorization: "secret" },
        ip: "192.0.2.1",
        query: { token: "secret" },
      }),
    ).toEqual({
      requestId: "request-1",
      method: "GET",
      route: "/health/live",
    });
    expect(
      serializeResponse({
        statusCode: 204,
        headers: { "set-cookie": "secret" },
      }),
    ).toEqual({ status: 204 });
    expect(serializeError(new Error("secret internal detail"))).toEqual({
      error: "internal_error",
    });
  });

  it("sets the body limit and security headers", async () => {
    const app = buildApp();
    app.post("/test-body-limit", async () => ({ accepted: true }));

    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.headers).toMatchObject({
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
    });

    const oversized = await app.inject({
      method: "POST",
      url: "/test-body-limit",
      headers: { "content-type": "text/plain" },
      payload: "x".repeat(16 * 1024 + 1),
    });
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toEqual({ error: "payload_too_large" });
    await app.close();
  });

  it("returns stable API errors without internal details", async () => {
    const app = buildApp();
    app.get("/api/failure", async () => {
      throw new Error("secret internal detail");
    });

    const missing = await app.inject({ method: "GET", url: "/api/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "not_found" });

    const failed = await app.inject({ method: "GET", url: "/api/failure" });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({ error: "internal_error" });
    expect(failed.body).not.toContain("secret internal detail");
    await app.close();
  });

  it("closes once and removes handlers during graceful shutdown", async () => {
    const signals = new EventEmitter();
    const close = vi.fn(async () => undefined);
    installGracefulShutdown({ close }, signals);

    signals.emit("SIGTERM");
    signals.emit("SIGINT");
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(signals.listenerCount("SIGTERM")).toBe(0);
    expect(signals.listenerCount("SIGINT")).toBe(0);
  });

  it("returns a non-zero startup result for invalid configuration", async () => {
    const createApp = vi.fn();
    const writeError = vi.fn();

    await expect(
      startFromEnvironment(
        { PORT: "not-a-port" },
        { createApp, signals: new EventEmitter(), writeError },
      ),
    ).resolves.toBe(1);
    expect(createApp).not.toHaveBeenCalled();
    expect(writeError).toHaveBeenCalledWith("configuration_rejected");
  });
});
