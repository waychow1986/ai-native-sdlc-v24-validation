import { pathToFileURL } from "node:url";

import type { FastifyInstance } from "fastify";

import { buildApp, parseServerConfig, type ServerConfig } from "./app.js";

interface SignalSource {
  on(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  off(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}

interface CloseableServer {
  close(): Promise<void>;
}

interface StartableServer extends CloseableServer {
  listen(options: { host: string; port: number }): Promise<string>;
}

interface StartupDependencies {
  createApp(config: ServerConfig): StartableServer;
  signals: SignalSource;
  writeError(event: "configuration_rejected" | "startup_failed"): void;
}

const defaultDependencies: StartupDependencies = {
  createApp: buildApp,
  signals: process,
  writeError: (event) => {
    process.stderr.write(`${JSON.stringify({ event })}\n`);
  },
};

export function installGracefulShutdown(
  app: CloseableServer,
  signals: SignalSource,
): void {
  let shuttingDown = false;

  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    signals.off("SIGTERM", shutdown);
    signals.off("SIGINT", shutdown);
    void app.close().catch(() => undefined);
  };

  signals.on("SIGTERM", shutdown);
  signals.on("SIGINT", shutdown);
}

export async function startFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  dependencies: StartupDependencies = defaultDependencies,
): Promise<number> {
  let config: ServerConfig;
  try {
    config = parseServerConfig(env);
  } catch {
    dependencies.writeError("configuration_rejected");
    return 1;
  }

  let app: StartableServer | undefined;
  try {
    app = dependencies.createApp(config);
    await app.listen({ host: "0.0.0.0", port: config.port });
    installGracefulShutdown(app, dependencies.signals);
    return 0;
  } catch {
    dependencies.writeError("startup_failed");
    await app?.close().catch(() => undefined);
    return 1;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  void startFromEnvironment(process.env).then((status) => {
    if (status !== 0) {
      process.exitCode = status;
    }
  });
}

export type { FastifyInstance };
