import { afterAll, beforeAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { install, start } from "../src/platform/devMain";
import { shell } from "../src/platform/shell/state";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster } from "../src/game/sim/roster";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { isAerialAttack } from "../src/game/sim/moves";
import { MALFURION_MOVES } from "../src/game/sim/heroes/malfurionMoves";
import { originalClip } from "../src/game/assets/fighterOriginalClipInfo";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { controls } from "../src/game/sim/testWorld";
import { startFighterSpecial } from "../src/game/sim/specials";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);
const clients = headless.clients({ start, install }, [0]);
const client = clients.client(0);
beforeAll(() => { clients.start(); clients.frames(30); clients.chat(0, "-dev quick pair Malfurion Stormrage / Rifleman"); clients.frames(2); }, 30000);

function wholeBody(label: string): void {
  const pose = shell().runtime.poses[0];
  const clip = pose?.clipIndex === undefined ? undefined : originalClip(Character.malfurion, pose.clipIndex);
  expect(clip?.timeline, label).toBe(true);
  expect(MODEL_FACTS[clip?.modelPath ?? ""]?.triangles, label).toBe(MODEL_FACTS["units\\nightelf\\Furion\\Furion.mdl"]?.triangles);
}

for (const facing of [-1, 1]) for (const style of [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir]) {
  test(`Wisp plays Malfurion normal ${style} facing ${facing} through contact with his whole body [spec #342]`, () => {
    const move = MALFURION_MOVES.normals[style], region = move?.regions[0], strike = region?.hit.strike;
    if (move === undefined || region === undefined || strike === undefined) throw new Error(`Missing move ${style}`);
    client.run(() => {
      const s = shell(); s.game.computerMask = 0;
      const owner = createFighter(Character.malfurion, 0, facing), target = createFighter(Character.rifleman, (strike.x2 + (move.startupTravelX ?? 0)) * facing, -facing);
      owner.motion.grounded = !isAerialAttack(style); owner.motion.z = owner.motion.grounded ? 0 : 500;
      if (style === AttackStyle.forwardAir) owner.motion.vz = 10;
      target.motion.grounded = false; target.motion.z = Math.max(0, owner.motion.z + strike.z2 - 60); target.launch.hitlag = 120;
      s.world = createRoster(3, [owner, target]); beginFighterAttack(s.world, 0, style, false);
    });
    clients.frames(region.firstFrame + 2);
    client.run(() => { expect(shell().world.fighters[1]?.status.damage, `${style}/${facing}`).toBeGreaterThan(0); wholeBody(`${style}/${facing}`); });
    expect(client.errors).toEqual([]);
  });
}

for (const facing of [-1, 1]) for (const air of [false, true]) for (const [name, x, z, targetX, targetZ] of [
  ["Entangling Roots", 0, 0, 180, 0], ["Stag Charge", 1, 0, 104, 0],
  ["Dream Ascent", 0, 1, 0, 96], ["Force of Nature", 0, -1, 124, 0],
] as const) {
  if (air && name === "Force of Nature") continue;
  test(`Wisp plays Malfurion ${name} ${air ? "air" : "ground"} facing ${facing} through contact [spec #342]`, () => {
    client.run(() => {
      const s = shell(); s.game.computerMask = 0;
      const owner = createFighter(Character.malfurion, 0, facing), target = createFighter(Character.rifleman, targetX * facing, -facing);
      owner.motion.grounded = !air; owner.motion.surface = 0; owner.motion.z = air ? 500 : 0;
      target.motion.grounded = false; target.motion.z = owner.motion.z + targetZ - (air && name === "Stag Charge" ? 96 : 0); target.launch.hitlag = 120;
      s.world = createRoster(3, [owner, target]);
      expect(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialX: x * facing, specialZ: z }), s.world)).toBe(true);
    });
    let hit = false;
    for (let frame = 0; frame < 120 && !hit; frame++) {
      clients.frames(1);
      client.run(() => { hit = (shell().world.fighters[1]?.status.damage ?? 0) > 0; });
    }
    expect(hit, `${name}/${facing}/${air}`).toBe(true);
    client.run(() => {
      wholeBody(`${name}/${facing}/${air}`);
      if (name === "Stag Charge") expect(client.effectPoses().some(effect => effect.model.includes("BlackStagMale") && effect.scale > 0 && effect.alpha > 0)).toBe(true);
    });
    expect(client.errors).toEqual([]);
  });
}
