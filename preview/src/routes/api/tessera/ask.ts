import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tessera/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAsk } = await import("@/lib/tessera/bridge");
        return handleAsk(request);
      },
    },
  },
});
