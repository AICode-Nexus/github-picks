import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyCommandButton } from "../src/components/copy-command-button";

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  "execCommand",
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

function setClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function setExecCommand(execCommand: () => boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
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
    setExecCommand(vi.fn(() => false));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
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
    setExecCommand(vi.fn(() => false));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));
    await waitFor(() => expect(screen.getByText("重试")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() => expect(screen.getByText("已复制")).toBeTruthy());
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});
