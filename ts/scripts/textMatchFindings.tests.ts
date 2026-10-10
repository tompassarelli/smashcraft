import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Character } from "../src/game/sim/codes";
import { LEDGE_HANG_LIMIT_FRAMES } from "../src/game/sim/ledge";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { DEFAULT_OPTIONS, playTextMatch } from "./textMatch";
import { parseCommands } from "./textMatchView";

interface Step { readonly frame: number; readonly percent: number; readonly state: string }

function play(file: string, frames: number): Step[] {
  const input = parseCommands(readFileSync(new URL(`../test/playtest407/${file}`, import.meta.url), "utf8"));
  const options = { ...DEFAULT_OPTIONS, seed: 7, frames, every: 1, you: selectableCharacterBySlug("peon") ?? Character.peon, cpu: selectableCharacterBySlug("chen-stormstout") ?? Character.chen };
  const rows: Step[] = [];
  for (const line of playTextMatch(options, input).lines) {
    const match = /^(\d+) A x-?\d+ z-?\d+ (\d+)% \d+st (\S+) /.exec(line);
    if (match !== null) rows.push({ frame: Number(match[1]), percent: Number(match[2]), state: match[3] ?? "" });
  }
  return rows;
}

test("an idle fighter on the ledge lets go once the hang limit passes [repro #411]", () => {
  const rows = play("ledge-stall.in", 700);
  const first = rows.find((row) => row.state === "ledge-hang");
  expect(first).toBeDefined();
  const caught = first?.frame ?? 0;
  const during = rows.find((row) => row.frame === caught + LEDGE_HANG_LIMIT_FRAMES - 10);
  const after = rows.find((row) => row.frame === caught + LEDGE_HANG_LIMIT_FRAMES + 10);
  expect(during?.state).toBe("ledge-hang");
  expect(after?.state).not.toBe("ledge-hang");
});

test("the Expert computer covers a ledge getup and hits the climber within 45 frames of the press [repro #411]", () => {
  const press = 340;
  const rows = play("ledge-getup.in", 460);
  const before = rows.find((row) => row.frame === press)?.percent ?? 0;
  expect(rows.find((row) => row.frame === press)?.state).toBe("ledge-hang");
  const hit = rows.find((row) => row.frame > press && row.percent > before);
  expect(hit).toBeDefined();
  expect((hit?.frame ?? 9999) - press).toBeLessThanOrEqual(45);
});
