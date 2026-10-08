import { useQuery } from "@tanstack/react-query";
import { Activity, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

type InteractiveStatus = {
  service: string;
  checkedAt: string;
  runtime: {
    status: "online";
    uptimeSeconds: number;
    nodeVersion: string;
  };
  modules: {
    runtimeStatus: { state: "active"; source: string };
    canonicalModules: { state: "inactive"; reason: string };
    personalChartVault: { state: "disabled"; reason: string };
    autonomousEngines: { state: "disabled"; reason: string };
  };
};

async function fetchStatus(): Promise<InteractiveStatus> {
  const response = await fetch("/api/interactive/status", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : `Status request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as InteractiveStatus;
}

function formatUptime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainder = safeSeconds % 60;
  return [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    `${remainder}s`,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function InteractiveStatusPage() {
  const status = useQuery({
    queryKey: ["interactive-api-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-10">
      <header className="space-y-1">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400">
          Read-only runtime view
        </p>
        <h1 className="text-2xl font-semibold">System status</h1>
        <p className="text-sm text-muted-foreground">
          Verified facts about this API process. This does not report model
          quality, provider availability, or background activity.
        </p>
      </header>

      {status.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          Checking the interactive API…
        </p>
      )}

      {status.isError && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 text-amber-400" />
            <div className="space-y-2">
              <h2 className="font-medium">Runtime status unavailable</h2>
              <p className="text-sm text-muted-foreground">
                {status.error instanceof Error
                  ? status.error.message
                  : "The read-only status request failed."}
              </p>
              <button
                type="button"
                onClick={() => void status.refetch()}
                className="inline-flex items-center gap-2 text-sm text-cyan-300 underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        </section>
      )}

      {status.data && !status.isError && (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-300">
                <Activity className="h-4 w-4" />
                <h2 className="font-medium">Interactive API</h2>
              </div>
              <p className="mt-3 text-lg font-semibold">Online</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This process has been running for{" "}
                {formatUptime(status.data.runtime.uptimeSeconds)}.
              </p>
              <p className="mt-2 text-xs font-mono text-muted-foreground">
                Node {status.data.runtime.nodeVersion}
              </p>
            </article>

            <article className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <ShieldCheck className="h-4 w-4" />
                <h2 className="font-medium">Status source</h2>
              </div>
              <p className="mt-3 text-sm">{status.data.modules.runtimeStatus.source}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Checked {new Date(status.data.checkedAt).toLocaleString()}.
                Updates every 30 seconds.
              </p>
            </article>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Module availability</h2>
            <ul className="space-y-2">
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Other canonical modules — inactive</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.data.modules.canonicalModules.reason}
                </p>
              </li>
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Personal chart and vault — disabled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.data.modules.personalChartVault.reason}
                </p>
              </li>
              <li className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Autonomous engines — disabled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.data.modules.autonomousEngines.reason}
                </p>
              </li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
