import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import {
  GAVONY_FIXED_REWARDS,
  INNISTRAD_FIXED_REWARDS,
  LIMITED_RANDOM_REWARD_CATALOG,
  REWARD_CONTENT_TYPES,
  REWARD_DELIVERY_TYPES,
  REWARD_GRADES,
  createManaRewardDefinition,
} from "../src/data/reward-data.js";
import {
  getEligibleRewardCandidates,
  grantReward,
  resolveRewardSlot,
  validateRewardDefinition,
} from "../src/systems/rewards.js";

function createState() {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REWARDS",
  });
  state.resources.amounts.W = 0;
  state.resources.amounts.C = 0;
  return state;
}

function randomPermission(id, contentId, drawWeight = 1) {
  return {
    id,
    grade: REWARD_GRADES.RANDOM,
    deliveryType: REWARD_DELIVERY_TYPES.USAGE_PERMISSION,
    contentType: REWARD_CONTENT_TYPES.SPELL,
    contentId,
    unique: true,
    drawWeight,
  };
}

test("A类法术力奖励写入履历并按resolutionKey幂等", () => {
  const definition = createManaRewardDefinition(
    "REWARD_A_TEST_MANA",
    { W: 2, C: 100 },
  );
  const first = resolveRewardSlot(createState(), {
    resolutionKey: "TEST:A:1",
    grade: REWARD_GRADES.MANA,
    candidates: [definition],
    sourceId: "TERRITORY_TEST",
    now: 2000,
  });

  assert.equal(first.state.resources.amounts.W, 2);
  assert.equal(first.state.resources.amounts.C, 100);
  assert.equal(first.state.rewardProgress.ledger.length, 1);
  assert.equal(first.state.rewardProgress.ledger[0].grade, "A");

  const repeated = resolveRewardSlot(first.state, {
    resolutionKey: "TEST:A:1",
    grade: REWARD_GRADES.MANA,
    candidates: [definition],
    sourceId: "TERRITORY_TEST",
    now: 3000,
  });
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.state.resources.amounts.W, 2);
  assert.equal(repeated.state.rewardProgress.ledger.length, 1);
});

test("B类唯一配方与唯一实体不会重复发放且保留来源", () => {
  let state = createState();
  const elf = grantReward(state, GAVONY_FIXED_REWARDS.ELF, {
    sourceId: "TERRITORY_TOWN_WG",
    resolutionKey: "TEST:B:ELF",
    now: 2000,
  });
  state = elf.state;
  assert.ok(state.unlockedBiofactors.includes("RACE_ELF"));
  assert.equal(elf.record.sourceId, "TERRITORY_TOWN_WG");

  const duplicate = grantReward(state, GAVONY_FIXED_REWARDS.ELF, {
    sourceId: "TERRITORY_OTHER",
    resolutionKey: "TEST:B:ELF:DUPLICATE",
    now: 3000,
  });
  assert.equal(duplicate.resolution.outcome, "ALREADY_OWNED");
  assert.equal(duplicate.state.rewardProgress.ledger.length, 1);

  const lens = grantReward(
    duplicate.state,
    GAVONY_FIXED_REWARDS.PRISMATIC_LENS,
    {
      sourceId: "TERRITORY_TOWN_WG",
      resolutionKey: "TEST:B:LENS",
      now: 4000,
    },
  );
  assert.ok(lens.state.artifacts.includes("ARTIFACT_PRISMATIC_LENS"));
  assert.equal(lens.state.rewardProgress.instances.length, 1);
  assert.equal(
    lens.state.rewardProgress.instances[0].instanceId,
    lens.record.instanceId,
  );
});

test("尸嵌笔记作为唯一神器实体同步永久解锁尸嵌化", () => {
  const result = grantReward(
    createState(),
    INNISTRAD_FIXED_REWARDS.SKAAB_NOTEBOOK,
    {
      sourceId: "TERRITORY_NEPHALIA_DROWNYARD",
      resolutionKey: "TEST:B:SKAAB_NOTEBOOK",
      now: 2000,
    },
  );
  assert.ok(result.state.artifacts.includes("ARTIFACT_SKAAB_NOTEBOOK"));
  assert.ok(
    result.state.unlockedBiofactors.includes(
      "MODIFICATION_SKAABIFICATION",
    ),
  );
  assert.equal(result.state.rewardProgress.instances.length, 1);
});

test("B类固定槽遇到旧档已拥有内容时固化已拥有结果而不误发回退", () => {
  const state = createState();
  state.unlockedBiofactors.push("RACE_ELF");
  const fallback = createManaRewardDefinition(
    "REWARD_A_TEST_B_FALLBACK",
    { C: 500 },
  );
  const result = resolveRewardSlot(state, {
    resolutionKey: "TEST:B:LEGACY_OWNED",
    grade: REWARD_GRADES.FIXED,
    candidates: [GAVONY_FIXED_REWARDS.ELF],
    fallback,
    sourceId: "TERRITORY_TOWN_WG",
    now: 2000,
  });

  assert.equal(result.resolution.rewardId, GAVONY_FIXED_REWARDS.ELF.id);
  assert.equal(result.resolution.outcome, "ALREADY_OWNED");
  assert.equal(result.resolution.fallback, false);
  assert.equal(result.state.resources.amounts.C, 0);
  assert.equal(result.state.rewardProgress.ledger.length, 0);
});

test("C类按权重抽取未拥有内容并固化结果", () => {
  const candidates = [
    randomPermission("REWARD_C_TEST_ONE", "SPELL_TEST_ONE", 1),
    randomPermission("REWARD_C_TEST_TWO", "SPELL_TEST_TWO", 3),
  ];
  const first = resolveRewardSlot(createState(), {
    resolutionKey: "TEST:C:1",
    grade: REWARD_GRADES.RANDOM,
    candidates,
    sourceId: "TERRITORY_TEST",
    now: 2000,
  });
  const selectedId = first.resolution.rewardId;
  const rngAfterFirst = first.state.rngState;

  const repeated = resolveRewardSlot(
    { ...first.state, rngState: 0xffffffff },
    {
      resolutionKey: "TEST:C:1",
      grade: REWARD_GRADES.RANDOM,
      candidates,
      sourceId: "TERRITORY_TEST",
      now: 3000,
    },
  );
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.resolution.rewardId, selectedId);
  assert.equal(repeated.state.rngState, 0xffffffff);
  assert.notEqual(rngAfterFirst, 1);
  assert.equal(first.state.rewardProgress.ledger.length, 1);
});

test("D类执行限定标签过滤，空池时发放明确回退", () => {
  const [goblin] = LIMITED_RANDOM_REWARD_CATALOG;
  const mountainEligible = getEligibleRewardCandidates(
    createState(),
    [goblin],
    {
      grade: REWARD_GRADES.LIMITED_RANDOM,
      contextTags: ["LAND_MOUNTAIN", "RACE_VAMPIRE"],
    },
  );
  assert.deepEqual(mountainEligible.map((item) => item.id), [goblin.id]);

  const fallback = createManaRewardDefinition(
    "REWARD_A_TEST_D_FALLBACK",
    { C: 250 },
  );
  const plains = resolveRewardSlot(createState(), {
    resolutionKey: "TEST:D:PLAINS",
    grade: REWARD_GRADES.LIMITED_RANDOM,
    candidates: [goblin],
    contextTags: ["LAND_PLAINS"],
    fallback,
    sourceId: "TERRITORY_TEST_PLAINS",
    now: 2000,
  });
  assert.equal(plains.resolution.rewardId, fallback.id);
  assert.equal(plains.resolution.fallback, true);
  assert.equal(plains.state.resources.amounts.C, 250);
  assert.equal(
    plains.state.rewardProgress.ledger[0].fallbackForGrade,
    REWARD_GRADES.LIMITED_RANDOM,
  );
});

test("无回退的空池与无标签D类定义会被明确拒绝", () => {
  const invalidD = {
    id: "REWARD_D_INVALID",
    grade: REWARD_GRADES.LIMITED_RANDOM,
    deliveryType: REWARD_DELIVERY_TYPES.RECIPE,
    contentType: REWARD_CONTENT_TYPES.BIOFACTOR,
    contentId: "RACE_INVALID",
  };
  assert.equal(validateRewardDefinition(invalidD).valid, false);
  assert.throws(
    () =>
      resolveRewardSlot(createState(), {
        resolutionKey: "TEST:D:EMPTY",
        grade: REWARD_GRADES.LIMITED_RANDOM,
        candidates: LIMITED_RANDOM_REWARD_CATALOG,
        contextTags: ["LAND_PLAINS"],
      }),
    /没有合法候选或回退/,
  );
});
