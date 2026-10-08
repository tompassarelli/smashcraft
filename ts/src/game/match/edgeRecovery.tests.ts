// Recovery contacts with the stage (smashcraft:docs/gameplay-design.md,
// "Recovery and edgeguarding"): wall rides, teleports through the edge, ledge
// catches during an up special, and the recovery envelope's bands, played
// through the keyboard path and the real frame executor.
import { assertDefined, assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { sweep } from "../../runtime/sweep";
import { Character, LedgeState, SpecialAction } from "../sim/codes";
import { ledgeCatchBox } from "../sim/ledge";
import { WARDEN_SPECIALS } from "../sim/heroes/wardenSpecials";
import { mainDeckRight } from "../sim/stage";
import { insideMainDeckBody } from "../sim/surfaces";
import { TELEPORT_LEDGE_INSET, TELEPORT_LIP_DEPTH } from "../sim/edgeRecovery";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import {
  AWAY, DOWN, HEIGHT_PROBE_OUT, REACH_PROBE_DEPTH, RECOVERY_BANDS, RECOVERY_PLANS, type RecoveryRun, SPECIAL, TOWARD, UP,
  playKeys, recovered, recovers, recoveryArchetype, recoveryEnvelope, recoveryRun,
} from "./recoveryEnvelope";

const LEDGE = mainDeckRight(0);
const BLINK_STEP = assertDefined(WARDEN_SPECIALS.up.ground.motion?.find((segment) => segment.throughEdge), "Blink step");
const BLINK_DIAGONAL = f32(assertDefined(BLINK_STEP.aimedSpeed, "Blink distance") * f32(0.707106781));

/** Fails naming `label` when `ok` is false. */
const check = (ok: boolean, label: string): void => assertEquals(ok ? "" : label, "");

/**
 * Presses up special at rest beside the right ledge, holds `aim` through its
 * startup and then toward the stage, for `frames` frames or until it gets back;
 * calls `each` after every frame.
 */
function upSpecial(run: RecoveryRun, aim: number, frames: number, each?: (frame: number) => void): void {
  for (let frame = 1; frame <= frames; frame++) {
    playKeys(run, frame === 1 ? SPECIAL | UP | (aim & TOWARD) : frame <= 12 ? aim : TOWARD);
    each?.(frame);
    if (recovered(run.fighter) || run.fighter.status.out) return;
  }
}

test("[spec #252] an up special that meets the stage wall level rides up it and gets back", () => {
  // Blademaster's charged dash aimed level at the wall beside the lip would stop dead and fall without the ride.
  const run = recoveryRun(Character.blademaster, 100, 700.0, -45.0);
  let rose = false;
  upSpecial(run, TOWARD, 120, () => {
    const { motion } = run.fighter;
    if (motion.x <= f32(LEDGE + 13.0) && motion.z > -45.0) rose = true;
  });
  check(rose, "never rose along the wall");
  check(recovered(run.fighter), `ended at ${run.fighter.motion.x},${run.fighter.motion.z}`);
});

test("[invariant] a wall ride replays frame for frame and never enters the stage", () => {
  const path = (): string[] => {
    const run = recoveryRun(Character.rifleman, 100, 660.0, -50.0);
    const rows: string[] = [];
    upSpecial(run, TOWARD, 90, () => {
      const { x, z } = run.fighter.motion;
      check(!insideMainDeckBody(0, x, z), `inside the stage at ${x},${z}`);
      rows.push(`${x},${z}`);
    });
    return rows;
  };
  assertEquals(path().join(" "), path().join(" "));
});

/** Warden at (x, z) facing the stage, Blink aimed by `aim`; the teleport frame's outcome. */
function blink(x: number, z: number, aim: number, hogged = false): RecoveryRun {
  const run = recoveryRun(Character.warden, 100, x, z);
  if (hogged) {
    const hog = assertDefined(run.match.world.fighters[1], "hog");
    hog.ledge.state = LedgeState.hang;
    hog.ledge.side = 1;
  }
  upSpecial(run, aim, BLINK_STEP.last + 1);
  return run;
}

test("[spec #252] a Blink that enters the stage through its lip passes it: above the deck, onto the ledge or onto the deck", () => {
  // Up and in from 150 below: the path meets the lip 50 below the top and ends above the deck.
  const over = blink(700.0, -150.0, TOWARD | UP).fighter;
  check(over.motion.z > 0.0 && over.motion.x < LEDGE && !insideMainDeckBody(0, over.motion.x, over.motion.z), `over ${over.motion.x},${over.motion.z}`);
  // Ending 20 below the top and 30 in from the ledge: it catches the ledge.
  const hang = blink(f32(570.0 + BLINK_DIAGONAL), f32(-20.0 - BLINK_DIAGONAL), TOWARD | UP).fighter;
  assertEquals(hang.ledge.state, LedgeState.hang);
  assertEquals(hang.special.action, SpecialAction.none);
  // Level from 30 below, ending far in from the ledge: it stands on the deck.
  const land = blink(800.0, -30.0, TOWARD).fighter;
  check(land.motion.grounded && land.motion.z === 0.0 && land.motion.x < f32(LEDGE - TELEPORT_LEDGE_INSET), `land ${land.motion.x},${land.motion.z}`);
});

test("[spec #252] a Blink that meets the stage below its lip stops there, and a taken ledge leaves it outside the lip", () => {
  const deep = blink(700.0, -300.0, TOWARD | UP).fighter;
  check(!deep.motion.grounded && deep.ledge.state === LedgeState.none && deep.motion.z < f32(-TELEPORT_LIP_DEPTH), `deep ${deep.motion.x},${deep.motion.z}`);
  check(!insideMainDeckBody(0, deep.motion.x, deep.motion.z), "deep ended inside the stage");
  const hogged = blink(f32(570.0 + BLINK_DIAGONAL), f32(-20.0 - BLINK_DIAGONAL), TOWARD | UP, true).fighter;
  assertEquals(hogged.ledge.state, LedgeState.none);
  check(hogged.motion.x > LEDGE && hogged.motion.z < 0.0, `hogged ${hogged.motion.x},${hogged.motion.z}`);
});

test("[spec #252] an up special that comes down beside the ledge catches it before its helpless fall", () => {
  // Kael'thas's flight aimed down and in from above and outside the ledge.
  const run = recoveryRun(Character.kaelthas, 100, 760.0, 160.0);
  let caughtDuringSpecial = false;
  upSpecial(run, TOWARD | DOWN, 60, () => {
    const f = run.fighter;
    if (f.ledge.state === LedgeState.hang && !f.special.fall) caughtDuringSpecial = true;
  });
  check(caughtDuringSpecial, `ended at ${run.fighter.motion.x},${run.fighter.motion.z}`);
  assertEquals(run.fighter.special.lockFrames, 0);
  assertEquals(run.fighter.attack.cooldown, 0);
});

test("[spec #252] a hero taller than the reference catches a ledge higher above its feet", () => {
  const tall = ledgeCatchBox(Character.cairne);
  const reference = ledgeCatchBox(Character.rifleman);
  check(tall.highest > reference.highest && tall.reach > reference.reach, `${tall.highest} ${tall.reach}`);
  // Falling past the ledge with it just above Rifleman's box: Cairne catches, Rifleman doesn't.
  const above = f32(reference.highest + 10.0);
  for (const [character, catches] of [[Character.cairne, true], [Character.rifleman, false]] as const) {
    const run = recoveryRun(character, 100, f32(LEDGE + 30.0), f32(-above + 6.0));
    run.fighter.special.fall = true;
    for (let frame = 0; frame < 4; frame++) playKeys(run, 0);
    assertEquals(run.fighter.ledge.state === LedgeState.hang, catches, fighterName(character));
  }
});

/** Every up special in eight aims from four starts beside the wall: no frame ends inside the stage. */
function staysOutside(character: Character): void {
  for (const [x, z] of [[640.0, -40.0], [700.0, -120.0], [660.0, -250.0], [820.0, -60.0]] as const) {
    for (const aim of [UP, TOWARD | UP, TOWARD, TOWARD | DOWN, DOWN, AWAY | UP, AWAY, AWAY | DOWN]) {
      const run = recoveryRun(character, 100, x, z);
      upSpecial(run, aim, 60, () => {
        const { motion } = run.fighter;
        check(!insideMainDeckBody(0, motion.x, motion.z), `${fighterName(character)} from ${x},${z} aim ${aim} inside at ${motion.x},${motion.z}`);
      });
    }
  }
}

test("[invariant] Warden's and Blademaster's up specials never end a frame inside the stage", () => {
  staysOutside(Character.warden);
  staysOutside(Character.blademaster);
});

sweep("[invariant] no fighter's up special ends a frame inside the stage", () => {
  for (const character of SELECTABLE_CHARACTERS) staysOutside(character);
});

/** The envelope of one fighter against its archetype's floors. */
function meetsEnvelope(character: Character): void {
  const band = assertDefined(RECOVERY_BANDS[recoveryArchetype(character)], "band");
  const name = `${fighterName(character)} (${band.name})`;
  const full = recoveryEnvelope(character, 100);
  check(full.height >= band.heightMin && full.reach >= band.envelopeReachMin, `${name} full ${full.height}/${full.reach}`);
  const free = recoveryEnvelope(character, 0);
  check(free.height === full.height && free.reach === full.reach, `${name} zero meter ${free.height}/${free.reach}, full ${full.height}/${full.reach}`);
}

test("[spec #252] [spec #335] Warden's recovery envelope meets the vertical band's floors at zero and full meter", () => {
  const character = Character.warden;
  const band = assertDefined(RECOVERY_BANDS[recoveryArchetype(character)], "band");
  // The suite checks the four required starts; the farm searches the whole envelope.
  for (const mana of [100, 0]) {
    const height = band.heightMin;
    const reach = band.envelopeReachMin;
    check(RECOVERY_PLANS.some((plan) => recovers(character, mana, f32(LEDGE + HEIGHT_PROBE_OUT), -height, plan)), `Warden mana ${mana} height floor ${height}`);
    check(RECOVERY_PLANS.some((plan) => recovers(character, mana, f32(LEDGE + reach), -REACH_PROBE_DEPTH, plan)), `Warden mana ${mana} reach floor ${reach}`);
  }
});

for (const character of SELECTABLE_CHARACTERS) {
  sweep(`[spec #252] [spec #335] ${fighterName(character)}'s recovery envelope meets its archetype's floors equally at zero and full meter`, () => {
    meetsEnvelope(character);
  });
}
