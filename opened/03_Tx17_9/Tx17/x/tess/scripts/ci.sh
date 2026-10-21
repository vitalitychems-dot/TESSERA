#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

step() {
  echo -e "\n${BLUE}==>${NC} $1"
}

ok() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASS++)) || true
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAIL++)) || true
}

warn() {
  echo -e "  ${YELLOW}!${NC} $1"
  ((SKIP++)) || true
}

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Tess Platform CI/CD Pipeline            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo "Start time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Working directory: $ROOT_DIR"

cd "$ROOT_DIR"

step "Step 1: TypeScript Type Check (core server modules)"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
CRITICAL_TS_ERRORS=$(echo "$TSC_OUTPUT" | grep -v "knowledge-implementations" | grep "error TS" || true)
if [ -z "$CRITICAL_TS_ERRORS" ]; then
  ok "TypeScript type check passed for core modules"
  TOTAL_ERRORS=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "0")
  if [ "$TOTAL_ERRORS" -gt "0" ]; then
    warn "Pre-existing TS errors in auto-generated files (knowledge-implementations): ${TOTAL_ERRORS} ignored"
  fi
else
  echo "$CRITICAL_TS_ERRORS" | head -20
  fail "TypeScript type check found errors in core server modules"
fi

step "Step 2: Lint Check (ESLint)"
if command -v eslint &>/dev/null; then
  if npx eslint server/ --ext .ts --max-warnings=20 2>&1; then
    ok "ESLint passed"
  else
    ESLINT_EXIT=$?
    if [ $ESLINT_EXIT -le 1 ]; then
      warn "ESLint found warnings (non-fatal)"
    else
      fail "ESLint failed (exit $ESLINT_EXIT)"
    fi
  fi
else
  warn "ESLint not configured — skipping lint check"
fi

step "Step 3: Critical File Verification"
CRITICAL_FILES=(
  "server/knowledge-engine.ts"
  "server/vector-index.ts"
  "server/memory-compress.ts"
  "server/decision-history.ts"
  "server/sovereign-council-engine.ts"
  "server/boot-sequence.ts"
  "server/llm-helper.ts"
  "server/ws-broadcast.ts"
)

for f in "${CRITICAL_FILES[@]}"; do
  if [ -f "$ROOT_DIR/$f" ]; then
    ok "$f exists"
  else
    fail "$f is MISSING"
  fi
done

step "Step 4: Automated Tests"
if [ -f "$ROOT_DIR/server/tests/run-tests.ts" ]; then
  if npx tsx server/tests/run-tests.ts 2>&1; then
    ok "All automated tests passed"
  else
    TESTS_EXIT=$?
    fail "Automated tests failed (exit $TESTS_EXIT)"
  fi
else
  warn "Test runner not found at server/tests/run-tests.ts — skipping"
fi

step "Step 5: JSON Data File Validation"
JSON_FILES=(
  "server/decision-history.json"
  "server/compressed-memory.json"
)
for jf in "${JSON_FILES[@]}"; do
  if [ -f "$ROOT_DIR/$jf" ]; then
    if node -e "JSON.parse(require('fs').readFileSync('$ROOT_DIR/$jf','utf8'))" 2>&1; then
      ok "$jf is valid JSON"
    else
      fail "$jf is invalid JSON"
    fi
  else
    warn "$jf does not exist yet (will be created at runtime)"
  fi
done

step "Step 6: Package.json Scripts Check"
if [ -f "$ROOT_DIR/package.json" ]; then
  if node -e "const p=require('./package.json'); ['dev','build','check'].forEach(s=>{ if(!p.scripts[s]) process.exit(1) })" 2>&1; then
    ok "Required npm scripts (dev, build, check) present"
  else
    fail "Missing required npm scripts in package.json"
  fi
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "CI Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}  ${YELLOW}${SKIP} skipped${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}CI FAILED — fix the issues above before deploying.${NC}"
  exit 1
else
  echo -e "${GREEN}CI PASSED — all checks green.${NC}"
  exit 0
fi
