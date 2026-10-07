import { f32 } from "wisp/src/sim/f32";
import { originalClip, originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import type { HeroClip } from "../sim/heroes/hero";
import { characterClips } from "./fighterClips";
import * as dh from "./demonHunterAssetInfo";
import { IllidanLocomotion } from "./illidanMotion";
import { DRAWN_STRIDES } from "./drawnStrideInfo";

const named = (character: Character, name: string): HeroClip | undefined => {
  const index = originalClipNamed(character, name);
  const source = index === undefined ? undefined : originalClip(character, index);
  return index === undefined || source === undefined ? undefined : { index, seconds: f32(source.endSeconds - source.startSeconds) };
};

const ORIGINAL_WALKS: readonly (HeroClip | undefined)[] = [named(Character.archer, "walk"), named(Character.rifleman, "walk")];
const ILLIDAN_WALK: HeroClip = { index: dh.DEMON_HUNTER_WALK_FORWARD_INDEX, seconds: 1.0 };
const ILLIDAN_RUN: HeroClip = { index: dh.DEMON_HUNTER_RUN_FORWARD_INDEX, seconds: f32(0.6) };
const ILLIDAN_DASH: HeroClip = { index: dh.DEMON_HUNTER_INITIAL_DASH_BURST_INDEX, seconds: dh.DEMON_HUNTER_INITIAL_DASH_BURST_SECONDS };

/** The exact sequence walked or run by production pose selection, including the originals' named stock walks. */
export function groundLocomotionClip(character: Character, motion: IllidanLocomotion): HeroClip | undefined {
  if (character === Character.demonHunter) {
    if (motion === IllidanLocomotion.walk) return ILLIDAN_WALK;
    if (motion === IllidanLocomotion.run) return ILLIDAN_RUN;
    if (motion === IllidanLocomotion.dash) return ILLIDAN_DASH;
    return undefined;
  }
  const table = characterClips(character);
  const walk = table.walk ?? ORIGINAL_WALKS[character];
  if (motion === IllidanLocomotion.walk) return walk;
  if (motion === IllidanLocomotion.run) return table.run ?? walk;
  if (motion === IllidanLocomotion.dash) return table.dash ?? table.run ?? walk;
  return undefined;
}

/** Feet cover the distance the simulation travels, rather than one stock cycle per second at every fighter's maximum speed. */
export function groundLocomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion): number {
  const gait = motion === IllidanLocomotion.walk ? "walk" : "run";
  const stride = DRAWN_STRIDES[f.character]?.[gait];
  if (stride === undefined) throw new Error(`missing drawn stride for ${f.character}/${gait}`);
  return f32(f32(Math.abs(f.motion.vx) * 60.0) / stride.speed);
}
