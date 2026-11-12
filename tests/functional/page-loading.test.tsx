// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../../src/client/App.js";

describe("minimal status page", () => {
  afterEach(cleanup);

  it("shows only the approved title and perceivable loading region", async () => {
    const { container } = render(
      <App requestStatus={() => new Promise<"ok">(() => undefined)} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "最小流程验证" }),
    ).not.toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("正在获取状态");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(container.querySelectorAll("main")).toHaveLength(1);

    const result = await axe.run(container);
    expect(result.violations).toEqual([]);
  });

  it("keeps the approved title and textual status in one semantic region", () => {
    const { container } = render(
      <App requestStatus={() => new Promise<"ok">(() => undefined)} />,
    );

    const main = screen.getByRole("main");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "最小流程验证",
    });
    const status = screen.getByRole("status");

    expect(main.contains(heading)).toBe(true);
    expect(main.contains(status)).toBe(true);
    expect(status.textContent).toBe("正在获取状态");
    expect(container.querySelectorAll("section")).toHaveLength(1);
  });
});
