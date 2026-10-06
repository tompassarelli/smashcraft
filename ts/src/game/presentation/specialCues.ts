// What every special shows on its startup and on its active frames: a stock
// Warcraft spell effect at a body anchor, so a viewer can tell which move it is
// and when it is dangerous (#144). Each hero's startup uses its own colour of
// cast flash and each move its own Warcraft spell; the window comes from the
// kit's authored frames, never from the drawn clip. Presentation only.
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import type { AuthoredSpecial, FrameWindow } from "../sim/heroSpecials";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { HERO_ROSTER } from "../sim/heroes/registry";
import {
  ARCHER_DIVE_LAUNCH_FRAME,
  ARCHER_HOMING_WINDUP_FRAMES,
  ARCHER_RIDE_HOVER_FRAMES,
  DEMONHUNTER_IMMOLATE_ACTIVE,
  DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_MANA_BURN_STARTUP,
  DEMONHUNTER_WING_STARTUP,
  FEL_RUSH_FIRST,
  FEL_RUSH_LAST,
  RIFLEMAN_BEAR_CAST_FRAMES,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES,
} from "../sim/specials";
import { IMPACT_TECH_MODEL } from "../assets/impactAssetInfo";
import { SPECIAL_SLOTS, type SpecialSlot } from "./projectileArt";

/** Where a cue stands, facing-relative, in the fighter's model scale. */
export type CueAnchor = "hand" | "body" | "feet" | "ahead" | "overhead";

export const CUE_ANCHORS: { readonly [anchor in CueAnchor]: { readonly x: number; readonly z: number } } = {
  hand: { x: 40.0, z: 70.0 },
  body: { x: 0.0, z: 50.0 },
  feet: { x: 0.0, z: 2.0 },
  ahead: { x: 70.0, z: 45.0 },
  overhead: { x: 0.0, z: 125.0 },
};

export interface Cue {
  readonly model: string;
  readonly anchor: CueAnchor;
  readonly scale: number;
  /** Already drawn by the fighter's own special effects (render/specialEffects.ts). */
  readonly drawn?: boolean | undefined;
}

/** One special's cues: its Warcraft spell, what its startup shows and what its active frames show. */
export interface MoveCues {
  readonly spell: string;
  readonly startup: Cue;
  readonly active: Cue;
}

const cue = (model: string, anchor: CueAnchor, scale: number): Cue => ({ model, anchor, scale });
const drawn = (model: string, anchor: CueAnchor): Cue => ({ model, anchor, scale: 1.0, drawn: true });

// Each hero's cast flash, its colour: orc fury, storm, shadow, frost, holy light, vampiric, voodoo.
const BLOODLUST = cue("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustSpecial.mdx", "hand", f32(0.8));
const STORM = cue("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", "hand", 1.0);
const SHADOW = cue("Abilities\\Spells\\Undead\\Cripple\\CrippleTarget.mdx", "hand", f32(0.7));
const FROST = cue("Abilities\\Spells\\Undead\\ReplenishMana\\SpiritTouchTarget.mdx", "hand", f32(0.8));
const HOLY = cue("Abilities\\Spells\\Human\\Heal\\HealTarget.mdx", "hand", f32(0.7));
const VAMPIRIC = cue("Abilities\\Spells\\Undead\\UnholyFrenzy\\UnholyFrenzyTarget.mdx", "hand", f32(0.8));
const VOODOO = cue("Abilities\\Spells\\Orc\\TrollBerserk\\TrollBeserkerTarget.mdx", "hand", f32(0.7));

/** Every hero's four specials; every form of a special (air, free, follow-up, recall, marked) shows its special's cues. */
export const HERO_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]: MoveCues } } = {
  [Character.blademaster]: {
    neutral: { spell: "Wind Cutter", startup: BLOODLUST, active: cue("Abilities\\Spells\\Other\\Tornado\\Tornado_Target.mdx", "hand", f32(0.6)) },
    side: { spell: "Wind Walk", startup: cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", f32(0.8)), active: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", "ahead", f32(0.8)) },
    up: { spell: "Bladestorm rise", startup: BLOODLUST, active: cue("Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx", "body", f32(0.6)) },
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
    neutral: { spell: "Holy Bolt", startup: HOLY, active: cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", f32(0.6)) },
    side: { spell: "Crusader Rush", startup: cue("Abilities\\Spells\\Human\\InnerFire\\InnerFireTarget.mdx", "body", f32(0.8)), active: cue("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", "ahead", f32(0.6)) },
    up: { spell: "Ascension", startup: HOLY, active: cue("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", "feet", 0.25) },
    down: { spell: "Divine Shield", startup: HOLY, active: cue("Abilities\\Spells\\Human\\DivineShield\\DivineShieldTarget.mdx", "body", f32(0.7)) },
  },
  [Character.dreadlord]: {
    neutral: { spell: "Carrion Swarm", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmDamage.mdx", "hand", f32(0.8)) },
    side: { spell: "Night Pounce", startup: cue("Abilities\\Spells\\Other\\HowlOfTerror\\HowlCaster.mdx", "body", f32(0.4)), active: cue("Abilities\\Weapons\\Blood\\BloodImpact.mdx", "ahead", 1.0) },
    up: { spell: "Bat Ascension", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\DarkSummoning\\DarkSummonTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Sleep", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\Sleep\\SleepSpecialArt.mdx", "hand", f32(0.8)) },
  },
  [Character.shadowHunter]: {
    neutral: { spell: "Spirit Glaive", startup: VOODOO, active: cue("Abilities\\Spells\\Orc\\HealingWave\\HealingWaveTarget.mdx", "hand", f32(0.6)) },
    side: { spell: "Serpent Ward", startup: VOODOO, active: cue("Abilities\\Spells\\Orc\\StasisTrap\\StasisTotemTarget.mdx", "ahead", f32(0.7)) },
    up: { spell: "Loa Vault", startup: cue("Abilities\\Spells\\Orc\\SpiritLink\\SpiritLinkTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritDone.mdx", "feet", f32(0.8)) },
    down: { spell: "Hex", startup: VOODOO, active: cue("Abilities\\Spells\\Human\\Polymorph\\PolymorphTarget.mdx", "hand", f32(0.6)) },
  },
};

// Illidan's own effects (render/specialEffects.ts) already show his specials.
const MANA_BURN_HAND = "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx";
const FEL_FLAMES = "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx";

/** The original fighters' specials, by action. */
export const ORIGINAL_CUES: { readonly [action: number]: MoveCues } = {
  [SpecialAction.archerArrow]: { spell: "Arrow", startup: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallTarget.mdx", "hand", 0.5), active: cue("Abilities\\Spells\\NightElf\\FaerieFire\\FaerieFireTarget.mdx", "hand", f32(0.6)) },
  [SpecialAction.archerHomingArrow]: { spell: "Searing homing arrow", startup: cue("Abilities\\Spells\\NightElf\\MoonWell\\MoonWellCasterArt.mdx", "feet", 0.5), active: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallTarget.mdx", "hand", f32(0.7)) },
  [SpecialAction.archerDisengage]: { spell: "Hippogryph call", startup: cue("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", "body", 0.5), active: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallCaster.mdx", "feet", f32(0.4)) },
  [SpecialAction.archerRecovery]: { spell: "Hippogryph ride", startup: cue("Abilities\\Spells\\NightElf\\Taunt\\TauntCaster.mdx", "body", 0.5), active: cue("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", "feet", 0.5) },
  [SpecialAction.riflemanBlaster]: { spell: "Blaster", startup: cue("Abilities\\Spells\\Human\\Flare\\FlareCaster.mdx", "hand", 0.5), active: cue("Abilities\\Weapons\\GyroCopter\\GyroCopterImpact.mdx", "hand", 1.0) },
  [SpecialAction.riflemanBear]: { spell: "Summon Bear", startup: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritTarget.mdx", "ahead", f32(0.8)) },
  [SpecialAction.riflemanRecovery]: { spell: "Recoil Shot", startup: cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), active: cue("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", "feet", f32(0.4)) },
  [SpecialAction.riflemanTrap]: { spell: "Frost Trap", startup: cue("Abilities\\Spells\\Human\\Slow\\SlowCaster.mdx", "body", f32(0.6)), active: cue("Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx", "feet", f32(0.4)) },
  [SpecialAction.demonHunterManaBurn]: { spell: "Mana Burn", startup: drawn(MANA_BURN_HAND, "hand"), active: cue("Abilities\\Spells\\Human\\Feedback\\SpellBreakerAttack.mdx", "hand", 1.0) },
  [SpecialAction.demonHunterFelRush]: { spell: "Fel Rush", startup: cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "body", 0.5), active: drawn(IMPACT_TECH_MODEL, "hand") },
  [SpecialAction.demonHunterWingAscent]: { spell: "Metamorphosis wings", startup: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0), active: cue("Abilities\\Spells\\Other\\Silence\\SilenceAreaBirth.mdx", "feet", f32(0.3)) },
  [SpecialAction.demonHunterImmolate]: { spell: "Immolation", startup: drawn(FEL_FLAMES, "body"), active: drawn(FEL_FLAMES, "body") },
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
export function heroCueWindows(move: Readonly<AuthoredSpecial>): CueWindows {
  const active = { first: Number.MAX_SAFE_INTEGER, last: 0 };
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
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.min(move.endFrame, Math.max(active.last, first + ACTIVE_CUE_FRAMES - 1)) } };
}

/** The frame an original special releases or starts its effect, by action. */
function originalActiveFrame(action: number, grounded: boolean): number {
  switch (action) {
    case SpecialAction.archerArrow: return 2;
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
  let cues: MoveCues | undefined;
  let windows: CueWindows | undefined;
  if (action >= SpecialAction.heroNeutral && action <= SpecialAction.heroDown) {
    const move = runningHeroSpecial(fighter);
    cues = HERO_CUES[fighter.character]?.[SPECIAL_SLOTS[action - SpecialAction.heroNeutral] ?? "neutral"];
    windows = move === undefined ? undefined : heroCueWindows(move);
  } else {
    cues = ORIGINAL_CUES[action];
    windows = originalCueWindows(action, fighter.motion.grounded);
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

/** Every cue a fighter's specials can show, startup and active. */
export function fighterCueList(character: Character): readonly Cue[] {
  return fighterMoveCues(character).flatMap((cues) => [cues.startup, cues.active]);
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
