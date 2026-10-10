


import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { ELEMENTS, IMMOLATE_SOUNDS, elementLook } from "../src/game/presentation/elementLooks";
import { AttackStyle } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";
import { VERIFIED_STOCK_SOUNDS, VERIFIED_STOCK_SOUND_LABELS } from "../src/game/assets/stockSoundInfo";
import { hitPresentationSoundLabels } from "../src/game/shell/hitPresentationCases";
import { tierSoundPaths } from "../src/game/presentation/moveTiers";






const LABELS = new Set((await Bun.file(new URL("fixtures/stock-sound-labels.txt", import.meta.url)).text()).split("\n").filter((line) => line !== ""));


function hitEffects(value: unknown, path: string, out: { path: string; element: unknown }[], seen: Set<object>): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if ("damage" in value && "growth" in value && "launchX" in value) {
    out.push({ path, element: Reflect.get(value, "element") });
    return;
  }
  // A kit's move table repeats the kit's own effects as rows (docs/design/move-tables.md).
  for (const [key, child] of Object.entries(value)) if (key !== "table") hitEffects(child, `${path}.${key}`, out, seen);
}

test("every hero attack and special names its element [spec docs/gameplay-design.md]", () => {
  const effects: { path: string; element: unknown }[] = [];
  for (const hero of HERO_ROSTER) {

    for (const [style, move] of Object.entries(hero.moves.normals)) if (Number(style) !== AttackStyle.grab) hitEffects(move, `${hero.name}.normals.${style}`, effects, new Set());
    hitEffects(hero.specials, `${hero.name}.specials`, effects, new Set());
  }
  expect(effects.length).toBeGreaterThan(100);
  expect(effects.filter(({ element }) => element === undefined).map(({ path }) => path)).toEqual([]);
  expect(effects.filter(({ element }) => typeof element === "number" && !ELEMENTS.includes(element as never)).map(({ path }) => path)).toEqual([]);
});

test("every element shows a stock model on its victim and plays a stock sound [native]", () => {
  const victims = ELEMENTS.flatMap((element) => elementLook(element).victim ?? []);
  expect(new Set(victims).size).toBe(victims.length);
  expect(victims.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
  const sounds = [...ELEMENTS.flatMap((element) => elementLook(element).sound ?? []), ...Object.values(IMMOLATE_SOUNDS)];
  expect(sounds.filter((label) => !LABELS.has(label))).toEqual([]);
});

test("every tier sound and every sound hit presentation plays has its files in the installed game [native]", () => {
  expect(tierSoundPaths().filter((path) => VERIFIED_STOCK_SOUNDS[path] === undefined)).toEqual([]);
  const labels = hitPresentationSoundLabels();
  expect(labels.length).toBeGreaterThan(10);
  expect(labels.filter((label) => VERIFIED_STOCK_SOUND_LABELS[label] === undefined)).toEqual([]);
  expect(labels.flatMap((label) => VERIFIED_STOCK_SOUND_LABELS[label] ?? []).filter((path) => VERIFIED_STOCK_SOUNDS[path] === undefined)).toEqual([]);
});
