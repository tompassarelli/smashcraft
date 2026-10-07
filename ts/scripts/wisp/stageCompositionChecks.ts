// Native stage-art acceptance: one hosted game per artifact, reset between stages.
import { homedir } from "node:os";
import { join } from "node:path";
import type { NativeCheck } from "wisp/scripts/wisp/accept";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { stageScenery } from "../../src/game/presentation/stageScenery";

const ARTIFACTS = [{ phase: "before", file: "before.w3x" }, { phase: "after", file: "composition-integrated.w3x" }] as const;
export const STAGE_COMPOSITION_MAPS = Object.fromEntries(ARTIFACTS.map(({ phase, file }) => [`composition-${phase}`, {
  describe: `stage composition ${phase} artifact; all nine stages in one hosted game`,
  path: join(homedir(), ".local/share/smashcraft-stage-design-178", file),
  quick: "-dev quick",
}]));

export const STAGE_COMPOSITION_CHECKS: readonly NativeCheck[] = ARTIFACTS.flatMap(({ phase }) => STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `178-${phase}-${id}-scene`, closes: "smashcraft#178 box 3", map: `composition-${phase}`,
    setup: [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { chat: "-dev backdrop on" }, { waitMs: 5000 }, { keys: ["y"] }],
    capture: [{ kind: "frames", name: "composition", client: "a" }, { kind: "frames", name: "composition", client: "b" }],
    pass: [
      { kind: "receipt", pattern: `^SMASHCRAFT STAGE v=1 .* stage=${id} `, min: 1 },
      { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 },
      { kind: "receipt", pattern: "^error \\d+ in ", max: 0 },
    ],
    look: phase === "before" ? `${name}: retained pre-change sky and scenery; same paused fighters and camera as the after sample.`
      : `${name}: original sky drawn (Nordrassil aurora preserved), distant landmark and low framing silhouettes visible behind the arena, no oversized foreground prop. Compare the matching before capture; fighters and deck edges remain distinguishable.`,
  },
  {
    id: `178-${phase}-${id}-mask`, closes: "smashcraft#178 box 3", map: `composition-${phase}`,
    setup: [{ chat: "-dev backdrop off" }, { waitMs: 13000 }],
    capture: [{ kind: "frames", name: "mask", client: "a" }, { kind: "frames", name: "mask", client: "b" }],
    pass: [{ kind: "receipt", pattern: "^error \\d+ in ", max: 0 }],
    look: `${name}: paused fighters alone, same pose and camera as ${phase} composition capture; measure contrast with smashcraft:tools/stage/contrast.ts and run existing player-view/frame checks.`,
  },
]));

// smashcraft#177: the three stages that exposed a giant temporary object on entry.
// Cold entry is the first stage load after a fresh game; the rematch follows a
// one-minute timed match ending on its own, with the automatic rematch.
const ENTRY_STAGES = STAGE_CATALOG.filter(({ id }) => id === 10 || id === 11 || id === 13);
export const STAGE_ENTRY_MAPS = Object.fromEntries(ENTRY_STAGES.map(({ id, name }) => [`entry-${id}`, {
  describe: `integrated stage art artifact; cold entry and rematch on ${name}`,
  path: join(homedir(), ".local/share/smashcraft-stage-design-178/composition-integrated.w3x"),
  quick: "-dev show",
}]));

const entryRules = (id: number) => [
  { kind: "receipt", pattern: `^SMASHCRAFT STAGE v=1 .* stage=${id} `, min: 1 },
  { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 },
  { kind: "receipt", pattern: "^error \\d+ in ", max: 0 },
] as const;

export const STAGE_ENTRY_CHECKS: readonly NativeCheck[] = ENTRY_STAGES.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `177-cold-${id}`, closes: "smashcraft#177 box 3", map: `entry-${id}`,
    setup: [{ chat: `-dev quick stage ${id}` }],
    capture: [{ kind: "frames", name: "entry", client: "a", count: 40, everyMs: 200 }],
    pass: [...entryRules(id)],
    look: `${name} cold entry: run \`bun wisp view frame\` on every frame; from the first frame with arena sky onward, 0 frames with a giant object over the arena.`,
  },
  {
    id: `177-rematch-${id}`, closes: "smashcraft#177 box 3", map: `entry-${id}`,
    setup: [{ chat: "-dev reset" }, { chat: "-dev time 1" }, { chat: "-dev auto-rematch on" }, { chat: "-dev rematch 1" }, { chat: `-dev quick stage ${id}` }, { waitMs: 56000 }],
    capture: [{ kind: "frames", name: "rematch", client: "a", count: 60, everyMs: 200 }],
    pass: [{ kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 }, { kind: "receipt", pattern: "^error \\d+ in ", max: 0 }],
    look: `${name} rematch after the timed match ends: from the first rematch frame with arena sky onward, 0 frames with a giant object over the arena.`,
  },
]);

/** The development map rebuilt from this checkout, every stage in one hosted game. */
const FLOATING_MAP = join(homedir(), ".local/share/smashcraft-build-inputs/stage-presentation-r3-20261008/presentation.w3x");
export const FLOATING_STAGE_MAPS = {
  "floating-stages": { describe: "integrity development map rebuilt from this checkout; every stage in one hosted game, each at both camera extremes", path: FLOATING_MAP, rebuild: "integrity", quick: "-dev quick" },
};

/** smashcraft#191: every stage at its closest and widest camera (`-dev view near|far`), judged against the art checklist (smashcraft:docs/design/stage-art.md). */
export const FLOATING_STAGE_CHECKS: readonly NativeCheck[] = STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => (["near", "far"] as const).map((extreme): NativeCheck => ({
  id: `191-${id}-${extreme}`, closes: "smashcraft#191 boxes 2-4", map: "floating-stages", session: "floating-stages",
  setup: [
    ...(extreme === "near" ? [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { waitMs: 5000 }, { keys: ["y"] }] : []),
    { chat: `-dev view ${extreme}` }, { waitMs: 1500 },
  ],
  capture: [{ kind: "frames", name: `${extreme}`, client: "a" }, { kind: "frames", name: `${extreme}`, client: "b" }],
  pass: [
    { kind: "receipt", pattern: `^SMASHCRAFT STAGE v=1 .* stage=${id} `, min: 1 },
    { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 },
    { kind: "receipt", pattern: "^error \\d+ in ", max: 0 },
  ],
  look: `${name}, ${extreme} camera: art checklist A-E (smashcraft:docs/design/stage-art.md); no terrain, ground or cut-off prop base below the deck.`,
})));

export const STAGE_FOG_CHECKS: readonly NativeCheck[] = STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => {
  const fog = stageScenery(id).fog;
  if (fog === undefined) return [];
  return (["linear", "height"] as const).map((mode): NativeCheck => ({
    id: `192-${id}-${mode}`, closes: "smashcraft#192 box 2", map: "floating-stages", session: "floating-stages",
    setup: mode === "linear"
      ? [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { waitMs: 5000 }, { keys: ["y"] }, { chat: "-dev view far" }, { waitMs: 1500 }]
      : [{ chat: `-dev fogv 3 ${fog.start} ${fog.end} 0.025 0 1600 ${fog.start} ${fog.end} ${fog.red} ${fog.green} ${fog.blue} 0` }, { waitMs: 1500 }],
    capture: [{ kind: "frames", name: mode, client: "a" }, { kind: "frames", name: mode, client: "b" }],
    pass: [...entryRules(id)],
    look: `${name}: compare the same paused far camera under authored distance fog and 3.0 height fog. Record which bases fade below the deck, whether sky and fighters retain their colours, and the graphics mode. The height parameters are a native tuning candidate, not the default profile.`,
  }));
});
