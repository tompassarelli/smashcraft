import { expect, test } from "bun:test";
import { encodeMoveTable } from "../scripts/moveTableEncode";
import { MOVE_TABLES } from "../scripts/moveTables";
import { MOUNTAIN_KING_HERO } from "../src/game/sim/heroes/mountainKingHero";
import { MOUNTAIN_KING_MOVES } from "../src/game/sim/heroes/mountainKingMoves";
import { MOUNTAIN_KING_SPECIALS } from "../src/game/sim/heroes/mountainKingSpecials";
import { MOUNTAIN_KING_TABLE_ROWS } from "../src/game/sim/heroes/mountainKingTable";
import { FOLLOW_UP_FORM, FollowUpInput, specialForm, specialKit } from "../src/game/sim/heroSpecials";
import {
  FollowField, HitField, MotionField, MotionFlag, MoveField, MoveFlag, NORMAL_COUNT, type MoveTable, PoseField, SPECIAL_SLOTS, ShotField,
  followField, hasMoveFlag, hitField, hasNormal, motionField, moveField, moveShot, poseField, shotField, shotLimit, specialMove,
} from "../src/game/sim/moveTable";

const table = (): MoveTable => {
  const loaded = MOUNTAIN_KING_HERO.moves.table;
  if (loaded === undefined || MOUNTAIN_KING_HERO.specials?.table !== loaded) throw new Error("Mountain King runs without its move table");
  return loaded;
};

const regionsOf = (moveTable: MoveTable, id: number) => {
  const first = moveField(moveTable, id, MoveField.hitFirst);
  return moveTable.regions.slice(first, first + moveField(moveTable, id, MoveField.hitCount));
};

test("each checked-in move table equals its generator's encoding of the authored kit [reference]", () => {
  for (const { moves, specials, name } of MOVE_TABLES) {
    expect(name).toBe("MOUNTAIN_KING_TABLE_ROWS");
    expect(MOUNTAIN_KING_TABLE_ROWS).toEqual(encodeMoveTable(moves, specials));
  }
});

test("Mountain King's table carries each normal and throw of the authored kit [reference]", () => {
  const moveTable = table();
  for (let style = 0; style < NORMAL_COUNT; style++) {
    const move = MOUNTAIN_KING_MOVES.normals[style];
    expect(hasNormal(moveTable, style)).toBe(move !== undefined);
    if (move === undefined) continue;
    expect([moveField(moveTable, style, MoveField.startup), moveField(moveTable, style, MoveField.active), moveField(moveTable, style, MoveField.total),
      moveField(moveTable, style, MoveField.landingLag)]).toEqual([move.startupFrames, move.activeFrames, move.totalFrames, move.landingLag]);
    expect(regionsOf(moveTable, style)).toEqual(move.regions.map(region => region.hit));
    const first = moveField(moveTable, style, MoveField.hitFirst);
    move.regions.forEach((region, index) => expect([hitField(moveTable, first + index, HitField.first), hitField(moveTable, first + index, HitField.last)]).toEqual([region.firstFrame, region.lastFrame]));
    const poses = MOUNTAIN_KING_MOVES.hurtboxes?.attacks[style] ?? [];
    const pose = moveField(moveTable, style, MoveField.hurtFirst);
    expect(poses.map((each, index) => [each.firstFrame, each.lastFrame, moveTable.poseParts[pose + index]]))
      .toEqual(poses.map((each, index) => [poseField(moveTable, pose + index, PoseField.first), poseField(moveTable, pose + index, PoseField.last), each.parts]));
  }
  expect(moveTable.poseParts[moveTable.standPose]).toEqual(MOUNTAIN_KING_MOVES.hurtboxes?.stand);
});

test("Mountain King's table carries every special form, EX form and follow-up of the authored kit [reference]", () => {
  const moveTable = table();
  for (let slot = 0; slot < SPECIAL_SLOTS; slot++) {
    const kit = specialKit(MOUNTAIN_KING_SPECIALS, slot);
    for (let form = 0; form < moveTable.formCount; form++) {
      for (const ex of [false, true]) {
        const move = specialForm(kit, form, ex);
        const id = specialMove(moveTable, slot, form, ex);
        expect(moveField(moveTable, id, MoveField.total)).toBe(move.endFrame);
        expect(moveField(moveTable, id, MoveField.landingLag)).toBe(move.landingLag ?? -1);
        expect(moveField(moveTable, id, MoveField.aimFrames)).toBe(move.aimFrames ?? -1);
        expect([hasMoveFlag(moveTable, id, MoveFlag.helpless), hasMoveFlag(moveTable, id, MoveFlag.oncePerAirtime), hasMoveFlag(moveTable, id, MoveFlag.facesStick),
          hasMoveFlag(moveTable, id, MoveFlag.recallsProjectiles)])
          .toEqual([move.helpless === true, move.oncePerAirtime === true, move.facesStick === true, move.recallsProjectiles === true]);
        expect(regionsOf(moveTable, id)).toEqual((move.regions ?? []).map(region => region.hit));
        const motion = move.motion ?? [];
        const firstMotion = moveField(moveTable, id, MoveField.motionFirst);
        expect(motion.map((_, index) => [motionField(moveTable, firstMotion + index, MotionField.first), motionField(moveTable, firstMotion + index, MotionField.last),
          motionField(moveTable, firstMotion + index, MotionField.velocityX), motionField(moveTable, firstMotion + index, MotionField.velocityZ),
          (motionField(moveTable, firstMotion + index, MotionField.flags) & MotionFlag.aimed) === 0 ? undefined : motionField(moveTable, firstMotion + index, MotionField.aimedSpeed),
          (motionField(moveTable, firstMotion + index, MotionField.flags) & MotionFlag.stopsAtBody) !== 0]))
          .toEqual(motion.map(segment => [segment.first, segment.last, segment.velocityX, segment.velocityZ, segment.aimedSpeed, segment.stopsAtBody === true]));
        const shots = move.projectiles ?? [];
        expect(shots.map((_, index) => moveTable.shotSpecs[moveShot(moveTable, id, index)])).toEqual(shots);
        shots.forEach((spec, index) => {
          const row = moveShot(moveTable, id, index);
          expect(moveTable.shotSpecs[row]).toBe(spec);
          expect([shotField(moveTable, row, ShotField.spawnFrame), shotLimit(moveTable, row)]).toEqual([spec.spawnFrame, spec.limit]);
        });
        // A follow-up form whose branch is missing falls back to its base move; its own branches start from the base form.
        const followUps = move.followUps ?? [];
        const base = form % FOLLOW_UP_FORM;
        const firstFollow = moveField(moveTable, id, MoveField.followFirst);
        expect(followUps.map((_, index) => [followField(moveTable, firstFollow + index, FollowField.first), followField(moveTable, firstFollow + index, FollowField.last),
          followField(moveTable, firstFollow + index, FollowField.input), followField(moveTable, firstFollow + index, FollowField.target)]))
          .toEqual(followUps.map((followUp, index) => [followUp.window.first, followUp.window.last, followUp.input ?? FollowUpInput.special,
            specialMove(moveTable, slot, base + FOLLOW_UP_FORM * (index + 1), ex)]));
        const hurt = move.hurt ?? [];
        const pose = moveField(moveTable, id, MoveField.hurtFirst);
        expect(hurt.map((_, index) => moveTable.poseParts[pose + index])).toEqual(hurt.map(each => each.parts));
      }
    }
  }
});
