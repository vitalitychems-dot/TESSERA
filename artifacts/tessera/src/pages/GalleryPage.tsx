import { useEffect, useState, useCallback } from "react";
import { Pin, Trash2, Maximize2, X, RefreshCw } from "lucide-react";
import { InlineObject3D, type Object3DSpec } from "@/components/chat/ChatObject3D";

interface PinnedDiagram {
  id: number;
  diagramId: string;
  type: string;
  label: string;
  color: string | null;
  secondaryColor: string | null;
  size: number | null;
  detail: string | null;
  note: string | null;
  sourceMessageId: string | null;
  createdAt: string;
}

function toSpec(d: PinnedDiagram): Object3DSpec {
  return {
    type: d.type,
    label: d.label || d.type,
    color: d.color || undefined,
    secondaryColor: d.secondaryColor || undefined,
    size: d.size ?? undefined,
    detail: d.detail || undefined,
  };
}

export default function GalleryPage() {
  const [diagrams, setDiagrams] = useState<PinnedDiagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSpec, setOpenSpec] = useState<Object3DSpec | null>(null);

  useEffect(() => { document.title = "Invention Gallery | Tessera"; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pinned-diagrams");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load");
      setDiagrams(data.diagrams || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/pinned-diagrams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDiagrams(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen w-full text-white px-4 sm:px-6 py-6 pb-32">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-violet-500/30 border border-amber-400/30 flex items-center justify-center">
              <Pin size={18} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-wide">Invention Gallery</h1>
              <p className="text-xs text-muted-foreground/70 font-mono">Pinned 3D diagrams from chat</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
            title="Refresh"
            data-testid="button-gallery-refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm" data-testid="text-gallery-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : diagrams.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-10 text-center" data-testid="text-gallery-empty">
            <Pin className="mx-auto mb-3 text-amber-300/50" size={32} />
            <h2 className="text-lg font-semibold mb-2">No pinned diagrams yet</h2>
            <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
              When the agents render a 3D diagram in chat, hit the pin icon to save it here for later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagrams.map(d => {
              const color = d.color || "#a78bfa";
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col"
                  data-testid={`card-pinned-${d.id}`}
                >
                  <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-sm font-bold truncate" style={{ color }}>{d.label || d.type}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors"
                      title="Remove from gallery"
                      data-testid={`button-delete-pinned-${d.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <button
                    onClick={() => setOpenSpec(toSpec(d))}
                    className="relative h-40 bg-gradient-to-br from-violet-950/30 to-cyan-950/30 flex items-center justify-center group cursor-pointer"
                    data-testid={`button-open-pinned-${d.id}`}
                  >
                    <div
                      className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-transform group-hover:scale-110"
                      style={{ borderColor: color, color, background: `${color}10` }}
                    >
                      {d.type.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <Maximize2 size={28} className="text-white" />
                    </div>
                  </button>
                  <div className="px-3 py-2 text-[11px] text-muted-foreground/70 font-mono flex items-center justify-between">
                    <span className="truncate">{d.type}</span>
                    <span className="shrink-0">{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                  {d.detail && (
                    <div className="px-3 pb-2 text-[11px] text-muted-foreground/80 line-clamp-2">{d.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openSpec && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setOpenSpec(null)}
          data-testid="modal-pinned-3d"
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-black/80 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenSpec(null)}
              className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white"
              data-testid="button-close-pinned-modal"
            >
              <X size={18} />
            </button>
            <div className="p-4">
              <InlineObject3D spec={openSpec} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
