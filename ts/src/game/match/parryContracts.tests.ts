// The powershield parry through the match step, for every shipped fighter:
// after a parried hit or projectile each grounded option starts on the first
// frame the defender can act, an option pressed during the parried hit's
// freeze included; after an ordinary block the same press waits out
// shieldstun. smashcraft:docs/gameplay-design.md ("Powershield and parry").
import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, ProjectileKind } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { type Controls, type Roster, copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES, SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import { controls } from "../sim/testWorld";
import { type FrameControls, createBufferedFrameControls } from "./controls";
import { type MatchState, Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";
import { sweep } from "../../runtime/sweep";

interface Duel {
  readonly game: MatchState;
  readonly world: Roster;
  readonly controls: FrameControls;
  frame: number;
}

/** An Archer in slot 0 facing the defender in slot 1, `gap` to its right; `guard` raises an ordinary held shield. */
function duel(character: Character, gap: number, guard: boolean): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const defender = createFighter(character, f32(gap / 2), -1);
  if (guard) {
    defender.shield.raised = true;
    defender.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
  }
  return { game, world: createRoster(3, [createFighter(Character.archer, f32(-gap / 2), 1), defender]), controls: createBufferedFrameControls(), frame: 0 };
}

const defenderOf = (d: Duel): Fighter => fighterAt(d.world, 1);

function play(d: Duel, input: Readonly<Controls>): void {
  d.frame++;
  copyControls(d.controls.inputs[0], neutralControls());
  copyControls(d.controls.inputs[1], input);
  stepMatch(d.game, d.world, d.controls, d.frame);
}

const held = (): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const pressed = (): Controls => controls({ shield: true, shieldPressed: true, shieldTriggerActive: true, shieldStrength: 1.0 });

/** A grounded option out of a parry: its press, what is held after it, and whether it has started. */
interface Option {
  readonly name: string;
  readonly press: (d: Duel) => Controls;
  readonly after: () => Controls;
  readonly started: (f: Fighter) => boolean;
}

/** An attack queued as its press; the shield is let go for every one but the grab. */
const attack = (name: string, style: AttackStyle): Option => {
  const shield = style === AttackStyle.grab;
  return {
    name,
    press: (d) => {
      queueAttack(d.controls.commands[1], { style, facing: 0, frame: d.frame + 1, mayCharge: false });
      return shield ? held() : controls();
    },
    after: () => (shield ? held() : controls()),
    started: (f) => f.attack.style === style,
  };
};

const dodge = (name: string, direction: number): Option => ({
  name,
  press: () => controls({ ...held(), groundDodgePressed: true, groundDodgeDirection: direction }),
  after: held,
  started: (f) => f.dodge.groundFrame > 0 && f.dodge.groundDirection === direction,
});

const OPTIONS: readonly Option[] = [
  attack("jab", AttackStyle.jab),
  attack("forward tilt", AttackStyle.forwardTilt),
  attack("up tilt", AttackStyle.upTilt),
  attack("down tilt", AttackStyle.downTilt),
  attack("forward smash", AttackStyle.forwardSmash),
  attack("up smash", AttackStyle.upSmash),
  attack("down smash", AttackStyle.downSmash),
  attack("shield grab", AttackStyle.grab),
  { name: "jump", press: () => controls({ ...held(), jumpPressed: true, jumpHeld: true }), after: held, started: (f) => f.jump.squat > 0 || !f.motion.grounded },
  dodge("roll toward", -1),
  dodge("roll away", 1),
  dodge("spot dodge", 0),
];

const GAP = 40.0;

/** The frame the Archer's jab meets the defender's shield when the shield is raised on `raise` (0: held from the start). */
function jabOnShield(character: Character, raise: number): { readonly duel: Duel; readonly contact: number } {
  const d = duel(character, GAP, raise === 0);
  queueAttack(d.controls.commands[0], { style: AttackStyle.jab, facing: 0, frame: 1, mayCharge: false });
  const defender = defenderOf(d);
  while (d.frame < 30) {
    play(d, raise === 0 ? held() : d.frame + 1 < raise ? controls() : d.frame + 1 === raise ? pressed() : held());
    if (defender.visuals.shield + defender.visuals.shieldReflect > 0) return { duel: d, contact: d.frame };
  }
  throw new Error(`${fighterName(character)}: the jab never met the shield`);
}

/** Presses `option` on the duel's next frame and returns the frame it starts on, or undefined within `horizon` frames. */
function optionStart(d: Duel, option: Option, horizon: number): number | undefined {
  const defender = defenderOf(d);
  const first = d.frame + 1;
  for (let n = first; n < first + horizon; n++) {
    play(d, n === first ? option.press(d) : option.after());
    if (option.started(defender)) return d.frame;
  }
  return undefined;
}

test("after a parried hit every grounded option starts on the first actionable frame, pressed during the freeze", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    const late = jabOnShield(character, 0).contact;
    for (const option of OPTIONS) {
      const parry = jabOnShield(character, late - 1);
      const defender = defenderOf(parry.duel);
      assertEquals(defender.visuals.shieldReflect, 1, `${name}: the jab is parried`);
      assertEquals(defender.shield.stun, 0, `${name}: no shieldstun`);
      const freeze = defender.launch.hitlag;
      assertEquals(freeze > 1, true, `${name}: the parried hit freezes`);
      // The freeze's last frame is the first the defender can act on.
      assertEquals(optionStart(parry.duel, option, 40), parry.contact + freeze, `${name} ${option.name} out of a parry`);
      const block = jabOnShield(character, 0);
      const blocked = defenderOf(block.duel);
      assertEquals(blocked.shield.stun > 0, true, `${name}: an ordinary block has shieldstun`);
      const start = optionStart(block.duel, option, 40);
      assertEquals(start === undefined || start > block.contact + freeze, true, `${name} ${option.name} waits out shieldstun after a block`);
    }
  }
});

test("a late shield keeps its shieldstun and release lag", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const { duel: d } = jabOnShield(character, 0);
    const defender = defenderOf(d);
    assertEquals(defender.shield.stun > 0, true, fighterName(character));
    assertEquals(defender.shield.perfectActionFrames, 0);
    while (defender.launch.hitlag > 0 || defender.shield.stun > 0) play(d, held());
    play(d, controls());
    assertEquals(defender.shield.raised, false);
    assertEquals(defender.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES, fighterName(character));
  }
});

/** A shot from the far-left Archer at the defender's shield centre height, `distance` away, flying right. */
function shotAt(d: Duel, distance: number): void {
  const defender = defenderOf(d);
  const shot = fighterAt(d.world, 0).projectiles[0]!;
  shot.x = f32(defender.motion.x - distance);
  shot.z = f32(defender.motion.z + defender.tuning.shield.centerZ);
  shot.velocityX = 20.0;
  shot.velocityZ = 0.0;
  shot.direction = 1;
  shot.kind = ProjectileKind.blaster;
  shot.visualFamily = Character.archer;
  shot.life = 40;
  shot.damageMultiplier = 1.0;
}

/** The frame a shot reaches the defender's shield raised on `raise` (0: held from the start), with how it met it. */
function shotOnShield(character: Character, raise: number): { readonly duel: Duel; readonly contact: number; readonly reflected: boolean } | undefined {
  const d = duel(character, 400.0, raise === 0);
  shotAt(d, 200.0);
  const defender = defenderOf(d);
  while (d.frame < 30) {
    play(d, raise === 0 ? held() : d.frame + 1 < raise ? controls() : d.frame + 1 === raise ? pressed() : held());
    if (defender.visuals.shieldReflect > 0) return { duel: d, contact: d.frame, reflected: defender.projectiles.some((projectile) => projectile.life > 0) };
    if (defender.visuals.shield > 0) return { duel: d, contact: d.frame, reflected: false };
  }
  return undefined;
}

sweep("after a parried projectile every grounded option starts on the next frame", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    for (const option of OPTIONS) {
      let parry: ReturnType<typeof shotOnShield>;
      for (let raise = 1; raise < 20 && parry?.reflected !== true; raise++) parry = shotOnShield(character, raise);
      if (parry === undefined || !parry.reflected) throw new Error(`${name}: no press reflects the shot`);
      const defender = defenderOf(parry.duel);
      assertEquals(defender.projectiles.some((projectile) => projectile.life > 0), true, `${name}: the shot flies back`);
      assertEquals(optionStart(parry.duel, option, 30), parry.contact + 1, `${name} ${option.name} out of a parried shot`);
      const block = shotOnShield(character, 0);
      if (block === undefined) throw new Error(`${name}: the shot never met the held shield`);
      assertEquals(defenderOf(block.duel).shield.stun > 0, true, `${name}: a blocked shot has shieldstun`);
      const start = optionStart(block.duel, option, 30);
      assertEquals(start === undefined || start > block.contact + 1, true, `${name} ${option.name} waits out shieldstun after a blocked shot`);
    }
  }
});
