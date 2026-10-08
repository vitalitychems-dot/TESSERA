import { createServer } from "node:http";
import app from "./interactive-app";
import { db } from "@workspace/db";
import { conversationsTable } from "@workspace/db/schema";
import { logger } from "./lib/logger";
import { installSovereignFetchGuard } from "./lib/sovereign-fetch-guard";

installSovereignFetchGuard();
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("A valid PORT is required.");
}

async function start() {
  await db.select({ id: conversationsTable.id }).from(conversationsTable).limit(1);
  const server = createServer(app);
  server.on("error", () => {
    logger.error("Tessera could not bind its configured port");
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Tessera interactive API ready; canonical engines and private-data modules inactive");
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
start().catch(() => {
  logger.error("Tessera startup failed: verify development schema and database connectivity");
  process.exit(1);
});
