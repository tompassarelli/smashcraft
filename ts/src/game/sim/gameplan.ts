// A fighter's declared gameplan (#105): how its computer plays to the
// fighter's identity. Plain data next to the kit, read only by the computer
// opponent (smashcraft:ts/src/game/match/botGameplan.ts); a fighter without
// one keeps the general computer's play. Distances are the horizontal gap
// between the two fighters' positions, in world units; percents are the
// target's damage.
import type { AttackStyle } from "./codes";

/** The four specials as gameplan moves, after every attack style. */
export const GameplanSpecial = { neutral: 30, side: 31, up: 32, down: 33 } as const;
export type GameplanSpecial = (typeof GameplanSpecial)[keyof typeof GameplanSpecial];

/** The four throws as gameplan moves. */
export const GameplanThrow = { forward: 40, back: 41, up: 42, down: 43 } as const;
export type GameplanThrow = (typeof GameplanThrow)[keyof typeof GameplanThrow];

/**
 * A move a gameplan names: an attack style (aerials by their own style, the
 * kit's dash attack as AttackStyle.dashAttack), a special or a throw.
 */
export type GameplanMove = AttackStyle | GameplanSpecial | GameplanThrow;

/** A move thrown at a spacing: the computer favours it while the gap lies in [near, far]. */
export interface SpacedMove {
  readonly move: GameplanMove;
  readonly near: number;
  readonly far: number;
}

/**
 * How the fighter closes in: running in with ground moves, jumping in with
 * aerials, or shooting and advancing behind the shots. `moves` are favoured
 * while that approach is the plan; `weight` (default 1) is how often it is.
 */
export interface ApproachOption {
  readonly via: "run" | "jump" | "shoot";
  readonly moves: readonly GameplanMove[];
  readonly weight?: number | undefined;
}

/**
 * Answers to an attack about to land. "stance" is the kit's own guard,
 * armor, intangible or parry special; "jump" leaves the ground; "retreat"
 * runs back out to the preferred range. Listed twice, an answer is taken
 * twice as often.
 */
export type DefenseOption = "shield" | "spotDodge" | "roll" | "stance" | "jump" | "retreat";

/** Moves that land well after `starter`; the computer favours them while its hit's stun lasts. */
export interface ComboRoute {
  readonly starter: GameplanMove;
  readonly followUps: readonly GameplanMove[];
}

/** A finisher, favoured while the target's percent lies in [fromPercent, toPercent]. */
export interface KillMove {
  readonly move: GameplanMove;
  readonly fromPercent: number;
  /** Omitted: no upper bound. */
  readonly toPercent?: number | undefined;
}

/**
 * The way back to the stage. `aim`: always the ledge, always the deck, or
 * either. `upSpecial`: spent before the jump near the edge, kept until the
 * jump is gone, or either.
 */
export interface RecoveryRoute {
  readonly aim: "ledge" | "deck" | "mixed";
  readonly upSpecial: "first" | "last" | "mixed";
}

/**
 * Situations the fighter stays out of:
 * - "below": under the target (it doesn't jump into a target overhead and
 *   keeps its preferred gap instead of standing beneath it).
 * - "above": over the target (no jump-ins onto a grounded target).
 * - "close": inside its preferred range (it backs out instead of brawling).
 * - "far": beyond its preferred range (it never waits at long range).
 * - "air": fighting airborne (it approaches and spaces on the ground).
 * - "edge": near the deck's edge (it keeps its spot further in).
 */
export type GameplanSituation = "below" | "above" | "close" | "far" | "air" | "edge";

export interface FighterGameplan {
  /** The gap it keeps in neutral. */
  readonly range: { readonly near: number; readonly far: number };
  /** Its key spacing tools. */
  readonly spacing: readonly SpacedMove[];
  readonly approach: readonly ApproachOption[];
  readonly defense: readonly DefenseOption[];
  readonly combos: readonly ComboRoute[];
  readonly kills: readonly KillMove[];
  readonly recovery: RecoveryRoute;
  readonly avoid: readonly GameplanSituation[];
}

/** Every move the gameplan names as a key move: spacing tools, approach moves, combo starters and follow-ups, kill moves. */
export function gameplanKeyMoves(plan: Readonly<FighterGameplan>): GameplanMove[] {
  const moves: GameplanMove[] = [];
  const add = (move: GameplanMove) => {
    for (const known of moves) if (known === move) return;
    moves.push(move);
  };
  for (const spaced of plan.spacing) add(spaced.move);
  for (const option of plan.approach) for (const move of option.moves) add(move);
  for (const route of plan.combos) {
    add(route.starter);
    for (const move of route.followUps) add(move);
  }
  for (const kill of plan.kills) add(kill.move);
  return moves;
}
