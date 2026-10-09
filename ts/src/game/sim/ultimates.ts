import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusGroup, HeroStatusKind, HitElement, ItemKind } from "./codes";
import { CHILL } from "./chill";
import { heroRegion, type MoveRegion, type StrikeCapsule } from "./heroMoves";
import { frames, type AuthoredSpecial, type SpecialProjectile } from "./heroSpecials";
import type { AppliedStatus } from "./heroStatus";
import type { HitEffect } from "./hitRegions";
import type { NamedMove } from "./heroes/hero";

// Each fighter's ultimate (docs/design/ultimates.md): ordinary authored special
// data, run by the hero special engine, bought with the whole bar.

const DIRECTION = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  30: { x: f32(0.866025404), z: 0.5 },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: 0.5, z: f32(0.866025404) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
} as const;
type Angle = keyof typeof DIRECTION;

function hit(damage: number, angle: Angle, growth: number, base: number, element: HitElement = HitElement.normal, behind = false): HitEffect {
  const direction = DIRECTION[angle];
  return { damage, growth, base, launchX: behind ? -direction.x : direction.x, launchZ: direction.z, electric: element === HitElement.electric, element };
}

const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });

/** A drawn-only cue: an effect that marks where an ultimate will land and never strikes. */
function mark(model: string, spawnFrame: number, life: number, offsetX: number, offsetZ = 0.0, atFoe = false, expiresInto?: SpecialProjectile): SpecialProjectile {
  return {
    model, spawnFrame, offsetX, offsetZ, velocityX: 0.0, velocityZ: 0.0, life, radius: 1.0, activeFrom: life + 1,
    effect: hit(0.0, 90, 0.0, 0.0), reflectable: false, limit: 4, atFoe, expiresInto,
  };
}

function shot(spawnFrame: number, offsetX: number, offsetZ: number, velocityX: number, velocityZ: number, life: number, radius: number, effect: HitEffect, model: string): SpecialProjectile {
  return { model, spawnFrame, offsetX, offsetZ, velocityX, velocityZ, life, radius, effect, reflectable: false, limit: 4 };
}

const NO_FOLLOW_UP = frames(999, 999);

const RIFLEMAN: AuthoredSpecial = {
  name: "Aimed Shot", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", 4, 32, 60.0, 50.0),
    shot(36, 50.0, 50.0, 60.0, 0.0, 30, 26.0, hit(24.0, 30, 95.0, 40.0), "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx"),
  ],
};

const ILLIDAN: AuthoredSpecial = {
  name: "Metamorphosis", endFrame: 50, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", 2, 30, 0.0)],
  regions: [heroRegion(31, 33, capsule(-160.0, 60.0, 160.0, 60.0, 70.0), hit(12.0, 70, 80.0, 45.0, HitElement.fire))],
  buff: { frame: 31, kind: ItemKind.speed, frames: 480 },
};

const BLADESTORM_TICKS = [17, 26, 35, 44, 53, 62] as const;
const BLADEMASTER: AuthoredSpecial = {
  name: "Bladestorm", endFrame: 104, groundOnly: true,
  motion: [{ ...frames(17, 74), velocityX: 0.0, velocityZ: 0.0, driftSpeed: 5.0 }, { ...frames(75, 75), velocityX: 0.0, velocityZ: 0.0 }],
  projectiles: [mark("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", 2, 12, 0.0)],
  regions: [
    ...BLADESTORM_TICKS.map((first): MoveRegion => heroRegion(first, first + 1, capsule(-110.0, 50.0, 110.0, 50.0, 60.0), hit(2.5, 80, 20.0, 35.0, HitElement.slash))),
    heroRegion(75, 78, capsule(-120.0, 60.0, 120.0, 60.0, 70.0), hit(9.0, 45, 95.0, 50.0, HitElement.slash)),
  ],
  rehits: [...BLADESTORM_TICKS, 75],
};

const MOUNTAIN_KING: AuthoredSpecial = {
  name: "Avatar", endFrame: 50, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", 33, 14, 0.0)],
  regions: [heroRegion(33, 35, capsule(-180.0, 30.0, 180.0, 30.0, 50.0), hit(10.0, 75, 75.0, 40.0))],
  buff: { frame: 33, kind: ItemKind.heavy, frames: 600 },
};

const WARDEN: AuthoredSpecial = {
  name: "Vengeance", endFrame: 40, groundOnly: true,
  placement: {
    frame: 22, offsetX: -60.0, radius: 40.0, height: 140.0, durability: 30.0, life: 90, fireAges: [2, 17, 32, 47],
    shot: shot(0, 40.0, 50.0, 18.0, 0.0, 50, 26.0, hit(7.0, 40, 60.0, 30.0, HitElement.slash), "Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx"),
    model: { path: "Units\\NightElf\\HeroWarden\\HeroWarden.mdx", height: 150.0, alpha: 120 },
  },
};

const LICH: AuthoredSpecial = {
  name: "Frost Wyrm", endFrame: 60,
  projectiles: [
    mark("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathTargetArt.mdx", 2, 29, -600.0, 215.0),
    { ...shot(31, -600.0, 215.0, 28.0, 0.0, 70, 45.0, hit(16.0, 60, 85.0, 45.0, HitElement.ice), "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx"), status: CHILL },
  ],
};

const FORSAKEN_PALADIN: AuthoredSpecial = {
  name: "Light's Hammer", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\Consecration\\Consecration.mdx", 2, 62, 220.0),
    mark("Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx", 34, 14, 220.0),
  ],
  regions: [
    heroRegion(40, 42, capsule(220.0, 20.0, 220.0, 150.0, 100.0), hit(18.0, 75, 90.0, 45.0, HitElement.holy)),
    heroRegion(52, 52, capsule(110.0, 10.0, 330.0, 10.0, 25.0), hit(4.0, 80, 30.0, 30.0, HitElement.holy)),
    heroRegion(64, 64, capsule(110.0, 10.0, 330.0, 10.0, 25.0), hit(4.0, 80, 30.0, 30.0, HitElement.holy)),
  ],
  rehits: [52, 64],
};

const DREADLORD: AuthoredSpecial = {
  name: "Inferno", endFrame: 56, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", 4, 36, 260.0),
    { ...mark("Abilities\\Weapons\\DemolisherFireMissile\\DemolisherFireMissile.mdx", 28, 12, 260.0, 600.0), velocityZ: -48.0 },
    mark("Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx", 40, 14, 260.0),
  ],
  regions: [heroRegion(40, 42, capsule(260.0, 20.0, 260.0, 120.0, 100.0), hit(16.0, 80, 90.0, 45.0, HitElement.fire))],
};

const VOODOO_PULSES = [30, 50, 70] as const;
const SHADOW_HUNTER: AuthoredSpecial = {
  name: "Big Bad Voodoo", endFrame: 120, groundOnly: true,
  intangible: frames(13, 90),
  projectiles: [mark("Abilities\\Spells\\Orc\\CommandAura\\CommandAura.mdx", 2, 88, 0.0)],
  regions: [
    ...VOODOO_PULSES.map((first): MoveRegion => heroRegion(first, first, capsule(-200.0, 40.0, 200.0, 40.0, 60.0), hit(3.0, 80, 10.0, 30.0, HitElement.dark))),
    heroRegion(90, 92, capsule(-200.0, 50.0, 200.0, 50.0, 90.0), hit(12.0, 80, 85.0, 45.0, HitElement.dark)),
  ],
  rehits: [...VOODOO_PULSES, 90],
};

const DOOM: AppliedStatus = { kind: HeroStatusKind.poison, frames: 180, group: HeroStatusGroup.sleep, immunityFrames: 0, tick: { every: 15, damage: 1.0 } };
const PIT_LORD: AuthoredSpecial = {
  name: "Doom", endFrame: 60, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", 1, 18, 60.0, 80.0)],
  commandGrab: { ...frames(19, 22), strike: capsule(30.0, 60.0, 130.0, 60.0, 40.0), holdFrames: 30, effect: hit(10.0, 45, 85.0, 45.0, HitElement.fire), recovery: 30, status: DOOM },
};

const BEASTMASTER: AuthoredSpecial = {
  name: "Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", 2, 22, -100.0),
    shot(25, -150.0, 25.0, 22.0, 0.0, 60, 30.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\QuillBeast\\QuillBeast.mdl"),
    shot(40, -150.0, 70.0, 22.0, 0.0, 60, 45.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\GrizzlyBear\\GrizzlyBear.mdl"),
    shot(55, -150.0, 190.0, 22.0, 0.0, 60, 30.0, hit(9.0, 40, 80.0, 40.0), "units\\creeps\\WarEagle\\WarEagle.mdl"),
  ],
};

const RISEN = shot(0, 0.0, 40.0, 0.0, 0.0, 4, 90.0, hit(20.0, 85, 90.0, 45.0, HitElement.dark), "Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx");
const LICH_KING: AuthoredSpecial = {
  name: "Animate Dead", endFrame: 64, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", 2, 38, 0.0, 0.0, true, RISEN)],
};

const tremor = (direction: number): SpecialProjectile => ({
  ...shot(27, direction * 40.0, 25.0, direction * 16.0, 0.0, 50, 50.0, hit(15.0, 70, 85.0, 40.0), "Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx"),
  pool: { every: 60, growth: 0.0, maxRadius: 50.0 },
});
const THRALL: AuthoredSpecial = {
  name: "Earthquake", endFrame: 60, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx", 2, 25, 0.0), tremor(1.0), tremor(-1.0)],
};

const ray = (spawnFrame: number, velocityX: number, velocityZ: number, effect: HitEffect): SpecialProjectile =>
  shot(spawnFrame, 40.0, 90.0, velocityX, velocityZ, 15, 30.0, effect, "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx");
const GLANCE = hit(5.0, 30, 30.0, 25.0, HitElement.ice);
const JAINA: AuthoredSpecial = {
  name: "Glacial Ray", endFrame: 80, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\BreathOfFrost\\BreathOfFrostTarget.mdx", 2, 22, 40.0, 90.0),
    ray(25, f32(28.284271), f32(28.284271), GLANCE),
    ray(33, f32(37.587704), f32(13.680806), GLANCE),
    ray(41, 40.0, 0.0, GLANCE),
    ray(49, f32(39.392310), f32(-6.945927), hit(10.0, 30, 90.0, 45.0, HitElement.ice)),
  ],
};

const CHARM: AppliedStatus = { kind: HeroStatusKind.charm, frames: 180, group: HeroStatusGroup.silence, immunityFrames: 240 };
const SYLVANAS: AuthoredSpecial = {
  name: "Charm", endFrame: 40,
  projectiles: [{ ...shot(21, 40.0, 60.0, 10.0, 0.0, 90, 34.0, hit(8.0, 45, 40.0, 30.0, HitElement.dark), "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx"), reflectable: true, status: CHARM }],
};

const ANCESTRAL_PILLAR: AuthoredSpecial = {
  name: "Ancestral Pillar", endFrame: 40, intangible: frames(1, 12),
  projectiles: [mark("Abilities\\Spells\\Orc\\Reincarnation\\ReincarnationTarget.mdx", 1, 18, 0.0)],
  regions: [heroRegion(4, 7, capsule(-140.0, 40.0, 140.0, 40.0, 100.0), hit(18.0, 70, 85.0, 45.0, HitElement.holy))],
};
const CAIRNE: AuthoredSpecial = {
  name: "Reincarnation", endFrame: 75, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\AncestralSpirit\\AncestralSpiritCaster.mdx", 1, 49, 0.0)],
  intangible: frames(7, 50),
  guard: { ...frames(7, 50), heal: 0.0, counter: true },
  followUps: [{ window: NO_FOLLOW_UP, special: ANCESTRAL_PILLAR }],
};

const SPIRIT = "units\\creeps\\PandarenBrewmaster\\PandarenBrewmaster.mdl";
const CHEN: AuthoredSpecial = {
  name: "Storm, Earth and Fire", endFrame: 64, groundOnly: true,
  projectiles: [
    mark(SPIRIT, 2, 22, 40.0),
    mark(SPIRIT, 10, 26, 220.0),
    mark(SPIRIT, 18, 30, -150.0),
    mark("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", 21, 12, 0.0),
    mark("Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx", 33, 12, 220.0),
    mark("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx", 45, 14, -150.0),
  ],
  regions: [
    heroRegion(21, 23, capsule(-120.0, 20.0, 120.0, 20.0, 50.0), hit(8.0, 80, 70.0, 40.0)),
    heroRegion(33, 35, capsule(200.0, 30.0, 240.0, 110.0, 45.0), hit(7.0, 45, 70.0, 40.0, HitElement.electric)),
    heroRegion(45, 48, capsule(-60.0, 50.0, -220.0, 50.0, 50.0), hit(9.0, 40, 85.0, 45.0, HitElement.fire, true)),
  ],
  rehits: [21, 33, 45],
};

const TREE = hit(20.0, 40, 90.0, 45.0);
const PEON: AuthoredSpecial = {
  name: "Timber!", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("units\\nightelf\\Ent\\Ent.mdl", 2, 46, 80.0),
    mark("Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx", 12, 10, 60.0, 40.0),
    mark("Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx", 24, 10, 60.0, 40.0),
  ],
  regions: [
    heroRegion(37, 39, capsule(60.0, 0.0, f32(168.703), f32(405.689), 35.0), TREE),
    heroRegion(40, 42, capsule(60.0, 0.0, f32(329.970), f32(321.739), 35.0), TREE),
    heroRegion(43, 45, capsule(60.0, 0.0, f32(440.646), f32(177.500), 35.0), TREE),
    heroRegion(46, 48, capsule(60.0, 15.0, 480.0, 15.0, 35.0), TREE),
  ],
};

const OVERDRIVE_BLAST = shot(0, 0.0, 30.0, 0.0, 0.0, 4, 150.0, hit(22.0, 55, 90.0, 45.0, HitElement.fire), "Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx");
const TINKER: AuthoredSpecial = {
  name: "Robo-Goblin Overdrive", endFrame: 50, groundOnly: true,
  projectiles: [{ ...shot(20, 60.0, 30.0, 6.0, 0.0, 60, 40.0, hit(3.0, 30, 20.0, 30.0), "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl"), expiresInto: OVERDRIVE_BLAST }],
};

const KAELTHAS: AuthoredSpecial = {
  name: "Gravity Lapse", endFrame: 60, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx", 2, 27, 0.0)],
  regions: [heroRegion(29, 31, capsule(-260.0, 40.0, 260.0, 40.0, 120.0), hit(14.0, 90, 85.0, 60.0, HitElement.arcane))],
};

const MURLOC_MODEL = "units\\creeps\\Murloc\\Murloc.mdl";
const swarm = (offsetX: number): SpecialProjectile => ({
  ...shot(20, offsetX, 20.0, 30.0, 0.0, 45, 40.0, hit(2.0, 25, 10.0, 30.0), MURLOC_MODEL),
  pool: { every: 6, growth: 0.0, maxRadius: 40.0 }, modelRadius: 70.0,
});
const MURLOC: AuthoredSpecial = {
  name: "Mrglglgl Stampede", endFrame: 70, groundOnly: true,
  projectiles: [
    mark("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", 2, 18, -520.0),
    swarm(-520.0), swarm(-560.0), swarm(-600.0),
    { ...shot(20, -660.0, 20.0, 30.0, 0.0, 45, 40.0, hit(10.0, 40, 90.0, 45.0), MURLOC_MODEL), modelRadius: 70.0 },
  ],
};

const GROM: AuthoredSpecial = {
  name: "Blood of Mannoroth", endFrame: 70, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", 1, 16, 0.0)],
  motion: [{ ...frames(17, 40), velocityX: 22.0, velocityZ: 0.0 }, { ...frames(41, 41), velocityX: 0.0, velocityZ: 0.0 }],
  commandGrab: { ...frames(17, 40), strike: capsule(20.0, 50.0, 70.0, 50.0, 40.0), holdFrames: 30, effect: hit(22.0, 40, 90.0, 45.0, HitElement.slash), recovery: 24 },
};

const ANUBARAK: AuthoredSpecial = {
  name: "Locust Swarm", endFrame: 60, groundOnly: true,
  projectiles: [{
    ...shot(17, 60.0, 60.0, 5.0, 0.0, 90, 90.0, hit(2.0, 80, 10.0, 25.0, HitElement.poison), "Units\\Undead\\Scarab\\Scarab.mdl"),
    pool: { every: 12, growth: 0.0, maxRadius: 90.0 },
  }],
};

const MALFURION: AuthoredSpecial = {
  name: "Wisps of Hyjal", endFrame: 50,
  projectiles: [
    mark("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", 2, 26, 0.0),
    shot(29, 60.0, 70.0, 7.0, 0.0, 120, 70.0, hit(20.0, 50, 90.0, 45.0, HitElement.holy), "Abilities\\Weapons\\KeeperGroveMissile\\KeeperGroveMissile.mdx"),
  ],
};

const PULL = [25, 37, 49] as const;
const MEDIVH: AuthoredSpecial = {
  name: "The Dark Portal", endFrame: 70, groundOnly: true,
  projectiles: [mark("Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx", 2, 62, 240.0)],
  regions: [
    ...PULL.flatMap((first): MoveRegion[] => [
      heroRegion(first, first, capsule(40.0, 50.0, 200.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark)),
      heroRegion(first, first, capsule(280.0, 50.0, 440.0, 50.0, 80.0), hit(1.0, 25, 0.0, 30.0, HitElement.dark, true)),
    ]),
    heroRegion(64, 66, capsule(240.0, 20.0, 240.0, 120.0, 110.0), hit(18.0, 60, 90.0, 45.0, HitElement.dark)),
  ],
  rehits: [...PULL, 64],
};

const KOBOLD: AuthoredSpecial = {
  name: "You No Take Candle!", endFrame: 85, groundOnly: true,
  intangible: frames(8, 54),
  projectiles: [mark("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", 8, 12, 0.0)],
  motion: [{ ...frames(15, 54), velocityX: 10.0, velocityZ: 0.0, driftSpeed: 6.0, stopsAtBody: true }, { ...frames(55, 58), velocityX: 0.0, velocityZ: 12.0 }],
  regions: [heroRegion(55, 58, capsule(20.0, 0.0, 20.0, 120.0, 50.0), hit(16.0, 85, 85.0, 45.0))],
};

/** Every fighter's ultimate, by character. */
export const FIGHTER_ULTIMATES: { readonly [character: number]: AuthoredSpecial | undefined } = {
  [Character.rifleman]: RIFLEMAN,
  [Character.demonHunter]: ILLIDAN,
  [Character.blademaster]: BLADEMASTER,
  [Character.mountainKing]: MOUNTAIN_KING,
  [Character.warden]: WARDEN,
  [Character.lich]: LICH,
  [Character.forsakenPaladin]: FORSAKEN_PALADIN,
  [Character.dreadlord]: DREADLORD,
  [Character.shadowHunter]: SHADOW_HUNTER,
  [Character.pitLord]: PIT_LORD,
  [Character.beastmaster]: BEASTMASTER,
  [Character.lichKing]: LICH_KING,
  [Character.thrall]: THRALL,
  [Character.jaina]: JAINA,
  [Character.sylvanas]: SYLVANAS,
  [Character.cairne]: CAIRNE,
  [Character.chen]: CHEN,
  [Character.peon]: PEON,
  [Character.tinker]: TINKER,
  [Character.kaelthas]: KAELTHAS,
  [Character.murloc]: MURLOC,
  [Character.grom]: GROM,
  [Character.anubarak]: ANUBARAK,
  [Character.malfurion]: MALFURION,
  [Character.medivh]: MEDIVH,
  [Character.kobold]: KOBOLD,
};


const ULTIMATE_DESCRIPTIONS: { readonly [character: number]: string | undefined } = {
  [Character.rifleman]: "Kneel and aim: a red line shows the shot, then one bullet crosses the stage. Jump or shield it.",
  [Character.demonHunter]: "Fel fire burns around him as he becomes a demon: a burst launches nearby foes, then he moves faster for 8 seconds.",
  [Character.blademaster]: "A steerable whirlwind of cuts ending in a strong slash, then he is dizzy. Shield, jump above it or outrun it.",
  [Character.mountainKing]: "He turns to stone with a stomp: heavier for 10 seconds. Hit him while he changes.",
  [Character.warden]: "The Avatar of Vengeance rises behind her and throws four ghostly glaives. Break it or dodge the glaives.",
  [Character.lich]: "A frost wyrm sweeps across at jump height. Stay low or shield it.",
  [Character.forsakenPaladin]: "A golden circle marks where the Light's hammer will fall, then blesses the ground twice. Leave the circle.",
  [Character.dreadlord]: "An Infernal crashes onto a burning mark ahead. Leave the mark.",
  [Character.shadowHunter]: "He dances untouchable inside a voodoo ring that pulses, then erupts. Leave the ring.",
  [Character.pitLord]: "A clawed grab that ignores shields brands the victim with Doom, burning on after the throw. Jump or roll away.",
  [Character.beastmaster]: "His pack stampedes past: a low quilbeast, a bear, then a high hawk. Jump, shield, then stay low.",
  [Character.lichKing]: "Runes mark the ground under the nearest foe; the dead claw up there a moment later. Step off the mark.",
  [Character.thrall]: "Tremors run along the ground both ways. Jump them or stand on a platform.",
  [Character.jaina]: "A ray of frost sweeps down from high ahead of her to the floor. Get behind her or shield.",
  [Character.sylvanas]: "A slow banshee spirit; a foe it reaches has left and right swapped for 3 seconds.",
  [Character.cairne]: "He waits with the ancestors: a strike that would hit him raises a spirit pillar instead. Don't strike; grab or wait.",
  [Character.chen]: "He splits into Earth, Storm and Fire, which strike around him one after another.",
  [Character.peon]: "He chops at a big tree until it falls forward across the stage. Stand behind him or hit him while he chops.",
  [Character.tinker]: "His Robo-Goblin waddles ahead and explodes. Walk away or shield the blast.",
  [Character.kaelthas]: "Arcane orbs ring him, then everyone inside is lifted straight up. Leave the ring.",
  [Character.murloc]: "He blows a conch and a swarm of murlocs pours across the ground. Jump over it or shield.",
  [Character.grom]: "Demon blood drives a charge that catches the first foe, through a shield, for three Gorehowl chops. Jump it.",
  [Character.anubarak]: "A slow cloud of beetles drifts ahead, stinging anyone standing in it. Jump or shield.",
  [Character.malfurion]: "A slow wall of wisps drifts forward and detonates on whoever it reaches.",
  [Character.medivh]: "A dark portal opens ahead, drawing foes in, then erupts. Walk away before it bursts.",
  [Character.kobold]: "He digs in and burrows toward the foe, then bursts up under them. Watch the dirt.",
};

/** The ultimate's official name and one-line description, for the move list and Moves page. */
export function ultimateText(character: number): NamedMove | undefined {
  const move = FIGHTER_ULTIMATES[character];
  const description = ULTIMATE_DESCRIPTIONS[character];
  return move?.name === undefined || description === undefined ? undefined : { name: move.name, description };
}


/** Where a computer fighter presses its ultimate: the target's distance ahead, near to far; far 0 never (a counter or a high sweep it cannot aim). */
export const ULTIMATE_REACH: { readonly [character: number]: { readonly near: number; readonly far: number } | undefined } = {
  [Character.rifleman]: { near: 150.0, far: 900.0 },
  [Character.demonHunter]: { near: 0.0, far: 150.0 },
  [Character.blademaster]: { near: 0.0, far: 120.0 },
  [Character.mountainKing]: { near: 0.0, far: 170.0 },
  [Character.warden]: { near: 120.0, far: 500.0 },
  [Character.lich]: { near: 0.0, far: 600.0 },
  [Character.forsakenPaladin]: { near: 150.0, far: 300.0 },
  [Character.dreadlord]: { near: 190.0, far: 330.0 },
  [Character.shadowHunter]: { near: 0.0, far: 170.0 },
  [Character.pitLord]: { near: 40.0, far: 120.0 },
  [Character.beastmaster]: { near: 100.0, far: 700.0 },
  [Character.lichKing]: { near: 150.0, far: 600.0 },
  [Character.thrall]: { near: 60.0, far: 600.0 },
  [Character.jaina]: { near: 120.0, far: 500.0 },
  [Character.sylvanas]: { near: 150.0, far: 600.0 },
  [Character.cairne]: { near: 0.0, far: 0.0 },
  [Character.chen]: { near: 0.0, far: 240.0 },
  [Character.peon]: { near: 80.0, far: 420.0 },
  [Character.tinker]: { near: 80.0, far: 300.0 },
  [Character.kaelthas]: { near: 0.0, far: 240.0 },
  [Character.murloc]: { near: 100.0, far: 600.0 },
  [Character.grom]: { near: 60.0, far: 400.0 },
  [Character.anubarak]: { near: 60.0, far: 300.0 },
  [Character.malfurion]: { near: 100.0, far: 500.0 },
  [Character.medivh]: { near: 150.0, far: 330.0 },
  [Character.kobold]: { near: 80.0, far: 350.0 },
};
