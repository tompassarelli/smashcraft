// Developer chat commands that set up a match at fighter selection without
// the menus' pointer targets, so native bot and integrity sessions are driven
// by commands and receipts rather than clicks and screen reading:
//   -dev slots HUMANS COMPUTERS   fighter slot masks, as menu receipts print them
//   -dev fighter P NAME           player P's fighter (a computer's, or the typist's own)
//   -dev stocks N, -dev time MINUTES, -dev auto-rematch on|off
//   -dev stage ID                 a stage catalog id, at fighter or stage selection
//   -dev hazards on|off           stage hazards, at fighter or stage selection
//   -dev training on|off, -dev hit-areas on|off
//   -dev partner BEHAVIOUR DRIFT TECH DAMAGE   training's partner, by the names below
//   -dev speed 1|2|4              training's input frames per match frame
// Each applies the menus' own rule for the player who typed it, so a command
// can do only what that player's clicks could. The developer receipt's SETUP
// line (journalFiles.ts) reports the resulting state; automation confirms a
// command by the receipt counter, then checks that state. The spellings are a
// protocol shared with smashcraft:ts/scripts/integrity/journey.ts.
import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../input/participants";
import {
  type MatchState, Phase, computerActive, cycleSlotMode, humanActive, humanFighterActive, selectCharacter, selectCpuCharacter, setAutomaticRematch,
  setHitAreas, setPartnerDamage, setStocks, setTimeLimit, setTraining, stepTrainingSpeed,
} from "../match/rules";
import { selectableStage } from "../menu/stageCatalog";
import type { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";

export const SLOTS_COMMAND = "-dev slots ";
export const FIGHTER_COMMAND = "-dev fighter ";
export const STOCKS_COMMAND = "-dev stocks ";
export const TIME_COMMAND = "-dev time ";
export const AUTO_REMATCH_COMMAND = "-dev auto-rematch ";
export const STAGE_COMMAND = "-dev stage ";
export const HAZARDS_COMMAND = "-dev hazards ";
export const TRAINING_COMMAND = "-dev training ";
export const HIT_AREAS_COMMAND = "-dev hit-areas ";
export const PARTNER_COMMAND = "-dev partner ";
export const SPEED_COMMAND = "-dev speed ";
/** Partner option names, in their code order (match/trainingState.ts). */
export const PARTNER_BEHAVIOUR_NAMES = ["stand", "shield", "crouch", "jump", "attack", "fight"];
export const PARTNER_DRIFT_NAMES = ["none", "toward", "away", "random"];
export const PARTNER_TECH_NAMES = ["none", "place", "toward", "away", "random"];

/** Digits exactly as I2S would print them. */
function integer(text: string): number | undefined {
  const value = parseDecimal(text);
  return value !== undefined && `${value}` === text ? value : undefined;
}

function characterNamed(name: string): Character | undefined {
  const wanted = name.toLowerCase();
  for (const character of SELECTABLE_CHARACTERS) if (fighterName(character).toLowerCase() === wanted) return character;
  return undefined;
}

/** Cycles each slot's tag (HMN, CPU, EMPTY) as its owner's clicks would until the masks hold. */
function setSlots(game: MatchState, actor: number, humans: number, computers: number): boolean {
  if (!isParticipantMask(humans) || (computers !== 0 && !isParticipantMask(computers)) || (humans & computers) !== 0) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    const bit = 1 << slot;
    for (let cycle = 0; cycle < 3; cycle++) {
      if (humanFighterActive(game, slot) === ((humans & bit) !== 0) && computerActive(game, slot) === ((computers & bit) !== 0)) break;
      if (!cycleSlotMode(game, actor, slot)) return false;
    }
  }
  return game.humanFighterMask === humans && game.computerMask === computers;
}

/**
 * Applies a session setup command typed by `actor` and returns its
 * confirmation, "refused" when the menus' rules don't allow it; undefined
 * for any other message.
 */
export function applySetupCommand(game: MatchState, actor: number, message: string): string | undefined {
  const refused = (what: string) => `dev: ${what} refused`;
  if (message.startsWith(SLOTS_COMMAND)) {
    const [humansText, computersText, extra] = message.substring(SLOTS_COMMAND.length).split(" ");
    const humans = integer(humansText ?? "");
    const computers = integer(computersText ?? "");
    if (humans === undefined || computers === undefined || extra !== undefined || !setSlots(game, actor, humans, computers)) return refused("slots");
    return `dev: slots human-fighters=${humans} computers=${computers}`;
  }
  if (message.startsWith(FIGHTER_COMMAND)) {
    const rest = message.substring(FIGHTER_COMMAND.length);
    const space = rest.indexOf(" ");
    const player = integer(space < 0 ? rest : rest.substring(0, space));
    const character = space < 0 ? undefined : characterNamed(rest.substring(space + 1));
    const slot = player === undefined ? -1 : player - 1;
    if (character === undefined || !isParticipantSlot(slot)) return refused("fighter");
    if (computerActive(game, slot)) selectCpuCharacter(game, actor, slot, character);
    else if (slot === actor) selectCharacter(game, slot, character);
    if (game.characterChoices[slot] !== character || !game.characterReadiness[slot]) return refused("fighter");
    return `dev: player ${player} plays ${fighterName(character)}`;
  }
  if (message.startsWith(STOCKS_COMMAND)) {
    const count = integer(message.substring(STOCKS_COMMAND.length));
    if (count === undefined) return refused("stocks");
    setStocks(game, actor, count);
    return game.stockCount === count ? `dev: ${count} stocks` : refused("stocks");
  }
  if (message.startsWith(TIME_COMMAND)) {
    const minutes = integer(message.substring(TIME_COMMAND.length));
    if (minutes === undefined) return refused("time");
    setTimeLimit(game, actor, minutes);
    return game.timeLimitMinutes === minutes ? `dev: ${minutes} minutes` : refused("time");
  }
  if (message.startsWith(AUTO_REMATCH_COMMAND)) {
    const value = message.substring(AUTO_REMATCH_COMMAND.length);
    if (value !== "on" && value !== "off") return refused("automatic rematch");
    setAutomaticRematch(game, actor, value === "on");
    return game.automaticRematch === (value === "on") ? `dev: automatic rematch ${value}` : refused("automatic rematch");
  }
  const toggle = (prefix: string, apply: (on: boolean) => void, read: () => boolean, what: string): string | undefined => {
    const value = message.substring(prefix.length);
    if (value !== "on" && value !== "off") return refused(what);
    apply(value === "on");
    return read() === (value === "on") ? `dev: ${what} ${value}` : refused(what);
  };
  if (message.startsWith(TRAINING_COMMAND)) return toggle(TRAINING_COMMAND, on => setTraining(game, actor, on), () => game.training, "training");
  if (message.startsWith(HIT_AREAS_COMMAND)) return toggle(HIT_AREAS_COMMAND, on => setHitAreas(game, actor, on), () => game.trainer.showHitAreas, "hit-areas");
  if (message.startsWith(SPEED_COMMAND)) {
    const speed = integer(message.substring(SPEED_COMMAND.length));
    for (let step = 0; step < 3 && speed !== undefined && game.trainer.speed !== speed; step++) stepTrainingSpeed(game, actor, 1);
    return speed !== undefined && game.trainer.speed === speed ? `dev: speed ${speed}` : refused("speed");
  }
  if (message.startsWith(PARTNER_COMMAND)) {
    const [behaviourName, driftName, techName, damageText, extra] = message.substring(PARTNER_COMMAND.length).split(" ");
    const behaviour = PARTNER_BEHAVIOUR_NAMES.indexOf(behaviourName ?? "");
    const drift = PARTNER_DRIFT_NAMES.indexOf(driftName ?? "");
    const tech = PARTNER_TECH_NAMES.indexOf(techName ?? "");
    const damage = integer(damageText ?? "");
    if (behaviour < 0 || drift < 0 || tech < 0 || damage === undefined || extra !== undefined || game.phase !== Phase.characterMenu || !humanActive(game, actor)) return refused("partner");
    setPartnerDamage(game, actor, damage);
    if (game.trainer.damage !== damage) return refused("partner");
    game.trainer.behaviour = behaviour;
    game.trainer.escape = drift;
    game.trainer.tech = tech;
    return `dev: partner ${behaviourName} ${driftName} ${techName} ${damage}`;
  }
  if (message.startsWith(STAGE_COMMAND)) {
    const stage = integer(message.substring(STAGE_COMMAND.length));
    // The stage menu's own choice, made early: any player here may choose, at either menu.
    if (stage === undefined || !selectableStage(stage) || !humanActive(game, actor) || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return refused("stage");
    game.stageChoice = stage;
    return `dev: stage ${stage}`;
  }
  if (message.startsWith(HAZARDS_COMMAND)) {
    // The stage menu's toggle, set early like the stage.
    if (!humanActive(game, actor) || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return refused("hazards");
    return toggle(HAZARDS_COMMAND, on => { game.hazards = on; }, () => game.hazards, "hazards");
  }
  return undefined;
}
