import { Character, type SpecialAction } from "../sim/codes";
import type { HeroPose } from "../sim/heroes/hero";
import { characterClips, specialClip } from "./fighterClips";

const NORMAL_ATTACK_POSES = [
  "jab", "jab2", "jab3", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt",
  "forwardSmash", "upSmash", "downSmash", "dashAttack", "neutralAir", "forwardAir", "backAir", "upAir", "downAir",
  "getUpAttack", "ledgeAttack", "pummel", "throwForward", "throwBack", "throwUp", "throwDown",
] as const;
const SPECIAL_POSES = ["neutralSpecial", "sideSpecial", "upSpecial", "downSpecial"] as const;


function attackClipFamilies(character: Character): { pose: HeroPose; family: string; index: number }[] {
  const table = characterClips(character), result: { pose: HeroPose; family: string; index: number }[] = [];
  for (const pose of NORMAL_ATTACK_POSES) {
    const clip = table[pose];
    if (clip !== undefined) result.push({ pose, family: pose, index: clip.index });
  }
  for (const [slot, pose] of SPECIAL_POSES.entries()) {
    if (character <= Character.demonHunter) {
      const actions: readonly SpecialAction[] = character === Character.rifleman ? [7, 5, 6, 8] : [9, 10, 11, 12];
      const action = actions[slot];
      if (action !== undefined) for (const grounded of [true, false]) result.push({ pose, family: pose, index: specialClip(character, action, grounded, !grounded).index });
    } else {
      const variants: HeroPose[] = [pose, `${pose}Air`, `${pose}FollowUp`, `${pose}FollowUpAir`];
      for (const variant of variants) {
        const clip = table[variant];
        if (clip !== undefined) result.push({ pose: variant, family: pose, index: clip.index });
      }
    }
  }
  return result;
}


export function sharedAttackClips(character: Character): { index: number; families: string[] }[] {
  const groups: { index: number; families: string[] }[] = [];
  for (const binding of attackClipFamilies(character)) {
    let group = groups.find(g => g.index === binding.index);
    if (group === undefined) { group = { index: binding.index, families: [] }; groups.push(group); }
    if (!group.families.includes(binding.family)) group.families.push(binding.family);
  }
  return groups.filter(g => g.families.length >= 3);
}
