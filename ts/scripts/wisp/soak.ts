




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


  limits: { typingMs: nativeFrameCost(WARCRAFT_COST, { instructions: 0, natives: 0, allocatedKb: 0, typedCharacters: TYPED_AHEAD_CHARACTERS }).typingUs / 1000 },

  frames: 80 * 60,

  matches: 200,
});


export const SOAK_OUT = join(homedir(), ".local/state/smashcraft/soak");
