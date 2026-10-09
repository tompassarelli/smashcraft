







import { Character, DownState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";


interface CryClips {
  readonly cry: number;
  readonly standIn: number;
}


const CRIES: { readonly [character: number]: CryClips | undefined } = {
  [Character.blademaster]: { cry: 5, standIn: 9 },
  [Character.mountainKing]: { cry: 8, standIn: 1 },
  [Character.warden]: { cry: 3, standIn: 4 },
  [Character.lich]: { cry: 8, standIn: 1 },
  [Character.forsakenPaladin]: { cry: 6, standIn: 10 },
  [Character.dreadlord]: { cry: 7, standIn: 1 },
  [Character.shadowHunter]: { cry: 4, standIn: 9 },

  [Character.pitLord]: { cry: 8, standIn: 4 },
  [Character.beastmaster]: { cry: 7, standIn: 9 },

  [Character.lichKing]: { cry: 6, standIn: 1 },
};


export const CRY_COOLDOWN_FRAMES = 120;

export const CryDecision = { play: 0, keep: 1, standIn: 2 } as const;
export type CryDecision = (typeof CryDecision)[keyof typeof CryDecision];


export interface CryGate {
  lastCryFrame: number | undefined;

  showingCry: boolean;
}

export function createCryGate(): CryGate {
  return { lastCryFrame: undefined, showingCry: false };
}


export function isCryClip(character: Character, clipIndex: number | undefined, clipName: string): boolean {
  const clips = CRIES[character];
  if (clips === undefined) return false;
  return clipIndex !== undefined ? clipIndex === clips.cry : clipName.toLowerCase() === "death";
}


export function cryStandIn(character: Character): number | undefined {
  return CRIES[character]?.standIn;
}


export function earnsCry(fighter: Readonly<Fighter>): boolean {
  return fighter.status.out || fighter.launch.damageLevel === 3 || fighter.down.state !== DownState.none;
}





export function gateCry(gate: CryGate, frame: number, fighter: Readonly<Fighter>, clipIndex: number | undefined, clipName: string): CryDecision {
  if (!isCryClip(fighter.character, clipIndex, clipName)) {
    gate.showingCry = false;
    return CryDecision.play;
  }
  if (gate.showingCry) return CryDecision.keep;
  const rested = gate.lastCryFrame === undefined || frame - gate.lastCryFrame >= CRY_COOLDOWN_FRAMES;

  const lying = fighter.down.state !== DownState.none && fighter.down.state !== DownState.tumble;
  if ((earnsCry(fighter) && rested) || lying) {
    if (rested) gate.lastCryFrame = frame;
    gate.showingCry = true;
    return CryDecision.play;
  }
  return CryDecision.standIn;
}
