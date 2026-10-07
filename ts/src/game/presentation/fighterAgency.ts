import { ATTACK_BUFFER_FRAMES } from "../input/attackBuffer";
import { advanceTechInput, techInputEligible, TECH_WINDOW_FRAMES } from "../physics/techInput";
import { copyFighterState } from "../replay/fighterState";
import { Character, DownState, GrabAction, LedgeState, PlatformMove, ShieldBreak, SurfaceContact } from "../sim/codes";
import { inStageCannon } from "../sim/stageHazards";
import { surelyClear } from "./agencyClearance";
import { canAttack, canShieldGrab } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { advanceGrabs, resolveGrabs } from "../sim/grabs";
import { grabContactFrame } from "../sim/moves";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import { observedActions } from "../sim/observations";
import { createRoster, fighterAt, neutralControls, type Roster } from "../sim/roster";
import { advanceFighterMotion } from "../sim/step";

export type FighterAgency = "none" | "di" | "act";

/**
 * The marker describes the next input frame. Countdown gates are current
 * state; a bounded single-fighter motion forecast uses the actual collision
 * rules for the button buffer and tech window. It runs no attacks, opponent
 * plan or alternative input replays, and never advances the live match.
 */
/** Forecast frames between clearance checks while a tumble is still near something. */
const CLEARANCE_RECHECK = 3;

/** A tumble whose next frames only gravity, decay and drag move: no hitlag, freeze, ledge, wall or platform state, out or in the cannon. */
function clearFlight(f: Readonly<Fighter>): boolean {
  return f.down.state === DownState.tumble && !f.motion.grounded && f.launch.hitlag === 0 && f.status.frozenFrames === 0 && !f.status.out
    && f.ledge.state === LedgeState.none && f.surfaceRecovery.state === SurfaceContact.none && f.platform.move === PlatformMove.none && !inStageCannon(f);
}

export class FighterAgencyForecast {
  private readonly fighter = createFighter(Character.archer, 0.0, 1);
  private readonly world = createRoster(1, [this.fighter]);
  private readonly input = neutralControls();
  private readonly pressedTech = { pressAge: 255, previousPressAge: 255, accumulatedPress: false };
  // A committed throw and its victim, played to the release and the landing after it.
  private readonly holder = createFighter(Character.archer, 0.0, 1);
  private readonly thrown = createFighter(Character.archer, 0.0, 1);
  private readonly throwWorld = createRoster(3, [this.holder, this.thrown]);
  private readonly throwInputs = [neutralControls(), neutralControls()];

  /** `bounded`: stop a forecast once the tumble surely touches nothing for the rest of the window (agencyClearance.ts); off, every frame is simulated. */
  constructor(private readonly bounded = true) {}

  classify(world: Readonly<Roster>, slot: number, stage: number, frame: number, bufferFrames = ATTACK_BUFFER_FRAMES): FighterAgency {
    const f = fighterAt(world, slot);
    if (f.status.out) return "act";
    if (f.status.frozenFrames > 1) return "none";
    if (heroStatusBlocksActions(f) && f.status.conditionFrames > 1) return "none";
    if (f.grab.owner !== undefined) {
      const owner = fighterAt(world, f.grab.owner);
      if (owner.grab.action === GrabAction.hold || owner.grab.action === GrabAction.pummel) {
        return owner.launch.hitlag > 0 || f.launch.hitlag > 0 ? "none" : "act";
      }
      const free = owner.launch.hitlag <= 0 && f.launch.hitlag <= 0;
      const release = grabContactFrame(owner.grab.action, owner.tuning.moves) - owner.grab.frame;
      // A throw that tumbles its victim onto the floor soon after the release takes a tech press made while held.
      if (free && release <= TECH_WINDOW_FRAMES && this.techPressCounts(world, owner, f, stage, frame)) return "act";
      return free && release === 1 ? "di" : "none";
    }
    if (f.status.frozenFrames === 0 && f.launch.hitlag === 0
      && (f.down.state === DownState.bound || f.down.state === DownState.wait || f.shield.breakState === ShieldBreak.dizzy)) return "act";
    const controlled = f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.status.frozenFrames > 0
      || f.down.state !== DownState.none || f.shield.breakState !== ShieldBreak.none || f.shield.stun > 0;
    if (!controlled) return "act";

    copyFighterState(this.fighter, f, world.mask);
    this.fighter.grab.owner = undefined;
    this.fighter.grab.target = undefined;
    this.pressedTech.pressAge = f.tech.pressAge;
    this.pressedTech.previousPressAge = f.tech.previousPressAge;
    this.pressedTech.accumulatedPress = f.tech.accumulatedPress;
    const legal = observedActions.legal;
    const started = observedActions.started;
    let buttons = false;
    let nextCheck = 0;
    try {
      for (let offset = 0; offset < TECH_WINDOW_FRAMES; offset++) {
        const before = this.fighter.down.state;
        const recoverySerial = this.fighter.surfaceRecovery.contactSerial;
        if (this.fighter.status.frozenFrames <= 0) {
          advanceTechInput(this.pressedTech, offset === 0, this.fighter.launch.hitlag > 1);
        }
        advanceFighterMotion(this.world, 0, stage, frame + offset + 1, this.input, 0.0);
        // A request on this frame survives six later frames, inclusive.
        if (offset <= bufferFrames && (canAttack(this.fighter) || canShieldGrab(this.fighter))) {
          buttons = true;
          break;
        }
        const floorContact = before === DownState.tumble && this.fighter.down.state !== DownState.tumble;
        const solidContact = before === DownState.tumble && this.fighter.surfaceRecovery.contactSerial !== recoverySerial;
        if ((floorContact || solidContact) && techInputEligible(this.pressedTech) !== techInputEligible(this.fighter.tech)) {
          buttons = true;
          break;
        }
        // Past the buffer only a tumbling fighter's contact can tech, and motion
        // alone never starts a tumble (only a hit does), so the answer is known.
        if (offset >= bufferFrames && (this.fighter.motion.grounded || this.fighter.down.state !== DownState.tumble)) break;
        // A tumble that surely touches nothing for the rest of the window can't tech in it either (#168).
        if (offset >= bufferFrames && offset >= nextCheck && this.bounded && clearFlight(this.fighter)) {
          if (surelyClear(this.fighter, stage, frame + offset + 1, TECH_WINDOW_FRAMES - 1 - offset)) break;
          nextCheck = offset + CLEARANCE_RECHECK;
        }
      }
    } finally {
      observedActions.legal = legal;
      observedActions.started = started;
    }
    if (buttons) return "act";
    return f.launch.hitlag > 0 && f.launch.diPending ? "di" : "none";
  }

  /** Whether a tech press now, while `thrown` is held in `owner`'s committed throw, would change its landing. */
  private techPressCounts(world: Readonly<Roster>, owner: Readonly<Fighter>, thrown: Readonly<Fighter>, stage: number, frame: number): boolean {
    copyFighterState(this.holder, owner, world.mask);
    copyFighterState(this.thrown, thrown, world.mask);
    this.holder.grab.target = 1;
    this.thrown.grab.owner = 0;
    this.pressedTech.pressAge = thrown.tech.pressAge;
    this.pressedTech.previousPressAge = thrown.tech.previousPressAge;
    this.pressedTech.accumulatedPress = thrown.tech.accumulatedPress;
    const legal = observedActions.legal;
    const started = observedActions.started;
    let nextCheck = 0;
    try {
      for (let offset = 0; offset < TECH_WINDOW_FRAMES; offset++) {
        const before = this.thrown.down.state;
        const recoverySerial = this.thrown.surfaceRecovery.contactSerial;
        advanceTechInput(this.pressedTech, offset === 0, this.thrown.launch.hitlag > 1);
        advanceFighterMotion(this.throwWorld, 0, stage, frame + offset + 1, this.throwInputs[0] ?? neutralControls(), 0.0);
        advanceFighterMotion(this.throwWorld, 1, stage, frame + offset + 1, this.throwInputs[1] ?? neutralControls(), 0.0);
        resolveGrabs(this.throwWorld);
        advanceGrabs(this.throwWorld, this.throwInputs);
        resolveGrabs(this.throwWorld);
        const floorContact = before === DownState.tumble && this.thrown.down.state !== DownState.tumble;
        const solidContact = before === DownState.tumble && this.thrown.surfaceRecovery.contactSerial !== recoverySerial;
        if (floorContact || solidContact) return techInputEligible(this.pressedTech) !== techInputEligible(this.thrown.tech);
        if (this.thrown.grab.owner === undefined && this.thrown.down.state !== DownState.tumble) return false;
        // Released and tumbling clear of everything for the rest of the window: no contact to tech (#168).
        if (offset >= nextCheck && this.bounded && this.thrown.grab.owner === undefined && this.holder.grab.target === undefined && clearFlight(this.thrown)) {
          if (surelyClear(this.thrown, stage, frame + offset + 1, TECH_WINDOW_FRAMES - 1 - offset)) return false;
          nextCheck = offset + CLEARANCE_RECHECK;
        }
      }
    } finally {
      observedActions.legal = legal;
      observedActions.started = started;
    }
    return false;
  }
}
