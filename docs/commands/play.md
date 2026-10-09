# Play

- Playtest: `bun wisp play` builds current main (once per revision, however
  many plays start together) and goes from Tom's desktop to a match against a computer
  (smashcraft:docs/play.md). Experiments use `fresh`, captures or `accept`,
  with maps under Maps/00-Smashcraft/tests; play preserves two prior versions
  beside the latest correctly titled build and archives the rest under older/.
  The playable build plays on the keyboard alone, through Warcraft's own
  local keyboard sampling with two-frame delay and rollback (#60/#166);
  play starts no helper and never needs one.
  When the always-on controller service has a pad, the pad presses the same keys.

- Standalone play: `bun wisp play --standalone` opens the Wisp browser player
  with a full three-stock Illidan against Wren Expert Rifleman. `--script FILE`
  runs the native driver's exact pad inputs; `--headless --frames N --out DIR`
  saves frame checksums and captures (`--capture-frames N,N` picks their frames).
  `--presentation native|pool-confirmed|pool-predicted` selects fighter presentation;
  live play defaults to `pool-predicted`, scripts to `native`.
  `--four-fighters --frames 7200 --out DIR` is wisp#48's 60 FPS measurement
  (one game copy, four fighters; smashcraft:docs/play.md).
  Private map and Warcraft assets stay in the existing local asset store.

- Two processes over Wisp's transport: `bun wisp net pair --script PAD --frames N
  [--rtt MS] [--loss P]` plays the playable keyboard build, one slot per process:
  each process presses only its own pad's keys (pad a is slot 0, b slot 1), and
  Wisp's UDP lockstep carries them to both clients (wisp:docs/network-model.md).
  It prints each side's checksum agreement every 60 frames and delivery times;
  `--rtt`/`--loss` add Wisp's delay and loss proxy, `--freeze-at F` and
  `--quit-at F` drill a silent or departing joiner. `net host` and `net join
  ADDRESS:PORT` run one side each (wisp#110).
