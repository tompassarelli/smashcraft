import type { Fighter } from "./fighter";


interface InfluenceOperands {
  x: number;
  z: number;
  stickX: number;
  stickZ: number;
  degrees: number;
  angleRadians: number;
  recorded: boolean;
}

const lastInfluence = new WeakMap<Fighter, InfluenceOperands>();


export function initializeInfluenceOperands(fighter: Fighter): void {
  lastInfluence.set(fighter, { x: 0.0, z: 0.0, stickX: 0.0, stickZ: 0.0, degrees: 0.0, angleRadians: 0.0, recorded: false });
}

export function ownedInfluenceOperands(fighter: Fighter): InfluenceOperands {
  const operands = lastInfluence.get(fighter);
  if (operands === undefined) throw new Error("fighter has no DI trace storage");
  return operands;
}


export function influenceOperands(fighter: Fighter): Readonly<InfluenceOperands> | undefined {
  const operands = ownedInfluenceOperands(fighter);
  return operands.recorded ? operands : undefined;
}
