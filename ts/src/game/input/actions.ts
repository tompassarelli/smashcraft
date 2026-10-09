// Action numbers are bit positions in the companion I4 protocol and must not change.




export const Action = {
  moveLeft: 0,
  moveRight: 1,
  moveDown: 2,
  moveUp: 3,
  jump: 4,
  attack: 5,
  special: 6,
  grab: 7,
  leftTrigger: 8,
  rightTrigger: 9,
  smashLeft: 10,
  smashRight: 11,
  smashUp: 12,
  smashDown: 13,
  walk: 14,
  lightShield: 15,
  shortHop: 16,
} as const;

export type Action = (typeof Action)[keyof typeof Action];

// Saved action order must not depend on Lua table iteration.
export const ACTION_ORDER: readonly Action[] = Object.values(Action).sort((left, right) => left - right);

export const ACTION_COUNT = ACTION_ORDER.length;


export const ALL_ACTIONS = (1 << ACTION_COUNT) - 1;

export function bit(action: Action): number {
  return 1 << action;
}

export function maskOf(...actions: Action[]): number {
  let mask = 0;
  for (const action of actions) mask |= bit(action);
  return mask;
}

export function has(mask: number, action: Action): boolean {
  return (mask & (1 << action)) !== 0;
}
