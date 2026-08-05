import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyRankingButton } from "../src/components/copy-ranking-button";

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  "execCommand",
);

function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function setExecCommand(execCommand: ReturnType<typeof vi.fn>) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe("CopyRankingButton", () => {
  it("copies the ranking body plus current URL and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));

    expect(await screen.findByRole("button", { name: "已复制" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(
      `榜单正文\n\n完整榜单：\n${window.location.href}`,
    );
    expect(screen.getByText("榜单内容已复制到剪贴板")).toBeTruthy();
  });

  it("falls back to a temporary textarea and restores focus and selection", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    setExecCommand(vi.fn(() => true));
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    const previous = document.createElement("button");
    const selectedText = document.createElement("span");
    selectedText.textContent = "保留选择";
    document.body.append(previous, selectedText);
    previous.focus();
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(selectedText);
    selection?.removeAllRanges();
    selection?.addRange(range);
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));

    expect(await screen.findByRole("button", { name: "已复制" })).toBeTruthy();
    expect(document.querySelector("[data-ranking-copy-fallback]")).toBeNull();
    expect(document.activeElement).toBe(previous);
    expect(document.getSelection()?.toString()).toBe("保留选择");
    previous.remove();
    selectedText.remove();
  });

  it("reports a retryable error when both copy paths fail", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const execCommand = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    setExecCommand(execCommand);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
    expect(
      await screen.findByRole("button", { name: "复制失败" }),
    ).toBeTruthy();
    expect(screen.getByText("复制失败，请重试")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制失败" }));
    expect(await screen.findByRole("button", { name: "已复制" })).toBeTruthy();
  });

  it("restores the idle state and clears a pending timer on unmount", async () => {
    vi.useFakeTimers();
    setClipboard(vi.fn().mockResolvedValue(undefined));
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(<CopyRankingButton text="榜单正文" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "已复制" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("button", { name: "复制榜单" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
      await Promise.resolve();
    });
    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
