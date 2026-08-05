import test from "node:test";
import assert from "node:assert/strict";
import { appendEvent, createGameEvent } from "../src/core/events.js";
import { INNISTRAD_FIXED_REWARDS } from "../src/data/reward-data.js";
import { createInitialState } from "../src/state/initial-state.js";
import {
  acknowledgeAchievement,
  applyCareerDelta,
} from "../src/systems/career.js";
import { grantReward } from "../src/systems/rewards.js";
import { recordTerritoryVictory } from "../src/systems/world-map.js";

function createState() {
  return createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-CAREER",
  });
}

test("新游戏建立零值永久统计并由正式事件累计生命周期数据", () => {
  let state = createState();
  assert.equal(state.careerProgress.counters.blueprintsCreated, 0);
  assert.equal(state.careerProgress.legacyBaseline, false);

  state = appendEvent(state, createGameEvent("BLUEPRINT_SAVED", {
    blueprintId: "BLUEPRINT_TEST",
    name: "测试原体",
  }, 2000));
  assert.equal(state.careerProgress.counters.blueprintsCreated, 1);
  assert.equal(state.careerProgress.counters.prototypesInstantiated, 1);
  assert.ok(
    state.achievementProgress.unlocked.ACHIEVEMENT_FIRST_BLUEPRINT,
  );
  assert.ok(
    state.achievementProgress.pendingIds.includes(
      "ACHIEVEMENT_FIRST_BLUEPRINT",
    ),
  );

  state = acknowledgeAchievement(state, "ACHIEVEMENT_FIRST_BLUEPRINT");
  assert.equal(state.achievementProgress.pendingIds.length, 0);
  state = appendEvent(state, createGameEvent(
    "LEGION_PRODUCTION_COMPLETED",
    { legionId: "LEGION_TEST", replicaCount: 50 },
    3000,
  ));
  assert.equal(state.careerProgress.counters.replicasCreated, 50);
  assert.equal(
    state.careerProgress.records.highestReplicasCreatedAtOnce.value,
    50,
  );
  assert.ok(state.achievementProgress.unlocked.ACHIEVEMENT_MIRROR_HOST);
});

test("最高记录只接受更高值且测试模式不推进统计或成就", () => {
  let state = applyCareerDelta(createState(), {
    counters: { combatDamageDealt: 12 },
    records: { highestExpeditionDamage: 12 },
  }, 2000);
  state = applyCareerDelta(state, {
    counters: { combatDamageDealt: 3 },
    records: { highestExpeditionDamage: 8 },
  }, 3000);
  assert.equal(state.careerProgress.counters.combatDamageDealt, 15);
  assert.equal(state.careerProgress.records.highestExpeditionDamage.value, 12);

  state.settings.testMode = true;
  const frozen = structuredClone(state.careerProgress);
  const testResult = applyCareerDelta(state, {
    counters: { combatDamageDealt: 999, territoriesDestroyed: 1 },
  }, 4000);
  assert.deepEqual(testResult.careerProgress, frozen);
  assert.equal(
    testResult.achievementProgress.unlocked.ACHIEVEMENT_FIRST_TERRITORY,
    undefined,
  );
});

test("领土结算与统一奖励接口同步累计毁灭、胜利和内容获得", () => {
  let state = recordTerritoryVictory(
    createState(),
    "TERRITORY_TUTORIAL_W",
    "CONQUEST",
    2000,
  );
  assert.equal(state.careerProgress.counters.territoriesDestroyed, 1);
  assert.equal(state.careerProgress.counters.conquestVictories, 1);
  assert.ok(state.achievementProgress.unlocked.ACHIEVEMENT_FIRST_TERRITORY);

  state = grantReward(state, INNISTRAD_FIXED_REWARDS.OLIVIA_VOLDAREN, {
    sourceId: "TERRITORY_VOLDAREN_ESTATE",
    resolutionKey: "TEST:CAREER:LEGENDARY",
    now: 3000,
  }).state;
  assert.equal(state.careerProgress.counters.legendaryContentAcquired, 1);
  assert.ok(
    state.achievementProgress.unlocked.ACHIEVEMENT_LEGENDARY_CONTENT,
  );
});
