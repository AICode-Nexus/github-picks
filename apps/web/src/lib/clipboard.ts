function fallbackCopyText(text: string): boolean {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.dataset.rankingCopyFallback = "true";
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    return (
      typeof document.execCommand === "function" && document.execCommand("copy")
    );
  } finally {
    textarea.remove();
    activeElement?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    window.scrollTo(scrollX, scrollY);
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the local fallback for denied or unavailable clipboard APIs.
    }
  }

  if (fallbackCopyText(text)) return;
  throw new Error("clipboard copy failed");
}
