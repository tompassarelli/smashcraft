import { f32 } from "wisp/src/sim/f32";
import { ITEM_INTERVAL_MAX_SECONDS, ITEM_INTERVAL_MIN_SECONDS } from "../match/centreItem";
import type { MatchState } from "../match/rules";
import { ITEM_BUFF_FRAMES } from "../sim/itemBuffs";
import { RULE_BUTTONS, type RuleBox } from "./ruleButtons";

type RuleName = keyof typeof RULE_BUTTONS;
type RuleGroup = "match" | "items" | "training" | "classic" | "mode";

export const RULE_HELP_WIDTH = f32(0.38);
export const RULE_HELP_HEIGHT = f32(0.046);

const ITEM_SECONDS = ITEM_BUFF_FRAMES / 60;

const MATCH_HELP = {
  fewerStocks: "Stocks: how many times each fighter can be knocked off the stage before they lose.",
  moreStocks: "Stocks: how many times each fighter can be knocked off the stage before they lose.",
  lessTime: "Time limit: the match ends when it runs out. Lower it to “No time limit” to play until stocks run out.",
  moreTime: "Time limit: the match ends when it runs out. Lower it to “No time limit” to play until stocks run out.",
  endless: "Endless play: no stocks are lost and there is no timer. Fight freely; pause and press Escape to leave.",
  automaticRematch: "Automatic rematch: when a match ends, the same fighters and rules start again after a short countdown.",
  items: `Items: a power-up appears at centre stage every ${ITEM_INTERVAL_MIN_SECONDS}–${ITEM_INTERVAL_MAX_SECONDS} s after a 10 s countdown. Touch it and press Attack to grab it.`,
  ultimates: "Ultimates: with a full meter bar, Attack + Special unleashes your fighter's ultimate. Off: meter only powers EX moves.",
} as const;

const ITEM_HELP = {
  itemSpeed: `Speed item: for ${ITEM_SECONDS} s you run and drift ×1.3 faster and jump higher. You glow cyan in a whirlwind.`,
  itemHeavy: `Heavy item: for ${ITEM_SECONDS} s you turn to iron: knockback you take ÷1.5 and you fall faster.`,
} as const;

const TRAINING_HELP = {
  lessBehaviour: "Partner: what the training partner does: stand, shield, crouch, jump, attack or fight back.",
  moreBehaviour: "Partner: what the training partner does: stand, shield, crouch, jump, attack or fight back.",
  lessEscape: "Partner drift: which way the partner steers while it flies from your hits.",
  moreEscape: "Partner drift: which way the partner steers while it flies from your hits.",
  lessTech: "Partner tech: whether and where the partner breaks its fall when it hits the ground.",
  moreTech: "Partner tech: whether and where the partner breaks its fall when it hits the ground.",
  lessDamage: "Partner damage: the partner's starting damage. Higher damage sends it flying farther.",
  moreDamage: "Partner damage: the partner's starting damage. Higher damage sends it flying farther.",
  hitAreas: "Hit areas: draw where every attack hits and where every fighter can be hit.",
  speed: "Game speed: slow the whole game to half or quarter speed to study moves.",
} as const;

const HELP: Readonly<Record<Exclude<RuleName, "training" | "easierClassic" | "harderClassic">, string>> = { ...MATCH_HELP, ...ITEM_HELP, ...TRAINING_HELP };

const isRule = (name: string): name is RuleName => name in RULE_BUTTONS;

const RULE_GROUPS: readonly (readonly [RuleGroup, readonly RuleName[]])[] = [
  ["mode", ["training"]],
  ["match", Object.keys(MATCH_HELP).filter((name) => isRule(name))],
  ["items", Object.keys(ITEM_HELP).filter((name) => isRule(name))],
  ["training", Object.keys(TRAINING_HELP).filter((name) => isRule(name))],
  ["classic", ["easierClassic", "harderClassic"]],
];


export function visibleRuleGroups(game: Readonly<MatchState>): readonly RuleGroup[] {
  if (game.training) return ["mode", "training"];
  if (game.classic || game.lore) return ["mode", "classic"];
  return game.items.on ? ["mode", "match", "items"] : ["mode", "match"];
}


const inside = (box: RuleBox, x: number, y: number): boolean =>
  x >= box.x && x <= f32(box.x + box.width) && y <= box.y && y >= f32(box.y - box.height);


export function hoveredRule(groups: readonly RuleGroup[], x: number, y: number): RuleName | undefined {
  for (const [group, names] of RULE_GROUPS) {
    if (!groups.includes(group)) continue;
    for (const name of names) if (inside(RULE_BUTTONS[name], x, y)) return name;
  }
  return undefined;
}


function modeHelp(game: Readonly<MatchState>): string {
  const current = game.lore ? "Lore Battles: story fights against set opponents."
    : game.classic ? "Classic: a run of fights that ends with a boss."
    : game.training ? "Training: practise on a partner you set up; no stocks or timer."
    : "Versus: fight players and computers with the rules on this screen.";
  return `Mode: click to switch Versus, Training, Classic, Lore Battles. ${current}`;
}


export function ruleHelp(name: RuleName, game: Readonly<MatchState>): string {
  if (name === "training") return modeHelp(game);
  if (name === "easierClassic" || name === "harderClassic") return game.lore ? "Battle: choose which lore battle to fight." : "Difficulty: how strong the opponents are on this Classic run.";
  return HELP[name];
}
