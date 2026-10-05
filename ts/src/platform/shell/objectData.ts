import { FIGHTER_OBJECT_ORDER, FIGHTER_OBJECTS } from "../../game/objectData";
import { checksum } from "waygate/src/runtime/payload";
import { writeLines } from "waygate/src/platform/fileio";
import { applyFighterObject, applyFileIoObject } from "../objectData";
import { confirmedChecksum } from "./diagnostics";
import { shellState } from "./state";

/** install() already runs on the same synchronized frame on every client. */
export function installObjectData(): void {
  applyFileIoObject();
  const s = shellState();
  if (s === undefined) return;
  const fields: string[] = [];
  for (const participant of s.participants) {
    const body = participant.body;
    if (body === undefined) continue;
    const id = GetUnitTypeId(body.unit);
    for (const character of FIGHTER_OBJECT_ORDER) {
      const definition = FIGHTER_OBJECTS[character];
      if (definition.id !== id) continue;
      applyFighterObject(body.unit, definition);
      fields.push(`slot ${participant.slot} unit ${id} handle ${GetHandleId(body.unit)} speed ${GetUnitMoveSpeed(body.unit)} cooldown ${BlzGetUnitAttackCooldown(body.unit, 0)}`);
    }
  }
  if (!s.build.devConsole) return;
  const text = fields.join("\n");
  const objectChecksum = checksum(text.length, index => text.charCodeAt(index));
  writeLines(`smashcraft-object-data-p${GetPlayerId(GetLocalPlayer())}.txt`, [
    `object-data frame ${s.runtime.simulationFrame} objects ${objectChecksum} state ${confirmedChecksum(s)}`,
    ...fields,
  ]);
}
