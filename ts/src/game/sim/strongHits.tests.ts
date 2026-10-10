import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "./codes";
import { queueDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { HitElement, type HitEffect } from "./hitRegions";
import { SIGNATURE_STRONG_HIT, strongHitReason, strongHitRows } from "./strongHitTable";
import { strongHit, weakHit } from "./strongHits";
import { STRONG_HIT_EXTRA_HITLAG, victimHitlagFrames } from "./knockback";
import { contactBatch, hitEffect, testWorld } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../presentation/impactEvents";
import { IMPACT_HIT, IMPACTS_PER_KIND, createImpactState, emitImpacts } from "../presentation/impactState";
import { STRONG_SPARK_SCALE, SoundTier, TIER_HIT_VOLUME, TIER_SPARK_SCALE } from "../presentation/moveTiers";
import { presentImpactSounds } from "../presentation/hitPresentation";
import { FIGHTER_SOUNDS, playHit, soundFiles } from "../presentation/moveSounds";

test("every fighter has a signature strong/weak move whose strong hit is the harder one to land [k3 measure docs/gameplay-design.md]", () => {
  assertEquals(SELECTABLE_CHARACTERS.length, 26);
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    const rows = strongHitRows(character);
    const signature = SIGNATURE_STRONG_HIT[character];
    assertEquals(signature !== undefined && rows.some((row) => row.style === signature), true, `${name} has its signature strong/weak move`);
    for (const row of rows) {
      const label = `${name} style ${row.style}`;
      assertEquals(strongHitReason(character, row.style) !== undefined, true, `${label} states why it splits`);
      assertEquals(row.weakDamage > 0, true, `${label} has a weak hit beside its strong hit`);
      const ratio = row.weakDamage / row.strongDamage;
      assertEquals(ratio >= 0.5 && ratio <= 0.8500000238418579, true, `${label} weak/strong damage ${ratio} is within 0.5 to 0.85`);
      if (row.position) assertEquals(row.strongReach > row.weakReach, true, `${label} sweetspot ${row.strongReach} lies beyond its sourspot ${row.weakReach}`);
      else assertEquals(row.strongFrames <= row.weakFrames, true, `${label} clean frames ${row.strongFrames} do not outlast late frames ${row.weakFrames}`);
    }
  }
});

function strike(effect: Readonly<HitEffect>) {
  const attacker = createFighter(Character.rifleman, -50.0, 1);
  const victim = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, victim);
  const events = createImpactEvents();
  captureImpactEventsBefore(events, victim);
  contactBatch(world, () => queueDamageContact(world, 0, 1, effect, 1, ContactKind.launch, true, undefined));
  finishImpactEventsAfter(events, victim);
  const impacts = createImpactState();
  emitImpacts(impacts, events, 0);
  let volume = 0;
  presentImpactSounds(events, (_sound, _x, _z, played) => { volume = Math.max(volume, played); });
  return { attacker, victim, world, events, volume, spark: impacts.strength[IMPACT_HIT * IMPACTS_PER_KIND] ?? 0.0 };
}

test("a strong hit adds hitlag to both bodies and a larger spark and strong sound, and a weak hit keeps ordinary feedback [k3 measure #389]", () => {
  const authored = hitEffect(12.0, 100.0, 20.0, 1.0, 1.0);
  const strong = strike(strongHit(authored));
  const weak = strike(weakHit(authored));
  const ordinary = victimHitlagFrames(12.0, false, false);
  assertEquals(strong.victim.launch.hitlagFrames, ordinary + STRONG_HIT_EXTRA_HITLAG);
  assertEquals(strong.attacker.launch.hitlag, ordinary + STRONG_HIT_EXTRA_HITLAG);
  assertEquals(weak.victim.launch.hitlagFrames, victimHitlagFrames(weakHit(authored).damage, false, false));
  assertTrue(strong.victim.visuals.hitStrong);
  assertTrue(!weak.victim.visuals.hitStrong);
  assertTrue(strong.events.strong);
  assertTrue(!weak.events.strong);
  assertEquals(strong.spark, STRONG_SPARK_SCALE);
  assertEquals(strong.volume, TIER_HIT_VOLUME[SoundTier.large] ?? -1);
  assertEquals(weak.volume, TIER_HIT_VOLUME[weak.events.tier] ?? -1);
  assertEquals(weak.spark, TIER_SPARK_SCALE[weak.events.tier] ?? -1.0);
  for (const spark of TIER_SPARK_SCALE) assertEquals(STRONG_SPARK_SCALE > spark, true, "the strong spark is larger than every ordinary spark");
  const copy = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(copy, strong.victim, strong.world.mask);
  assertTrue(copy.visuals.hitStrong);
});

test("every fighter's signature strong hit plays a louder hit plus its own strong sound that the weak hit never plays [k3 measure #389]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    const style = SIGNATURE_STRONG_HIT[character];
    const sweetener = FIGHTER_SOUNDS[character]?.strong;
    assertEquals(style !== undefined && sweetener !== undefined, true, `${name} has a signature move and a strong sound`);
    if (style === undefined || sweetener === undefined) continue;
    for (let serial = 1; serial <= 3; serial++) {
      const strong: { file: string; volume: number }[] = [];
      const weak: { file: string; volume: number }[] = [];
      playHit(character, style, true, HitElement.normal, serial, (file, volume) => strong.push({ file, volume }));
      playHit(character, style, false, HitElement.normal, serial, (file, volume) => weak.push({ file, volume }));
      const label = `${name} style ${style} take ${serial}`;
      assertEquals(strong.length > weak.length, true, `${label} strong layers ${strong.length} outnumber weak ${weak.length}`);
      assertEquals(strong.some((each) => soundFiles(sweetener).includes(each.file)) && !weak.some((each) => soundFiles(sweetener).includes(each.file)), true, `${label} strong hit alone plays ${sweetener}`);
      const loudest = (played: readonly { volume: number }[]) => played.reduce((most, each) => Math.max(most, each.volume), 0);
      assertEquals((strong[0]?.volume ?? 0) >= (weak[0]?.volume ?? 0) && loudest(strong) >= loudest(weak), true, `${label} strong hit is at least as loud as the weak hit`);
    }
  }
});
