import type { StageLight } from "../../ts/src/game/assets/stageLighting";
import type { DeckPalette } from "../../ts/src/game/assets/stagePalette";
import { moodColor, type SceneryPiece, type StageScenery } from "../../ts/src/game/presentation/stageScenery";
import { deckProblems, fogProblems, intensityProblems, lightProblems, mirrorProblems } from "../../ts/src/game/presentation/stageRules";
import { behindProblems, floatingProblems, worldProblems } from "../../ts/scripts/stageViewRules";

type Rgb = readonly [number, number, number];
type Fog = NonNullable<StageScenery["fog"]>;

export interface PieceAxes { readonly x?: readonly number[]; readonly y?: readonly number[]; readonly z?: readonly number[]; readonly scale?: readonly number[] }

export interface SearchSpec {
  readonly fogStart?: readonly number[];
  readonly fogEnd?: readonly number[];
  readonly fogColor?: readonly Rgb[];
  readonly tint?: readonly Rgb[];
  readonly tintScale?: readonly number[];
  readonly depth?: readonly number[];
  readonly scale?: readonly number[];
  readonly lightKey?: readonly Rgb[];
  readonly lightAmbient?: readonly Rgb[];
  readonly lightIntensity?: readonly number[];
  readonly pieces?: Readonly<Record<string, PieceAxes>>;
  readonly modes?: readonly ("classic" | "definitive")[];
  readonly clients?: readonly number[];
  readonly finalists?: number;
}

export type Setting = readonly [axis: string, value: number | Rgb];

export interface Candidate {
  readonly index: number;
  readonly settings: readonly Setting[];
  readonly changes: number;
  readonly scenery: StageScenery;
  readonly light: StageLight;
}

export interface Stage {
  readonly id: number;
  readonly name: string;
  readonly scenery: StageScenery;
  readonly light: StageLight;
  readonly palette: DeckPalette;
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
}

const axes = (spec: SearchSpec): readonly (readonly Setting[])[] => {
  const global = (["fogStart", "fogEnd", "fogColor", "tint", "tintScale", "depth", "scale", "lightKey", "lightAmbient", "lightIntensity"] as const)
    .flatMap(axis => spec[axis] === undefined ? [] : [(spec[axis] as readonly (number | Rgb)[]).map(value => [axis, value] as Setting)]);
  const pieces = Object.entries(spec.pieces ?? {}).flatMap(([index, piece]) => (["x", "y", "z", "scale"] as const)
    .flatMap(axis => piece[axis] === undefined ? [] : [(piece[axis] as readonly (number | Rgb)[]).map(value => [`piece${index}.${axis}`, value] as Setting)]));
  return [...global, ...pieces];
};

const product = (lists: readonly (readonly Setting[])[]): readonly (readonly Setting[])[] =>
  lists.reduce<readonly (readonly Setting[])[]>((rows, list) => rows.flatMap(row => list.map(setting => [...row, setting])), [[]]);

const scaled = (color: Rgb, by: number): Rgb => [Math.min(255, Math.round(color[0] * by)), Math.min(255, Math.round(color[1] * by)), Math.min(255, Math.round(color[2] * by))];

function applySettings(stage: Stage, settings: readonly Setting[]): { readonly scenery: StageScenery; readonly light: StageLight } {
  const value = (axis: string) => settings.find(([name]) => name === axis)?.[1];
  const number = (axis: string, fallback: number) => { const v = value(axis); return typeof v === "number" ? v : fallback; };
  const rgb = (axis: string): Rgb | undefined => { const v = value(axis); return typeof v === "number" ? undefined : v; };
  const base = stage.scenery;
  const fog: Fog | undefined = base.fog === undefined ? undefined : (() => {
    const color = rgb("fogColor");
    return { ...base.fog, start: number("fogStart", base.fog.start), end: number("fogEnd", base.fog.end), ...(color === undefined ? {} : { red: color[0], green: color[1], blue: color[2] }) };
  })();
  const heightFog = base.heightFog === undefined || fog === undefined ? base.heightFog : { ...base.heightFog, start: fog.start, end: fog.end };
  const tintScale = number("tintScale", 1);
  const chosen = rgb("tint") ?? base.tint;
  const tint = chosen === undefined || tintScale === 1 ? chosen : scaled(chosen, tintScale);
  const pieces = base.pieces.map((piece, index): SceneryPiece => {
    const own = (axis: string) => `piece${index}.${axis}`;
    const color = tint === undefined && tintScale !== 1 ? scaled(piece.color ?? [255, 255, 255], tintScale) : piece.color;
    return {
      ...piece,
      x: number(own("x"), piece.x),
      y: number(own("y"), piece.y + number("depth", 0)),
      z: number(own("z"), piece.z),
      scale: number(own("scale"), piece.scale * number("scale", 1)),
      ...(color === undefined ? {} : { color }),
    };
  });
  const light: StageLight = { key: rgb("lightKey") ?? stage.light.key, ambient: rgb("lightAmbient") ?? stage.light.ambient, intensity: number("lightIntensity", stage.light.intensity ?? 1) };
  return { scenery: { ...base, ...(fog === undefined ? {} : { fog }), ...(heightFog === undefined ? {} : { heightFog }), pieces, ...(tint === undefined ? {} : { tint }) }, light };
}

export function candidates(stage: Stage, spec: SearchSpec): readonly Candidate[] {
  const base = JSON.stringify(applySettings(stage, []));
  return product(axes(spec)).map((settings, index) => ({
    index, settings, ...applySettings(stage, settings),
    changes: settings.filter(setting => JSON.stringify(applySettings(stage, [setting])) !== base).length,
  }));
}

export function candidateProblems(stage: Stage, { scenery, light }: Candidate): readonly string[] {
  return [
    ...fogProblems(stage.name, scenery),
    ...deckProblems(stage.name, stage.palette, scenery.fog),
    ...worldProblems(stage.name, stage.origin, scenery.pieces),
    ...floatingProblems(stage.id, stage.name, scenery.pieces),
    ...mirrorProblems(stage.name, scenery.pieces),
    ...behindProblems(stage.id, stage.name, scenery),
    ...lightProblems(stage.name, light),
    ...intensityProblems(stage.name, stage.id, light),
  ];
}

interface Pose { readonly model: string; readonly x: number; readonly y: number; readonly z: number }

export function stageOrigin(effects: readonly Pose[], pieces: readonly SceneryPiece[]): Stage["origin"] {
  const first = pieces[0];
  if (first === undefined) throw new Error("the stage has no scenery pieces to search");
  for (const effect of effects.filter(pose => pose.model === first.model)) {
    const origin = { x: effect.x - first.x, y: effect.y - first.y, z: effect.z - first.z };
    if (pieceEffects(effects, pieces, origin) !== undefined) return origin;
  }
  throw new Error("the captured scene does not show the stage's scenery");
}

export function pieceEffects(effects: readonly Pose[], pieces: readonly SceneryPiece[], origin: Stage["origin"]): readonly number[] | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const used = new Set<number>();
  const indices: number[] = [];
  for (const piece of pieces) {
    const index = effects.findIndex((effect, at) => !used.has(at) && effect.model === piece.model && near(effect.x, origin.x + piece.x) && near(effect.y, origin.y + piece.y) && near(effect.z, origin.z + piece.z));
    if (index < 0) return undefined;
    used.add(index);
    indices.push(index);
  }
  return indices;
}

interface ScenePose extends Pose { readonly scale: number; readonly yaw: number; readonly color: readonly number[]; readonly matrixScale: readonly number[] }
interface Scene<E extends ScenePose> { readonly frame: number; readonly effects: readonly E[]; readonly environment: { readonly fog?: { readonly zStart: number; readonly zEnd: number; readonly color: readonly [number, number, number] } } }

export function withFog<S extends Scene<ScenePose>>(scene: S, fog: Fog | undefined): S {
  const drawn = scene.environment.fog;
  if (drawn === undefined || fog === undefined) return scene;
  return { ...scene, environment: { ...scene.environment, fog: { ...drawn, zStart: fog.start, zEnd: fog.end, color: [fog.red, fog.green, fog.blue] } } };
}

export function candidateScene<E extends ScenePose, S extends Scene<E>>(scene: S, indices: readonly number[], origin: Stage["origin"], candidate: Candidate, frame: number): S {
  const effects = [...scene.effects];
  candidate.scenery.pieces.forEach((piece, at) => {
    const index = indices[at]!;
    const color = moodColor(candidate.light, candidate.scenery.tint ?? piece.color ?? [255, 255, 255]);
    effects[index] = { ...effects[index]!, x: origin.x + piece.x, y: origin.y + piece.y, z: origin.z + piece.z, scale: piece.scale, color: [color[0], color[1], color[2]] };
  });
  return withFog({ ...scene, frame, effects }, candidate.scenery.fog);
}

export const fogKey = (fog: Fog | undefined) => fog === undefined ? "none" : `${fog.start}/${fog.end}/${fog.red}/${fog.green}/${fog.blue}`;

export interface Measured { readonly candidate: Candidate; readonly problems: readonly string[]; readonly empty: Readonly<Record<string, number>> }

export function ranked(rows: readonly Measured[]): readonly Measured[] {
  const worst = (row: Measured) => Math.max(...Object.values(row.empty));
  const changed = (row: Measured) => row.candidate.changes;
  return [...rows].filter(row => row.problems.length === 0).sort((a, b) => worst(a) - worst(b) || changed(a) - changed(b) || a.candidate.index - b.candidate.index);
}

const show = (value: number | Rgb) => typeof value === "number" ? `${value}` : `[${value.join(",")}]`;
export const settingText = (settings: readonly Setting[]) => settings.map(([axis, value]) => `${axis}=${show(value)}`).join(" ") || "baseline";

export function table(rows: readonly Measured[], views: readonly string[]): string {
  const lines = [["rank", "candidate", ...views.map(view => `${view} empty%`), "worst", "settings"].join("\t")];
  ranked(rows).forEach((row, rank) => lines.push([rank + 1, row.candidate.index, ...views.map(view => (row.empty[view] ?? NaN).toFixed(2)), Math.max(...Object.values(row.empty)).toFixed(2), settingText(row.candidate.settings)].join("\t")));
  return lines.join("\n");
}

export function literal(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  const text = Number.isInteger(rounded) ? `${rounded}.0` : `${rounded}`;
  return Math.fround(rounded) === rounded ? text : `f32(${text})`;
}

const rgbText = (color: Rgb) => `[${color.map(channel => Math.round(channel)).join(", ")}]`;

export function emit({ scenery, light }: Candidate): { readonly scenery: string; readonly light: string } {
  const fog = scenery.fog === undefined ? "" : `  fog: { start: ${literal(scenery.fog.start)}, end: ${literal(scenery.fog.end)}, red: ${literal(scenery.fog.red)}, green: ${literal(scenery.fog.green)}, blue: ${literal(scenery.fog.blue)} },\n`;
  const pieces = scenery.pieces.map(piece => `    { model: ${JSON.stringify(piece.model)}, x: ${literal(piece.x)}, y: ${literal(piece.y)}, z: ${literal(piece.z)}, scale: ${literal(piece.scale)}, yaw: ${literal(piece.yaw)}${piece.matrixScale === undefined ? "" : `, matrixScale: [${piece.matrixScale.map(literal).join(", ")}]`}${piece.color === undefined ? "" : `, color: ${rgbText(piece.color)}`} },`).join("\n");
  const tint = scenery.tint === undefined ? "" : `  tint: ${rgbText(scenery.tint)},\n`;
  return {
    scenery: `${fog}${tint}  pieces: [\n${pieces}\n  ],`,
    light: `light: { key: ${rgbText(light.key)}, ambient: ${rgbText(light.ambient)}${light.intensity === undefined ? "" : `, intensity: ${literal(light.intensity)}`} }`,
  };
}
