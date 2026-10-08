#!/bin/sh
set -eu
cd /workspace
node scripts/preview.mjs stop || true
if [ ! -f /tmp/tessera-study.pid ] || ! kill -0 "$(cat /tmp/tessera-study.pid)" 2>/dev/null; then
  setsid node /workspace/scripts/study-step.mjs 6 >>/tmp/tessera-study.log 2>&1 </dev/null &
  echo $! >/tmp/tessera-study.pid
fi
if [ ! -f /tmp/tessera-worker.pid ] || ! kill -0 "$(cat /tmp/tessera-worker.pid)" 2>/dev/null; then
  setsid node /workspace/scripts/tessera-worker.mjs >>/tmp/tessera-worker.log 2>&1 </dev/null &
  echo $! >/tmp/tessera-worker.pid
fi
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8787/health; then
  if [ -x /workspace/data/pen/build/bin/llama-server ] && [ -f /workspace/data/pen/model-1.5b.gguf ]; then
    cd /workspace/data/pen/build/bin
    LD_LIBRARY_PATH=/workspace/data/pen/build/bin setsid ./llama-server -m /workspace/data/pen/model-1.5b.gguf --host 127.0.0.1 --port 8787 -c 1024 -t 2 --no-warmup >>/tmp/local-pen.log 2>&1 </dev/null &
    cd /workspace
  fi
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
