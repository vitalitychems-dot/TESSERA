interface SovereignDownloadDialogProps {
  open: boolean;
  onClose: () => void;
}

/** The former client-only progress simulation did not download a real archive. */
export default function SovereignDownloadDialog({ open, onClose }: SovereignDownloadDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-unavailable-title"
      data-testid="dialog-sovereign-download"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Tessera export</p>
        <h2 id="archive-unavailable-title" className="mt-2 text-xl font-semibold">Archive export is not implemented</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This deployment has no server-side archive endpoint. No archive, encryption, or download is being created. Use the repository backup workflow for source files; a verified export can be added once its scope and integrity checks are implemented.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
