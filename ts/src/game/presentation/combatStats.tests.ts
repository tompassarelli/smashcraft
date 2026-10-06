import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { type Pad, type PadMatch, padMatch, playPads } from "../match/helperPads";
import { testMatch } from "../match/testMatch";
import { matchRecordLines, ratio } from "../shell/matchRecord";
import { Character, DownState, LedgeState } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { ledgeCatchBox } from "../sim/ledge";
import { fighterAt } from "../sim/roster";
import { surfaceLeft, surfaceZ } from "../sim/stage";
import { createCombatObservation, createCombatTally, observeCombat, tallyCombat } from "./combatStats";
import type { MatchCue } from "./matchAudio";
import { type CueObservation, type MatchTally, confirmedFrameCues, createCueObservation, createMatchTally, observeForCues } from "./matchCues";

/** Archer (P1) and a Rifleman at 50% (P2) facing each other, both on controllers. */
function scriptedMatch(): PadMatch {
  const match = testMatch(3, Character.archer);
  match.world.fighters[0] = createFighter(Character.archer, -560.0, 1);
  const victim = createFighter(Character.rifleman, -460.0, -1);
  victim.status.damage = 50.0;
  match.world.fighters[1] = victim;
  return padMatch(match, "combat-stats");
}

interface Presented {
  readonly run: PadMatch;
  readonly observation: CueObservation;
  readonly tally: MatchTally;
  readonly cues: MatchCue[];
}

/** Plays one frame as the shell presents a confirmed frame: observe, run, then tally. */
function present(p: Presented, first: Pad, second: Pad): void {
  const { match } = p.run;
  observeForCues(p.observation, match.game, match.world);
  playPads(p.run, first, second);
  confirmedFrameCues(p.observation, match.game, match.world, p.tally, p.cues);
}

/** Forward smashes the victim toward `side` on frame 1, then plays until it lands from tumble; `trigger` is the victim's pad by frame. */
function knockDown(p: Presented, side: number, trigger: (frame: number) => boolean): number {
  const victim = fighterAt(p.run.match.world, 1);
  for (let frame = 1; frame <= 240; frame++) {
    present(p, frame === 1 ? { cx: side } : {}, { trigger: trigger(frame) });
    if (frame > 1 && victim.motion.grounded && victim.launch.hitlag === 0 && !isTumbling(victim) && victim.down.state !== DownState.none) return frame;
  }
  throw new Error("the victim never landed from tumble");
}

function presented(): Presented {
  return { run: scriptedMatch(), observation: createCueObservation(), tally: createMatchTally(), cues: [] };
}

/** Plays neutral pads until the victim can act again. */
function recover(p: Presented, victim: Fighter): void {
  for (let frame = 0; frame < 600 && (victim.down.state !== DownState.none || victim.launch.hitstun > 0 || !victim.motion.grounded); frame++) present(p, {}, {});
  assertEquals(victim.down.state, DownState.none);
}

test("a scripted match's combat stats: damage dealt, openings, techs, missed techs, ledge grabs and the record's line", () => {
  // The landing frame of the first knockdown, from the same match played without a tech.
  const landing = knockDown(presented(), 1, () => false);
  const p = presented();
  const { world } = p.run.match;
  const attacker = fighterAt(world, 0);
  const victim = fighterAt(world, 1);

  // A forward smash on a free victim is P1's first opening; the victim techs the landing.
  assertEquals(knockDown(p, 1, (frame) => frame === landing - 5), landing);
  assertEquals(victim.down.state, DownState.tech);
  const afterFirst = victim.status.damage;
  assertTrue(afterFirst > 50.0);
  assertEquals(p.tally.combat.openings.join(","), "1,0,0,0");
  assertEquals(p.tally.combat.techs.join(","), "0,1,0,0");
  assertEquals(p.tally.combat.missedTechs.join(","), "0,0,0,0");

  // Up close again from the other side, a second forward smash back toward the centre is a second opening; this landing is missed.
  recover(p, victim);
  assertEquals(victim.status.stocks, 3);
  attacker.motion.x = f32(victim.motion.x + 100.0);
  attacker.facing = -1;
  victim.facing = 1;
  knockDown(p, -1, () => false);
  assertEquals(victim.status.stocks, 3);
  assertEquals(victim.down.state, DownState.bound);
  assertEquals(p.tally.combat.openings.join(","), "2,0,0,0");
  assertEquals(p.tally.combat.missedTechs.join(","), "0,1,0,0");
  assertEquals(Math.floor(p.tally.combat.dealt[0]), Math.floor(victim.status.damage - 50.0));
  assertEquals(p.tally.combat.dealt[1], 0);

  // Falling beside the left ledge, the victim catches it once.
  recover(p, victim);
  victim.motion.grounded = false;
  victim.motion.surface = undefined;
  victim.motion.x = f32(surfaceLeft(0, 0, 0) - f32(ledgeCatchBox(Character.rifleman).reach - 6.0));
  victim.motion.z = surfaceZ(0, 0, 0);
  victim.motion.vx = 0.0;
  victim.motion.vz = 0.0;
  victim.facing = 1;
  for (let frame = 0; frame < 120 && victim.ledge.state === LedgeState.none; frame++) present(p, {}, {});
  assertEquals(victim.ledge.state, LedgeState.hang);
  for (let frame = 0; frame < 10; frame++) present(p, {}, {});
  assertEquals(p.tally.combat.ledgeGrabs.join(","), "0,1,0,0");

  // P1 takes the victim's stock: two openings for one KO.
  victim.hits.lastAttacker = 0;
  victim.motion.x = -100000.0;
  present(p, {}, {});
  assertEquals(p.tally.kos.join(","), "1,0,0,0");

  const dealt = Math.floor(p.tally.combat.dealt[0]);
  const lines = matchRecordLines({ build: "0.0.60", serial: 3, local: 0, players: ["Tom#1234", "Rival#5678", undefined, undefined] }, p.run.match.game, world, p.tally);
  assertEquals(lines.filter(line => line.startsWith("combat ")).join("\n"), [
    `combat slot=P1 dealt=${dealt} openings=2 per-opening=${ratio(dealt, 2)} openings-per-ko=2.0 techs=0 missed-techs=0 ledge-grabs=0`,
    "combat slot=P2 dealt=0 openings=0 per-opening=none openings-per-ko=none techs=1 missed-techs=1 ledge-grabs=1",
  ].join("\n"));
});

test("a hit on a fighter already in hitstun adds damage dealt but no opening; one on a free fighter opens", () => {
  const match = testMatch(3, Character.archer);
  const victim = fighterAt(match.world, 1);
  const before = createCombatObservation();
  const tally = createCombatTally();
  const hit = (damage: number) => {
    observeCombat(before, match.world);
    victim.hits.lastAttacker = 0;
    victim.visuals.hit++;
    victim.status.damage = f32(victim.status.damage + damage);
    victim.launch.hitstun = 20;
    tallyCombat(before, match.world, tally);
  };
  hit(8.0);
  hit(4.0);
  assertEquals(tally.openings.join(","), "1,0,0,0");
  assertEquals(Math.floor(tally.dealt[0]), 12);
  assertEquals(tally.dealt[1], 0);
  victim.launch.hitstun = 0;
  hit(5.0);
  assertEquals(tally.openings.join(","), "2,0,0,0");
});
