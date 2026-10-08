import React, { useState, useEffect, useCallback, type ReactNode } from "react";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  toast: (options: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toast: () => "",
  dismiss: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

let globalToastFn: ToastContextValue["toast"] | null = null;

export function toast(options: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}): string {
  if (globalToastFn) return globalToastFn(options);
  return "";
}

interface SovereignToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export function SovereignToastProvider({ children, maxToasts = 5 }: SovereignToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast: ToastContextValue["toast"] = useCallback((options) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || "default",
      duration: options.duration || 5000,
      createdAt: Date.now(),
    };

    setToasts(prev => {
      const next = [...prev, newToast];
      return next.slice(-maxToasts);
    });

    return id;
  }, [maxToasts]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    globalToastFn = addToast;
    return () => { globalToastFn = null; };
  }, [addToast]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map(t => {
      const remaining = t.duration - (Date.now() - t.createdAt);
      if (remaining <= 0) {
        dismiss(t.id);
        return null;
      }
      return setTimeout(() => dismiss(t.id), remaining);
    });
    return () => {
      for (const timer of timers) {
        if (timer) clearTimeout(timer);
      }
    };
  }, [toasts, dismiss]);

  const variantStyles: Record<ToastVariant, string> = {
    default: "border-white/10 bg-gray-800",
    success: "border-green-500/30 bg-green-900/40",
    error: "border-red-500/30 bg-red-900/40",
    warning: "border-yellow-500/30 bg-yellow-900/40",
    info: "border-blue-500/30 bg-blue-900/40",
  };

  const variantIcons: Record<ToastVariant, string> = {
    default: "",
    success: "M5 13l4 4L19 7",
    error: "M18 6L6 18M6 6l12 12",
    warning: "M12 9v4m0 4h.01M12 3l9 16H3L12 3z",
    info: "M12 16v-4m0-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z",
  };

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg min-w-[300px] max-w-[420px] ${variantStyles[t.variant]}`}
            style={{ animation: "sovereign-toast-in 200ms ease-out" }}
          >
            {variantIcons[t.variant] && (
              <svg className="h-5 w-5 mt-0.5 shrink-0 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d={variantIcons[t.variant]} />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{t.title}</p>
              {t.description && (
                <p className="mt-1 text-xs text-gray-300">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 text-gray-400 hover:text-white transition-colors"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes sovereign-toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
