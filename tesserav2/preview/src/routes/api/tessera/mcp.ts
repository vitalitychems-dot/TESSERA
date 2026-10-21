import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tessera/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMcp } = await import("@/lib/tessera/bridge");
        return handleMcp(request);
      },
    },
  },
});
