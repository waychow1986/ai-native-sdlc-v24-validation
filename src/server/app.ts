import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import Fastify, { type FastifyInstance } from "fastify";

import { registerHealthRoutes } from "./routes/health.js";

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

const LOG_LEVELS = new Set(["error", "warn", "info"]);

export interface ServerConfig {
  port: number;
  logLevel: "error" | "warn" | "info";
  trustProxy: false | number;
}

interface AppOptions {
  staticRoot: string;
}

const DEFAULT_APP_OPTIONS: AppOptions = {
  staticRoot: resolve(process.cwd(), "dist/client"),
};

function invalidConfiguration(): Error {
  return new Error("Invalid server configuration");
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw invalidConfiguration();
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw invalidConfiguration();
  }
  return port;
}

function parseLogLevel(value: string | undefined): ServerConfig["logLevel"] {
  const level = value ?? "info";
  if (!LOG_LEVELS.has(level)) {
    throw invalidConfiguration();
  }
  return level as ServerConfig["logLevel"];
}

function parseTrustProxy(
  value: string | undefined,
): ServerConfig["trustProxy"] {
  if (value === undefined || value === "false") {
    return false;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw invalidConfiguration();
  }
  const hops = Number(value);
  if (!Number.isSafeInteger(hops)) {
    throw invalidConfiguration();
  }
  return hops;
}

export function parseServerConfig(
  env: Readonly<Record<string, string | undefined>>,
): ServerConfig {
  return {
    port: parsePort(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function serializeRequest(value: unknown): {
  requestId?: string;
  method?: string;
  route: string;
} {
  const request = record(value);
  const routeOptions = record(request.routeOptions);
  return {
    ...(typeof request.id === "string" ? { requestId: request.id } : {}),
    ...(typeof request.method === "string" ? { method: request.method } : {}),
    route:
      typeof routeOptions.url === "string" ? routeOptions.url : "unmatched",
  };
}

export function serializeResponse(value: unknown): { status?: number } {
  const response = record(value);
  return {
    ...(typeof response.statusCode === "number"
      ? { status: response.statusCode }
      : {}),
  };
}

export function serializeError(value: unknown): { error: string } {
  void value;
  return { error: "internal_error" };
}

export function buildApp(
  config: ServerConfig = parseServerConfig(process.env),
  options: AppOptions = DEFAULT_APP_OPTIONS,
): FastifyInstance {
  let trustProxy: false | ((address: string, hop: number) => boolean) = false;
  if (config.trustProxy !== false) {
    const trustedHops = config.trustProxy;
    trustProxy = (_address: string, hop: number): boolean => hop < trustedHops;
  }
  const app = Fastify({
    bodyLimit: 16 * 1024,
    trustProxy,
    logger: {
      base: undefined,
      level: config.logLevel,
      serializers: {
        req: serializeRequest,
        res: serializeResponse,
      },
    },
  });

  app.addHook("onSend", async (_request, reply) => {
    void reply
      .header("Content-Security-Policy", CONTENT_SECURITY_POLICY)
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url === "/api" || request.url.startsWith("/api/")) {
      await reply.code(404).send({ error: "not_found" });
      return;
    }
    await reply.code(404).type("text/plain").send("Not Found");
  });

  app.setErrorHandler(async (error, _request, reply) => {
    if (record(error).code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      await reply.code(413).send({ error: "payload_too_large" });
      return;
    }
    app.log.error({ error: "internal_error" }, "request_failed");
    await reply.code(500).send({ error: "internal_error" });
  });

  app.get("/", async (_request, reply) => {
    try {
      const page = await readFile(resolve(options.staticRoot, "index.html"));
      await reply.type("text/html; charset=utf-8").send(page);
    } catch {
      await reply.code(404).type("text/plain").send("Not Found");
    }
  });

  app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
    const fileName = request.params["*"];
    if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
      await reply.code(404).type("text/plain").send("Not Found");
      return;
    }

    try {
      const asset = await readFile(
        resolve(options.staticRoot, "assets", fileName),
      );
      const contentType =
        extname(fileName) === ".css"
          ? "text/css; charset=utf-8"
          : "text/javascript; charset=utf-8";
      await reply.type(contentType).send(asset);
    } catch {
      await reply.code(404).type("text/plain").send("Not Found");
    }
  });

  void app.register(registerHealthRoutes);

  return app;
}
