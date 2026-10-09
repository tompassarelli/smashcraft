



export const observedActions = { legal: 0, started: 0 };

export function resetObservedActions(): void {
  observedActions.legal = 0;
  observedActions.started = 0;
}

export function observeActionDecision(mask: number): void {
  observedActions.legal |= mask;
}

export function observeActionStart(mask: number): void {
  observedActions.started |= mask;
}
