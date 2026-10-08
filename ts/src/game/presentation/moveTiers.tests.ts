// Sound and spark tiers by move class (#163): every fighter's jabs are small,
// its tilts medium and its smashes large, except the named departures, and a
// hit and a swing carry their attack's tier to the sounds they play.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { queueAttack } from "../input/attackBuffer";
import { createBufferedFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, HitElement } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { presentImpactSounds } from "./hitPresentation";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { SWING_SOUND, SoundTier, TIER_DEPARTURES, classTier, moveTier, tierHitPath } from "./moveTiers";

const JABS = [AttackStyle.jab, AttackStyle.jab2, AttackStyle.jab3];
const TILTS = [AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt];
const SMASHES = [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash];

test("every normal maps to its class tier: jab small, tilt medium, smash large, departures named [spec #163]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const [styles, tier] of [[JABS, SoundTier.small], [TILTS, SoundTier.medium], [SMASHES, SoundTier.large]] as const) {
      for (const style of styles) {
        const departure = TIER_DEPARTURES.find((each) => each.character === character && each.style === style);
        assertEquals(moveTier(character, style), departure?.tier ?? tier, `${fighterName(character)} ${style}`);
      }
    }
  }
  // Each departure differs from its class and says why.
  for (const departure of TIER_DEPARTURES) {
    assertEquals(departure.tier !== classTier(departure.style) && departure.why.length > 0, true, `${fighterName(departure.character)} ${departure.style}`);
  }
});

/** The swing and hit sounds an attack of `style` plays, Warden against a Rifleman close in front. */
function attackSounds(style: AttackStyle): { swing: string[]; hit: string[]; tier: number } {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(Character.warden, 0.0, 1), createFighter(Character.rifleman, 60.0, -1)]);
  const controls = createBufferedFrameControls();
  const events = [createImpactEvents(), createImpactEvents()];
  const swing: string[] = [];
  const hit: string[] = [];
  let tier = -1;
  queueAttack(controls.commands[0], { style, facing: 0, frame: 1, mayCharge: false });
  for (let frame = 1; frame <= 40; frame++) {
    for (const slot of [0, 1] as const) {
      copyControls(controls.inputs[slot], neutralControls());
      captureImpactEventsBefore(at(events, slot), fighterAt(world, slot));
    }
    stepMatch(game, world, controls, frame);
    for (const slot of [0, 1] as const) {
      const own = at(events, slot);
      finishImpactEventsAfter(own, fighterAt(world, slot), world);
      if (own.hit) tier = own.tier;
      presentImpactSounds(own, (sound, _x, _z, _volume, _pitch, file) => {
        if (sound === SWING_SOUND) swing.push(`${slot}:${own.swing}`);
        else if (file) hit.push(sound);
      });
    }
  }
  return { swing, hit, tier };
}

test("a jab swings and hits small, a forward tilt medium and a forward smash large [spec #163]", () => {
  for (const [style, expected] of [[AttackStyle.jab, SoundTier.small], [AttackStyle.forwardTilt, SoundTier.medium], [AttackStyle.forwardSmash, SoundTier.large]] as const) {
    const { swing, hit, tier } = attackSounds(style);
    assertEquals(swing.join(","), `0:${expected}`, `swing of ${style}`);
    assertEquals(tier, expected, `hit of ${style}`);
    // Warden's blade cuts: the slice of the tier.
    assertEquals(hit.join(","), tierHitPath(HitElement.slash, expected, 1) ?? "", `hit sound of ${style}`);
  }
});
