export function StatusLine({ checked, className }: { checked?: string; className?: string }) {
  return (
    <p className={className ?? "text-xs leading-relaxed text-muted"}>
      Desk pen only. If it is down, this room stays quiet. Own weights: none. AGI is a goal.
      {checked ? ` Last checked ${checked} Central.` : " Not checked."}
    </p>
  );
}
