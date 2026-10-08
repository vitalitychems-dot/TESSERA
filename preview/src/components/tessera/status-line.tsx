export function StatusLine({ checked, className }: { checked?: string; className?: string }) {
  return (
    <p className={className ?? "text-xs leading-relaxed text-muted"}>
      Pen today: borrowed. Own weights: none. AGI is a goal.
      {checked ? ` Last checked ${checked} Central.` : " Not checked."}
    </p>
  );
}
