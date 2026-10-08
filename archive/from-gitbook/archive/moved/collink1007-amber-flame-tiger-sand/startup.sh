#!/bin/sh
set -eu
cd /workspace
node scripts/preview.mjs stop || true
if [ ! -f /tmp/tessera-worker.pid ] || ! kill -0 "$(cat /tmp/tessera-worker.pid)" 2>/dev/null; then
  setsid node /workspace/scripts/tessera-worker.mjs >>/tmp/tessera-worker.log 2>&1 </dev/null &
  echo $! >/tmp/tessera-worker.pid
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
