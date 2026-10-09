import { FIGHTER_OBJECT_ORDER, FIGHTER_OBJECTS } from "../../game/objectData";
import { checksum } from "wisp/src/runtime/payload";
import { writeLines } from "wisp/src/platform/fileio";
import { applyFighterObject, applyFileIoObject } from "../objectData";
import { confirmedChecksum } from "./diagnostics";
import { shellState } from "./state";
import { objectDataReceiptFile } from "../../runtime/gameFiles";

// install() runs on the same synchronized frame on every client.
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
  writeLines(objectDataReceiptFile(GetPlayerId(GetLocalPlayer())), [
    `object-data frame ${s.runtime.simulationFrame} objects ${objectChecksum} state ${confirmedChecksum(s)}`,
    ...fields,
  ]);
}
