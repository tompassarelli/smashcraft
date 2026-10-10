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

- Delay readout: `bun wisp integrity delay RUN_DIR...` prints, per client
  from the latest probe run's response pages under each directory
  (smashcraft:ts/scripts/integrity/delayReadout.ts, #396), p50 / p95 / max of:
  input delay (service callbacks from a press's `capture` row to its first
  `action` prediction); own echo (the frontier at an own edge row's `receive`
  minus the frontier at its `capture`); edge-row lateness (a remote edge
  row's `receive` frontier minus its frame); rollback depth (each `rollback`
  row); and cursor offset (this client's speculative frame after a service
  callback minus the other client's after the same callback, for two clients
  in one directory whose recordings both start at the epoch's first match
  callback). It also prints each epoch's agreed delay and requests (the
  `delay <epoch> <agreed> <requests>` row), window halts (`stall` rows) and
  the integrity, transport and edge rows dropped from the export. `pad` runs keep
  those pages beside their traces, but a pad run writes them only when the
  probe was started (Ctrl+G) and exported (Ctrl+H).
  The native-input build records each match epoch itself, from its first
  match callback for at most 6,000 callbacks, with `checksum` rows at
  confirmed frames 600, 1,200, … and at the window end; its pages carry an
  `epoch recorded=E incomplete=…` line naming epochs that began while a
  window was still recording or exporting.
