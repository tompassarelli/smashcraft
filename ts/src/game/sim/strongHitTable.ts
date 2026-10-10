import { AttackStyle, Character } from "./codes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { authoredTuning } from "./tuning";
import { squareRoot } from "./warcraftMath";

export const STRONG_HIT_STYLES: readonly AttackStyle[] = [
  AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
  AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.demonHunterDashAttack,
  AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash,
  AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir,
];

const BODY_CENTRE_Z = 45.0;
const LAST_SCANNED_FRAME = 120;

export interface StrongHitRow {
  readonly style: AttackStyle;
  readonly position: boolean;
  readonly strongDamage: number;
  readonly weakDamage: number;
  readonly strongFirst: number;
  readonly strongLast: number;
  readonly weakFirst: number;
  readonly weakLast: number;
  readonly strongFrames: number;
  readonly weakFrames: number;
  readonly strongReach: number;
  readonly weakReach: number;
}

export function strongHitRows(character: Character): StrongHitRow[] {
  const moves = authoredTuning(character).moves;
  const region = emptyHitRegion();
  const rows: StrongHitRow[] = [];
  for (const style of STRONG_HIT_STYLES) {
    let strongDamage = 0.0;
    let weakDamage = 0.0;
    let strongReach = 1.0e9;
    let weakReach = 0.0;
    let strongFirst = -1;
    let strongLast = -1;
    let weakFirst = -1;
    let weakLast = -1;
    let strongFrames = 0;
    let weakFrames = 0;
    let shared = 0;
    for (let frame = 0; frame < LAST_SCANNED_FRAME; frame++) {
      let strongNow = false;
      let weakNow = false;
      for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
        authoredHitRegion(region, character, style, frame, 0, index, moves);
        if (region.window <= 0 || region.effect.damage <= 0) continue;
        const x = (region.minX + region.maxX) / 2;
        const z = (region.minZ + region.maxZ) / 2 - BODY_CENTRE_Z;
        const reach = squareRoot(x * x + z * z);
        if (region.effect.strong === true) {
          strongNow = true;
          strongDamage = Math.max(strongDamage, region.effect.damage);
          strongReach = Math.min(strongReach, reach);
        } else {
          weakNow = true;
          weakDamage = Math.max(weakDamage, region.effect.damage);
          weakReach = Math.max(weakReach, reach);
        }
      }
      if (strongNow) {
        strongFrames++;
        if (strongFirst < 0) strongFirst = frame + 1;
        strongLast = frame + 1;
      }
      if (weakNow) {
        weakFrames++;
        if (weakFirst < 0) weakFirst = frame + 1;
        weakLast = frame + 1;
      }
      if (strongNow && weakNow) shared++;
    }
    if (strongFrames > 0) {
      rows.push({
        style, position: shared === strongFrames, strongDamage, weakDamage, strongFirst, strongLast, weakFirst, weakLast,
        strongFrames, weakFrames, strongReach, weakReach,
      });
    }
  }
  return rows;
}

export const SIGNATURE_STRONG_HIT: { readonly [character: number]: AttackStyle } = {
  [Character.rifleman]: AttackStyle.forwardTilt,
  [Character.demonHunter]: AttackStyle.neutralAir,
  [Character.blademaster]: AttackStyle.forwardSmash,
  [Character.mountainKing]: AttackStyle.forwardSmash,
  [Character.warden]: AttackStyle.forwardSmash,
  [Character.lich]: AttackStyle.forwardSmash,
  [Character.forsakenPaladin]: AttackStyle.forwardSmash,
  [Character.dreadlord]: AttackStyle.backAir,
  [Character.shadowHunter]: AttackStyle.forwardTilt,
  [Character.pitLord]: AttackStyle.forwardSmash,
  [Character.beastmaster]: AttackStyle.forwardSmash,
  [Character.lichKing]: AttackStyle.forwardSmash,
  [Character.thrall]: AttackStyle.forwardSmash,
  [Character.jaina]: AttackStyle.neutralAir,
  [Character.sylvanas]: AttackStyle.forwardSmash,
  [Character.cairne]: AttackStyle.forwardSmash,
  [Character.chen]: AttackStyle.neutralAir,
  [Character.peon]: AttackStyle.forwardSmash,
  [Character.tinker]: AttackStyle.forwardSmash,
  [Character.kaelthas]: AttackStyle.forwardSmash,
  [Character.murloc]: AttackStyle.neutralAir,
  [Character.grom]: AttackStyle.forwardSmash,
  [Character.kobold]: AttackStyle.forwardSmash,
  [Character.malfurion]: AttackStyle.forwardSmash,
  [Character.medivh]: AttackStyle.neutralAir,
  [Character.anubarak]: AttackStyle.forwardSmash,
};

const REASONS: { readonly [character: number]: { readonly [style: number]: string } } = {
  [Character.rifleman]: { [AttackStyle.forwardTilt]: "The bayonet's point: he keeps foes at the end of the barrel, so a thrust spaced to the tip pays." },
  [Character.demonHunter]: { [AttackStyle.neutralAir]: "The glaive spin cuts hardest as it starts and punishes a jump-in; its long lingering spin stays a weak landing and edge-guard cover." },
  [Character.blademaster]: {
    [AttackStyle.forwardSmash]: "Critical Strike at the katana's tip: the duelist who spaces to the tip kills.",
    [AttackStyle.forwardAir]: "The katana's tip again, rewarding spaced aerial cuts.",
    [AttackStyle.forwardTilt]: "A fast poke whose tip is the spacing reward.",
    [AttackStyle.downTilt]: "A low sweep whose tip is the spacing reward.",
    [AttackStyle.dashAttack]: "A running cut that hits hardest when it arrives at full reach.",
  },
  [Character.mountainKing]: {
    [AttackStyle.forwardSmash]: "The storm hammer's head carries the weight; the haft only shoves.",
    [AttackStyle.forwardAir]: "The hammer head spikes; the haft only bumps.",
  },
  [Character.warden]: { [AttackStyle.forwardSmash]: "The blade's far edge: a hunter who strikes at her reach." },
  [Character.lich]: { [AttackStyle.forwardSmash]: "Frost bursts at the staff's tip, so a caster who keeps distance kills at range." },
  [Character.forsakenPaladin]: { [AttackStyle.forwardSmash]: "The hammer's head carries the blessing; the haft only shoves." },
  [Character.dreadlord]: { [AttackStyle.backAir]: "The wing-claw rakes hardest the frame it opens; a vampire who reads the approach takes the clean strike, the rest lingers as a weak wall." },
  [Character.shadowHunter]: { [AttackStyle.forwardTilt]: "The spear's point: a trickster who pokes from outside reach." },
  [Character.pitLord]: { [AttackStyle.forwardSmash]: "The cleaver's far edge: the demon lord's huge reach is the point." },
  [Character.beastmaster]: { [AttackStyle.forwardSmash]: "The axe head bites; the haft only shoves." },
  [Character.lichKing]: {
    [AttackStyle.forwardSmash]: "Frostmourne's point: the king kills at the end of the blade.",
    [AttackStyle.upSmash]: "Remorseless Winter's first burst is the strong one; the lingering frost is weaker.",
  },
  [Character.thrall]: { [AttackStyle.forwardSmash]: "The Doomhammer lands its full weight only on impact; the follow-through is a weak shove." },
  [Character.jaina]: { [AttackStyle.neutralAir]: "An arcane burst strongest as it forms and fading as it lingers: a landing and edge-guard cover." },
  [Character.sylvanas]: { [AttackStyle.forwardSmash]: "The blade's point: the Windrunner is rewarded for keeping her distance." },
  [Character.cairne]: { [AttackStyle.forwardSmash]: "The totem's head carries the earth's weight; the haft only shoves." },
  [Character.chen]: { [AttackStyle.neutralAir]: "A drunken flying kick: hit early to punish, let it linger to cover a landing." },
  [Character.peon]: { [AttackStyle.forwardSmash]: "The pick bites hardest at its point, like a swing at the mine." },
  [Character.tinker]: { [AttackStyle.forwardSmash]: "The claw clamps hardest at full extension; the arm only pushes." },
  [Character.kaelthas]: { [AttackStyle.forwardSmash]: "Phoenix flame at the blade's tip: a vain duelist who must space to shine." },
  [Character.murloc]: { [AttackStyle.neutralAir]: "A flailing spin strongest at its first slap; the rest is a scrappy weak wall." },
  [Character.grom]: { [AttackStyle.forwardSmash]: "Gorehowl bites with its blade; the haft only shoves." },
  [Character.kobold]: { [AttackStyle.forwardSmash]: "The candle's flame at the end of the pick: you no take candle." },
  [Character.malfurion]: { [AttackStyle.forwardSmash]: "Wrath bursts at the staff's tip, so the druid kills at range." },
  [Character.medivh]: { [AttackStyle.neutralAir]: "An arcane ring strongest as it forms, lingering as weak cover." },
  [Character.anubarak]: { [AttackStyle.forwardSmash]: "The impaling claw's point." },
};

export function strongHitReason(character: Character, style: AttackStyle): string | undefined {
  const own = REASONS[character];
  if (own === undefined) return undefined;
  const angled = style === AttackStyle.forwardTiltUp || style === AttackStyle.forwardTiltDown ? AttackStyle.forwardTilt : style;
  return own[angled];
}
