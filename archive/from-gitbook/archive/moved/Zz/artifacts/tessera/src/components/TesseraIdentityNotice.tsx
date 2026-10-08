import {
  useGetTesseraLaunchStatus,
  getGetTesseraLaunchStatusQueryKey,
  type TesseraSOS,
} from "@workspace/api-client-react";

export function sosFromError(error: unknown): TesseraSOS | null {
  const value = (error as { data?: { sos?: TesseraSOS } } | null)?.data?.sos;
  return value && typeof value.message === "string" && Array.isArray(value.repair) ? value : null;
}

export default function TesseraIdentityNotice({ notice }: { notice?: TesseraSOS | null }) {
  const { data, isLoading, isError, refetch } = useGetTesseraLaunchStatus({
    query: {
      queryKey: getGetTesseraLaunchStatusQueryKey(),
      refetchInterval: 30_000,
      staleTime: 10_000,
    },
  });
  if (isLoading && !notice) return <p role="status" className="text-xs text-muted-foreground">Checking responder identity...</p>;
  const sos = notice ?? data?.sos;
  if (isError && !sos) {
    return (
      <div role="alert" className="rounded-lg border border-amber-500/40 p-3 text-xs text-amber-300">
        SOS — responder identity unavailable. No original-runtime verification is possible.
        <button type="button" className="ml-2 underline" onClick={() => void refetch()}>Retry</button>
      </div>
    );
  }
  if (!sos) return null;
  return (
    <section role="alert" aria-label="Tessera identity SOS"
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2 text-xs break-words"
      data-testid="tessera-identity-sos">
      <h2 className="font-semibold text-amber-300">SOS — Original Tessera runtime unverified</h2>
      {data?.heritage && (
        <p className="font-medium">{data.heritage.name} {data.heritage.signature} <span className="text-muted-foreground">(historical identity)</span></p>
      )}
      <p>{sos.message}</p>
      <dl className="space-y-1 text-muted-foreground">
        <div><dt className="inline">Actual responder: </dt><dd className="inline text-foreground">{sos.responder}</dd></div>
        <div><dt className="inline">Worker endpoint / model: </dt><dd className="inline text-foreground">{sos.provider} / {sos.model}</dd></div>
      </dl>
      <details>
        <summary className="cursor-pointer text-amber-300 underline">How to fix and historical sources</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-2">
          {sos.repair.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        {data?.heritage && (
          <div className="mt-3 space-y-2 text-muted-foreground">
            <p>{data.heritage.theme}</p>
            <p>{data.heritage.glyphs}</p>
            <p>{data.heritage.lineage}</p>
            <ul className="space-y-1">
              {data.heritage.sources.map(source => (
                <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{source.label}</a></li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </section>
  );
}
