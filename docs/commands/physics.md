# Physics

- Air drift: `bun scripts/airDrift.ts` prints every fighter's air speed,
  air acceleration, dash/run-jump takeoff speed and dash-jump cross-up;
  smashcraft:ts/scripts/airDrift.tests.ts holds them to the bands in
  smashcraft:docs/gameplay-design.md ("Air drift and jump momentum").
  Analog ingress diagnostics use `bun wisp map build --profile analog-keys`
  or `--profile analog-cursor`; both keep one fixed top-down camera and the
  keyboard rollback input path. Cursor calibration holds PageUp at grid cell
  (0,0), then PageDown at (127,127), with Home and End held, before match measurements.
  Each corner writes `smashcraft-pad-calibration-pSLOT.txt`; finished matches
  export `smashcraft-pad-ROUTE-eEPOCH-pSLOT.txt` with captured axes, pressures,
  payloads and mouse/input-sync event counts. The candidates are opt-in;
  the playable build still samples its usual keys.
  Home marks an armed pad; End commits a complete payload. While Home stays
  held and End is released for an update, capture retains the last complete
  pad row's axes and pressures. Focus loss or Home release clears that packet.
  `bun scripts/analogNative.ts --pair N --clients-file FILE --helper WC3_CONTROLLER
  --map MAP --route keys|cursor --out DIR --app-id NAME=ID --app-id NAME=ID`
  runs 20 normal one-stock matches on an already admitted LAN pair; `--plan`
  prints the setup without touching clients. It saves calibration clock anchors,
  helper submissions, injected command times and each match's complete input
  rows and event counts for the physical route comparison.
