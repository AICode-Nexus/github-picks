"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import { appendRankingPageUrl } from "../lib/ranking-share";

type CopyStatus = "idle" | "success" | "error";

export interface CopyRankingButtonProps {
  text: string;
}

const COPY_STATUS = {
  idle: { label: "复制榜单", Icon: Copy },
  success: { label: "已复制", Icon: Check },
  error: { label: "复制失败", Icon: CircleAlert },
} as const;

export function CopyRankingButton({ text }: CopyRankingButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  function clearResetTimer() {
    if (resetTimer.current === null) return;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  async function handleCopy() {
    clearResetTimer();
    try {
      await copyTextToClipboard(
        appendRankingPageUrl(text, window.location.href),
      );
      setStatus("success");
      resetTimer.current = window.setTimeout(() => {
        setStatus("idle");
        resetTimer.current = null;
      }, 2_000);
    } catch {
      setStatus("error");
    }
  }

  const { label, Icon } = COPY_STATUS[status];
  return (
    <div className="ranking-copy">
      <button
        className="ranking-copy__button"
        data-state={status}
        type="button"
        onClick={handleCopy}
      >
        <Icon aria-hidden="true" size={16} />
        <span>{label}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {status === "success" ? "榜单内容已复制到剪贴板" : null}
        {status === "error" ? "复制失败，请重试" : null}
      </span>
    </div>
  );
}
