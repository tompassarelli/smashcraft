
















import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../input/participants";
import {
  type MatchState, Phase, computerActive, cycleSlotMode, humanActive, humanFighterActive, selectCharacter, selectCpuCharacter, setAutomaticRematch,
  setHitAreas, setItemsOn, setMeterDropsOn, setUltimatesOn, setPartnerDamage, setStocks, setTimeLimit, setTraining, stepTrainingSpeed, toggleItemKind,
} from "../match/rules";
import { selectableStage } from "../menu/stageCatalog";
import { ITEM_WARNING_FRAMES } from "../match/centreItem";
import { type Character, ItemKind, itemBit } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";

export const SLOTS_COMMAND = "-dev slots ";
const FIGHTER_COMMAND = "-dev fighter ";
export const STOCKS_COMMAND = "-dev stocks ";
const TIME_COMMAND = "-dev time ";
const AUTO_REMATCH_COMMAND = "-dev auto-rematch ";
const STAGE_COMMAND = "-dev stage ";
const HAZARDS_COMMAND = "-dev hazards ";
const TRAINING_COMMAND = "-dev training ";
const HIT_AREAS_COMMAND = "-dev hit-areas ";
const PARTNER_COMMAND = "-dev partner ";
const SPEED_COMMAND = "-dev speed ";
const ITEMS_COMMAND = "-dev items ";
const ULTIMATES_COMMAND = "-dev ultimates ";
const DROPS_COMMAND = "-dev drops ";
const ITEM_COMMAND = "-dev item ";
const ITEM_DROP_COMMAND = "-dev item drop ";

const itemCommandKind = (name: string | undefined): ItemKind | undefined =>
  name === "speed" ? ItemKind.speed : name === "heavy" ? ItemKind.heavy : undefined;

const PARTNER_BEHAVIOUR_NAMES = ["stand", "shield", "crouch", "jump", "attack", "fight"];
const PARTNER_DRIFT_NAMES = ["none", "toward", "away", "random"];
const PARTNER_TECH_NAMES = ["none", "place", "toward", "away", "random"];


function integer(text: string): number | undefined {
  const value = parseDecimal(text);
  return value !== undefined && `${value}` === text ? value : undefined;
}

function characterNamed(name: string): Character | undefined {
  const wanted = name.toLowerCase();
  for (const character of SELECTABLE_CHARACTERS) if (fighterName(character).toLowerCase() === wanted) return character;
  return undefined;
}


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
  if (message.startsWith(ULTIMATES_COMMAND)) return toggle(ULTIMATES_COMMAND, on => setUltimatesOn(game, actor, on), () => !game.ultimatesOff, "ultimates");
  if (message.startsWith(ITEMS_COMMAND)) return toggle(ITEMS_COMMAND, on => setItemsOn(game, actor, on), () => game.items.on, "items");
  if (message.startsWith(DROPS_COMMAND)) return toggle(DROPS_COMMAND, on => setMeterDropsOn(game, actor, on), () => game.drops.on, "drops");
  if (message.startsWith(ITEM_DROP_COMMAND)) {
    const kind = itemCommandKind(message.substring(ITEM_DROP_COMMAND.length));
    if (kind === undefined || game.phase !== Phase.match) return refused("item drop");
    game.items.on = true;
    game.items.nextKind = kind;
    game.items.nextSpawnFrame = game.matchFrame + ITEM_WARNING_FRAMES;
    return `dev: item drop ${message.substring(ITEM_DROP_COMMAND.length)}`;
  }
  if (message.startsWith(ITEM_COMMAND)) {
    const [name, value, extra] = message.substring(ITEM_COMMAND.length).split(" ");
    const kind = itemCommandKind(name);
    if (kind === undefined || (value !== "on" && value !== "off") || extra !== undefined) return refused("item");
    const enabled = () => (game.items.enabledMask & itemBit(kind)) !== 0;
    if (enabled() !== (value === "on")) toggleItemKind(game, actor, kind);
    return enabled() === (value === "on") ? `dev: item ${name} ${value}` : refused("item");
  }
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

    if (stage === undefined || !selectableStage(stage) || !humanActive(game, actor) || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return refused("stage");
    game.stageChoice = stage;
    return `dev: stage ${stage}`;
  }
  if (message.startsWith(HAZARDS_COMMAND)) {

    if (!humanActive(game, actor) || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return refused("hazards");
    return toggle(HAZARDS_COMMAND, on => { game.hazards = on; }, () => game.hazards, "hazards");
  }
  return undefined;
}
