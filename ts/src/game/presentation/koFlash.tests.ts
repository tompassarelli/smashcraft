import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { type Fighter, createFighter } from "../sim/fighter";
import { stageBounds } from "../sim/stageBounds";
import { advanceFighter } from "../sim/step";
import { contactBatch, controls, hitEffect, testWorld } from "../sim/testWorld";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { KO_BLUR_FADE_FRAMES, KO_BLUR_SCALE, KO_FILTER_NEUTRAL_GREY, createKoFlash, koFlashLevels, noteKoFlash } from "./koFlash";

function fingerprint(f: Readonly<Fighter>): string {
  const { motion, launch, status } = f;
  return `${motion.x} ${motion.z} ${motion.vx} ${motion.vz} ${launch.hitlag} ${launch.hitstun} ${status.damage} ${status.stocks} ${status.out}`;
}

/** A launch near the right blast zone, played to its KO; `flash` watches each confirmed frame as the shell does. */
function playKo(watch: boolean): { readonly frames: readonly string[]; readonly kos: readonly number[]; readonly hitlag: number; readonly flash: ReturnType<typeof createKoFlash> } {
  const attacker = createFighter(Character.archer, stageBounds(0).blast.right - 160.0, 1);
  const victim = createFighter(Character.rifleman, stageBounds(0).blast.right - 120.0, -1);
  const world = testWorld(attacker, victim);
  const events = createImpactEvents();
  const flash = createKoFlash();
  const frames: string[] = [];
  const kos: number[] = [];
  captureImpactEventsBefore(events, victim);
  contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(20.0, 100.0, 120.0, 1.0, 0.5), 1, ContactKind.launch, true, undefined));
  finishImpactEventsAfter(events, victim);
  const hitlag = victim.launch.hitlag;
  if (watch && noteKoFlash(flash, 0, 1, victim, events)) kos.push(0);
  for (let frame = 1; frame <= 240 && !victim.status.out; frame++) {
    captureImpactEventsBefore(events, victim);
    advanceFighter(world, 1, 0, controls(), 240.0, frame);
    advanceFighter(world, 0, 0, controls(), -240.0, frame);
    finishImpactEventsAfter(events, victim);
    if (watch) {
      if (noteKoFlash(flash, frame, 1, victim, events)) kos.push(frame);
      for (let presented = frame - 2; presented <= frame; presented++) koFlashLevels(flash, presented);
    }
    frames.push(`${fingerprint(attacker)} | ${fingerprint(victim)}`);
  }
  return { frames, kos, hitlag, flash };
}

test("the KO flash leaves a launch to its KO frame for frame unchanged [invariant]", () => {
  const plain = playKo(false);
  const watched = playKo(true);
  assertTrue(plain.hitlag > 0);
  assertEquals(watched.kos.length, 1, "one KO starts one flash");
  assertEquals(watched.frames.length, plain.frames.length);
  for (let i = 0; i < plain.frames.length; i++) assertEquals(watched.frames[i], plain.frames[i], `frame ${i + 1}`);
  assertEquals(watched.flash.rise, plain.hitlag, "the flash rises over the KO blow's hitlag");
});

test("the KO flash peaks at Silverpine's caps after the blow's hitlag and turns off after its blur fades [spec docs/design/visual-quality.md]", () => {
  const flash = createKoFlash();
  const fighter = createFighter(Character.archer, 0.0, 1);
  const events = createImpactEvents();
  fighter.launch.hitlag = 12;
  events.hit = true;
  assertFalse(noteKoFlash(flash, 99, 2, fighter, events));
  assertEquals(koFlashLevels(flash, 99), undefined);
  fighter.launch.hitlag = 0;
  events.hit = false;
  events.koDirectionX = 1;
  assertTrue(noteKoFlash(flash, 100, 2, fighter, events));
  assertEquals(koFlashLevels(flash, 100)?.blur, 0.0);
  assertEquals(koFlashLevels(flash, 100)?.grey, 185);
  assertEquals(koFlashLevels(flash, 112)?.blur, KO_BLUR_SCALE);
  assertEquals(koFlashLevels(flash, 112)?.grey, 255);
  assertTrue(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES - 1)?.showing === true);
  assertEquals(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES)?.showing, false);
  assertEquals(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES)?.blur, 0.0);
});

test("the KO filter fades to neutral before it turns off, never stepping more than 6 luma a frame [repro #289]", () => {
  // Lane C's Classic capture: a 92.6-luma scene read 132 under the 185 floor and snapped back at the off call, so one grey unit moves about 92.6 / 128 luma; 6 luma is 7680 / 926 grey.
  const flash = createKoFlash();
  const fighter = createFighter(Character.archer, 0.0, 1);
  const events = createImpactEvents();
  events.koDirectionX = 1;
  fighter.launch.hitlag = 12;
  events.hit = true;
  noteKoFlash(flash, 0, 0, fighter, events);
  const peak = 12;
  const off = peak + KO_BLUR_FADE_FRAMES;
  assertEquals(koFlashLevels(flash, peak)?.grey, 255);
  assertEquals(koFlashLevels(flash, off - 1)?.showing, true);
  assertEquals(koFlashLevels(flash, off - 1)?.grey, KO_FILTER_NEUTRAL_GREY, "transparent on the last frame before the off call");
  assertEquals(koFlashLevels(flash, off)?.showing, false);
  let previous = 255;
  for (let frame = peak + 1; frame <= off; frame++) {
    const levels = koFlashLevels(flash, frame);
    const grey = levels?.showing === true ? levels.grey : KO_FILTER_NEUTRAL_GREY;
    assertEquals(Math.abs(grey - previous) * 926 <= 7680, true, `frame ${frame}: grey ${previous} to ${grey}`);
    previous = grey;
  }
});
