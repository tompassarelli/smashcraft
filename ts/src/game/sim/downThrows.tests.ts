import { assertEquals, test } from "wisp/src/runtime/testing";
import { copyFighterState } from "../replay/fighterState";
import { Character, DownState, GrabAction } from "./codes";
import { canAttack, isTumbling } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_FRAMES, grabContactFrame } from "./moves";
import { totalVelocityZ } from "./motion";
import { type Controls, type Roster, sameControls } from "./roster";
import { advanceFighter } from "./step";
import { controls, testGrabFrame, testWorld } from "./testWorld";

const DEFENSES = ["tech", "toward", "away", "getup", "getupRoll", "getupAttack"] as const;
type Defense = typeof DEFENSES[number];

// One down throw played for the defenses whose inputs have matched so far.
interface Throw {
  readonly owner: Fighter;
  readonly target: Fighter;
  readonly world: Roster;
  readonly frameControls: readonly [Controls, Controls];
  defenses: Defense[];
  frame: number;
  techPressed: boolean;
  landed: boolean;
  floorState: DownState;
  ownerReady: number;
  victimReady: number;
}

const neutral = controls();
const candidate = controls();

function startThrow(owner: Fighter, target: Fighter): Throw {
  return {
    owner, target, world: testWorld(owner, target), frameControls: [neutral, controls()], defenses: [...DEFENSES],
    frame: 0, techPressed: false, landed: false, floorState: DownState.none, ownerReady: -1, victimReady: -1,
  };
}

// Sets only the fields a defense presses; every other field stays neutral.
function writeDefenseInput(input: Controls, play: Throw, defense: Defense, facing: number): void {
  const target = play.target;
  const tech = defense === "tech" || defense === "toward" || defense === "away";
  input.techPressed = tech && !play.techPressed && isTumbling(target) && target.launch.hitlag <= 0
    && totalVelocityZ(target) < 0 && target.motion.z < 50.0;
  const techPressed = play.techPressed || input.techPressed;
  input.direction = techPressed && !play.landed ? defense === "toward" ? -facing : defense === "away" ? facing : 0 : 0;
  input.verticalDirection = defense === "getup" && target.down.state === DownState.wait ? 1 : 0;
  if (defense === "getupRoll" && target.down.state === DownState.wait) input.direction = facing;
  input.getupAttackPressed = defense === "getupAttack" && target.down.state === DownState.wait;
}

// Defenses press identical inputs until the tech press or the knockdown's wait, so
// they share those frames; a split copies both fighters, and every defense still
// plays every frame of its own throw.
function fork(play: Throw, defenses: Defense[]): Throw {
  const owner = createFighter(play.owner.character, 0.0, 1);
  const target = createFighter(play.target.character, 0.0, 1);
  copyFighterState(owner, play.owner, play.world.mask);
  copyFighterState(target, play.target, play.world.mask);
  return { ...play, owner, target, world: testWorld(owner, target), frameControls: [neutral, controls()], defenses };
}

function finishThrow(play: Throw, facing: number, pending: Throw[]): void {
  const input = play.frameControls[1];
  while (play.frame < 220) {
    const lead = play.defenses[0];
    if (lead === undefined) return;
    writeDefenseInput(input, play, lead, facing);
    let split: Defense[] | undefined;
    for (const defense of play.defenses) {
      writeDefenseInput(candidate, play, defense, facing);
      if (!sameControls(candidate, input)) (split ??= []).push(defense);
    }
    if (split !== undefined) {
      pending.push(fork(play, split));
      play.defenses = play.defenses.filter(defense => !split.includes(defense));
    }
    play.frame++;
    play.techPressed = play.techPressed || input.techPressed;
    const { owner, target, world } = play;
    advanceFighter(world, 0, 0, neutral, 0.0);
    advanceFighter(world, 1, 0, input, 0.0);
    testGrabFrame(world, play.frameControls, owner.launch.hitlag > 0 || target.launch.hitlag > 0);
    resolveGrabs(world);
    play.landed = play.landed || target.down.state === DownState.bound || target.down.state === DownState.tech || target.down.state === DownState.techRoll;
    if (play.floorState === DownState.none && play.landed) play.floorState = target.down.state;
    if (play.ownerReady < 0 && canAttack(owner)) play.ownerReady = play.frame;
    if (play.landed && canAttack(target)) { play.victimReady = play.frame; return; }
  }
}

for (const character of SELECTABLE_CHARACTERS) {

  if (character > Character.lichKing) continue;
  test(`${fighterName(character)} down throw gives floor defense at 20/40/60 percent [k3 measure #208]`, () => {
    for (const victim of [Character.demonHunter, Character.rifleman, Character.pitLord]) {
      for (const percent of [20.0, 40.0, 60.0]) {
        for (const facing of [-1, 1]) {
          const owner = createFighter(character, -150.0 * facing, facing);
          const target = createFighter(victim, owner.motion.x + 70.0 * facing, -facing);
          target.status.damage = percent;
          owner.motion.surface = 0;
          target.motion.surface = 0;
          owner.grab.action = GrabAction.throwDown;
          owner.grab.frame = grabContactFrame(GrabAction.throwDown, owner.tuning.moves) - 1;
          owner.grab.target = 1;
          target.grab.owner = 0;
          target.grab.grabbedFrames = GRAB_HOLD_FRAMES;
          const pending = [startThrow(owner, target)];
          let played = 0;
          for (let play = pending.pop(); play !== undefined; play = pending.pop()) {
            finishThrow(play, facing, pending);
            for (const defense of play.defenses) {
              played++;
              const { ownerReady, victimReady } = play;
              const label = `${fighterName(victim)} ${percent}% facing ${facing} ${defense}`;
              assertEquals(play.target.status.damage > percent, true, label + " contact");
              assertEquals(play.landed, true, label + " landed in tech or knockdown");
              const expected = defense === "tech" ? DownState.tech : defense === "toward" || defense === "away" ? DownState.techRoll : DownState.bound;
              assertEquals(play.floorState, expected, label + " chosen floor defense");
              assertEquals(ownerReady > 0, true, label + " attacker acts");
              assertEquals(victimReady > ownerReady, true, label + ` attacker ready ${ownerReady}, defense ends ${victimReady}`);
            }
          }
          assertEquals(played, DEFENSES.length, `${fighterName(victim)} ${percent}% facing ${facing} defenses played`);
        }
      }
    }
  });
}
