// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

  it("moves only the current generation into failure", () => {
    const loading = statusReducer(initialStatusState, {
      type: "begin",
      generation: 2,
    });
    const failure = statusReducer(loading, {
      type: "fail",
      generation: 2,
    });

    expect(failure).toEqual({ kind: "failure", generation: 2 });
    expect(statusReducer(failure, { type: "fail", generation: 1 })).toBe(
      failure,
    );
  });

  it("increments generation and starts one request for each manual retry", async () => {
    let rejectSecond!: (reason: Error) => void;
    const second = new Promise<"ok">((_resolve, reject) => {
      rejectSecond = reject;
    });
    const requestStatus = vi
      .fn<() => Promise<"ok">>()
      .mockRejectedValueOnce(new Error("first"))
      .mockReturnValueOnce(second)
      .mockResolvedValueOnce("ok");
    render(<App requestStatus={requestStatus} />);

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByRole("status").textContent).toBe("正在获取状态");
    expect(screen.queryByRole("button")).toBeNull();
    rejectSecond(new Error("second"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("ok"),
    );
    expect(requestStatus).toHaveBeenCalledTimes(3);
  });

  it("discards a late result from an older generation", async () => {
    let resolveFirst!: (status: "ok") => void;
    const first = new Promise<"ok">((resolve) => {
      resolveFirst = resolve;
    });
    const requestStatus = vi
      .fn<() => Promise<"ok">>()
      .mockReturnValueOnce(first)
      .mockRejectedValueOnce(new Error("current failure"));
    const current = statusReducer(initialStatusState, {
      type: "begin",
      generation: 2,
    });
    const failed = statusReducer(current, { type: "fail", generation: 2 });

    resolveFirst("ok");
    await first;

    expect(
      statusReducer(failed, {
        type: "succeed",
        generation: 1,
        status: "ok",
      }),
    ).toBe(failed);
    expect(requestStatus).not.toHaveBeenCalled();
  });
});
