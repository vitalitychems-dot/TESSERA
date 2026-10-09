import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export class DbUnavailableError extends Error {
  readonly code = "DB_NOT_CONFIGURED" as const;

  constructor() {
    super("database not configured");
    this.name = "DbUnavailableError";
  }
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

type Database = ReturnType<typeof drizzle<typeof schema>>;
type PoolFactory = (connectionString: string) => pg.Pool;

const defaultPoolFactory: PoolFactory = (connectionString) => new Pool({ connectionString });
let poolFactory: PoolFactory = defaultPoolFactory;
let poolSingleton: pg.Pool | undefined;
let dbSingleton: Database | undefined;

/**
 * Test seam. Production boot never calls this.
 * Pass null to restore `pg.Pool` and drop any cached client.
 */
export function setPoolFactoryForTests(factory: PoolFactory | null): void {
  poolFactory = factory ?? defaultPoolFactory;
  poolSingleton = undefined;
  dbSingleton = undefined;
}

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DbUnavailableError();
  }
  if (!poolSingleton) {
    poolSingleton = poolFactory(connectionString);
  }
  return poolSingleton;
}

export function getDb(): Database {
  if (!isDbConfigured()) {
    throw new DbUnavailableError();
  }
  if (!dbSingleton) {
    dbSingleton = drizzle(getPool(), { schema });
  }
  return dbSingleton;
}

function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      const real = resolve();
      const value: unknown = Reflect.get(real, prop, real);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(real);
      }
      return value;
    },
  });
}

const configuredAtLoad = isDbConfigured();

export const pool: pg.Pool = configuredAtLoad ? getPool() : lazyProxy(getPool);
export const db: Database = configuredAtLoad ? getDb() : lazyProxy(getDb);

export * from "./schema";
