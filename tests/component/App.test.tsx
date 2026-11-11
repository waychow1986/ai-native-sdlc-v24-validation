// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  App,
  initialStatusState,
  statusReducer,
} from "../../src/client/App.js";

describe("App loading lifecycle", () => {
  afterEach(cleanup);

  it("renders one current loading state and starts only generation one", () => {
    const requestStatus = vi.fn(() => new Promise<void>(() => undefined));
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
      return new Promise<void>(() => undefined);
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
    expect(
      statusReducer(current, { type: "begin", generation: 1 }),
    ).toBe(current);
  });
});
