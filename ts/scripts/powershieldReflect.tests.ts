// Powershield against every projectile (smashcraft:docs/gameplay-design.md,
// "Projectiles and powershield" rule 1 and "Powershield and parry" rule 2):
// each projectile special of every fighter, fired at a mirror defender who
// raises the shield so the projectile meets it on the shield's first frame,
// on the reflector's last frame and one frame late. A traveling projectile
// reflects inside the reflector's frames and not after them (a later frame of
// the 4-frame hit parry may still parry it); a marker, zone or summon is never
// reflected. `bun test ./scripts/powershieldReflect.tests.ts` prints the table.
import { expect } from "bun:test";
import { Action } from "../src/game/input/actions";
import { Character } from "../src/game/sim/codes";
import { type Fighter, SHIELD_MAX } from "../src/game/sim/fighter";
import { HERO_ROSTER, heroDefinition } from "../src/game/sim/heroes/registry";
import { SHIELD_REFLECTOR_ACTIVE_FRAMES } from "../src/game/sim/shield";
import { fighter, frame, projectileShieldActions, scene } from "../src/game/match/padScene";
import { isProjectileSummon } from "./interactions";
import { sweep } from "../test/sweep";

type Held = readonly Action[];
type Outcome = "reflected" | "parried" | "blocked" | "hit";

const FIGHTERS: readonly { readonly character: Character; readonly name: string }[] = [
  { character: Character.rifleman, name: "Rifleman" },
  { character: Character.demonHunter, name: "Illidan" },
  ...HERO_ROSTER.map((hero) => ({ character: hero.character, name: hero.name })),
];
const PROJECTILE_USERS = FIGHTERS.filter(({ character }) => {
  if (character === Character.rifleman || character === Character.demonHunter) return true;
  return Object.values(heroDefinition(character)?.specials ?? {}).some(({ ground }) =>
    (ground.projectiles?.length ?? 0) > 0 || ground.placement?.shot !== undefined);
});
const SPECIALS = [
  { name: "neutral special", held: (): Held => [Action.special] },
  { name: "side special", held: (self: Fighter): Held => [self.facing > 0 ? Action.moveRight : Action.moveLeft, Action.special] },
  { name: "up special", held: (): Held => [Action.moveUp, Action.special] },
  { name: "down special", held: (): Held => [Action.moveDown, Action.special] },
] as const;
type Special = (typeof SPECIALS)[number];
const SPACINGS = [60, 240, 480] as const;
const FIRE = 10;
const HORIZON = 260;
/** The shield's frame on arrival: its first, the reflector's last, one late. */
const TIMINGS = [1, SHIELD_REFLECTOR_ACTIVE_FRAMES, SHIELD_REFLECTOR_ACTIVE_FRAMES + 1] as const;

/** A pool's pulse resets its wait without spending the projectile slot. */
const slotsOf = (f: Fighter): { readonly life: number; readonly x: number; readonly poolWait: number }[] =>
  f.projectiles.map((projectile) => ({ life: projectile.life, x: projectile.x, poolWait: projectile.poolWait }));
interface Arrival {
  readonly frame: number;
  /** The defender's shield frame on arrival, 1 = the frame it went up; undefined when it is down. */
  readonly shieldFrame: number | undefined;
  /** What each of the shooter's projectiles that met the defender on that frame did. */
  readonly outcomes: readonly Outcome[];
}

/**
 * Plays one shot at a defender who holds shield from frame `raise` (never when
 * undefined); ends at the first frame one of the shooter's projectiles meets
 * the defender. Contacts of the special's own strikes are not projectile ones.
 */
function shoot(character: Character, special: Special, distance: number, raise: number | undefined): Arrival | undefined {
  const s = scene(0, [{ character, x: -distance / 2, facing: 1 }, { character, x: distance / 2, facing: -1 }]);
  const shooter = fighter(s, 0);
  const defender = fighter(s, 1);
  let raisedAt: number | undefined;
  for (let n = 1; n <= FIRE + HORIZON; n++) {
    const slots = slotsOf(shooter);
    const owned = slotsOf(defender);
    const before = { reflect: defender.visuals.shieldReflect, shield: defender.visuals.shield, hit: defender.visuals.hit, damage: defender.status.damage };
    // Keep bubble size fixed: shield drain can otherwise skip an arrival timing between neighboring presses.
    defender.shield.energy = SHIELD_MAX;
    frame(s, n === FIRE ? special.held(shooter) : [], raise !== undefined && n >= raise ? projectileShieldActions(shooter) : []);
    if (raisedAt === undefined && defender.shield.raised) raisedAt = n;
    // Traveling contacts spend their slot; persistent zones reset their pulse wait.
    const contacts = shooter.projectiles.filter((projectile, index) => {
      const was = slots[index];
      if (was === undefined) return false;
      const spent = projectile.life === 0 && (was.life > 1 || (was.life === 0 && projectile.x !== was.x));
      const pulsed = projectile.life > 0 && projectile.spec?.pool !== undefined && projectile.poolWait > was.poolWait;
      return spent || pulsed;
    }).length;
    if (contacts === 0) continue;
    // A reflection fills a free slot of the defender's, even when the reflected projectile is spent on the same frame.
    const reflected = defender.projectiles.filter((projectile, index) => {
      const was = owned[index];
      return was !== undefined && was.life === 0 && (projectile.life > 0 || projectile.x !== was.x);
    }).length;
    const parried = Math.max(0, defender.visuals.shieldReflect - before.reflect - reflected);
    const blocked = Math.max(0, defender.visuals.shield - before.shield);
    const hit = defender.status.damage > before.damage || defender.visuals.hit > before.hit ? 1 : 0;
    if (reflected + parried + blocked + hit === 0) continue;
    const outcomes: Outcome[] = [
      ...Array<Outcome>(reflected).fill("reflected"), ...Array<Outcome>(parried).fill("parried"),
      ...Array<Outcome>(blocked).fill("blocked"), ...Array<Outcome>(hit).fill("hit"),
    ];
    return { frame: n, shieldFrame: raisedAt === undefined ? undefined : n - raisedAt + 1, outcomes };
  }
  return undefined;
}

/** Fired away from everyone: undefined without a projectile, otherwise its authored traveling/zone class. */
function travels(character: Character, special: Special): boolean | undefined {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character, x: -500.0, facing: 1 }]);
  const shooter = fighter(s, 0);
  let made = false;
  let moving = false;
  for (let n = 1; n <= HORIZON; n++) {
    frame(s, n === 1 ? special.held(shooter) : [], []);
    for (const projectile of shooter.projectiles) {
      if (projectile.life <= 0) continue;
      made = true;
      moving ||= projectile.velocityX !== 0 || projectile.velocityZ !== 0;
    }
  }
  return made ? moving && !isProjectileSummon(character, special.name) : undefined;
}

interface Result {
  readonly timing: number;
  /** Undefined when no press puts that shield frame on the arrival. */
  readonly outcomes: readonly Outcome[] | undefined;
}

interface Row {
  readonly fighter: string;
  readonly source: string;
  readonly distance: number;
  readonly traveling: boolean;
  readonly results: readonly Result[];
}

/** What the design says a powershield on this shield frame does to the projectile. */
function expected(traveling: boolean, shieldFrame: number): string {
  if (!traveling) return "not reflected";
  return shieldFrame <= SHIELD_REFLECTOR_ACTIVE_FRAMES ? "reflected" : "not reflected";
}

function meets(row: Row, result: Result): boolean {
  if (result.outcomes === undefined || result.outcomes.length === 0) return false;
  const reflected = result.outcomes.map((outcome) => outcome === "reflected");
  return expected(row.traveling, result.timing) === "reflected" ? reflected.every(Boolean) : !reflected.some(Boolean);
}

function rows(): Row[] {
  const found: Row[] = [];
  for (const { character, name } of FIGHTERS) {
    for (const special of SPECIALS) {
      const traveling = travels(character, special);
      if (traveling === undefined) continue;
      for (const distance of SPACINGS) {
        const arrivals = [shoot(character, special, distance, undefined), shoot(character, special, distance, 1)]
          .flatMap((arrival) => (arrival === undefined ? [] : [arrival.frame]));
        if (arrivals.length === 0) continue;
        // A fresh bubble is larger than one held since frame 1, so the projectile can meet it a few frames sooner.
        const latest = Math.max(...arrivals);
        const byFrame = new Map<number, readonly Outcome[]>();
        for (let raise = latest; raise >= Math.max(1, latest - 24); raise--) {
          const arrival = shoot(character, special, distance, raise);
          if (arrival?.shieldFrame !== undefined && !byFrame.has(arrival.shieldFrame)) byFrame.set(arrival.shieldFrame, arrival.outcomes);
        }
        found.push({ fighter: name, source: special.name, distance, traveling, results: TIMINGS.map((timing) => ({ timing, outcomes: byFrame.get(timing) })) });
      }
    }
  }
  return found;
}

function table(all: readonly Row[]): string {
  const cell = (result: Result): string => (result.outcomes === undefined ? "no such press" : result.outcomes.join(" + "));
  const lines = [
    `| Fighter | Projectile special | From | Kind | Shield frame 1 | Frame ${SHIELD_REFLECTOR_ACTIVE_FRAMES} (edge) | Frame ${SHIELD_REFLECTOR_ACTIVE_FRAMES + 1} (late) | Design | Verdict |`,
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const row of all) {
    const ok = row.results.every((result) => meets(row, result));
    lines.push(`| ${row.fighter} | ${row.source} | ${row.distance} | ${row.traveling ? "traveling" : "zone/marker/summon"} | ${row.results.map(cell).join(" | ")} | `
      + `${TIMINGS.map((timing) => expected(row.traveling, timing)).join(", ")} | ${ok ? "as designed" : "DIFFERS"} |`);
  }
  return lines.join("\n");
}

sweep("a powershield reflects every traveling projectile on the reflector's frames and only then [spec docs/gameplay-design.md]", () => {
  const all = rows();
  console.log(table(all));
  expect([...new Set(all.map((row) => row.fighter))].sort()).toEqual(PROJECTILE_USERS.map(({ name }) => name).sort());
  const differs = all.filter((row) => !row.results.every((result) => meets(row, result)))
    .map((row) => `${row.fighter} ${row.source} at ${row.distance}: ${row.results.map((result) => `${result.timing}:${result.outcomes?.join("+") ?? "none"}`).join(" ")}`);
  expect(differs).toEqual([]);
}, 600_000);
