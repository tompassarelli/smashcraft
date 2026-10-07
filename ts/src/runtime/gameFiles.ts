// Files for Smashcraft's selection, developer commands and input capture.
export const devCommandReceiptFile = (build: string, slot: number) => `smashcraft-dev-${build}-p${slot}.txt`;
export const MELEE_READY_FILE = "wc3-melee-ready.txt";
export const INPUT_START_FILE = "wc3-melee-input-start.txt";
export const INPUT_TRACE_FILE = "wc3-melee-input-trace.txt";
export const traceStartLine = (build: string) => `TRACE START ${build}`;
export const traceEndLines = (dropped: number, ticks: number, seconds: string) => [`dropped ${dropped}`, `${ticks} ${seconds} end`];

export const journalControlFile = (build: string, epoch: number, slot: number, sequence: number | "*") => `smashcraft-journal-control-${build}-e${epoch}-s${slot}-n${sequence}.txt`;
export const journalLifecycleFile = (build: string, epoch: number, slot: number, kind: "start" | "end") => `smashcraft-journal-${kind}-${build}-e${epoch}-s${slot}.txt`;
export const journalReadyFile = (build: string, epoch: number, slot: number) => `smashcraft-journal-ready-${build}-e${epoch}-p${slot}.txt`;
export const journalMenuFile = (build: string, slot: number) => `smashcraft-journal-menu-${build}-s${slot}.txt`;
export const journalTransportReadyFile = (build: string, epoch: number, slot: number) => `smashcraft-journal-transport-ready-${build}-e${epoch}-p${slot}.txt`;
export const journalFailureFile = (build: string, epoch: number, slot: number) => `smashcraft-journal-failure-${build}-e${epoch}-p${slot}.txt`;
export const responsePageFile = (slot: number | "*", run: number | "*", page: number | "*") => `smashcraft-response-p${slot}-run${run}-page${page}.txt`;
export const edgeStampFile = (slot: number, run: number, row: number, stage: "poll" | "present") => `smashcraft-edge-p${slot}-run${run}-row${row}-${stage}.txt`;
export const frameCostFile = (source: string, slot: number, language: "typescript" | "wurst") => `smashcraft-frame-cost-${source}-p${slot}-${language}.txt`;
export const frameCostClockFile = (slot: number) => `smashcraft-frame-cost-clock-p${slot}.txt`;
export const renderClockFile = (slot: number, run: number) => `smashcraft-render-clock-p${slot}-run${run}.txt`;
export const PHYSICS_REPORT_FILE = "smashcraft-native-physics-precision.txt";
export const objectDataReceiptFile = (slot: number) => `smashcraft-object-data-p${slot}.txt`;
/** A playtest request the host leaves for the map, its go-ahead, and each client's receipt (smashcraft:ts/src/platform/shell/playtest.ts). */
export const PLAYTEST_REQUEST_FILE = "smashcraft-play.txt";
export const PLAYTEST_GO_FILE = "smashcraft-play-go.txt";
export const playtestReceiptFile = (slot: number) => `smashcraft-play-p${slot}.txt`;
/** The stage a match drew, written at its start by builds with the dev console, so a capture checks the player's view only after it. */
export const stageReceiptFile = (build: string, slot: number) => `smashcraft-stage-${build}-p${slot}.txt`;
/** The record of this client's `serial`th finished match for the Smashcraft client (smashcraft:ts/src/game/shell/matchRecord.ts); serials count across sessions. */
export const matchRecordFile = (serial: number) => `smashcraft-match-${serial}.txt`;
/** A replay's manifest, written at its match's end, and its parts, written during the match (smashcraft:ts/src/game/replay/matchReplay.ts). */
export const replayFile = (serial: number) => `smashcraft-replay-${serial}.txt`;
export const replayPartFile = (serial: number, part: number) => `smashcraft-replay-${serial}-${part}.txt`;
/** Holds the next match record's serial, as one FileIO chunk. */
export const MATCH_RECORD_INDEX_FILE = "smashcraft-match-index.pld";
