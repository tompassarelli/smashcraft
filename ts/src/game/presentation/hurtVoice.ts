// When a hero's hurt cry may sound. The stock hero models carry their death
// cry in the Death sequence, which several heroes also use as their hit flinch,
// and the game plays that cry whenever the sequence starts. Melee voices only
// hits whose knockback reaches its damage-fly threshold (the tumble launch,
// melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c) and knockouts; lighter hits
// sound only their impact. This gate keeps weak hits silent by showing a
// silent stand-in clip, never restarts a cry already showing, and spaces one
// fighter's cries apart. Presentation only.
import { Character, DownState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

/** The hero model's Death sequence, and the silent clip a weak hit shows instead. */
interface CryClips {
  readonly cry: number;
  readonly standIn: number;
}

/** Sequence indices in each stock hero model (Stand Hit where it has one, else Stand Ready). */
const CRIES: { readonly [character: number]: CryClips | undefined } = {
  [Character.blademaster]: { cry: 5, standIn: 9 },
  [Character.mountainKing]: { cry: 8, standIn: 1 },
  [Character.warden]: { cry: 3, standIn: 4 },
  [Character.lich]: { cry: 8, standIn: 1 },
  [Character.uther]: { cry: 6, standIn: 10 },
  [Character.dreadlord]: { cry: 7, standIn: 1 },
  [Character.shadowHunter]: { cry: 4, standIn: 9 },
};

/** Frames before the same fighter may cry again: about two seconds. */
export const CRY_COOLDOWN_FRAMES = 120;

export const CryDecision = { play: 0, keep: 1, standIn: 2 } as const;
export type CryDecision = (typeof CryDecision)[keyof typeof CryDecision];

/** One fighter body's cry history. */
export interface CryGate {
  lastCryFrame: number | undefined;
  /** Whether the body shows its cry clip now, so a reselection doesn't restart it. */
  showingCry: boolean;
}

export function createCryGate(): CryGate {
  return { lastCryFrame: undefined, showingCry: false };
}

/** Whether a clip selection is the character's cry clip, by index or by sequence name. */
export function isCryClip(character: Character, clipIndex: number | undefined, clipName: string): boolean {
  const clips = CRIES[character];
  if (clips === undefined) return false;
  return clipIndex !== undefined ? clipIndex === clips.cry : clipName.toLowerCase() === "death";
}

/** The silent clip a weak hit shows in place of the cry clip. */
export function cryStandIn(character: Character): number | undefined {
  return CRIES[character]?.standIn;
}

/** A knockout, a launch into tumble, or lying after one: what Melee gives a voice. */
export function earnsCry(fighter: Readonly<Fighter>): boolean {
  return fighter.status.out || fighter.launch.damageLevel === 3 || fighter.down.state !== DownState.none;
}

/**
 * Decides how the body shows a newly selected clip on confirmed frame `frame`:
 * play it, keep the cry clip already showing, or show the silent stand-in.
 */
export function gateCry(gate: CryGate, frame: number, fighter: Readonly<Fighter>, clipIndex: number | undefined, clipName: string): CryDecision {
  if (!isCryClip(fighter.character, clipIndex, clipName)) {
    gate.showingCry = false;
    return CryDecision.play;
  }
  if (gate.showingCry) return CryDecision.keep;
  const rested = gate.lastCryFrame === undefined || frame - gate.lastCryFrame >= CRY_COOLDOWN_FRAMES;
  // A lying fighter has no silent pose to show, so the clip plays even inside the cooldown.
  const lying = fighter.down.state !== DownState.none && fighter.down.state !== DownState.tumble;
  if ((earnsCry(fighter) && rested) || lying) {
    if (rested) gate.lastCryFrame = frame;
    gate.showingCry = true;
    return CryDecision.play;
  }
  return CryDecision.standIn;
}
