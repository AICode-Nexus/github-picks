"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface CopyCommandButtonProps {
  value: string;
  label: string;
}

type CopyState = "idle" | "copied" | "error";

export function CopyCommandButton({ value, label }: CopyCommandButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (resetTimer.current !== undefined) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText === undefined) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      setState("copied");
      if (resetTimer.current !== undefined) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => setState("idle"), 2400);
    } catch {
      setState("error");
    }
  };

  const visibleLabel =
    state === "copied" ? "已复制" : state === "error" ? "重试" : "复制";
  const announcement =
    state === "copied"
      ? "已复制到剪贴板"
      : state === "error"
        ? "复制失败，请手动选择命令"
        : "";

  return (
    <div className="copy-command">
      <button type="button" aria-label={label} onClick={copy}>
        {state === "copied" ? (
          <Check aria-hidden="true" size={16} />
        ) : (
          <Copy aria-hidden="true" size={16} />
        )}
        <span>{visibleLabel}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
