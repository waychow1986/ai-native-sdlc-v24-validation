// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";

describe("failed status recovery journey", () => {
  afterEach(cleanup);

  it("shows one safe, perceivable failure and retries only on keyboard activation", async () => {
    let resolveRetry!: (status: "ok") => void;
    const retryResult = new Promise<"ok">((resolve) => {
      resolveRetry = resolve;
    });
    const requestStatus = vi
      .fn<() => Promise<"ok">>()
      .mockRejectedValueOnce(new Error("secret internal host"))
      .mockReturnValueOnce(retryResult);
    const user = userEvent.setup();
    const { container } = render(<App requestStatus={requestStatus} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("状态获取失败，请重试");
    expect(container.textContent).not.toContain("secret internal host");
    expect(screen.getAllByRole("button", { name: "重试" })).toHaveLength(1);
    expect(requestStatus).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestStatus).toHaveBeenCalledTimes(1);

    await user.tab();
    const retry = screen.getByRole("button", { name: "重试" });
    expect(document.activeElement).toBe(retry);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status").textContent).toBe("正在获取状态");
    expect(screen.queryByRole("button")).toBeNull();
    resolveRetry("ok");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("ok"),
    );
    expect(requestStatus).toHaveBeenCalledTimes(2);
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it("keeps a single retry action after consecutive failures", async () => {
    const requestStatus = vi.fn(async () => {
      throw new Error("private diagnostic");
    });
    const user = userEvent.setup();
    const { container } = render(<App requestStatus={requestStatus} />);

    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(requestStatus).toHaveBeenCalledTimes(2));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "重试" })).toHaveLength(1);
    expect(container.textContent).not.toContain("private diagnostic");
    expect(screen.queryByText("ok", { exact: true })).toBeNull();
  });

  it("keeps failure meaning and retry available without color cues", async () => {
    const requestStatus = vi.fn(async () => {
      throw new Error("unavailable");
    });
    render(<App requestStatus={requestStatus} />);

    const alert = await screen.findByRole("alert");
    const retry = screen.getByRole("button", { name: "重试" });
    const region = alert.closest("section");

    expect(alert.textContent).toBe("状态获取失败，请重试");
    expect(region).not.toBeNull();
    expect(region?.contains(retry)).toBe(true);
    expect(retry.getAttribute("type")).toBe("button");
  });
});
