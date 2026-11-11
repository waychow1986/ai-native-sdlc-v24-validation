// @vitest-environment jsdom

import { createElement } from "react";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";
import { buildApp } from "../../src/server/app.js";

describe("status recovery integration", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("recovers through the page button after blocked and repeated failed requests", async () => {
    const app = buildApp();
    let serverRequestCount = 0;
    app.addHook("onRequest", async (request) => {
      if (request.url === "/api/status") {
        serverRequestCount += 1;
      }
    });
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    const browserFetch = globalThis.fetch;
    let blockedRequests = 2;
    let rejectSecondBlocked!: (reason: Error) => void;
    const attempts: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        attempts.push(path);
        if (blockedRequests > 0) {
          blockedRequests -= 1;
          if (blockedRequests === 0) {
            return new Promise<Response>((_resolve, reject) => {
              rejectSecondBlocked = reject;
            });
          }
          return Promise.reject(new TypeError("blocked by browser network"));
        }
        return browserFetch(new URL(path, origin), init);
      }),
    );

    render(createElement(App));
    const user = userEvent.setup();
    try {
      await screen.findByRole("alert");
      expect(attempts).toEqual(["/api/status"]);
      expect(serverRequestCount).toBe(0);

      await user.click(screen.getByRole("button", { name: "重试" }));
      expect(screen.getByRole("status").textContent).toBe("正在获取状态");
      rejectSecondBlocked(new TypeError("blocked by browser network"));
      await screen.findByRole("alert");
      expect(attempts).toEqual(["/api/status", "/api/status"]);

      await user.click(screen.getByRole("button", { name: "重试" }));
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe("ok"),
      );
      expect(attempts).toEqual(["/api/status", "/api/status", "/api/status"]);
      expect(serverRequestCount).toBe(1);
    } finally {
      await app.close();
    }
  });
});
