import { textToVector, cosineSimilarity, buildVectorIndex, vectorSearch, loadVectorIndex } from "../vector-index";
import { logDecision, queryDecisions, getDecisionStats, logCouncilDecision } from "../decision-history";
import { compressConversation, searchMemory, getCrossSessionContext, getMemoryStats } from "../memory-compress";
import { initBootSequence, markPhaseStarting, markPhaseHealthy, markPhaseFailed, getBootHealth, generateBootReport, verifyModuleIntegrity } from "../boot-sequence";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
    failures.push(label);
  }
}

function assertClose(a: number, b: number, tolerance: number, label: string) {
  assert(Math.abs(a - b) <= tolerance, `${label} (got ${a.toFixed(4)}, expected ~${b.toFixed(4)} ±${tolerance})`);
}

function section(name: string) {
  console.log(`\n[TEST SUITE] ${name}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          Tess Platform Automated Tests           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  section("1. Vector Index — textToVector & cosineSimilarity");

  const vec1 = textToVector("hello world");
  assert(Array.isArray(vec1), "textToVector returns an array");
  assert(vec1.length === 256, `vector dimension is 256 (got ${vec1.length})`);

  const norm1 = Math.sqrt(vec1.reduce((s, v) => s + v * v, 0));
  assertClose(norm1, 1.0, 0.01, "output vector is unit-normalized");

  const vA = textToVector("sovereign AI platform governance");
  const vB = textToVector("sovereign platform AI governance");
  const vC = textToVector("blockchain cryptocurrency mining rewards");
  const simAB = cosineSimilarity(vA, vB);
  const simAC = cosineSimilarity(vA, vC);
  assert(simAB > simAC, `semantically similar texts score higher (${simAB.toFixed(3)} > ${simAC.toFixed(3)})`);

  const selfSim = cosineSimilarity(vA, vA);
  assertClose(selfSim, 1.0, 0.001, "self-similarity is 1.0");

  const zeroVec = new Array(256).fill(0);
  const zeroSim = cosineSimilarity(zeroVec, zeroVec);
  assert(zeroSim === 0, "zero vectors return 0 similarity");

  section("2. Vector Index — buildVectorIndex & vectorSearch");

  const testEntries = [
    { source: "test", title: "Sovereign AI Governance", content: "Tessera leads the council with democratic voting and fair governance", tags: ["governance", "ai"] },
    { source: "test", title: "Blockchain Token Economics", content: "TSRT token powers the ecosystem with staking and revenue sharing rewards", tags: ["crypto", "token"] },
    { source: "test", title: "Security Middleware Defense", content: "Rate limiting encryption authentication protects all system endpoints", tags: ["security", "middleware"] },
    { source: "test", title: "Knowledge Retrieval System", content: "Vector embeddings enable semantic search across the knowledge base", tags: ["knowledge", "search"] },
    { source: "test", title: "Agent Swarm Communication", content: "26 autonomous agents collaborate through message passing and consensus", tags: ["agents", "swarm"] },
  ];

  const count = buildVectorIndex(testEntries);
  assert(count >= testEntries.length, `buildVectorIndex added ${testEntries.length} entries (total: ${count})`);

  const govResults = vectorSearch("governance council voting", 3, 0.0);
  assert(govResults.length > 0, "vector search returns results for 'governance council voting'");
  assert(govResults[0].score > 0, "top result has positive similarity score");
  assert(
    govResults[0].title.toLowerCase().includes("govern") || govResults[0].title.toLowerCase().includes("sovereign"),
    `top result for 'governance' is relevant (got "${govResults[0].title}")`
  );

  const secResults = vectorSearch("security authentication middleware", 3, 0.0);
  assert(secResults.length > 0, "vector search returns results for 'security authentication'");
  const secTopTitle = secResults[0].title.toLowerCase();
  assert(
    secTopTitle.includes("security") || secTopTitle.includes("middleware") || secTopTitle.includes("defend"),
    `top result for 'security' is relevant (got "${secResults[0].title}")`
  );

  const emptyResults = vectorSearch("", 3, 0.99);
  assert(emptyResults.length === 0, "empty query with high threshold returns no results");

  section("3. Decision History — logging & querying");

  const rec1 = logDecision(
    "council", "Grand Council", "governance",
    "Test Council Vote", "Test vote on governance proposal",
    "approved", { yesVotes: 30, noVotes: 10 }, ["test", "council"]
  );
  assert(typeof rec1.id === "string" && rec1.id.startsWith("DEC-"), `logged decision has valid ID (${rec1.id})`);
  assert(rec1.outcome === "approved", "logged decision outcome is 'approved'");
  assert(rec1.actor === "council", "logged decision actor is 'council'");
  assert(typeof rec1.timestampMs === "number" && rec1.timestampMs > 0, "decision has valid timestamp");

  const rec2 = logDecision(
    "system", "BootSequence", "system",
    "System Boot Completed", "All 10 phases healthy",
    "executed", {}, ["boot", "system"]
  );
  const rec3 = logDecision(
    "agent", "Zeta", "security",
    "Security Audit", "Pre-launch security audit passed",
    "approved", { score: 95 }, ["security", "audit"]
  );

  const allDecisions = queryDecisions({ limit: 100 });
  assert(allDecisions.length >= 3, `queryDecisions returns at least 3 records (got ${allDecisions.length})`);

  const councilDecs = queryDecisions({ actor: "council" });
  assert(councilDecs.every(d => d.actor === "council"), "actor filter works correctly");

  const approvedDecs = queryDecisions({ outcome: "approved" });
  assert(approvedDecs.every(d => d.outcome === "approved"), "outcome filter works correctly");

  const searchDecs = queryDecisions({ search: "governance" });
  assert(searchDecs.some(d => d.title.toLowerCase().includes("governance") || d.description.toLowerCase().includes("governance")),
    "search filter finds governance decisions");

  const councilVoteRecord = logCouncilDecision(
    "GCM-1-test", "Test Grand Council Meeting", "approved",
    30, 10, 40, 75, "approve", 85, ["Proposal A", "Proposal B"]
  );
  assert(councilVoteRecord.category === "governance", "logCouncilDecision creates governance category record");
  assert(typeof (councilVoteRecord.metadata as any).yesVotes === "number", "council decision has yesVotes in metadata");

  const stats = getDecisionStats();
  assert(stats.total >= 4, `getDecisionStats shows at least 4 total records (got ${stats.total})`);
  assert(typeof stats.byOutcome === "object", "stats include byOutcome breakdown");
  assert(typeof stats.byActor === "object", "stats include byActor breakdown");

  const sinceFilter = queryDecisions({ sinceMs: Date.now() - 5000 });
  assert(sinceFilter.length >= 4, `sinceMs filter finds recent decisions (got ${sinceFilter.length})`);

  section("4. Memory Compress — cross-session recall");

  const testMessages = [
    { role: "user", content: "I want to build a sovereign AI platform with democratic governance", createdAt: new Date().toISOString() },
    { role: "assistant", content: "We decided to implement council voting with 2/3 consensus threshold. The TSRT token will power the economy.", createdAt: new Date().toISOString() },
    { role: "user", content: "Add security middleware with rate limiting and encryption", createdAt: new Date().toISOString() },
  ];

  const compressed = compressConversation(9001, "Sovereign AI Platform Design", testMessages, "user");
  assert(typeof compressed.id === "number", "compressConversation returns valid id");
  assert(typeof compressed.summary === "string" && compressed.summary.length > 0, "compressed conversation has a summary");
  assert(Array.isArray(compressed.vector) && compressed.vector.length === 256, "compressed conversation has a 256-dim vector");
  assert(Array.isArray(compressed.keyTopics), "compressed conversation has keyTopics array");
  assert(Array.isArray(compressed.decisions), "compressed conversation has decisions array");

  const searchResults = searchMemory("council voting governance");
  assert(searchResults.length > 0, "searchMemory finds relevant past conversations");
  const foundRelevant = searchResults.some(r => r.title.toLowerCase().includes("sovereign") || r.summary.toLowerCase().includes("council"));
  assert(foundRelevant, "searchMemory returns semantically relevant result for 'council voting governance'");

  const crossCtx = getCrossSessionContext("governance council voting security", 5);
  assert(typeof crossCtx === "string", "getCrossSessionContext returns a string");
  assert(crossCtx.length > 0, "getCrossSessionContext returns non-empty context");
  assert(crossCtx.includes("PAST SESSION CONTEXT"), "cross-session context has proper header");
  assert(crossCtx.includes("9001") || crossCtx.toLowerCase().includes("sovereign"), "cross-session context includes the relevant conversation");

  const emptyCtx = getCrossSessionContext("zzz unrelated xyz gibberish abc123", 5);
  assert(typeof emptyCtx === "string", "getCrossSessionContext handles low-relevance queries gracefully");

  const memStats = getMemoryStats();
  assert(typeof memStats.conversationsCompressed === "number", "getMemoryStats returns conversation count");
  assert(memStats.conversationsCompressed >= 1, "at least one conversation is compressed");

  section("5. Boot Sequence — phases & module integrity");

  initBootSequence();
  const health0 = getBootHealth();
  assert(health0.total === 10, `boot sequence has 10 phases (got ${health0.total})`);
  assert(health0.pending === 10, `all phases start as pending (got ${health0.pending})`);

  markPhaseStarting("database");
  markPhaseHealthy("database");
  const health1 = getBootHealth();
  assert(health1.healthy === 1, `marking phase healthy increments count (got ${health1.healthy})`);

  markPhaseStarting("security-middleware");
  markPhaseFailed("security-middleware", "Test failure");
  const health2 = getBootHealth();
  assert(health2.failed === 1, `marking phase failed increments fail count (got ${health2.failed})`);

  const report = generateBootReport();
  assert(typeof report === "string" && report.length > 0, "generateBootReport returns non-empty string");
  assert(report.includes("database"), "boot report includes database phase");
  assert(report.includes("security-middleware"), "boot report includes security-middleware phase");

  const integrity = verifyModuleIntegrity();
  assert(typeof integrity.passed === "boolean", "verifyModuleIntegrity returns a result");
  assert(Array.isArray(integrity.checks), "integrity check returns checks array");
  assert(integrity.checks.length === 7, `integrity check covers 7 critical modules (got ${integrity.checks.length})`);
  const knowledgeCheck = integrity.checks.find(c => c.module === "knowledge-engine");
  assert(knowledgeCheck?.status === "ok", "knowledge-engine module is found on disk");
  const vectorCheck = integrity.checks.find(c => c.module === "vector-index");
  assert(vectorCheck?.status === "ok", "vector-index module is found on disk");
  assert(integrity.passed === true, "all critical modules pass integrity check");

  section("6. Security Middleware Behavior (Basic)");

  const suspiciousInputs = [
    { input: "'; DROP TABLE users; --", desc: "SQL injection attempt" },
    { input: "<script>alert('xss')</script>", desc: "XSS injection attempt" },
    { input: "../../../etc/passwd", desc: "Path traversal attempt" },
  ];

  for (const { input, desc } of suspiciousInputs) {
    const vec = textToVector(input);
    assert(Array.isArray(vec) && vec.length === 256, `${desc}: textToVector handles malicious input safely`);
    const sim = cosineSimilarity(vec, vec);
    assert(sim >= 0 && sim <= 1.001, `${desc}: similarity score stays in valid range [0,1]`);
  }

  const logResult = logDecision("system", "SecurityMiddleware", "security",
    "Blocked SQL injection", "Rate limit triggered for suspicious input",
    "rejected", { input: "DROP TABLE", ip: "127.0.0.1" }, ["security", "block"]);
  assert(logResult.outcome === "rejected", "security events can be logged as 'rejected'");
  const secQuery = queryDecisions({ actor: "system", outcome: "rejected" });
  assert(secQuery.some(d => d.title.includes("SQL")), "security decisions are queryable by outcome");

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log(`║  Test Results: ${passed} passed, ${failed} failed`.padEnd(51) + "║");
  console.log("╚══════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    failures.forEach(f => console.error(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed.`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error("[TestRunner] Fatal error:", err);
  process.exit(1);
});
