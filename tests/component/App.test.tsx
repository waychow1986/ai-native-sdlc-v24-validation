// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  App,
  initialStatusState,
  statusReducer,
} from "../../src/client/App.js";
import { requestStatus } from "../../src/client/status-client.js";

describe("App loading lifecycle", () => {
  afterEach(cleanup);

  it("renders one current loading state and starts only generation one", () => {
    const requestStatus = vi.fn(() => new Promise<"ok">(() => undefined));
    const { rerender } = render(<App requestStatus={requestStatus} />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("正在获取状态");
    expect(requestStatus).toHaveBeenCalledTimes(1);
    rerender(<App requestStatus={requestStatus} />);
    expect(requestStatus).toHaveBeenCalledTimes(1);
  });

  it("aborts the active request on unmount", () => {
    let capturedSignal: AbortSignal | undefined;
    const requestStatus = vi.fn((signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<"ok">(() => undefined);
    });
    const view = render(<App requestStatus={requestStatus} />);

    expect(capturedSignal?.aborted).toBe(false);
    view.unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("ignores an older generation and keeps one current generation", () => {
    const current = statusReducer(initialStatusState, {
      type: "begin",
      generation: 2,
    });
    expect(current).toEqual({ kind: "loading", generation: 2 });
    expect(statusReducer(current, { type: "begin", generation: 1 })).toBe(
      current,
    );
  });

  it("accepts success only for the current generation", () => {
    const success = statusReducer(initialStatusState, {
      type: "succeed",
      generation: 1,
      status: "ok",
    });
    expect(success).toEqual({ kind: "success", generation: 1, status: "ok" });
    expect(
      statusReducer(success, {
        type: "succeed",
        generation: 0,
        status: "ok",
      }),
    ).toBe(success);
  });

  it.each([
    new Response('{"status":"ok"}', {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
    new Response('{"status":"ok"}', {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
    new Response("not-json", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response('{"status":"OK"}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response('{"status":"ok","extra":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ])("rejects a non-contract response", async (response) => {
    const fetch = vi.fn(async () => response);

    await expect(
      requestStatus(new AbortController().signal, fetch),
    ).rejects.toThrow("status_request_failed");
  });

  it("accepts the exact response schema", async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"status":"ok"}', {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
    );

    await expect(
      requestStatus(new AbortController().signal, fetch),
    ).resolves.toBe("ok");
  });
});
