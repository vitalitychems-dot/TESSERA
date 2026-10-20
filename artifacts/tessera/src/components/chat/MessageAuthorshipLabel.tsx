import { parseChatAuthorship } from "../../lib/chat-authorship";

export function formatMessageAuthorship(value: unknown): string {
  const authorship = parseChatAuthorship(value);
  if (!authorship) return "Legacy / unknown";

  switch (authorship.authorRole) {
    case "model-authored":
      return authorship.model
        ? `Model reply · ${authorship.model}`
        : "Model reply · model name unavailable";
    case "model-drafting":
      return authorship.model
        ? `Model draft · ${authorship.model}`
        : "Model draft · model name unavailable";
    case "local":
      return `Local response · ${authorship.author}`;
    case "local-fallback":
      return `Local fallback · ${authorship.author}`;
    case "application-result":
      return `Application result · ${authorship.author}`;
    case "unattributed":
      return "Unattributed · provider/model not reported";
  }
}

export function MessageAuthorshipLabel({ authorship }: { authorship?: unknown }) {
  const label = formatMessageAuthorship(authorship);
  return (
    <span
      className="block break-all text-[11px] leading-relaxed text-muted-foreground"
      title={label}
      aria-label={`Reply authorship: ${label}`}
      data-testid="message-authorship"
    >
      {label}
    </span>
  );
}
