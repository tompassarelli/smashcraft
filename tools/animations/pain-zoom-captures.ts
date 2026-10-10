import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Cause, Effect } from "effect";
import { captureScene, renderScenes, type RenderScene } from "../../ts/node_modules/wisp/scripts/wisp/headlessRender";
import { createStandaloneSession, NEUTRAL_INPUT } from "../../ts/scripts/wisp/standalone";
import { headlessRender } from "../../ts/scripts/wisp/headlessRender";
import { assetsView, readManifest } from "../../ts/scripts/wisp/buildInputs";
import { PAIN_EXIT_BLEND_FRAMES, PAIN_ENTRY_BLEND_FRAMES } from "../../ts/src/game/presentation/damageBlend";
import { fighterAt } from "../../ts/src/game/sim/roster";
import { shell } from "../../ts/src/platform/shell/state";
import { views } from "../../ts/src/platform/shell/ui";
import { ensure } from "./original-clips";

const [outputArg, ...only] = process.argv.slice(2);
ensure(outputArg, "usage: bun tools/animations/pain-zoom-captures.ts PRIVATE_OUTPUT [FIGHTER_SLUG...]");
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "captures stay private");
const pads = join(import.meta.dir, "../../ts/test/native/pads/181");
const LAST = 290, RENDERED = [154, 290];
const BLEND = Math.max(PAIN_EXIT_BLEND_FRAMES, ...PAIN_ENTRY_BLEND_FRAMES);
type Handle = { readonly id: number };
interface Row { scripts: number; categories: Set<string>; contacts: number; mismatched: number; frames: number; maxBodies: number; blendFrames: number; duplicates: number; missing: number; notDrawn: number; undrawn: Set<string>; distance: Set<number> }

await Effect.runPromise(Effect.gen(function*() {
  const assets = assetsView(yield* readManifest());
  const project = headlessRender({ assets });
  const rows = new Map<string, Row>();
  const files = readdirSync(pads).filter(name => name.endsWith(".pad") && (only.length === 0 || only.some(slug => name.startsWith(`${slug}-`)))).sort();
  ensure(files.length > 0, "no pain scripts");
  for (const file of files) {
    const name = file.slice(0, -4), [height, strength] = name.split("-").slice(-2), slug = name.slice(0, -(height!.length + strength!.length + 2));
    const source = yield* Effect.promise(() => Bun.file(join(pads, file)).text());
    const expected = [...source.matchAll(/^#! expect ([ab]) 150 .* height (\d) strength (\d) clip (\d+)$/gm)].map(match => ({ slot: match[1] === "a" ? 0 : 1, height: Number(match[2]), strength: Number(match[3]), clip: Number(match[4]) }));
    ensure(expected.length === 2, `${name}: needs two expectations`);
    const row = rows.get(slug) ?? { scripts: 0, categories: new Set(), contacts: 0, mismatched: 0, frames: 0, maxBodies: 0, blendFrames: 0, duplicates: 0, missing: 0, notDrawn: 0, undrawn: new Set(), distance: new Set() };
    rows.set(slug, row);
    row.scripts++;
    const script = source.split("\n").filter(line => !/ capture$/.test(line)).join("\n");
    const session = yield* Effect.tryPromise({ try: () => createStandaloneSession({ presentation: "pool-confirmed", script }), catch: cause => new Error(`${name}: setup failed`, { cause }) });
    const scenes: RenderScene[] = [];
    const lastClip = [-1, -1], changed = [-1000, -1000];
    try {
      for (let step = 1; step <= LAST; step++) {
        session.step(NEUTRAL_INPUT);
        const frame = session.frame();
        session.client.run(() => {
          const state = shell(), drawn = new Set(session.client.effectPoses({ visibleOnly: true }).map(pose => pose.handle.id));
          for (const slot of [0, 1]) {
            const pose = state.runtime.poses[slot]!, fighter = fighterAt(state.world, slot);
            if (pose.clipIndex !== lastClip[slot]) { lastClip[slot] = pose.clipIndex ?? -1; changed[slot] = frame; }
            if (frame === 150 && step === 150) {
              const want = expected.find(item => item.slot === slot)!;
              row.contacts++;
              if (pose.clipIndex !== want.clip || fighter.visuals.hitHeight !== want.height || fighter.visuals.hitStrength !== want.strength) row.mismatched++;
              else row.categories.add(`${height}-${strength}`);
            }
            const clips = (views(state).fighters[slot]?.pool as unknown as { clips: Handle[] } | undefined)?.clips ?? [];
            const bodies = clips.filter(clip => drawn.has(clip.id)).length;
            row.frames++;
            row.maxBodies = Math.max(row.maxBodies, bodies);
            if (bodies === 0 && !fighter.status.out) row.missing++;
            if (bodies === 2 && frame - changed[slot]! <= BLEND) row.blendFrames++;
            else if (bodies > 1) row.duplicates++;
          }
        });
        if (RENDERED.includes(step)) scenes.push({ ...captureScene(session.client, { visibleOnly: true }), frame: step });
      }
    } finally { session.close(); }
    for (const scene of scenes) row.distance.add(Math.round(Number(scene.camera.fields.CAMERA_FIELD_TARGET_DISTANCE)));
    for (const graphics of ["classic", "definitive"] as const) {
      const rendered = yield* Effect.exit(renderScenes(project, scenes, join(output, graphics, name), graphics));
      if (rendered._tag === "Failure") {
        const lines = Cause.pretty(rendered.cause).split("\n").filter(line => / frame \d+: /.test(line) && !/^\s*at /.test(line));
        row.notDrawn += new Set(lines.map(line => line.replace(/^.*?(p\d+ frame)/, "$1"))).size;
        for (const line of lines) row.undrawn.add(`${graphics}: ${line.replace(/^.*?frame \d+: /, "")}`);
      }
    }
    console.log(`PAIN_ZOOM ${name}: ${JSON.stringify({ ...row, categories: row.categories.size, undrawn: [...row.undrawn], distance: [...row.distance] })}`);
  }
  console.log("| Fighter | Scripts | Categories | Contacts matching | Fighter-frames | Max drawn bodies | Blend frames (2 bodies) | Duplicate frames | Bodyless frames | Undrawn assets | Camera distance |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const [slug, row] of rows) console.log(`| ${slug} | ${row.scripts} | ${row.categories.size}/9 | ${row.contacts - row.mismatched}/${row.contacts} | ${row.frames} | ${row.maxBodies} | ${row.blendFrames} | ${row.duplicates} | ${row.missing} | ${row.notDrawn} | ${[...row.distance].join(", ")} |`);
}));
