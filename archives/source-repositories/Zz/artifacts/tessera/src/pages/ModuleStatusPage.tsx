import { useLocation } from "wouter";
import { CircleOff } from "lucide-react";

type Props = { title: string };

function explanationFor(path: string): string {
  if (
    path === "/secret-society" ||
    path === "/bible" ||
    path === "/history"
  ) {
    return "This knowledge surface is inactive until its sources and privacy boundaries are reviewed. Private chart and vault content is not loaded.";
  }
  if (
    path === "/finance" ||
    path === "/income" ||
    path === "/ecom" ||
    path === "/lead-gen"
  ) {
    return "Commerce, income, and lead-generation actions are not enabled. No purchases, scraping, or autonomous financial activity run here.";
  }
  if (
    path === "/code-builder" ||
    path === "/build" ||
    path === "/auto-healer" ||
    path === "/rick" ||
    path === "/inventions"
  ) {
    return "Code execution, self-editing, repository writes, and publication are disabled on this page.";
  }
  return "This canonical module is preserved but inactive pending an individual safety and API review. No engine, external data source, or write action is active here.";
}

export default function ModuleStatusPage({ title }: Props) {
  const [location] = useLocation();
  const path = location.split("?")[0];

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center p-6">
      <section
        className="w-full space-y-3 rounded-xl border border-border bg-card/70 p-6"
        aria-labelledby="inactive-module-title"
        data-testid="inactive-module"
      >
        <div className="flex items-center gap-3 text-amber-300">
          <CircleOff className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-mono uppercase tracking-[0.18em]">
            Inactive
          </p>
        </div>
        <h1 id="inactive-module-title" className="text-xl font-semibold">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {explanationFor(path)}
        </p>
      </section>
    </main>
  );
}
