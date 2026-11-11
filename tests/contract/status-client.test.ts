import { afterEach, describe, expect, it, vi } from "vitest";

import { requestStatus } from "../../src/client/status-client.js";

const jsonHeaders = { "content-type": "application/json" };

describe("status client failure contract", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [
      "network failure",
      vi.fn(async () => Promise.reject(new TypeError("secret network detail"))),
    ],
    [
      "non-200 response",
      vi.fn(
        async () =>
          new Response('{"status":"ok"}', {
            status: 503,
            headers: jsonHeaders,
          }),
      ),
    ],
    [
      "wrong media type",
      vi.fn(
        async () =>
          new Response('{"status":"ok"}', {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      ),
    ],
    [
      "invalid JSON",
      vi.fn(
        async () =>
          new Response("not-json", { status: 200, headers: jsonHeaders }),
      ),
    ],
    [
      "schema mismatch",
      vi.fn(
        async () =>
          new Response('{"status":"failed"}', {
            status: 200,
            headers: jsonHeaders,
          }),
      ),
    ],
  ])(
    "normalizes %s without exposing its cause",
    async (_name, fetchImplementation) => {
      await expect(
        requestStatus(new AbortController().signal, fetchImplementation),
      ).rejects.toThrow(/^status_request_failed$/);
    },
  );

  it("normalizes timeout after 2500 ms", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out internally", "AbortError")),
          );
        }),
    );
    const result = requestStatus(
      new AbortController().signal,
      fetchImplementation,
    );
    const rejection = expect(result).rejects.toThrow(/^status_request_failed$/);

    await vi.advanceTimersByTimeAsync(2_500);

    await rejection;
  });

  it("normalizes caller abort without exposing its cause", async () => {
    const controller = new AbortController();
    const fetchImplementation = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("caller detail", "AbortError")),
          );
        }),
    );
    const result = requestStatus(controller.signal, fetchImplementation);

    controller.abort();

    await expect(result).rejects.toThrow(/^status_request_failed$/);
  });
});
