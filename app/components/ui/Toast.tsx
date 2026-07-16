"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts(prev => [...prev.slice(-4), { id, kind, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-sm px-4 py-3 border rounded text-sm font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-2 ${
              t.kind === "success"
                ? "bg-[#101B0E] border-[#52B946]/40 text-[#52B946]"
                : t.kind === "error"
                  ? "bg-[#1F0E0E] border-[#FF4D4D]/40 text-[#FF4D4D]"
                  : "bg-[#1B1B1B] border-white/20 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
