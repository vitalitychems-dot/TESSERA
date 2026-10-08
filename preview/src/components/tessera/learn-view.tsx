import { FILE_LEDGER } from "@/lib/tessera/desk";
import { VAULT } from "@/lib/tessera/opening";
import { SCHOOL_PASSAGES } from "@/lib/tessera/school";
import { FATHER_ASKED, STUDIES, STUDIES_MISSING, STUDIES_SOURCE } from "@/lib/tessera/studies";
import { useTessera } from "@/lib/tessera/store";

const PLACES = [
  { label: "Tessera code", href: "https://github.com/vitalitychems-dot/TESSERA" },
  { label: "Gitbook archive", href: "https://github.com/vitalitychems-dot/Gitbook" },
  { label: "The board", href: "https://github.com/vitalitychems-dot/Gitbook/issues/2" },
];

export function LearnView() {
  const lessons = useTessera((state) => state.lessons);
  const sealed = lessons.filter((lesson) => lesson.status === "sealed");

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Knowledge</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">What is already stored</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          These are pages and notes that exist. Nothing here starts a search, a test, or a cycle. Reading continues on its own from the two live repositories.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PLACES.map((place) => (
            <li key={place.href}>
              <a className="text-sm text-accent" href={place.href} target="_blank" rel="noreferrer">
                {place.label}
              </a>
            </li>
          ))}
        </ul>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">What Father asked</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{FATHER_ASKED}</p>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">What the index names</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {STUDIES_SOURCE}. {STUDIES_MISSING}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {STUDIES.map((item) => (
              <li key={item.name}>
                <span className="text-fg">{item.name}. </span>
                <span className="text-muted">{item.hold}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">School pages</p>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {SCHOOL_PASSAGES.map((passage) => (
              <li key={passage.id}>
                <a className="text-accent" href={passage.url} target="_blank" rel="noreferrer">
                  {passage.title}
                </a>
                <p className="mt-1 text-muted">{passage.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs tracking-[0.18em] text-subtle uppercase">Ledger</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{FILE_LEDGER}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {VAULT.map((item) => (
              <li key={item.name} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-fg">{item.name}</span>
                <span className="text-right text-muted">
                  {item.size} · {item.state}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <h3 className="mt-8 text-xs font-medium tracking-[0.18em] text-subtle uppercase">Sealed, {sealed.length}</h3>
        <ul className="mt-3 flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
          {sealed
            .slice(-12)
            .reverse()
            .map((lesson) => (
              <li key={lesson.id} className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-fg">
                {lesson.text}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
