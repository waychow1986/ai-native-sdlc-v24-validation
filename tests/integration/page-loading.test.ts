// @vitest-environment jsdom

import { createElement } from "react";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";
import { buildApp } from "../../src/server/app.js";

describe("page loading integration", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("makes one same-origin status request and remains loading while it is pending", async () => {
    const app = buildApp();
    app.get("/api/status", async (_request, reply) => {
      await new Promise(() => undefined);
      return reply.send();
    });
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    const browserFetch = globalThis.fetch;
    const requests: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        requests.push(path);
        return browserFetch(new URL(path, origin), init);
      }),
    );

    const view = render(createElement(App));
    try {
      await waitFor(() => expect(requests).toEqual(["/api/status"]));
      expect(screen.getByRole("status").textContent).toBe("正在获取状态");
      expect(screen.queryByText("ok")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      view.unmount();
      await app.close();
    }
  });
});
