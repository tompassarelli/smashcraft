// The unit each fighter animates when no pool presents it. Every client
// creates the same units, as shared handles, at the same synchronized points.
import { f32 } from "waygate/src/sim/f32";
import { ShieldBreak } from "../../game/sim/codes";
import { fighterPoseFacing } from "../../game/sim/conditions";
import type { Fighter } from "../../game/sim/fighter";
import { FLOOR_HEIGHT, type WorldOrigin } from "../../game/render/effects";
import type { FighterBody } from "./state";
import { FIGHTER_OBJECTS } from "../../game/objectData";
import { applyFighterObject } from "../objectData";

/** Crow Form, added and removed so the unit's flying height can change. */
const CROW_FORM = 0x416d7266;
/** Locust: no selection, no collision. */
const LOCUST = 0x416c6f63;
const DIZZY_MODEL = "Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx";

export function placeFighterBody(body: FighterBody, fighter: Readonly<Fighter>, origin: WorldOrigin): void {
  SetUnitX(body.unit, origin.x + fighter.motion.x);
  SetUnitY(body.unit, origin.y);
  SetUnitFlyHeight(body.unit, FLOOR_HEIGHT + fighter.motion.z, 0.0);
  BlzSetUnitFacingEx(body.unit, fighterPoseFacing(fighter) > 0 ? 0.0 : 180.0);
}

export function createFighterBody(owner: player, fighter: Readonly<Fighter>, origin: WorldOrigin): FighterBody {
  const definition = FIGHTER_OBJECTS[fighter.character];
  const unit = CreateUnit(owner, definition.id, origin.x + fighter.motion.x, origin.y, fighter.facing > 0 ? 0.0 : 180.0);
  applyFighterObject(unit, definition);
  SetUnitInvulnerable(unit, true);
  SetUnitPathing(unit, false);
  UnitAddAbility(unit, CROW_FORM);
  UnitRemoveAbility(unit, CROW_FORM);
  UnitAddAbility(unit, LOCUST);
  PauseUnit(unit, true);
  const body: FighterBody = { unit, dizzy: undefined, renderedSelection: 0 };
  placeFighterBody(body, fighter, origin);
  return body;
}

function clearDizzy(body: FighterBody): void {
  if (body.dizzy === undefined) return;
  BlzSetSpecialEffectScale(body.dizzy, 0.0);
  DestroyEffect(body.dizzy);
  body.dizzy = undefined;
}

/** The dizzy mark follows a shield-broken fighter while the match runs. */
export function renderDizzy(body: FighterBody, fighter: Readonly<Fighter>, playing: boolean, origin: WorldOrigin): void {
  if (fighter.shield.breakState !== ShieldBreak.dizzy || fighter.status.out || !playing) {
    clearDizzy(body);
    return;
  }
  const x = origin.x + fighter.motion.x;
  body.dizzy ??= AddSpecialEffect(DIZZY_MODEL, x, origin.y);
  BlzSetSpecialEffectPosition(body.dizzy, x, origin.y, f32(origin.z + fighter.motion.z + 115));
}

export function removeFighterBody(body: FighterBody): void {
  clearDizzy(body);
  RemoveUnit(body.unit);
}
