import { ATTACK_BUFFER_FRAMES } from "../input/attackBuffer";
import { advanceTechInput, techInputEligible, TECH_WINDOW_FRAMES } from "../physics/techInput";
import { copyFighterState } from "../replay/fighterState";
import { Character, DownState, GrabAction, ShieldBreak } from "../sim/codes";
import { canAttack, canShieldGrab } from "../sim/conditions";
import { createFighter } from "../sim/fighter";
import { grabContactFrame } from "../sim/moves";
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
export class FighterAgencyForecast {
  private readonly fighter = createFighter(Character.archer, 0.0, 1);
  private readonly world = createRoster(1, [this.fighter]);
  private readonly input = neutralControls();
  private readonly pressedTech = { pressAge: 255, previousPressAge: 255, accumulatedPress: false };

  classify(world: Readonly<Roster>, slot: number, stage: number, frame: number, bufferFrames = ATTACK_BUFFER_FRAMES): FighterAgency {
    const f = fighterAt(world, slot);
    if (f.status.out) return "act";
    if (f.status.frozenFrames > 1) return "none";
    if (f.grab.owner !== undefined) {
      const owner = fighterAt(world, f.grab.owner);
      if (owner.grab.action === GrabAction.hold || owner.grab.action === GrabAction.pummel) {
        return owner.launch.hitlag > 0 || f.launch.hitlag > 0 ? "none" : "act";
      }
      const releasing = owner.launch.hitlag <= 0 && f.launch.hitlag <= 0
        && owner.grab.frame + 1 === grabContactFrame(owner.grab.action);
      return releasing ? "di" : "none";
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
        if (offset >= bufferFrames && this.fighter.motion.grounded) break;
      }
    } finally {
      observedActions.legal = legal;
      observedActions.started = started;
    }
    if (buttons) return "act";
    return f.launch.hitlag > 0 && f.launch.diPending ? "di" : "none";
  }
}
