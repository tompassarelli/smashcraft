





import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Schema } from "effect";

const root = resolve(import.meta.dir, "../..");
const CASE_STUDY_DIRECTORY = join(root, "docs/design/melee");



const FrameRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)),
});
const Hitbox = Schema.Struct({ size: Schema.Finite, x: Schema.Finite, y: Schema.Finite });
const MotionRecord = Schema.Struct({
  character: Schema.String, category: Schema.String, action: Schema.String, recorded_frames: Schema.Finite,
  hitbox_frames: Schema.Array(Schema.Struct({ frame: Schema.Finite, hitboxes: Schema.Array(Hitbox) })),
  locomotion_x: Schema.NullOr(Schema.Array(Schema.Finite)),
});
const CommandEvent = Schema.Struct({ frame: Schema.Finite, event: Schema.String, index: Schema.optionalKey(Schema.Finite), value: Schema.Finite });
const Roster = Schema.Struct({
  common: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.Finite })),
  fighters: Schema.Array(Schema.Struct({
    id: Schema.String,
    attributes: Schema.Record(Schema.String, Schema.Finite),
    actions: Schema.Record(Schema.String, Schema.Struct({ frames: Schema.NullOr(Schema.Finite), events: Schema.NullOr(Schema.Array(CommandEvent)) })),
  })),
});
type FrameRecord = typeof FrameRecord.Type;
type MotionRecord = typeof MotionRecord.Type;
type Fighter = (typeof Roster.Type)["fighters"][number];

const jsonl = async <S extends Schema.Top>(path: string, schema: S): Promise<S["Type"][]> =>
  (await Bun.file(join(root, path)).text()).trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    Schema.asserts(schema, value);
    return value;
  });

const records = await jsonl("references/melee-frame-data/records.jsonl", FrameRecord);
const motion = await jsonl("references/melee-frame-data/libmelee.jsonl", MotionRecord);
const roster = Schema.decodeUnknownSync(Roster)(await Bun.file(join(root, "docs/smash-melee-reference/retail-roster.json")).json());

const NAMES: Readonly<Record<string, string>> = {
  mario: "Mario", fox: "Fox", captain_falcon: "Captain Falcon", donkey_kong: "Donkey Kong", kirby: "Kirby",
  bowser: "Bowser", link: "Link", sheik: "Sheik", ness: "Ness", peach: "Peach", ice_climbers: "Ice Climbers",
  pikachu: "Pikachu", samus: "Samus", yoshi: "Yoshi", jigglypuff: "Jigglypuff", mewtwo: "Mewtwo", luigi: "Luigi",
  marth: "Marth", zelda: "Zelda", young_link: "Young Link", "dr._mario": "Dr. Mario", falco: "Falco", pichu: "Pichu",
  "mr._game_&_watch": "Mr. Game & Watch", ganondorf: "Ganondorf", roy: "Roy",
};
const name = (id: string): string => NAMES[id] ?? id;
const fighters = [...roster.fighters].sort((a, b) => name(a.id).localeCompare(name(b.id)));
if (fighters.length !== 26) throw new Error(`expected 26 fighters, got ${fighters.length}`);

function commonValue(key: string): number {
  const entry = roster.common.find((c) => c.name === key);
  if (entry === undefined) throw new Error(`missing common value ${key}`);
  return entry.value;
}
function attribute(f: Fighter, key: string): number {
  const value = f.attributes[key];
  if (value === undefined) throw new Error(`missing attribute ${key} for ${f.id}`);
  return value;
}
const recordIndex = new Map(records.map((r) => [`${r.character}/${r.category}/${r.action ?? ""}`, r]));
const frameRecord = (id: string, category: string, action: string | null): FrameRecord | undefined => recordIndex.get(`${id}/${category}/${action ?? ""}`);
const field = (r: FrameRecord | undefined, key: string): number | null => r?.values[key] ?? null;
const motionIndex = new Map(motion.map((m) => [`${m.character}/${m.action}`, m]));
const motionRecord = (id: string, action: string): MotionRecord | undefined => motionIndex.get(`${id}/${action}`);
function events(f: Fighter, action: string) {
  return f.actions[action]?.events ?? [];
}



const defined = (values: readonly (number | null)[]): number[] => values.filter((v): v is number => v !== null);
function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error("quantile of nothing");
  const position = (sorted.length - 1) * q, low = Math.floor(position), high = Math.ceil(position);
  const a = sorted[low] ?? 0, b = sorted[high] ?? 0;
  return a + (b - a) * (position - low);
}
const median = (values: readonly number[]): number => quantile(values, 0.5);
function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const result = new Array<number>(values.length).fill(0);
  for (let start = 0; start < order.length;) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]?.v === order[start]?.v) end++;
    for (let k = start; k <= end; k++) result[order[k]?.i ?? 0] = (start + end) / 2 + 1;
    start = end + 1;
  }
  return result;
}
function pearson(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0, da = 0, db = 0;
  a.forEach((v, i) => { const w = b[i] ?? 0; num += (v - ma) * (w - mb); da += (v - ma) ** 2; db += (w - mb) ** 2; });
  return num / Math.sqrt(da * db);
}
const spearman = (a: readonly number[], b: readonly number[]): number => pearson(ranks(a), ranks(b));
const fixed = (digits: number) => (v: number | null): string => (v === null ? "–" : v.toFixed(digits).replace(/^-/, "−"));
const f0 = fixed(0), f1 = fixed(1), f2 = fixed(2), f3 = fixed(3);
const signed = (v: number | null): string => (v === null ? "–" : v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const correlation = (v: number): string => (v < 0 ? `−${(-v).toFixed(2)}` : v.toFixed(2));
const list = (names: readonly string[]): string => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`);
function table(header: readonly string[], align: readonly ("l" | "r")[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(align.map((a) => (a === "r" ? "---:" : "---"))), ...rows.map(line)].join("\n");
}
const values = new Map<string, string>();
const tables = new Map<string, string>();
const set = (key: string, value: string | number): void => {
  if (values.has(key)) throw new Error(`value ${key} set twice`);
  values.set(key, String(value));
};

function spread(key: string, entries: readonly { id: string; v: number }[], format: (v: number | null) => string): void {
  const vs = entries.map((e) => e.v), lo = Math.min(...vs), hi = Math.max(...vs);
  set(`${key}.min`, format(lo));
  set(`${key}.median`, format(median(vs)));
  set(`${key}.max`, format(hi));
  set(`${key}.minWho`, list(entries.filter((e) => e.v === lo).map((e) => name(e.id))));
  set(`${key}.maxWho`, list(entries.filter((e) => e.v === hi).map((e) => name(e.id))));
}



const FRICTION_ABOVE_WALK = commonValue("friction_when_above_walk_speed");
const DASH_FRICTION = commonValue("run_dash_turn_friction_multiplier");
const AIR_DODGE_FORCE = commonValue("escapeair_force");
const AIR_DODGE_DECAY = commonValue("escapeair_decay");
const WAVELAND_LAG = commonValue("x344");

const WAVEDASH_DEGREES = 17.1;

const OWN_AERIAL_JUMP = new Set(["ness", "yoshi", "peach", "mewtwo", "kirby", "jigglypuff"]);


function jump(f: Fighter, launch: number, fastFall: boolean, gravityFirst = false): { height: number; airtime: number } {
  const gravity = attribute(f, "gravity"), fall = attribute(f, "terminal_velocity"), fast = attribute(f, "fast_fall_velocity");
  let vy = gravityFirst ? launch - gravity : launch, y = vy, height = y, frame = 1;
  while (y > 0 && frame < 1000) {
    vy = fastFall && vy < 0 ? -fast : Math.max(vy - gravity, -fall);
    y += vy;
    height = Math.max(height, y);
    frame++;
  }
  return { height, airtime: frame };
}

function slide(f: Fighter, v: number, frames = Infinity): number {
  const traction = attribute(f, "ground_friction"), walk = attribute(f, "walk_max_vel");
  let x = 0;
  for (let n = 0; n < frames && v > 0; n++) {
    v = Math.max(0, v - traction * (v > walk ? FRICTION_ABOVE_WALK : 1));
    x += v;
  }
  return x;
}

const runFrame = (f: Fighter): number | null => events(f, "Dash").find((e) => e.event === "cmdVar" && e.index === 0 && e.value === 1)?.frame ?? null;

function dashDistance(f: Fighter, frames: number): number {
  const initial = attribute(f, "dash_initial_velocity"), run = attribute(f, "dash_max_velocity"), cap = attribute(f, "ground_max_horizontal_velocity");
  const accel = attribute(f, "dash_accel_mul") + attribute(f, "dash_accel_base"), friction = attribute(f, "ground_friction") * DASH_FRICTION;
  let v = initial, x = v;
  for (let n = 2; n <= frames; n++) {
    let a = accel;
    if (v + a > run) {
      a = -friction;
      if (v + a < run) a = run - v;
      if (v + a > cap) a = cap - v;
    }
    v += a;
    x += v;
  }
  return x;
}

function drift(f: Fighter, frames: number): { toFull: number; distance: number } {
  const max = attribute(f, "air_drift_max"), accel = attribute(f, "air_drift_stick_mul") + attribute(f, "aerial_drift_base");
  let v = 0, x = 0, toFull = 0;
  for (let n = 1; n <= frames; n++) {
    v = Math.min(max, v + accel);
    if (toFull === 0 && v >= max) toFull = n;
    x += v;
  }
  return { toFull: toFull === 0 ? Math.ceil(max / accel) : toFull, distance: x };
}

interface Movement {
  readonly f: Fighter;
  readonly squat: number;
  readonly full: { height: number; airtime: number };
  readonly short: { height: number; airtime: number };
  readonly shortFastFall: { height: number; airtime: number };
  readonly fullFastFall: { height: number; airtime: number };
  readonly double: number | null;
  readonly runFrame: number | null;
  readonly dash: number | null;
  readonly wavedash: { total: number; actionable: number };
  readonly drift: { toFull: number; distance: number };
}
const movement: Movement[] = fighters.map((f) => {
  const squat = attribute(f, "jump_startup_time"), full = jump(f, attribute(f, "jump_v_initial_velocity"), false);
  const air = AIR_DODGE_FORCE * AIR_DODGE_DECAY * Math.cos((WAVEDASH_DEGREES * Math.PI) / 180);
  const run = runFrame(f);
  return {
    f, squat, full,
    short: jump(f, attribute(f, "hop_v_initial_velocity"), false),
    shortFastFall: jump(f, attribute(f, "hop_v_initial_velocity"), true),
    fullFastFall: jump(f, attribute(f, "jump_v_initial_velocity"), true),
    double: OWN_AERIAL_JUMP.has(f.id) ? null : jump(f, attribute(f, "jump_v_initial_velocity") * attribute(f, "air_jump_v_multiplier"), false, true).height,
    runFrame: run,
    dash: run === null ? null : dashDistance(f, run - 1),
    wavedash: { total: air + slide(f, air), actionable: air + slide(f, air, WAVELAND_LAG) },
    drift: drift(f, full.airtime),
  };
});



const fox = movement.find((m) => m.f.id === "fox");
if (fox === undefined || Math.abs(fox.full.height - 31.28) > 0.01 || Math.abs(fox.short.height - 10.65) > 0.01 || Math.abs((fox.double ?? 0) - 40.204) > 0.01) {
  throw new Error("Fox jump heights differ from the reference");
}

const CORPUS_CHECKS: readonly [string, string, string][] = [
  ["squat", "jump_squat", "jump_startup_time"], ["weight", "weight", "weight"],
  ["dash", "walk_speed", "dash_initial_velocity"], ["run", "run_speed", "dash_max_velocity"],
];
for (const [key, corpusField, retailField] of CORPUS_CHECKS) {
  const differ = movement.filter((m) => {
    const reported = field(frameRecord(m.f.id, "misc", null), corpusField);
    return reported === null || Math.abs(reported - attribute(m.f, retailField)) > 0.005;
  });
  set(`check.${key}`, `${movement.length - differ.length} of ${movement.length}`);
  set(`check.${key}Differ`, differ.length === 0 ? "none" : list(differ.map((m) => name(m.f.id))));
}

set("wavedash.degrees", WAVEDASH_DEGREES);
set("airdodge.force", f2(AIR_DODGE_FORCE));
set("airdodge.decay", f2(AIR_DODGE_DECAY));
set("airdodge.firstFrame", f2(AIR_DODGE_FORCE * AIR_DODGE_DECAY));
set("waveland.lag", WAVELAND_LAG);
set("friction.aboveWalk", FRICTION_ABOVE_WALK);
set("deadzone", f2(commonValue("vertical_stick_deadzone")));

tables.set("ground", table(
  ["Fighter", "Walk", "Initial dash", "Run", "Traction", "Run from frame", "Dash animation", "Initial dash distance"],
  ["l", "r", "r", "r", "r", "r", "r", "r"],
  movement.map((m) => [name(m.f.id), f2(attribute(m.f, "walk_max_vel")), f2(attribute(m.f, "dash_initial_velocity")), f2(attribute(m.f, "dash_max_velocity")),
    f3(attribute(m.f, "ground_friction")), f0(m.runFrame), f0((m.f.actions.Dash?.frames ?? 0) - 1), f1(m.dash)]),
));
spread("run", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "dash_max_velocity") })), f2);
spread("dashSpeed", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "dash_initial_velocity") })), f2);
set("dashOverRun", list(movement.filter((m) => attribute(m.f, "dash_initial_velocity") > attribute(m.f, "dash_max_velocity")).map((m) => name(m.f.id))));
spread("traction", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "ground_friction") })), f3);
spread("initialDash", movement.flatMap((m) => (m.runFrame === null ? [] : [{ id: m.f.id, v: m.runFrame - 1 }])), f0);
spread("dashDistance", movement.flatMap((m) => (m.dash === null ? [] : [{ id: m.f.id, v: m.dash }])), f1);

tables.set("jumps", table(
  ["Fighter", "Jump squat", "Full hop", "Full hop air", "Short hop", "Short hop air", "Short hop, fast-fallen", "Aerial jump"],
  ["l", "r", "r", "r", "r", "r", "r", "r"],
  movement.map((m) => [name(m.f.id), f0(m.squat), f1(m.full.height), f0(m.full.airtime), f1(m.short.height), f0(m.short.airtime),
    f0(m.shortFastFall.airtime), m.double === null ? "own" : f1(m.double)]),
));
spread("squat", movement.map((m) => ({ id: m.f.id, v: m.squat })), f0);
spread("fullHop", movement.map((m) => ({ id: m.f.id, v: m.full.height })), f1);
spread("shortHop", movement.map((m) => ({ id: m.f.id, v: m.short.height })), f1);
spread("shff", movement.map((m) => ({ id: m.f.id, v: m.shortFastFall.airtime })), f0);
spread("fullAir", movement.map((m) => ({ id: m.f.id, v: m.full.airtime })), f0);
set("ownAerialJump", list([...OWN_AERIAL_JUMP].map(name).sort()));

tables.set("air", table(
  ["Fighter", "Gravity", "Fall speed", "Fast fall", "Fast fall gain", "Air speed", "Air acceleration", "Air friction", "Frames to full drift", "Drift over a full hop"],
  ["l", "r", "r", "r", "r", "r", "r", "r", "r", "r"],
  movement.map((m) => {
    const f = m.f;
    return [name(f.id), f3(attribute(f, "gravity")), f2(attribute(f, "terminal_velocity")), f2(attribute(f, "fast_fall_velocity")),
      `${f0((attribute(f, "fast_fall_velocity") / attribute(f, "terminal_velocity") - 1) * 100)}%`, f2(attribute(f, "air_drift_max")),
      f3(attribute(f, "air_drift_stick_mul") + attribute(f, "aerial_drift_base")), f3(attribute(f, "aerial_friction")), f0(m.drift.toFull), f1(m.drift.distance)];
  }),
));
spread("gravity", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "gravity") })), f3);
spread("fall", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "terminal_velocity") })), f2);
spread("fastFall", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "fast_fall_velocity") })), f2);
spread("airSpeed", movement.map((m) => ({ id: m.f.id, v: attribute(m.f, "air_drift_max") })), f2);
spread("toFullDrift", movement.map((m) => ({ id: m.f.id, v: m.drift.toFull })), f0);
set("rho.gravityFall", correlation(spearman(movement.map((m) => attribute(m.f, "gravity")), movement.map((m) => attribute(m.f, "terminal_velocity")))));

const wavedashRank = movement.map((m) => field(frameRecord(m.f.id, "misc", null), "wd_length"));
tables.set("wavedash", table(
  ["Fighter", "Traction", "Walk speed", "Slide while landing", "Whole slide", "Frames to act (wavedash)", "meleeframedata.com rank"],
  ["l", "r", "r", "r", "r", "r", "r"],
  [...movement].sort((a, b) => b.wavedash.total - a.wavedash.total).map((m) => [name(m.f.id), f3(attribute(m.f, "ground_friction")),
    f2(attribute(m.f, "walk_max_vel")), f1(m.wavedash.actionable), f1(m.wavedash.total), f0(m.squat + 1 + WAVELAND_LAG), f0(field(frameRecord(m.f.id, "misc", null), "wd_length"))]),
));
spread("wavedash", movement.map((m) => ({ id: m.f.id, v: m.wavedash.total })), f1);
spread("wavedashActionable", movement.map((m) => ({ id: m.f.id, v: m.wavedash.actionable })), f1);
{
  const paired = movement.flatMap((m, i) => { const r = wavedashRank[i]; return r === null || r === undefined ? [] : [{ length: m.wavedash.total, rank: r }]; });
  set("rho.wavedashRank", correlation(-spearman(paired.map((p) => p.length), paired.map((p) => p.rank))));
  set("rho.wavedashTraction", correlation(spearman(movement.map((m) => m.wavedash.total), movement.map((m) => attribute(m.f, "ground_friction")))));
}
set("waveland.frames", 1 + WAVELAND_LAG);



function intangible(f: Fighter, action: string): { start: number; end: number } | null {
  const body = events(f, action).filter((e) => e.event === "bodyState");
  const on = body.find((e) => e.value === 2), off = body.find((e) => e.value === 0 && e.frame > (on?.frame ?? Infinity));
  return on === undefined || off === undefined ? null : { start: on.frame, end: off.frame - 1 };
}
const travel = (id: string, action: string): number | null => {
  const steps = motionRecord(id, action)?.locomotion_x;
  return steps === null || steps === undefined ? null : Math.abs(steps.reduce((s, v) => s + v, 0));
};
const span = (w: { start: number; end: number } | null): string => (w === null ? "–" : `${w.start}–${w.end}`);
let dodgeAgreement = 0, dodgeCompared = 0;
const dodgeDiffer: string[] = [];
const DODGE_NAMES: Readonly<Record<string, string>> = { EscapeN: "spot dodge", EscapeF: "forward roll", EscapeB: "back roll" };
const dodgeRows = fighters.map((f) => {
  const spot = frameRecord(f.id, "dodges", "spot_dodge"), roll = frameRecord(f.id, "dodges", "forward_roll"), back = frameRecord(f.id, "dodges", "back_roll");
  for (const [record, action] of [[spot, "EscapeN"], [roll, "EscapeF"], [back, "EscapeB"]] as const) {
    const retail = intangible(f, action);
    if (retail === null || field(record, "start") === null) continue;
    dodgeCompared++;
    if (field(record, "start") === retail.start && field(record, "inv_end") === retail.end) dodgeAgreement++;
    else dodgeDiffer.push(`${name(f.id)}'s ${DODGE_NAMES[action] ?? action} (corpus ${field(record, "start") ?? "–"}–${field(record, "inv_end") ?? "–"}, retail ${span(retail)})`);
  }
  return { f, spot, roll, back, forward: travel(f.id, "forward_roll"), backward: travel(f.id, "back_roll"), air: intangible(f, "EscapeAir") };
});
set("check.dodgeWindows", `${dodgeAgreement} of ${dodgeCompared}`);
set("check.dodgeDiffer", list(dodgeDiffer));
tables.set("dodges", table(
  ["Fighter", "Spot dodge", "Intangible", "Roll", "Intangible (forward / back)", "Forward roll travel", "Back roll travel", "Air dodge intangible"],
  ["l", "r", "r", "r", "r", "r", "r", "r"],
  dodgeRows.map((d) => [name(d.f.id), f0(field(d.spot, "total")), span(intangible(d.f, "EscapeN")), f0(field(d.roll, "total")),
    `${span(intangible(d.f, "EscapeF"))} / ${span(intangible(d.f, "EscapeB"))}`, f1(d.forward), f1(d.backward), span(d.air)]),
));
spread("rollTravel", dodgeRows.flatMap((d) => (d.forward === null ? [] : [{ id: d.f.id, v: d.forward }])), f1);
spread("backRollTravel", dodgeRows.flatMap((d) => (d.backward === null ? [] : [{ id: d.f.id, v: d.backward }])), f1);
spread("rollFrames", dodgeRows.flatMap((d) => { const t = field(d.roll, "total"); return t === null ? [] : [{ id: d.f.id, v: t }]; }), f0);
spread("spotFrames", dodgeRows.flatMap((d) => { const t = field(d.spot, "total"); return t === null ? [] : [{ id: d.f.id, v: t }]; }), f0);
{

  const usual = (entries: readonly { id: string; v: string }[], key: string): void => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.v, (counts.get(e.v) ?? 0) + 1);
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–";
    set(key, mode);
    const others = entries.filter((e) => e.v !== mode).map((e) => `${name(e.id)} ${e.v}`);
    set(`${key}Others`, others.length === 0 ? "none" : list(others));
  };
  usual(dodgeRows.map((d) => ({ id: d.f.id, v: span(d.air) })), "airDodge.window");
  usual(fighters.map((f) => ({ id: f.id, v: String((f.actions.EscapeAir?.frames ?? 0) - 1) })), "airDodge.frames");
  usual(fighters.map((f) => ({ id: f.id, v: String(f.actions.GuardOff?.frames ?? 0) })), "shield.release");
}



const GROUND = ["jab1", "ftilt", "utilt", "dtilt", "dattack", "fsmash", "usmash", "dsmash"] as const;
const AERIALS = ["nair", "fair", "bair", "uair", "dair"] as const;
const isGround = (action: string): boolean => GROUND.some((g) => g === action);
const isAerial = (action: string): boolean => AERIALS.some((a) => a === action);
const MOVE_NAMES: Readonly<Record<string, string>> = {
  jab1: "Jab", ftilt: "Forward tilt", utilt: "Up tilt", dtilt: "Down tilt", dattack: "Dash attack", fsmash: "Forward smash",
  usmash: "Up smash", dsmash: "Down smash", nair: "Neutral air", fair: "Forward air", bair: "Back air", uair: "Up air", dair: "Down air",
  standing_grab: "Grab", dash_grab: "Dash grab",
};
const moveName = (action: string): string => MOVE_NAMES[action] ?? action;

const actionable = (r: FrameRecord | undefined): number | null => field(r, "iasa") ?? (field(r, "total") === null ? null : (field(r, "total") ?? 0) + 1);

function reach(id: string, action: string): number | null {
  const frames = motionRecord(id, action)?.hitbox_frames ?? [];
  if (frames.length === 0) return null;
  const extent = (h: { size: number; x: number; y: number }): number =>
    action === "bair" ? h.size - h.x : action === "uair" ? h.y + h.size : action === "dair" ? h.size - h.y : h.x + h.size;
  return Math.max(...frames.flatMap((frame) => frame.hitboxes.map(extent)));
}

interface Attack {
  readonly id: string;
  readonly action: string;
  readonly aerial: boolean;
  readonly startup: number | null;
  readonly lastActive: number | null;
  readonly endlag: number | null;
  readonly shieldstun: number | null;
  readonly damage: number | null;
  readonly reach: number | null;

  readonly onShield: number | null;

  readonly onShieldLate: number | null;
  readonly landing: number | null;
  readonly cancelled: number | null;
}
const attacks: Attack[] = fighters.flatMap((f) => [...GROUND, ...AERIALS].map((action) => {
  const r = frameRecord(f.id, "attacks", action);
  const s = field(r, "start"), e = field(r, "end"), a = actionable(r), stun = field(r, "stun");
  const aerial = isAerial(action);
  const landing = field(r, "land_lag"), cancelled = field(r, "cancel_lag");

  const ground = (c: number | null) => (stun === null || c === null || a === null ? null : c + stun + 1 - a);
  const air = (lag: number | null) => (stun === null || lag === null ? null : stun - lag);
  return {
    id: f.id, action, aerial, startup: s, lastActive: e, endlag: e === null || a === null || aerial ? null : a - e - 1,
    shieldstun: stun, damage: field(r, "percent"), reach: reach(f.id, action),
    onShield: aerial ? air(cancelled) : ground(s), onShieldLate: aerial ? air(landing) : ground(e),
    landing, cancelled,
  };
}));
const of = (action: string) => attacks.filter((a) => a.action === action);

const bestOnShield = (a: Attack): number | null => (a.aerial ? a.onShield : a.onShieldLate);
const triple = (vs: readonly number[], format: (v: number | null) => string) =>
  (vs.length === 0 ? "–" : `${format(Math.min(...vs))} / ${format(median(vs))} / ${format(Math.max(...vs))}`);
const signedTriple = (vs: readonly number[]) => (vs.length === 0 ? "–" : `${signed(Math.min(...vs))} / ${signed(median(vs))} / ${signed(Math.max(...vs))}`);
tables.set("groundMoves", table(
  ["Move", "Fighters", "Startup", "Ending lag after the last hitbox", "Reach", "On shield, first active frame", "On shield, last active frame"],
  ["l", "r", "r", "r", "r", "r", "r"],
  GROUND.map((action) => {
    const rows = of(action);
    return [moveName(action), String(rows.filter((r) => r.startup !== null).length), triple(defined(rows.map((r) => r.startup)), f0),
      triple(defined(rows.map((r) => r.endlag)), f0), triple(defined(rows.map((r) => r.reach)), f1),
      signedTriple(defined(rows.map((r) => r.onShield))), signedTriple(defined(rows.map((r) => r.onShieldLate)))];
  }),
));
tables.set("aerials", table(
  ["Move", "Fighters", "Startup", "Reach", "Landing lag", "L-cancelled lag", "On shield, L-cancelled", "On shield, not cancelled"],
  ["l", "r", "r", "r", "r", "r", "r", "r"],
  AERIALS.map((action) => {
    const rows = of(action);
    return [moveName(action), String(rows.filter((r) => r.startup !== null).length), triple(defined(rows.map((r) => r.startup)), f0),
      triple(defined(rows.map((r) => r.reach)), f1), triple(defined(rows.map((r) => r.landing)), f0), triple(defined(rows.map((r) => r.cancelled)), f0),
      signedTriple(defined(rows.map((r) => r.onShield))), signedTriple(defined(rows.map((r) => r.onShieldLate)))];
  }),
));
{
  const ground = attacks.filter((a) => !a.aerial), aerials = attacks.filter((a) => a.aerial);
  const startups = defined(ground.map((a) => a.startup));
  set("ground.count", startups.length);
  set("ground.startupMedian", f0(median(startups)));
  set("aerial.startupMedian", f0(median(defined(aerials.map((a) => a.startup)))));
  const fastest = Math.min(...startups);
  set("ground.fastest", fastest);
  set("ground.fastestWho", list(ground.filter((a) => a.startup === fastest).map((a) => `${name(a.id)}'s ${moveName(a.action).toLowerCase()}`)));
  const WITHIN = 5;
  set("ground.withinFrame", WITHIN);
  const within = startups.filter((s) => s <= WITHIN).length;
  set("ground.within5", within);
  set("ground.within5Share", `${f0((within / startups.length) * 100)}%`);
  const first = defined(ground.map((a) => a.onShield)), late = defined(ground.map((a) => a.onShieldLate));
  set("ground.onShieldMedian", signed(median(first)));
  set("ground.onShieldLateMedian", signed(median(late)));
  set("ground.safeCount", late.filter((v) => v >= 0).length);
  set("ground.onShieldCount", late.length);
  const cancelled = defined(aerials.map((a) => a.onShield)), uncancelled = defined(aerials.map((a) => a.onShieldLate));
  set("aerial.onShieldMedian", signed(median(cancelled)));
  set("aerial.safeCount", cancelled.filter((v) => v >= 0).length);
  set("aerial.onShieldCount", cancelled.length);
  set("aerial.uncancelledMedian", signed(median(uncancelled)));
  set("aerial.uncancelledSafe", uncancelled.filter((v) => v >= 0).length);
  const LATE_GAIN = 10;
  set("ground.longActiveGain", LATE_GAIN);
  const multihit = ground.filter((a) => a.onShield !== null && a.onShieldLate !== null && (a.onShieldLate ?? 0) - (a.onShield ?? 0) >= LATE_GAIN);
  set("ground.longActiveCount", multihit.length);
}
const top = (rows: readonly Attack[], key: (a: Attack) => number | null, n: number, descending: boolean): Attack[] =>
  rows.filter((a) => key(a) !== null).sort((a, b) => ((key(a) ?? 0) - (key(b) ?? 0)) * (descending ? -1 : 1)).slice(0, n);
const moveRows = (rows: readonly Attack[], value: (a: Attack) => string) => rows.map((a) => [name(a.id), moveName(a.action), value(a)]);
tables.set("longestReach", table(["Fighter", "Move", "Reach"], ["l", "l", "r"], moveRows(top(attacks, (a) => a.reach, 10, true), (a) => f1(a.reach))));
tables.set("safest", table(["Fighter", "Move", "On shield"], ["l", "l", "r"], moveRows(top(attacks, bestOnShield, 12, true), (a) => signed(bestOnShield(a)))));
tables.set("safestGround", table(["Fighter", "Move", "On shield, last active frame"], ["l", "l", "r"],
  moveRows(top(attacks.filter((a) => !a.aerial), bestOnShield, 10, true), (a) => signed(bestOnShield(a)))));
tables.set("leastSafe", table(["Fighter", "Move", "On shield, last active frame"], ["l", "l", "r"],
  moveRows(top(attacks.filter((a) => !a.aerial), bestOnShield, 10, false), (a) => signed(bestOnShield(a)))));



interface OutOfShield { readonly f: Fighter; readonly grab: number | null; readonly upSmash: number | null; readonly aerial: number | null; readonly aerialMove: string; readonly fastest: number }
const outOfShield: OutOfShield[] = fighters.map((f) => {
  const grab = field(frameRecord(f.id, "grabs", "standing_grab"), "start");
  const usmash = field(frameRecord(f.id, "attacks", "usmash"), "start");
  const squat = attribute(f, "jump_startup_time");
  const aerials = AERIALS.flatMap((action) => { const s = field(frameRecord(f.id, "attacks", action), "start"); return s === null ? [] : [{ action, s }]; });
  const best = aerials.sort((a, b) => a.s - b.s)[0];
  const aerial = best === undefined ? null : squat + best.s;
  const options = defined([grab, usmash === null ? null : usmash + 1, aerial]);
  return { f, grab, upSmash: usmash === null ? null : usmash + 1, aerial, aerialMove: best === undefined ? "–" : moveName(best.action), fastest: Math.min(...options) };
});
tables.set("outOfShield", table(
  ["Fighter", "Grab", "Up smash from jump squat", "Fastest aerial after jump squat", "Fastest"],
  ["l", "r", "r", "r", "r"],
  outOfShield.map((o) => [name(o.f.id), f0(o.grab), f0(o.upSmash), o.aerial === null ? "–" : `${o.aerial} (${o.aerialMove.toLowerCase()})`, f0(o.fastest)]),
));
spread("oos", outOfShield.map((o) => ({ id: o.f.id, v: o.fastest })), f0);
spread("oosGrab", outOfShield.flatMap((o) => (o.grab === null ? [] : [{ id: o.f.id, v: o.grab }])), f0);
{

  const medianOos = median(outOfShield.map((o) => o.fastest)), fastestOos = Math.min(...outOfShield.map((o) => o.fastest));
  const ground = attacks.filter((a) => !a.aerial && bestOnShield(a) !== null), aerial = attacks.filter((a) => a.aerial && bestOnShield(a) !== null);
  const punishable = (rows: readonly Attack[], within: number) => rows.filter((a) => (bestOnShield(a) ?? 0) <= -within).length;
  set("punish.medianOos", f0(medianOos));
  set("punish.groundByMedian", `${punishable(ground, medianOos)} of ${ground.length}`);
  set("punish.groundByFastest", `${punishable(ground, fastestOos)} of ${ground.length}`);
  set("punish.aerialByMedian", `${punishable(aerial, medianOos)} of ${aerial.length}`);
  set("punish.aerialByFastest", `${punishable(aerial, fastestOos)} of ${aerial.length}`);
}


const SHIELD_PUSHBACK = { strength: 1 - commonValue("x2E8"), stun: commonValue("x28C"), base: commonValue("x290"), speed: commonValue("x294"), ordinary: commonValue("x2BC"), cap: commonValue("x298") };

const pushback = (damage: number): number => Math.min(SHIELD_PUSHBACK.cap, (SHIELD_PUSHBACK.stun * Math.trunc(damage) * SHIELD_PUSHBACK.strength + SHIELD_PUSHBACK.base) * SHIELD_PUSHBACK.speed * SHIELD_PUSHBACK.ordinary);
const medianTraction = median(fighters.map((f) => attribute(f, "ground_friction")));
const medianDefender = fighters.reduce((best, f) => (Math.abs(attribute(f, "ground_friction") - medianTraction) < Math.abs(attribute(best, "ground_friction") - medianTraction) ? f : best));
const medianGrabReach = median(defined(fighters.map((f) => reach(f.id, "standing_grab"))));
set("pushback.medianDefender", name(medianDefender.id));
set("pushback.traction", f3(attribute(medianDefender, "ground_friction")));
set("pushback.grabReach", f1(medianGrabReach));
set("pushback.factor", f2(SHIELD_PUSHBACK.strength * SHIELD_PUSHBACK.stun));
set("pushback.cap", SHIELD_PUSHBACK.cap);
set("pushback.base", SHIELD_PUSHBACK.base);
set("pushback.speed", f2(SHIELD_PUSHBACK.speed * SHIELD_PUSHBACK.ordinary));
tables.set("pushback", table(
  ["Damage", "Shieldstun basis", "Defender's initial slide", `Slide distance (${name(medianDefender.id)}'s traction)`],
  ["r", "r", "r", "r"],
  [4, 8, 12, 16, 20].map((d) => [String(d), f2(SHIELD_PUSHBACK.stun * d * SHIELD_PUSHBACK.strength + SHIELD_PUSHBACK.base), f3(pushback(d)), f1(slide(medianDefender, pushback(d)))]),
));
tables.set("aerialSpacing", table(
  ["Fighter", "Aerial", "Late, L-cancelled", "Late, not cancelled", "First active frame of a fast-fallen short hop", "Reach", "Pushback slide", "Fade: landing slide at air speed"],
  ["l", "l", "r", "r", "r", "r", "r", "r"],
  movement.map((m) => {
    const best = top(attacks.filter((a) => a.id === m.f.id && isAerial(a.action)), bestOnShield, 1, true)[0];
    if (best === undefined || best.startup === null || best.cancelled === null || best.shieldstun === null) return [name(m.f.id), "–", "–", "–", "–", "–", "–", "–"];

    const landing = m.shortFastFall.airtime;
    const early = best.startup < landing ? best.shieldstun - best.cancelled - (landing - 1 - best.startup) : null;
    return [name(m.f.id), moveName(best.action), signed(best.onShield), signed(best.onShieldLate), early === null ? "lands first" : signed(early),
      f1(best.reach), f1(best.damage === null ? null : slide(medianDefender, pushback(best.damage))), f1(slide(m.f, attribute(m.f, "air_drift_max")))];
  }),
));



const HITLAG = { cap: commonValue("x194_unkHitLagFrames"), perDamage: commonValue("x198"), base: commonValue("x19C"), crouch: commonValue("x1A0"), electric: commonValue("x1A4") };

const hitlag = (damage: number, electric: boolean): number =>
  Math.min(HITLAG.cap, Math.trunc(Math.trunc(Math.trunc(damage) * HITLAG.perDamage + HITLAG.base) * (electric ? HITLAG.electric : 1)));
const SDI = commonValue("sdi_pos_scale"), ASDI = commonValue("x4BC");
set("sdi.step", SDI);
set("sdi.stick", f2(commonValue("sdi_min_stick_mag")));
set("sdi.window", commonValue("sdi_stick_window"));
set("asdi.step", ASDI);
set("hitlag.cap", HITLAG.cap);
set("hitlag.perDamage", f2(HITLAG.perDamage));
set("hitlag.base", HITLAG.base);
set("hitlag.electric", HITLAG.electric);
set("hitlag.crouch", f2(HITLAG.crouch));
tables.set("sdi", table(
  ["Damage", "Hitlag", "Most SDI (one input a frame)", "Electric hitlag", "Most SDI, electric"],
  ["r", "r", "r", "r", "r"],
  [3, 6, 9, 12, 15, 18, 24, 30].map((d) => [String(d), String(hitlag(d, false)), f0(hitlag(d, false) * SDI + ASDI), String(hitlag(d, true)), f0(hitlag(d, true) * SDI + ASDI)]),
));
{
  const widest = fighters.map((f) => attribute(f, "walk_max_vel"));
  set("sdi.maxDistance", f0(HITLAG.cap * SDI + ASDI));
  set("sdi.maxInFullHops", f1((HITLAG.cap * SDI + ASDI) / median(movement.map((m) => m.full.height))));
  set("walk.median", f2(median(widest)));
}
set("shield.max", commonValue("x260_startShieldHealth"));
set("shield.drain", f2(commonValue("x278") * 2));
set("shield.regen", f2(commonValue("x27C")));
set("shield.afterBreak", commonValue("x280_unkShieldHealth"));
set("shield.drainSeconds", f1(commonValue("x260_startShieldHealth") / (commonValue("x278") * 2) / 60));
set("shield.regenSeconds", f1(commonValue("x260_startShieldHealth") / commonValue("x27C") / 60));
set("shield.powershield", commonValue("powershield_input_window"));
set("tech.window", commonValue("x250"));
set("tech.lockout", commonValue("x1C"));
set("di.degrees", commonValue("x1A8"));
set("crouch.knockback", f2(commonValue("kb_squat_mul")));
set("ledge.regrab", commonValue("ledge_cooldown"));
set("knockdown.wait", commonValue("x424"));
set("jabReset.damage", commonValue("x428"));
spread("pla", fighters.flatMap((f) => { const v = field(frameRecord(f.id, "misc", null), "wd_frames"); return v === null ? [] : [{ id: f.id, v }]; }), f0);
set("grab.mash", commonValue("x3A8"));
set("grab.decrement", commonValue("grab_timer_decrement"));
set("grab.perPercent", f1(commonValue("x368")));
set("lcancel.window", commonValue("xE4"));
set("lcancel.divisor", commonValue("xE8"));
set("deadzone.stick", f2(commonValue("horizontal_stick_deadzone")));
set("tapjump.threshold", f2(commonValue("tap_jump_threshold")));
set("tapjump.window", commonValue("tap_jump_window"));
set("dash.smashWindow", commonValue("dash_smash_window"));
set("dash.smashThreshold", f2(commonValue("dash_smash_stick_threshold")));





const STUN = { scale: commonValue("x28C"), base: commonValue("x290"), light: commonValue("x2E4"), full: commonValue("x2E8") };
const fullShieldRaw = (damage: number): number => STUN.scale * Math.trunc(damage) * (1 - STUN.full) + STUN.base;
const shieldstunTicks = (damage: number): number => Math.trunc((fullShieldRaw(damage) * 200) / 201);
set("aos.stunFactor", f2(STUN.scale * (1 - STUN.full)));
set("aos.stunBase", STUN.base);
set("aos.lightFactor", (STUN.scale * (1 - STUN.light)).toFixed(3));
{
  const stunned = records.filter((r) => r.category === "attacks" && field(r, "stun") !== null && field(r, "percent") !== null);
  const agree = stunned.filter((r) => shieldstunTicks(field(r, "percent") ?? 0) === field(r, "stun"));
  set("aos.agree", `${agree.length} of ${stunned.length}`);
  const off = stunned.filter((r) => shieldstunTicks(field(r, "percent") ?? 0) !== field(r, "stun"));
  set("aos.agreeOffByOne", off.filter((r) => Math.abs(shieldstunTicks(field(r, "percent") ?? 0) - (field(r, "stun") ?? 0)) === 1).length);
}
tables.set("aosStun", table(
  ["Damage", "Shieldstun", "Hitlag, both fighters", "Defender's initial slide"],
  ["r", "r", "r", "r"],
  [3, 6, 9, 12, 15, 18, 24].map((d) => [String(d), String(shieldstunTicks(d)), String(hitlag(d, false)), f2(pushback(d))]),
));



const aerialAdvantage = (damage: number, contact: number, landing: number, lag: number): number => shieldstunTicks(damage) - (landing - 1 - contact) - lag;
const fighterById = (id: string): Movement => {
  const m = movement.find((entry) => entry.f.id === id);
  if (m === undefined) throw new Error(`no fighter ${id}`);
  return m;
};
{

  const falcon = fighterById("captain_falcon"), knee = frameRecord("captain_falcon", "attacks", "fair");
  const strong = field(knee, "percent") ?? 0, weak = field(knee, "percent_weak") ?? 0, start = field(knee, "start") ?? 0;
  const lag = attribute(falcon.f, "landingairf_lag"), cancelled = Math.trunc(lag / commonValue("xE8"));
  const SOUR = 17;
  set("knee.strong", strong);
  set("knee.weak", weak);
  set("knee.start", start);
  set("knee.sour", SOUR);
  set("knee.strongStun", shieldstunTicks(strong));
  set("knee.weakStun", shieldstunTicks(weak));
  set("knee.lag", lag);
  set("knee.cancelled", cancelled);
  set("knee.strongLate", signed(shieldstunTicks(strong) - cancelled));
  set("knee.weakLate", signed(shieldstunTicks(weak) - cancelled));
  set("knee.strongLateUncancelled", signed(shieldstunTicks(strong) - lag));
  set("knee.hopAir", falcon.short.airtime);
  set("knee.hopAirFast", falcon.shortFastFall.airtime);
  set("knee.fullAir", falcon.full.airtime);
  set("knee.fullAirFast", falcon.fullFastFall.airtime);

  set("knee.weakHighHop", signed(aerialAdvantage(weak, SOUR, falcon.short.airtime, cancelled)));
  set("knee.weakHighHopFall", falcon.short.airtime - 1 - SOUR);
  set("knee.strongFastHop", start < falcon.shortFastFall.airtime ? signed(aerialAdvantage(strong, start, falcon.shortFastFall.airtime, cancelled)) : "lands first");
  set("knee.strongFastHopFall", falcon.shortFastFall.airtime - 1 - start);
  set("knee.grab", f0(field(frameRecord("captain_falcon", "grabs", "standing_grab"), "start")));
  set("knee.normalLanding", attribute(falcon.f, "normal_landing_lag"));
}
{

  const fox = fighterById("fox"), drill = frameRecord("fox", "attacks", "dair"), shine = frameRecord("fox", "attacks", "down_b");
  const drillDamage = field(drill, "percent") ?? 0, drillLag = attribute(fox.f, "landingairlw_lag"), drillCancelled = Math.trunc(drillLag / commonValue("xE8"));
  set("drill.damage", drillDamage);
  set("drill.weak", field(drill, "percent_weak") ?? 0);
  set("drill.active", `${field(drill, "start") ?? 0}–${field(drill, "end") ?? 0}`);
  set("drill.stun", shieldstunTicks(drillDamage));
  set("drill.lag", drillLag);
  set("drill.cancelled", drillCancelled);
  set("drill.late", signed(shieldstunTicks(drillDamage) - drillCancelled));
  const shineDamage = field(shine, "percent") ?? 0, shineHit = field(shine, "start") ?? 0, shineActs = actionable(shine) ?? 0;
  set("shine.damage", shineDamage);
  set("shine.stun", shieldstunTicks(shineDamage));
  set("shine.corpusStun", f0(field(shine, "stun")));
  set("shine.hit", shineHit);
  set("shine.acts", shineActs);
  set("shine.onShield", signed(shineHit + shieldstunTicks(shineDamage) + 1 - shineActs));
  const nair = frameRecord("fox", "attacks", "nair");
  set("fox.oosNair", fox.squat + (field(nair, "start") ?? 0));
  set("fox.grab", f0(field(frameRecord("fox", "grabs", "standing_grab"), "start")));
}

tables.set("oosAerials", table(
  ["Fighter", "Shield grab", "Jump squat", "Neutral air", "Forward air", "Back air", "Up air", "Down air"],
  ["l", "r", "r", "r", "r", "r", "r", "r"],
  movement.map((m) => [name(m.f.id), f0(field(frameRecord(m.f.id, "grabs", "standing_grab"), "start")), String(m.squat),
    ...AERIALS.map((action) => { const s = field(frameRecord(m.f.id, "attacks", action), "start"); return s === null ? "–" : String(m.squat + s); })]),
));



interface Profile { readonly f: Fighter; readonly weight: number; readonly run: number; readonly air: number; readonly fall: number; readonly gravity: number; readonly groundStartup: number; readonly bestAerial: number | null; readonly oos: number }
const profiles: Profile[] = movement.map((m) => {
  const own = attacks.filter((a) => a.id === m.f.id);
  return {
    f: m.f, weight: attribute(m.f, "weight"), run: attribute(m.f, "dash_max_velocity"), air: attribute(m.f, "air_drift_max"),
    fall: attribute(m.f, "terminal_velocity"), gravity: attribute(m.f, "gravity"),
    groundStartup: Math.min(...defined(own.filter((a) => isGround(a.action)).map((a) => a.startup))),
    bestAerial: top(own.filter((a) => isAerial(a.action)), bestOnShield, 1, true)[0]?.onShield ?? null,
    oos: outOfShield.find((o) => o.f.id === m.f.id)?.fastest ?? 0,
  };
});
tables.set("profiles", table(
  ["Fighter", "Weight", "Run", "Air speed", "Fall speed", "Gravity", "Fastest ground move", "Best aerial on shield", "Fastest out of shield"],
  ["l", "r", "r", "r", "r", "r", "r", "r", "r"],
  [...profiles].sort((a, b) => b.weight - a.weight).map((p) => [name(p.f.id), f0(p.weight), f2(p.run), f2(p.air), f2(p.fall), f3(p.gravity),
    f0(p.groundStartup), signed(p.bestAerial), f0(p.oos)]),
));
spread("weight", profiles.map((p) => ({ id: p.f.id, v: p.weight })), f0);
{

  const weights = profiles.map((p) => p.weight);
  set("weight.knockbackRatio", f2((Math.max(...weights) + 100) / (Math.min(...weights) + 100)));
}
const correlate = (key: string, a: (p: Profile) => number, b: (p: Profile) => number) => set(`rho.${key}`, correlation(spearman(profiles.map(a), profiles.map(b))));
correlate("weightRun", (p) => p.weight, (p) => p.run);
correlate("weightAir", (p) => p.weight, (p) => p.air);
correlate("weightFall", (p) => p.weight, (p) => p.fall);
correlate("weightGroundStartup", (p) => p.weight, (p) => p.groundStartup);
correlate("weightOos", (p) => p.weight, (p) => p.oos);
correlate("runAir", (p) => p.run, (p) => p.air);
correlate("fallAerialSafety", (p) => p.fall, (p) => p.bestAerial ?? 0);
{

  const group = (key: string, measure: (p: Profile) => number, high: boolean, format: (v: number | null) => string) => {
    const cut = quantile(profiles.map(measure), high ? 0.75 : 0.25);
    const members = profiles.filter((p) => (high ? measure(p) >= cut : measure(p) <= cut)).map((p) => name(p.f.id)).sort();
    set(`group.${key}`, list(members));
    set(`group.${key}Cut`, format(cut));
  };
  group("heavy", (p) => p.weight, true, f0);
  group("light", (p) => p.weight, false, f0);
  group("fastFall", (p) => p.fall, true, f2);
  group("floaty", (p) => p.fall, false, f2);
  group("fastRun", (p) => p.run, true, f2);
  group("fastAir", (p) => p.air, true, f2);
}



const VALUE = /<!-- v:([\w.]+) -->[\s\S]*?<!-- \/v -->/g;
const TABLE = /<!-- table:([\w.]+) -->[\s\S]*?<!-- \/table -->/g;
function render(text: string, file: string): string {
  return text
    .replace(VALUE, (_, key: string) => {
      const value = values.get(key);
      if (value === undefined) throw new Error(`${file}: no computed value ${key}`);
      return `<!-- v:${key} -->${value}<!-- /v -->`;
    })
    .replace(TABLE, (_, key: string) => {
      const value = tables.get(key);
      if (value === undefined) throw new Error(`${file}: no computed table ${key}`);
      return `<!-- table:${key} -->\n${value}\n<!-- /table -->`;
    });
}

async function staleDocuments(): Promise<string[]> {
  const stale: string[] = [];
  for (const file of readdirSync(CASE_STUDY_DIRECTORY).filter((f) => f.endsWith(".md")).sort()) {
    const text = await Bun.file(join(CASE_STUDY_DIRECTORY, file)).text();
    if (render(text, file) !== text) stale.push(file);
  }
  return stale;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const stale = await staleDocuments();
  if (check) {
    for (const file of stale) console.log(`stale: docs/design/melee/${file}`);
    process.exitCode = stale.length === 0 ? 0 : 1;
  } else {
    for (const file of stale) {
      const path = join(CASE_STUDY_DIRECTORY, file);
      await Bun.write(path, render(await Bun.file(path).text(), file));
      console.log(`updated docs/design/melee/${file}`);
    }
  }
}
