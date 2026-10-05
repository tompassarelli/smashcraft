import { FILE_IO_OBJECT, type FighterObject } from "../game/objectData";

/** Called on creation and on the synchronized reload frame; never replaces a handle. */
export function applyFighterObject(whichUnit: unit, definition: FighterObject): void {
  BlzSetUnitName(whichUnit, definition.name);
  SetUnitScale(whichUnit, definition.scale, definition.scale, definition.scale);
  SetUnitBlendTime(whichUnit, definition.blendTime);
  BlzSetUnitRealField(whichUnit, UNIT_RF_SELECTION_SCALE, definition.selectionScale);
  SetUnitMoveSpeed(whichUnit, definition.moveSpeed);
  BlzSetUnitAttackCooldown(whichUnit, definition.attackCooldown, 0);
}

/** FileIO reads synchronously, so install runs between complete reads. */
export function applyFileIoObject(): void {
  for (let level = 0; level < FILE_IO_OBJECT.levels; level++) {
    BlzSetAbilityTooltip(FILE_IO_OBJECT.id, FILE_IO_OBJECT.tooltip, level);
  }
}
