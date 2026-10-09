import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer, queueAttack } from "../input/attackBuffer";
import { createFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { ROSTER_MANA } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";
import { FIGHTER_ULTIMATES } from "./ultimates";
import type { AuthoredSpecial } from "./heroSpecials";

/** How each ultimate is met in its recorded scenario (docs/design/ultimates.md). */
type Defence = "shield" | "spotDodge" | "ground" | "stillness";

interface Scenario {
  readonly character: Character;
  /** The target's distance ahead, and its height when it must be airborne to be reached. */
  readonly x: number;
  readonly z?: number;
  readonly defence: Defence;
  /** The frame the defender starts its answer. */
  readonly answerFrame?: number;
}

export const ULTIMATE_SCENARIOS: readonly Scenario[] = [
  { character: Character.rifleman, x: 400.0, defence: "shield" },
  { character: Character.demonHunter, x: 100.0, defence: "shield" },
  { character: Character.blademaster, x: 80.0, defence: "shield" },
  { character: Character.mountainKing, x: 120.0, defence: "shield" },
  { character: Character.warden, x: 250.0, defence: "shield" },
  { character: Character.lich, x: 200.0, z: 150.0, defence: "ground" },
  { character: Character.forsakenPaladin, x: 220.0, defence: "shield" },
  { character: Character.dreadlord, x: 260.0, defence: "shield" },
  { character: Character.shadowHunter, x: 120.0, defence: "shield" },
  { character: Character.pitLord, x: 90.0, defence: "spotDodge", answerFrame: 16 },
  { character: Character.beastmaster, x: 300.0, defence: "shield" },
  { character: Character.lichKing, x: 300.0, defence: "shield" },
  { character: Character.thrall, x: 300.0, defence: "shield" },
  { character: Character.jaina, x: 300.0, defence: "shield" },
  { character: Character.sylvanas, x: 300.0, defence: "shield" },
  { character: Character.cairne, x: 100.0, defence: "stillness" },
  { character: Character.chen, x: 220.0, defence: "shield" },
  { character: Character.peon, x: 250.0, defence: "shield" },
  { character: Character.tinker, x: 150.0, defence: "shield" },
  { character: Character.kaelthas, x: 150.0, defence: "shield" },
  { character: Character.murloc, x: 300.0, defence: "shield" },
  { character: Character.grom, x: 120.0, defence: "spotDodge", answerFrame: 15 },
  { character: Character.anubarak, x: 150.0, defence: "shield" },
  { character: Character.malfurion, x: 300.0, defence: "shield" },
  { character: Character.medivh, x: 240.0, defence: "shield" },
  { character: Character.kobold, x: 200.0, defence: "shield" },
];

const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const ULTIMATE = controls({ specialPressed: true, ultimatePressed: true, attackHeld: true });

interface Bout {
  readonly owner: Fighter;
  readonly target: Fighter;
  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
  readonly commands: readonly AttackBuffer[];
  readonly frame: () => number;
}

function bout(scenario: Readonly<Scenario>, facing: number, target: Character = Character.blademaster, x = scenario.x): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  const owner = createFighter(scenario.character, f32(-x * facing * 0.5), facing);
  const victim = createFighter(target, f32(x * facing * 0.5), -facing);
  owner.mana.points = ROSTER_MANA.max;
  const world = createRoster(3, [owner, victim]);
  const commands = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const step = (first = controls(), second = controls()): void => {
    frame++;
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    out.commands[1] = commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    stepMatch(game, world, out, frame);
  };
  for (let tick = 0; tick < 8; tick++) step();
  owner.mana.points = ROSTER_MANA.max;
  if (scenario.z !== undefined) {
    victim.motion.grounded = false;
    victim.motion.surface = undefined;
    victim.motion.z = f32(victim.motion.z + scenario.z);
  }
  return { owner, target: victim, step, commands, frame: () => frame };
}

/** Holds an airborne target where it was put, as a jumper at its apex would be. */
function hover(b: Bout, z: number | undefined, base: number): void {
  if (z === undefined || b.target.launch.hitstun > 0 || b.target.status.damage > 0.0) return;
  b.target.motion.grounded = false;
  b.target.motion.surface = undefined;
  b.target.motion.z = base;
  b.target.motion.vz = 0.0;
}

function ultimateOf(character: Character): AuthoredSpecial {
  const move = FIGHTER_ULTIMATES[character];
  if (move === undefined) throw new Error(`no ultimate for ${character}`);
  return move;
}

/** The first frame an ultimate can strike: a region, a striking projectile or summon, a grab or a guard. */
export function firstThreat(move: Readonly<AuthoredSpecial>): number {
  let first = move.endFrame;
  for (const region of move.regions ?? []) first = Math.min(first, region.firstFrame + 1);
  for (const shot of move.projectiles ?? []) if (shot.effect.damage > 0.0 || shot.expiresInto !== undefined) first = Math.min(first, shot.spawnFrame + (shot.expiresInto !== undefined && shot.effect.damage === 0.0 ? shot.life : 0));
  if (move.placement !== undefined) first = Math.min(first, move.placement.frame + (move.placement.fireAges[0] ?? 0));
  if (move.commandGrab !== undefined) first = Math.min(first, move.commandGrab.first);
  if (move.guard !== undefined) first = move.guard.last;
  return first;
}

function play(scenario: Readonly<Scenario>, facing: number, defend: boolean): Bout {
  const b = bout(scenario, facing);
  const base = b.target.motion.z;
  b.step(ULTIMATE);
  hover(b, scenario.z, base);
  for (let tick = 0; tick < 240; tick++) {
    let answer = controls();
    const live = b.owner.special.action === SpecialAction.heroUltimate || b.owner.placed.life > 0 || b.owner.projectiles.some((shot) => shot.life > 0);
    if (scenario.defence === "shield" && defend && live) answer = SHIELD;
    if (scenario.defence === "spotDodge" && defend && tick + 2 === (scenario.answerFrame ?? 0)) answer = controls({ ...SHIELD, groundDodgePressed: true, groundDodgeDirection: 0 });
    if (scenario.defence === "stillness" && !defend && tick === 10) queueAttack(b.commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES), { style: AttackStyle.jab, facing: 0, frame: b.frame() + 1, mayCharge: false });
    b.step(controls(), answer);
    if (!(scenario.defence === "ground" && defend)) hover(b, scenario.z, base);
    if (!live && b.target.launch.hitstun <= 0 && (defend || b.target.status.damage > 0.0)) break;
  }
  return b;
}

test("each fighter's ultimate needs the full bar, spends all of it and starts from Attack + Special [spec #382]", () => {
  for (const scenario of ULTIMATE_SCENARIOS) {
    const short = bout(scenario, 1, Character.blademaster, 600.0);
    short.owner.mana.points = ROSTER_MANA.max - 1;
    short.step(ULTIMATE);
    assertTrue(short.owner.special.action !== SpecialAction.heroUltimate);
    const full = bout(scenario, 1, Character.blademaster, 600.0);
    full.step(ULTIMATE);
    assertEquals(full.owner.special.action, SpecialAction.heroUltimate);
    assertEquals(full.owner.mana.points, 0);
  }
});

const name = (character: Character): string => Object.keys(Character).find((key) => Character[key as keyof typeof Character] === character) ?? `${character}`;

test("each fighter's ultimate lands undefended and never KOs from 0% in both facings [spec #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, false);
    if (!(b.target.status.damage > 0.0) || b.target.status.out || b.target.status.stocks !== b.owner.status.stocks) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% out=${b.target.status.out}`);
  }
  assertEquals(failures.join("; "), "");
});

test("each fighter's ultimate is answered by its defence on startup and leaves the user committed [spec #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, true);
    const move = ultimateOf(scenario.character);
    if (b.target.status.damage !== 0.0 || firstThreat(move) < 16 || move.endFrame < firstThreat(move) + 16) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% threat ${firstThreat(move)} end ${move.endFrame}`);
  }
  assertEquals(failures.join("; "), "");
});
