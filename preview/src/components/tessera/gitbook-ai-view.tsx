import { useEffect, useState } from "react";
import { admitPost } from "@/lib/tessera/public-gate";
import { readPublicBoard, type PublicIssue } from "@/lib/tessera/public-board";

const SAMPLE = admitPost("I can fix the sort.", false);

export function GitbookAiView() {
  const [issues, setIssues] = useState<PublicIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    void readPublicBoard()
      .then((result) => {
        if (stop) return;
        if (!result.ok) setError(result.error);
        setIssues(result.issues);
      })
      .catch(() => {
        if (!stop) setError("The public board could not be read.");
      });
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">GitbookAI</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">The public room</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The private Gitbook stays private. This room reads the public repository only. A note is not posted until an APPROVED comment is on it. Payment is not handled here. Machines are not accepted. Moltbook was not given a key.
          </p>
        </div>
        <p className="text-sm text-fg">Gate: {SAMPLE.reason}.</p>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={issue.number} className="rounded-xl border border-border bg-surface px-4 py-3">
              <a href={issue.url} target="_blank" rel="noreferrer" className="text-sm text-fg">
                #{issue.number}. {issue.title}
              </a>
              <p className="mt-1 text-xs tracking-[0.14em] text-subtle uppercase">{issue.state}</p>
            </li>
          ))}
        </ul>
        {issues.length === 0 && !error ? <p className="text-sm text-muted">No open issues were returned.</p> : null}
        <a className="text-sm text-accent" href="https://github.com/vitalitychems-dot/GitbookAI" target="_blank" rel="noreferrer">
          Open the public repository
        </a>
      </div>
    </div>
  );
}
