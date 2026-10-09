// Replay checksum state codes must equal the Wurst constants.



export const Character = { rifleman: 1, demonHunter: 2,
  blademaster: 3, mountainKing: 4, warden: 5, lich: 6, forsakenPaladin: 7, dreadlord: 8, shadowHunter: 9,
  pitLord: 10, beastmaster: 11, lichKing: 12, thrall: 13, jaina: 14, sylvanas: 15, cairne: 16, chen: 17, peon: 18, tinker: 19, kaelthas: 20, murloc: 21, grom: 22, anubarak: 23, malfurion: 24, medivh: 25, kobold: 26,
} as const;
export type Character = (typeof Character)[keyof typeof Character];


export const GroundAction = { none: 0, dash: 1, run: 2, turnRun: 3, runBrake: 4 } as const;
export type GroundAction = (typeof GroundAction)[keyof typeof GroundAction];


export const ShieldBreak = { none: 0, air: 1, land: 2, stand: 3, dizzy: 4 } as const;
export type ShieldBreak = (typeof ShieldBreak)[keyof typeof ShieldBreak];


export const ParryBuffer = { none: 0, jump: 1, groundDodge: 2 } as const;
export type ParryBuffer = (typeof ParryBuffer)[keyof typeof ParryBuffer];


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


export const SurfaceContact = { none: 0, wall: 1, ceiling: 2, techWall: 3, techCeiling: 4 } as const;
export type SurfaceContact = (typeof SurfaceContact)[keyof typeof SurfaceContact];


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


export const PlatformMove = { none: 0, ascent: 1, descent: 2 } as const;
export type PlatformMove = (typeof PlatformMove)[keyof typeof PlatformMove];





export const SpecialAction = {
  none: 0,
  riflemanBear: 5,
  riflemanRecovery: 6,
  riflemanBlaster: 7,
  riflemanTrap: 8,
  demonHunterManaBurn: 9,
  demonHunterFelRush: 10,
  demonHunterWingAscent: 11,
  demonHunterImmolate: 12,

  heroNeutral: 13,
  heroSide: 14,
  heroUp: 15,
  heroDown: 16,
  heroUltimate: 17,
} as const;
export type SpecialAction = (typeof SpecialAction)[keyof typeof SpecialAction];


export const SPECIAL_ACTION_CAPACITY = 17;


export const ProjectileKind = { blaster: 0, recoil: 3, manaBurn: 4, hero: 5 } as const;
export type ProjectileKind = (typeof ProjectileKind)[keyof typeof ProjectileKind];



/** How an airborne hitstun landing resolves (NTSC 1.02 common +0x1E4/+0x1E0). */
export const DamageLanding = { retainStun: 1, normal: 2, knockdown: 3 } as const;
export type DamageLanding = (typeof DamageLanding)[keyof typeof DamageLanding];

export const AttackPhase = { none: 0, startup: 1, active: 2, recovery: 3 } as const;
export type AttackPhase = (typeof AttackPhase)[keyof typeof AttackPhase];






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

  jab2: 20,
  jab3: 21,
} as const;
export type AttackStyle = (typeof AttackStyle)[keyof typeof AttackStyle];

export const LAST_ATTACK_STYLE = AttackStyle.jab3;

export const DASH_GRAB_REQUEST = 11;


export const ContactKind = { launch: 0, flinch: 1, damageOnly: 2, pummel: 3, throw: 4 } as const;
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];







export const HitElement = { normal: 0, fire: 1, electric: 2, slash: 3, ice: 5, dark: 13, holy: 20, poison: 21, arcane: 22 } as const;
export type HitElement = (typeof HitElement)[keyof typeof HitElement];

// Append only: these status codes are serialized in replay text.
export const HeroStatusKind = { none: 0, sleep: 1, poison: 2, hex: 3, stun: 4, chill: 5, carried: 7, silence: 8, root: 9, charm: 10 } as const;
export type HeroStatusKind = (typeof HeroStatusKind)[keyof typeof HeroStatusKind];






export const HeroStatusGroup = { sleep: 0, silence: 1, chill: 2 } as const;
export type HeroStatusGroup = (typeof HeroStatusGroup)[keyof typeof HeroStatusGroup];
export const HERO_STATUS_GROUPS = 3;

// Append only: these pickup codes are serialized in replay text.
export const ItemKind = { none: 0, speed: 1, heavy: 3 } as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];
export const ITEM_KINDS: readonly ItemKind[] = [ItemKind.speed, ItemKind.heavy];

export const itemBit = (kind: ItemKind): number => kind === ItemKind.none ? 0 : 1 << (kind - 1);
export const ALL_ITEMS_MASK = 5;
