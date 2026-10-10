import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState } from "./codes";
import { canAttack } from "./conditions";
import { createReferenceFighter } from "./referenceRig";
import { advanceSolo, controls } from "./testWorld";
import { AUTHORED_PHYSICS, type FighterPhysics, melee } from "./tuning";

const FLOOR_RECOVERY_REFERENCE_PHYSICS: FighterPhysics = { ...AUTHORED_PHYSICS.reference, traction: melee(0.07999999821186066) };

const RECORDED_TECH_POSITION =[-42.34517288208008, -42.67805099487305, -42.930931091308594, -43.10380935668945, -43.196685791015625, -43.209564208984375];
const RECORDED_TECH_KNOCKBACK = [
  -0.41287824511528015, -0.3328782618045807, -0.2528782784938812, -0.17287829518318176, -0.0928783044219017, -0.012878312729299068, 0.0,
];
const RECORDED_MISSED_TECH_POSITION = [-38.086673736572266, -38.44503402709961, -38.72339630126953];
const RECORDED_MISSED_TECH_KNOCKBACK = [-0.4383614957332611, -0.35836151242256165, -0.2783615291118622];

function recordedFloorRecoveryFirstDifference(character: Character, tech: boolean, velocityOffset: number): number {
  const fighter = createReferenceFighter(character, melee(tech ? -41.93229293823242 : -37.648311614990234), 1);
  fighter.tuning.physics = FLOOR_RECOVERY_REFERENCE_PHYSICS;
  fighter.down.state = tech ? DownState.tech : DownState.bound;
  fighter.down.frame = 1;
  fighter.launch.knockbackX = f32(melee(tech ? -0.492878258228302 : -0.5183614492416382) + velocityOffset);
  const damage = tech ? 25.0 : 42.5;
  fighter.status.damage = damage;
  const input = controls({ shield: true, direction: tech ? 0 : -1 });
  const positions = tech ? RECORDED_TECH_POSITION : RECORDED_MISSED_TECH_POSITION;
  const knockbacks = tech ? RECORDED_TECH_KNOCKBACK : RECORDED_MISSED_TECH_KNOCKBACK;
  let firstDifference = 0;
  for (let sample = 1; sample <= (tech ? 7 : 3); sample++) {
    advanceSolo(fighter, 0, input, 0.0);
    const position = positions[Math.min(sample, positions.length) - 1]!;
    if (firstDifference === 0 && (Math.abs(f32(fighter.motion.x - melee(position))) > 0.00009999999747378752
      || Math.abs(f32(fighter.launch.knockbackX - melee(knockbacks[sample - 1]!))) > 0.000009999999747378752
      || !fighter.motion.grounded || fighter.motion.vx !== 0 || fighter.launch.knockbackZ !== 0 || fighter.launch.hitlag !== 0
      || fighter.down.state !== (tech ? DownState.tech : DownState.bound) || fighter.down.frame !== sample + 1
      || fighter.status.damage !== damage || fighter.shield.raised || canAttack(fighter))) {
      firstDifference = (tech ? 203 : 955) + sample;
    }
  }
  return firstDifference;
}

test("recorded floor recovery skids match a tech and a missed tech on both original hosts [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman]) {
    assertEquals(recordedFloorRecoveryFirstDifference(character, true, 0.0), 0);
    assertEquals(recordedFloorRecoveryFirstDifference(character, false, 0.0), 0);
  }
});
