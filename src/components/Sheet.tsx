"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Mobile bottom sheet: slides up, drag the handle (or the header) down to dismiss. */
export default function Sheet({
  open,
  title,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const drag = {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (start.current !== null) setDy(Math.max(0, e.touches[0].clientY - start.current));
    },
    onTouchEnd: () => {
      if (dy > 90) onClose();
      start.current = null;
      setDy(0);
    },
  };

  return createPortal(
    <div className="sheet-layer" data-no-swipe>
      <div className="sheet-backdrop" onClick={onClose} style={{ opacity: Math.max(0, 1 - dy / 300) }} />
      <div
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? "none" : undefined }}
      >
        <div className="sheet-grab" {...drag}>
          <span className="sheet-handle" />
          {title && <div className="sheet-title">{title}</div>}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
