export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] p-4 sm:p-6 animate-pulse">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-violet-500/10 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-violet-500/5 border border-violet-500/10 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-800/40 border border-slate-700/30 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-800/30 border border-slate-700/20 rounded-xl" />
          <div className="h-48 bg-slate-800/30 border border-slate-700/20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default PageSkeleton;
