// Reading a replay from disk (smashcraft:ts/src/game/replay/matchReplay.ts):
// the manifest the map writes last, whose parts sit beside it as Preload
// files, or a joined replay, one plain line per line, which `bun wisp replay
// --out` and the client write to share.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { joinReplay, parseReplayHeader, parseReplayPart } from "../../src/game/replay/matchReplay";
import { replayPartFile } from "../../src/runtime/gameFiles";

/** A file's lines: a Preload file's stored lines, or a plain file's. */
function fileLines(path: string): string[] {
  const text = readFileSync(path, "utf8");
  return preloadLines(text) ?? text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
}

/** The joined replay `path` names, joining a manifest's parts from its folder; or what is wrong. */
export function readReplay(path: string): string[] | string {
  if (!existsSync(path)) return `${path} doesn't exist`;
  const lines = fileLines(path);
  const header = parseReplayHeader(lines);
  if (typeof header === "string") return `${path}: ${header}`;
  if (header.parts === undefined) return lines;
  const parts: (readonly string[])[] = [];
  for (let part = 1; part <= header.parts; part++) {
    const partPath = join(dirname(path), replayPartFile(header.serial, part));
    if (!existsSync(partPath)) return `${partPath} is missing: a replay needs every part beside its manifest`;
    const body = parseReplayPart(fileLines(partPath), header.serial, part);
    if (typeof body === "string") return `${partPath}: ${body}`;
    parts.push(body);
  }
  return joinReplay(header, parts);
}
