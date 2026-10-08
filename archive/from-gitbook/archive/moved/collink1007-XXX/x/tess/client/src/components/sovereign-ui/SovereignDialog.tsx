import React, { useEffect, useRef, useCallback, useState, type ReactNode } from "react";

interface SovereignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

interface SovereignDialogContentProps {
  className?: string;
  children: ReactNode;
  onEscapeKeyDown?: () => void;
  onPointerDownOutside?: () => void;
}

interface SovereignDialogTriggerProps {
  children: ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

export function SovereignDialog({ open, onOpenChange, children }: SovereignDialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function SovereignDialogTrigger({ children, asChild, onClick }: SovereignDialogTriggerProps) {
  const { onOpenChange } = React.useContext(DialogContext);
  const handleClick = () => {
    onClick?.();
    onOpenChange(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, { onClick: handleClick });
  }

  return <button type="button" onClick={handleClick}>{children}</button>;
}

export function SovereignDialogContent({
  className = "",
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
}: SovereignDialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeKeyDown?.();
        onOpenChange(false);
      }
      if (e.key === "Tab" && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      const autofocus = contentRef.current?.querySelector<HTMLElement>("[autofocus]");
      (autofocus || contentRef.current)?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          onPointerDownOutside?.();
          onOpenChange(false);
        }}
        aria-hidden="true"
        style={{ animation: "sovereign-fade-in 150ms ease-out" }}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative z-50 max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-white/10 bg-gray-900 p-6 shadow-xl ${className}`}
        style={{ animation: "sovereign-scale-in 200ms ease-out" }}
      >
        {children}
      </div>
      <style>{`
        @keyframes sovereign-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sovereign-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

export function SovereignDialogHeader({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function SovereignDialogTitle({ className = "", children }: { className?: string; children: ReactNode }) {
  return <h2 className={`text-lg font-semibold text-white ${className}`}>{children}</h2>;
}

export function SovereignDialogDescription({ className = "", children }: { className?: string; children: ReactNode }) {
  return <p className={`text-sm text-gray-400 mt-1 ${className}`}>{children}</p>;
}

export function SovereignDialogFooter({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mt-6 flex justify-end gap-3 ${className}`}>{children}</div>;
}

export function SovereignDialogClose({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <button type="button" className={className} onClick={() => onOpenChange(false)}>
      {children}
    </button>
  );
}
