// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";
import { buildApp } from "../../src/server/app.js";

describe("status success integration", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses browser fetch against a real server and renders only exact success", async () => {
    const app = buildApp();
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

    render(<App />);
    try {
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe("ok"),
      );
      expect(requests).toEqual(["/api/status"]);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      await app.close();
    }
  });
});
