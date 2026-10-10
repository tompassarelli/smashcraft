import { model as mdx } from "../../ts/scripts/clipNodes";
import { isDeepStrictEqual } from "node:util";
import { characterClips, illidanSmashClips, namedClips, specialClip } from "../../ts/src/game/presentation/fighterClips";
import { contactDamageClips } from "../../ts/src/game/presentation/damagePose";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import * as illidan from "../../ts/src/game/presentation/demonHunterAssetInfo";
import { DREADLORD_POUNCE_CLIPS } from "../../ts/src/game/presentation/dreadlordPounceClipInfo";
import { AttackStyle, Character, SpecialAction } from "../../ts/src/game/sim/codes";
import { onGlobalClock } from "./original-clips";
import { originalClipNamed } from "../../ts/src/game/assets/fighterOriginalClipInfo";

export function flashableSequences(character: number, sequences: readonly mdx.Sequence[]): mdx.Sequence[] {

  const indices = new Set(namedClips(characterClips(character)).map(clip => clip.index));
  for (const clip of namedClips(characterClips(character))) if (clip.classicStartup !== undefined) indices.add(clip.classicStartup.index);
  for (const clip of contactDamageClips(character) ?? []) indices.add(clip.index);
  const fallback = heroDefinition(character)?.presentation.fallback;
  if (fallback !== undefined) indices.add(fallback.index);
  for (const name of character === Character.demonHunter ? ["stand", "stand ready", "stand hit"] : ["stand", "stand ready", "stand hit", "walk"]) {
    const index = originalClipNamed(character, name);
    if (index !== undefined) indices.add(index);
  }
  if (character <= Character.demonHunter) {
    const actions = character === Character.rifleman
        ? [SpecialAction.riflemanBlaster, SpecialAction.riflemanBear, SpecialAction.riflemanTrap, SpecialAction.riflemanRecovery]
        : [SpecialAction.demonHunterManaBurn, SpecialAction.demonHunterFelRush, SpecialAction.demonHunterWingAscent, SpecialAction.demonHunterImmolate];
    for (const action of actions) for (const grounded of [false, true]) {
      indices.add(specialClip(character, action, grounded, !grounded).index);
    }
    if (character !== Character.demonHunter) {
      const attack = originalClipNamed(character, "attack");
      if (attack !== undefined) indices.add(attack);
    } else {

      for (const index of [
        illidan.DEMON_HUNTER_KO_INDEX, illidan.DEMON_HUNTER_LEDGE_CATCH_INDEX,
        illidan.DEMON_HUNTER_SHIELD_BREAK_INDEX, illidan.DEMON_HUNTER_DOWN_WAIT_INDEX,
        illidan.DEMON_HUNTER_GRAB_ESCAPE_INDEX, illidan.DEMON_HUNTER_AIR_DODGE_INDEX,
        illidan.DEMON_HUNTER_JUMP_SQUAT_INDEX, illidan.DEMON_HUNTER_LAND_INDEX,
        illidan.DEMON_HUNTER_LAND_SPECIAL_INDEX, illidan.DEMON_HUNTER_SHIELD_RAISE_INDEX,
        illidan.DEMON_HUNTER_SHIELD_HOLD_INDEX, illidan.DEMON_HUNTER_SHIELD_RELEASE_INDEX,
        illidan.DEMON_HUNTER_RESPAWN_INDEX, illidan.DEMON_HUNTER_LEDGE_JUMP_INDEX,
        illidan.DEMON_HUNTER_TECH_NEUTRAL_INDEX, illidan.DEMON_HUNTER_TECH_FORWARD_INDEX,
        illidan.DEMON_HUNTER_TECH_BACK_INDEX, illidan.DEMON_HUNTER_GET_UP_ROLL_FORWARD_INDEX,
        illidan.DEMON_HUNTER_GET_UP_ROLL_BACK_INDEX, illidan.DEMON_HUNTER_WALK_FORWARD_INDEX,
        illidan.DEMON_HUNTER_RUN_FORWARD_INDEX, illidan.DEMON_HUNTER_INITIAL_DASH_BURST_INDEX,
        illidan.DEMON_HUNTER_TURNAROUND_INDEX, illidan.DEMON_HUNTER_STOP_INDEX,
        illidan.DEMON_HUNTER_CROUCH_INDEX, illidan.DEMON_HUNTER_FAST_FALL_INDEX,
        illidan.DEMON_HUNTER_FALL_INDEX, illidan.DEMON_HUNTER_COMBAT_IDLE_INDEX,
      ]) indices.add(index);
      for (const style of [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash]) {
        const clips = illidanSmashClips(style);
        indices.add(clips.charge.index);
        indices.add(clips.release.index);
      }
    }
  }
  if (character === Character.dreadlord) for (const clip of Object.values(DREADLORD_POUNCE_CLIPS)) indices.add(clip.index);
  return sequences.filter((sequence, index) => indices.has(index));
}

export function keepFlashableKeys(track: mdx.AnimVector, sequences: readonly mdx.Sequence[]): void {
  if (onGlobalClock(track)) return;
  track.Keys = track.Keys.filter(key => sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
  if (track.LineType !== mdx.LineType.Linear && track.LineType !== mdx.LineType.DontInterp) return;
  const keys = track.Keys;
  track.Keys = keys.filter((key, index) => {
    const before = keys[index - 1], after = keys[index + 1];
    if (before === undefined || after === undefined) return true;
    if (!sequences.some(sequence => before.Frame >= sequence.Interval[0] && after.Frame <= sequence.Interval[1]
      && key.Frame > sequence.Interval[0] && key.Frame < sequence.Interval[1])) return true;
    return !isDeepStrictEqual(before.Vector, key.Vector) || !isDeepStrictEqual(after.Vector, key.Vector);
  });
}

// Warcraft 3.0.1 crashes when loading an empty animation track (#284).




export function trimFlashTracks(value: unknown, sequences: readonly mdx.Sequence[]): void {
  if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return;
  const owner = value as Record<string, unknown>;

  for (const [name, child] of Object.entries(owner)) {
    if (name === "Nodes" || typeof child !== "object" || child === null) continue;
    if (!("Keys" in child) || !Array.isArray(child.Keys)) {
      trimFlashTracks(child, sequences);
      continue;
    }
    const track = child as mdx.AnimVector;
    keepFlashableKeys(track, sequences);
    if (track.Keys.length === 0) delete owner[name];
  }
}

export function preservesFlashKey(track: mdx.AnimVector | undefined, key: mdx.AnimKeyframe): boolean {
  if (track === undefined) return false;
  if (track.Keys.some(item => isDeepStrictEqual(item, key))) return true;
  if (track.LineType !== mdx.LineType.Linear && track.LineType !== mdx.LineType.DontInterp) return false;
  const before = track.Keys.findLast(item => item.Frame < key.Frame);
  const after = track.Keys.find(item => item.Frame > key.Frame);
  return before !== undefined && after !== undefined
    && isDeepStrictEqual(before.Vector, key.Vector) && isDeepStrictEqual(after.Vector, key.Vector);
}
