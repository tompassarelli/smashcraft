import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Effect } from 'effect';
import type { Character } from '../../ts/src/game/sim/codes';
import type { Capsule } from '../../ts/src/game/sim/geometry/contactGeometry';
import { SELECTABLE_CHARACTERS, fighterSlug } from '../../ts/src/game/roster/kits';
import { LIMB_STRIKES, SPELL_STRIKES } from '../../ts/scripts/wisp/animStrikeKinds';
import { type SampledMove, loadBody, sampleFighter } from '../../ts/scripts/wisp/animScoreSample';
import type { DrawnModel } from '../../ts/scripts/wisp/drawnModel';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { FIGHTER_RIGS } from './rigs';
import { type Edge, type MoveFit, type Point, farEnd, fitMove, ownerKey, segmentDistance, striker, writeFits } from './weapon-fit';

const GAP_LIMIT = 20.0;
const AERIAL_SIDE: Readonly<Record<string, number>> = { 'forward-air': 1, 'back-air': -1 };
const USAGE = 'usage: bun tools/animations/weapon-trace.ts [--fighter SLUG]... [--assets DIR] [--shift FIGHTER:MOVE:DX | --fit]';

type Weapon = { readonly name: string; readonly hand: number; readonly vertices: readonly number[] };
type Shift = { readonly fighter: string; readonly move: string; readonly dx: number };
type Gap = { readonly gap: number; readonly frame: number; readonly at: Point };
type Row = { readonly fighter: string; readonly move: string; readonly weapons: string; readonly frames: readonly number[]; readonly tip: Gap; readonly reach: Gap; readonly by: 'weapon' | 'limb' | 'spell' | 'prop' | 'body'; readonly shifted: boolean; readonly turned: readonly number[] };

const fails = (row: Row) => row.by === 'weapon' && (Math.max(row.tip.gap, row.reach.gap) > GAP_LIMIT || row.turned.length > 0);
const worst = (row: Row) => Math.max(row.tip.gap, row.reach.gap);

const outside = (p: Point, capsule: Capsule) => Math.max(0, segmentDistance(p, [capsule.x1, capsule.z1], [capsule.x2, capsule.z2]) - capsule.radius);

function rigWeapons(model: DrawnModel, character: Character): Weapon[] {
  const rig = FIGHTER_RIGS.get(character)?.classic;
  if (rig === undefined) return [];
  const nodes = model.nodes(), names = nodes.map(node => node.name);
  const wrists = (['wrist.R', 'wrist.L'] as const).map(joint => names.indexOf(rig[joint] ?? '')).filter(index => index >= 0);
  return (['weapon', 'weapon.L'] as const).flatMap(joint => {
    const name = rig[joint], node = name === undefined ? -1 : names.indexOf(name);
    if (name === undefined || node < 0) return [];
    let held: number | undefined;
    for (let at: number | undefined = node; at !== undefined && held === undefined; at = nodes[at]?.parent) if (wrists.includes(at)) held = at;
    const hand = held ?? (joint === 'weapon.L' ? wrists[1] ?? wrists[0] : wrists[0]);
    const vertices = Array.from(model.influencedBy(new Set([name]))).flatMap((inside, index) => inside === 1 ? [index] : []);
    return hand === undefined || vertices.length === 0 ? [] : [{ name, hand, vertices }];
  });
}

function edgeAt(model: DrawnModel, weapon: Weapon, seconds: number): Edge {
  const posed = model.posed(0, seconds, 1);
  const hand: Point = [posed.nodes[weapon.hand * 2] ?? 0, posed.nodes[weapon.hand * 2 + 1] ?? 0];
  const points = weapon.vertices.map((index): Point => [posed.vertices[index * 2] ?? 0, posed.vertices[index * 2 + 1] ?? 0]);
  const farthestFrom = (from: Point) => points.reduce((far, point) => Math.hypot(point[0] - from[0], point[1] - from[1]) > Math.hypot(far[0] - from[0], far[1] - from[1]) ? point : far, from);
  const tip = farthestFrom(hand), other = farthestFrom(tip);
  if (Math.hypot(other[0] - hand[0], other[1] - hand[1]) > GAP_LIMIT) return { grip: other, tip };
  const grip = points.reduce((near, point) => Math.hypot(point[0] - hand[0], point[1] - hand[1]) < Math.hypot(near[0] - hand[0], near[1] - hand[1]) ? point : near, hand);
  return { grip, tip };
}

function tipGap(frames: readonly number[], regions: readonly (readonly Capsule[])[], edges: readonly (readonly Edge[])[]): Gap {
  let found: Gap | undefined;
  frames.forEach((frame, index) => {
    const nearest = (edges[index] ?? []).map(edge => ({ gap: Math.min(...(regions[index] ?? []).map(capsule => outside(edge.tip, capsule))), frame, at: edge.tip }))
      .toSorted((a, b) => a.gap - b.gap)[0];
    if (nearest !== undefined && (found === undefined || nearest.gap > found.gap)) found = nearest;
  });
  return found ?? { gap: 0, frame: frames[0] ?? 0, at: [0, 0] };
}

function reachGap(frames: readonly number[], regions: readonly (readonly Capsule[])[], edges: readonly (readonly Edge[])[]): Gap {
  const path = edges.flat();
  let found: Gap | undefined;
  frames.forEach((frame, index) => {
    for (const capsule of regions[index] ?? []) {
      if ('path' in capsule && capsule.path === true) continue;
      const end = farEnd(capsule);
      const gap = Math.max(0, Math.min(...path.map(edge => segmentDistance(end, edge.grip, edge.tip))) - capsule.radius);
      if (found === undefined || gap > found.gap) found = { gap, frame, at: end };
    }
  });
  return found ?? { gap: 0, frame: frames[0] ?? 0, at: [0, 0] };
}

type Traced = { readonly row: Row; readonly sampled: SampledMove; readonly edges: readonly (readonly Edge[])[] };

function traceMove(model: DrawnModel, character: Character, weapons: readonly Weapon[], sampled: SampledMove, shift: Shift | undefined): Traced | undefined {
  const fighter = fighterSlug(character), { firstActive, lastActive } = sampled.sample;
  const frames = Array.from({ length: lastActive - firstActive + 1 }, (_, index) => firstActive + index).filter(frame => (sampled.strikes[frame]?.length ?? 0) > 0);
  if (frames.length === 0) return undefined;
  const shifted = shift !== undefined && shift.fighter === fighter && shift.move === sampled.move;
  const regions = frames.map((frame, index) => (sampled.strikes[frame] ?? []).map((capsule, slot) =>
    shifted && index === 0 && slot === 0 ? { ...capsule, x1: capsule.x1 + shift.dx, x2: capsule.x2 + shift.dx } : capsule));
  const edges = frames.map(frame => weapons.map(weapon => edgeAt(model, weapon, sampled.seconds[frame] ?? 0)));
  const side = AERIAL_SIDE[sampled.move] ?? 0;
  const reaches = (edge: readonly Edge[]) => edge.flatMap(each => [each.grip[0], each.tip[0]]).reduce((far, x) => Math.abs(x) > Math.abs(far) ? x : far, 0) * side > 0;
  const turned = side === 0 ? [] : frames.filter((_, index) => !(edges[index] ?? []).some(edge => edge.tip[0] * side > 0) && !reaches(edges[index] ?? []));
  const struck = striker(sampled.regionOwners[frames[0] ?? 0]);
  const row: Row = {
    fighter, move: sampled.move, weapons: weapons.map(weapon => weapon.name).join('+'), frames,
    tip: tipGap(frames, regions, edges), reach: reachGap(frames, regions, edges),
    by: struck !== 'weapon' ? struck : LIMB_STRIKES[fighter]?.includes(sampled.move) === true ? 'limb' : SPELL_STRIKES[fighter]?.includes(sampled.move) === true ? 'spell' : 'weapon', shifted, turned,
  };
  return { row, sampled, edges };
}

type Args = { fighters: Character[]; assets: string | undefined; shift: Shift | undefined; fit: 'no' | 'loop' | 'once' };
function parseArgs(args: readonly string[]): Args {
  const fighters: Character[] = [];
  let assets: string | undefined, shift: Shift | undefined, fit: Args['fit'] = 'no';
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (flag === '--fit' || flag === '--fit-once') {
      fit = flag === '--fit' ? 'loop' : 'once';
      index -= 1;
      continue;
    }
    if (value === undefined) throw new Error(USAGE);
    if (flag === '--assets') assets = resolve(value);
    else if (flag === '--fighter') {
      const character = SELECTABLE_CHARACTERS.find(candidate => fighterSlug(candidate) === value.toLowerCase());
      if (character === undefined) throw new Error(`no fighter named ${value}; ${USAGE}`);
      fighters.push(character);
    } else if (flag === '--shift') {
      const [fighter = '', move = '', dx = ''] = value.split(':');
      if (!Number.isFinite(Number(dx)) || value.split(':').length !== 3) throw new Error(USAGE);
      shift = { fighter, move, dx: Number(dx) };
    } else throw new Error(USAGE);
  }
  if (fit !== 'no' && shift !== undefined) throw new Error(`--fit takes no --shift; ${USAGE}`);
  return { fighters: fighters.length === 0 ? [...SELECTABLE_CHARACTERS] : fighters, assets, shift, fit };
}

const point = (at: Point) => `${at[0].toFixed(1)},${at[1].toFixed(1)}`;
const HEADER = ['fighter', 'move', 'weapons', 'active', 'tip outside', 'tip frame', 'tip x,z', 'region overreach', 'overreach frame', 'overreach x,z', 'strike by', 'shifted', 'tip on wrong side', 'verdict'];
const tsvRow = (row: Row) => [
  row.fighter, row.move, row.weapons, `${row.frames[0]}-${row.frames.at(-1)}`, row.tip.gap.toFixed(1), row.tip.frame, point(row.tip.at),
  row.reach.gap.toFixed(1), row.reach.frame, point(row.reach.at), row.by, row.shifted ? 'yes' : 'no', row.turned.length === 0 ? 'none' : row.turned.join(','), fails(row) ? 'FAIL' : 'pass',
].join('\t');

const FIT_ROUNDS = 6;
const out = resolve(import.meta.dir, '../../build/anim-score');
const fitReport = join(out, 'weapon-fit.json');

async function fitLoop(argv: readonly string[], assets: string): Promise<void> {
  const self = ['bun', resolve(import.meta.path), ...argv.filter(arg => arg !== '--fit')];
  for (let round = 1; round <= FIT_ROUNDS; round++) {
    const regen = Bun.spawnSync(['bun', 'wisp', 'view', 'strikes', '--assets', assets], { cwd: resolve(import.meta.dir, '../../ts'), stdout: 'inherit', stderr: 'inherit' });
    if (regen.exitCode !== 0) throw new Error('bun wisp view strikes failed');
    const fit = Bun.spawnSync([...self, '--fit-once'], { stdout: 'inherit', stderr: 'inherit' });
    if (fit.exitCode !== 0) throw new Error(`weapon fit round ${round} failed`);
    const written = (await Bun.file(fitReport).json()) as { readonly fitted: number; readonly dropped: number };
    console.log(`weapon fit round ${round}: ${written.fitted} moves refitted, ${written.dropped} fits dropped`);
    if (written.fitted + written.dropped === 0) break;
  }
  process.exitCode = Bun.spawnSync(self, { stdout: 'inherit', stderr: 'inherit' }).exitCode;
}

type Change = { readonly fits: MoveFit[]; readonly excluded: string[] };

async function fitFlagged(traced: readonly (Traced & { readonly character: Character })[]): Promise<number> {
  const byFighter = new Map<Character, Change>();
  const change = (character: Character): Change => {
    const found: Change = byFighter.get(character) ?? { fits: [], excluded: [] };
    byFighter.set(character, found);
    return found;
  };
  const excluded: string[] = [];
  for (const { row, sampled, edges, character } of traced) {
    if (row.by === 'prop' || row.by === 'body' || row.by === 'limb') {
      const owner = sampled.regionOwners[row.frames[0] ?? 0], key = owner === undefined ? undefined : ownerKey(character, sampled.move, owner);
      excluded.push(`${row.fighter} ${row.move}`);
      console.log(`excluded: ${row.fighter} ${row.move} strikes with its ${row.by}, not the traced weapon`);
      if (key !== undefined) change(character).excluded.push(key);
      continue;
    }
    if (!fails(row)) continue;
    const fitted = fitMove(character, sampled, row.frames, edges);
    if (typeof fitted === 'string') console.log(`not fitted: ${row.fighter} ${row.move}: ${fitted}`);
    else change(character).fits.push(fitted);
  }
  let fitted = 0, dropped = 0;
  for (const [character, { fits, excluded: keys }] of byFighter) {
    const written = await writeFits(character, fits, keys);
    fitted += fits.length;
    dropped += written.dropped.length;
    if (fits.length > 0) console.log(`fitted ${fits.map(move => move.key).join(', ')} into ${written.file}`);
    if (written.dropped.length > 0) console.log(`dropped the fit of ${written.dropped.join(', ')} from ${written.file}`);
  }
  await Bun.write(fitReport, JSON.stringify({ fitted, dropped, excluded }));
  return fitted + dropped;
}

const argv = process.argv.slice(2);
const { fighters, assets: assetsArg, shift, fit } = parseArgs(argv);
const assets = assetsArg ?? assetsView(await Effect.runPromise(readManifest()));
mkdirSync(out, { recursive: true });
if (fit === 'loop') await fitLoop(argv, assets);
else {
  const traced: (Traced & { readonly character: Character })[] = [], unarmed: string[] = [];
  for (const character of fighters) {
    const body = await loadBody(assets, character);
    const weapons = rigWeapons(body, character);
    if (weapons.length === 0) { unarmed.push(fighterSlug(character)); continue; }
    for (const sampled of sampleFighter(body, character)) {
      const found = traceMove(body, character, weapons, sampled, shift);
      if (found !== undefined) traced.push({ ...found, character });
    }
  }
  const sorted = traced.map(found => found.row).toSorted((a, b) => Number(fails(b)) - Number(fails(a)) || worst(b) - worst(a));
  const table = join(out, shift === undefined ? 'classic-weapons.tsv' : 'classic-weapons-shifted.tsv');
  await Bun.write(table, `${[HEADER.join('\t'), ...sorted.map(tsvRow)].join('\n')}\n`);
  const failing = sorted.filter(fails).length;
  if (fit === 'once') await fitFlagged(traced);
  else console.log([HEADER.join('\t'), ...sorted.map(tsvRow)].join('\n'));
  console.log(`${sorted.length} weapon moves over ${fighters.length - unarmed.length} armed fighters; ${failing} miss their weapon by more than ${GAP_LIMIT} units or aim a forward or back air the wrong way; unarmed: ${unarmed.join(', ') || 'none'}; ${table}`);
  if (failing > 0 && fit === 'no') process.exitCode = 1;
}
