import { model as mdx } from "../../ts/scripts/clipNodes";
import { isDeepStrictEqual } from "node:util";
import { characterClips, namedClips } from "../../ts/src/game/presentation/fighterClips";
import { contactDamageClips } from "../../ts/src/game/presentation/damagePose";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import * as original from "../../ts/src/game/presentation/fighterAssetInfo";
import * as illidan from "../../ts/src/game/presentation/demonHunterAssetInfo";
import { DREADLORD_POUNCE_CLIPS } from "../../ts/src/game/presentation/dreadlordPounceClipInfo";
import { Character } from "../../ts/src/game/sim/codes";
import { onGlobalClock } from "./original-clips";
import { originalClipNamed } from "../../ts/src/game/assets/fighterOriginalClipInfo";

export function flashableSequences(character: number, sequences: readonly mdx.Sequence[]): mdx.Sequence[] {
  // Frozen fighters can flash while holding any previously selected gameplay pose.
  const indices = new Set(namedClips(characterClips(character)).map(clip => clip.index));
  for (const clip of contactDamageClips(character) ?? []) indices.add(clip.index);
  const fallback = heroDefinition(character)?.presentation.fallback;
  if (fallback !== undefined) indices.add(fallback.index);
  for (const name of ["stand", "stand ready", "stand hit", "walk"]) {
    const index = originalClipNamed(character, name);
    if (index !== undefined) indices.add(index);
  }
  const prefix = character === Character.archer ? "ARCHER_" : character === Character.rifleman ? "RIFLEMAN_" : "DEMON_HUNTER_";
  if (character <= Character.demonHunter) {
    for (const [name, index] of Object.entries(character === Character.demonHunter ? illidan : original)) {
      if (name.startsWith(prefix) && name.endsWith("_INDEX") && typeof index === "number" && !name.includes("_KO_")) indices.add(index);
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

export function preservesFlashKey(track: mdx.AnimVector | undefined, key: mdx.AnimKeyframe): boolean {
  if (track === undefined) return false;
  if (track.Keys.some(item => isDeepStrictEqual(item, key))) return true;
  if (track.LineType !== mdx.LineType.Linear && track.LineType !== mdx.LineType.DontInterp) return false;
  const before = track.Keys.findLast(item => item.Frame < key.Frame);
  const after = track.Keys.find(item => item.Frame > key.Frame);
  return before !== undefined && after !== undefined
    && isDeepStrictEqual(before.Vector, key.Vector) && isDeepStrictEqual(after.Vector, key.Vector);
}
