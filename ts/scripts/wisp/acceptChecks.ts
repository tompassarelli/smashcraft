// Smashcraft's native checks for `bun wisp accept` (wisp:docs/accept.md):
// each open issue box that needs Warcraft III itself, declared as data next to
// the issue it closes. Map profiles name the private map each session hosts
// and the developer command that starts its match; maps stay outside Git.
import { homedir } from "node:os";
import { join } from "node:path";
import type { AcceptSuite, NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_CPU_COMMAND, QUICK_HERO_COMMAND, QUICK_TRAINING_COMMAND } from "../../src/game/shell/devSettings";
import { HIT_PRESENTATION_CASES } from "../../src/game/shell/hitPresentationCases";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { FLOATING_STAGE_CHECKS, FLOATING_STAGE_MAPS, STAGE_COMPOSITION_CHECKS, STAGE_COMPOSITION_MAPS, STAGE_ENTRY_CHECKS, STAGE_ENTRY_MAPS, STAGE_FOG_CHECKS } from "./stageCompositionChecks";

const inputs = join(homedir(), ".local/share/smashcraft-build-inputs");

export interface SmashcraftMapProfile {
  readonly describe: string;
  readonly path: string;
  /** Rebuild the map's script from this checkout with this build profile (`--profile`), once per run, before its first session. */
  readonly rebuild?: string;
  /** The developer command that starts the session's match from fighter selection. */
  readonly quick: string;
}

/** A development map rebuilt from this checkout: diagnostics and `-dev` commands. */
const PRESENTATION = join(inputs, "native-acceptance-20261006/Smashcraft diagnostic native presentation.w3x");
const LIGHTING = join(inputs, "visuals-170-20261007/Smashcraft diagnostic stage lighting.w3x");

const heroes = HERO_ROSTER.filter(({ complete }) => complete);
const rankedStages = STAGE_CATALOG.filter(({ id }) => id !== 0);
const stageProfile = (name: string) => `stage-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const heroProfile = (name: string) => `hero-${name.toLowerCase().replace(/\s+/g, "-")}`;

export const MAP_PROFILES: Readonly<Record<string, SmashcraftMapProfile>> = {
  outfits: { describe: "four-colour portrait candidate, red Illidan and blue Rifleman", path: join(inputs, "slot-outfits-161-20261007/Smashcraft diagnostic slot portrait outfits.w3x"), quick: "-dev quick" },
  ...STAGE_COMPOSITION_MAPS,
  ...STAGE_ENTRY_MAPS,
  ...FLOATING_STAGE_MAPS,
  "unlit-contact": { describe: "retained 5a1815b4 map, tech spark without the contact light", path: join(inputs, "stage-presentation-r3-20261008/5a1815b4.w3x"), quick: "-dev quick" },
  "slash-unlit": { describe: "integrity map built at f9d0fbf3, slash hit spark without its contact light", path: join(inputs, "particles-192-20261008/before.w3x"), quick: "-dev quick" },
  "slash-lit": { describe: "integrity map built with the slash hit spark's contact light", path: join(inputs, "particles-192-20261008/after.w3x"), quick: "-dev quick" },
  presentation: { describe: "development map rebuilt from this checkout, `-dev quick` (Illidan and Rifleman idle on the default stage)", path: PRESENTATION, rebuild: "main", quick: "-dev quick" },
  // smashcraft:docs/player-view.md: CURRENT_BUILD's scenario set to underside, built as a development map.
  // smashcraft#166: the playable build's keyboard input and pooled fighters (native-perf adds only developer setup and the frame meter).
  keyboard: { describe: "playable input (native-perf profile) rebuilt from this checkout, `-dev quick cpu wren expert` (Wren Expert, three stocks)", path: join(inputs, "keyboard-native-166-20261007/keyboard-native.w3x"), rebuild: "native-perf", quick: `${QUICK_CPU_COMMAND}wren expert` },
  underside: { describe: "development map built with scenario underside (smashcraft:docs/player-view.md), `-dev quick`", path: join(inputs, "stage-model-20261006/Smashcraft diagnostic underside.w3x"), quick: "-dev quick" },
  training: { describe: "development map rebuilt from this checkout, `-dev quick training` (a computer partner shielding at 40%, hit areas on)", path: PRESENTATION, rebuild: "main", quick: QUICK_TRAINING_COMMAND },
  // A quick match starts only from fighter selection, so each stage is its own session.
  ...Object.fromEntries(rankedStages.map(({ id, name }) => [stageProfile(name), {
    describe: `development map rebuilt from this checkout, a quick match on ${name}`,
    path: PRESENTATION,
    rebuild: "main",
    quick: `-dev quick stage ${id}`,
  }])),
  ...Object.fromEntries(STAGE_CATALOG.map(({ id, name }) => [`lighting-${id}`, {
    describe: `development map with every stage lighting import; paused stock/stage comparison on ${name}`,
    path: LIGHTING,
    quick: `-dev quick stage ${id}`,
  }])),
  ...Object.fromEntries(heroes.map(({ name }) => [heroProfile(name), {
    describe: `development map rebuilt from this checkout, every human plays ${name}`,
    path: PRESENTATION,
    rebuild: "main",
    quick: `${QUICK_HERO_COMMAND}${name.toLowerCase()}`,
  }])),
};

/** No runtime error report written during the check, on any client. */
const NO_ERRORS: Rule = { kind: "receipt", pattern: "^error \\d+ in ", max: 0 };
/** Every client's receipt for the developer command. */
const DEV_RECEIPT: Rule = { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 };
/** War3Log lines for imported models the map couldn't create (#73), since the session's map began loading. */
const NO_IMPORT_FAILURES: Rule = { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 };

const EXPECTATIONS: Readonly<Record<number, string>> = {
  12: "a flash at stage centre, chest height (wall tech)",
  13: "a flash at stage centre, chest height (ceiling tech)",
  14: "a yellow shield-contact spark at stage centre, chest height (ledge catch)",
  15: "a brown dust cloud at stage centre, chest height (ledge recovery)",
  24: "a flash at stage centre, chest height (double jump)",
  2: "a blue lightning flash at stage centre, chest height (electric hit)",
  7: "a blue lightning flash at stage centre, chest height (electric shield hit)",
  5: "control for 2 and 7: an ice spark at stage centre",
  6: "control for 2 and 7: a shield spark at stage centre",
  4: "a spray of slash sparks at stage centre, chest height",
  9: "a large white column above and right of centre (shield break)",
  11: "a small dot at floor level (floor tech)",
  25: "a flash at stage centre, chest height (wall jump)",
  26: "two floor dust puffs (ordinary landing)",
};

/** smashcraft#109's native look (and #115's decks, #110's camera): each stage's quick match, one whole frame per client once its scene has had 5 s to draw. */
const stageChecks: NativeCheck[] = rankedStages.map(({ name }): NativeCheck => ({
  id: `109-${stageProfile(name)}`,
  closes: "smashcraft#109 box 5",
  map: stageProfile(name),
  setup: [{ waitMs: 5000 }],
  capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS],
  look: `${name}: sky, fog and scenery behind the fighting volume, no mirror-twin scenery or creatures, a themed main deck distinct from the fog, both fighters and the HUD drawn`,
}));

/** One paused scene per stage; the native owner measures the matching masks and frames together. */
const lightingChecks: NativeCheck[] = STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `170-${id}-stock`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { chat: "-dev view off" }, { waitMs: 5000 }, { keys: ["y"] }, { chat: "-dev lighting stock" }],
    capture: [{ kind: "frames", name: "stock", client: "a" }, { kind: "frames", name: "stock", client: "b" }],
    pass: [NO_IMPORT_FAILURES, NO_ERRORS], look: `${name}: paused fighters, sky, fog, scenery and deck; stock lighting reference`,
  },
  {
    id: `170-${id}-mask`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev backdrop off" }, { waitMs: 13000 }],
    capture: [{ kind: "frames", name: "mask", client: "a" }, { kind: "frames", name: "mask", client: "b" }],
    pass: [NO_ERRORS], look: `${name}: same paused fighters alone; no residual snow or fire in the fighter mask`,
  },
  {
    id: `170-${id}-stage`, closes: "smashcraft#170 box 4", map: "floating-stages", session: "floating-stages",
    setup: [{ chat: "-dev backdrop on" }, { chat: "-dev lighting stage" }, { waitMs: 1000 }],
    capture: [{ kind: "frames", name: "stage", client: "a" }, { kind: "frames", name: "stage", client: "b" }],
    pass: [NO_IMPORT_FAILURES, NO_ERRORS], look: `${name}: same paused pose and camera; neither |ΔL| nor ΔE00 reduced against stock; record any change to shadows; run smashcraft:tools/stage/contrast.ts on this pair`,
  },
]);

/** smashcraft#82's re-capture: each case 3 s after the last, frames from its receipt to +0.5 s, its model and sound named on screen. */
const effectChecks: NativeCheck[] = [12, 13, 14, 15, 24, 2, 7, 5, 6, 4, 9, 11, 25, 26].flatMap((index): NativeCheck[] => {
  const scenario = HIT_PRESENTATION_CASES[index];
  if (scenario === undefined) return [];
  const { model, sound } = scenario;
  return [{
    id: `82-effects-${index}`,
    closes: "smashcraft#82 box 2",
    map: "presentation",
    setup: [{ waitMs: 3000 }, { chat: `-dev effects ${index}` }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
    capture: [
      { kind: "frames", name: "centre", count: 6, everyMs: 50 },
      { kind: "reading", name: "label", pattern: `dev: effects ${index} (\\S+ \\S+)` },
    ],
    // The label is written by the call that starts the sound: the right label is the sound's evidence.
    pass: [DEV_RECEIPT, NO_ERRORS, { kind: "reading", name: "label", pattern: `${model} ${sound}`, orLook: true }],
    look: EXPECTATIONS[index] ?? "the case's effect at stage centre",
  }];
});

const contactLightChecks: NativeCheck[] = (["before", "after"] as const).map((phase): NativeCheck => ({
  id: `192-tech-${phase}`, closes: "smashcraft#192 box 3", map: phase === "before" ? "unlit-contact" : "floating-stages", session: phase === "before" ? "contact-light" : "floating-stages",
  setup: [{ chat: "-dev reset" }, { chat: "-dev quick" }, { chat: "-dev view off" }, { waitMs: 5000 }, { chat: "-dev effects 12" }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
  capture: [{ kind: "frames", name: "contact", client: "a", count: 6, everyMs: 50 }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS, DEV_RECEIPT],
  look: `Tech contact ${phase}: compare the same chest-height spark, fighter surface and team colours at 50 ms intervals. The contact light must make the contact easier to read in HD; Classic retains the complete spark. Record graphics mode and native frame cost alongside the original #168 budget.`,
}));

/** Case 4 is a slash hit: the authored Hit spark, whose contact light is the 3.0 fighter-effect feature. */
const slashLightChecks: NativeCheck[] = (["before", "after"] as const).map((phase): NativeCheck => ({
  id: `192-slash-${phase}`, closes: "smashcraft#192 box 3", map: phase === "before" ? "slash-unlit" : "slash-lit", session: `slash-${phase}`,
  setup: [{ chat: "-dev reset" }, { chat: "-dev quick" }, { chat: "-dev view off" }, { waitMs: 5000 }, { chat: "-dev effects 4" }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
  capture: [{ kind: "frames", name: "contact", client: "a", count: 6, everyMs: 25 }, { kind: "reading", name: "label", pattern: "dev: effects 4 (\\S+ \\S+)" }],
  pass: [NO_IMPORT_FAILURES, NO_ERRORS, DEV_RECEIPT, { kind: "reading", name: "label", pattern: "ImpactHit- MetalLightSliceFlesh1", orLook: true }],
  look: `Slash hit ${phase}: the same chest-height spark at 25 ms intervals over its 150 ms life. After must light the nearer fighter's surface warm white and fade by 140 ms in Reforged/Definitive; Classic shows the identical spark with no light. Record graphics mode and native frame cost against the #168 budget.`,
}));

export const SMASHCRAFT_ACCEPT: AcceptSuite = {
  maps: MAP_PROFILES,
  checks: [
    {
      id: "123-selection", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 1 2" }, { chat: "-dev stocks 1" },
        { chat: "-dev fighter 2 Illidan" }, { chat: "-dev stage 2" }, { chat: "-dev auto-rematch off" },
        { waitMs: 10000 }, { keys: ["r"], client: "a" }, { waitMs: 2000 },
      ],
      capture: [{ kind: "frames", name: "fighter-selection", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Record the selected client's isolated audio sink with the checks pool profile (music muted). During the selection wait, move its private pointer across roster cells; match MouseOver1 and BigButtonClick above every rival by normalized cross-correlation. Retain #123's accepted earlier sound measurements.",
    },
    {
      id: "123-countdown", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [{ keys: ["y"], client: "a" }, { waitMs: 600 }, { keys: ["y"], client: "a" }],
      capture: [{ kind: "frames", name: "countdown", client: "a", count: 24, everyMs: 150 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "OCR reads the normal match's 3, 2, 1 and GO! calls from the retained frames.",
    },
    {
      id: "123-result", closes: "smashcraft#123 box 5", map: "presentation", session: "123-match-flow",
      setup: [{ receipt: "^parts [0-9]+$", client: "a", seconds: 600 }],
      capture: [{ kind: "frames", name: "game-and-results", client: "a", count: 16, everyMs: 150 }],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", client: "a", min: 1 }],
      look: "OCR reads GAME! and the results numbers; measure the winner's normally coloured pixels visible beside the panel. The one-stock match ends through ordinary combat against Illidan.",
    },
    {
      id: "161-slot-outfits", closes: "smashcraft#161 box 4", map: "outfits",
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "stage-and-hud", client: "a" }, { kind: "frames", name: "stage-and-hud", client: "b" }],
      // The session start already waits for both clients' -dev quick receipts; this check sends no command of its own.
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "In the same frame, Illidan's red clothing and Rifleman's blue hood on stage match their HUD busts and stock icons; frames alone are insufficient.",
    },
    {
      id: "185-cpu-preview", closes: "smashcraft#185 box 5", map: "presentation", session: "cpu-settings",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev slots 3 4" },
        { keys: ["e", "e", "n", "w", "w", "w", "w", "w", "e", "r"], client: "a" },
        { waitMs: 300 },
      ],
      capture: [{ kind: "frames", name: "rook-advanced-panel", client: "a" }, { kind: "frames", name: "shared-cpu-card", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "CPU 3 shows Rook / Advanced with Reading habits and fighting up close; Watch for Hesitation at risky openings. Opponent precedes Difficulty; all panel text and buttons fit the widescreen client. Repeat using mapped stick/D-pad, A and X; retain actual helper menu_emit evidence. Confirm the settings button is below the chip drag target.",
    },
    {
      id: "185-cpu-focus-release", closes: "smashcraft#185 box 5", map: "presentation", session: "cpu-settings",
      setup: [{ keys: ["u", "n", "y"], client: "a" }, { waitMs: 300 }],
      capture: [{ kind: "frames", name: "start-closed-panel", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "Back retains Rook / Advanced and returns focused Opponent settings; Choose reopens it. Start closes into fighter selection without starting a match. After release, focused controls and ordinary chip dragging still work; Enter opens Warcraft chat. Check mouse Close and the settings hit target on both 16:9 and the available wider client.",
    },
    {
      id: "161-neutral-grid-picked-outfits", closes: "smashcraft#161 box 4", map: "outfits",
      setup: [
        { chat: "-dev reset" }, { chat: "-dev fighter 1 Illidan", client: "a" }, { chat: "-dev fighter 2 Rifleman", client: "b" },
        { waitMs: 1500 },
      ],
      capture: [{ kind: "frames", name: "grid-and-picked-cards", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "The roster grid stays neutral; picked player cards show red Illidan and blue Rifleman clothing.",
    },
    ...(["a", "b"] as const).map((client): NativeCheck => ({
      id: `174-defile-${client}`,
      closes: "smashcraft#174 box 2",
      map: heroProfile("Lich King"),
      session: "174-defile",
      setup: [{ waitMs: 3000 }, { keys: ["e+u"], client }],
      capture: [{ kind: "frames", name: "cast-and-pool", client, count: 16, everyMs: 50 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "He raises Frostmourne, plants its point in the floor and pulls it back. A dark pool spreads ahead with a crisp glowing danger edge, dim during warning and violet when armed. The edge flashes on each growth. Cast frames 60/380/560/700 in smashcraft:ts/test/native/pads/lich-king-defile.pad show the plant in both facings; 65/77 show warning/armed pool. The growth frames 696/732/768 in 174/growth.pad show three widening flashes. The cast script also checks repeated casts and an unhurt jump escape.",
    })),
    // Keys: W R E move, I jump, N attack, U special, O grab (presetBindings standard).
    // The quick CPU match has a seven-minute limit; allow its ordinary result plus catch-up after loading.
    {
      id: "166-keyboard-match",
      closes: "smashcraft#166 box 3 (keyboard half)",
      map: "keyboard",
      setup: [
        { waitMs: 4000 },
        ...Array.from({ length: 60 }, (_, round) => [{ keys: round % 2 === 0 ? ["r", "n", "i", "n", "u"] : ["w", "n", "e", "o", "i"], client: "a" }, { waitMs: 500 }]).flat(),
        { receipt: "^parts [0-9]+$", client: "a", seconds: 600 },
      ],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", min: 1 }],
      look: "client A's replay (smashcraft-replay-N.txt with its parts) replays to its checksum with `LUA=<32-bit lua> bun wisp replay` and shows player 1's key presses",
    },
    {
      id: "166-controller-match",
      closes: "smashcraft#166 box 3 (controller half)",
      map: "keyboard",
      session: "166-controller",
      // Client A's pad arrives as keys from `wc3-controller --emit --virtual-pad --gamepad 2` with its private-desktop target (smashcraft:companion/README.md, "Explicit Linux output"), started beside this check.
      setup: [{ receipt: "^parts [0-9]+$", client: "a", seconds: 600 }],
      pass: [NO_ERRORS, { kind: "receipt", pattern: "^parts [0-9]+$", min: 1 }],
      look: "the controller log shows its key presses and client A's replay reaches its checksums with player 1's input",
    },
    {
      id: "169-render-clock",
      closes: "smashcraft#169 box 1 (callback cadence and cost; compare 60/144 fps reports)",
      map: "presentation",
      setup: [{ chat: "-dev render-clock" }, { receipt: "^render-clock run=[0-9]+ clock=", seconds: 12 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS, { kind: "receipt", pattern: "^render-clock run=[0-9]+ clock=running", min: 1 }],
      look: "native session owner: compare callback bursts and recording cost with renderer telemetry at 60 and 144 fps; a receipt alone does not establish a render-rate hook",
    },
    // First in its session, so its frames show the map as it loaded.
    {
      id: "73-map-load",
      closes: "smashcraft#73 box 1",
      map: "presentation",
      setup: [{ waitMs: 2000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "deck and fighters drawn on each client; run with client A's private desktop at 2880x1920 for the 3:2 box",
    },
    ...effectChecks,
    ...stageChecks,
    ...lightingChecks,
    ...STAGE_COMPOSITION_CHECKS,
    ...STAGE_ENTRY_CHECKS,
    ...FLOATING_STAGE_CHECKS,
    ...STAGE_FOG_CHECKS,
    ...contactLightChecks,
    ...slashLightChecks,
    {
      id: "57-underside",
      closes: "smashcraft#57 box 2",
      map: "underside",
      capture: [{ kind: "frames", name: "underside", client: "a" }, { kind: "frames", name: "underside", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "the deck's underside edge at about 74% of the frame height, player 1 at about 62-72%, both above the HUD (about 82%)",
    },
    {
      id: "120-training",
      closes: "smashcraft#120 box 5",
      map: "training",
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "green body outlines on every fighter and the partner's shield, outlines on the fighters' plane; after an attack, the top-left readout (frames, advantage, combo) readable on both clients",
    },
    {
      id: "150-special-name",
      closes: "smashcraft#150 box 5 (readout half)",
      map: "training",
      setup: [{ waitMs: 3000 }, { keys: ["u"] }, { waitMs: 1500 }],
      capture: [{ kind: "frames", name: "readout", client: "a" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "after the neutral special, the top-left readout's first line names it (for example 'Swift Arrow: 34 total'), not 'Attack' or 'Special'",
    },
    // #153 box 5, in one Forsaken Paladin mirror in this order, each starting where the last left the fighters (smashcraft:docs/design/mana.md, "The bar"). Keys: W R E move, U special, O grab.
    {
      id: "153-mana-full",
      closes: "smashcraft#153 box 5 (full bars)",
      map: heroProfile("Forsaken Paladin"),
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "full", client: "a" }, { kind: "frames", name: "full", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "a thin segmented blue bar (ten segments) full over each fighter's head, and a matching full bar on each HUD plate",
    },
    {
      id: "153-mana-spent",
      closes: "smashcraft#153 box 5 (drain on specials)",
      map: heroProfile("Forsaken Paladin"),
      // Three Crusader Rushes (20 each) toward the other Forsaken Paladin.
      setup: [{ keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }],
      capture: [{ kind: "frames", name: "spent", client: "a" }, { kind: "frames", name: "spent", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "player 1's bars about half full (over the head and on the plate), lower than player 2's; a rush that hit shows player 2's bar a little up",
    },
    {
      id: "153-mana-escape",
      closes: "smashcraft#153 box 5 (stacked with the escape meter)",
      map: heroProfile("Forsaken Paladin"),
      // After the rushes player 1 stands at player 2, so a grab press catches.
      setup: [{ keys: ["o"] }, { waitMs: 150 }],
      capture: [{ kind: "frames", name: "held", client: "a", count: 4, everyMs: 120 }, { kind: "frames", name: "held", client: "b", count: 4, everyMs: 120 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "over the held fighter, the yellow escape meter with its blue mana bar just above it, not overlapping; the holder's mana bar alone over its head",
    },
    {
      id: "153-mana-refused",
      closes: "smashcraft#153 box 5 (refused special)",
      map: heroProfile("Forsaken Paladin"),
      // Once the hold ends, rushes until one can't be paid: the refused press flashes both of player 1's bars red.
      setup: [{ waitMs: 1500 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 900 }, { keys: ["r+u"] }, { waitMs: 300 }, { keys: ["r+u"] }],
      capture: [{ kind: "frames", name: "refused", client: "a", count: 8, everyMs: 100 }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "player 1's bars near empty and, in some frames, blinking red; no rush starts on the refused press",
    },
    ...heroes.map(({ name }): NativeCheck => ({
      id: `96-hero-${heroProfile(name).slice(5)}`,
      closes: "smashcraft#96 box 5",
      map: heroProfile(name),
      setup: [{ waitMs: 3000 }],
      capture: [{ kind: "frames", name: "match", client: "a" }, { kind: "frames", name: "match", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: `${name} drawn with its model and animations on both clients, and the HUD mana label placed beside its portrait`,
    })),
  ],
};
