// Native capture plans derived from production simulation, without forcing a
// hold or release. Both players approach, grab, pummel and throw through input.
import "../../ts/test/host-natives";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { queueAttack } from "../../ts/src/game/input/attackBuffer";
import { createBufferedFrameControls } from "../../ts/src/game/match/controls";
import { createMatchState, Phase } from "../../ts/src/game/match/rules";
import { initializeMatchFighters, matchSpawnX, stepMatch } from "../../ts/src/game/match/step";
import { AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { HERO_ROSTER, fighterName, fighterSlug } from "../../ts/src/game/sim/heroes/registry";
import { copyControls, createRoster, fighterAt, neutralControls } from "../../ts/src/game/sim/roster";
import { ensure } from "./original-clips";

const output = resolve(import.meta.dir, "../../ts/test/native/pads/180");
const expectationsOnly = process.argv.includes("--expectations-only");
mkdirSync(output, { recursive: true });
const throws = [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown] as const;
const names = ["forward", "back", "up", "down"] as const;
function play(character: number, targetCharacter: number, holder: number, runFrames: number, action?: GrabAction) {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(holder === 0 ? character : targetCharacter, matchSpawnX(0), 1), createFighter(holder === 1 ? character : targetCharacter, matchSpawnX(1), -1)]);
  initializeMatchFighters(game, world);
  const controls = createBufferedFrameControls(), target = 1 - holder, facing = holder === 0 ? 1 : -1;
  const owner = fighterAt(world, holder), victim = fighterAt(world, target);
  const captures = new Set<number>(), expectations: string[] = [];
  let caught = false, pummelled = false, released = false;
  for (let frame = 1; frame <= (action === undefined ? 140 : 330); frame++) {
    for (const input of controls.inputs) copyControls(input, neutralControls());
    const moving = controls.inputs[target], holding = controls.inputs[holder];
    ensure(moving && holding, "Missing player input");
    if (frame >= 40 && frame < 40 + runFrames) moving.direction = -facing;
    if (action !== undefined) {
      if (frame === 150) queueAttack(controls.commands[holder], { style: AttackStyle.grab, facing: 0, frame, mayCharge: false });
      if (frame === 180) holding.attackPressed = true;
      if (frame === 200) {
        if (action === GrabAction.throwUp || action === GrabAction.throwDown) holding.grabThrowZ = action === GrabAction.throwUp ? 1 : -1;
        else holding.grabThrowX = action === GrabAction.throwForward ? facing : -facing;
      }
    }
    const beforeDamage = victim.status.damage;
    const beforeHeld = owner.grab.target !== undefined;
    stepMatch(game, world, controls, frame);
    if (!beforeHeld && owner.grab.target === target) {
      caught = true;
      expectations.push(`#! expect ${holder === 0 ? "a" : "b"} ${frame} grab-hold start`);
      captures.add(frame + 5); captures.add(177);
    }
    if (victim.status.damage > beforeDamage) {
      if (owner.grab.action === GrabAction.pummel) pummelled = true;
      else released = true;
      expectations.push(`#! expect ${target === 0 ? "a" : "b"} ${frame} damage ${victim.status.damage.toFixed(3)}`);
      for (const offset of character === targetCharacter ? [-3, -1, 0, 3, 8] : [-1, 0, 8]) captures.add(frame + offset);
    }
    if (beforeHeld && owner.grab.target === undefined && action !== undefined) {
      ensure(owner.grab.action === action, `${character}: escaped instead of the requested throw`);
      captures.add(frame + 20); captures.add(frame + 50);
    }
  }
  if (action !== undefined) ensure(caught && pummelled && released, `${character}/${holder}/${action}: missing catch, pummel or release`);
  return { gap: facing * (victim.motion.x - owner.motion.x), captures, expectations };
}
let count = 0;
for (const hero of HERO_ROSTER) for (const targetCharacter of [hero.character, hero.character === Character.mountainKing ? Character.pitLord : Character.mountainKing]) for (const holder of [0, 1]) {
  if (expectationsOnly) {
    for (const [index, action] of throws.entries()) {
      const mirror = hero.character === targetCharacter;
      const name = `${fighterSlug(hero.character)}${mirror ? "" : `-vs-${fighterSlug(targetCharacter)}`}-${names[index]}-${holder === 0 ? "right" : "left"}.pad`;
      const path = join(output, name);
      if (!existsSync(path)) continue;
      const script = readFileSync(path, "utf8"), target = holder === 0 ? "b" : "a";
      const stop = new RegExp(`^(\\d+) ${target} stick 0 0$`, "m").exec(script);
      ensure(stop !== null, `${name}: missing approach stop`);
      const { expectations } = play(hero.character, targetCharacter, holder, Number(stop[1]) - 40, action);
      // Balance changes can shorten pummel hitlag. Keep the authored inputs and
      // capture frames while deriving assertions from current gameplay rules.
      await Bun.write(path, script.replace(/^#! expect .*\n/gm, "").trimEnd() + "\n" + expectations.join("\n") + "\n");
      count++;
    }
    continue;
  }
  let best = 0, error = Infinity;
  for (let runFrames = 1; runFrames <= 75; runFrames++) {
    const { gap } = play(hero.character, targetCharacter, holder, runFrames);
    if (gap > 10 && gap < 60 && Math.abs(gap - 35) < error) { best = runFrames; error = Math.abs(gap - 35); }
  }
  ensure(best > 0, `${hero.name}: cannot approach through ordinary movement`);
  for (const [index, action] of throws.entries()) {
    const { captures, expectations } = play(hero.character, targetCharacter, holder, best, action);
    const owner = holder === 0 ? "a" : "b", target = holder === 0 ? "b" : "a", facing = holder === 0 ? 1 : -1;
    const x = action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0;
    const z = action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0;
    const rows = [
      { frame: 40, text: `${target} stick ${-facing} 0` },
      { frame: 40 + best, text: `${target} stick 0 0` },
      { frame: 150, text: `${owner} tap RB 2` },
      { frame: 180, text: `${owner} tap A 2` },
      { frame: 200, text: `${owner} cstick ${x} ${z}` },
      { frame: 202, text: `${owner} cstick 0 0` },
      ...[...captures].flatMap(frame => [{ frame, text: "a capture" }, { frame, text: "b capture" }]),
      { frame: 340, text: `${owner} press VIEW` }, { frame: 410, text: `${owner} release VIEW` },
    ].sort((a, b) => a.frame - b.frame);
    const mirror = hero.character === targetCharacter;
    const name = `${fighterSlug(hero.character)}${mirror ? "" : `-vs-${fighterSlug(targetCharacter)}`}-${names[index]}-${holder === 0 ? "right" : "left"}.pad`;
    const pair = holder === 0 ? [hero.character, targetCharacter] : [targetCharacter, hero.character];
    await Bun.write(join(output, name), [
      "# #180 paired hold, pummel and release at gameplay zoom. Generated by smashcraft:tools/animations/grab-pads.ts.",
      mirror ? `#! chat -dev quick hero ${hero.name.toLowerCase()}` : `#! chat -dev quick pair ${fighterName(pair[0]).toLowerCase()} / ${fighterName(pair[1]).toLowerCase()}`,
      ...rows.map(row => `${row.frame} ${row.text}`), ...expectations, "",
    ].join("\n"));
    count++;
  }
}
console.log(`GRAB_PAD_PASS ${count} action scripts: mirror and unlike-height pairs; ordinary approach, catch, pummel and requested throw; both facings`);
