# Native input integrity trial, 5 October 2026

The full two-client match/rematch capture completed with 648 required input
edges per player, all bound actions, helper/game stalls, pause/resume and
a persistent slot change. The integrity gates failed; final checksums matched.
The aggregate result and original observations are retained here unchanged.
The current claim table belongs to GitHub issue #26.

Candidate map: Smashcraft 0.0.42, build `playable-0042`, SHA256
`04bb068a143c3c80bb333c81cc3e36b74a5c8f6ece04970819080d9c00ca99cd`.
Map source: `a67a569`, with release version 0.0.42.
Capture driver source: `446e169`; repaired helper source: `f61afb0`
(cherry-picked from `ec157e1`). Helper SHA256:
`98b9f82bbda47aac870d8a5e4d5c37172bf40be91d647c79eb10c0629bd22055`.

`producer.jsonl` records the independent input timestamps; `kernel-*.jsonl`
and `helper-*.log` retain boundary observations. `capture.json` and
`events.json` record the native journey. `epoch-1/` and `epoch-2/` retain
native telemetry and final endpoints. `summary.json` is the reconciler output.

The map and proprietary base assets remain in private storage.
