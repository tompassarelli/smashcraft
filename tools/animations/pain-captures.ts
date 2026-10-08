import { join, relative, resolve } from "node:path";
import { Effect } from "effect";
import { captureScene, renderScenes, type RenderScene } from "../../ts/node_modules/wisp/scripts/wisp/headlessRender";
import { createStandaloneSession, NEUTRAL_INPUT } from "../../ts/scripts/wisp/standalone";
import { headlessRender } from "../../ts/scripts/wisp/headlessRender";
import { assetsView, readManifest } from "../../ts/scripts/wisp/buildInputs";
import { originalClip } from "../../ts/src/game/assets/fighterOriginalClipInfo";
import { contactDamageClip } from "../../ts/src/game/presentation/damagePose";
import { SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../../ts/src/game/sim/heroes/registry";
import { Character } from "../../ts/src/game/sim/codes";
import { fighterAt } from "../../ts/src/game/sim/roster";
import { shell } from "../../ts/src/platform/shell/state";
import { ensure, parseSource, tracks } from "./original-clips";

const [outputArg] = process.argv.slice(2);
ensure(outputArg, "usage: bun tools/animations/pain-captures.ts PRIVATE_OUTPUT");
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "captures stay private");

await Effect.runPromise(Effect.gen(function*() {
  const assets = assetsView(yield* readManifest());
  const checkedModels = new Set<string>();
  for (const character of SELECTABLE_CHARACTERS) {
    if (character === Character.archer) continue;
    const session = yield* Effect.tryPromise({
      try: () => createStandaloneSession({ presentation: "pool-confirmed", script: [
        `#! chat -dev pain middle medium ${fighterName(character).toLowerCase()}`,
        "146 a tap A 2", "146 b tap A 2",
      ].join("\n") }), catch: cause => new Error("Pain capture setup failed", { cause }),
    });
    const scenes: RenderScene[] = [];
    let selected: number | undefined, held = 0, released = 0;
    try {
      while (session.frame() < 210) {
        session.step(NEUTRAL_INPUT);
        const frame = session.frame();
        session.client.run(() => {
          const state = shell(), fighter = fighterAt(state.world, 0), pose = state.runtime.poses[0];
          if (frame === 150) {
            ensure(fighter.status.damage === 8 && fighter.launch.hitstun > 0, `${fighterName(character)}: contact missing`);
            selected = contactDamageClip(fighter).index;
            ensure(pose.clipIndex === selected && pose.clipTime === 0 && pose.rate === 0, `${fighterName(character)}: contact pose not held`);
          }
          if (frame > 150 && fighter.launch.hitstun > 0 && fighter.down.state <= 1) {
            ensure(pose.clipIndex === selected && pose.clipTime === 0 && pose.rate === 0, `${fighterName(character)} f${frame}: hurt pose moved during hitstun`);
            held++;
          }
          if (frame > 150 && fighter.launch.hitstun === 0 && selected !== undefined && pose.clipIndex !== selected) released++;
        });
        if ([149, 150, 154, 165, 190].includes(frame)) scenes.push({ ...captureScene(session.client), frame });
      }
      ensure(held > 0 && released > 0, `${fighterName(character)}: missing hold/release`);
      const info = selected === undefined ? undefined : originalClip(character, selected);
      ensure(info, `${fighterName(character)}: missing pain binding`);
      if (!checkedModels.has(info.modelPath)) {
        const source = parseSource(yield* Effect.tryPromise({
          try: () => Bun.file(join(assets, "original-clips-static-lights/imports", info.modelPath.replaceAll("\\", "/"))).arrayBuffer(),
          catch: cause => new Error("Pain model read failed", { cause }),
        }));
        tracks(source, (track, path) => ensure(track.Keys.length > 0, `${fighterName(character)}: empty ${path}`));
        ensure(source.Geosets.length > 0, `${fighterName(character)}: empty body`);
        checkedModels.add(info.modelPath);
      }
    } finally { session.close(); }
    yield* renderScenes(headlessRender({ assets }), scenes, join(output, fighterSlug(character)));
    console.log(`PAIN_CAPTURE_PASS ${fighterName(character)}: 5 Wisp frames, ${held} held-hitstun frames, ${released} recovery frames, 0 empty tracks`);
  }
}));
