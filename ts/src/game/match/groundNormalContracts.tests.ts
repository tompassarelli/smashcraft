// Each fighter's jab, tilts and dash attack through the match step
// (smashcraft:docs/design/tilts.md): distinct timing, forward-tilt reach
// against the forward air, Ultimate's angling rule from a diagonal input, and
// the role each down tilt and dash attack is designed for.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { normalAttackStyle } from "../input/combat";
import { AttackStyle, Character, DownState } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { HERO_ROSTER, fighterName } from "../sim/heroes/registry";
import type { FighterMoves } from "../sim/heroMoves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackDurationFramesForGrounding, attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { type Roster, copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES } from "../sim/shield";
import { authoredTuning } from "../sim/tuning";
import { controls } from "../sim/testWorld";
import { type FrameControls, createBufferedFrameControls } from "./controls";
import { type MatchState, Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

/** Fighters whose ground normals tilts.md designs; Illidan's belong to his own kit. */
const DESIGNED: readonly Character[] = HERO_ROSTER.map(hero => hero.character);
const GROUND = [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack] as const;
/** Forward airs that outreach the forward tilt on purpose (tilts.md, "Reach versus aerials"). */
const LONGER_AERIAL: readonly Character[] = [Character.lich, Character.dreadlord, Character.archer];
/** Forward tilts that sweep vertical ground, so a diagonal input plays the plain tilt. */
const UNANGLED: readonly Character[] = [Character.blademaster, Character.uther];

const movesOf = (character: Character): FighterMoves | undefined => authoredTuning(character).moves;

/** The farthest forward any of a move's regions reaches. */
function forwardReach(character: Character, style: AttackStyle): number {
  const moves = movesOf(character);
  const out = emptyHitRegion();
  let reach = 0.0;
  const total = attackDurationFramesForGrounding(style, true, moves);
  for (let frame = 0; frame < total; frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
      authoredHitRegion(out, character, style, frame, 0, index, moves);
      if (out.window > 0) reach = Math.max(reach, out.maxX);
    }
  }
  return reach;
}

test("no two designed fighters share a jab, tilt or dash-attack timing", () => {
  for (const style of GROUND) {
    const seen = new Map<string, string>();
    for (const character of DESIGNED) {
      const moves = movesOf(character);
      const key = `${attackStartupFrames(style, moves)}/${characterAttackActiveFrames(character, style, moves)}/${attackDurationFramesForGrounding(style, true, moves)}`;
      assertEquals(seen.get(key), undefined, `${fighterName(character)} shares ${key} for style ${style}`);
      seen.set(key, fighterName(character));
    }
  }
});

test("each fighter's jab is its fastest ground normal and its forward tilt reaches as far as its forward air", () => {
  for (const character of DESIGNED) {
    const moves = movesOf(character);
    const jab = attackStartupFrames(AttackStyle.jab, moves);
    for (const style of [AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack]) {
      assertEquals(jab <= attackStartupFrames(style, moves), true, `${fighterName(character)} jab is slower than style ${style}`);
    }
    const tilt = forwardReach(character, AttackStyle.forwardTilt);
    const air = forwardReach(character, AttackStyle.forwardAir);
    if (LONGER_AERIAL.includes(character)) assertLessThan(tilt, air);
    else assertEquals(tilt >= air, true, `${fighterName(character)} forward tilt ${tilt} is shorter than its forward air ${air}`);
  }
});

interface Duel {
  readonly game: MatchState;
  readonly world: Roster;
  readonly controls: FrameControls;
  frame: number;
}

/** `character` in slot 0 facing right at x 0; a Rifleman target `gap` ahead, facing it. */
function duel(character: Character, gap: number, damage = 0.0): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const target = createFighter(Character.rifleman, gap, -1);
  target.status.damage = damage;
  return { game, world: createRoster(3, [createFighter(character, 0.0, 1), target]), controls: createBufferedFrameControls(), frame: 0 };
}

const attacker = (d: Duel): Fighter => fighterAt(d.world, 0);
const target = (d: Duel): Fighter => fighterAt(d.world, 1);

function step(d: Duel, targetShield = false, run = false): void {
  d.frame++;
  copyControls(d.controls.inputs[0], run ? controls({ direction: 1 }) : neutralControls());
  copyControls(d.controls.inputs[1], targetShield ? controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 }) : neutralControls());
  stepMatch(d.game, d.world, d.controls, d.frame);
}

/** Presses `style` for the attacker on the next frame, as the input layer would queue it. */
function press(d: Duel, style: AttackStyle): void {
  const dashing = style === AttackStyle.dashAttack;
  if (dashing) {
    // A jab pressed out of a dash is the dash attack.
    for (let i = 0; i < 3; i++) step(d, false, true);
    style = AttackStyle.jab;
  }
  queueAttack(d.controls.commands[0], { style, facing: 0, frame: d.frame + 1, mayCharge: false });
  if (dashing) {
    step(d);
    assertEquals(attacker(d).attack.style, AttackStyle.dashAttack);
  }
}

test("a diagonal tilt angles a straight strike and plays a vertical swing's plain tilt", () => {
  for (const character of DESIGNED) {
    const moves = movesOf(character);
    const up = normalAttackStyle(1, 1, true, false);
    const down = normalAttackStyle(1, -1, true, false);
    assertEquals(up, AttackStyle.forwardTiltUp);
    assertEquals(down, AttackStyle.forwardTiltDown);
    const started = (style: AttackStyle) => {
      const d = duel(character, 1000.0);
      press(d, style);
      step(d);
      return attacker(d).attack.style;
    };
    assertEquals(started(up), AttackStyle.forwardTiltUp);
    const plain = moves?.normals[AttackStyle.forwardTilt];
    const raised = moves?.normals[AttackStyle.forwardTiltUp];
    const lowered = moves?.normals[AttackStyle.forwardTiltDown];
    assertTrue(plain !== undefined && raised !== undefined && lowered !== undefined);
    if (plain === undefined || raised === undefined || lowered === undefined) continue;
    if (UNANGLED.includes(character)) {
      assertEquals(raised === plain && lowered === plain, true, `${fighterName(character)} angles a vertical swing`);
      continue;
    }
    // Same timing and damage; the volume moves and the launch follows it.
    const at = (style: AttackStyle) => {
      const out = emptyHitRegion();
      authoredHitRegion(out, character, style, plain.startupFrames + 1, 0, 1, moves);
      return out;
    };
    for (const angled of [raised, lowered]) {
      assertEquals(angled.startupFrames, plain.startupFrames);
      assertEquals(angled.totalFrames, plain.totalFrames);
    }
    const [mid, high, low] = [at(AttackStyle.forwardTilt), at(AttackStyle.forwardTiltUp), at(AttackStyle.forwardTiltDown)];
    assertEquals(high.effect.damage, mid.effect.damage);
    assertEquals(low.effect.damage, mid.effect.damage);
    assertGreaterThan(high.maxZ, mid.maxZ);
    assertLessThan(low.minZ, mid.minZ);
    assertGreaterThan(high.effect.launchZ, mid.effect.launchZ);
    assertLessThan(low.effect.launchZ, mid.effect.launchZ);
  }
});

/** Runs a pressed move against the target until both are idle; returns the frames of each hit. */
function hitFrames(d: Duel, frames: number, targetShield = false): number[] {
  const hits: number[] = [];
  let damage = target(d).status.damage;
  for (let i = 0; i < frames; i++) {
    step(d, targetShield);
    if (target(d).status.damage !== damage) hits.push(d.frame);
    damage = target(d).status.damage;
  }
  return hits;
}

test("Uther's down tilt knocks the victim down at 0%", () => {
  const d = duel(Character.uther, 90.0);
  press(d, AttackStyle.downTilt);
  let downed = false;
  for (let i = 0; i < 90 && !downed; i++) {
    step(d);
    downed = target(d).down.state === DownState.bound || target(d).down.state === DownState.wait;
  }
  assertTrue(downed);
});

test("Mountain King's down tilt only bumps at 0% and tumbles at 100%", () => {
  for (const [percent, tumbles] of [[0.0, false], [100.0, true]] as const) {
    const d = duel(Character.mountainKing, 70.0, percent);
    press(d, AttackStyle.downTilt);
    let tumbled = false;
    for (let i = 0; i < 40; i++) {
      step(d);
      tumbled ||= target(d).down.state === DownState.tumble;
    }
    assertEquals(tumbled, tumbles, `at ${percent}%`);
    assertGreaterThan(target(d).status.damage, percent);
  }
});

test("Warden's down tilt chains: a second one lands before the victim can act", () => {
  const d = duel(Character.warden, 70.0);
  press(d, AttackStyle.downTilt);
  let first = 0;
  for (let i = 0; i < 40 && first === 0; i++) {
    step(d);
    if (target(d).status.damage > 0.0) first = d.frame;
  }
  assertGreaterThan(first, 0);
  // Pressed again on the first frame the Warden can act.
  let victimActed = false;
  const watch = () => { victimActed ||= target(d).launch.hitstun === 0 && target(d).launch.hitlag === 0; };
  while (attacker(d).attack.style !== undefined) {
    step(d);
    watch();
  }
  press(d, AttackStyle.downTilt);
  const damage = target(d).status.damage;
  for (let i = 0; i < 12 && target(d).status.damage === damage; i++) {
    step(d);
    if (target(d).status.damage === damage) watch();
  }
  assertGreaterThan(target(d).status.damage, damage);
  assertEquals(victimActed, false);
});

test("Blademaster's down-tilt tip leaves him out of reach on shield; its inner blade does not", () => {
  const advantage = (gap: number): readonly [number, number] => {
    const d = duel(Character.blademaster, gap);
    target(d).shield.raised = true;
    target(d).shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
    press(d, AttackStyle.downTilt);
    let attackerFree = 0;
    let defenderFree = 0;
    let blocked = false;
    let gapWhenFree = 0.0;
    for (let i = 0; i < 60 && (attackerFree === 0 || defenderFree === 0); i++) {
      step(d, true);
      blocked ||= target(d).shield.stun > 0;
      if (blocked && defenderFree === 0 && target(d).shield.stun === 0 && target(d).launch.hitlag === 0) {
        defenderFree = d.frame;
        gapWhenFree = f32(target(d).motion.x - attacker(d).motion.x);
      }
      if (attackerFree === 0 && attacker(d).attack.style === undefined && d.frame > 1) attackerFree = d.frame;
    }
    assertEquals(blocked, true, `gap ${gap}: damage ${target(d).status.damage} shield ${target(d).shield.raised}`);
    return [defenderFree - attackerFree, gapWhenFree] as const;
  };
  const tip = advantage(150.0);
  const inner = advantage(60.0);
  // Pushed out of any grab or tilt the defender could start in the frames it gains; the inner blade leaves it in grab range.
  assertGreaterThan(tip[0], -8);
  assertGreaterThan(tip[1], 150.0);
  assertLessThan(inner[1], 100.0);
});

test("Dreadlord's down tilt drags the victim toward him and keeps it grounded", () => {
  const d = duel(Character.dreadlord, 80.0);
  press(d, AttackStyle.downTilt);
  const before = target(d).motion.x;
  hitFrames(d, 20);
  assertGreaterThan(target(d).status.damage, 0.0);
  assertLessThan(target(d).motion.x, before);
  assertTrue(target(d).motion.grounded);
});

test("Shadow Hunter's down tilt reaches below the stage where Blademaster's longer one does not", () => {
  const reachesLow = (character: Character): boolean => {
    const d = duel(character, 130.0);
    target(d).motion.z = -120.0;
    target(d).motion.grounded = false;
    const out = emptyHitRegion();
    const moves = movesOf(character);
    const first = attackStartupFrames(AttackStyle.downTilt, moves);
    let low = 0.0;
    for (let index = 0; index < authoredHitRegionCount(AttackStyle.downTilt, moves); index++) {
      authoredHitRegion(out, character, AttackStyle.downTilt, first, 0, index, moves);
      if (out.window > 0) low = Math.min(low, out.minZ);
    }
    return low < -25.0;
  };
  assertTrue(reachesLow(Character.shadowHunter));
  assertTrue(!reachesLow(Character.blademaster));
  assertGreaterThan(forwardReach(Character.blademaster, AttackStyle.downTilt), forwardReach(Character.shadowHunter, AttackStyle.downTilt) - 10.0);
});

test("dash attacks: Warden's is the fastest, Shadow Hunter's hits three times, Dreadlord's crosses up", () => {
  for (const character of DESIGNED) {
    if (character === Character.warden) continue;
    assertLessThan(attackStartupFrames(AttackStyle.dashAttack, movesOf(Character.warden)), attackStartupFrames(AttackStyle.dashAttack, movesOf(character)));
  }
  const spin = duel(Character.shadowHunter, 70.0);
  press(spin, AttackStyle.dashAttack);
  assertEquals(hitFrames(spin, 30).length, 3);
  const cross = duel(Character.dreadlord, 70.0);
  press(cross, AttackStyle.dashAttack);
  hitFrames(cross, 30);
  assertGreaterThan(target(cross).status.damage, 0.0);
  assertGreaterThan(attacker(cross).motion.x, target(cross).motion.x);
});
