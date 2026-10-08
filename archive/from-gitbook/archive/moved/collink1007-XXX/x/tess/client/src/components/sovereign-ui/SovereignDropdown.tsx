import React, { useState, useRef, useEffect, type ReactNode, type KeyboardEvent } from "react";

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

interface SovereignDropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "center" | "end";
  className?: string;
}

export function SovereignDropdown({
  trigger,
  items,
  align = "end",
  className = "",
}: SovereignDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actionItems = items.filter(i => !i.separator);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => {
          let next = prev + 1;
          while (next < actionItems.length && actionItems[next].disabled) next++;
          return next < actionItems.length ? next : prev;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          let next = prev - 1;
          while (next >= 0 && actionItems[next].disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < actionItems.length) {
          const item = actionItems[focusedIndex];
          if (!item.disabled) {
            item.onSelect?.();
            setIsOpen(false);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const alignClass = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <div onClick={() => setIsOpen(!isOpen)} role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={isOpen}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={`absolute ${alignClass} z-50 mt-2 min-w-[180px] rounded-md border border-white/10 bg-gray-800 py-1 shadow-xl`}
          style={{ animation: "sovereign-dropdown-in 100ms ease-out" }}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return <div key={`sep-${index}`} className="my-1 border-t border-white/10" />;
            }

            const actionIndex = actionItems.indexOf(item);
            const isFocused = actionIndex === focusedIndex;

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  item.disabled
                    ? "text-gray-500 cursor-not-allowed"
                    : item.destructive
                    ? isFocused
                      ? "bg-red-500/20 text-red-300"
                      : "text-red-400 hover:bg-red-500/10"
                    : isFocused
                    ? "bg-white/10 text-white"
                    : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => {
                  if (!item.disabled) {
                    item.onSelect?.();
                    setIsOpen(false);
                  }
                }}
                onMouseEnter={() => {
                  if (!item.disabled) setFocusedIndex(actionIndex);
                }}
              >
                {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes sovereign-dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
