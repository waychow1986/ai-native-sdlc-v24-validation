// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";

describe("successful status journey", () => {
  afterEach(cleanup);

  it("replaces loading with the sole approved value without retry or refresh", async () => {
    const requestStatus = vi.fn(async () => "ok" as const);

    render(<App requestStatus={requestStatus} />);

    expect(screen.getByRole("status").textContent).toBe("正在获取状态");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("ok"),
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("OK")).toBeNull();
    expect(requestStatus).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestStatus).toHaveBeenCalledTimes(1);
  });
});
