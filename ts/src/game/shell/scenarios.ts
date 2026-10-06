// Developer scenarios: a match that starts from a staged position, for native
// probes of one mechanic. The probe scripts select one at build time.
import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, cpuSlot, firstHumanSlot, humanActive, selectCharacter, selectCpuCharacter } from "../match/rules";
import { produceComputerInput } from "../match/botPlay";
import { AttackStyle, Character, DownState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../sim/knockback";
import { type Controls, type Roster, copyControls, fighterAt, isActive, neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, mainDeckUndersideZ } from "../sim/stage";
import { stageBounds } from "../sim/stageBounds";
import { BODY_HALF_WIDTH, bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
import type { Scenario } from "./build";

/** A 90-unit gap puts an ordinary Archer jab in range with or without Parry Step. */
export function initializeParryScenario(first: Fighter, second: Fighter): void {
  first.motion.x = -45.0;
  second.motion.x = 45.0;
  first.facing = 1;
  second.facing = -1;
}

/**
 * The computer jabs on the frame the player presses Special, with no timing
 * offset: jab frame zero and the special start in the same row. Neutral
 * Special is the unprotected control through the same input path.
 */
export function queueParryScenarioJab(playerInput: Readonly<Controls>, computer: Readonly<Fighter>, requests: AttackBuffer, frame: number): void {
  if (playerInput.specialPressed && !computer.status.out) queueAttack(requests, { style: AttackStyle.jab, facing: -1, frame, mayCharge: false });
}

/** Both fighters airborne past one edge, rising, close enough for a downward Immolate. */
export function initializeSpikeScenario(first: Fighter, second: Fighter, stage: number, side: 1 | -1): void {
  const edge = side > 0 ? mainDeckRight(stage) : mainDeckLeft(stage);
  first.motion.x = f32(edge + side * 60);
  second.motion.x = f32(first.motion.x + side * 30);
  first.facing = side;
  second.facing = -side;
  first.motion.z = 300.0;
  second.motion.z = 260.0;
  for (const fighter of [first, second]) {
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.vz = 12.0;
  }
}

/** Parry and spike scenarios fight as fixed characters: Demon Hunter against Archer, or two Demon Hunters. */
export function chooseScenarioCharacters(scenario: Scenario, game: MatchState): void {
  if (scenario !== "parry" && scenario !== "spike") return;
  const first = firstHumanSlot(game);
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(game, slot)) selectCharacter(game, slot, scenario === "spike" || slot === first ? Character.demonHunter : Character.archer);
  }
  const computer = cpuSlot(game);
  if (game.humanCount === 1 && first !== undefined && computer !== undefined) {
    selectCpuCharacter(game, first, computer, scenario === "spike" ? Character.demonHunter : Character.archer);
  }
}

/** The first human's opponent: the computer, or the first other fighter. */
function opponentSlot(game: Readonly<MatchState>, world: Roster, first: ParticipantSlot): ParticipantSlot | undefined {
  return cpuSlot(game) ?? PARTICIPANT_SLOTS.find(slot => isActive(world, slot) && slot !== first);
}

/** Ten seconds, long enough for fresh's frame at frame 30 and a few looks after it. */
const UNDERSIDE_FROZEN_FRAMES = 600;

/** Stages the scenario on a freshly initialized match. */
export function initializeScenario(scenario: Scenario, game: Readonly<MatchState>, world: Roster): void {
  const firstSlot = firstHumanSlot(game);
  if (firstSlot === undefined || !isActive(world, firstSlot)) return;
  const otherSlot = opponentSlot(game, world, firstSlot);
  if (otherSlot === undefined) return;
  const first = fighterAt(world, firstSlot);
  const second = fighterAt(world, otherSlot);
  const tech = scenario === "tech";
  switch (scenario) {
    case "agency-none":
    case "agency-thaw":
    case "agency-di":
    case "agency-act":
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        const fighter = fighterAt(world, slot);
        fighter.motion.x = slot === firstSlot ? -160.0 : 160.0;
        fighter.facing = slot === firstSlot ? 1 : -1;
        if (scenario === "agency-none" || scenario === "agency-thaw") fighter.status.frozenFrames = scenario === "agency-thaw" ? 180 : 300;
        if (scenario === "agency-di") {
          fighter.launch.hitlag = 9;
          fighter.launch.hitstun = 30;
          fighter.launch.diPending = true;
          fighter.launch.knockbackX = 6.0;
          fighter.launch.knockbackZ = 6.0;
          fighter.launch.diLaunchSpeed = 8.0;
        }
      }
      return;
    case "parry":
      initializeParryScenario(first, second);
      return;
    case "spike":
      initializeSpikeScenario(first, second, game.stageChoice, 1);
      return;
    case "ko":
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        const fighter = fighterAt(world, slot);
        fighter.motion.z = f32(stageBounds(game.stageChoice).blast.top + 1.0);
        fighter.motion.grounded = false;
        fighter.launch.knockbackZ = f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 10);
        fighter.down.state = DownState.tumble;
        fighter.down.frame = 1;
      }
      return;
    case "knockdown":
    case "tech":
      first.down.state = DownState.tumble;
      first.motion.grounded = false;
      first.motion.z = tech ? 300.0 : 80.0;
      first.motion.vz = -8.0;
      first.launch.hitstun = tech ? 60 : 30;
      second.motion.x = tech ? 350.0 : f32(first.motion.x + 100);
      return;
    case "shield-break":
      first.shield.energy = 1.0;
      second.motion.x = 350.0;
      return;
    case "ledge":
      first.motion.x = f32(mainDeckLeft(game.stageChoice) - 16);
      first.motion.z = 15.0;
      first.motion.grounded = false;
      first.motion.surface = undefined;
      first.facing = 1;
      first.motion.vz = -1.0;
      first.jump.remaining = 0;
      second.motion.x = 350.0;
      return;
    case "underside":
      // Frozen in the air beside the main deck's lower right corner, level with its underside, for native captures of both.
      first.motion.x = 520.0;
      first.motion.z = mainDeckUndersideZ(game.stageChoice);
      first.motion.grounded = false;
      first.motion.surface = undefined;
      first.status.frozenFrames = UNDERSIDE_FROZEN_FRAMES;
      second.motion.x = 350.0;
      return;
    case "camera":
      // Three seconds in the magnifier, then the retained launch crosses the
      // side KO plane. One stock, ordinary movement and stock completion.
      first.motion.x = f32(stageBounds(game.stageChoice).camera.right + 20.0);
      first.motion.z = 300.0;
      first.motion.grounded = false;
      first.motion.surface = undefined;
      first.status.frozenFrames = 180;
      first.launch.knockbackX = 36.0;
      first.launch.knockbackAge = 0;
      first.launch.hitstun = 180;
      first.down.state = DownState.tumble;
      second.motion.x = 0.0;
      return;
    case "body-ceiling":
    case "body-wall":
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        const fighter = fighterAt(world, slot);
        const side = slot === firstSlot ? -1 : 1;
        fighter.facing = -side;
        fighter.motion.x = scenario === "body-ceiling" ? side * 160.0
          : f32((side < 0 ? mainDeckLeft(game.stageChoice) : mainDeckRight(game.stageChoice)) + side * melee(BODY_HALF_WIDTH));
        fighter.motion.z = scenario === "body-ceiling" ? f32(mainDeckUndersideZ(game.stageChoice) - melee(bodyTop(fighter.character))) : -30.0;
        fighter.motion.grounded = false;
        fighter.motion.surface = undefined;
        fighter.motion.vx = 0.0;
        fighter.motion.vz = 0.0;
        fighter.status.frozenFrames = UNDERSIDE_FROZEN_FRAMES;
      }
      return;
    case "normal":
      return;
  }
}

/** Staged scenarios keep the computer passive, except the parry scenario's answering jab. */
const COMPUTER_PLAYS: Readonly<Record<Scenario, boolean>> = {
  "agency-none": false,
  "agency-di": false,
  "agency-act": false,
  "agency-thaw": false,
  normal: true, ko: true, knockdown: false, tech: false, "shield-break": false, ledge: false, parry: false, spike: false, underside: false, camera: false,
  "body-ceiling": false, "body-wall": false,
};

const NEUTRAL = neutralControls();

/** The computer's controls for a callback-driven frame. */
export function produceScenarioComputerInput(
  scenario: Scenario,
  game: Readonly<MatchState>,
  world: Roster,
  runtime: PacingAndPresentation,
  produced: FrameControls,
  slot: ParticipantSlot,
  frame: number,
): void {
  const input = produced.inputs[slot];
  const commands = produced.commands[slot];
  copyControls(input, NEUTRAL);
  clearAttackBuffer(commands);
  const fighter = fighterAt(world, slot);
  if (COMPUTER_PLAYS[scenario] && !fighter.status.out) produceComputerInput(game, world, runtime, slot, frame, input, commands);
  const target = firstHumanSlot(game);
  if (scenario === "parry" && target !== undefined) queueParryScenarioJab(produced.inputs[target], fighter, commands, frame);
}
