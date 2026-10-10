# Integrity

- Parity: `bun wisp parity numeric` compares the numeric corpus with both Lua32s;
  `bun wisp integrity capture --screen --clients-file FILE --client NAME --out PRIVATE_DIR [--count N] [--region X,Y,WIDTH,HEIGHT]`
  measures serial framebuffer acquisition on the input stimulus clock and saves
  actual pixels privately (smashcraft:docs/native-bot-session.md). Its cadence
  sample is preparation for response measurements, with no latency pass result.
  `bun wisp integrity capture ...` runs native input-integrity capture and
  `bun wisp integrity result DIR` reconciles its output. `bun wisp integrity
  headless --helper BIN --out DIR` runs the same capture through the real
  helper (built with `--text-out`) into headless clients, then reconciles it.
  `bun wisp integrity capture|result|headless` owns native input sessions; numeric parity
  and replay tapes stay under `parity`.

- Native journeys: `bun wisp integrity capture --four-fighters` runs #17's
  four-fighter match (smashcraft:docs/native-four-fighters.md);
  `bun wisp integrity capture --playable` runs a playable candidate's one-stock
  match and rematch (smashcraft:docs/playable-0047.md).
  `bun wisp integrity result DIR` reconciles either session from its recorded kind.

- Delay readout: `bun wisp integrity delay RUN_DIR...` prints input delay
  (service callbacks from a press's `capture` row to its first `action`
  prediction) and rollback depth, p50 / p95 / max, per client from the
  latest probe run's response pages under each directory
  (smashcraft:ts/scripts/integrity/delayReadout.ts, #396). `pad` runs keep
  those pages beside their traces, but a pad run writes them only when the
  probe was started (Ctrl+G) and exported (Ctrl+H).
