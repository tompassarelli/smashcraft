// Jabs read as jabs (#163, smashcraft:docs/design/tilts.md, "Jab chains"):
// every selectable fighter's jab chains on repeated presses, as Melee's
// Attack11-13 do, while a forward tilt never chains; each jab is shorter,
// smaller and no slower than its forward tilt.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { attackDurationFramesForGrounding, attackStartupFrames, characterAttackActiveFrames, nextJab } from "../sim/moves";
import { type Roster, copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { authoredTuning } from "../sim/tuning";
import { type FrameControls, createBufferedFrameControls } from "./controls";
import { type MatchState, Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

interface Duel {
  readonly game: MatchState;
  readonly world: Roster;
  readonly controls: FrameControls;
  frame: number;
}

/** `character` facing right at x 0 and a Rifleman target `gap` ahead. */
function duel(character: Character, gap: number): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  return { game, world: createRoster(3, [createFighter(character, 0.0, 1), createFighter(Character.rifleman, gap, -1)]), controls: createBufferedFrameControls(), frame: 0 };
}

function step(d: Duel): void {
  d.frame++;
  copyControls(d.controls.inputs[0], neutralControls());
  copyControls(d.controls.inputs[1], neutralControls());
  stepMatch(d.game, d.world, d.controls, d.frame);
}

/**
 * Three presses of `style`: the first at once, each later one `every`
 * frames after the last, or, when `every` is undefined, as each attack's
 * active frames end, as a player presses again on seeing a hit. Returns the
 * attacks started and the hits the target took.
 */
function pressThrice(character: Character, style: AttackStyle, every: number | undefined, gap: number): { styles: AttackStyle[]; hits: number } {
  const d = duel(character, gap);
  const attacker = fighterAt(d.world, 0);
  const target = fighterAt(d.world, 1);
  const styles: AttackStyle[] = [];
  let serial = attacker.attack.serial;
  let damage = target.status.damage;
  let hits = 0;
  const moves = authoredTuning(character).moves;
  let presses = 0;
  let last = 0;
  for (let frame = 0; frame < 150; frame++) {
    const current = attacker.attack.style;
    const due = every !== undefined ? frame - last >= every
      : current !== undefined && attacker.launch.hitlag === 0 && attacker.attack.frame === attackStartupFrames(current, moves) + characterAttackActiveFrames(character, current, moves);
    if (presses < 3 && (presses === 0 || due)) {
      queueAttack(d.controls.commands[0], { style, facing: 0, frame: d.frame + 1, mayCharge: false });
      presses++;
      last = frame;
    }
    step(d);
    if (attacker.attack.serial !== serial && attacker.attack.style !== undefined) styles.push(attacker.attack.style);
    serial = attacker.attack.serial;
    if (target.status.damage !== damage) hits++;
    damage = target.status.damage;
    if (presses === 3 && attacker.attack.style === undefined && d.controls.commands[0].pending === undefined) break;
  }
  return { styles, hits };
}

/** The steps a fighter's jab chain has: jab, then each authored next jab. */
function chainOf(character: Character): AttackStyle[] {
  const moves = authoredTuning(character).moves;
  const steps: AttackStyle[] = [AttackStyle.jab];
  for (let next = nextJab(AttackStyle.jab); next !== undefined; next = nextJab(next)) {
    if (moves !== undefined && moves.normals[next] === undefined) break;
    steps.push(next);
  }
  return steps;
}

test("pressing jab three times plays the fighter's two- or three-hit jab chain, each jab a hit [spec #163]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const chain = chainOf(character);
    assertEquals(chain.length >= 2 && chain.length <= 3, true, `${fighterName(character)} chain of ${chain.length}`);
    const { styles, hits } = pressThrice(character, AttackStyle.jab, undefined, 60.0);
    assertEquals(styles.join(","), chain.join(","), `${fighterName(character)} jab chain`);
    assertEquals(hits, chain.length, `${fighterName(character)} jab hits`);
  }
});

test("pressing forward tilt three times plays three separate forward tilts [spec #163]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const moves = authoredTuning(character).moves;
    // Each press after the last tilt ends: a tilt never chains, so earlier presses would only wait.
    const every = attackDurationFramesForGrounding(AttackStyle.forwardTilt, true, moves) + 2;
    const { styles } = pressThrice(character, AttackStyle.forwardTilt, every, 2000.0);
    assertEquals(styles.join(","), [AttackStyle.forwardTilt, AttackStyle.forwardTilt, AttackStyle.forwardTilt].join(","), fighterName(character));
  }
});

/** A move's farthest forward reach and its active hit volume's bounding area, over every frame. */
function extent(character: Character, style: AttackStyle): { reach: number; area: number } {
  const moves = authoredTuning(character).moves;
  const out = emptyHitRegion();
  let [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let frame = 0; frame < attackDurationFramesForGrounding(style, true, moves); frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
      authoredHitRegion(out, character, style, frame, 0, index, moves);
      if (out.window <= 0) continue;
      [minX, maxX, minZ, maxZ] = [Math.min(minX, out.minX), Math.max(maxX, out.maxX), Math.min(minZ, out.minZ), Math.max(maxZ, out.maxZ)];
    }
  }
  return { reach: maxX, area: (maxX - minX) * (maxZ - minZ) };
}

test("every jab reaches less, covers less and starts no later than the fighter's forward tilt [spec #163]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const moves = authoredTuning(character).moves;
    const tilt = extent(character, AttackStyle.forwardTilt);
    for (const jab of chainOf(character)) {
      const name = `${fighterName(character)} ${jab}`;
      const own = extent(character, jab);
      assertEquals(own.reach < tilt.reach, true, `${name} reach ${own.reach} against ${tilt.reach}`);
      assertEquals(own.area < tilt.area, true, `${name} active size ${own.area} against ${tilt.area}`);
      assertEquals(attackStartupFrames(jab, moves) <= attackStartupFrames(AttackStyle.forwardTilt, moves), true, `${name} startup`);
    }
  }
});
