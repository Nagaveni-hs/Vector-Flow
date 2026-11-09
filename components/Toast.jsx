"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// One shared toast for the whole site. A small message appears at
// the top, centred, disappears by itself after ~3.5 seconds, and
// has a close button. No context/provider needed: a page keeps the
// toast in local state with useToast and renders <Toast /> once.
//
// Usage in a page:
//   const { toast, showToast, hideToast } = useToast();
//   showToast("You are registered.");            // info (default)
//   showToast("Could not save. Try again.", "error");
//   showToast("Certificate sent.", "success");
//   ...
//   <Toast toast={toast} onClose={hideToast} />
//
// Types: "info" (default) | "success" | "error".
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hideToast = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message, type = "info") => {
      if (!message) return;
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      timer.current = setTimeout(() => {
        setToast(null);
        timer.current = null;
      }, 3500);
    },
    []
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { toast, showToast, hideToast };
}

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.type || "info"}`} role="status">
      <span>{toast.message}</span>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss message">
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
