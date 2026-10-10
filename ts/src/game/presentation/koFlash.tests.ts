import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ContactKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { type Fighter, createFighter } from "../sim/fighter";
import { stageBounds } from "../sim/stageBounds";
import { advanceFighter } from "../sim/step";
import { contactBatch, controls, hitEffect, testWorld } from "../sim/testWorld";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { KO_BLUR_FADE_FRAMES, KO_BLUR_SCALE, KO_FLASH_ALPHA, KO_FLASH_TAIL_FRAMES, createKoFlash, koFlashLevels, noteKoFlash } from "./koFlash";

function fingerprint(f: Readonly<Fighter>): string {
  const { motion, launch, status } = f;
  return `${motion.x} ${motion.z} ${motion.vx} ${motion.vz} ${launch.hitlag} ${launch.hitstun} ${status.damage} ${status.stocks} ${status.out}`;
}


function playKo(watch: boolean): { readonly frames: readonly string[]; readonly kos: readonly number[]; readonly hitlag: number; readonly flash: ReturnType<typeof createKoFlash> } {
  const attacker = createFighter(Character.rifleman, stageBounds(0).blast.right - 160.0, 1);
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

test("the KO flash peaks at Silverpine's caps after the blow's hitlag and turns off after its blur and wash fade [spec docs/design/visual-quality.md]", () => {
  const flash = createKoFlash();
  const fighter = createFighter(Character.rifleman, 0.0, 1);
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
  assertEquals(koFlashLevels(flash, 100)?.alpha, 0);
  assertEquals(koFlashLevels(flash, 112)?.blur, KO_BLUR_SCALE);
  assertEquals(koFlashLevels(flash, 112)?.alpha, KO_FLASH_ALPHA);
  assertEquals(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES)?.blur, 0.0);
  assertTrue(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES + KO_FLASH_TAIL_FRAMES - 1)?.showing === true);
  assertEquals(koFlashLevels(flash, 112 + KO_BLUR_FADE_FRAMES + KO_FLASH_TAIL_FRAMES)?.showing, false);
});


const GAMMA = f32(2.2);


// Native captures (#289): both looks draw nothing below alpha 4, and Reforged and Definitive blend in linear light.
function washedLuma(scene: number, alpha: number, colour: number, reforged: boolean): number {
  const a = alpha < 4 ? 0 : alpha / 255;
  if (!reforged) return scene + (colour - scene) * a;
  const linear = Math.pow(scene / 255, GAMMA);
  return 255 * Math.pow(linear * (1 - a) + a * Math.pow(colour / 255, GAMMA), 1 / GAMMA);
}

test("the KO flash eases out in Classic and Reforged, never stepping more than 6 luma a frame from its peak through the off call, nor 3 over a dark scene in its last 20 frames [repro #289]", () => {

  const flash = createKoFlash();
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const events = createImpactEvents();
  events.koDirectionX = 1;
  fighter.launch.hitlag = 12;
  events.hit = true;
  noteKoFlash(flash, 0, 0, fighter, events);
  const peak = 12;
  const off = peak + KO_BLUR_FADE_FRAMES + KO_FLASH_TAIL_FRAMES;
  assertEquals(koFlashLevels(flash, peak)?.alpha, KO_FLASH_ALPHA);
  assertEquals(koFlashLevels(flash, off - 1)?.showing, true);
  assertEquals(koFlashLevels(flash, off)?.showing, false);
  for (const [mode, scene, reforged] of [["Classic", f32(92.6), false], ["Reforged", f32(91.6), true], ["Reforged lower half", f32(43.0), true]] as const) {
    let previous = washedLuma(scene, KO_FLASH_ALPHA, 255, reforged);
    for (let frame = peak + 1; frame <= off; frame++) {
      const levels = koFlashLevels(flash, frame);
      const luma = levels?.showing === true ? washedLuma(scene, levels.alpha, levels.colour, reforged) : scene;
      if (scene > 50 || frame > off - KO_FLASH_TAIL_FRAMES) assertEquals(Math.abs(luma - previous) <= (scene > 50 ? 6 : 3), true, `${mode} frame ${frame}: luma ${previous} to ${luma}`);
      previous = luma;
    }
    assertEquals(previous, scene, `${mode} ends on the scene`);
  }
});

test("the KO blur eases to 0 by its last shown frame, stepping at most 1.5x its average fall rate a frame, for every hitlag [repro #289]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const events = createImpactEvents();
  events.koDirectionX = 1;
  const bound = (1.5 * KO_BLUR_SCALE) / (KO_BLUR_FADE_FRAMES - 1) + f32(1e-3);
  for (let hitlag = 1; hitlag <= 30; hitlag++) {
    const flash = createKoFlash();
    fighter.launch.hitlag = hitlag;
    noteKoFlash(flash, 0, 0, fighter, events);
    const off = flash.rise + KO_BLUR_FADE_FRAMES;
    assertEquals(koFlashLevels(flash, off - 1)?.blur, 0.0, `hitlag ${hitlag}: the off call finds no blur`);
    let previous = KO_BLUR_SCALE;
    for (let frame = flash.rise + 1; frame <= off; frame++) {
      const levels = koFlashLevels(flash, frame);
      const blur = levels?.showing === true ? levels.blur : 0.0;
      assertEquals(Math.abs(blur - previous) <= bound, true, `hitlag ${hitlag} frame ${frame}: blur ${previous} to ${blur}`);
      previous = blur;
    }
  }
});
