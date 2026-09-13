"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Info tooltip rendered via a portal to document.body, positioned with
 * `fixed` coordinates computed from the icon's actual screen position.
 * Deliberately not a plain CSS group-hover tooltip: those get clipped by
 * any ancestor with `overflow-x-auto` (every table on this dashboard has
 * one, for horizontal scroll on narrow screens) the moment the icon sits
 * near that container's edge — which is exactly the bug this replaced.
 */
export function Info({ children }: { children: ReactNode }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const rect = iconRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 8, left: Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140) });
  }

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      <span
        ref={iconRef}
        className="ml-1.5 flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full border border-border text-[10px] font-bold normal-case text-text-mute transition-colors hover:border-accent hover:text-accent"
      >
        i
      </span>
      {pos &&
        createPortal(
          <span
            className="pointer-events-none fixed z-50 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-2 p-3 text-xs font-normal normal-case leading-relaxed text-text-soft shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            {children}
          </span>,
          document.body
        )}
    </span>
  );
}
