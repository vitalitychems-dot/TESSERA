import { useEffect, useState } from "react";
import { MESH, meshProject } from "@/lib/tessera/mesh-net";
import { readMoltbook, readPublicBoard, type PublicIssue } from "@/lib/tessera/public-board";

const ADMIT = meshProject("admit");

export function GitbookAiView() {
  const [issues, setIssues] = useState<PublicIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [moltbook, setMoltbook] = useState("Moltbook has not been checked.");

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
    void readMoltbook()
      .then((result) => {
        if (!stop) setMoltbook(result.line);
      })
      .catch(() => {
        if (!stop) setMoltbook("Moltbook could not be reached. No key was saved.");
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
          <h2 className="mt-1 font-display text-4xl tracking-tight">The mesh</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The mesh is the git repository. A clone can be read with no web. The private Gitbook stays private. A drop is not delivered until it is approved. Payment is not handled. Machines are not accepted.
          </p>
        </div>
        <p className="text-sm text-fg">
          Carried by {MESH.carriedBy}. Needs web: {MESH.needsWeb ? "yes" : "no"}.
        </p>
        <p className="text-sm text-fg">{moltbook}</p>
        <ul className="flex flex-col gap-1 text-sm text-fg">
          {MESH.like.map((row) => (
            <li key={row.ours}>
              {row.ours}. <span className="text-muted">Theirs is {row.theirs}.</span>
            </li>
          ))}
        </ul>
        <section>
          <h3 className="font-display text-2xl">Projects on the mesh</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {MESH.projects.map((project) => (
              <li key={project.name} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <p className="text-fg">{project.name}</p>
                <p className="text-muted">{project.does}</p>
                <p className="text-xs text-subtle">{project.run}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{ADMIT ? `${ADMIT.name} is on this disk.` : "The admit project is missing."}</p>
        </section>
        <section>
          <h3 className="font-display text-2xl">Open issues</h3>
          {error ? <p className="mt-2 text-sm text-red-400">{error} The mesh above does not need that list.</p> : null}
          <ul className="mt-2 flex flex-col gap-2">
            {issues.map((issue) => (
              <li key={issue.number} className="rounded-xl border border-border bg-surface px-4 py-3">
                <a href={issue.url} target="_blank" rel="noreferrer" className="text-sm text-fg">
                  #{issue.number}. {issue.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <a className="text-sm text-accent" href="https://github.com/vitalitychems-dot/GitbookAI/issues/1" target="_blank" rel="noreferrer">
          The outer door
        </a>
        <a className="text-sm text-accent" href="https://github.com/vitalitychems-dot/GitbookAI" target="_blank" rel="noreferrer">
          Open the public repository
        </a>
      </div>
    </div>
  );
}
