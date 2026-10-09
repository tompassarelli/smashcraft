// Renders every fighter's portrait pose through Wisp's headless renderer, once in
// Classic and once in Definitive, from the body the match draws in each mode
// (the Definitive body resolves under _de.w3mod, docs/design/hd-fighters.md).
// Both sets share one camera, light and pose, so only the graphics mode differs.
// Usage: bun scripts/fighterPortraits.ts PRIVATE_OUTPUT [--only NAME,...] [--graphics classic|definitive]
// Writes the raw 1024 px renders to PRIVATE_OUTPUT/{classic,definitive}/ and the
// map's portraits to PRIVATE_OUTPUT/fighter-renders/ (Classic) and its de/
// folder (Definitive): store that folder as the fighter-renders family.
import { mkdirSync, readdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Effect, Schema } from 'effect';
import { captureScene, renderScenes, type RenderScene } from 'wisp/scripts/wisp/headlessRender';
import { createStandaloneSession, NEUTRAL_INPUT } from './wisp/standalone';
import { headlessRender } from './wisp/headlessRender';
import { assetsView, readManifest } from './wisp/buildInputs';
import { PORTRAIT_KINDS, type PortraitKind, RENDERED_FIGHTERS, fighterName, fighterRenderName } from '../src/game/sim/heroes/registry';
import { PARTICIPANT_SLOTS } from '../src/game/input/participants';
import { CARD_TEXTURE_PX, TILE_TEXTURE_PX } from '../src/game/ui/portraitFrames';
import { STOCK_ICON_PX } from '../src/game/ui/plateLayout';
import { NEUTRAL_TEAM_COLOR } from '../src/game/ui/slotColors';
import { ModelRenderer, generateMDX, parseMDX } from 'wisp/vendor/war3-model.mjs';
import { Character } from '../src/game/sim/codes';
import { originalClip, originalClipCount } from '../src/game/assets/fighterOriginalClipInfo';
import { at } from 'wisp/src/runtime/lookup';
import { STAGE_LIGHTS } from '../src/game/assets/stageLighting';

const [outputArg] = process.argv.slice(2);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1]?.split(',') : undefined;
const graphicsArg = process.argv.includes('--graphics') ? process.argv[process.argv.indexOf('--graphics') + 1] : undefined;
if (graphicsArg !== undefined && graphicsArg !== 'classic' && graphicsArg !== 'definitive') throw new Error('--graphics must be classic or definitive');
const graphicsModes: readonly ('classic' | 'definitive')[] = graphicsArg === undefined ? ['classic', 'definitive'] : [graphicsArg];
if (outputArg === undefined) throw new Error('usage: bun scripts/fighterPortraits.ts PRIVATE_OUTPUT [--only NAME,...]');
const output = resolve(outputArg);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('Renders stay outside the repository');

/** Drawn size; the crops read a 1024 px render, so this supersamples the renderer's unantialiased edges. */
const DRAWN = 2048;
const RESOLUTION = 1024;
/** The renderer's clear colour (wisp:scripts/wisp/browser/headlessRender.ts), keyed out as the background. */
const CLEAR = [10, 15, 23];
/** The camera looks level along +y, so the face, turned toward it, is seen from its own height. */
const ROTATION = 90;
const ANGLE = 0;
/** The most a `level` correction tilts the camera to meet a raised or lowered face, degrees. */
const MAX_MEET = 35;
/** The face points at the camera turned 20 degrees toward image left (-x), so the weapon hand and near pauldron sit behind it. */
const FACE_AZIMUTH = -Math.PI / 2 - 20 * Math.PI / 180;
/**
 * The portrait's key light, toward the light: from the camera's side, 25 degrees
 * toward image left and 30 above, so the turned face takes the light in both modes.
 */
const KEY_TOWARD = [-Math.sin(25 * Math.PI / 180) * Math.cos(Math.PI / 6), -Math.cos(25 * Math.PI / 180) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)] as const;
/** The portrait's day/night model, served by resolveAsset. */
const PORTRAIT_LIGHT = 'war3mapImported\\PortraitLight.mdl';
/** The day/night light model's rotation: its light points down its local z (wisp's dayNightLight), turned onto KEY_TOWARD. */
const KEY_ROTATION = (() => {
  const half = Math.acos(KEY_TOWARD[2]) / 2, axis = [-KEY_TOWARD[1], KEY_TOWARD[0], 0], length = Math.hypot(...axis);
  return `{ ${[...axis.map((value) => value / length * Math.sin(half)), Math.cos(half)].map((value) => Number(value.toFixed(4))).join(', ')} }`;
})();
/**
 * The portrait's light: the neutral stage light (classic midday key and fill)
 * held on KEY_ROTATION, so both looks take the same key on the face.
 */
const portraitLightMdl = () => {
  const { key, ambient } = at(STAGE_LIGHTS, 0).light;
  // war3-model reads MDL colours red first and stores them blue first, as Warcraft reads them.
  const colour = (rgb: readonly number[]) => `{ ${rgb.map((channel) => Number((channel / 255).toFixed(4))).join(", ")} }`;
  const extent = "MinimumExtent { -1, -1, -1 }, MaximumExtent { 1, 1, 1 }, BoundsRadius 1,";
  return `Version { FormatVersion 800, }
Model "Smashcraft stage light" { BlendTime 150, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 333, 60333 }, ${extent} } }
Light "StageSun" {
  ObjectId 0,
  Directional,
  static AttenuationStart 80,
  static AttenuationEnd 200,
  static Intensity 1,
  static Color ${colour(key)},
  static AmbIntensity 1,
  static AmbColor ${colour(ambient)},
  Rotation 1 { DontInterp, 333: ${KEY_ROTATION}, }
}
PivotPoints 1 { { 0, 0, 0 }, }
`;
};
/** A narrow lens from far away, close to the Blender set's orthographic camera. */
const FOV = 8;

const fighters = RENDERED_FIGHTERS.filter((character) => only === undefined || only.includes(fighterRenderName(character)));

/** A fighter's portrait scene couldn't be set up. */
class PortraitFailure extends Schema.TaggedError<PortraitFailure>()('PortraitFailure', { problem: Schema.String }) {}

const withoutFog = ({ fog: _fog, ...environment }: RenderScene['environment']) => environment;

/** The fighter alone at the origin in its match Stand pose, under the stage's light without sky or fog. */
const portraitScene = (scene: RenderScene, character: number, frame: { x: number; z: number; height: number }, variant: number, pose?: Portrait): RenderScene => {
  // Player one's fighter stands left of centre, facing right.
  const body = scene.effects.find((effect) => effect.x < -100 && Math.abs(effect.yaw) < 0.01 && !effect.model.includes('OriginalLight'));
  if (body === undefined) throw new Error(`${fighterName(character)}: no fighter body in ${scene.effects.map((effect) => effect.model).join(', ')}`);
  const distance = frame.height * 1.1 / (2 * Math.tan(FOV * Math.PI / 360));
  return {
    ...scene, frame: frameOf(character, variant), client: 0, units: [], ui: [], textTags: [], filter: undefined,
    effects: [{ ...body, x: 0, y: 0, z: 0, yaw: pose?.yaw ?? 0, teamColor: at(VARIANTS, variant).team, ...(pose?.elapsed === undefined ? {} : { animationElapsed: pose.elapsed }) }],
    environment: { ...withoutFog(scene.environment), skyVisible: false, dayNight: { ...scene.environment.dayNight, unit: PORTRAIT_LIGHT } },
    // The camera's right is (sin rotation, -cos rotation) on the ground.
    camera: { x: frame.x * Math.sin(ROTATION * Math.PI / 180), y: -frame.x * Math.cos(ROTATION * Math.PI / 180), fields: {
      CAMERA_FIELD_ROTATION: ROTATION, CAMERA_FIELD_ANGLE_OF_ATTACK: (360 + (pose?.angle ?? ANGLE)) % 360, CAMERA_FIELD_TARGET_DISTANCE: distance,
      CAMERA_FIELD_ZOFFSET: frame.z, CAMERA_FIELD_ROLL: 0, CAMERA_FIELD_FIELD_OF_VIEW: FOV, CAMERA_FIELD_NEARZ: distance / 4, CAMERA_FIELD_FARZ: distance * 4,
    } },
  };
};

/**
 * The body without its hero glow: a portrait shows the fighter, not the ring
 * under its feet. Every glow layer is additive,
 * so pointing its texture at stock black draws nothing. The model is patched in
 * place: rewriting it would re-encode the version-1800 skins.
 */
function withoutGlow(bytes: Uint8Array): Uint8Array {
  const model = parseMDX(bytes.slice().buffer);
  const glow = model.Textures.flatMap((texture, index) => texture.ReplaceableId === 2 || /teamglow/i.test(texture.Image) ? [index] : []);
  if (glow.length === 0) return bytes;
  const out = bytes.slice(), view = new DataView(out.buffer);
  for (let at = 4; at + 8 <= out.length; at += 8 + view.getUint32(at + 4, true)) {
    if (new TextDecoder().decode(out.subarray(at, at + 4)) !== 'TEXS') continue;
    for (const index of glow) {
      const entry = at + 8 + index * 268;
      view.setUint32(entry, 0, true);
      out.fill(0, entry + 4, entry + 264);
      out.set(new TextEncoder().encode('Textures\\Black32.blp'), entry + 4);
    }
    return out;
  }
  throw new Error('a model with textures has no TEXS chunk');
}


/**
 * Classic Murloc and Kobold (the 3.0 stock models their bodies keep) hang their
 * old mesh bones, every pivot collapsed to one point, under a second Bone_* rig.
 * Posed through that rig, war3-model's evaluator (Wisp's renderer, and the
 * earlier Blender importer) scatters the mesh into texture noise, so
 * these portraits hold the rig's rest pose. Neither body has a skin, so
 * re-encoding is safe.
 */
const CLASSIC_REST_POSE: readonly number[] = [Character.murloc, Character.kobold];
function restPose(bytes: Uint8Array): Uint8Array {
  const model = parseMDX(bytes.slice().buffer);
  for (const node of [...model.Bones, ...model.Helpers]) if (node.Name.startsWith('Bone_')) { delete node.Translation; delete node.Rotation; delete node.Scaling; }
  return new Uint8Array(generateMDX(model));
}

type Model = ReturnType<typeof parseMDX>;
/** An element that must exist: the typed-array and string-match counterpart of at(). */
const item = <T>(values: ArrayLike<T>, index: number): T => { const value = values[index]; if (value === undefined) throw new Error(`no element ${index} of ${values.length}`); return value; };
const required = <T>(value: T | undefined, what: string): T => { if (value === undefined) throw new Error(`no ${what}`); return value; };
interface RendererData { frame: number; nodes: ({ matrix: Float32Array } | undefined)[]; geosetAlpha: number[] }
const isRendererData = (value: unknown): value is RendererData => typeof value === 'object' && value !== null && 'frame' in value && 'nodes' in value && 'geosetAlpha' in value;
const headNode = (model: Model) => model.Nodes.find((candidate) => candidate !== undefined && /^bone_?head$/i.test(candidate.Name.trim()))
  ?? model.Nodes.find((candidate) => candidate !== undefined && /^head$/i.test(candidate.Name.trim()))
  ?? model.Nodes.find((candidate) => candidate !== undefined && /head/i.test(candidate.Name) && !/over|ref|cloth|frill|piece/i.test(candidate.Name));
const sequenceOf = (model: Model, animation: string | number | undefined) => Math.max(0, model.Sequences.findIndex((candidate) => candidate.Name.toLowerCase() === String(animation ?? 'stand').toLowerCase()));
function posedAt(model: Model, sequence: number, ms: number) {
  const renderer = new ModelRenderer(model);
  const state = Reflect.get(renderer, 'rendererData');
  if (!isRendererData(state)) throw new Error('war3-model renderer without rendererData');
  renderer.setSequence(sequence);
  const pose = (at: number) => { state.frame = (model.Sequences[sequence]?.Interval[0] ?? 0) + at; renderer.update(0); return state; };
  return { state: pose(ms), pose };
}

/** A portrait's pose: the Stand time it shows and the body's yaw that turns its face to the camera. */
interface Portrait { readonly elapsed: number; readonly yaw: number; readonly angle: number; readonly zoom: number }

/**
 * Per-fighter corrections where the measured pose still hides the face: `turn`
 * (degrees added to the face's yaw), `elapsed` (the Stand time, seconds),
 * `angle` (the camera's angle of attack, degrees; positive looks up from below)
 * `zoom` (the head crop's magnification) and `level` (pose at the Stand frame
 * whose face is closest to level, the camera raised or lowered to meet what
 * tilt remains).
 */
interface Correction { readonly turn?: number; readonly elapsed?: number; readonly angle?: number; readonly zoom?: number; readonly level?: boolean }
const CORRECTIONS: Readonly<Record<'classic' | 'definitive', Readonly<Record<string, Correction>>>> = {
  classic: {
    "Anub'arak": { zoom: 0.5 },
  },
  definitive: {
    MountainKing: { level: true, zoom: 1.5 },
    Illidan: { level: true, zoom: 1.5, turn: 25 },
    Kobold: { level: true, zoom: 1.5, turn: 180 },
    Rifleman: { zoom: 1.5, turn: 25 },
    Warden: { zoom: 1.5, turn: 25 },
    ShadowHunter: { level: true, zoom: 1.5 },
    "Kael'thasSunstrider": { angle: 15, turn: 30 },
  },
};

type Vector = [number, number, number];
/** A node matrix's linear part (w 0) or affine map (w 1) applied to v. */
const apply = (matrix: Float32Array, v: readonly number[], w: number): Vector => {
  const row = (r: number) => item(matrix, r) * item(v, 0) + item(matrix, 4 + r) * item(v, 1) + item(matrix, 8 + r) * item(v, 2) + w * item(matrix, 12 + r);
  return [row(0), row(1), row(2)];
};
const mean = (points: readonly (readonly number[])[]): Vector => {
  const axis = (a: number) => points.reduce((total, point) => total + item(point, a), 0) / points.length;
  return [axis(0), axis(1), axis(2)];
};
type Posed = ReturnType<ReturnType<typeof posedAt>['pose']>;

/** Joints that sit on a face: Classic eyes, jaws and face bones, Definitive's ffx and bind joints. */
const FACE_JOINT = /(^|[_ ])(nose|eyes?|jaw|face)(?![a-z])/i;

/**
 * The head: the head bone (or, where the named one carries no face joints, the
 * sibling joint beside it that does, as on Definitive's bind rigs; without a
 * named one, the face joints' most common parent), the joints beneath it, and
 * the vertices bound mostly to it or its direct children (Classic face meshes,
 * Definitive jaws and eyes; deeper chains carry beards, cloth and plumes), with
 * each vertex's bone weights.
 */
function headOf(model: Model) {
  const parent = new Map(model.Nodes.flatMap((node) => node?.ObjectId === undefined ? [] : [[node.ObjectId, node.Parent ?? -1] as const]));
  const under = (id: number, ancestor: number) => { for (let at: number | undefined = parent.get(id); at !== undefined && at >= 0; at = parent.get(at)) if (at === ancestor) return true; return false; };
  const nodes = model.Nodes.flatMap((node) => node?.ObjectId === undefined ? [] : [{ id: node.ObjectId, name: node.Name.trim() }]);
  const joints = nodes.filter((node) => FACE_JOINT.test(node.name));
  const carried = (id: number) => joints.filter((joint) => under(joint.id, id)).length;
  const named = headNode(model)?.ObjectId;
  const candidates = named !== undefined
    ? [named, ...model.Nodes.flatMap((node) => node?.ObjectId !== undefined && node.ObjectId !== named && parent.get(node.ObjectId) === parent.get(named) ? [node.ObjectId] : [])]
    : [...new Set(joints.map((joint) => parent.get(joint.id) ?? -1).filter((id) => id >= 0))];
  const head = candidates.reduce<number | undefined>((best, id) => best === undefined || carried(id) > carried(best) ? id : best, undefined);
  if (head === undefined) return undefined;
  const below = nodes.filter((node) => under(node.id, head));
  const bones = new Set([head, ...model.Nodes.flatMap((child) => child?.ObjectId !== undefined && child.Parent === head ? [child.ObjectId] : [])]);
  const vertices: { geoset: number; position: Vector; weights: [number, number][] }[] = [];
  model.Geosets.forEach((geoset, index) => {
    for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) {
      const skin = geoset.SkinWeights;
      const weights: [number, number][] = skin !== undefined && skin.length > 0
        ? [0, 1, 2, 3].map((k) => [item(skin, vertex * 8 + k), item(skin, vertex * 8 + 4 + k) / 255])
        : (geoset.Groups?.[item(geoset.VertexGroup, vertex)] ?? []).map((bone, _, group) => [bone, 1 / group.length]);
      if (weights.reduce((total, [bone, weight]) => total + (bones.has(bone) ? weight : 0), 0) <= 0.5) continue;
      vertices.push({ geoset: index, position: [item(geoset.Vertices, vertex * 3), item(geoset.Vertices, vertex * 3 + 1), item(geoset.Vertices, vertex * 3 + 2)], weights });
    }
  });
  return { head, joints: below, vertices };
}

/** Definitive's eyeball joints, by side (the model's left is +y). */
const EYE = { L: /^(ffx_eye_L0_eye_jnt|L_eye_bind_jnt)$/i, R: /^(ffx_eye_R0_eye_jnt|R_eye_bind_jnt)$/i };
/** Head meshes with fewer vertices than this can't place a face. */
const HEAD_VERTICES = 50;

/**
 * The face's heading where the body is drawn, radians about z from +x. With a
 * pair of eyeballs (Definitive rigs, whose bind poses aren't all level), level
 * and square to the posed line across them. Otherwise the bind pose's level
 * head-bone-to-nose (else eyes, else the head mesh's forward-most tenth;
 * Warcraft models face +x) direction, turned by the bone carrying most of the
 * head mesh.
 */
function headingOf(model: Model, head: NonNullable<ReturnType<typeof headOf>>): { heading: (state: Posed) => number | undefined; pitch: (state: Posed) => number | undefined } | undefined {
  const pivot = (id: number) => Array.from(model.PivotPoints[id] ?? [0, 0, 0]);
  const at = (state: Posed, ids: readonly number[]) => { const points = ids.flatMap((id) => { const matrix = state.nodes[id]?.matrix; return matrix === undefined ? [] : [apply(matrix, pivot(id), 1)]; }); return points.length === ids.length ? mean(points) : undefined; };
  const joints = (pattern: RegExp) => head.joints.filter((joint) => pattern.test(joint.name)).map((joint) => joint.id);
  const left = joints(EYE.L), right = joints(EYE.R);
  const level = (from: readonly number[], to: readonly number[]) => { const dx = item(to, 0) - item(from, 0), dy = item(to, 1) - item(from, 1); return Math.hypot(dx, dy) > 1e-3 ? [dx, dy, 0] : undefined; };
  const eyes = left.length > 0 && right.length > 0;
  const named = eyes ? [...left, ...right] : ([/nose/i, /eye/i].map((pattern) => joints(pattern)).find((found) => found.length > 0) ?? []);
  const front = head.vertices.map((vertex) => vertex.position).sort((a, b) => b[0] - a[0]).slice(0, Math.ceil(head.vertices.length / 10));
  const bind = (named.length > 0 ? level(pivot(head.head), mean(named.map(pivot))) : undefined)
    ?? (head.vertices.length >= HEAD_VERTICES ? level(mean(head.vertices.map((vertex) => vertex.position)), mean(front)) : undefined);
  if (bind === undefined) return undefined;
  const load = new Map<number, number>();
  for (const vertex of head.vertices) for (const [bone, weight] of vertex.weights) load.set(bone, (load.get(bone) ?? 0) + weight);
  const carrier = eyes ? head.head : [...load].reduce<[number, number]>((best, entry) => entry[1] > best[1] ? entry : best, [head.head, 0])[0];
  const face = (state: Posed) => { const matrix = state.nodes[carrier]?.matrix; return matrix === undefined ? undefined : apply(matrix, bind, 0); };
  return {
    heading: (state) => {
      if (eyes) { const l = at(state, left), r = at(state, right); return l === undefined || r === undefined ? undefined : Math.atan2(r[0] - l[0], l[1] - r[1]); }
      const posed = face(state); return posed === undefined ? undefined : Math.atan2(posed[1], posed[0]);
    },
    pitch: (state) => { const posed = face(state); return posed === undefined ? undefined : Math.atan2(posed[2], Math.hypot(posed[0], posed[1])); },
  };
}

/**
 * The portrait pose: the frame of the body's Stand clip (the timeline clip
 * holding the match's sampled time) whose face joints (nose, else eyes, else
 * the head attachment) stand highest above the head bone, so an idle that
 * bows the head still shows the face, and the yaw that turns that face to
 * FACE_AZIMUTH.
 */
function portraitPose(bytes: Uint8Array, character: number, animation: string | number | undefined, elapsed: number, correction: Correction): Portrait | undefined {
  const model = parseMDX(bytes.slice().buffer);
  const head = headOf(model);
  const heading = head === undefined ? undefined : headingOf(model, head);
  if (head === undefined || heading === undefined) return undefined;
  const face = [/nose/i, /eye/i, /^head ref/i].map((pattern) => head.joints.filter((joint) => pattern.test(joint.name)).map((joint) => joint.id)).find((ids) => ids.length > 0) ?? [];
  const sequence = sequenceOf(model, animation);
  const length = (model.Sequences[sequence]?.Interval[1] ?? 0) - (model.Sequences[sequence]?.Interval[0] ?? 0);
  const clip = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index))
    .find((candidate) => candidate?.timeline === true && candidate.startSeconds <= elapsed && elapsed < candidate.endSeconds);
  const [start, end] = clip === undefined ? [0, length] : [Math.ceil(clip.startSeconds * 1000), Math.floor(clip.endSeconds * 1000)];
  if (end <= start) return undefined;
  const { pose } = posedAt(model, sequence, 0);
  const height = (state: Posed, id: number) => { const matrix = state.nodes[id]?.matrix; return matrix === undefined ? 0 : apply(matrix, Array.from(model.PivotPoints[id] ?? [0, 0, 0]), 1)[2]; };
  let best = Math.round(elapsed * 1000), highest = -Infinity;
  if (face.length > 0 && correction.elapsed === undefined) for (let ms = start; ms < end; ms += 10) {
    const state = pose(ms);
    const lift = face.reduce((total, id) => total + height(state, id), 0) / face.length - height(state, head.head);
    if (lift > highest + 1e-6) { highest = lift; best = ms; }
  }
  if (correction.level === true && correction.elapsed === undefined) {
    let flattest = Infinity;
    for (let ms = start; ms < end; ms += 10) { const tilt = Math.abs(heading.pitch(pose(ms)) ?? Infinity); if (tilt < flattest - 1e-6) { flattest = tilt; best = ms; } }
  }
  if (correction.elapsed !== undefined) best = Math.round(correction.elapsed * 1000);
  const tilt = heading.pitch(pose(best)) ?? 0;
  const angle = correction.angle ?? (correction.level === true ? Math.max(-MAX_MEET, Math.min(MAX_MEET, -tilt * 180 / Math.PI)) : ANGLE);
  const azimuth = heading.heading(pose(best));
  return azimuth === undefined ? undefined : { elapsed: best / 1000, yaw: FACE_AZIMUTH - azimuth + (correction.turn ?? 0) * Math.PI / 180, angle, zoom: correction.zoom ?? 1 };
}

/** A fighter's head in the 1024 px render: the centre and larger side of its projected mesh. */
interface Head { readonly x: number; readonly y: number; readonly size: number }

/**
 * The head's place and size in the 1024 px render: its mesh (headOf) posed at
 * the scene's Stand time and turn with war3-model's evaluator (the one Wisp
 * draws with). Framing the head mesh rather than the body's bounds keeps
 * weapons, wings and shoulders from pulling the crop off the face.
 */
function headBox(bytes: Uint8Array, scene: RenderScene, height: number): Head | undefined {
  const model = parseMDX(bytes.slice().buffer);
  const head = headOf(model);
  const pose = scene.effects[0];
  if (head === undefined || pose === undefined) return undefined;
  const { state } = posedAt(model, sequenceOf(model, pose.animation), Math.round(pose.animationElapsed * 1000));
  const pitch = (scene.camera.fields.CAMERA_FIELD_ANGLE_OF_ATTACK ?? 0) * Math.PI / 180, pixels = RESOLUTION / (height * 1.1);
  const xs: number[] = [], ys: number[] = [];
  for (const vertex of head.vertices) {
    if ((state.geosetAlpha[vertex.geoset] ?? 1) < 1e-6) continue;
    let local: Vector = [0, 0, 0];
    for (const [bone, weight] of vertex.weights) {
      const matrix = state.nodes[bone]?.matrix;
      if (matrix !== undefined && weight > 0) { const posed = apply(matrix, vertex.position, 1); local = [local[0] + weight * posed[0], local[1] + weight * posed[1], local[2] + weight * posed[2]]; }
    }
    const world: Vector = [(local[0] * Math.cos(pose.yaw) - local[1] * Math.sin(pose.yaw)) * pose.scale, (local[0] * Math.sin(pose.yaw) + local[1] * Math.cos(pose.yaw)) * pose.scale, local[2] * pose.scale];
    // Rotation 90: the camera's right is +x and its up is (0, -sin pitch, cos pitch).
    const across = world[0] - scene.camera.x;
    const up = -(world[1] - scene.camera.y) * Math.sin(pitch) + (world[2] - (scene.camera.fields.CAMERA_FIELD_ZOFFSET ?? 0)) * Math.cos(pitch);
    xs.push(RESOLUTION / 2 + across * pixels); ys.push(RESOLUTION / 2 - up * pixels);
  }
  if (xs.length < 8) return undefined;
  const span = (values: number[]) => { const sorted = values.sort((a, b) => a - b); return [item(sorted, Math.floor(sorted.length * 0.02)), item(sorted, Math.ceil(sorted.length * 0.98) - 1)] as const; };
  const [left, right] = span(xs), [top, bottom] = span(ys);
  return { x: (left + right) / 2, y: (top + bottom) / 2, size: Math.max(right - left, bottom - top) };
}

const run = (command: string[]) => Effect.runSync(Effect.try({
  try: () => {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString().slice(-1500));
    return result.stdout.toString();
  },
  catch: (cause) => new PortraitFailure({ problem: `${command[0]} failed: ${String(cause)}` }),
}));

/** Opaque pixels' box in a drawn frame, from the exact clear colour. */
const silhouette = (png: string) => {
  const box = run(['magick', png, '-fill', 'white', '+opaque', `rgb(${CLEAR.join(',')})`, '-fill', 'black', '-opaque', `rgb(${CLEAR.join(',')})`, '-format', '%@', 'info:']).trim().match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
  if (box === null) throw new Error(`${png}: nothing drawn`);
  return { w: Number(item(box, 1)), h: Number(item(box, 2)), x: Number(item(box, 3)), y: Number(item(box, 4)) };
};

/** Neutral for the grid tile, then each slot's outfit for its card, bust and stock icon (docs/design/fighter-portraits.md). */
const VARIANTS = [{ suffix: '', team: NEUTRAL_TEAM_COLOR }, ...PARTICIPANT_SLOTS.map((slot) => ({ suffix: `P${slot + 1}`, team: slot }))];
const frameOf = (character: number, variant: number) => character * VARIANTS.length + variant;

/** Behind every grid tile, so the tiles read as one set. */
const TILE_BACKGROUND = ['-size', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, 'radial-gradient:#3a5378-#0c1422'];
const BUST_FADE = 'min(min(1, (1 - j / h) / 0.3), min(i / (w * 0.1), (w - i) / (w * 0.1)))';
const STOCK_FADE = 'max(0, min(1, (0.5 - hypot(i / w - 0.5, j / h - 0.5)) / 0.1))';
const fadeAlpha = (mask: string) => ['(', '+clone', '-alpha', 'extract', '(', '+clone', '-fx', mask, ')', '-compose', 'multiply', '-composite', ')', '-compose', 'CopyOpacity', '-composite'];
/**
 * Definitive's physically lit bodies fall mostly into shadow under the match's
 * side light; a gamma lift brings them to the Classic set's brightness.
 */
const DEFINITIVE_LIFT = ['-gamma', '1.4'];
const TGA = ['-depth', '8', '-compress', 'none'];

/**
 * The tile, card, bust and stock crops of one 1024 px render (docs/design/fighter-portraits.md):
 * tiles and busts frame head and shoulders around the head mesh (headBox), stock
 * icons the head alone; without a head, the silhouette's top sixth stands in.
 */
function crops(raw: string, directory: string, name: string, suffix: string, kinds: readonly PortraitKind[], found: Head | undefined, zoom: number): void {
  const box = run(['magick', raw, '-alpha', 'extract', '-threshold', '10%', '-format', '%@', 'info:']).trim();
  const bounds = box.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
  if (bounds === null) throw new Error(`${raw}: nothing drawn`);
  const w = Number(item(bounds, 1)), h = Number(item(bounds, 2)), x = Number(item(bounds, 3)), y = Number(item(bounds, 4));
  const band = run(['magick', raw, '-alpha', 'extract', '-threshold', '10%', '-crop', `${RESOLUTION}x${Math.max(1, Math.round(h / 10))}+0+${y}`, '+repage', '-format', '%@', 'info:']).trim().match(/(\d+)x\d+\+(\d+)\+/);
  const head = found ?? { x: band === null ? x + w / 2 : Number(band[2]) + Number(band[1]) / 2, y: y + h / 12, size: h / 6 };
  const window = (side: number, above: number) => {
    const size = Math.round(Math.max(64, Math.min(RESOLUTION, side)));
    return { size, left: Math.max(0, Math.min(RESOLUTION - size, Math.round(head.x - size / 2))), top: Math.max(0, Math.min(RESOLUTION - size, Math.round(head.y - size * above))) };
  };
  const bust = window(2.6 * head.size / zoom, 0.42), portrait = `${bust.size}x${bust.size}+${bust.left}+${bust.top}`;
  const file = (kind: PortraitKind) => join(directory, `Fighter${kind}${name}${suffix}.tga`);
  if (kinds.includes('Card')) {
    const inner = Math.round(CARD_TEXTURE_PX * 0.94);
    run(['magick', raw, '-crop', box, '+repage', '-resize', `${inner}x${inner}`, '-background', 'none', '-gravity', 'center', '-extent', `${CARD_TEXTURE_PX}x${CARD_TEXTURE_PX}`, ...TGA, file('Card')]);
  }
  if (kinds.includes('Tile')) run(['magick', ...TILE_BACKGROUND, '(', raw, '-crop', portrait, '+repage', '-resize', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, ')', '-composite', '-alpha', 'off', ...TGA, file('Tile')]);
  if (kinds.includes('Bust')) run(['magick', raw, '-crop', portrait, '+repage', '-resize', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, ...fadeAlpha(BUST_FADE), ...TGA, file('Bust')]);
  if (kinds.includes('Stock')) {
    const stock = window(1.5 * head.size / zoom, 0.5);
    run(['magick', raw, '-crop', `${stock.size}x${stock.size}+${stock.left}+${stock.top}`, '+repage', '-resize', `${STOCK_ICON_PX}x${STOCK_ICON_PX}`, ...fadeAlpha(STOCK_FADE), ...TGA, file('Stock')]);
  }
}

await Effect.runPromise(Effect.gen(function*() {
  const stored = assetsView(yield* readManifest());
  // The renderer reads every map import, the Definitive portraits included, before
  // they exist: a private overlay of the inputs stands the stored portraits in for them.
  const assets = join(output, 'inputs');
  rmSync(assets, { recursive: true, force: true });
  mkdirSync(join(assets, 'fighter-renders'), { recursive: true });
  for (const family of readdirSync(stored)) if (family !== 'fighter-renders') symlinkSync(join(stored, family), join(assets, family));
  for (const file of readdirSync(join(stored, 'fighter-renders'))) if (file !== 'de') symlinkSync(join(stored, 'fighter-renders', file), join(assets, 'fighter-renders', file));
  symlinkSync(join(stored, 'fighter-renders', 'de'), join(assets, 'fighter-renders', 'de'));
  const captured = new Map<number, RenderScene>();
  for (const character of fighters) {
    const name = fighterName(character);
    const session = yield* Effect.tryPromise({ try: () => createStandaloneSession({ presentation: 'pool-confirmed', script: `#! chat -dev quick pair ${name} / ${name}` }), catch: (cause) => new PortraitFailure({ problem: `${name}: match setup failed: ${String(cause)}` }) });
    try {
      for (let frame = 0; frame < 90; frame++) session.step(NEUTRAL_INPUT);
      captured.set(character, captureScene(session.client, { visibleOnly: true }));
    } finally { session.close(); }
  }
  const stock = headlessRender({ assets });
  const bodies = new Map([...captured].map(([character, scene]) => [at(portraitScene(scene, character, { x: 0, z: 0, height: 1 }, 0).effects, 0).model.toLowerCase(), character]));
  const project = { ...stock, width: DRAWN, height: DRAWN,
    resolveAsset: async (...args: Parameters<typeof stock.resolveAsset>) => {
      if (args[0] === PORTRAIT_LIGHT) return { requested: PORTRAIT_LIGHT, graphics: args[1] ?? 'classic', attempts: [], selected: { source: 'project' as const, layer: 'base' as const, path: PORTRAIT_LIGHT }, bytes: new TextEncoder().encode(portraitLightMdl()) };
      const resolved = await stock.resolveAsset(...args);
      const body = bodies.get(args[0].toLowerCase());
      if (body === undefined || resolved.bytes === undefined) return resolved;
      const posed = args[1] === 'classic' && CLASSIC_REST_POSE.includes(body) ? restPose(resolved.bytes) : resolved.bytes;
      return { ...resolved, bytes: withoutGlow(posed) };
    } };
  const wide0 = { x: 0, z: 120, height: 700 };
  for (const graphics of graphicsModes) {
    const directory = join(output, graphics);
    const poses = new Map<number, Portrait>();
    for (const character of fighters) {
      const body = at(portraitScene(required(captured.get(character), 'scene'), character, wide0, 0).effects, 0);
      const bytes = (yield* Effect.promise(() => project.resolveAsset(body.model, graphics))).bytes;
      const correction = CORRECTIONS[graphics][fighterRenderName(character)] ?? {};
      const found = bytes === undefined ? undefined : portraitPose(bytes, character, body.animation, body.animationElapsed, correction);
      const pose = found ?? { elapsed: correction.elapsed ?? body.animationElapsed, yaw: FACE_AZIMUTH + (correction.turn ?? 0) * Math.PI / 180, angle: correction.angle ?? ANGLE, zoom: correction.zoom ?? 1 };
      poses.set(character, pose);
      const degrees = (angle: number) => (angle * 180 / Math.PI).toFixed(1);
      console.log(`${graphics} ${fighterRenderName(character)}: ${found === undefined ? 'no head geometry, ' : ''}Stand at ${pose.elapsed} s, yaw ${degrees(pose.yaw)}, angle ${pose.angle}, zoom ${pose.zoom}`);
    }
    // A first wide view finds each fighter; the second fits its silhouette.
    const wide = wide0;
    const first = yield* renderScenes(project, fighters.map((character) => portraitScene(required(captured.get(character), 'scene'), character, wide, 0, poses.get(character))), join(directory, 'wide'), graphics);
    const heights = new Map<number, number>();
    const fitted = first.flatMap(({ frame: drawn, image }) => {
      const character = Math.floor(drawn / VARIANTS.length);
      const box = silhouette(join(directory, 'wide', image));
      const scale = wide.height * 1.1 / DRAWN;
      const across = (box.x + box.w / 2 - DRAWN / 2) * scale, up = (DRAWN / 2 - (box.y + box.h / 2)) * scale;
      const height = Math.max(box.w, box.h) * scale;
      // Image right is the camera's right; screen up is close to world up at this shallow angle.
      const frame = { x: across, z: wide.z + up / Math.cos(required(poses.get(character), 'pose').angle * Math.PI / 180), height };
      heights.set(character, height);
      return VARIANTS.map((_, variant) => portraitScene(required(captured.get(character), 'scene'), character, frame, variant, poses.get(character)));
    });
    const scenes = new Map(fitted.map((scene) => [scene.frame, scene]));
    const images = yield* renderScenes(project, fitted, join(directory, 'fitted'), graphics);
    const portraits = join(output, 'fighter-renders', ...(graphics === 'definitive' ? ['de'] : []));
    mkdirSync(portraits, { recursive: true });
    for (const { frame, image } of images) {
      const character = Math.floor(frame / VARIANTS.length), variant = frame % VARIANTS.length;
      const name = fighterRenderName(character), suffix = at(VARIANTS, variant).suffix;
      const raw = join(directory, `${name}${suffix}.png`);
      run(['magick', join(directory, 'fitted', image), '(', '+clone', '-fill', 'white', '+opaque', `rgb(${CLEAR.join(',')})`, '-fill', 'black', '-opaque', `rgb(${CLEAR.join(',')})`, ')', '-alpha', 'off', ...(graphics === 'definitive' ? DEFINITIVE_LIFT : []), '-compose', 'CopyOpacity', '-composite', '-resize', `${RESOLUTION}x${RESOLUTION}`, `PNG32:${raw}.tmp`]);
      renameSync(`${raw}.tmp`, raw);
      // The grid keeps the neutral tile; the slot outfits carry every kind (MAP_PORTRAITS).
      const scene = required(scenes.get(frame), 'scene'), body = at(scene.effects, 0);
      const bytes = (yield* Effect.promise(() => project.resolveAsset(body.model, graphics))).bytes;
      crops(raw, portraits, name, suffix, variant === 0 ? ['Tile'] : PORTRAIT_KINDS, bytes === undefined ? undefined : headBox(bytes, scene, required(heights.get(character), 'height')), required(poses.get(character), 'pose').zoom);
      console.log(`${graphics} ${name}${suffix}: ${raw}`);
    }
  }
}));
