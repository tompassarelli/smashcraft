import { $ } from "bun";
import { decodePpm, type Frame } from "../../ts/node_modules/wisp/scripts/wisp/frameProbe";

async function load(path: string): Promise<Frame> {
  const native = decodePpm(await Bun.file(path).bytes());
  const frame = native ?? decodePpm(new Uint8Array(await $`magick ${path} -alpha off -depth 8 ppm:-`.arrayBuffer()));
  if (frame === undefined || frame.width <= 0 || frame.height <= 0 || frame.rgb.length !== frame.width * frame.height * 3) throw new Error(`${path}: malformed RGB image`);
  return frame;
}

const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
type Lab = [number, number, number];
function lab(r: number, g: number, b: number): Lab {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function de2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const d = Math.PI / 180;
  const hue = (a: number, b: number) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / d; return h < 0 ? h + 360 : h; };
  const cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)));
  const [p1, p2] = [(1 + g) * a1, (1 + g) * a2];
  const [c1, c2] = [Math.hypot(p1, b1), Math.hypot(p2, b2)];
  const [h1, h2] = [hue(p1, b1), hue(p2, b2)];
  let dh = c1 * c2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh * d / 2);
  const lM = (l1 + l2) / 2, cM = (c1 + c2) / 2;
  const hM = c1 * c2 === 0 ? h1 + h2 : Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const t = 1 - 0.17 * Math.cos((hM - 30) * d) + 0.24 * Math.cos(2 * hM * d) + 0.32 * Math.cos((3 * hM + 6) * d) - 0.2 * Math.cos((4 * hM - 63) * d);
  const sl = 1 + 0.015 * (lM - 50) ** 2 / Math.sqrt(20 + (lM - 50) ** 2), sc = 1 + 0.045 * cM, sh = 1 + 0.015 * cM * t;
  const rt = -2 * Math.sqrt(cM ** 7 / (cM ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hM - 275) / 25) ** 2)) * d);
  const [dl, dc, dhs] = [(l2 - l1) / sl, (c2 - c1) / sc, dH / sh];
  return Math.sqrt(dl * dl + dc * dc + dhs * dhs + rt * dc * dhs);
}

export interface ContrastRow { readonly frame: string; readonly fighterL: number; readonly ringL: number; readonly absDL: number; readonly dE00: number; readonly frameL: number; readonly localDL: number }

export async function measure(maskPath: string, frames: readonly string[]): Promise<{ readonly summary: string; readonly rows: readonly ContrastRow[] }> {
  const mask = await load(maskPath);
  const { width, height } = mask;
  const counts = new Map<number, number>();
  for (let i = 0; i < width * height; i++) { const k = (mask.rgb[i * 3]! >> 3 << 10) | (mask.rgb[i * 3 + 1]! >> 3 << 5) | (mask.rgb[i * 3 + 2]! >> 3); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const empty = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const er = (empty >> 10) * 8 + 4, eg = ((empty >> 5) & 31) * 8 + 4, eb = (empty & 31) * 8 + 4;
  const on = new Uint8Array(width * height);
  for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.76); y++) for (let x = 0; x < width; x++) {
    const i = y * width + x; const [r, g, b] = [mask.rgb[i * 3]!, mask.rgb[i * 3 + 1]!, mask.rgb[i * 3 + 2]!];
    if (Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb) > 40) on[i] = 1;
  }
  const label = new Int32Array(width * height).fill(-1); const sizes: number[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || label[i] !== -1) continue;
    const id = sizes.length; let size = 0; const stack = [i]; label[i] = id;
    while (stack.length) { const p = stack.pop()!; size++; const px = p % width, py = (p - px) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue; const n = ny * width + nx; if (on[n] && label[n] === -1) { label[n] = id; stack.push(n); } } }
    sizes.push(size);
  }
  if (sizes.length === 0) throw new Error(`${maskPath}: no fighter silhouette found`);
  const minimum = Math.max(...sizes) * 0.25;
  const fighter = new Uint8Array(width * height);
  for (let i = 0; i < on.length; i++) if (label[i]! >= 0 && sizes[label[i]!]! >= minimum) fighter[i] = 1;
  const dilate = (src: Uint8Array, r: number) => { const out = new Uint8Array(src.length); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { if (!src[y * width + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1; } } return out; };
  const inner = dilate(fighter, 4), outer = dilate(fighter, 18);
  let fighterCount = 0; for (const v of fighter) fighterCount += v;
  const rows: ContrastRow[] = [];
  for (const path of frames) {
    const image = await load(path);
    if (image.width !== width || image.height !== height) throw new Error(`${path}: mask and frame dimensions differ`);
    const sum = (sel: (i: number) => boolean) => { let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < width * height; i++) if (sel(i)) { r += image.rgb[i * 3]!; g += image.rgb[i * 3 + 1]!; b += image.rgb[i * 3 + 2]!; n++; } return lab(r / n, g / n, b / n); };
    const f = sum(i => fighter[i] === 1), ring = sum(i => outer[i] === 1 && inner[i] === 0), all = sum(() => true);
    let local = 0; for (let i = 0; i < width * height; i++) if (fighter[i]) local += Math.abs(lab(image.rgb[i * 3]!, image.rgb[i * 3 + 1]!, image.rgb[i * 3 + 2]!)[0] - ring[0]);
    rows.push({ frame: path.split("/").pop() ?? path, fighterL: f[0], ringL: ring[0], absDL: Math.abs(f[0] - ring[0]), dE00: de2000(f, ring), frameL: all[0], localDL: local / fighterCount });
  }
  return { summary: `mask ${maskPath}: empty rgb(${er},${eg},${eb}), fighters ${fighterCount} px in ${sizes.filter(s => s >= minimum).length} blobs`, rows };
}

const STOCK_LIGHT = { terrain: "Environment\\DNC\\DNCLordaeron\\DNCLordaeronTerrain\\DNCLordaeronTerrain.mdl", unit: "Environment\\DNC\\DNCLordaeron\\DNCLordaeronUnit\\DNCLordaeronUnit.mdl" };
const LOOK = ["day-night-light", "fog", "height-fog-falloff", "sky", "shadows", "point-lights", "pbr", "point-light-shadows", "ambient-occlusion", "bloom"] as const;
const HORIZON = 1 / 3;
const MINIMAL_STAGES = new Set([0, 2]);

async function stockLightCheck(args: readonly string[]): Promise<number> {
  const half = args.includes("--half");
  const rest = args.filter(arg => arg !== "--half");
  const out = rest[0] === "--out" ? rest[1] ?? "" : `${process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`}/smashcraft/stock-light`;
  const named = (rest[0] === "--out" ? rest.slice(2) : rest).map(Number);
  const scale = half ? 2 : 1;
  const { Effect } = await import("../../ts/node_modules/effect/dist/index.js");
  const { installHeadless } = await import("../../ts/node_modules/wisp/scripts/wisp/headless");
  const { captureScene, renderScenes } = await import("../../ts/node_modules/wisp/scripts/wisp/headlessRender");
  const { SMASHCRAFT_HEADLESS } = await import("../../ts/scripts/wisp/headless");
  const { headlessRender } = await import("../../ts/scripts/wisp/headlessRender");
  const { start, install } = await import("../../ts/src/platform/devMain");
  const { stageModels } = await import("../../ts/src/game/presentation/stagePreload");
  const { placedPieces } = await import("../../ts/src/game/presentation/stageScenery");
  const { STAGE_CATALOG } = await import("../../ts/src/game/menu/stageCatalog");
  const stages = named.length > 0 ? named : STAGE_CATALOG.map(({ id }) => id);
  const unknown = stages.filter(stage => !STAGE_CATALOG.some(({ id }) => id === stage));
  if (unknown.length > 0) throw new Error(`not a stage id: ${unknown.join(" ")}; stages are ${STAGE_CATALOG.map(({ id }) => id).join(" ")}`);
  const normalize = (path: string) => path.replaceAll("\\", "/").toLowerCase();
  const key = (model: string, color: readonly number[] | undefined) => `${normalize(model)}|${(color ?? []).slice(0, 3).join(",")}`;
  console.log("stage\tmode\tclient\tview\tfighter L* stock light>stage\t|dL| stock>stage\tdE00 stock>stage\tcontrast\tempty% stock>stage\tL*");
  let failed = 0, empty = 0;
  const { emptyBackdropShare, EMPTY_BACKDROP_LIMIT } = await import("./layout");
  for (const stage of stages) {
    const runtime = installHeadless(SMASHCRAFT_HEADLESS);
    const clients = runtime.clients({ start, install });
    clients.start(); clients.frames(20); clients.chat(0, "-dev items off"); clients.frames(10); clients.chat(0, `-dev quick stage ${stage}`); clients.frames(15);
    for (const client of clients.clients) clients.chat(client.slot, "-dev view near");
    clients.frames(65);
    const scenes = clients.clients.map(client => captureScene(client));
    clients.frames(245);
    for (const client of clients.clients) clients.chat(client.slot, "-dev view far");
    clients.frames(55);
    scenes.push(...clients.clients.map(client => captureScene(client)));
    const errors = clients.clients.flatMap(client => client.errors);
    runtime.restore();
    if (errors.length > 0) throw new Error(`stage ${stage}: ${errors.join("\n")}`);
    const own = new Set(stageModels(stage).map(normalize));
    const stock = new Map<string, readonly number[]>();
    const moody = placedPieces(stage, true), plain = placedPieces(stage, false);
    moody.forEach((piece, index) => { const base = plain[index]?.color; if (base !== undefined) stock.set(key(piece.model, piece.color), base); });
    for (const mode of ["classic", "definitive"] as const) for (const client of [0, 1]) {
      const directory = `${out}/${stage}-${mode}-p${client}`;
      const captures = scenes.filter(scene => scene.client === client).flatMap(scene => {
        const common = { ...scene, ui: [], textTags: [], filter: undefined };
        return [
          common,
          { ...common, frame: scene.frame + 1000, effects: [], units: [] },
          { ...common, frame: scene.frame + 2000, effects: scene.effects.filter(effect => !own.has(normalize(effect.model))), environment: { ...common.environment, skyVisible: false, fog: undefined } },
          { ...common, frame: scene.frame + 3000, effects: scene.effects.map(effect => { const color = stock.get(key(effect.model, effect.color)); return color === undefined ? effect : { ...effect, color: [color[0], color[1], color[2]] }; }), environment: { ...common.environment, dayNight: STOCK_LIGHT } },
          { ...common, frame: scene.frame + 4000, environment: { ...common.environment, dayNight: STOCK_LIGHT } },
        ];
      });
      const undrawn = await Effect.runPromise(renderScenes({ ...headlessRender(), width: 1280 / scale, height: (client === 0 ? 720 : 540) / scale }, captures, directory, mode, LOOK)).then(() => "", async (failure: unknown) => {
        const drawn = await Promise.all(captures.map(scene => Bun.file(`${directory}/p${client}-frame-${scene.frame}.png`).exists()));
        if (drawn.includes(false) || !String(failure).includes("undrawn")) throw failure;
        return [...new Set(String(failure).match(/undrawn [^\n]*/g) ?? [])].join("; ");
      });
      for (const scene of scenes.filter(entry => entry.client === client)) {
        const frame = (offset: number) => `${directory}/p${client}-frame-${scene.frame + offset}.png`;
        const { rows: [atStock, atStage, stockLit] } = await measure(frame(2000), [frame(3000), frame(0), frame(4000)]);
        if (atStock === undefined || atStage === undefined || stockLit === undefined) throw new Error(`${directory}: missing contrast rows`);
        const emptyStock = await emptyBackdropShare(frame(1000), frame(3000), HORIZON), emptyStage = await emptyBackdropShare(frame(1000), frame(0), HORIZON);
        const darker = Number(atStage.fighterL.toFixed(1)) < Number(stockLit.fighterL.toFixed(1));
        const holds = Number(atStage.absDL.toFixed(1)) >= Number(atStock.absDL.toFixed(1)) && Number(atStage.dE00.toFixed(1)) >= Number(atStock.dE00.toFixed(1));
        const overfull = !MINIMAL_STAGES.has(stage) && Number(emptyStage.toFixed(2)) > EMPTY_BACKDROP_LIMIT;
        if (darker) failed++;
        if (overfull) empty++;
        const view = scene === scenes.find(entry => entry.client === client) ? "near" : "far";
        console.log(`${stage}\t${mode}\t${client}\t${view}\t${stockLit.fighterL.toFixed(1)}>${atStage.fighterL.toFixed(1)}\t${atStock.absDL.toFixed(1)}>${atStage.absDL.toFixed(1)}\t${atStock.dE00.toFixed(1)}>${atStage.dE00.toFixed(1)}\t${holds ? "holds" : "falls"}\t${emptyStock.toFixed(2)}>${emptyStage.toFixed(2)}${MINIMAL_STAGES.has(stage) ? " minimal" : overfull ? " FAIL" : ""}\t${darker ? "FAIL" : "pass"}${undrawn === "" ? "" : `\t${undrawn}`}`);
      }
    }
  }
  console.log(failed === 0 ? "PASS: no stage draws its fighters darker than the stock light" : `FAIL: ${failed} views draw fighters darker than the stock light`);
  console.log(empty === 0 ? `PASS: every full stage keeps its empty backdrop within ${EMPTY_BACKDROP_LIMIT}%` : `FAIL: ${empty} views of full stages show more than ${EMPTY_BACKDROP_LIMIT}% empty backdrop`);
  return failed === 0 && empty === 0 ? 0 : 1;
}

if (import.meta.main) {
  const [first, ...rest] = Bun.argv.slice(2);
  if (first === "--stock-light") process.exit(await stockLightCheck(rest));
  if (first === undefined || rest.length === 0) throw new Error("usage: bun tools/stage/contrast.ts MASK.png FRAME.png... | --stock-light [--half] [--out DIR] [STAGE...]");
  const { summary, rows } = await measure(first, rest);
  console.log(summary);
  console.log("frame\tfighterL\tringL\tabsDL\tdE00\tframeL\tlocalDL");
  for (const row of rows) console.log(`${row.frame}\t${row.fighterL.toFixed(1)}\t${row.ringL.toFixed(1)}\t${row.absDL.toFixed(1)}\t${row.dE00.toFixed(1)}\t${row.frameL.toFixed(1)}\t${row.localDL.toFixed(1)}`);
}
