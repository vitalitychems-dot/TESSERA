import { useState, type FormEvent, type ReactNode } from "react";
import { useGetTesseraLaunchStatus, getGetTesseraLaunchStatusQueryKey } from "@workspace/api-client-react";
import { useAdmin } from "@/lib/adminContext";
import { Loader2, Lock, ShieldAlert } from "lucide-react";
import TesseraIdentityNotice from "./TesseraIdentityNotice";
import { Link } from "wouter";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div className="hud-panel rounded-xl w-full max-w-md p-6 space-y-5">{children}</div>
    </main>
  );
}

function Checklist() {
  const { data, isLoading, isError, refetch } = useGetTesseraLaunchStatus({
    query: { queryKey: getGetTesseraLaunchStatusQueryKey() },
  });
  if (isLoading) return <p className="text-xs font-mono text-muted-foreground">Reading launch checklist...</p>;
  if (isError || !data)
    return (
      <p className="text-xs font-mono text-destructive" role="alert">
        Launch status unavailable.{" "}
        <button type="button" className="underline" onClick={() => void refetch()}>Retry</button>
      </p>
    );
  const rows: [string, string, boolean][] = [
    ["Owner access", data.ownerAccessConfigured ? "configured" : "not configured", data.ownerAccessConfigured],
    ["Model worker", data.modelConfigured ? `${data.configuredModel} (configured only)` : "not configured", data.modelConfigured],
    ["Autonomous runtime", data.autonomousRuntimeEnabled ? "enabled" : "disabled", data.autonomousRuntimeEnabled],
  ];
  return (
    <>
    <TesseraIdentityNotice />
    <ul className="space-y-1.5 text-xs font-mono" aria-label="Launch checklist" data-testid="list-launch-checklist">
      {rows.map(([k, v, ok]) => (
        <li key={k} className="flex justify-between gap-3 border-b border-border/50 pb-1">
          <span className="text-muted-foreground">{k}</span>
          <span className={ok ? "text-cyan-400" : "text-amber-400"}>{v}</span>
        </li>
      ))}
    </ul>
    </>
  );
}

export default function OwnerSessionGate({ children }: { children: ReactNode }) {
  const { isAdmin, configured, loading, authenticate } = useAdmin();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAdmin) return <>{children}</>;

  if (loading)
    return (
      <Shell>
        <div className="flex items-center gap-3" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <span className="text-sm font-mono text-muted-foreground">Checking owner session...</span>
        </div>
      </Shell>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!key || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await authenticate(key);
      if (ok) setKey("");
      else setError("That key was not accepted. Check it and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not establish the owner session. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Link href="/" className="text-xs text-cyan-400 underline" data-testid="link-open-workspace">Back to open workspace</Link>
      <div className="flex items-center gap-3">
        {configured ? <Lock className="h-5 w-5 text-cyan-400" /> : <ShieldAlert className="h-5 w-5 text-amber-400" />}
        <h1 className="text-lg font-semibold">Tessera</h1>
      </div>
      {configured ? (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="owner-key" className="text-sm text-muted-foreground block">
            Enter the owner key to open your workspace.
          </label>
          <input
            id="owner-key"
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-owner-key"
          />
          {error && <p role="alert" className="text-sm text-destructive" data-testid="text-owner-error">{error}</p>}
          <button
            type="submit"
            disabled={busy || !key}
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            data-testid="button-owner-unlock"
          >
            {busy ? "Verifying..." : "Unlock"}
          </button>
        </form>
      ) : (
        <div className="space-y-2 text-sm" data-testid="text-owner-unconfigured">
          <p>Owner access is not set up on the server yet.</p>
          <p className="text-muted-foreground">
            Add a long, random value as the <code className="font-mono text-cyan-400">SOVEREIGN_ADMIN_TOKEN</code> secret in
            the server environment secrets, restart the app, then return here. Do not paste the value into chat or code.
          </p>
        </div>
      )}
      <Checklist />
    </Shell>
  );
}
