import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { BrainCircuit } from "lucide-react";
import { useWorldPulse } from "@/hooks/use-world-pulse";
import { useSourceMemoryStatus } from "@/hooks/use-source-memory";
import { PageHead, Panel, Skeleton, queryState, observed, type DataState } from "@/components/workspace/Surface";

function sourceMemoryState(query: ReturnType<typeof useSourceMemoryStatus>): DataState {
  if (query.data && !query.data.available) return "unavailable";
  return queryState(query);
}

export default function BrainPage() {
  useEffect(() => { document.title = "TESSERA | Brain"; }, []);
  const { brain } = useWorldPulse();
  const sourceMemory = useSourceMemoryStatus();
  const fmt = (n: number) => n.toLocaleString();
  const d = brain.data;
  const density = d && d.entries > 0 ? d.crossReferences / d.entries : null;
  // One voxel per ~1% of entries that carry cross-references, capped at 100 cells. Derived from measured values only.
  const cells = useMemo(() => density == null ? 0 : Math.max(1, Math.min(100, Math.round(density * 100))), [density]);

  return (
    <div className="ws-page" data-testid="brain-page">
      <PageHead eyebrow="Software memory / indexed corpus" title="Brain" icon={<BrainCircuit size={30} />} testId="brain"
        onRefresh={() => { void brain.refetch(); void sourceMemory.refetch(); }} refreshing={brain.isFetching || sourceMemory.isFetching}>
        What the running service has indexed. These are corpus statistics from the knowledge store, not a measurement of thought or consciousness.
      </PageHead>
      <div className="space-y-4">
        <Panel title="Indexed knowledge corpus" labelId="brain-corpus" state={queryState(brain)} testId="panel-brain-corpus"
          source={<>Source: /api/knowledge-corpus/stats · polled every 60s<br />Observed: {observed(brain.dataUpdatedAt)}</>}>
          {brain.isLoading && !d ? <Skeleton /> : d ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="ws-stat"><dt>Entries</dt><dd data-testid="text-brain-entries">{fmt(d.entries)}</dd></div>
                <div className="ws-stat"><dt>Domains</dt><dd data-testid="text-brain-domains">{fmt(d.domains)}</dd></div>
                <div className="ws-stat"><dt>Cross-refs</dt><dd data-testid="text-brain-xrefs">{fmt(d.crossReferences)}</dd></div>
                <div className="ws-stat"><dt>Avg. confidence</dt><dd data-testid="text-brain-confidence">{d.averageConfidence.toFixed(3)}</dd></div>
              </dl>
              {density != null && (
                <div className="mt-5">
                  <p className="ws-note mb-2">Link density: {density.toFixed(2)} cross-references per entry. Each lit block below is one percent of that ratio, capped at 100.</p>
                  <div className="ws-voxels" aria-hidden="true">{Array.from({ length: cells }, (_, i) => <span key={i} style={{ opacity: 0.35 + (i % 4) * 0.16 }} />)}</div>
                </div>
              )}
              {brain.isError && <p className="ws-warn mt-3" role="status">Refresh failed. Values above are the last successful reading.</p>}
            </>
          ) : (
            <div role="status">
              <p className="ws-err">The corpus endpoint is unavailable. No substitute numbers are shown.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void brain.refetch()} data-testid="button-retry-brain">Retry</button>
            </div>
          )}
        </Panel>

        <Panel title="Source-memory status" labelId="brain-sourcemem" state={sourceMemoryState(sourceMemory)} testId="panel-brain-sourcemem"
          source={<>Source: /api/source-memory/status · owner-only · polled every 60s<br />Observed: {observed(sourceMemory.dataUpdatedAt)}</>}>
          {sourceMemory.isLoading ? <Skeleton rows={2} /> : sourceMemory.data?.available ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="ws-stat"><dt>Evidence pointers</dt><dd data-testid="text-brain-sourcemem-count">{sourceMemory.data.records.toLocaleString()}</dd></div>
                <div className="ws-stat"><dt>Installed as tools</dt><dd>0</dd></div>
                <div className="ws-stat"><dt>Execution allowed</dt><dd>No</dd></div>
                <div className="ws-stat"><dt>Used for training</dt><dd>No</dd></div>
              </dl>
              <p className="ws-note mt-3">These are read-only pointers to public repository evidence, kept separate from the indexed corpus above. <Link href="/memory" className="ws-link" data-testid="link-brain-memory">Open Memory</Link></p>
            </>
          ) : (
            <div role="status">
              <p className="ws-err">The source-memory index is unavailable. No substitute status is shown.</p>
              <button type="button" className="ws-btn mt-3" onClick={() => void sourceMemory.refetch()} data-testid="button-retry-source-memory">Retry</button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
