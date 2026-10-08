#!/bin/sh
set -eu

APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$APP_ROOT"
: "${PORT:=23518}"

node scripts/preview.mjs stop || true

node scripts/study-step.mjs 6 &
STUDY_PID=$!
node scripts/tessera-worker.mjs &
WORKER_PID=$!
node scripts/run-tool.mjs connect-notes || true

node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port "$PORT" &
SERVER_PID=$!

cleanup() {
  trap - EXIT INT TERM
  for child in "$SERVER_PID" "$WORKER_PID" "$STUDY_PID"; do
    kill -TERM "$child" 2>/dev/null || true
  done
  for child in "$SERVER_PID" "$WORKER_PID" "$STUDY_PID"; do
    wait "$child" 2>/dev/null || true
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
wait "$SERVER_PID"
