import { pool } from "@workspace/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import path from "path";

const log = (msg: string) => console.log(`[DBMigrate] ${msg}`);

export async function runBootstrapMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, "migrations");
  log(`Running database migrations from ${migrationsFolder}...`);
  try {
    const migrationDb = drizzle(pool);
    await migrate(migrationDb, { migrationsFolder });
    log("Database migrations complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Migration error: ${msg}`);
    throw err;
  }
}
