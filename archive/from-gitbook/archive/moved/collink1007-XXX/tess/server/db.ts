import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function createPool(): pg.Pool {
  const maxConnections = parseInt(process.env.DB_POOL_MAX || "15", 10);
  const minConnections = parseInt(process.env.DB_POOL_MIN || "3", 10);

  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    min: minConnections,
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxUses: 7500,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });

  p.on("error", (err) => {
    console.error("[DB] Pool error:", err.message);
  });

  p.on("connect", () => {
    poolStats.totalConnections++;
  });

  p.on("remove", () => {
    poolStats.totalConnections = Math.max(0, poolStats.totalConnections - 1);
  });

  return p;
}

const poolStats = {
  totalConnections: 0,
  totalQueries: 0,
  failedQueries: 0,
};

export function getPoolStats() {
  return {
    ...poolStats,
    waiting: pool.waitingCount,
    idle: pool.idleCount,
    total: pool.totalCount,
  };
}

async function connectWithRetry(p: pg.Pool): Promise<pg.Pool> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await p.connect();
      client.release();
      console.log(`[DB] Connected successfully on attempt ${attempt}`);
      return p;
    } catch (err) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(
        `[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}. Retrying in ${delay}ms...`,
      );
      if (attempt === MAX_RETRIES) {
        console.error(`[DB] All ${MAX_RETRIES} connection attempts failed.`);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("[DB] Exhausted all retry attempts");
}

export const pool = createPool();

connectWithRetry(pool).catch((err) => {
  console.error("[DB] Fatal: Unable to connect to database after retries:", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });
