// What every special shows on its startup and on its active frames: a stock
// Warcraft spell effect at a body anchor, so a viewer can tell which move it is
// and when it is dangerous (#144). Each hero's startup uses its own colour of
// cast flash and each move its own Warcraft spell; the window comes from the
// kit's authored frames, never from the drawn clip. Presentation only.
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { type AuthoredSpecial, FOLLOW_UP_FORM, type FrameWindow, SpecialForm } from "../sim/heroSpecials";
import { idiv } from "wisp/src/sim/intMath";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { HERO_ROSTER } from "../sim/heroes/registry";
import {
  ARCHER_DIVE_FORM,
  ARCHER_ARROW_SHOT_FRAME,
  ARCHER_DIVE_LAUNCH_FRAME,
  ARCHER_HOMING_WINDUP_FRAMES,
  ARCHER_RIDE_HOVER_FRAMES,
  CHAOS_STRIKE_AIR_FORM,
  CHAOS_STRIKE_FIRST,
  CHAOS_STRIKE_FORM,
  CHAOS_STRIKE_LAST,
  DEMONHUNTER_GLIDE_SLASH_FORM,
  FLAME_CRASH_BURST_LAST,
  FLAME_CRASH_FORM,
  FLAME_CRASH_FRAMES,
  FLAME_CRASH_LANDING_FORM,
  DEMONHUNTER_IMMOLATE_ACTIVE,
  DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_MANA_BURN_STARTUP,
  DEMONHUNTER_WING_STARTUP,
  FEL_RUSH_FIRST,
  FEL_RUSH_LAST,
  RIFLEMAN_BEAR_CAST_FRAMES,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES,
  RIFLEMAN_SECOND_SHOT_FORM,
  VENGEFUL_RETREAT_FORM,
  VENGEFUL_RETREAT_MOVE_LAST,
} from "../sim/specials";
import { SPECIAL_SLOTS, type SpecialSlot } from "./projectileArt";
import { RIFLEMAN_MODEL_FILE } from "./fighterAssetInfo";

/** Where a cue stands, facing-relative, in the fighter's model scale. */
export type CueAnchor = "hand" | "body" | "feet" | "ahead" | "behind" | "overhead" | "barrel";

export const CUE_ANCHORS: { readonly [anchor in CueAnchor]: { readonly x: number; readonly z: number } } = {
  hand: { x: 40.0, z: 70.0 },
  body: { x: 0.0, z: 50.0 },
  feet: { x: 0.0, z: 2.0 },
  ahead: { x: 70.0, z: 45.0 },
  behind: { x: -55.0, z: 55.0 },
  overhead: { x: 0.0, z: 125.0 },
  barrel: { x: 75.0, z: 60.0 },
};

export interface Cue {
  readonly model: string;
  readonly anchor: CueAnchor;
  readonly scale: number;
  /** Already drawn by the fighter's own special effects (render/specialEffects.ts). */
  readonly drawn?: boolean | undefined;
  /**
   * The sequence a showing starts and the seconds into it, where its model
   * already draws: a pooled effect has played past its birth by the time it
   * shows, and some stock models draw nothing in their first tenths of a
   * second. Unset, a showing restarts whatever sequence plays from 0 s.
   */
  readonly sequence?: string | undefined;
  readonly seconds?: number | undefined;
}

/** `cue` started `seconds` into `sequence`. */
export const timed = (cue: Cue, sequence: string, seconds: number): Cue => ({ ...cue, sequence, seconds });

/** One special's cues: its Warcraft spell, what its startup shows and what its active frames show. */
export interface MoveCues {
  readonly spell: string;
  readonly startup: Cue;
  readonly active: Cue;
}

const cue = (model: string, anchor: CueAnchor, scale: number): Cue => ({ model, anchor, scale });
const drawn = (model: string, anchor: CueAnchor): Cue => ({ model, anchor, scale: 1.0, drawn: true });

// Each hero's cast flash, its colour: orc fury, storm, shadow, frost, holy light, vampiric, voodoo, fel, wild.
const BLOODLUST = cue("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustSpecial.mdx", "hand", f32(0.8));
const STORM = cue("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", "hand", 1.0);
const SHADOW = cue("Abilities\\Spells\\Undead\\Cripple\\CrippleTarget.mdx", "hand", f32(0.7));
const FROST = cue("Abilities\\Spells\\Undead\\ReplenishMana\\SpiritTouchTarget.mdx", "hand", f32(0.8));
const ARCANE = cue("Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx", "hand", 0.5);
const HOLY = cue("Abilities\\Spells\\Human\\Heal\\HealTarget.mdx", "hand", f32(0.7));
const VAMPIRIC = cue("Abilities\\Spells\\Undead\\UnholyFrenzy\\UnholyFrenzyTarget.mdx", "hand", f32(0.8));
const DREADLORD_BITE_CUES: MoveCues = { spell: "Healing bite", startup: VAMPIRIC, active: cue("Abilities\\Weapons\\Blood\\BloodImpact.mdx", "ahead", 1.0) };
const VOODOO = cue("Abilities\\Spells\\Orc\\TrollBerserk\\TrollBeserkerTarget.mdx", "hand", f32(0.7));
const FEL = cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.7));
const BEAST = cue("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", "hand", f32(0.6));
/** The Lich King's dark rune under his feet. */
const RUNE = cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualCaster.mdx", "feet", f32(0.6));

/** Every hero's four specials; every form of a special (air, free, follow-up, recall, marked) shows its special's cues. */
export const HERO_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]: MoveCues } } = {
  [Character.jaina]: {
    neutral: { spell: "Frostbolt", startup: ARCANE, active: cue("Abilities\\Weapons\\SorceressMissile\\SorceressMissile.mdx", "hand", 0.5) },
    side: { spell: "Blizzard", startup: ARCANE, active: cue("Abilities\\Weapons\\LichMissile\\LichMissile.mdx", "hand", f32(0.7)) },
    up: { spell: "Blink", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx", "body", 0.5) },
    down: { spell: "Summon Water Elemental", startup: ARCANE, active: cue("Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx", "hand", f32(0.7)) },
  },
  [Character.cairne]: {
    neutral: { spell: "Shockwave", startup: BEAST, active: drawn("Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx", "ahead") },
    side: { spell: "War Stomp", startup: BEAST, active: cue("Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx", "feet", f32(0.4)) },
    up: { spell: "Spirit Lift", startup: BEAST, active: cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAura.mdx", "feet", f32(0.7)) },
    down: { spell: "Reincarnation", startup: BEAST, active: cue("Abilities\\Spells\\Orc\\Reincarnation\\ReincarnationTarget.mdx", "body", f32(0.6)) },
  },
  [Character.thrall]: {
    neutral: { spell: "Chain Lightning", startup: STORM, active: cue("Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx", "hand", 1.0) },
    side: { spell: "Feral Spirit", startup: BEAST, active: cue("units\\orc\\SpiritWolf\\SpiritWolf.mdx", "ahead", 0.5) },
    up: { spell: "Far Sight", startup: STORM, active: cue("Abilities\\Spells\\Orc\\Purge\\PurgeBuffTarget.mdx", "body", 0.5) },
    down: { spell: "Earthquake", startup: STORM, active: cue("Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx", "feet", f32(1.3)) },
  },
  [Character.sylvanas]: {
    neutral: { spell: "Black Arrow", startup: SHADOW, active: cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.6)) },
    side: { spell: "Silence", startup: SHADOW, active: cue("Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx", "ahead", f32(0.6)) },
    up: { spell: "Banshee Flight", startup: SHADOW, active: cue("Abilities\\Spells\\Undead\\Possession\\PossessionCaster.mdx", "body", f32(0.7)) },
    down: { spell: "Life Drain", startup: SHADOW, active: cue("Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", "hand", f32(0.6)) },
  },
  [Character.blademaster]: {
    neutral: { spell: "Wind Cutter", startup: BLOODLUST, active: cue("Abilities\\Spells\\Other\\Tornado\\Tornado_Target.mdx", "hand", f32(0.6)) },
    side: { spell: "Wind Walk", startup: cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", f32(0.8)), active: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", "ahead", f32(0.8)) },
    up: { spell: "Rising Whirlwind", startup: BLOODLUST, active: cue("Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Mirror Image", startup: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "body", 1.0), active: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageDeathCaster.mdx", "body", 1.0) },
  },
  [Character.mountainKing]: {
    neutral: { spell: "Storm Bolt", startup: STORM, active: cue("Abilities\\Spells\\Other\\ForkedLightning\\ForkedLightningTarget.mdx", "hand", f32(0.8)) },
    side: { spell: "Storm Rush", startup: cue("Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx", "body", f32(0.8)), active: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", 1.0) },
    up: { spell: "Thunder Leap", startup: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", 0.5), active: cue("Abilities\\Spells\\Orc\\LightningShield\\LightningShieldTarget.mdx", "body", f32(0.8)) },
    down: { spell: "Thunder Clap", startup: STORM, active: cue("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", "feet", f32(0.6)) },
  },
  [Character.warden]: {
    neutral: { spell: "Shadow Strike", startup: cue("Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrike.mdx", "hand", f32(0.7)), active: cue("Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx", "hand", 1.0) },
    side: { spell: "Shadow Pursuit", startup: SHADOW, active: cue("Abilities\\Weapons\\GlaiveMissile\\GlaiveMissileTarget.mdx", "ahead", 1.0) },
    up: { spell: "Blink", startup: SHADOW, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx", "body", f32(0.6)) },
    down: { spell: "Fan of Knives", startup: SHADOW, active: cue("Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesCaster.mdx", "body", f32(0.6)) },
  },
  [Character.lich]: {
    neutral: { spell: "Frost Nova", startup: FROST, active: cue("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", "hand", f32(0.8)) },
    side: { spell: "Death and Decay", startup: FROST, active: cue("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", "hand", 0.5) },
    up: { spell: "Spectral Ascent", startup: FROST, active: cue("Abilities\\Spells\\Undead\\Unsummon\\UnsummonTarget.mdx", "body", f32(0.7)) },
    down: { spell: "Frost Armor", startup: cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualCaster.mdx", "feet", f32(0.6)), active: cue("Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorDamage.mdx", "body", f32(1.2)) },
  },
  [Character.uther]: {
    neutral: { spell: "Hammer of Justice", startup: HOLY, active: cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", 1.0) },
    side: { spell: "Holy Radiance", startup: cue("Abilities\\Spells\\Human\\InnerFire\\InnerFireTarget.mdx", "body", f32(0.8)), active: cue("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", "ahead", 1.0) },
    up: { spell: "Ascension", startup: HOLY, active: cue("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", "feet", 0.25) },
    down: { spell: "Divine Shield", startup: HOLY, active: cue("Abilities\\Spells\\Human\\DivineShield\\DivineShieldTarget.mdx", "body", f32(0.7)) },
  },
  [Character.dreadlord]: {
    neutral: { spell: "Carrion Swarm", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmDamage.mdx", "hand", f32(0.8)) },
    side: { spell: "Corkscrew Pounce", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmMissile.mdx", "behind", f32(0.8)) },
    up: { spell: "Bat Ascension", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\DarkSummoning\\DarkSummonTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Sleep", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\Sleep\\SleepSpecialArt.mdx", "hand", f32(0.8)) },
  },
  [Character.shadowHunter]: {
    neutral: { spell: "Spirit Glaive", startup: VOODOO, active: cue("Abilities\\Spells\\Orc\\HealingWave\\HealingWaveTarget.mdx", "hand", f32(0.6)) },
    side: { spell: "Serpent Ward", startup: VOODOO, active: cue("Abilities\\Spells\\Orc\\StasisTrap\\StasisTotemTarget.mdx", "ahead", f32(0.7)) },
    up: { spell: "Loa Vault", startup: cue("Abilities\\Spells\\Orc\\SpiritLink\\SpiritLinkTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritDone.mdx", "feet", f32(0.8)) },
    down: { spell: "Hex", startup: VOODOO, active: cue("Abilities\\Spells\\Human\\Polymorph\\PolymorphTarget.mdx", "hand", f32(0.6)) },
  },
  [Character.pitLord]: {
    neutral: { spell: "Howl of Terror", startup: FEL, active: cue("Abilities\\Spells\\Other\\HowlOfTerror\\HowlCaster.mdx", "body", 1.0) },
    side: { spell: "Ruin Charge", startup: FEL, active: cue("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx", "ahead", f32(0.8)) },
    up: { spell: "Abyssal Leap", startup: FEL, active: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "feet", f32(0.6)) },
    down: { spell: "Rain of Fire", startup: FEL, active: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", "overhead", f32(0.25)) },
  },
  [Character.lichKing]: {
    neutral: { spell: "Howling Blast", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx", "hand", 1.0) },
    side: { spell: "Val'kyr Shadowguard", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", "ahead", f32(0.8)) },
    up: { spell: "Ascension of the Damned", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", "body", f32(0.8)) },
    down: { spell: "Defile", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx", "feet", f32(0.4)) },
  },
  [Character.beastmaster]: {
    neutral: { spell: "Wild Axes", startup: BEAST, active: cue("Abilities\\Weapons\\Axe\\AxeMissile.mdx", "hand", 1.0) },
    side: { spell: "Summon Bear", startup: BEAST, active: cue("Abilities\\Spells\\NightElf\\Rejuvenation\\RejuvenationTarget.mdx", "ahead", f32(0.8)) },
    up: { spell: "Summon Hawk", startup: BEAST, active: cue("Abilities\\Weapons\\HarpyMissile\\HarpyMissile.mdx", "body", 1.0) },
    down: { spell: "Summon Quilbeast", startup: BEAST, active: cue("Abilities\\Spells\\Orc\\Ensnare\\EnsnareMissile.mdx", "hand", f32(0.6)) },
  },
};

// Illidan's cues (#147) start where their models draw, read from each model's
// keys: Death Coil special art's only sequence (Stand, once) draws nothing for
// 0.07 s and bursts 0.3-0.6 s, so the five-frame tell starts at 0.3 s; Breath
// of Fire missile and Volcano death have only a Birth, drawn 0-0.5 s; the
// missiles' and Moon Glaive's Stand draw from 0 s.
/** Fel Rush's tell, and the start of each of its branches. */
const FEL_TELL = timed(cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "body", 0.5), "stand", f32(0.3));

// Illidan's own effects (render/specialEffects.ts) already show his specials.
const MANA_BURN_HAND = "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx";
const FEL_FLAMES = "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx";

/** The original fighters' specials, by action. */
export const ORIGINAL_CUES: { readonly [action: number]: MoveCues } = {
  [SpecialAction.archerArrow]: { spell: "Arrow", startup: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallTarget.mdx", "hand", 0.5), active: cue("Abilities\\Spells\\NightElf\\FaerieFire\\FaerieFireTarget.mdx", "hand", f32(0.6)) },
  [SpecialAction.archerHomingArrow]: { spell: "Searing homing arrow", startup: cue("Abilities\\Spells\\NightElf\\MoonWell\\MoonWellCasterArt.mdx", "feet", 0.5), active: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallTarget.mdx", "hand", f32(0.7)) },
  [SpecialAction.archerDisengage]: { spell: "Hippogryph call", startup: cue("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", "body", 0.5), active: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallCaster.mdx", "feet", f32(0.4)) },
  [SpecialAction.archerRecovery]: { spell: "Hippogryph ride", startup: cue("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", "body", 0.5), active: cue("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", "feet", 0.5) },
  [SpecialAction.riflemanBlaster]: { spell: "Blaster", startup: drawn(RIFLEMAN_MODEL_FILE, "barrel"), active: cue("Abilities\\Weapons\\GyroCopter\\GyroCopterImpact.mdx", "barrel", 0.5) },
  [SpecialAction.riflemanBear]: { spell: "Summon Bear", startup: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritTarget.mdx", "ahead", f32(0.8)) },
  [SpecialAction.riflemanRecovery]: { spell: "Recoil Shot", startup: cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), active: cue("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", "feet", f32(0.4)) },
  [SpecialAction.riflemanTrap]: { spell: "Frost Trap", startup: cue("Abilities\\Spells\\Human\\Slow\\SlowCaster.mdx", "body", f32(0.6)), active: cue("Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx", "feet", f32(0.4)) },
  [SpecialAction.demonHunterManaBurn]: { spell: "Mana Burn", startup: drawn(MANA_BURN_HAND, "hand"), active: cue("Abilities\\Spells\\Human\\Feedback\\SpellBreakerAttack.mdx", "hand", 1.0) },
  // The fel streak of his Metamorphosis missile trails the rush.
  [SpecialAction.demonHunterFelRush]: { spell: "Fel Rush", startup: FEL_TELL, active: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", "body", 1.0), "stand", 0.0) },
  [SpecialAction.demonHunterWingAscent]: { spell: "Metamorphosis wings", startup: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0), active: cue("Abilities\\Spells\\Other\\Silence\\SilenceAreaBirth.mdx", "feet", f32(0.3)) },
  [SpecialAction.demonHunterImmolate]: { spell: "Immolation", startup: drawn(FEL_FLAMES, "body"), active: drawn(FEL_FLAMES, "body") },
};


/**
 * A branch's cues: its own spell, "slot" when it is deliberately its
 * special's own spell again, or "none" when it shows nothing (a dropped charge;
 * Lua drops a null array entry, so the absence is a word).
 */
export type BranchCue = MoveCues | "slot" | "none";

/** The branches of a hero special: its recall and marked forms and each follow-up, in `followUps` order. */
export interface HeroBranchCues {
  readonly recall?: BranchCue | undefined;
  readonly marked?: BranchCue | undefined;
  readonly followUps?: readonly BranchCue[] | undefined;
}

const branch = (spell: string, startup: Cue, active: Cue): MoveCues => ({ spell, startup, active });

/** Every hero branch names its cue; specialCues.tests.ts checks each authored branch has one. */
export const HERO_BRANCH_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]?: HeroBranchCues } } = {
  [Character.jaina]: {
    down: { recall: branch("Recall Water Elemental", ARCANE, cue("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportCaster.mdx", "body", 0.5)) },
  },
  [Character.blademaster]: {
    side: { followUps: [
      branch("Backstab", BLOODLUST, cue("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", "ahead", 0.5)),
      branch("Step Out", BLOODLUST, cue("Abilities\\Spells\\Orc\\EtherealForm\\SpiritWalkerChange.mdx", "body", f32(0.7))),
    ] },
    down: { recall: branch("Image Swap", BLOODLUST, cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageMissile.mdx", "body", 1.0)) },
  },
  [Character.mountainKing]: {
    neutral: { recall: branch("Storm Bolt recall", STORM, cue("Abilities\\Spells\\Orc\\LightningShield\\LightningShieldBuff.mdx", "hand", f32(0.8))) },
    up: { followUps: [branch("Hammerfall", STORM, cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", f32(0.8)))] },
    // The small Clap, the full Thunder Clap (its special's own spell) and a dropped charge.
    down: { followUps: [branch("Small Clap", STORM, cue("Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx", "feet", f32(0.3))), "slot", "none"] },
  },
  [Character.warden]: {
    side: { marked: branch("Shadow Pursuit", SHADOW, cue("Abilities\\Spells\\Undead\\Possession\\PossessionTarget.mdx", "body", f32(0.6))) },
  },
  [Character.lich]: {
    neutral: { recall: branch("Frost Nova burst", FROST, cue("Abilities\\Spells\\Other\\BreathOfFrost\\BreathOfFrostTarget.mdx", "hand", f32(0.6))) },
    down: { recall: branch("Dark Ritual", FROST, cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualTarget.mdx", "body", 1.0)) },
  },
  [Character.shadowHunter]: {
    side: { recall: branch("Ward recall", VOODOO, cue("Abilities\\Spells\\Orc\\AncestralSpirit\\AncestralSpiritCaster.mdx", "ahead", 0.5)) },
  },
  [Character.beastmaster]: {
    up: { recall: branch("Hawk Dive", BEAST, BEAST) },
    side: { recall: branch("Stampede", BEAST, cue("Abilities\\Spells\\Other\\Stampede\\StampedeMissile.mdx", "ahead", f32(0.6))) },
    down: { recall: branch("Quill Volley", BEAST, cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAuraTarget.mdx", "body", f32(0.8))) },
  },
};

/** An original special's branch form: its cues and its active frames (special frames, inclusive). */
export interface OriginalBranch {
  readonly cues: MoveCues;
  readonly first: number;
  readonly last: number;
}

// Two glaives: the moon-glaive whirl across his strike frames, on the ground or in the air.
const CHAOS_STRIKE_CUES: OriginalBranch = { cues: branch("Chaos Strike", FEL_TELL, timed(cue("Abilities\\Spells\\NightElf\\MoonGlaive\\MoonGlaiveCaster.mdx", "ahead", 1.0), "stand", 0.0)), first: CHAOS_STRIKE_FIRST, last: CHAOS_STRIKE_LAST };

/** The original fighters' branch forms, by action and form; form 0 keeps the action's own cues. */
export const ORIGINAL_BRANCH_CUES: { readonly [action: number]: { readonly [form: number]: OriginalBranch } } = {
  [SpecialAction.demonHunterFelRush]: {
    // A fel backflip: the possession streak trails his vault.
    [VENGEFUL_RETREAT_FORM]: { cues: branch("Vengeful Retreat", FEL_TELL, timed(cue("Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx", "body", 1.0), "stand", 0.0)), first: 1, last: VENGEFUL_RETREAT_MOVE_LAST },
    [CHAOS_STRIKE_FORM]: CHAOS_STRIKE_CUES,
    [CHAOS_STRIKE_AIR_FORM]: CHAOS_STRIKE_CUES,
  },
  // Flame Crash: a fire streak through its hang and plunge, then a volcanic burst where it lands.
  [SpecialAction.demonHunterImmolate]: {
    [FLAME_CRASH_FORM]: { cues: branch("Flame Crash", FEL_TELL, timed(cue("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx", "body", 1.0), "birth", 0.0)), first: 1, last: FLAME_CRASH_FRAMES },
    [FLAME_CRASH_LANDING_FORM]: { cues: branch("Flame Crash landing", FEL_TELL, timed(cue("Abilities\\Spells\\Other\\Volcano\\VolcanoDeath.mdx", "feet", f32(0.6)), "birth", 0.0)), first: 1, last: FLAME_CRASH_BURST_LAST },
  },
  [SpecialAction.demonHunterWingAscent]: {
    [DEMONHUNTER_GLIDE_SLASH_FORM]: { cues: branch("Glide slash", FEL_TELL, cue("Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx", "ahead", f32(0.8))), first: 1, last: 1 },
  },
  [SpecialAction.archerDisengage]: {
    [ARCHER_DIVE_FORM]: { cues: branch("Hippogryph dive", cue("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", "body", 0.5), cue("Abilities\\Weapons\\DruidOfTheTalonMissile\\DruidOfTheTalonMissile.mdx", "feet", 1.0)), first: ARCHER_DIVE_LAUNCH_FRAME, last: ARCHER_DIVE_LAUNCH_FRAME },
  },
  [SpecialAction.riflemanRecovery]: {
    [RIFLEMAN_SECOND_SHOT_FORM]: { cues: branch("Second recoil shot", cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), cue("Abilities\\Weapons\\SteamTank\\SteamTankImpact.mdx", "feet", 1.0)), first: 1, last: 1 },
  },
};

/** A special's startup and active frames, special frames inclusive (the entry tick is frame 1). */
export interface CueWindows {
  readonly startup: FrameWindow;
  readonly active: FrameWindow;
}

/** An active cue stays at least this long, so its spell plays through a one-frame release. */
export const ACTIVE_CUE_FRAMES = 18;

const widen = (window: { first: number; last: number }, first: number, last: number): void => {
  window.first = Math.min(window.first, first);
  window.last = Math.max(window.last, last);
};

/**
 * A hero special's active frames: every frame it strikes, moves, places,
 * releases, grabs, guards or is armored or intangible, from the first to the
 * last; startup is everything before.
 */
export function heroCueWindows(move: Readonly<AuthoredSpecial>, minimumActive = ACTIVE_CUE_FRAMES): CueWindows {
  // Past any action's last frame, and a 32-bit integer in Lua.
  const active = { first: 1000000, last: 0 };
  // Regions count zero-based attack frames: special frame N strikes with region frame N - 1.
  for (const region of move.regions ?? []) widen(active, region.firstFrame + 1, region.lastFrame + 1);
  for (const projectile of move.projectiles ?? []) widen(active, projectile.spawnFrame, projectile.spawnFrame);
  for (const segment of move.motion ?? []) widen(active, segment.first, segment.last);
  if (move.placement !== undefined) widen(active, move.placement.frame, move.placement.frame);
  if (move.burst !== undefined) widen(active, move.burst.frame, move.burst.frame);
  if (move.ritual !== undefined) widen(active, move.ritual.frame, move.ritual.frame);
  if (move.commandGrab !== undefined) widen(active, move.commandGrab.first, move.commandGrab.last);
  if (move.guard !== undefined) widen(active, move.guard.first, move.guard.last);
  if (move.intangible !== undefined) widen(active, move.intangible.first, move.intangible.last);
  // A shell armor lasts long after the cast; its cue marks the cast.
  if (move.armor !== undefined) widen(active, move.armor.first, move.armor.shell === true ? move.armor.first : move.armor.last);
  if (active.last === 0) widen(active, 1, 1);
  const first = Math.max(1, active.first);
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.min(move.endFrame, Math.max(active.last, first + minimumActive - 1)) } };
}

/** The frame an original special releases or starts its effect, by action. */
function originalActiveFrame(action: number, grounded: boolean): number {
  switch (action) {
    case SpecialAction.archerArrow: return ARCHER_ARROW_SHOT_FRAME;
    case SpecialAction.archerHomingArrow: return ARCHER_HOMING_WINDUP_FRAMES;
    case SpecialAction.archerDisengage: return ARCHER_DIVE_LAUNCH_FRAME;
    case SpecialAction.archerRecovery: return ARCHER_RIDE_HOVER_FRAMES;
    case SpecialAction.riflemanBlaster: return grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR_CAST_FRAMES;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY_STARTUP_FRAMES;
    case SpecialAction.riflemanTrap: return 2;
    case SpecialAction.demonHunterManaBurn: return DEMONHUNTER_MANA_BURN_STARTUP;
    case SpecialAction.demonHunterFelRush: return FEL_RUSH_FIRST;
    case SpecialAction.demonHunterWingAscent: return DEMONHUNTER_WING_STARTUP;
    case SpecialAction.demonHunterImmolate: return DEMONHUNTER_IMMOLATE_STARTUP;
    default: return 1;
  }
}

/** An original special's windows; its active frames last through its window or ACTIVE_CUE_FRAMES. */
export function originalCueWindows(action: number, grounded: boolean): CueWindows {
  const first = originalActiveFrame(action, grounded);
  const authoredLast = action === SpecialAction.demonHunterFelRush ? FEL_RUSH_LAST
    : action === SpecialAction.demonHunterImmolate ? DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE - 1 : first;
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.max(authoredLast, first + ACTIVE_CUE_FRAMES - 1) } };
}

/** Which of a fighter's cues its running special shows now. */
export interface CueState {
  readonly cues: MoveCues | undefined;
  readonly phase: "none" | "startup" | "active";
}

const NONE: CueState = { cues: undefined, phase: "none" };

/** The cues a fighter's running special shows on its current frame. */
export function specialCueState(fighter: Readonly<Fighter>): CueState {
  const { action, frame } = fighter.special;
  if (action === SpecialAction.none || fighter.status.out) return NONE;
  if (fighter.character === Character.dreadlord && action === SpecialAction.heroSide && fighter.special.grabFrame > 0) {
    return frame <= fighter.special.grabFrame + 16 ? { cues: DREADLORD_BITE_CUES, phase: "active" } : NONE;
  }
  let cues: MoveCues | undefined;
  let windows: CueWindows | undefined;
  if (action >= SpecialAction.heroNeutral && action <= SpecialAction.heroDown) {
    const move = runningHeroSpecial(fighter);
    const slot = SPECIAL_SLOTS[action - SpecialAction.heroNeutral] ?? "neutral";
    const branchCue = heroBranchCue(HERO_BRANCH_CUES[fighter.character]?.[slot], fighter.special.form);
    if (branchCue === "none") return NONE;
    cues = branchCue === undefined || branchCue === "slot" ? HERO_CUES[fighter.character]?.[slot] : branchCue;
    windows = move === undefined ? undefined : heroCueWindows(move);
  } else {
    const branch = ORIGINAL_BRANCH_CUES[action]?.[fighter.special.form];
    cues = branch === undefined ? ORIGINAL_CUES[action] : branch.cues;
    windows = branch === undefined ? originalCueWindows(action, fighter.motion.grounded) : branchWindows(branch);
  }
  if (cues === undefined || windows === undefined) return NONE;
  if (frame >= windows.active.first && frame <= windows.active.last) return { cues, phase: "active" };
  if (frame >= windows.startup.first && frame <= windows.startup.last) return { cues, phase: "startup" };
  return { cues, phase: "none" };
}

/** The original fighters' special actions. */
const ORIGINAL_ACTIONS: { readonly [character: number]: readonly SpecialAction[] } = {
  [Character.archer]: [SpecialAction.archerArrow, SpecialAction.archerHomingArrow, SpecialAction.archerDisengage, SpecialAction.archerRecovery],
  [Character.rifleman]: [SpecialAction.riflemanBlaster, SpecialAction.riflemanBear, SpecialAction.riflemanRecovery, SpecialAction.riflemanTrap],
  [Character.demonHunter]: [SpecialAction.demonHunterManaBurn, SpecialAction.demonHunterFelRush, SpecialAction.demonHunterWingAscent, SpecialAction.demonHunterImmolate],
};

/** Every special's cues for one fighter, in input order. */
export function fighterMoveCues(character: Character): readonly MoveCues[] {
  const hero = HERO_CUES[character];
  if (hero !== undefined) return SPECIAL_SLOTS.map((slot) => hero[slot]);
  return (ORIGINAL_ACTIONS[character] ?? []).flatMap((action) => ORIGINAL_CUES[action] ?? []);
}

/** Every cue a fighter's specials and their branches can show, startup and active. */
export function fighterCueList(character: Character): readonly Cue[] {
  return [...fighterMoveCues(character), ...fighterBranchCues(character), ...(character === Character.dreadlord ? [DREADLORD_BITE_CUES] : [])].flatMap((cues) => [cues.startup, cues.active]);
}

/** Every branch cue a fighter can show. */
export function fighterBranchCues(character: Character): readonly MoveCues[] {
  const out: MoveCues[] = [];
  const add = (cue: BranchCue | undefined): void => {
    if (cue !== undefined && cue !== "none" && cue !== "slot" && !out.includes(cue)) out.push(cue);
  };
  for (const slot of SPECIAL_SLOTS) {
    const branches = HERO_BRANCH_CUES[character]?.[slot];
    add(branches?.recall);
    add(branches?.marked);
    for (const cue of branches?.followUps ?? []) add(cue);
  }
  for (const action of ORIGINAL_ACTIONS[character] ?? []) for (const branch of Object.values(ORIGINAL_BRANCH_CUES[action] ?? {})) add(branch.cues);
  return out;
}

/** Every model a cue draws itself, every fighter's. */
export function allCueModels(): readonly string[] {
  const models: string[] = [];
  const characters: readonly Character[] = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];
  for (const character of characters) for (const cue of fighterCueList(character)) if (cue.drawn !== true && !models.includes(cue.model)) models.push(cue.model);
  return models;
}

/** The cues a fighter's renderer draws itself, one effect each: its own effects show the rest. */
export function fighterOwnCues(character: Character): readonly Cue[] {
  const own: Cue[] = [];
  for (const cue of fighterCueList(character)) if (cue.drawn !== true && !own.includes(cue)) own.push(cue);
  return own;
}

/** The cue a running hero form names: undefined for a base form, which shows its special's. */
export function heroBranchCue(branches: Readonly<HeroBranchCues> | undefined, form: number): BranchCue | undefined {
  if (form >= FOLLOW_UP_FORM) return branches?.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1];
  if (form === SpecialForm.recall) return branches?.recall;
  if (form === SpecialForm.marked) return branches?.marked;
  return undefined;
}

/** An original branch's windows: startup before its active frames, which last at least ACTIVE_CUE_FRAMES. */
function branchWindows(branch: Readonly<OriginalBranch>): CueWindows {
  return { startup: { first: 1, last: Math.max(1, branch.first - 1) }, active: { first: branch.first, last: Math.max(branch.last, branch.first + ACTIVE_CUE_FRAMES - 1) } };
}
