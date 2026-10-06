// The projectile rules (smashcraft:docs/gameplay-design.md, "Projectiles and
// powershield", #98) measured on every fighter's projectiles, the original
// three and each registered hero, through the interaction graph's projectile
// situations (interactions.ts). A fighter that breaks a rule on purpose names a
// departure below and in that section.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";
import { SHIELD_REFLECTOR_ACTIVE_FRAMES } from "../src/game/sim/shield";
import { PROJECTILE_SPACINGS, outOfShieldStarts, projectileRows } from "./interactions";

const POINT_BLANK = PROJECTILE_SPACINGS[0];
const MIN_POWERSHIELD_PRESSES = 2;
const MAX_TRAVELING_OUT = 3;
const MAX_PERSISTENT_OUT = 2;
const MAX_FLIGHT = 90;

/** "fighter source rule N" to its reason; each is also named in gameplay-design.md. A departure that no longer occurs fails. */
const DEPARTURES: Readonly<Record<string, string>> = {
  "Archer neutral special rule 2": "arrows deal damage without hitstun or shieldstun, so they hold no shield and lock no fighter",
  "Archer neutral special rule 3": "a 3-frame shot that only adds damage; volume is its pressure",
};

const FIGHTERS: readonly { readonly character: Character; readonly name: string }[] = [
  { character: Character.archer, name: "Archer" },
  { character: Character.rifleman, name: "Rifleman" },
  { character: Character.demonHunter, name: "Illidan" },
  ...HERO_ROSTER.map((hero) => ({ character: hero.character, name: hero.name })),
];

function violations(character: Character, name: string): Map<string, string> {
  const found = new Map<string, string>();
  const add = (source: string, rule: number, detail: string): void => {
    const key = `${name} ${source} rule ${rule}`;
    if (!found.has(key)) found.set(key, detail);
  };
  for (const row of projectileRows(character, name)) {
    if (row.traveling && row.arrives !== undefined && row.powershield.length < MIN_POWERSHIELD_PRESSES) add(row.source, 1, `${row.variant}: powershield presses ${row.powershield.join(",") || "none"}`);
    if (row.distance === POINT_BLANK && row.arrives !== undefined && !row.pokes && row.punishes.length === 0) add(row.source, 2, `${row.variant}: no out-of-shield punish (advantage ${row.advantage})`);
    if (row.mostOut > (row.traveling ? MAX_TRAVELING_OUT : MAX_PERSISTENT_OUT)) add(row.source, 3, `${row.mostOut} out at once`);
    if (row.traveling && row.flight > MAX_FLIGHT) add(row.source, 4, `flies ${row.flight} frames`);
    if (row.hitsIdle && row.powershield.length === 0 && row.answers.every((answer) => answer.starts.length === 0)) add(row.source, 5, `${row.variant}: no answer but holding shield`);
  }
  for (const start of outOfShieldStarts(character)) if (start.start === undefined) add("out of shield", 6, `${start.option} never starts from shield`);
  return found;
}

test("the powershield's reflector stays inside the accepted 2-4 frame window", () => {
  expect(SHIELD_REFLECTOR_ACTIVE_FRAMES).toBeGreaterThanOrEqual(2);
  expect(SHIELD_REFLECTOR_ACTIVE_FRAMES).toBeLessThanOrEqual(4);
});

for (const fighter of FIGHTERS) {
  test(`${fighter.name}'s projectiles follow the projectile rules or name a departure`, () => {
    const found = violations(fighter.character, fighter.name);
    const unexpected = [...found].filter(([key]) => DEPARTURES[key] === undefined).map(([key, detail]) => `${key}: ${detail}`);
    expect(unexpected).toEqual([]);
    const stale = Object.keys(DEPARTURES).filter((key) => key.startsWith(`${fighter.name} `) && !found.has(key));
    expect(stale).toEqual([]);
  });
}

test("Rifleman's blaster point blank on a shield is punished out of shield and reflected by a powershield", () => {
  const row = projectileRows(Character.rifleman, "Rifleman").find((candidate) => candidate.variant === `neutral special at ${POINT_BLANK}`);
  expect(row?.punishes.map((entry) => entry.punisher)).toContain("shield grab");
  expect(row?.powershield.length).toBeGreaterThanOrEqual(MIN_POWERSHIELD_PRESSES);
});

test("Illidan's slow Mana Burn point blank on a shield is punished out of shield, reflected by a powershield and jumped from range (#116)", () => {
  for (const row of projectileRows(Character.demonHunter, "Illidan")) {
    expect(row.pokes).toBe(false);
    expect(row.powershield.length).toBeGreaterThanOrEqual(MIN_POWERSHIELD_PRESSES);
    expect(row.answers.find((answer) => answer.option === "jump")?.starts.length).toBeGreaterThan(0);
    expect(row.mostOut).toBe(1);
    if (row.distance === POINT_BLANK) expect(row.punishes.map((entry) => entry.punisher)).toContain("shield grab");
  }
});
