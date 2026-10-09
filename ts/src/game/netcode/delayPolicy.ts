import { floorDiv } from "wisp/src/sim/intMath";

// Integer milliseconds and frames only, so Bun and both Lua32 modes decide alike.

export const DEFAULT_DELAY = 2;
export const ROLLBACK_BUDGET = 7;
export const MAX_FIXED_DELAY = 8;
export const HIGH_DELAY_FRAMES = 8;
export const AUTO_DELAY = -1;
export const TIME_SYNC_INTERVAL = 60;

export type DelayChoice = number;

export interface DelayPolicy {
  readonly floor: number;
  readonly ceiling: number;
  readonly window: number;
  readonly budget: number;
}

export function delayPolicy(window: number, ceiling: number = MAX_FIXED_DELAY, budget: number = ROLLBACK_BUDGET, floor: number = DEFAULT_DELAY): DelayPolicy {
  return { floor, ceiling: Math.max(floor, ceiling), window, budget: Math.min(budget, window - 1) };
}

export interface RttEstimate {
  samples: number;
  smoothed8: number;
  variance4: number;
}

export const rttEstimate = (): RttEstimate => ({ samples: 0, smoothed8: 0, variance4: 0 });

export function resetRtt(estimate: RttEstimate): void {
  estimate.samples = 0;
  estimate.smoothed8 = 0;
  estimate.variance4 = 0;
}

export function observeRtt(estimate: RttEstimate, rttMs: number): void {
  const sample = Math.max(0, Math.min(10000, Math.floor(rttMs)));
  if (estimate.samples === 0) {
    estimate.smoothed8 = sample * 8;
    estimate.variance4 = sample * 2;
  } else {
    const error = sample - floorDiv(estimate.smoothed8, 8);
    estimate.variance4 += Math.abs(error) - floorDiv(estimate.variance4, 4);
    estimate.smoothed8 += error;
  }
  estimate.samples = Math.min(estimate.samples + 1, 1000000);
}

export const smoothedRttMs = (estimate: Readonly<RttEstimate>): number => floorDiv(estimate.smoothed8, 8);

const guardedRttMs = (estimate: Readonly<RttEstimate>): number => smoothedRttMs(estimate) + floorDiv(estimate.variance4, 2);

export const oneWayFrames = (rttMs: number): number => Math.max(0, floorDiv(rttMs * 3 + 99, 100));

const clampDelay = (policy: DelayPolicy, delay: number): number => Math.min(policy.ceiling, Math.max(policy.floor, delay));

const delayForRtt = (policy: DelayPolicy, rttMs: number): number => clampDelay(policy, oneWayFrames(rttMs) - policy.budget);

export function autoDelay(policy: DelayPolicy, estimate: Readonly<RttEstimate>): number {
  return estimate.samples === 0 ? policy.floor : delayForRtt(policy, guardedRttMs(estimate));
}

export function nextDelay(policy: DelayPolicy, estimate: Readonly<RttEstimate>, current: number): number {
  const target = autoDelay(policy, estimate);
  if (target >= current) return target;
  const lowered = estimate.samples === 0 ? target : delayForRtt(policy, guardedRttMs(estimate) + 34);
  return lowered < current ? lowered : clampDelay(policy, current);
}

export function expectedRollback(estimate: Readonly<RttEstimate>, delay: number): number {
  return Math.max(0, oneWayFrames(smoothedRttMs(estimate)) - delay);
}

export function connectionPoor(policy: DelayPolicy, estimate: Readonly<RttEstimate>, delay: number): boolean {
  return estimate.samples > 0 && oneWayFrames(smoothedRttMs(estimate)) > policy.budget + delay;
}

export const highDelay = (delay: number): boolean => delay >= HIGH_DELAY_FRAMES;

export const isDelayChoice = (value: number): value is DelayChoice => value === AUTO_DELAY || (Math.floor(value) === value && value >= 0 && value <= MAX_FIXED_DELAY);

export const requestedDelay = (choice: DelayChoice, auto: number): number => (choice === AUTO_DELAY ? auto : choice);

export function agreedDelay(requests: readonly number[], fallback: number = DEFAULT_DELAY): number {
  let agreed = -1;
  for (const request of requests) agreed = Math.max(agreed, request);
  return agreed < 0 ? fallback : agreed;
}

export function timeSyncWait(localAdvantage: number, remoteAdvantage: number, framesSinceWait: number): boolean {
  return framesSinceWait >= TIME_SYNC_INTERVAL && localAdvantage - remoteAdvantage >= 2;
}
