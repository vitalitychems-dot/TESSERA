import React, { useState, useRef, useEffect, type ReactNode, type KeyboardEvent } from "react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SovereignSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SovereignSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: SovereignSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find(o => o.value === value);
  const enabledOptions = options.filter(o => !o.disabled);

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
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(Math.max(0, enabledOptions.findIndex(o => o.value === value)));
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => Math.min(enabledOptions.length - 1, prev + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => Math.max(0, prev - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < enabledOptions.length) {
          onValueChange(enabledOptions[focusedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(enabledOptions.length - 1);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={placeholder}
        disabled={disabled}
        className={`flex w-full items-center justify-between rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white transition-colors hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? "text-white" : "text-gray-400"}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={placeholder}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-white/10 bg-gray-800 py-1 shadow-lg"
          style={{ animation: "sovereign-dropdown-in 100ms ease-out" }}
        >
          {options.map((option, index) => {
            const enabledIndex = enabledOptions.indexOf(option);
            const isFocused = enabledIndex === focusedIndex;
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                  option.disabled
                    ? "text-gray-500 cursor-not-allowed"
                    : isFocused
                    ? "bg-purple-500/20 text-white"
                    : isSelected
                    ? "bg-white/5 text-white"
                    : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => {
                  if (!option.disabled) {
                    onValueChange(option.value);
                    setIsOpen(false);
                  }
                }}
                onMouseEnter={() => {
                  if (!option.disabled) setFocusedIndex(enabledIndex);
                }}
              >
                {option.label}
                {isSelected && (
                  <svg className="ml-auto inline h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <style>{`
        @keyframes sovereign-dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
