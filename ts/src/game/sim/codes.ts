// Numeric state codes. Replay snapshots serialize these values into their
// checksums, so each number is canonical and must equal the Wurst constant.

/** Codes 3 and up are the roster expansion (smashcraft:docs/design/roster.md), defined in sim/heroes/registry.ts. */
export const Character = {
  archer: 0, rifleman: 1, demonHunter: 2,
  blademaster: 3, mountainKing: 4, warden: 5, lich: 6, uther: 7, dreadlord: 8, shadowHunter: 9,
  pitLord: 10, beastmaster: 11, lichKing: 12, thrall: 13, jaina: 14, sylvanas: 15,
} as const;
export type Character = (typeof Character)[keyof typeof Character];

/** Dash, run and their turn and brake animations. */
export const GroundAction = { none: 0, dash: 1, run: 2, turnRun: 3, runBrake: 4 } as const;
export type GroundAction = (typeof GroundAction)[keyof typeof GroundAction];

/** Shield break: launched, landing, standing up, then dizzy until mashed out. */
export const ShieldBreak = { none: 0, air: 1, land: 2, stand: 3, dizzy: 4 } as const;
export type ShieldBreak = (typeof ShieldBreak)[keyof typeof ShieldBreak];

/** An option pressed during a parried hit's freeze, started on its first actionable frame; attacks wait in the attack buffer. */
export const ParryBuffer = { none: 0, jump: 1, groundDodge: 2 } as const;
export type ParryBuffer = (typeof ParryBuffer)[keyof typeof ParryBuffer];

/** Tumble and every grounded state that follows a knockdown or a floor tech. */
export const DownState = {
  none: 0,
  tumble: 1,
  bound: 2,
  wait: 3,
  stand: 4,
  roll: 5,
  attack: 6,
  tech: 7,
  techRoll: 8,
  damage: 9,
} as const;
export type DownState = (typeof DownState)[keyof typeof DownState];

/** Wall and ceiling contacts, and the techs that recover from them. */
export const SurfaceContact = { none: 0, wall: 1, ceiling: 2, techWall: 3, techCeiling: 4 } as const;
export type SurfaceContact = (typeof SurfaceContact)[keyof typeof SurfaceContact];

/** The grabber's action; throws are 3-6 and a mashed-out release is 7. */
export const GrabAction = {
  none: 0,
  hold: 1,
  pummel: 2,
  throwForward: 3,
  throwBack: 4,
  throwUp: 5,
  throwDown: 6,
  escape: 7,
} as const;
export type GrabAction = (typeof GrabAction)[keyof typeof GrabAction];

export const LedgeState = { none: 0, hang: 1, climb: 2, roll: 3, attack: 4 } as const;
export type LedgeState = (typeof LedgeState)[keyof typeof LedgeState];

/** Passing through a pass-through platform (platformMoves.ts): up through it, down through it, or around its edge onto or under it. */
export const PlatformMove = { none: 0, ascent: 1, descent: 2, wrapOver: 3, wrapUnder: 4 } as const;
export type PlatformMove = (typeof PlatformMove)[keyof typeof PlatformMove];

/**
 * Character specials. Demon Hunter actions have their own IDs so renderer
 * bindings cannot silently map them to another fighter's clips.
 */
export const SpecialAction = {
  none: 0,
  archerArrow: 1,
  archerHomingArrow: 2,
  archerDisengage: 3,
  archerRecovery: 4,
  riflemanBear: 5,
  riflemanRecovery: 6,
  riflemanBlaster: 7,
  riflemanTrap: 8,
  demonHunterManaBurn: 9,
  demonHunterFelRush: 10,
  demonHunterWingAscent: 11,
  demonHunterImmolate: 12,
  /** Expansion heroes run their authored kit (sim/heroSpecials.ts) under these four actions. */
  heroNeutral: 13,
  heroSide: 14,
  heroUp: 15,
  heroDown: 16,
} as const;
export type SpecialAction = (typeof SpecialAction)[keyof typeof SpecialAction];

/** One cooldown per special input, indexed by its code; hero kits author their own costs and waits. */
export const SPECIAL_ACTION_CAPACITY = 17;

/** A hero projectile carries its authored record in Projectile.spec. */
export const ProjectileKind = { blaster: 0, arrow: 1, homingArrow: 2, recoil: 3, manaBurn: 4, hero: 5 } as const;
export type ProjectileKind = (typeof ProjectileKind)[keyof typeof ProjectileKind];

/**
 * Archer's one hippogryph: a swoop strikes each fighter once and ends on a
 * perch; a mount carries its archer and ends with the ride; a dive leaves the
 * perch at its archer; a released hippogryph flies on after a leap-off.
 */
export const HippogryphKind = { none: 0, strike: 1, mount: 2, perch: 3, dive: 4, released: 5 } as const;
export type HippogryphKind = (typeof HippogryphKind)[keyof typeof HippogryphKind];

/** How an airborne hitstun landing resolves (NTSC 1.02 common +0x1E4/+0x1E0). */
export const DamageLanding = { retainStun: 1, normal: 2, knockdown: 3 } as const;
export type DamageLanding = (typeof DamageLanding)[keyof typeof DamageLanding];

export const AttackPhase = { none: 0, startup: 1, active: 2, recovery: 3 } as const;
export type AttackPhase = (typeof AttackPhase)[keyof typeof AttackPhase];

/**
 * Action IDs shared with move data, command buffers and poses. Style 11 is the
 * get-up attack once started; as a request to begin an attack it asks for a
 * dash or shield grab (DASH_GRAB_REQUEST), which starts AttackStyle.grab.
 */
export const AttackStyle = {
  jab: 0,
  shot: 1,
  upSmash: 2,
  downSmash: 3,
  forwardSmash: 4,
  grab: 5,
  forwardTilt: 6,
  upTilt: 7,
  downTilt: 8,
  forwardTiltUp: 9,
  forwardTiltDown: 10,
  getupAttack: 11,
  neutralAir: 12,
  forwardAir: 13,
  backAir: 14,
  upAir: 15,
  downAir: 16,
  ledgeAttack: 17,
  demonHunterDashAttack: 18,
  dashAttack: 19,
  // The jab chain (#163): Melee's Attack12 and Attack13, each started by a fresh jab press in the previous jab's window.
  jab2: 20,
  jab3: 21,
} as const;
export type AttackStyle = (typeof AttackStyle)[keyof typeof AttackStyle];
/** The highest AttackStyle code: loops over every style run through it. */
export const LAST_ATTACK_STYLE = AttackStyle.jab3;

export const DASH_GRAB_REQUEST = 11;

/** How a queued damage contact affects its target. */
export const ContactKind = { launch: 0, flinch: 1, damageOnly: 2, pummel: 3, throw: 4 } as const;
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];

/**
 * A contact's element: presentation of hit and shield effects, never of its
 * outcome (hitlag follows HitEffect.electric). Melee's numbers for its elements
 * (docs/design/melee/hit-effects.md, dark 13); Warcraft's own schools from 20.
 * Hero kits import it here, apart from hit regions' runtime graph.
 */
export const HitElement = { normal: 0, fire: 1, electric: 2, slash: 3, ice: 5, dark: 13, holy: 20, poison: 21, arcane: 22 } as const;
export type HitElement = (typeof HitElement)[keyof typeof HitElement];

/** Hero statuses (sim/heroStatus.ts) a body hit applies. Append only: the code is in replay text. */
export const HeroStatusKind = { none: 0, sleep: 1, poison: 2, hex: 3, stun: 4, chill: 5, carried: 7, silence: 8 } as const;
export type HeroStatusKind = (typeof HeroStatusKind)[keyof typeof HeroStatusKind];

/**
 * Hero status immunity groups: a status ending in a group makes its fighter
 * immune to every status of that group for the authored frames. Hex and
 * silence share one group.
 */
export const HeroStatusGroup = { sleep: 0, silence: 1, chill: 2 } as const;
export type HeroStatusGroup = (typeof HeroStatusGroup)[keyof typeof HeroStatusGroup];
export const HERO_STATUS_GROUPS = 3;

/** Competitive pickups (#196, match/items.ts, sim/itemBuffs.ts). Append only: the code is in replay text. */
export const ItemKind = { none: 0, speed: 1, extraJump: 2, heavy: 3 } as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];
export const ITEM_KINDS: readonly ItemKind[] = [ItemKind.speed, ItemKind.extraJump, ItemKind.heavy];
/** Each kind's bit in a match's enabled-items mask. */
export const itemBit = (kind: ItemKind): number => kind === ItemKind.none ? 0 : 1 << (kind - 1);
export const ALL_ITEMS_MASK = 7;

/** Each fighter's one passive (sim/passives.ts, #148). */
export const PassiveKind = {
  none: 0, criticalStrike: 1, bash: 2, blink: 3, trueshot: 4, longRifles: 5, frostArmor: 6, devotion: 7, vampiric: 8, voodoo: 9, cleave: 10, packHunt: 11, souls: 12,
} as const;
export type PassiveKind = (typeof PassiveKind)[keyof typeof PassiveKind];

/**
 * What delivered a contact, as passives count it: a strike from the body, a
 * throw or pummel, a summon's attack, a projectile (arrows, the blaster and
 * the projectiles a passive feeds on by their own codes), or one the owner
 * didn't fire (a reflection), which no passive counts.
 */
export const HitOrigin = { melee: 0, throw: 1, pummel: 2, summon: 3, projectile: 4, arrow: 5, blaster: 6, voodoo: 7, foreign: 8 } as const;
export type HitOrigin = (typeof HitOrigin)[keyof typeof HitOrigin];
