













import { parseDecimal } from "../netcode/journal/decimal";
import type { AttackCommand } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { type ParticipantSlot, isParticipantSlot } from "../input/participants";
import type { Controls } from "../sim/roster";
import { f32 } from "wisp/src/sim/f32";
import { toReal } from "../../runtime/numbers";

export const TAPE_HEADER = "smashcraft-tape 1";

type FieldOf<V> = { [K in keyof Controls]-?: Controls[K] extends V ? K : never }[keyof Controls];
type FlagField = FieldOf<boolean>;
type NumberField = FieldOf<number | undefined>;

const FLAG_FIELDS: Readonly<Record<FlagField, true>> = {
  diStickValid: true, sdiPulse: true, attackRequested: true, specialPressed: true, ultimatePressed: true, down: true, shield: true,
  shieldPressed: true, shieldTriggerActive: true, jumpPressed: true, shortHopPressed: true, meter: true, airDodgePressed: true, techPressed: true,
  mashPressed: true, attackPressed: true, grabMashPressed: true, groundDodgePressed: true,
  getupAttackPressed: true, getupStandPressed: true, getupDirectionPressed: true, cStickUpFlick: true, jumpHeld: true, walking: true,
  attackHeld: true, resetPressed: true,
};


const NUMBER_FIELDS: Readonly<Record<NumberField, "int" | "real">> = {
  driftStickX: "real",
  direction: "int", verticalDirection: "int", diStickX: "real", diStickZ: "real", sdiX: "int", sdiZ: "int",
  cStickX: "int", cStickZ: "int", specialX: "int", specialZ: "int", shieldStrength: "real", grabThrowX: "int",
  grabThrowZ: "int", groundDodgeDirection: "int", ledgeVerticalPressed: "int", getupDirection: "int", cStickSideFlick: "int",
  dodgeX: "int", dodgeZ: "int",
};

const isFlagField = (name: string): name is FlagField => name in FLAG_FIELDS;
const isNumberField = (name: string): name is NumberField => name in NUMBER_FIELDS;

type ControlAssignment =
  | { readonly kind: "flag"; readonly field: FlagField; readonly value: boolean }
  | { readonly kind: "number"; readonly field: NumberField; readonly value: number };

type MenuOperation = "character" | "stage" | "hazards" | "stocks" | "time";
type MenuRequest = "stage-select" | "start" | "rematch";

export type TapeOperation =
  | { readonly kind: "test-air"; readonly line: number; readonly slot: number; readonly x: number; readonly z: number }
  | { readonly kind: "test-stage"; readonly line: number; readonly stage: number }
  | { readonly kind: "test-meter"; readonly line: number; readonly slot: number; readonly points: number }
  | { readonly kind: "input"; readonly line: number; readonly slot: ParticipantSlot; readonly controls: readonly ControlAssignment[]; readonly attacks: readonly AttackCommand[] }
  | { readonly kind: "frame" | "predict" | "correct"; readonly line: number; readonly frame: number }
  | { readonly kind: "rollback"; readonly line: number; readonly first: number; readonly last: number }
  | { readonly kind: "participants"; readonly line: number; readonly humans: number; readonly computers: number }
  | { readonly kind: MenuOperation; readonly line: number; readonly slot: number; readonly value: number }
  | { readonly kind: MenuRequest; readonly line: number; readonly slot: number };

type Decoded<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly line: number; readonly message: string };

function parseInteger(word: string | undefined): number | undefined {
  if (word === undefined) return undefined;
  if (word.startsWith("-")) {
    const magnitude = parseDecimal(word.slice(1));
    return magnitude === undefined ? undefined : -magnitude;
  }
  return parseDecimal(word);
}

function parseReal(word: string | undefined): number | undefined {
  if (word === undefined || word.length === 0) return undefined;
  const value = Number(word);
  return value === value ? toReal(f32(value)) : undefined;
}

const isDirection = (value: number): value is Direction => value === -1 || value === 0 || value === 1;


function words(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  for (let index = 0; index <= text.length; index++) {
    const code = index < text.length ? text.charCodeAt(index) : 32;

    if (code === 32 || code === 9 || code === 61 || code === 44) {
      if (index > start) result.push(text.slice(start, index));
      start = index + 1;
    }
  }
  return result;
}

function decodeInput(line: number, slot: ParticipantSlot, rest: readonly string[]): Decoded<TapeOperation> {
  const controls: ControlAssignment[] = [];
  const attacks: AttackCommand[] = [];
  const fail = (message: string): Decoded<TapeOperation> => ({ ok: false, line, message });
  let index = 0;
  while (index < rest.length) {
    const name = rest[index] ?? "";
    if (name === "attack") {
      const style = parseInteger(rest[index + 1]);
      const facing = parseInteger(rest[index + 2]);
      const frame = parseInteger(rest[index + 3]);
      const charge = parseInteger(rest[index + 4]);
      if (style === undefined || facing === undefined || !isDirection(facing) || frame === undefined || (charge !== 0 && charge !== 1)) {
        return fail("attack takes STYLE,FACING,FRAME,CHARGE");
      }
      attacks.push({ style, facing, frame, mayCharge: charge === 1 });
      index += 5;
    } else if (isFlagField(name)) {
      const value = parseInteger(rest[index + 1]);
      if (value !== 0 && value !== 1) return fail(`${name} takes 0 or 1`);
      controls.push({ kind: "flag", field: name, value: value === 1 });
      index += 2;
    } else if (isNumberField(name)) {
      const value = NUMBER_FIELDS[name] === "real" ? parseReal(rest[index + 1]) : parseInteger(rest[index + 1]);
      if (value === undefined) return fail(`${name} takes a ${NUMBER_FIELDS[name] === "real" ? "number" : "whole number"}`);
      controls.push({ kind: "number", field: name, value });
      index += 2;
    } else {
      return fail(`unknown input field ${name}`);
    }
  }
  return { ok: true, value: { kind: "input", line, slot, controls, attacks } };
}

function decodeLine(line: number, text: string): Decoded<TapeOperation> | undefined {
  if (text.startsWith("#")) return undefined;
  const [operation, ...rest] = words(text);
  if (operation === undefined) return undefined;
  const fail = (message: string): Decoded<TapeOperation> => ({ ok: false, line, message });
  const numbers = rest.map(word => parseInteger(word));
  const [first, second] = numbers;
  const pair = rest.length === 2 && first !== undefined && second !== undefined;
  const single = rest.length === 1 && first !== undefined;
  switch (operation) {
    case "test-air": {
      const x = parseReal(rest[1]);
      const z = parseReal(rest[2]);
      return rest.length === 3 && first !== undefined && isParticipantSlot(first) && x !== undefined && z !== undefined
        ? { ok: true, value: { kind: "test-air", line, slot: first, x, z } } : fail("test-air takes SLOT X Z");
    }
    case "test-meter":
      return pair && isParticipantSlot(first) ? { ok: true, value: { kind: "test-meter", line, slot: first, points: second } } : fail("test-meter takes SLOT POINTS");
    case "test-stage":
      return single ? { ok: true, value: { kind: "test-stage", line, stage: first } } : fail("test-stage takes a stage number");
    case "input":
      if (first === undefined || !isParticipantSlot(first)) return fail("input takes a participant slot");
      return decodeInput(line, first, rest.slice(1));
    case "frame":
    case "predict":
    case "correct":
      return single ? { ok: true, value: { kind: operation, line, frame: first } } : fail(`${operation} takes a frame number`);
    case "rollback":
      return pair ? { ok: true, value: { kind: "rollback", line, first, last: second } } : fail("rollback takes FIRST LAST");
    case "participants":
      return pair ? { ok: true, value: { kind: "participants", line, humans: first, computers: second } } : fail("participants takes HUMANS COMPUTERS");
    case "character":
    case "stage":
    case "hazards":
    case "stocks":
    case "time":
      return pair ? { ok: true, value: { kind: operation, line, slot: first, value: second } } : fail(`${operation} takes SLOT VALUE`);
    case "stage-select":
    case "start":
    case "rematch":
      return single ? { ok: true, value: { kind: operation, line, slot: first } } : fail(`${operation} takes SLOT`);
    default:
      return fail(`unknown operation ${operation}`);
  }
}


export function decodeTape(text: string): Decoded<readonly TapeOperation[]> {
  const lines = text.split("\n");
  if (lines[0] !== TAPE_HEADER) return { ok: false, line: 1, message: `expected "${TAPE_HEADER}"` };
  const operations: TapeOperation[] = [];
  for (let index = 1; index < lines.length; index++) {
    const decoded = decodeLine(index + 1, lines[index] ?? "");
    if (decoded === undefined) continue;
    if (!decoded.ok) return decoded;
    operations.push(decoded.value);
  }
  return { ok: true, value: operations };
}

export function applyControls(target: Controls, assignments: readonly ControlAssignment[]): void {
  for (const assignment of assignments) {
    if (assignment.kind === "flag") target[assignment.field] = assignment.value;
    else target[assignment.field] = assignment.value;
  }
}
