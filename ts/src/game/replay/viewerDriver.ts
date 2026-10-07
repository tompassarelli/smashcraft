// The replay viewer as the client runs it inside a map's own simulation
// (smashcraft:client/src-tauri/src/mapsim.rs): the client loads a map's
// war3map.lua in 32-bit Lua, adds this module and viewer.ts to its modules,
// and calls these functions with text, getting JSON text back. So a replay
// plays on the simulation of the map that recorded it, whichever version the
// client itself is.
import { type ReplayScene, type ReplayViewer, openReplay } from "./viewer";

let viewer: ReplayViewer | undefined;

const number = (value: number) => (value === value && value * 0.5 !== value ? `${value}` : "0");

function capsuleJson(c: { readonly x1: number; readonly z1: number; readonly x2: number; readonly z2: number; readonly radius: number }, state?: number): string {
  const fields = [`"x1":${number(c.x1)}`, `"z1":${number(c.z1)}`, `"x2":${number(c.x2)}`, `"z2":${number(c.z2)}`, `"radius":${number(c.radius)}`];
  if (state !== undefined) fields.push(`"state":${state}`);
  return `{${fields.join(",")}}`;
}

/** A scene as JSON text, the shape viewer.ts's ReplayScene has in the client. */
export function sceneJson(scene: Readonly<ReplayScene>): string {
  const surfaces = scene.surfaces.map((s) => `{"left":${number(s.left)},"right":${number(s.right)},"z":${number(s.z)}}`);
  const { left, right, bottom, top } = scene.blast;
  const fighters = scene.fighters.map((f) => [
    `{"slot":${f.slot}`, `"character":${f.character}`, `"x":${number(f.x)}`, `"z":${number(f.z)}`, `"facing":${number(f.facing)}`,
    `"damage":${number(f.damage)}`, `"stocks":${f.stocks}`, `"out":${f.out ? "true" : "false"}`,
    `"parts":[${f.parts.map((p) => capsuleJson(p, p.state)).join(",")}]`,
    `"strikes":[${f.strikes.map((s) => capsuleJson(s)).join(",")}]`,
    `"projectiles":[${f.projectiles.map((p) => `{"x":${number(p.x)},"z":${number(p.z)}}`).join(",")}]}`,
  ].join(","));
  return `{"frame":${scene.frame},"stage":${scene.stage},"surfaces":[${surfaces.join(",")}],"blast":{"left":${number(left)},"right":${number(right)},"bottom":${number(bottom)},"top":${number(top)}},"fighters":[${fighters.join(",")}]}`;
}

const quoted = (text: string) => `"${text.split("\\").join("\\\\").split("\"").join("\\\"")}"`;

/** Opens a joined replay's text: {"first","last","frame"} or {"problem"}. */
export function open(text: string): string {
  const opened = openReplay(text.split("\n").filter((line) => line.length > 0));
  if (typeof opened === "string") {
    viewer = undefined;
    return `{"problem":${quoted(opened)}}`;
  }
  viewer = opened;
  return `{"first":${opened.first},"last":${opened.last},"frame":${opened.frame}}`;
}

/** Runs up to `frames` frames: {"frame","ended","scene"}. */
export function advance(frames: number): string {
  const shown = viewer;
  if (shown === undefined) return `{"problem":"no replay is open"}`;
  let ended = false;
  for (let step = 0; step < frames && !ended; step++) ended = !shown.step();
  return `{"frame":${shown.frame},"ended":${ended || shown.frame >= shown.last ? "true" : "false"},"scene":${sceneJson(shown.scene())}}`;
}

/** Shows the state after `frame`: {"frame","ended","scene"}. */
export function seek(frame: number): string {
  const shown = viewer;
  if (shown === undefined) return `{"problem":"no replay is open"}`;
  shown.seek(frame);
  return advance(0);
}
