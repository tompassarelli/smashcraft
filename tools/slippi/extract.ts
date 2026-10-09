// Extracts human input-consistency events from Slippi replays.
// Usage: bun extract.ts <rank> <shard> <shards>  ->  $ROOT/events/<rank>.<shard>.jsonl
// One JSON line per game player; report.ts pools them. Definitions live in
// docs/design/human-input-consistency.md.
import { SlippiGame } from "@slippi/slippi-js/node";
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHARS, ROOT } from "./fetch.ts";

// Melee action states (decomp ftCo_MotionState).
const S = {
  WAIT: 14, TURN: 18, TURN_RUN: 19, DASH: 20, RUN: 21, RUN_BRAKE: 23, KNEE_BEND: 24,
  JUMP_F: 25, JUMP_B: 26, LANDING_SPECIAL: 43, AIR_N: 65, AIR_LW: 69, LAND_AIR_N: 70, LAND_AIR_LW: 74,
  DAMAGE_START: 75, DAMAGE_END: 91, GUARD_ON: 178, GUARD: 179, GUARD_OFF: 180, GUARD_REFLECT: 182,
  ESCAPE_F: 233, ESCAPE_B: 234, DAMAGE_FALL: 38, MISSED_TECH_U: 183, MISSED_TECH_D: 191,
  TECH_IN_PLACE: 199, TECH_ROLL_B: 201, ESCAPE_AIR: 236,
};
const BTN = { Z: 0x10, R: 0x20, L: 0x40, X: 0x400, Y: 0x800 };

const FULL = 0.8; // full stick deflection for a dash-dance reversal
const DI_DEADZONE = 0.2875;
const SDI_THRESHOLD = 0.7;
const RUN_REGRET_WINDOW = 6;

type Pre = { joystickX?: number; joystickY?: number; physicalButtons?: number; physicalLTrigger?: number; physicalRTrigger?: number };
type Post = {
  actionStateId?: number; positionX?: number; positionY?: number; isAirborne?: boolean; lCancelStatus?: number;
  hitlagRemaining?: number; selfInducedSpeeds?: { attackX?: number; attackY?: number }; stocksRemaining?: number; percent?: number;
};

const trig = (p: Pre) => (p.physicalButtons ?? 0) & (BTN.L | BTN.R) || Math.max(p.physicalLTrigger ?? 0, p.physicalRTrigger ?? 0) >= 0.3;
const lcancelBtn = (p: Pre) => trig(p) || ((p.physicalButtons ?? 0) & BTN.Z) !== 0;
const jumpBtn = (p: Pre) => ((p.physicalButtons ?? 0) & (BTN.X | BTN.Y)) !== 0;
const isDamage = (s: number) => s >= S.DAMAGE_START && s <= S.DAMAGE_END;
const isIdleGround = (s: number) => (s >= 14 && s <= 23) || (s >= 39 && s <= 41);

function analysePlayer(frames: Record<number, any>, first: number, last: number, me: number, opp: number, charId: number) {
  const pre = (f: number): Pre => frames[f]?.players?.[me]?.pre ?? {};
  const post = (f: number): Post => frames[f]?.players?.[me]?.post ?? {};
  const opost = (f: number): Post => frames[f]?.players?.[opp]?.post ?? {};
  const st = (f: number) => post(f).actionStateId ?? -1;
  const ev: any = {
    minutes: (last - first + 1) / 3600, ddIntervals: [] as number[], runs: 0, runRegrets: 0,
    di: [] as number[][], sdi: [] as number[][], hops: [] as number[][], lcancel: [] as number[][],
    aerialDelays: {} as Record<number, number[]>, oos: { roll: 0, wd: 0 }, wavedash: [] as number[][],
    tech: [] as number[][], techChase: [] as number[], techChaseCensored: 0,
  };

  // 1. Dash-dance reversals: full stick side changes while in Dash or Turn.
  // The interval counts only when every frame since the previous reversal was Dash or Turn.
  let lastSide = 0, lastSideFrame = -999;
  for (let f = first; f <= last; f++) {
    const x = pre(f).joystickX ?? 0;
    const side = x >= FULL ? 1 : x <= -FULL ? -1 : 0;
    if (side === 0 || side === lastSide) continue;
    if (lastSide !== 0 && f - lastSideFrame <= 30) {
      let dancing = true;
      for (let g = lastSideFrame; g < f; g++) { const s = st(g); if (s !== S.DASH && s !== S.TURN) { dancing = false; break; } }
      if (dancing) ev.ddIntervals.push(f - lastSideFrame);
    }
    lastSide = side; lastSideFrame = f;
  }

  // 2. Run entries that are braked or turned within the regret window.
  for (let f = first + 1; f <= last; f++) {
    if (st(f) === S.RUN && st(f - 1) === S.DASH) {
      ev.runs++;
      for (let k = 1; k <= RUN_REGRET_WINDOW; k++) {
        const s = st(f + k);
        if (s === S.RUN_BRAKE || s === S.TURN_RUN) { ev.runRegrets++; break; }
        if (s !== S.RUN) break;
      }
    }
  }

  // 3/4. Hits taken: hitlag in a damage state. DI from the stick on the launch frame.
  let prevHitEnd = -999;
  for (let f = first + 1; f <= last; f++) {
    const h = post(f).hitlagRemaining ?? 0, h0 = post(f - 1).hitlagRemaining ?? 0;
    if (!(h > 0 && h0 <= 0 && isDamage(st(f)))) continue;
    let e = f; while (e <= last && (post(e).hitlagRemaining ?? 0) > 0) e++;
    const hitlagLen = e - f;
    if (hitlagLen < 1 || e > last) continue;
    const multi = f - prevHitEnd <= 15 ? 1 : 0;
    prevHitEnd = e;
    let sdiInputs = 0;
    for (let g = f + 1; g < e; g++) {
      const a = pre(g), b = pre(g - 1);
      const cx = Math.abs(a.joystickX ?? 0) >= SDI_THRESHOLD && Math.abs(b.joystickX ?? 0) < SDI_THRESHOLD;
      const cy = Math.abs(a.joystickY ?? 0) >= SDI_THRESHOLD && Math.abs(b.joystickY ?? 0) < SDI_THRESHOLD;
      if (cx || cy) sdiInputs++;
    }
    ev.sdi.push([hitlagLen, multi, sdiInputs]);
    const sp = post(e).selfInducedSpeeds; const kx = sp?.attackX ?? 0, ky = sp?.attackY ?? 0;
    const speed = Math.hypot(kx, ky);
    if (speed < 0.5) continue;
    const sx = pre(e).joystickX ?? 0, sy = pre(e).joystickY ?? 0;
    // Did this hit end the stock with no further hit?
    let died = 0; const stocks = post(e).stocksRemaining ?? 0;
    for (let g = e; g <= Math.min(last, e + 300); g++) {
      if ((post(g).stocksRemaining ?? stocks) < stocks) { died = 1; break; }
      if ((post(g).hitlagRemaining ?? 0) > 0 && isDamage(st(g))) break;
    }
    ev.di.push([+speed.toFixed(2), +Math.atan2(ky, kx).toFixed(3), +sx.toFixed(3), +sy.toFixed(3), died, Math.round(post(e).percent ?? 0)]);
  }

  // 5. Jump-button hold through jumpsquat, and what follows the jump.
  for (let f = first + 1; f <= last; f++) {
    if (!(st(f) === S.KNEE_BEND && st(f - 1) !== S.KNEE_BEND)) continue;
    let press = -1;
    for (let g = f; g >= f - 1; g--) if (jumpBtn(pre(g)) && !jumpBtn(pre(g - 1))) { press = g; break; }
    let kbEnd = f; while (st(kbEnd + 1) === S.KNEE_BEND) kbEnd++;
    const takeoff = kbEnd + 1; const next = st(takeoff);
    // Wavedash: airdodge on or shortly after takeoff, landing soon after.
    let ad = -1; for (let g = takeoff; g <= takeoff + 8; g++) if (st(g) === S.ESCAPE_AIR) { ad = g; break; } else if (!(st(g) === S.JUMP_F || st(g) === S.JUMP_B)) break;
    if (ad >= 0) {
      let land = -1; for (let g = ad; g <= ad + 15; g++) if (st(g) === S.LANDING_SPECIAL || (post(g).isAirborne === false && g > ad)) { land = g; break; }
      if (land >= 0) {
        const p = pre(ad); const x = p.joystickX ?? 0, y = p.joystickY ?? 0;
        // The airdodge can start no earlier than the frame after takeoff, so 0 is frame-perfect.
        ev.wavedash.push([ad - takeoff - 1, +x.toFixed(3), +y.toFixed(3), isGuard(st(f - 1)) ? 1 : 0]);
        if (isGuard(st(f - 1))) ev.oos.wd++;
      }
    }
    if (press < 0 || !(next === S.JUMP_F || next === S.JUMP_B)) continue;
    let hold = 0; while (jumpBtn(pre(press + hold)) && hold < 40) hold++;
    const deadline = kbEnd - press + 1; // frames the button must be held for a full hop
    let aerial = -1;
    for (let g = takeoff; g <= takeoff + 30; g++) { const s = st(g); if (s >= S.AIR_N && s <= S.AIR_LW) { aerial = g; break; } if (!(s === S.JUMP_F || s === S.JUMP_B)) break; }
    let aerialId = aerial >= 0 ? st(aerial) : -1;
    ev.hops.push([hold, deadline, aerial >= 0 ? aerial - takeoff : -1, aerialId]);
    if (aerial >= 0 && hold < deadline) (ev.aerialDelays[aerialId] ??= []).push(aerial - takeoff);
  }

  // OoS rolls.
  for (let f = first + 1; f <= last; f++) if ((st(f) === S.ESCAPE_F || st(f) === S.ESCAPE_B) && isGuard(st(f - 1))) ev.oos.roll++;

  // 6. L-cancel: aerial landings, status and last L/R/Z press before landing.
  for (let f = first + 1; f <= last; f++) {
    const s = st(f);
    if (!(s >= S.LAND_AIR_N && s <= S.LAND_AIR_LW && !(st(f - 1) >= S.LAND_AIR_N && st(f - 1) <= S.LAND_AIR_LW))) continue;
    const status = post(f).lCancelStatus ?? 0;
    let before = -1;
    for (let k = 0; k <= 30; k++) { const g = f - k; if (lcancelBtn(pre(g)) && !lcancelBtn(pre(g - 1))) { before = k; break; } }
    ev.lcancel.push([status, before]);
  }

  // Tech on landing from hitstun or tumble: [teched, frames before contact of last L/R press or -1].
  for (let f = first + 1; f <= last; f++) {
    const s = st(f), s0 = st(f - 1);
    const landed = s === S.MISSED_TECH_U || s === S.MISSED_TECH_D || (s >= S.TECH_IN_PLACE && s <= S.TECH_ROLL_B);
    if (!landed || !(isDamage(s0) || s0 === S.DAMAGE_FALL)) continue;
    let before = -1;
    for (let k = 0; k <= 40; k++) { const g = f - k; if (trig(pre(g)) && !trig(pre(g - 1))) { before = k; break; } }
    ev.tech.push([s >= S.TECH_IN_PLACE ? 1 : 0, before]);
  }

  // 7. Tech-chase reaction: opponent starts a tech roll; frames until our stick goes
  // fully toward the roll, from an idle grounded state with the stick not already there.
  for (let f = first + 1; f <= last - 12; f++) {
    const os = opost(f).actionStateId ?? -1, os0 = opost(f - 1).actionStateId ?? -1;
    if (!((os === S.TECH_IN_PLACE + 1 || os === S.TECH_ROLL_B) && os0 !== os)) continue;
    const dir = Math.sign((opost(f + 12).positionX ?? 0) - (opost(f).positionX ?? 0));
    const dx = Math.abs((opost(f).positionX ?? 0) - (post(f).positionX ?? 0));
    if (!dir || dx > 60 || !isIdleGround(st(f)) || (pre(f).joystickX ?? 0) * dir >= 0.5) continue;
    let r = -1;
    for (let k = 1; k <= 40; k++) if ((pre(f + k).joystickX ?? 0) * dir >= FULL) { r = k; break; }
    if (r >= 0) ev.techChase.push(r); else ev.techChaseCensored++;
  }

  return ev;
}
function isGuard(s: number) { return s >= S.GUARD_ON && s <= S.GUARD_REFLECT && s !== 181; }

if (import.meta.main) {
  const [rank, shardS, shardsS] = process.argv.slice(2);
  const shard = Number(shardS), shards = Number(shardsS);
  const seen = new Set<string>();
  const files: string[] = [];
  for (const ch of CHARS) {
    let names: string[] = [];
    try { names = readdirSync(join(ROOT, rank!, ch)).filter((n) => n.endsWith(".slp")).sort(); } catch {}
    for (const n of names) if (!seen.has(n)) { seen.add(n); files.push(join(ROOT, rank!, ch, n)); }
  }
  const mine = files.filter((_, i) => i % shards === shard);
  mkdirSync(join(ROOT, "events"), { recursive: true });
  const out = join(ROOT, "events", `${rank}.${shard}.jsonl`);
  writeFileSync(out, "");
  let ok = 0, skipped = 0;
  for (const file of mine) {
    try {
      const g = new SlippiGame(file);
      const settings = g.getSettings();
      const players = settings?.players ?? [];
      if (players.length !== 2 || players.some((p) => p.type !== 0)) { skipped++; continue; }
      const frames = g.getFrames();
      const latest = g.getLatestFrame()?.frame ?? 0;
      if (latest < 3600) { skipped++; continue; }
      for (const p of players) {
        const o = players.find((q) => q !== p)!;
        const ev = analysePlayer(frames, 0, latest - 1, p.playerIndex, o.playerIndex, p.characterId ?? -1);
        appendFileSync(out, JSON.stringify({ rank, file: file.split("/").pop(), port: p.playerIndex, char: p.characterId, ...ev }) + "\n");
      }
      ok++;
    } catch { skipped++; }
  }
  console.log(`${rank} shard ${shard}/${shards}: ${ok} games, ${skipped} skipped`);
}
