// A replay's files (smashcraft:docs/design/client.md, "Full-match replays"):
// the parts the map writes during a match, the manifest it writes last, and
// the joined replay made of them. Kept apart from the simulation so the
// client reads any version's files with its own code.
import { type Repro, parseRepro, reproLines } from "wisp/src/runtime/repro";

/** A count's decimal digits, or undefined. */
function wholeNumber(text: string | undefined): number | undefined {
  if (text === undefined || text.length === 0 || text.length > 9) return undefined;
  let value = 0;
  for (let index = 0; index < text.length; index++) {
    const digit = text.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) return undefined;
    value = value * 10 + digit;
  }
  return value;
}

/** What a finished replay's manifest names. */
export interface ReplayManifest {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  readonly frame: number;
  readonly checksum: string;
  readonly parts: number;
}

const PART_HEADER = "smashcraft-replay-part";
const MANIFEST_WORD = "replay";

/** A part file's lines: its header naming the replay and part, the lines, and their count. */
export const replayPartLines = (serial: number, part: number, lines: readonly string[]) => [`${PART_HEADER} ${serial} ${part}`, ...lines, `end ${lines.length}`];

/** The manifest the map writes last: a repro header, the replay's serial, its source and how many parts it has. */
export const replayManifestLines = ({ build, version, serial, frame, checksum, parts }: ReplayManifest) =>
  reproLines({ build, frame, checksum }, [`${MANIFEST_WORD} ${serial}`, `version ${version}`, `parts ${parts}`]);

/** A part's lines, or what is wrong with them. */
export function parseReplayPart(lines: readonly string[], serial: number, part: number): readonly string[] | string {
  const end = lines[lines.length - 1];
  if (lines[0] !== `${PART_HEADER} ${serial} ${part}`) return `part ${part} isn't part ${part} of replay ${serial}`;
  if (end !== `end ${lines.length - 2}`) return `part ${part} is cut short`;
  return lines.slice(1, lines.length - 1);
}

/** A manifest's or joined replay's header: the repro, its serial and source, and the parts a manifest names. */
export interface ReplayHeader {
  readonly repro: Repro;
  readonly serial: number;
  readonly version: string;
  /** Parts to join; undefined for a joined replay. */
  readonly parts: number | undefined;
}

function wordValue(line: string | undefined, word: string): string | undefined {
  if (line === undefined || !line.startsWith(`${word} `)) return undefined;
  return line.substring(word.length + 1);
}

/** A manifest's or a joined replay's header, or what is wrong with it. */
export function parseReplayHeader(lines: readonly string[]): ReplayHeader | string {
  const repro = parseRepro(lines);
  if (typeof repro === "string") return repro;
  const serial = wholeNumber(wordValue(repro.lines[0], MANIFEST_WORD));
  const version = wordValue(repro.lines[1], "version");
  if (serial === undefined || version === undefined) return "not a Smashcraft replay";
  const partsText = wordValue(repro.lines[2], "parts");
  const parts = partsText === undefined ? undefined : wholeNumber(partsText);
  if (partsText !== undefined && parts === undefined) return "the replay's part count is malformed";
  return { repro, serial, version, parts };
}

/** The replay a manifest and its parts make: one file, which `bun wisp replay` and the client play. */
export function joinReplay(header: ReplayHeader, parts: readonly (readonly string[])[]): string[] {
  const { repro, serial, version } = header;
  const lines = [`${MANIFEST_WORD} ${serial}`, `version ${version}`];
  for (const part of parts) for (const line of part) lines.push(line);
  return reproLines(repro, lines);
}


