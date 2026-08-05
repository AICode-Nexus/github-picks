import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyCommandButton } from "../src/components/copy-command-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("CopyCommandButton", () => {
  it("copies the exact value and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("install exact"),
    );
    expect(screen.getByText("已复制")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("已复制到剪贴板");
  });

  it("offers retry when clipboard access fails", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() => expect(screen.getByText("重试")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toContain(
      "复制失败，请手动选择命令",
    );
  });

  it("can succeed on a retry after a transient failure", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));
    await waitFor(() => expect(screen.getByText("重试")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() => expect(screen.getByText("已复制")).toBeTruthy());
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});
