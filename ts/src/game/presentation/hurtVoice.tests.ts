import { mutableProjectile } from "../sim/fighterProjectiles";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind, ProjectileKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { type Fighter, createFighter } from "../sim/fighter";
import { updateProjectiles } from "../sim/projectiles";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { DamagePose, damagePose } from "./damagePose";
import { clipFor } from "./fighterClips";
import { CryDecision, createCryGate, gateCry, isCryClip } from "./hurtVoice";

/** The clip index the pose layer selects for the fighter's hit reaction. */
function reactionClip(fighter: Readonly<Fighter>): number {
  const reaction = damagePose(fighter);
  const pose = reaction === DamagePose.ground ? "damageGround" : reaction === DamagePose.tumble ? "damageTumble" : "damageAir";
  return clipFor(fighter.character, pose).index;
}

function blasterHit(): Fighter {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.mountainKing, 20.0, -1);
  const shot = mutableProjectile(owner, 0)!;
  shot.life = 10;
  shot.kind = ProjectileKind.blaster;
  shot.direction = 1;
  shot.x = 0.0;
  shot.z = 45.0;
  shot.velocityX = 30.0;
  updateProjectiles(testWorld(owner, target));
  return target;
}

function smashHit(): Fighter {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.mountainKing, 20.0, -1);
  target.status.damage = 120.0;
  const world = testWorld(owner, target);
  contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(18.0, 100.0, 60.0, 1.0, 1.0), 1, ContactKind.launch, true, undefined));
  return target;
}

test("a Rifleman blaster hit shows Mountain King's flinch without his death cry [reference]", () => {
  const target = blasterHit();
  assertTrue(target.status.damage > 0.0);
  const clip = reactionClip(target);
  // The premise: Mountain King's flinch is his model's Death sequence, which carries the cry.
  assertTrue(isCryClip(Character.mountainKing, clip, ""));
  assertEquals(gateCry(createCryGate(), 100, target, clip, ""), CryDecision.standIn);
});

test("a smash that launches into tumble cries once [reference]", () => {
  const target = smashHit();
  assertEquals(target.launch.damageLevel, 3);
  const clip = reactionClip(target);
  const gate = createCryGate();
  assertEquals(gateCry(gate, 100, target, clip, ""), CryDecision.play);
  assertEquals(gateCry(gate, 101, target, clip, ""), CryDecision.keep, "a cry already showing doesn't restart");
});
