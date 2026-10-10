





import type { AttackStyle } from "./codes";


export const GameplanSpecial = { neutral: 30, side: 31, up: 32, down: 33 } as const;
export type GameplanSpecial = (typeof GameplanSpecial)[keyof typeof GameplanSpecial];


export const GameplanThrow = { forward: 40, back: 41, up: 42, down: 43 } as const;
export type GameplanThrow = (typeof GameplanThrow)[keyof typeof GameplanThrow];





export type GameplanMove = AttackStyle | GameplanSpecial | GameplanThrow;


interface SpacedMove {
  readonly move: GameplanMove;
  readonly near: number;
  readonly far: number;
}






interface ApproachOption {
  readonly via: "run" | "jump" | "shoot";
  readonly moves: readonly GameplanMove[];
  readonly weight?: number | undefined;
}







export type DefenseOption = "shield" | "spotDodge" | "roll" | "stance" | "jump" | "retreat";


interface ComboRoute {
  readonly starter: GameplanMove;
  readonly followUps: readonly GameplanMove[];
}


interface KillMove {
  readonly move: GameplanMove;
  readonly fromPercent: number;

  readonly toPercent?: number | undefined;
}






interface RecoveryRoute {
  readonly aim: "ledge" | "deck" | "mixed";
  readonly upSpecial: "first" | "last" | "mixed";
}











export type GameplanSituation = "below" | "above" | "close" | "far" | "air" | "edge";

export interface FighterGameplan {

  readonly range: { readonly near: number; readonly far: number };

  readonly spacing: readonly SpacedMove[];
  readonly approach: readonly ApproachOption[];
  readonly defense: readonly DefenseOption[];
  readonly combos: readonly ComboRoute[];
  readonly kills: readonly KillMove[];
  readonly recovery: RecoveryRoute;
  readonly avoid: readonly GameplanSituation[];
}


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
