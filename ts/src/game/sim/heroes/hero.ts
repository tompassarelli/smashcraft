


import type { Character } from "../codes";
import type { FighterGameplan } from "../gameplan";
import type { FighterMoves } from "../heroMoves";
import type { FighterSpecials } from "../heroSpecials";


export interface NamedMove {
  readonly name: string;
  readonly description: string;
}


export interface HeroClip {
  readonly index: number;
  readonly seconds: number;

  readonly contact?: number | undefined;





  readonly aligned?: boolean | undefined;






  readonly until?: number | undefined;
}





export type HeroStatePose = "dash" | "run" | "crouch" | "fall" | "landing" | "shield" | "airDodge" | "smashCharge" | "ko" | "dizzy";





export type HeroFollowUpPose =
  | "neutralSpecialFollowUp" | "sideSpecialFollowUp" | "upSpecialFollowUp" | "downSpecialFollowUp"
  | "neutralSpecialFollowUpAir" | "sideSpecialFollowUpAir" | "upSpecialFollowUpAir" | "downSpecialFollowUpAir";


export type JabChainPose = "jab2" | "jab3";







export type HeroPose =
  | "idle" | "walk"
  | "turn" | "stop" | "jumpSquat"
  | "tech" | "techForward" | "techBackward" | "getUpRollForward" | "getUpRollBackward"
  | HeroStatePose
  | "jab" | JabChainPose | "grab" | "forwardTilt" | "upTilt" | "downTilt" | "forwardTiltUp" | "forwardTiltDown"
  | "forwardSmash" | "upSmash" | "downSmash" | "dashAttack"
  | "neutralAir" | "forwardAir" | "backAir" | "upAir" | "downAir" | "getUpAttack"
  | "ledgeHang" | "ledgeClimb" | "ledgeRoll" | "ledgeAttack"
  | "knockdown" | "getUp" | "downDamage" | "rollForward" | "rollBackward" | "spotDodge"
  | "jump" | "doubleJump" | "fallSpecial"

  | "wallJump" | "wallTech"
  | "damageGround" | "damageAir" | "damageTumble" | "damageShield"
  | "grabHold" | "grabbed"
  | "pummel" | "throwForward" | "throwBack" | "throwUp" | "throwDown"
  | "victimPummel" | "victimThrowForward" | "victimThrowBack" | "victimThrowUp" | "victimThrowDown"
  | "neutralSpecial" | "sideSpecial" | "upSpecial" | "downSpecial"
  | "neutralSpecialAir" | "sideSpecialAir" | "upSpecialAir" | "downSpecialAir"
  | HeroFollowUpPose;


export type HeroClipTable = { readonly [pose in HeroPose]?: HeroClip | undefined };

export interface HeroPresentation {

  readonly model: string;

  readonly objectId: number;

  readonly portrait: string;

  readonly placedModel?: { readonly path: string; readonly height: number; readonly alpha: number } | undefined;





  readonly clips: HeroClipTable;

  readonly damageClips?: readonly HeroClip[] | undefined;
  readonly fallback: HeroClip;
}

export interface HeroDefinition {
  readonly character: Character;

  readonly name: string;
  readonly purpose: string;
  readonly weakness: string;




  readonly complete: boolean;
  readonly moves: FighterMoves;
  readonly specials?: FighterSpecials | undefined;

  readonly jab: NamedMove;

  readonly presentation: HeroPresentation;

  readonly gameplan?: FighterGameplan | undefined;
}


export const STOCK_FALLBACK_CLIP: HeroClip = { index: 0, seconds: 1.0 };
