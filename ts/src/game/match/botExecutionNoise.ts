import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames, isAerialAttack } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { botChoice } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

const sign = (value: number): -1 | 0 | 1 => value < 0 ? -1 : value > 0 ? 1 : 0;

/** Initial human slip rates, per thousand opportunities, scaled by execution reliability (#357). */
export function defenceSlipRates(execution: number) {
  const missed = 100 - execution;
  return { di: 30 + missed * 5, sdi: 60 + missed * 8, fullHop: 3 + floorDiv(missed, 2), aerial: 20 + missed * 4, driftFrames: 5 + floorDiv(missed, 8) };
}

/** A hit's launch angle is visible to its victim; this reads no opponent state. */
export function chooseHitlagInput(f: Readonly<Fighter>, slot: number, frame: number, skill: CpuSkill, input: Controls): void {
  const { launch } = f;
  if (!launch.diPending && (launch.hitlag > 0 || launch.hitstun <= 0)) return;
  const rates = defenceSlipRates(skill.decision.executionPercent);
  const outward = sign(launch.knockbackX) || (f.motion.x < 0 ? -1 : 1);
  const upward = Math.abs(launch.knockbackZ) > Math.abs(launch.knockbackX);
  const survival = f.status.damage >= 80 || launch.diLaunchSpeed >= 20.0;
  // A side launch turns upward to survive; an upward launch turns away from centre.
  // A combo launch turns down or inward to change where the follow-up must reach.
  let x: -1 | 0 | 1 = upward ? outward : 0;
  let z: -1 | 0 | 1 = upward ? 0 : survival ? 1 : -1;
  if (!survival && upward) x = sign(-outward);
  const key = f.visuals.hit;
  const slip = skill.executionMistakes !== false && botChoice(key, slot * 131 + f.character * 7 + 101, 1000) < rates.di;
  if (slip) {
    const kind = botChoice(key, slot * 131 + f.character * 7 + 102, 3);
    if (!launch.diPending) {
      if (kind !== 1) return;
      input.direction = x;
      input.verticalDirection = z;
      return;
    }
    if (kind === 0 || kind === 1) { x = 0; z = 0; }
    else if (kind === 2) { x = sign(-x); z = sign(-z); }
  }
  if (!launch.diPending) return;
  input.direction = x;
  input.verticalDirection = z;
  // Strong hits and uninterrupted strings provide an SDI chance. Pulse every other tick.
  if (launch.hitstun < 20 && launch.sdiStringTravel <= 0) return;
  const miss = skill.executionMistakes !== false && botChoice(key, slot * 131 + f.character * 7 + 103, 1000) < rates.sdi;
  if (floorMod(frame, 2) !== 0) return;
  const escapeX = survival ? -outward : outward;
  const wrong = miss && botChoice(key, slot * 131 + f.character * 7 + 104, 2) === 1;
  input.sdiPulse = !miss || wrong;
  input.sdiX = wrong ? -escapeX : escapeX;
  input.sdiZ = 0;
}

/** Alters only legal buttons/stick values; event keys survive rollback without extra state. */
export function applyAerialExecutionNoise(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, slot: number, skill: CpuSkill, input: Controls): void {
  if (f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.grab.owner !== undefined || f.status.out) return;
  const rates = defenceSlipRates(skill.decision.executionPercent);
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
