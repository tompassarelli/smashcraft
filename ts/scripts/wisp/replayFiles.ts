



import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { joinReplay, parseReplayHeader, parseReplayPart } from "../../src/game/replay/matchReplay";
import { replayPartFile } from "../../src/runtime/gameFiles";


function fileLines(path: string): string[] {
  const text = readFileSync(path, "utf8");
  return preloadLines(text) ?? text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
}


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
