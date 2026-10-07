import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { FIGHTER_OBJECTS } from "../objectData";
import { originalClipCount } from "../assets/fighterOriginalClipInfo";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../sim/codes";
import { STOCK_FALLBACK_CLIP } from "../sim/heroes/hero";
import { HERO_ROSTER, SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { WARDEN_HERO } from "../sim/heroes/wardenHero";
import * as dh from "./demonHunterAssetInfo";
import * as assets from "./fighterAssetInfo";
import { attackPose, characterClips, clipFor, grabActionPoses, namedClips, ownAttackClip, specialClip } from "./fighterClips";
import { WARDEN_MODEL_FILE, WARDEN_SEQUENCES } from "./heroes/wardenClips";
import { WARDEN_FAN_CLIPS } from "./wardenFanClipInfo";
import { characterModelScale } from "./modelScale";
import { type FighterPose, advanceFighterPose, createFighterPose } from "./fighterPose";
import { RECOVERY_CLIPS } from "./recoveryClipInfo";
import { type Fighter, createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { soloWorld } from "../sim/testWorld";

for (const character of SELECTABLE_CHARACTERS) {
  const forward = clipFor(character, "rollForward");
  const backward = clipFor(character, "rollBackward");
  test(`${fighterName(character)} rolls with Roll Forward #${forward.index} / Roll Backward #${backward.index}`, () => {
    for (const facing of [-1, 1]) {
      for (const direction of [-1, 1]) {
        const fighter = createFighter(character, 0.0, facing);
        fighter.dodge.groundFrame = 16;
        fighter.dodge.groundEntryFacing = facing;
        fighter.dodge.groundDirection = direction;
        const pose = createFighterPose();
        advanceFighterPose(pose, fighter, soloWorld(fighter), neutralControls(), false, false, false, false);
        const roll = direction === facing ? forward : backward;
        assertEquals(pose.clipIndex, roll.index);
        assertTrue(roll.index !== clipFor(character, "getUp").index);
        assertTrue(roll.index !== clipFor(character, "idle").index);
        assertTrue(roll.index >= 0 && roll.index < originalClipCount(character));
      }
    }
  });
}

test("the original fighters' tables play their packaged clips", () => {
  assertEquals(clipFor(Character.archer, "jab").index, assets.ARCHER_JAB_INDEX);
  assertEquals(clipFor(Character.rifleman, "throwUp").seconds, assets.RIFLEMAN_THROW_UP_SECONDS);
  assertEquals(clipFor(Character.demonHunter, "victimThrowDown").index, dh.DEMON_HUNTER_VICTIM_THROW_DOWN_INDEX);
  // Archer and Rifleman reuse their roll and get-up attack at the ledge; Illidan has his own.
  assertEquals(clipFor(Character.archer, "ledgeRoll").index, assets.ARCHER_ROLL_FORWARD_INDEX);
  assertEquals(clipFor(Character.rifleman, "ledgeAttack").index, assets.RIFLEMAN_GET_UP_ATTACK_INDEX);
  assertEquals(clipFor(Character.demonHunter, "ledgeRoll").index, dh.DEMON_HUNTER_LEDGE_ROLL_INDEX);
  assertEquals(clipFor(Character.demonHunter, attackPose(AttackStyle.ledgeAttack) ?? "idle").index, dh.DEMON_HUNTER_GET_UP_ATTACK_INDEX);
  // Only Illidan has smash clips; Rifleman's dash attack plays his bayonet thrust.
  assertEquals(ownAttackClip(Character.demonHunter, AttackStyle.upSmash)?.index, dh.DEMON_HUNTER_UP_SMASH_INDEX);
  assertEquals(ownAttackClip(Character.demonHunter, AttackStyle.demonHunterDashAttack)?.index, dh.DEMON_HUNTER_DASH_ATTACK_INDEX);
  assertEquals(ownAttackClip(Character.archer, AttackStyle.forwardSmash), undefined);
  assertEquals(ownAttackClip(Character.rifleman, AttackStyle.dashAttack)?.index, assets.RIFLEMAN_FORWARD_TILT_INDEX);
  // Rifleman summons the bear with his model's stock cast (#111).
  assertEquals(specialClip(Character.rifleman, SpecialAction.riflemanBear, true, false).index, assets.RIFLEMAN_SPELL_INDEX);
  // Originals keep their named stand and walk clips.
  assertEquals(characterClips(Character.archer).idle, undefined);
  assertEquals(grabActionPoses(GrabAction.escape), undefined);
});

test("Archer Fist and Boot plays Attack Jab's quick punch then Down Tilt's low kick", () => {
  assertEquals(clipFor(Character.archer, "jab").index, assets.ARCHER_JAB_INDEX);
  assertEquals(clipFor(Character.archer, "jab").seconds, assets.ARCHER_JAB_SECONDS);
  assertEquals(clipFor(Character.archer, "jab2").index, assets.ARCHER_DOWN_TILT_INDEX);
});

test("a hero plays its registered sequences and its fallback for any pose it leaves out", () => {
  const warden = Character.warden;
  assertEquals(clipFor(warden, "forwardAir").index, WARDEN_SEQUENCES.attack2.index);
  assertEquals(clipFor(warden, "forwardAir").seconds, WARDEN_SEQUENCES.attack2.seconds);
  assertEquals(ownAttackClip(warden, AttackStyle.forwardSmash)?.index, WARDEN_SEQUENCES.spellSlam.index);
  assertEquals(ownAttackClip(warden, AttackStyle.dashAttack)?.index, WARDEN_SEQUENCES.attack2.index);
  assertEquals(specialClip(warden, SpecialAction.heroUp, false, false).index, WARDEN_SEQUENCES.dissipate.index);
  assertEquals(specialClip(warden, SpecialAction.heroDown, true, false).index, WARDEN_FAN_CLIPS.ground.index);
  assertEquals(specialClip(warden, SpecialAction.heroDown, false, false).index, WARDEN_FAN_CLIPS.air.index);
  assertEquals(characterClips(warden).idle?.index, WARDEN_SEQUENCES.standReady.index);
  // Every original or appended action must be present in the packaged pool.
  for (const clip of namedClips(characterClips(warden))) assertTrue(clip.index >= 0 && clip.index < originalClipCount(warden));
  // A hero plays its fallback for a pose its table leaves out; a character no hero registers plays the stock first sequence.
  for (const hero of HERO_ROSTER) assertEquals(clipFor(hero.character, "upAir"), hero.presentation.clips.upAir ?? hero.presentation.fallback);
  assertEquals(clipFor(99, "upAir"), STOCK_FALLBACK_CLIP);
  // One registration gives the body its unit, model and scale.
  assertEquals(FIGHTER_OBJECTS[warden].model, WARDEN_MODEL_FILE);
  assertEquals(FIGHTER_OBJECTS[warden].id, WARDEN_HERO.presentation.objectId);
  assertEquals(FIGHTER_OBJECTS[warden].scale, characterModelScale(warden));
});

test("a hero table's state poses take over the states only Illidan has clips for", () => {
  const s = WARDEN_SEQUENCES;
  const step = (f: Fighter, pose: FighterPose, wasOut = false) => advanceFighterPose(pose, f, soloWorld(f), neutralControls(), wasOut, false, false, false);
  const shielded = createFighter(Character.warden, 0.0, 1);
  const pose = createFighterPose();
  shielded.shield.raised = true;
  step(shielded, pose);
  assertEquals(pose.clipIndex, s.standChannel.index);
  const dodging = createFighter(Character.warden, 0.0, 1);
  dodging.motion.grounded = false;
  dodging.dodge.airDodging = true;
  const dodgePose = createFighterPose();
  step(dodging, dodgePose);
  assertEquals(dodgePose.clipIndex, RECOVERY_CLIPS[Character.warden].airDodge.index);
  const falling = createFighter(Character.warden, 0.0, 1);
  falling.motion.grounded = false;
  const fallPose = createFighterPose();
  step(falling, fallPose);
  assertEquals(fallPose.clipIndex, s.standReady.index);
  assertEquals(fallPose.rate, 0.0);
  falling.status.out = true;
  step(falling, fallPose);
  assertEquals(fallPose.clipIndex, s.death.index);
  // The originals map none of these states, so a shielding archer keeps his named stand.
  const archer = createFighter(Character.archer, 0.0, 1);
  archer.shield.raised = true;
  const archerPose = createFighterPose();
  step(archer, archerPose);
  assertEquals(archerPose.clipIndex, undefined);
  assertEquals(archerPose.clipName, "stand");
});
