# Eye-tracking (gaze) design note: not built

Status: design only. No capture code exists. Build only if Father asks for it.

- Opt-in only: flag `TESSERA_ENABLE_GAZE`, default `0`. With 0, no camera is opened and no gaze code is loaded.
- Local open-source library only (for example WebGazer.js or MediaPipe Face Mesh iris landmarks), running in the browser on his device.
- On-device: frames are never stored or uploaded; only coarse per-message signals (dwell on a reply section, re-read count) are kept, in the same private directory as the creator corpus.
- Hard off switch: a visible camera indicator and one-click stop that releases the camera; turning the flag off deletes the gaze signals.
- "What excites him" stays a hypothesis scored against what he then approves; it never overrides his typed words.
