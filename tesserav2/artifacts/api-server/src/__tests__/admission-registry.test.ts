import { describe, it, expect } from "vitest";
import { evaluateCandidate } from "../lib/admission/gate";
import { SocietyRegistry, MemorySocietyStore, requireMember, type SocietyStore, type SocietyEntry } from "../lib/admission/registry";
import { DeterministicCouncil, evaluateCouncilDecision, type Council } from "../lib/admission/council";
import * as R from "../lib/admission/reference-agents";

const KEY = "attest-key";

describe("society registry", () => {
  it("admits an agent whose report is ADMIT, attested and council-approved", async () => {
    const reg = new SocietyRegistry({ attestationKey: KEY });
    const agent = R.honestAgent("good-1");
    const res = await reg.admit(agent, await evaluateCandidate(agent, { attestationKey: KEY }));
    expect(res.admitted).toBe(true);
    expect(reg.isMember("good-1", agent.manifestHash)).toBe(true);
    expect(() => requireMember(reg, "good-1")).not.toThrow();
  });

  it("refuses REJECT reports, forged verdicts, wrong keys and mismatched manifests", async () => {
    const reg = new SocietyRegistry({ attestationKey: KEY });
    const bad = R.sycophantAgent("bad-1");
    const badReport = await evaluateCandidate(bad, { attestationKey: KEY });
    expect((await reg.admit(bad, badReport)) as { reason: string }).toMatchObject({ admitted: false, reason: "verdict is REJECT" });
    expect(await reg.admit(bad, { ...badReport, verdict: "ADMIT" })).toMatchObject({ admitted: false, reason: "report attestation invalid" });

    const good = R.honestAgent("good-2");
    const unsigned = await evaluateCandidate(good);
    expect(await reg.admit(good, unsigned)).toMatchObject({ admitted: false, reason: "report attestation invalid" });

    const goodReport = await evaluateCandidate(good, { attestationKey: KEY });
    const swapped = { ...good, manifestHash: "different-artifact" };
    expect(await reg.admit(swapped, goodReport)).toMatchObject({ admitted: false });
    expect(reg.list()).toEqual([]);
  });

  it("refuses a report produced under a different policy version", async () => {
    const reg = new SocietyRegistry({ attestationKey: KEY, policyVersion: "other" });
    const agent = R.honestAgent("good-3");
    expect(await reg.admit(agent, await evaluateCandidate(agent, { attestationKey: KEY }))).toMatchObject({ admitted: false });
  });

  it("requires council approval bound to this exact report", async () => {
    const dissent: Council = new DeterministicCouncil([
      { name: "a", vote: () => ({ approve: true, reason: "ok" }) },
      { name: "b", vote: () => ({ approve: true, reason: "ok" }) },
      { name: "c", vote: () => ({ approve: false, reason: "motive concerns" }) },
    ]);
    const agent = R.honestAgent("good-4");
    const report = await evaluateCandidate(agent, { attestationKey: KEY });
    const r1 = new SocietyRegistry({ attestationKey: KEY, council: dissent });
    expect(await r1.admit(agent, report)).toMatchObject({ admitted: false });
    expect(r1.list()).toEqual([]);

    const replay: Council = {
      review: () => ({ subjectHash: "hash-of-some-other-report", votes: ["a", "b", "c"].map((seat) => ({ seat, approve: true, reason: "ok" })) }),
    };
    const r2 = new SocietyRegistry({ attestationKey: KEY, council: replay });
    expect(await r2.admit(agent, report)).toMatchObject({ admitted: false, reason: "decision is for a different subject" });

    const liar: Council = {
      review: (s) => ({ subjectHash: s.hash, votes: [{ seat: "only", approve: true, reason: "ok" }], approved: true } as never),
    };
    const r3 = new SocietyRegistry({ attestationKey: KEY, council: liar });
    expect(await r3.admit(agent, report)).toMatchObject({ admitted: false });
  });

  it("membership does not carry over to a changed artifact and revocation is permanent", async () => {
    const reg = new SocietyRegistry({ attestationKey: KEY });
    const agent = R.honestAgent("good-5");
    await reg.admit(agent, await evaluateCandidate(agent, { attestationKey: KEY }));
    expect(reg.isMember("good-5", "some-new-manifest")).toBe(false);
    expect(reg.revoke("good-5", "behaviour drift")).toBe(true);
    expect(reg.isMember("good-5")).toBe(false);
    expect(() => requireMember(reg, "good-5")).toThrow(/not an admitted member/);
    expect(await reg.admit(agent, await evaluateCandidate(agent, { attestationKey: KEY }))).toMatchObject({ admitted: false });
  });

  it("only writes through the injected store, and only after every check", async () => {
    const writes: SocietyEntry[][] = [];
    const inner = new MemorySocietyStore();
    const store: SocietyStore = { load: () => inner.load(), save: (e) => { writes.push([...e]); inner.save(e); } };
    const reg = new SocietyRegistry({ attestationKey: KEY, store });
    const bad = R.deceiverAgent("bad-2");
    await reg.admit(bad, await evaluateCandidate(bad, { attestationKey: KEY }));
    expect(writes).toHaveLength(0);
    const good = R.honestAgent("good-6");
    await reg.admit(good, await evaluateCandidate(good, { attestationKey: KEY }));
    expect(writes).toHaveLength(1);
  });

  it("evaluateCouncilDecision recomputes approval and rejects duplicate seats and thin quorum", () => {
    const votes = (n: number, dupe = false) => Array.from({ length: n }, (_, i) => ({ seat: dupe ? "x" : `s${i}`, approve: true, reason: "ok" }));
    expect(evaluateCouncilDecision({ subjectHash: "h", votes: votes(3) }, "h").approved).toBe(true);
    expect(evaluateCouncilDecision({ subjectHash: "h", votes: votes(2) }, "h").approved).toBe(false);
    expect(evaluateCouncilDecision({ subjectHash: "h", votes: votes(3, true) }, "h").approved).toBe(false);
    expect(evaluateCouncilDecision(null, "h").approved).toBe(false);
  });
});
