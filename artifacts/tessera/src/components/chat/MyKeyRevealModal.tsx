interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Compatibility component for callers from older bundles. The canonical
 * credential is intentionally never transformed or returned to the browser.
 */
export function MyKeyRevealModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="credential-protection-title">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 id="credential-protection-title" className="text-lg font-semibold text-foreground">Credential protection</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Tessera does not reveal, transform, or return the canonical admin credential in the browser or chat. Keep it in the hosting provider&apos;s secret store and enter it only at the secure session gate.
        </p>
        <button onClick={onClose} className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Close</button>
      </div>
    </div>
  );
}

export const SHOW_MY_KEY_REGEX =
  /^\s*\/?(?:show|give|reveal|render|display)(?:\s+me)?\s+(?:my\s+)?(?:admin\s+)?key(?:\s+in\s+lus)?\s*[!.?]*$/i;

export function isShowMyKeyCommand(text: string): boolean {
  return SHOW_MY_KEY_REGEX.test(text) || /^\s*\/?my\s+key(?:\s+in\s+lus)?\s*$/i.test(text);
}
