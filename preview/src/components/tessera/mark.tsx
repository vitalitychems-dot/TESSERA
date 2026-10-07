export function TesseraMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M16 3.5 L28.5 16 L16 28.5 L3.5 16 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M16 10 L22 16 L16 22 L10 16 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}
