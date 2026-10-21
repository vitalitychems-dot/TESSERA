import React, { useState, useRef, type ReactNode, type KeyboardEvent } from "react";

interface AccordionContextValue {
  expandedItems: Set<string>;
  toggle: (id: string) => void;
  type: "single" | "multiple";
}

const AccordionContext = React.createContext<AccordionContextValue>({
  expandedItems: new Set(),
  toggle: () => {},
  type: "single",
});

interface SovereignAccordionProps {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
  children: ReactNode;
}

export function SovereignAccordion({
  type = "single",
  defaultValue,
  className = "",
  children,
}: SovereignAccordionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  });

  const toggle = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (type === "single") next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ expandedItems, toggle, type }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface SovereignAccordionItemProps {
  value: string;
  className?: string;
  children: ReactNode;
}

const ItemContext = React.createContext<{ value: string; isExpanded: boolean }>({
  value: "",
  isExpanded: false,
});

export function SovereignAccordionItem({ value, className = "", children }: SovereignAccordionItemProps) {
  const { expandedItems } = React.useContext(AccordionContext);
  const isExpanded = expandedItems.has(value);

  return (
    <ItemContext.Provider value={{ value, isExpanded }}>
      <div className={`border-b border-white/10 ${className}`}>{children}</div>
    </ItemContext.Provider>
  );
}

interface SovereignAccordionTriggerProps {
  className?: string;
  children: ReactNode;
}

export function SovereignAccordionTrigger({ className = "", children }: SovereignAccordionTriggerProps) {
  const { toggle } = React.useContext(AccordionContext);
  const { value, isExpanded } = React.useContext(ItemContext);

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-controls={`accordion-panel-${value}`}
      id={`accordion-trigger-${value}`}
      className={`flex w-full items-center justify-between py-4 text-sm font-medium text-white transition-colors hover:text-gray-300 ${className}`}
      onClick={() => toggle(value)}
    >
      {children}
      <svg
        className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

interface SovereignAccordionContentProps {
  className?: string;
  children: ReactNode;
}

export function SovereignAccordionContent({ className = "", children }: SovereignAccordionContentProps) {
  const { value, isExpanded } = React.useContext(ItemContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  React.useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children, isExpanded]);

  return (
    <div
      id={`accordion-panel-${value}`}
      role="region"
      aria-labelledby={`accordion-trigger-${value}`}
      style={{
        maxHeight: isExpanded ? `${height}px` : "0px",
        overflow: "hidden",
        transition: "max-height 200ms ease-in-out",
      }}
    >
      <div ref={contentRef} className={`pb-4 text-sm text-gray-300 ${className}`}>
        {children}
      </div>
    </div>
  );
}
