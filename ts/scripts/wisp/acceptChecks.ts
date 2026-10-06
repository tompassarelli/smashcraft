// Smashcraft's native checks for `bun wisp accept` (wisp:docs/accept.md):
// each open issue box that needs Warcraft III itself, declared as data next to
// the issue it closes. Map profiles name the private map each session hosts
// and the developer command that starts its match; maps stay outside Git.
import { homedir } from "node:os";
import { join } from "node:path";
import type { AcceptSuite, NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_HERO_COMMAND } from "../../src/game/shell/devSettings";
import { HIT_PRESENTATION_CASES } from "../../src/game/shell/hitPresentationCases";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";

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

const heroes = HERO_ROSTER.filter(({ complete }) => complete);
const heroProfile = (name: string) => `hero-${name.toLowerCase().replace(/\s+/g, "-")}`;

export const MAP_PROFILES: Readonly<Record<string, SmashcraftMapProfile>> = {
  presentation: { describe: "development map rebuilt from this checkout, `-dev quick` (Archer and Rifleman idle on the default stage)", path: PRESENTATION, rebuild: "main", quick: "-dev quick" },
  // smashcraft:docs/player-view.md: CURRENT_BUILD's scenario set to underside, built as a development map.
  underside: { describe: "development map built with scenario underside (smashcraft:docs/player-view.md), `-dev quick`", path: join(inputs, "stage-model-20261006/Smashcraft diagnostic underside.w3x"), quick: "-dev quick" },
  ...Object.fromEntries(heroes.map(({ name }) => [heroProfile(name), {
    describe: `development map rebuilt from this checkout, every human plays ${name}`,
    path: PRESENTATION,
    rebuild: "main",
    quick: `${QUICK_HERO_COMMAND}${name.toLowerCase()}`,
  }])),
};

// Positions in the 2560x1440 client frame.
/** About 600x400 on the screen's centre, where the effects diagnostic places its cues. */
const CENTRE = { x: 980, y: 520, width: 600, height: 400 };
/** Where Warcraft prints a text message to the player, above the console. */
const MESSAGES = { x: 0, y: 700, width: 1600, height: 500 };

/** No runtime error report written during the check, on any client. */
const NO_ERRORS: Rule = { kind: "receipt", pattern: "^error \\d+ in ", max: 0 };
/** Every client's receipt for the developer command. */
const DEV_RECEIPT: Rule = { kind: "receipt", pattern: "^SMASHCRAFT DEV v=1 ", min: 1 };
/** War3Log lines for imported models the map couldn't create (#73), since the session's map began loading. */
const NO_IMPORT_FAILURES: Rule = { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 };

const EXPECTATIONS: Readonly<Record<number, string>> = {
  12: "a flash at stage centre, chest height (wall tech)",
  13: "a flash at stage centre, chest height (ceiling tech)",
  14: "a flash at stage centre, chest height (ledge catch)",
  15: "a flash at stage centre, chest height (ledge recovery)",
  24: "a flash at stage centre, chest height (double jump)",
  2: "an electric spark at stage centre; if empty, BoltImpact needs a different model",
  7: "an electric shield spark at stage centre; if empty, BoltImpact needs a different model",
  5: "control for 2 and 7: an ice spark at stage centre",
  6: "control for 2 and 7: a shield spark at stage centre",
  4: "small pale slash particles at stage centre",
  9: "a large white column above and right of centre (shield break)",
  11: "a small dot at floor level (floor tech)",
  25: "two floor dust puffs (ordinary landing)",
};

/** smashcraft#82's re-capture: each case 3 s after the last, frames from its receipt to +0.5 s, its model and sound named on screen. */
const effectChecks: NativeCheck[] = [12, 13, 14, 15, 24, 2, 7, 5, 6, 4, 9, 11, 25].flatMap((index): NativeCheck[] => {
  const scenario = HIT_PRESENTATION_CASES[index];
  if (scenario === undefined) return [];
  const { model, sound } = scenario;
  return [{
    id: `82-effects-${index}`,
    closes: "smashcraft#82 box 2",
    map: "presentation",
    setup: [{ waitMs: 3000 }, { chat: `-dev effects ${index}` }, { receipt: "^SMASHCRAFT DEV v=1 ", seconds: 4 }],
    capture: [
      { kind: "frames", name: "centre", region: CENTRE, count: 6, everyMs: 50 },
      { kind: "reading", name: "label", region: MESSAGES, pattern: `dev: effects ${index} (\\S+ \\S+)` },
    ],
    // The label is written by the call that starts the sound: the right label is the sound's evidence.
    pass: [DEV_RECEIPT, NO_ERRORS, { kind: "reading", name: "label", pattern: `${model} ${sound}`, orLook: true }],
    look: EXPECTATIONS[index] ?? "the case's effect at stage centre",
  }];
});

export const SMASHCRAFT_ACCEPT: AcceptSuite = {
  maps: MAP_PROFILES,
  checks: [
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
    {
      id: "57-underside",
      closes: "smashcraft#57 box 2",
      map: "underside",
      capture: [{ kind: "frames", name: "underside", client: "a" }, { kind: "frames", name: "underside", client: "b" }],
      pass: [NO_IMPORT_FAILURES, NO_ERRORS],
      look: "the deck's underside edge at about 74% of the frame height, player 1 at about 62-72%, both above the HUD (about 82%)",
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
