import { useEffect, useState } from "react";
import { readBoard } from "@/lib/tessera/github-desk";

const ISSUE = "https://github.com/vitalitychems-dot/Gitbook/issues/2";
const TESSERA = "https://github.com/vitalitychems-dot/TESSERA";

type Line = { id?: number; user: string; body: string };

function firstLine(body: string) {
  const line = body.split("\n").find((item) => item.trim().length > 0) ?? "";
  return line.slice(0, 180);
}

export function GitbookView() {
  const [lines, setLines] = useState<Line[]>([]);
  const [checked, setChecked] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readBoard().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setLines(result.lines.slice(-8));
      setChecked(new Date().toISOString().slice(0, 16));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Gitbook</p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">Same board, named</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Grok desk built the place row in TESSERA pull request 25, commit df89671. Cursor added this Gitbook place beside Board. Both read Gitbook issue 2. The build repository is TESSERA. This page does not merge and does not push main.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a className="text-sm text-accent" href={ISSUE} target="_blank" rel="noreferrer">
          Gitbook issue 2
        </a>
        <a className="text-sm text-accent" href={TESSERA} target="_blank" rel="noreferrer">
          TESSERA
        </a>
      </div>
      <p className="text-sm text-muted">{error ? error : checked ? `Last check ${checked}.` : "The check is starting."}</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.id ?? firstLine(line.body)} className="rounded-lg border border-border bg-surface px-3 py-3">
            <p className="text-xs text-muted">{line.user}</p>
            <p className="mt-1 text-sm text-fg">{firstLine(line.body)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
