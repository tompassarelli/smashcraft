import { parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { copyMatchState, createMatchState, Phase, requestStageSelect, requestStart, selectStage, setParticipants, beginRematchCountdown, tickRematchCountdown, leaveMatch, changeStagePoolMode, changeStagePoolStage } from "../match/rules";
import { RANDOM_STAGE, STAGE_CATALOG } from "./stageCatalog";
import { activeStageMask, createStagePool, nextPoolStage, stagePoolCount, togglePoolMode, togglePoolStage } from "./stagePool";

const ready = () => {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  game.characterReadiness[0] = true;
  return game;
};

test("stage pools: 500 seeded cycles stay inside the pool, cover it before repeating and reshuffle [k2 property]", () => {
  const pool = createStagePool();
  for (const stage of STAGE_CATALOG) if (stage.id !== 2 && stage.id !== 10 && stage.id !== 11) togglePoolStage(pool, stage.id);
  let changed = false;
  let first = -1;
  for (let cycle = 0; cycle < 500; cycle++) {
    const drawn: number[] = [];
    for (let pick = 0; pick < 3; pick++) {
      const stage = nextPoolStage(pool, cycle * 3 + pick);
      assertTrue(stage === 2 || stage === 10 || stage === 11);
      assertTrue(!drawn.includes(stage));
      drawn.push(stage);
      if (pick === 0) {
        if (first < 0) first = stage;
        else if (stage !== first) changed = true;
      }
    }
    assertEquals(drawn.length, 3);
  }
  assertTrue(changed);
});

test("stage pools: copied replay state draws exactly the same next 27 stages [k1 scenario]", () => {
  const original = ready();
  requestStageSelect(original, 0);
  for (const stage of STAGE_CATALOG) if (stage.id !== 2 && stage.id !== 10 && stage.id !== 11) changeStagePoolStage(original, 0, stage.id);
  changeStagePoolMode(original, 0);
  requestStart(original, 0);
  const restored = createMatchState();
  copyMatchState(restored, original);
  const record = parseRecord(recordTokens({ pool: original.stagePool }) ?? []);
  const pool = record?.pool;
  if (typeof pool !== "object" || pool === null || !("only" in pool) || typeof pool.only !== "boolean"
    || !("selectedMask" in pool) || typeof pool.selectedMask !== "number" || !("remainingMask" in pool) || typeof pool.remainingMask !== "number") throw new Error("the recorded pool did not round-trip");
  restored.stagePool.only = pool.only;
  restored.stagePool.selectedMask = pool.selectedMask;
  restored.stagePool.remainingMask = pool.remainingMask;
  for (let match = 0; match < 27; match++) {
    for (const game of [original, restored]) {
      game.matchFrame = 60;
      game.phase = Phase.characterMenu;
      requestStageSelect(game, 0);
      requestStart(game, 0);
    }
    assertEquals(restored.stageChoice, original.stageChoice);
    assertEquals(restored.matchSeed, original.matchSeed);
    assertEquals(restored.stagePool.remainingMask, original.stagePool.remainingMask);
  }
});
