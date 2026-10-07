// Smashcraft's soak (wisp:docs/soak.md): every ordered fighter pair on every
// stage, each round with the next pair of player policies: the fuzzed
// controller ("fuzz"), the game's computer ("cpu", the human's helper types
// neutral rows) and a human whose helper never runs ("absent", #46). Matches
// play the playable build with the scene recorder (test/soak/game.ts).
import { homedir } from "node:os";
import { join } from "node:path";
import { defineSoak } from "wisp/scripts/wisp/soak";
import { WARCRAFT_COST, nativeFrameCost } from "wisp/src/headless/nativeCost";
import { TYPED_AHEAD_CHARACTERS } from "../../src/game/netcode/journal/text";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../src/game/sim/heroes/registry";
import { SOAK_CONTROLLER } from "../../test/soak/controller";
import { PREDICTED_HEADLESS } from "./headless";
import { SMASHCRAFT_SCENE } from "./playerView";

export default defineSoak({
  name: "smashcraft",
  map: PREDICTED_HEADLESS,
  game: join(import.meta.dir, "../../test/soak/game.ts"),
  scene: SMASHCRAFT_SCENE,
  roster: {
    fighters: SELECTABLE_CHARACTERS.map(fighterSlug),
    stages: ["sky-deck", "three-bridges", "frozen-throne", "drifting-deck", "patterned-decks", "wind", "carried", "cannon", "timed-lift", "hellfire", "stratholme", "tomb-of-sargeras"],
    policies: [["fuzz", "cpu"], ["fuzz", "fuzz"], ["cpu", "cpu"], ["cpu", "fuzz"], ["fuzz", "absent"], ["absent", "fuzz"]],
  },
  controller: SOAK_CONTROLLER,
  // The helper types at most TYPED_AHEAD_CHARACTERS at once by design (#48): Warcraft's stall for that many is
  // the bound, and only more, such as a burst of whole records, is a typing finding.
  limits: { typingMs: nativeFrameCost(WARCRAFT_COST, { instructions: 0, natives: 0, allocatedKb: 0, typedCharacters: TYPED_AHEAD_CHARACTERS }).typingUs / 1000 },
  // A one-minute, one-stock match and its result, with room for the stalls the fuzzer makes.
  frames: 80 * 60,
  // The nightly run: every pair on every stage, eleven times over.
  matches: 200,
});

/** Where each soak run keeps its repro files. */
export const SOAK_OUT = join(homedir(), ".local/state/smashcraft/soak");
