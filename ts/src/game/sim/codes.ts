// Numeric state codes. Replay snapshots serialize these values into their
// checksums, so each number is canonical and must equal the Wurst constant.

/** Codes 3-9 are the roster expansion (smashcraft:docs/design/roster.md), defined in sim/heroes/registry.ts. */
export const Character = {
  archer: 0, rifleman: 1, demonHunter: 2,
  blademaster: 3, mountainKing: 4, warden: 5, lich: 6, uther: 7, dreadlord: 8, shadowHunter: 9,
} as const;
export type Character = (typeof Character)[keyof typeof Character];

/** Dash, run and their turn and brake animations. */
export const GroundAction = { none: 0, dash: 1, run: 2, turnRun: 3, runBrake: 4 } as const;
export type GroundAction = (typeof GroundAction)[keyof typeof GroundAction];

/** Shield break: launched, landing, standing up, then dizzy until mashed out. */
export const ShieldBreak = { none: 0, air: 1, land: 2, stand: 3, dizzy: 4 } as const;
export type ShieldBreak = (typeof ShieldBreak)[keyof typeof ShieldBreak];

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

/**
 * Character specials. Demon Hunter actions have their own IDs so renderer
 * bindings cannot silently map them to another fighter's clips.
 */
export const SpecialAction = {
  none: 0,
  archerArrow: 1,
  archerMultishot: 2,
  archerDisengage: 3,
  archerRecovery: 4,
  riflemanBear: 5,
  riflemanRecovery: 6,
  riflemanBlaster: 7,
  riflemanTrap: 8,
  demonHunterManaBurn: 9,
  demonHunterParryStep: 10,
  demonHunterWingAscent: 11,
  demonHunterImmolate: 12,
  /** Expansion heroes run their authored kit (sim/heroSpecials.ts) under these four actions. */
  heroNeutral: 13,
  heroSide: 14,
  heroUp: 15,
  heroDown: 16,
} as const;
export type SpecialAction = (typeof SpecialAction)[keyof typeof SpecialAction];

/** One cooldown per original special action, indexed by its code; hero actions spend mana instead. */
export const SPECIAL_ACTION_CAPACITY = 13;

/** A hero projectile carries its authored record in Projectile.spec. */
export const ProjectileKind = { blaster: 0, arrow: 1, fanArrow: 2, recoil: 3, manaBurn: 4, hero: 5 } as const;
export type ProjectileKind = (typeof ProjectileKind)[keyof typeof ProjectileKind];

/** Spawned cover strikes once; a mount carries its archer and ends with the action. */
export const HippogryphKind = { none: 0, strike: 1, mount: 2 } as const;
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
} as const;
export type AttackStyle = (typeof AttackStyle)[keyof typeof AttackStyle];

export const DASH_GRAB_REQUEST = 11;

/** How a queued damage contact affects its target. */
export const ContactKind = { launch: 0, flinch: 1, damageOnly: 2, pummel: 3, throw: 4 } as const;
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];

/** A contact's element: presentation of hit and shield effects. Hero kits import it here, apart from hit regions' runtime graph. */
export const HitElement = { normal: 0, fire: 1, electric: 2, slash: 3, ice: 5 } as const;
export type HitElement = (typeof HitElement)[keyof typeof HitElement];

/** Hero statuses (sim/heroStatus.ts) a body hit applies. Append only: the code is in replay text. */
export const HeroStatusKind = { none: 0, sleep: 1 } as const;
export type HeroStatusKind = (typeof HeroStatusKind)[keyof typeof HeroStatusKind];

/**
 * Hero status immunity groups: a status ending in a group makes its fighter
 * immune to every status of that group for the authored frames. Hex and
 * silence are meant to share one group.
 */
export const HeroStatusGroup = { sleep: 0, silence: 1 } as const;
export type HeroStatusGroup = (typeof HeroStatusGroup)[keyof typeof HeroStatusGroup];
export const HERO_STATUS_GROUPS = 2;
