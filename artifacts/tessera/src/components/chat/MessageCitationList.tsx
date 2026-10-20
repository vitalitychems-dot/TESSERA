import { parseMessageCitations } from "../../lib/message-citations";

const labels = {
  verified: "Verified source",
  unverified: "Unverified note",
  stale: "Outdated note",
};

export function MessageCitationList({ citations: value }: { citations: unknown }) {
  const citations = parseMessageCitations(value);
  if (citations.length === 0) return null;
  return (
    <details className="mt-3 min-w-0 rounded-lg border border-border bg-background/40 text-sm" data-testid="message-citations">
      <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        Sources ({citations.length})
      </summary>
      <ol className="space-y-3 px-3 pb-3">
        {citations.map((citation, index) => (
          <li key={`${citation.id}-${index}`} className="min-w-0 space-y-1 break-words" data-testid="message-citation">
            <p className="font-medium text-foreground">[{citation.idx}] {citation.source}</p>
            <p className="text-muted-foreground">{labels[citation.trustStatus]}</p>
            {citation.sourceUrl && (
              <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="block min-h-11 break-all py-2 text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {citation.sourceUrl}
              </a>
            )}
            {citation.publishedAt && <p className="text-muted-foreground">Published: {citation.publishedAt}</p>}
            {citation.retrievedAt && <p className="text-muted-foreground">Retrieved: {citation.retrievedAt}</p>}
            <p className="break-all text-muted-foreground">Record: {citation.documentReference}</p>
            {citation.trustNote && <p className="text-muted-foreground">{citation.trustNote}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
