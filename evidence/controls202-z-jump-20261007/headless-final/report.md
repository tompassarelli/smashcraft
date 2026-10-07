# #202 z-jump headless reference

7 October 2026. Gameplay source: `b4d7e208c933409cec84dbdb8ee8142048b1a57c`.
Integrity build: `typescript-integrity`. Helper: preset-aware `wc3-journal`
from `codex-controls202-r3-20261007/companion/target/debug/wc3-journal`.

Command, from `ts/`:

```sh
WC3_PAD_PRESET=z-jump bun wisp pad test/native/pads/controls/z-jump.pad \
  --headless \
  --helper ~/code/smashcraft/worktrees/codex-controls202-r3-20261007/companion/target/debug/wc3-journal \
  --out ../evidence/controls202-z-jump-20261007/headless-final
```

Passed in 22.15 seconds: 18 edges, 0 off their frame, 0 written late,
4 gameplay expectations passed. RB took off at frame 63 with short-hop
height `12.600`; LB+A started forward tilt (style 6) at frame 180 with
no dash through frame 187; B started a grab at frame 350 and caught the
other Archer at frame 355. The View export ends at frame 748.

The private native map was built from this same gameplay source at
`~/.local/share/smashcraft-private/zjump202-r3-20261007-b4d7e208/z-jump202.w3x`:
1,249 entries verified, 26.22 seconds. Native parity is recorded separately.
