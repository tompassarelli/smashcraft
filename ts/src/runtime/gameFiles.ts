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
export const PHYSICS_REPORT_FILE = "smashcraft-native-physics-precision.txt";
export const objectDataReceiptFile = (slot: number) => `smashcraft-object-data-p${slot}.txt`;
