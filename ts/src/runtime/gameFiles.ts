// Files for Smashcraft's selection, developer commands and input capture.
export const devCommandReceiptFile = (build: string, slot: number) => `smashcraft-dev-${build}-p${slot}.txt`;
export const MELEE_READY_FILE = "wc3-melee-ready.txt";
export const INPUT_START_FILE = "wc3-melee-input-start.txt";
export const INPUT_TRACE_FILE = "wc3-melee-input-trace.txt";
export const traceStartLine = (build: string) => `TRACE START ${build}`;
export const traceEndLines = (dropped: number, ticks: number, seconds: string) => [`dropped ${dropped}`, `${ticks} ${seconds} end`];
