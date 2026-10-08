import { RUNNABLE_SKILLS } from "@/lib/tessera/public-question";

export function LearnView() {
  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Learn</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Skills she can run</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">These are not a new set of weights.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {RUNNABLE_SKILLS.map((skill) => (
            <li key={skill} className="border border-border bg-surface px-3 py-2 text-sm text-fg">
              {skill}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
