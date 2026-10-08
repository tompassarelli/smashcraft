import "../../ts/test/host-natives";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { queueAttack } from "../../ts/src/game/input/attackBuffer";
import { createBufferedFrameControls } from "../../ts/src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../../ts/src/game/match/frameInput";
import { createPacingAndPresentation } from "../../ts/src/game/match/pacingAndPresentation";
import { createMatchState, Phase } from "../../ts/src/game/match/rules";
import { initializeMatchFighters } from "../../ts/src/game/match/step";
import { AttackStyle, Character } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName, fighterSlug } from "../../ts/src/game/sim/heroes/registry";
import { createRoster, fighterAt } from "../../ts/src/game/sim/roster";
import { initializePainScenario, PAIN_SCENARIOS } from "../../ts/src/game/shell/painFixture";
import { contactDamageClips } from "../../ts/src/game/presentation/damagePose";
import { FORSAKEN_PALADIN_DAMAGE_MULTIPLIER } from "../../ts/src/game/sim/heroes/forsakenPaladinHammer";
import { parsePadScript } from "../../ts/scripts/integrity/padScript";
import { ensure } from "./original-clips";

const output = resolve(import.meta.dir, "../../ts/test/native/pads/181");
mkdirSync(output, { recursive: true });
let count = 0;
for (const character of SELECTABLE_CHARACTERS) for (const [index, scenario] of PAIN_SCENARIOS.entries()) {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(character, -240, 1), createFighter(character, 240, -1)]);
  initializeMatchFighters(game, world);
  initializePainScenario(scenario, world);
  const controls = createBufferedFrameControls(), row = createMatchFrameInput();
  const runtime = createPacingAndPresentation();
  const expectations: string[] = [];
  for (let frame = 1; frame <= 180; frame++) {
    if (frame === 146) for (const slot of [0, 1]) queueAttack(controls.commands[slot], { style: AttackStyle.jab, facing: 0, frame, mayCharge: false });
    ensure(captureFrame(row, frame, world.mask, controls, runtime) && executeMatchFrame(row, game, world, controls, runtime, frame), "Pain fixture frame refused");
    if (frame === 149) for (const slot of [0, 1]) ensure(fighterAt(world, slot).attack.style === AttackStyle.jab, `${fighterName(character)}: no jab to interrupt`);
    if (frame === 150) for (const slot of [0, 1]) {
      const fighter = fighterAt(world, slot);
      const clip = contactDamageClips(character)?.[index]?.index;
      const damage = character === Character.forsakenPaladin ? Math.fround(8 * FORSAKEN_PALADIN_DAMAGE_MULTIPLIER) : 8;
      ensure(fighter.status.damage === damage && fighter.visuals.hitHeight === Math.floor(index / 3) && fighter.visuals.hitStrength === index % 3 && runtime.poses[slot].clipIndex === clip,
        `${fighterName(character)}/${scenario}/${slot}: damage ${fighter.status.damage}, want ${damage}; height ${fighter.visuals.hitHeight}, want ${Math.floor(index / 3)}; strength ${fighter.visuals.hitStrength}, want ${index % 3}; clip ${runtime.poses[slot].clipIndex}, want ${clip}`);
      expectations.push(`#! expect ${slot === 0 ? "a" : "b"} 150 damage ${damage.toFixed(3)} hitlag ${fighter.launch.hitlag} hitstun ${fighter.launch.hitstun} height ${fighter.visuals.hitHeight} strength ${fighter.visuals.hitStrength} clip ${clip}`);
    }
  }
  const [, height, strength] = scenario.split("-");
  const captures = [149, 150, 151, 153, 154, 155, 159, 165, 180];
  const rows = captures.flatMap(frame => [`${frame} a capture`, `${frame} b capture`]);
  const source = [
    "# #181: interrupted jab, contact, entry dissolve, held pain and release in both facings.",
    `#! chat -dev pain ${height} ${strength} ${fighterName(character).toLowerCase()}`,
    "146 a tap A 2", "146 b tap A 2", ...rows,
    "200 a press VIEW", "270 a release VIEW", "290 a capture", "290 b capture", ...expectations,
  ].join("\n") + "\n";
  parsePadScript(source);
  await Bun.write(join(output, `${fighterSlug(character)}-${height}-${strength}.pad`), source);
  count++;
}
console.log(`PASS: ${count} pain scripts; ${count * 2} accepted hits and selected category clips; 10 capture frames in both facings per script`);
