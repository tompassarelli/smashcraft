// Files the map and Waygate exchange through CustomMapData: names, limits and
// line formats. Map code imports this module, so it holds names and plain
// formatting only; Waygate decodes the files the game writes in
// smashcraft:ts/scripts/waygate/boundary.ts.

/** FileIO stores one chunk per tooltip level of its ability. */
export const CHUNKS_PER_FILE = 64;
/**
 * Bundle bytes per payload file. The file is raw Lua that stores them in one
 * tooltip; a 200,000-character tooltip read back intact in the game.
 */
export const PAYLOAD_FILE_BYTES = 200_000;
/** The FileIO ability ('$wsl') whose tooltips carry text from host files. */
export const FILE_IO_ABILITY = 0x2477736c;
/** Player slots that write their own copy of a per-slot file. */
export const FILE_SLOTS = 4;

// Preloader checks whether a file exists on every call but runs the content it
// first read from that path for the rest of the session
// (smashcraft:docs/warcraft-api-netcode-findings.md). So no name is reused for
// other content: manifests are numbered by a version that only rises and are never
// removed, and payload files are named by their bundle's checksum.
export const manifestFile = (version: number) => `smashcraft-hot-manifest-${version}.pld`;
/** Names a bundle in file names and as its Lua chunk name, which error positions carry. */
export const payloadKey = (payloadChecksum: string) => payloadChecksum.replace(":", "-");
export const payloadFile = (payloadChecksum: string, index: number) => `smashcraft-hot-${payloadKey(payloadChecksum)}-${index}.pld`;
export const ackFile = (slot: number) => `smashcraft-hot-ack-p${slot}.txt`;
export const errorFile = (slot: number) => `smashcraft-error-p${slot}.txt`;
/** Written once the local player's bindings are ready at character selection, by the TypeScript shell and the Wurst map alike. */
export const MELEE_READY_FILE = "wc3-melee-ready.txt";
/** Written when the developer input trace starts. */
export const INPUT_START_FILE = "wc3-melee-input-start.txt";
/** The developer input trace, written when it ends. */
export const INPUT_TRACE_FILE = "wc3-melee-input-trace.txt";

export interface Manifest {
  version: number;
  files: number;
  checksum: string;
}

export const formatManifest = ({ version, files, checksum }: Manifest) => `${version} ${files} ${checksum}`;

export function parseManifest(text: string): Manifest | undefined {
  const [versionText, filesText, checksum] = text.split(" ");
  const version = Number(versionText);
  const files = Number(filesText);
  // Comparisons are false for NaN, which rejects non-numeric fields.
  if (!(version >= 1) || !(files >= 1) || checksum === undefined) return undefined;
  return { version, files, checksum };
}

/** The acknowledgement: the version every client installed, at the reloader's game time in seconds. */
export const acknowledgementLine = (version: number, elapsed: number) => `applied ${version} at ${elapsed}`;
/** An error report's first line; the message and each stack line follow, one line each. */
export const errorHeading = (count: number, handler: string) => `error ${count} in ${handler}`;
export const traceStartLine = (build: string) => `TRACE START ${build}`;
/** The input trace's last two lines: lines dropped for space, then callbacks and native seconds traced. */
export const traceEndLines = (dropped: number, ticks: number, seconds: string) => [`dropped ${dropped}`, `${ticks} ${seconds} end`];
