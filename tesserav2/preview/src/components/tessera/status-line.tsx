export function StatusLine({ checked, className }: { checked?: string; className?: string }) {
  return (
    <p className={className ?? "text-xs leading-relaxed text-muted"}>
      Tessera is the pen.
      {checked ? ` Last checked ${checked} Central.` : " Not checked."}
    </p>
  );
}
