import { describe, expect, it } from "vitest";
import { getOperationalStatus } from "../routes/operational-status";

describe("operational status", () => {
  const fixed = () => new Date("2026-10-19T20:00:00.000Z");

  it("reports unconfigured database and does not overstate model or worker health", async () => {
    const status = await getOperationalStatus({ databaseConfigured: false, now: fixed });
    expect(status.checkedAt).toBe("2026-10-19T20:00:00.000Z");
    expect(status.api.state).toBe("available");
    expect(status.database.state).toBe("not-configured");
    expect(status.model.state).toBe("unverified");
    expect(status.worker.state).toBe("unverified");
  });

  it("reports only the result of the injected live database probe", async () => {
    const available = await getOperationalStatus({ databaseConfigured: true, probeDatabase: async () => undefined, now: fixed });
    expect(available.database.state).toBe("available");
    const unavailable = await getOperationalStatus({ databaseConfigured: true, probeDatabase: async () => { throw new Error("secret connection details"); }, now: fixed });
    expect(unavailable.database.state).toBe("unavailable");
    expect(JSON.stringify(unavailable)).not.toContain("secret connection details");
    expect(unavailable.model.state).toBe("unverified");
    expect(unavailable.worker.state).toBe("unverified");
  });
});
