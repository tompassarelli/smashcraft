import { STAGE_CATALOG, randomStage, selectableStage } from "./stageCatalog";

const ALL_STAGE_MASK = STAGE_CATALOG.reduce((mask, stage) => mask | (1 << stage.id), 0);

export interface StagePool {
  only: boolean;
  selectedMask: number;
  remainingMask: number;
}

export const createStagePool = (): StagePool => ({ only: false, selectedMask: 0, remainingMask: 0 });
export const activeStageMask = (pool: Readonly<StagePool>): number => pool.only ? pool.selectedMask : ALL_STAGE_MASK ^ pool.selectedMask;
export const stageInPool = (pool: Readonly<StagePool>, choice: number): boolean => (activeStageMask(pool) & (1 << choice)) !== 0;
export const stagePoolCount = (pool: Readonly<StagePool>): number => STAGE_CATALOG.filter(stage => stageInPool(pool, stage.id)).length;

export function copyStagePool(target: StagePool, source: Readonly<StagePool>): void {
  target.only = source.only;
  target.selectedMask = source.selectedMask;
  target.remainingMask = source.remainingMask;
}

export function togglePoolMode(pool: StagePool): void {
  pool.only = !pool.only;
  pool.selectedMask = ALL_STAGE_MASK ^ pool.selectedMask;
}

export function togglePoolStage(pool: StagePool, choice: number): boolean {
  if (!selectableStage(choice)) return false;
  const selected = pool.selectedMask ^ (1 << choice);
  if ((pool.only ? selected : ALL_STAGE_MASK ^ selected) === 0) return false;
  pool.selectedMask = selected;
  pool.remainingMask = 0;
  return true;
}


export function consumePoolStage(pool: StagePool, choice: number): void {
  if (!stageInPool(pool, choice)) return;
  if (pool.remainingMask === 0) pool.remainingMask = activeStageMask(pool);
  pool.remainingMask &= ~(1 << choice);
}

export function nextPoolStage(pool: StagePool, seed: number): number {
  if (pool.remainingMask === 0) pool.remainingMask = activeStageMask(pool);
  const choice = randomStage(seed, pool.remainingMask);
  pool.remainingMask &= ~(1 << choice);
  return choice;
}
