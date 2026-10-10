import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames, isAerialAttack } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { melee } from "../sim/tuning";
import type { CpuTier } from "./cpuProfiles";
import { botChoice } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

const sign = (value: number): -1 | 0 | 1 => value < 0 ? -1 : value > 0 ? 1 : 0;


export function defenceSlipRates(execution: number, tier: CpuTier = "expert") {
  const missed = 100 - execution;
  const rank = tier === "expert" ? 0 : tier === "advanced" ? 1 : tier === "intermediate" ? 2 : tier === "beginner" ? 3 : 4;
  return {
    noDiKill: rank === 0 ? 140 : rank === 1 ? 170 : rank === 2 ? 180 : rank === 3 ? 240 : 320,
    noDiOther: rank === 0 ? 180 : rank === 1 ? 200 : rank === 2 ? 220 : rank === 3 ? 300 : 400,
    wrongDi: 45 + rank * 25,
    strongSdiMiss: rank === 0 ? 620 : rank <= 2 ? 690 : rank === 3 ? 780 : 860,
    followupSdiMiss: rank <= 1 ? 880 : rank === 2 ? 890 : rank === 3 ? 930 : 970,
    wrongSdi: 40 + rank * 25,
    fullHop: rank === 0 ? 9 : rank === 1 ? 12 : rank === 2 ? 16 : rank === 3 ? 24 : 36,
    aerial: 20 + missed * 4, driftFrames: 5 + floorDiv(missed, 8),
  };
}


export function chooseHitlagInput(f: Readonly<Fighter>, slot: number, frame: number, skill: CpuSkill, input: Controls): void {
  const { launch } = f;
  if (!launch.diPending) return;
  const rates = defenceSlipRates(skill.decision.executionPercent, skill.tier);
  const outward = launch.knockbackX !== 0.0 ? sign(launch.knockbackX) : f.motion.x < 0 ? -1 : 1;
  const upward = Math.abs(launch.knockbackZ) > Math.abs(launch.knockbackX);
  const survival = f.status.damage >= 80 || launch.diLaunchSpeed >= 20.0;


  let x: -1 | 0 | 1 = upward ? outward : 0;
  let z: -1 | 0 | 1 = upward ? 0 : survival ? 1 : -1;
  if (!survival && upward) x = sign(-outward);
  const key = f.visuals.hit;
  const kill = f.status.damage >= 100 && launch.diLaunchSpeed >= melee(3.0) && launch.knockbackZ > 0;
  const noDi = skill.executionMistakes !== false && botChoice(key, slot * 131 + f.character * 7 + 101, 1000) < (kill ? rates.noDiKill : rates.noDiOther);

  const wrongDi = skill.executionMistakes !== false && !noDi && botChoice(key, slot * 131 + f.character * 7 + 101, 1000) < (kill ? rates.noDiKill : rates.noDiOther) + rates.wrongDi;
  if (noDi || wrongDi) {
    if (noDi) { x = 0; z = 0; }
    else { x = sign(-x); z = sign(-z); }
  }
  input.direction = x;
  input.verticalDirection = z;
  if (launch.hitlagFrames < 9 && !(launch.sdiFollowup && launch.hitlagFrames >= 3)) return;
  const missRate = launch.sdiFollowup ? rates.followupSdiMiss : rates.strongSdiMiss;
  const miss = skill.executionMistakes !== false && botChoice(key, slot * 131 + f.character * 7 + 103, 1000) < missRate;
  if (floorMod(frame, 2) !== 0) return;
  const escapeX = survival ? -outward : outward;
  const wrong = skill.executionMistakes !== false && !miss && botChoice(key, slot * 131 + f.character * 7 + 104, 1000) < rates.wrongSdi;
  input.sdiPulse = !miss;
  input.sdiX = wrong ? -escapeX : escapeX;
  input.sdiZ = 0;
}


export function applyAerialExecutionNoise(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, slot: number, skill: CpuSkill, input: Controls): void {
  if (f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.grab.owner !== undefined || f.status.out) return;
  const rates = defenceSlipRates(skill.decision.executionPercent, skill.tier);
  if (f.motion.grounded && (input.jumpPressed || f.jump.squat > 0) && !input.jumpHeld) {
    const full = skill.executionMistakes !== false && botChoice(f.jump.serial + 1, slot * 137 + f.character * 11 + 105, 1000) < rates.fullHop;
    input.jumpHeld = full;
    if (input.jumpPressed) input.shortHopPressed = !full;
  }
  if (target === undefined || f.motion.grounded || f.attack.style === undefined || !isAerialAttack(f.attack.style)) return;
  const miss = skill.executionMistakes !== false && botChoice(f.attack.serial, slot * 137 + f.character * 11 + 106, 1000) < rates.aerial;
  const late = attackStartupFrames(f.attack.style, f.tuning.moves) + botChoice(f.attack.serial, slot * 137 + f.character * 11 + 107, 3);
  if (!miss || f.attack.frame < late || f.attack.frame >= late + rates.driftFrames) return;
  input.direction = target.motion.x < f.motion.x ? -1 : 1;
  input.down = f.motion.vz < 0;
}
