// Illidan's Demon Hunter options (#147) each show a stock Warcraft effect that
// starts where its model already draws, and a hit that drains mana shows Mana
// Burn's burst over its victim for that hit only.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FORM, FLAME_CRASH_FORM, FLAME_CRASH_LANDING_FORM, VENGEFUL_RETREAT_FORM } from "../sim/specials";
import { ATTACK_CUES, EYE_BLAST_CHARGE_CUE } from "./attackCues";
import { MANA_DRAIN_LOOK, advanceDrainSeen, drainSeen } from "./elementLooks";
import { type Cue, ORIGINAL_BRANCH_CUES, ORIGINAL_CUES } from "./specialCues";

/**
 * Where each model draws its look, in milliseconds into the named sequence, read
 * from the classic model's geoset alpha, layer alpha and emitter visibility
 * and rate keys (extracted from the game's archives, 7 Oct). Death Coil
 * special art is its burst, Flame Strike its full fire wall.
 */
const DRAWN: { readonly [model: string]: { readonly sequence: string; readonly fromMs: number; readonly toMs: number } } = {
  "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx": { sequence: "stand", fromMs: 300, toMs: 600 },
  "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx": { sequence: "stand", fromMs: 0, toMs: 1600 },
  "Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx": { sequence: "stand", fromMs: 0, toMs: 1334 },
  "Abilities\\Spells\\NightElf\\MoonGlaive\\MoonGlaiveCaster.mdx": { sequence: "stand", fromMs: 0, toMs: 1000 },
  "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx": { sequence: "birth", fromMs: 0, toMs: 490 },
  "Abilities\\Spells\\Other\\Volcano\\VolcanoDeath.mdx": { sequence: "birth", fromMs: 0, toMs: 590 },
  "Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx": { sequence: "birth", fromMs: 0, toMs: 500 },
  "Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx": { sequence: "stand", fromMs: 0, toMs: 1000 },
  "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx": { sequence: "stand", fromMs: 0, toMs: 3300 },
  "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx": { sequence: "birth", fromMs: 1300, toMs: 4300 },
  "Abilities\\Spells\\Demon\\DemonBoltImpact\\DemonBoltImpact.mdx": { sequence: "stand", fromMs: 230, toMs: 790 },
  "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx": { sequence: "birth", fromMs: 230, toMs: 790 },
};

/** A showing must stay drawn at least this long: a tenth of a second, six frames. */
const SHOWN_MS = 100;

function startsDrawn(name: string, cue: { readonly model: string; readonly sequence?: string | undefined; readonly seconds?: number | undefined }): void {
  const drawn = DRAWN[cue.model];
  assertEquals(drawn !== undefined, true, `${name}: ${cue.model} has a measured draw window`);
  if (drawn === undefined) return;
  assertEquals(cue.sequence, drawn.sequence, `${name} names the sequence it was measured in`);
  const ms = Math.round((cue.seconds ?? -1.0) * 1000.0);
  assertEquals(ms >= drawn.fromMs && ms + SHOWN_MS <= drawn.toMs, true, `${name} starts at ${ms} ms, inside ${drawn.fromMs}-${drawn.toMs} ms`);
}

test("every Illidan option's effect starts where its model already draws [native]", () => {
  const cues: [string, Cue][] = [];
  const felRush = ORIGINAL_CUES[SpecialAction.demonHunterFelRush];
  if (felRush !== undefined) cues.push(["Fel Rush tell", felRush.startup], ["Fel Rush", felRush.active]);
  for (const form of [VENGEFUL_RETREAT_FORM, CHAOS_STRIKE_FORM, CHAOS_STRIKE_AIR_FORM]) {
    const branch = ORIGINAL_BRANCH_CUES[SpecialAction.demonHunterFelRush]?.[form];
    if (branch !== undefined) cues.push([`${branch.cues.spell} startup`, branch.cues.startup], [branch.cues.spell, branch.cues.active]);
  }
  for (const form of [FLAME_CRASH_FORM, FLAME_CRASH_LANDING_FORM]) {
    const branch = ORIGINAL_BRANCH_CUES[SpecialAction.demonHunterImmolate]?.[form];
    if (branch !== undefined) cues.push([`${branch.cues.spell} startup`, branch.cues.startup], [branch.cues.spell, branch.cues.active]);
  }
  for (const entries of Object.values(ATTACK_CUES[Character.demonHunter] ?? {})) for (const { name, cue } of entries) cues.push([name, cue]);
  cues.push(["Eye Blast charge", EYE_BLAST_CHARGE_CUE]);
  for (const [name, cue] of cues) startsDrawn(name, cue);
  startsDrawn("Mana drain", MANA_DRAIN_LOOK);
});

test("Shear shows its cue at every angle [spec #147]", () => {
  const shear = ATTACK_CUES[Character.demonHunter];
  for (const style of [AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown]) assertEquals(shear?.[style]?.[0]?.name, "Shear");
});

test("a drained hit shows Mana Burn's burst over its victim for that hit only [spec #147]", () => {
  const victim = createFighter(Character.blademaster, 0.0, 1);
  const seen = drainSeen();
  assertEquals(advanceDrainSeen(seen, victim), false);
  // A drained hit: the hit and its drain land together.
  victim.visuals.hit++;
  victim.visuals.manaDrained++;
  victim.launch.hitlag = 6;
  assertEquals(advanceDrainSeen(seen, victim), true);
  victim.launch.hitlag = 0;
  victim.launch.hitstun = 10;
  assertEquals(advanceDrainSeen(seen, victim), true);
  // Out of hitstun the burst ends.
  victim.launch.hitstun = 0;
  assertEquals(advanceDrainSeen(seen, victim), false);
  // A later hit that drains nothing (shielded mana, an empty bar) shows none.
  victim.visuals.hit++;
  victim.launch.hitlag = 6;
  assertEquals(advanceDrainSeen(seen, victim), false);
  victim.visuals.hit++;
  victim.visuals.manaDrained++;
  assertEquals(advanceDrainSeen(seen, victim), true);
});
