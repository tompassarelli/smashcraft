# Pad

- Scripted pad: `bun wisp pad SCRIPT --helper BINARY --build BUILD --out DIR
  --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]]` plays timed virtual-pad input
  through each client's real helper and reports the frame each edge landed on
  (script syntax: smashcraft:ts/scripts/integrity/padScript.ts). It copies
  fresh selected-pair setup receipts to `DIR/setup.json` before the first edge;
  missing chat entry or requested setup is INVALID at that client and boundary,
  with no input timeline started (Wisp's observed chat/command receipt helpers).
  the clients' input traces, scene reports and moments beside the result;
  captures require the requested frame in both drawn receipts, otherwise the
  run is INVALID with retained captures and the first failed boundary in its report
  (smashcraft:docs/native-bot-session.md, "Native checks by parity");
  a scripted quick match holds each requested pose locally through the capture
  while inputs and simulation continue; `held visual` images are not timing evidence;
  a desynced, crashed or early-ended run is INVALID and, with --map, rerun.
  `bun wisp pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT]
  [--compare NATIVE_DIR] [--render DIR --frames N... --graphics classic|definitive]` plays the same script through the same helper into
  headless integrity clients. `--render` draws the script captures after the
  session stops; `--frames` selects their comma-separated frame numbers.
  Repeat `--graphics classic --graphics definitive` to draw the same captured scenes in both profiles, in `DIR/classic` and `DIR/definitive`.
  Headless checks hold the script's capture frames even without `--render`,
  so brief spell cues are observed before play resumes.
  It passes a native run when checksums, fighter
  lines and the script's `#!` expectations match (smashcraft:docs/native-bot-session.md,
  "Native checks by parity"; issue scripts in smashcraft:ts/test/native/pads/).
  Comparisons preflight the existing View replay export before starting helpers
  or native sessions: hold at least 60 frames and release (normally 70), after
  the last capture to preserve authored action frames. Missing exports fail
  early; actual moments and checksum parity remain required.
  Several scripts are one batch, and the batch is how native parity runs:
  `bun wisp pad SCRIPT|DIR... --helper BINARY --out DIR --map MAP.w3x
  [--pairs N | --pair K... | --app-id a=ID --app-id b=ID]` starts ONE game per client pair,
  types `-dev reset` between scripts (a new game only after an invalid run;
  `--hot` also hot-reloads the current TypeScript before each script),
  runs every headless side alongside (`--headless-jobs N`) and compares as
  each native run ends; `--pairs N` (the first N) or `--pair K` (a share) shards over the offline LAN pool.
  Never loop `bun wisp fresh` + `bun wisp pad` per script (about a minute a
  script); `--fresh-each` exists only to measure that. `bun wisp pad
  SCRIPT|DIR... --headless ...` plays the same batch in one headless session
  (smashcraft:docs/native-bot-session.md, "Many scripts in one game"),
  beside `--headless-jobs` reference runs; each realtime process takes about
  1.1 cores (1.6 peak), so lease `heavy` with `--headless-jobs 2`: starved
  processes start scripts late ("helpers reported the match at frame N").

- Pad cut (#233): `bun scripts/nativePadCut233.ts --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --out DIR --app-id NAME=ID --app-id NAME=ID` uses one existing offline LAN pair, stops its own controller producer for 1 s, and checks the HUD waiting count and normal match results.

- Keyboard timing: `bun scripts/nativeKeyboardPad.ts --script FILE --helper WC3_CONTROLLER --out DIR --clients-file FILE --client NAME --app-id ID`; `--observe` validates the same SDL stimulus without keyboard output. It records the original physical 60 Hz deadlines on CLOCK_MONOTONIC, separately from native simulation frames; this is playable draw timing, while journal parity remains `bun wisp pad`. Export the response probe after capture.
