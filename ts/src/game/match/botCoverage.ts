// The bounded roster activity check for #179, shared by Bun and emitted Lua.
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { createFighter } from "../sim/fighter";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { attackStartupFrames } from "../sim/moves";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { chooseDefense } from "./botDefense";
import { chooseRecoveryInput } from "./botRecovery";
import { gameplanOf } from "./botGameplan";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

export interface BotCoverage {
  readonly fighter: string;
  matches: number;
  movement: number;
  attacks: number;
  kit: number;
  readonly specials: { neutral: number; side: number; up: number; down: number };
  defense: number;
  recovery: number;
  manaDenied: number;
  defenseDecisions: number;
  recoveryDecisions: number;
  readonly companions: { bear: number; quilbeast: number; hawk: number };
  readonly missing: string[];
}

/** Eight distinct seeds, 1800 frames each, half starting at launch-prone damage. */
export function fighterCoverage(index: number, opponent?: Character, choices: readonly Character[] = SELECTABLE_CHARACTERS): BotCoverage {
  const character = at(choices, index);
  const result: BotCoverage = { fighter: fighterName(character), matches: 0, movement: 0, attacks: 0, kit: 0, specials: { neutral: 0, side: 0, up: 0, down: 0 }, defense: 0, recovery: 0, manaDenied: 0, defenseDecisions: 0, recoveryDecisions: 0, companions: { bear: 0, quilbeast: 0, hawk: 0 }, missing: [] };
  const plan = gameplanOf(character);
  if (plan === undefined) result.missing.push("character gameplan");
  else {
    if (plan.defense.length === 0) result.missing.push("defense decisions");
    if (plan.approach.length === 0 || plan.spacing.length === 0) result.missing.push("combat decisions");
  }
  const defender = createFighter(character, 0.0, 1);
  const threat = createFighter(Character.pitLord, 45.0, -1);
  defender.motion.grounded = true;
  defender.motion.surface = 0;
  threat.motion.grounded = true;
  threat.motion.surface = 0;
  threat.attack.style = AttackStyle.forwardSmash;
  threat.attack.frame = attackStartupFrames(AttackStyle.forwardSmash, threat.tuning.moves);
  for (let serial = 1; serial <= 16; serial++) {
    threat.attack.serial = serial;
    if (chooseDefense(defender, threat, 0, neutralControls())) result.defenseDecisions++;
  }
  for (const side of [-1, 1]) {
    const returning = createFighter(character, side * 680.0, -side);
    returning.motion.grounded = false;
    returning.motion.surface = undefined;
    returning.motion.z = -40.0;
    returning.motion.vz = -4.0;
    const input = neutralControls();
    if (chooseRecoveryInput(returning, 0, 0, input) && input.direction === -side && (input.jumpPressed || input.specialPressed)) result.recoveryDecisions++;
  }
  for (let seed = 0; seed < 8; seed++) {
    const world = createRoster(3, [createFighter(character, -240.0, 1), createFighter(opponent ?? at(choices, floorMod(index + seed + 1, choices.length)), 240.0, -1)]);
    const game = createMatchState();
    for (const slot of PARTICIPANT_SLOTS) {
      game.cpuOpponents[slot] = "wren";
      game.cpuResolvedOpponents[slot] = "wren";
      game.cpuTiers[slot] = "expert";
    }
    game.phase = Phase.match;
    game.stageChoice = 0;
    game.timeLimitMinutes = 0;
    game.matchSeed = 11 + seed * 12;
    const runtime = createPacingAndPresentation();
    const produced = createFrameControls();
    const controls = createFrameControls();
    const row = createMatchFrameInput();
    fighterAt(world, 0).status.damage = seed < 4 ? 0.0 : 110.0;
    fighterAt(world, 1).status.damage = seed < 4 ? 0.0 : 110.0;
    let attack = 0;
    let special: number = SpecialAction.none;
    let specialFrame = 0;
    let specialForm = 0;
    for (let step = 0; step < 1800; step++) {
      const frame = runtime.simulationFrame + 1;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        clearAttackBuffer(produced.commands[slot]);
        produceComputerInput(game, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      }
      if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, game, world, controls, runtime, frame)) throw new Error("coverage frame refused");
      const f = fighterAt(world, 0);
      if (character === Character.beastmaster) {
        if (f.placed.life > 0) result.companions.bear++;
        if ((f.pack[0]?.life ?? 0) > 0) result.companions.quilbeast++;
        if ((f.pack[1]?.life ?? 0) > 0) result.companions.hawk++;
      }
      if (f.motion.deltaX !== 0.0 || f.motion.deltaZ !== 0.0) result.movement++;
      if (f.attack.serial !== attack && f.attack.style !== undefined) result.attacks++;
      if (f.special.action !== SpecialAction.none && (f.special.action !== special || f.special.frame < specialFrame || f.special.form !== specialForm)) {
        result.kit++;
        switch (f.special.action) {
          case SpecialAction.heroNeutral: result.specials.neutral++; break;
          case SpecialAction.heroSide: result.specials.side++; break;
          case SpecialAction.heroUp: result.specials.up++; break;
          case SpecialAction.heroDown: result.specials.down++; break;
        }
      }
      if (f.shield.raised || f.dodge.groundFrame > 0 || f.dodge.airFrame > 0) result.defense++;
      if (!f.motion.grounded && (f.motion.x < -700.0 || f.motion.x > 700.0) && (produced.inputs[0].jumpPressed || produced.inputs[0].specialPressed || produced.inputs[0].direction !== 0)) result.recovery++;
      attack = f.attack.serial;
      special = f.special.action;
      specialFrame = f.special.frame;
      specialForm = f.special.form;
    }
    result.manaDenied += fighterAt(world, 0).visuals.manaDenied;
    result.matches++;
  }
  if (character === Character.beastmaster) {
    if (result.specials.neutral === 0) result.missing.push("Wild Axes");
    if (result.specials.side === 0) result.missing.push("Bear and Stampede");
    if (result.specials.up === 0) result.missing.push("Hawk");
    if (result.specials.down === 0) result.missing.push("Quilbeast");
    if (result.companions.bear === 0) result.missing.push("active Bear");
    if (result.companions.quilbeast === 0) result.missing.push("active Quilbeast");
    if (result.companions.hawk === 0) result.missing.push("active Hawk");
  }
  if (result.movement === 0) result.missing.push("movement");
  if (result.attacks === 0) result.missing.push("attacks");
  if (result.kit === 0) result.missing.push("character kit use");
  if (result.defenseDecisions === 0) result.missing.push("defense response");
  if (result.recoveryDecisions !== 2) result.missing.push("recovery response");
  return result;
}
