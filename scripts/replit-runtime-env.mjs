// Replit launch adapter only. Never log or persist credential values.
// The canonical API requires this dedicated name for production cookie signing.
// Preserve an explicitly configured sovereign secret; otherwise use the secure
// session secret already provisioned for this project.
if (!process.env.SOVEREIGN_SESSION_SECRET && process.env.SESSION_SECRET) {
  process.env.SOVEREIGN_SESSION_SECRET = process.env.SESSION_SECRET;
}

// Managed service routing must not silently move to a different port.
process.env.TESSERA_PORT_FALLBACK = "0";

// Gitbook launch policy: these capabilities remain disabled.
process.env.TESSERA_ENABLE_RICK_LOOP = "0";
process.env.TESSERA_ENABLE_COLONIAL_FALLBACK = "0";

// Before owner provisioning, keep the canonical fail-closed setup gate available
// without starting database-backed autonomous modules or their route watchdog.
// This affects this process only: the managed database and its secret are intact.
if ((process.env.TESSERACT_ADMIN_KEY ?? "").trim().length < 16) {
  delete process.env.DATABASE_URL;
}
