


import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INPUTS_STORE, MANIFEST } from "../scripts/wisp/buildInputs";
import { DrawnModel, sampleState } from "../scripts/wisp/hurtboxView";
import { DEFINITIVE_FIGHTERS } from "../src/game/assets/definitiveFighters";
import { originalClip } from "../src/game/assets/fighterOriginalClipInfo";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";


const LOWEST = 0.9;

const HIGHEST = 1.3;

const DEPARTURES: { readonly [character: number]: string } = {
  [Character.blademaster]: "the banner on his back stands about 60 units over his head",
  [Character.lichKing]: "Frostmourne, raised in Stand Ready, stands about 50 units over his helm; the blade is never body",
  [Character.cairne]: "the carried back totem rises above his head and chest",
  [Character.chen]: "his hat rises about 12 units above his drawn head",
  [Character.tinker]: "the raised backpack claw extends above the goblin and lower backpack body",
  [Character.grom]: "the carried banner rises about 50 units above his drawn head",
  [Character.malfurion]: "the carried staff rises above his drawn head",
};

/** The highest drawn point over the Stand hurt capsules' horizontal span, so side props and wings don't count. */
function drawnHeight(triangles: Float32Array, half: number): number {
  let top = Number.NEGATIVE_INFINITY;
  for (let at = 0; at < triangles.length; at += 6) {
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8 - a; b++) {
      const u = a / 8, v = b / 8, w = 1 - u - v;
      const x = (triangles[at] ?? 0) * u + (triangles[at + 2] ?? 0) * v + (triangles[at + 4] ?? 0) * w;
      const z = (triangles[at + 1] ?? 0) * u + (triangles[at + 3] ?? 0) * v + (triangles[at + 5] ?? 0) * w;
      if (Math.abs(x) <= half && z > top) top = z;
    }
  }
  return top;
}


const LOOK_TOLERANCE = 0.1;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const family = join(INPUTS_STORE, "original-clips-static-lights", manifest["original-clips-static-lights"] ?? "missing");
test("every fighter's drawn Stand height fits its hurt capsule in both looks, and Definitive matches Classic or its capsule within 10% [k3 measure docs/design/hd-fighters.md]", async () => {
  if (!existsSync(family)) return;
  const off: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const frame = sampleState(character, false, 1);
    const clip = frame.clip === undefined ? undefined : originalClip(character, frame.clip);
    if (clip === undefined) { off.push(`${fighterSlug(character)}: no Stand clip`); continue; }
    const half = Math.max(...frame.parts.map((part) => Math.max(Math.abs(part.x1), Math.abs(part.x2)) + part.radius));
    const hurt = Math.max(...frame.parts.map((part) => Math.max(part.z1, part.z2) + part.radius)) - frame.z;
    const body = (originalClip(character, 0)?.modelPath ?? "").split("\\");
    const height = async (path: string) => drawnHeight(new DrawnModel(await Bun.file(path).arrayBuffer(), characterModelScale(character)).triangles(0, clip.startSeconds + frame.seconds, 1), half);
    const classic = await height(join(family, "imports", ...body));
    const definitive = DEFINITIVE_FIGHTERS.has(character) ? await height(join(family, "imports", "_de.w3mod", ...body)) : classic;
    for (const [look, drawn] of [["classic", classic], ["definitive", definitive]] as const) {
      const ratio = drawn / hurt;
      if (ratio < LOWEST || (ratio > HIGHEST && DEPARTURES[character] === undefined)) off.push(`${fighterSlug(character)} ${look}: drawn ${drawn.toFixed(0)} is ${ratio.toFixed(2)} of its hurt top ${hurt.toFixed(0)}`);
    }
    if (Math.abs(definitive / classic - 1) > LOOK_TOLERANCE && Math.abs(definitive / hurt - 1) > LOOK_TOLERANCE) {
      off.push(`${fighterSlug(character)}: Definitive draws ${definitive.toFixed(0)}, ${(definitive / classic).toFixed(2)} of Classic's ${classic.toFixed(0)} and ${(definitive / hurt).toFixed(2)} of its hurt top`);
    }
  }
  expect(off).toEqual([]);
}, 60_000);
