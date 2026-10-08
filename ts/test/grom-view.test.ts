import { afterAll, beforeAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, start } from "../src/platform/devMain";
import { shell } from "../src/platform/shell/state";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster } from "../src/game/sim/roster";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { beginAttack, beginDownState } from "../src/game/sim/transitions";
import { DownState } from "../src/game/sim/codes";
import { isAerialAttack } from "../src/game/sim/moves";
import { GROM_MOVES } from "../src/game/sim/heroes/gromMoves";
import { originalClip } from "../src/game/assets/fighterOriginalClipInfo";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { controls } from "../src/game/sim/testWorld";
import { startFighterSpecial } from "../src/game/sim/specials";
const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const clients = headless.clients({ start, install }, [0]);
const client = clients.client(0);
beforeAll(() => { clients.start(); clients.frames(30); clients.chat(0, "-dev quick pair Grom Hellscream / Rifleman"); clients.frames(2); }, 30000);
for (const facing of [-1, 1]) for (const style of [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir, AttackStyle.getupAttack, AttackStyle.ledgeAttack]) test(`Wisp plays Grom normal ${style} facing ${facing} through contact with the whole timeline body [spec #340]`, () => {
    const move = GROM_MOVES.normals[style], region = move?.regions[0], strike = region?.hit.strike;
    if (move === undefined || region === undefined || strike === undefined) throw new Error(`Missing move ${style}`);
    client.run(() => {
      const s = shell(); s.game.computerMask = 0;
      const owner = createFighter(Character.grom, 0.0, facing), target = createFighter(Character.rifleman, (strike.x2 + (move.startupTravelX ?? 0)) * facing, -facing);
      owner.motion.grounded = !isAerialAttack(style); owner.motion.z = owner.motion.grounded ? 0 : 500;
      target.motion.grounded = false; target.motion.z = Math.max(0, owner.motion.z + strike.z2 - 60); target.launch.hitlag = 120;
      s.world = createRoster(3, [owner, target]);
      if (style === AttackStyle.getupAttack) beginDownState(owner, DownState.attack, 0); else if (style === AttackStyle.ledgeAttack) beginAttack(owner, style, false); else beginFighterAttack(s.world, 0, style, false);
    });
    clients.frames(region.firstFrame + 2);
    client.run(() => {
      const s = shell(), target = s.world.fighters[1]; expect(target?.status.damage, `${style}/${facing}`).toBeGreaterThan(0);
      const pose = s.runtime.poses[0], clip = pose?.clipIndex === undefined ? undefined : originalClip(Character.grom, pose.clipIndex);
      expect(clip?.timeline, `${style}/${facing}`).toBe(true);
      expect(MODEL_FACTS[clip?.modelPath ?? ""]?.triangles).toBeGreaterThan(0);
    });
  expect(client.errors).toEqual([]);
});

for (const facing of [-1, 1]) for (const air of [false, true]) for (const [name, x, z, targetX, targetZ, contact] of [
  ["Warsong Cry", 0, 0, 44, 0, 12], ["Gorehowl Rush", 1, 0, 104, 0, 10], ["Blood Leap", 0, 1, 12, 96, 7], ["Mannoroth's Bane", 0, -1, 124, 0, 20],
] as const) test(`Wisp plays Grom ${name} ${air ? "air" : "ground"} facing ${facing} through contact with the whole timeline body [spec #340]`, () => {
  client.run(() => {
    const s = shell(); s.game.computerMask = 0;
    const owner = createFighter(Character.grom, 0, facing), target = createFighter(Character.rifleman, targetX * facing, -facing);
    owner.motion.grounded = !air; owner.motion.surface = 0; owner.motion.z = air ? 500 : 0;
    target.motion.grounded = false; target.motion.z = owner.motion.z + targetZ; target.launch.hitlag = air ? 0 : 120;
    s.world = createRoster(3, [owner, target]);
    startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: x * facing, specialZ: z }));
  });
  clients.frames(contact + 1);
  client.run(() => {
    const s = shell(); expect(s.world.fighters[1]?.status.damage).toBeGreaterThan(0);
    const pose = s.runtime.poses[0], clip = pose.clipIndex === undefined ? undefined : originalClip(Character.grom, pose.clipIndex);
    expect(clip?.timeline).toBe(true); expect(MODEL_FACTS[clip?.modelPath ?? ""]?.triangles).toBeGreaterThan(0);
  });
  expect(client.errors).toEqual([]);
});
