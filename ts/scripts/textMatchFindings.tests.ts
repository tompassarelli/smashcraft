import { expect, test } from "bun:test";
import type { Character } from "../src/game/sim/codes";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { DEFAULT_OPTIONS, playTextMatch } from "./textMatch";
import { parseCommands } from "./textMatchView";

interface Row {
  readonly frame: number;
  readonly aPercent: number;
  readonly aState: string;
  readonly bPercent: number;
  readonly bState: string;
}

function fighter(slug: string): Character {
  const found = selectableCharacterBySlug(slug);
  if (found === undefined) throw new Error(`no fighter ${slug}`);
  return found;
}

function rows(seed: number, you: string, cpu: string, input: string, frames: number): readonly Row[] {
  const options = { ...DEFAULT_OPTIONS, seed, you: fighter(you), cpu: fighter(cpu), frames };
  const out: Row[] = [];
  for (const line of playTextMatch(options, parseCommands(input)).lines) {
    const match = /^(\d+) A x\S+ z\S+ (\d+)% \dst (\S+) \S+ ledge\S+ plat\S+ hb\S+ \| B x\S+ z\S+ (\d+)% \dst (\S+) /.exec(line);
    if (match !== null) out.push({ frame: Number(match[1]), aPercent: Number(match[2]), aState: match[3] ?? "", bPercent: Number(match[4]), bState: match[5] ?? "" });
  }
  return out;
}

test("an idle fighter hangs on the ledge and the Expert computer never contests it [provisional]", () => {
  const played = rows(7, "peon", "chen-stormstout", "0 neutral\n", 700);
  const hanging = played.filter((row) => row.aState === "ledge-hang");
  expect(hanging[0]?.frame).toBe(218);
  expect(hanging.length).toBe(700 - 218 + 1);
  expect(new Set(hanging.map((row) => row.aPercent))).toEqual(new Set([40]));
  expect(played.at(-1)?.bPercent).toBe(0);
});

const DSMASH_LOOP = Array.from({ length: 20 }, (_, index) => `${20 + index * 24} down attack!\n${23 + index * 24} neutral\n`).join("");

test("an Expert computer runs into the same down smash every 96 frames [provisional]", () => {
  const played = rows(9, "blademaster", "thrall", `0 neutral\n${DSMASH_LOOP}`, 460);
  const hits = played.filter((row, index) => index > 0 && row.bPercent > (played[index - 1]?.bPercent ?? 0)).map((row) => row.frame);
  expect(hits).toEqual([109, 253, 349, 445]);
  expect(played.filter((row) => row.frame > 253 && row.frame <= 460).every((row) => row.aPercent === 16)).toBe(true);
});

test("Illidan's forward air hits a fully raised shield through to the body of four fighters [provisional]", () => {
  const input = "0 neutral\n46 shield\n70 neutral\n";
  for (const slug of ["warden", "blademaster", "thrall", "dreadlord"]) {
    const played = rows(44, slug, "illidan", input, 70);
    const before = played.find((row) => row.frame === 58);
    const after = played.find((row) => row.frame === 59);
    expect(before?.aState).toBe("shield");
    expect(before?.aPercent).toBe(0);
    expect(after?.aState).toBe("hitlag");
    expect(after?.aPercent).toBe(2);
  }
  for (const slug of ["rifleman", "peon"]) {
    const played = rows(44, slug, "illidan", input, 70);
    expect(played.every((row) => row.aPercent === 0)).toBe(true);
  }
});
