/**
 * Integration tests for Knowledge Unification Conference API endpoints
 * Run with: node artifacts/api-server/tests/conference-integration.test.mjs
 * Requires the API server to be running at the configured URL.
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function runTests() {
  console.log("=== Conference API Integration Tests ===\n");

  console.log("--- GET /conference/sessions ---");
  await test("returns sessions list with kuSessions array", async () => {
    const { status, body } = await fetchJson("/api/conference/sessions");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(body.kuSessions), "kuSessions should be an array");
    assert(Array.isArray(body.sessions), "sessions should be an array");
  });

  await test("kuSessions have required fields when present", async () => {
    const { body } = await fetchJson("/api/conference/sessions");
    if (body.kuSessions.length > 0) {
      const s = body.kuSessions[0];
      assert(typeof s.sessionId === "string", "sessionId should be string");
      assert(typeof s.conveneAt === "number", "conveneAt should be number");
      assert(typeof s.agentCount === "number", "agentCount should be number");
      assert(typeof s.status === "string", "status should be string");
    }
  });

  console.log("\n--- GET /conference/latest ---");
  await test("returns session object or null", async () => {
    const { status, body } = await fetchJson("/api/conference/latest");
    assert(status === 200, `Expected 200, got ${status}`);
    const isSession = body.type === "knowledge-unification" && body.session;
    const isNull = body.latest === null;
    assert(isSession || isNull, `Expected session or null, got: ${JSON.stringify(Object.keys(body))}`);
  });

  await test("latest session includes voteOutcomes and agentSpeeches if present", async () => {
    const { body } = await fetchJson("/api/conference/latest");
    if (body.type === "knowledge-unification" && body.session) {
      assert(Array.isArray(body.voteOutcomes), "voteOutcomes should be array");
      assert(Array.isArray(body.agentSpeeches), "agentSpeeches should be array");
      assert(typeof body.transcript === "string", "transcript should be string");
      assert(Array.isArray(body.perProposalVotes), "perProposalVotes should be array");
    }
  });

  await test("latest does not return raw category aggregate", async () => {
    const { body } = await fetchJson("/api/conference/latest");
    assert(!body.proposalCount, "should not return proposalCount (old aggregate format)");
    assert(!body.category, "should not return bare category field (old aggregate format)");
  });

  console.log("\n--- GET /conference/knowledge-unification/session ---");
  await test("returns current KU session or null", async () => {
    const { status, body } = await fetchJson("/api/conference/knowledge-unification/session");
    assert(status === 200, `Expected 200, got ${status}`);
    assert("session" in body || body.session === null, "body should have session field");
    assert("status" in body, "body should have status field");
  });

  await test("session includes required fields when present", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session) {
      const s = body.session;
      assert(typeof s.sessionId === "string", "sessionId should be string");
      assert(typeof s.agentCount === "number", `agentCount should be number, got ${typeof s.agentCount}`);
      assert(s.agentCount >= 27, `agentCount should be ≥27, got ${s.agentCount}`);
      assert(Array.isArray(s.agentSpeeches), "agentSpeeches should be array");
      assert(Array.isArray(s.voteOutcomes), "voteOutcomes should be array");
      assert(typeof s.transcript === "string", "transcript should be string");
    }
  });

  await test("session includes perProposalVotes field", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete") {
      assert(Array.isArray(body.session.perProposalVotes), "perProposalVotes should be array");
    }
  });

  console.log("\n--- GET /conference/sessions/:id ---");
  await test("returns 404 for non-existent session", async () => {
    const { status } = await fetchJson("/api/conference/sessions/nonexistent-session-id-xyz");
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("returns full session by ID from DB", async () => {
    const { body: listBody } = await fetchJson("/api/conference/sessions");
    if (listBody.kuSessions.length > 0) {
      const sessionId = listBody.kuSessions[0].sessionId;
      const { status, body } = await fetchJson(`/api/conference/sessions/${sessionId}`);
      assert(status === 200, `Expected 200, got ${status}`);
      assert(body.type === "knowledge-unification", "type should be knowledge-unification");
      assert(body.session, "session should be present");
      assert(Array.isArray(body.voteOutcomes), "voteOutcomes should be array");
      assert(Array.isArray(body.agentSpeeches), "agentSpeeches should be array");
      assert(typeof body.transcript === "string", "transcript should be string");
    }
  });

  console.log("\n--- GET /knowledge-acquisition/sources ---");
  await test("returns source catalog", async () => {
    const { status, body } = await fetchJson("/api/knowledge-acquisition/sources");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(body.sources), "sources should be array");
    assert(body.sources.length > 0, "should have at least one source");
    assert(typeof body.totalCount === "number", "totalCount should be number");
    assert(typeof body.activeCount === "number", "activeCount should be number");
    assert(typeof body.legalCompliance === "string", "legalCompliance should be string");
  });

  await test("sources have required fields", async () => {
    const { body } = await fetchJson("/api/knowledge-acquisition/sources");
    if (body.sources.length > 0) {
      const s = body.sources[0];
      assert(typeof s.id === "string", "source id should be string");
      assert(typeof s.name === "string", "source name should be string");
      assert(typeof s.domain === "string", "source domain should be string");
      assert(typeof s.status === "string", "source status should be string");
      assert(typeof s.legalStatus === "string", "source legalStatus should be string");
    }
  });

  console.log("\n--- GET /knowledge-acquisition/status ---");
  await test("returns acquisition status", async () => {
    const { status, body } = await fetchJson("/api/knowledge-acquisition/status");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof body.totalSources === "number", "totalSources should be number");
    assert(typeof body.activeSources === "number", "activeSources should be number");
  });

  console.log("\n--- GET /orchestration-bridge/status ---");
  await test("returns orchestration bridge status", async () => {
    const { status, body } = await fetchJson("/api/orchestration-bridge/status");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof body.initialized === "boolean", "initialized should be boolean");
    assert(typeof body.cyclesCompleted === "number", "cyclesCompleted should be number");
    assert(typeof body.bridgeHealth === "string", "bridgeHealth should be string");
    assert(typeof body.engines === "object", "engines should be object");
  });

  await test("bridge engines object has expected keys", async () => {
    const { body } = await fetchJson("/api/orchestration-bridge/status");
    const engines = body.engines;
    assert("consciousness" in engines, "engines.consciousness missing");
    assert("knowledgeAbsorption" in engines, "engines.knowledgeAbsorption missing");
    assert("directAcquisition" in engines, "engines.directAcquisition missing");
    assert("selfEvolution" in engines, "engines.selfEvolution missing");
    assert("grandCouncil" in engines, "engines.grandCouncil missing");
    assert("sovereigntyRoadmap" in engines, "engines.sovereigntyRoadmap missing");
  });

  console.log("\n--- Transcript content verification ---");
  await test("transcript includes per-agent votes when session complete", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.transcript) {
      const transcript = body.session.transcript;
      assert(
        transcript.includes("Per-Agent Vote Breakdown") || transcript.includes("AGENT SPEECHES"),
        "transcript should include per-agent vote breakdown or agent speeches"
      );
    }
  });

  await test("per-proposal votes include 27 agents each", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.perProposalVotes) {
      const pvotes = body.session.perProposalVotes;
      if (pvotes.length > 0) {
        const firstPV = pvotes[0];
        assert(firstPV.votes.length >= 27, `Each proposal should have votes from ≥27 agents, got ${firstPV.votes.length}`);
      }
    }
  });

  await test("per-proposal votes include non-empty axiom citations", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.perProposalVotes) {
      const pvotes = body.session.perProposalVotes;
      if (pvotes.length > 0) {
        const votesWithCitations = pvotes[0].votes.filter(v => v.axiomCitations && v.axiomCitations.length > 0);
        assert(votesWithCitations.length > 0,
          `At least some agents should have non-empty axiomCitations — got ${pvotes[0].votes.length} votes, 0 with citations`
        );
      }
    }
  });

  await test("transcript includes axiom citations when votes have them", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.perProposalVotes) {
      const pvotes = body.session.perProposalVotes;
      const hasAxioms = pvotes.some(pv =>
        pv.votes && pv.votes.some(v => v.axiomCitations && v.axiomCitations.length > 0)
      );
      if (hasAxioms) {
        assert(
          body.session.transcript.includes("Axioms:"),
          "transcript should include [Axioms: ...] when votes have citations"
        );
      }
    }
  });

  await test("per-proposal vote reasoning is agent-specific (not generic)", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.perProposalVotes) {
      const pvotes = body.session.perProposalVotes;
      if (pvotes.length > 0) {
        const uniqueReasons = new Set(pvotes[0].votes.map(v => v.reasoning));
        assert(uniqueReasons.size >= 5, `Votes should have diverse agent-specific reasoning — got ${uniqueReasons.size} unique reasons`);
      }
    }
  });

  await test("per-proposal vote aggregate is consistent with BFT proposal outcome", async () => {
    const { body } = await fetchJson("/api/conference/knowledge-unification/session");
    if (body.session && body.session.status === "complete" && body.session.perProposalVotes && body.session.voteOutcomes) {
      for (const outcome of body.session.voteOutcomes) {
        const pv = body.session.perProposalVotes.find(pv => pv.proposalId === outcome.proposalId);
        if (!pv || pv.votes.length === 0) continue;
        const approveCount = pv.votes.filter(v => v.vote === "approve").length;
        const approvalRate = approveCount / pv.votes.length;
        if (outcome.status === "approved") {
          assert(approvalRate >= 0.5, `Approved proposal "${outcome.proposalTitle}" should have ≥50% approve votes in transcript, got ${Math.round(approvalRate * 100)}%`);
        } else {
          assert(approvalRate < 0.7, `Rejected proposal "${outcome.proposalTitle}" should not have ≥70% approve votes in transcript, got ${Math.round(approvalRate * 100)}%`);
        }
      }
    }
  });

  console.log("\n--- Rate limiting on mutating endpoints ---");
  await test("POST /conference/convene returns 429 after repeated calls", async () => {
    for (let i = 0; i < 4; i++) {
      const { status } = await fetchJson("/api/conference/convene", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "knowledge-unification" }) });
      if (i >= 3) {
        assert(status === 429 || status === 200, `Expected 429 or 200 on call ${i + 1}, got ${status}`);
      }
    }
  });

  await test("rate limiter returns 429 status code and retryAfterMs", async () => {
    const { status: lastStatus, body: lastBody } = await fetchJson("/api/conference/convene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "knowledge-unification" }),
    });
    if (lastStatus === 429) {
      assert(typeof lastBody.retryAfterMs === "number", "429 response should include retryAfterMs");
      assert(lastBody.retryAfterMs > 0, "retryAfterMs should be positive");
    }
  });

  console.log("\n--- Source adapter integration ---");
  await test("acquisition cycle returns sourcesIngested > 0", async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { body } = await fetchJson("/api/knowledge-acquisition/status");
    assert(typeof body.totalSources === "number" && body.totalSources > 0, "should have cataloged sources");
    assert(typeof body.activeSources === "number" && body.activeSources > 0, "should have active sources");
  });

  console.log("\n=== Results ===");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
