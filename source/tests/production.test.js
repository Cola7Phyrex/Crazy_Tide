import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { createBlueprintDraft } from "../src/systems/blueprints.js";
import { saveNewBlueprint } from "../src/systems/prototypes.js";
import {
  cancelProduction,
  queueLegionProduction,
  queueManaVaultUpgrade,
  queueMetathranProduction,
  settleProduction,
} from "../src/systems/production.js";
import { getActiveManaProductionSlots } from "../src/systems/artifacts.js";
import { METATHRAN_FACILITY_TYPE } from "../src/data/artifact-data.js";

function stateWithPrototype() {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-PRODUCTION",
  });
  const draft = createBlueprintDraft("W");
  draft.jobId = "JOB_WARRIOR";
  draft.placements.push({
    instanceId: "SWORD",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    x: 0,
    y: 0,
    rotation: 0,
  });
  return saveNewBlueprint(state, draft, 2000);
}

test("镜映品按V除以2计算复制成本和人数", () => {
  const saved = stateWithPrototype();
  const queued = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 3 },
    3000,
  );

  assert.equal(queued.state.resources.amounts.C, 17200);
  assert.equal(queued.job.cost.C, 600);
  assert.equal(queued.job.replicaCount, 15);
  assert.equal(queued.job.completesAt, 9000);
});

test("普通蓝图一旦传奇化便永久禁止制造复制体", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-LEGENDARY-REPLICATION",
  });
  const draft = createBlueprintDraft("W");
  draft.legendary = true;
  const saved = saveNewBlueprint(state, draft, 2000);
  assert.equal(saved.blueprint.legendary, true);
  assert.equal(saved.blueprint.legendaryOrigin, false);
  assert.throws(
    () =>
      queueLegionProduction(
        saved.state,
        { prototypeId: saved.prototype.id, scaleHp: 1 },
        3000,
      ),
    /永久禁止制造复制体/,
  );
});

test("镜映品完成后生成包含原体和复制体生命的军团", () => {
  const saved = stateWithPrototype();
  const queued = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 3 },
    3000,
  );
  const before = settleProduction(queued.state, 8999);
  const after = settleProduction(before.state, 9000);

  assert.equal(before.state.legions.length, 0);
  assert.equal(after.state.legions.length, 1);
  assert.equal(after.state.legions[0].maxHp, 9);
  assert.equal(after.state.legions[0].replicaCount, 15);
});

test("已组建军团可以按新增生命再次补充", () => {
  const saved = stateWithPrototype();
  const firstQueued = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 3 },
    3000,
  );
  const firstReady = settleProduction(firstQueued.state, 9000).state;
  const reinforced = queueLegionProduction(
    firstReady,
    { prototypeId: saved.prototype.id, scaleHp: 2 },
    10000,
  );

  assert.equal(reinforced.job.mode, "REINFORCE");
  assert.equal(reinforced.job.cost.C, 400);
  assert.equal(reinforced.job.replicaCount, 10);
  const completed = settleProduction(reinforced.state, 14000);
  assert.equal(completed.completed[0].kind, "LEGION_REINFORCED");
  assert.equal(completed.state.legions.length, 1);
  assert.equal(completed.state.legions[0].purchasedScaleHp, 5);
  assert.equal(completed.state.legions[0].maxHp, 11);
  assert.equal(completed.state.legions[0].currentHp, 11);
  assert.equal(completed.state.legions[0].replicaCount, 25);
});

test("军团补充受累计军团生命上限约束", () => {
  const saved = stateWithPrototype();
  const queued = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 8 },
    3000,
  );
  const ready = settleProduction(queued.state, 19000).state;

  assert.throws(
    () =>
      queueLegionProduction(
        ready,
        { prototypeId: saved.prototype.id, scaleHp: 3 },
        20000,
      ),
    /总上限/,
  );
});

test("吸血鬼军团最多购买5点规模生命且每点制造2名复制体", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-VAMPIRE-PRODUCTION",
  });
  state.unlockedBiofactors.push("RACE_VAMPIRE");
  const draft = createBlueprintDraft("B");
  draft.raceId = "RACE_VAMPIRE";
  draft.raceColor = "B";
  const saved = saveNewBlueprint(state, draft, 2000);

  assert.throws(
    () =>
      queueLegionProduction(
        saved.state,
        { prototypeId: saved.prototype.id, scaleHp: 6 },
        3000,
      ),
    /上限/,
  );
  const queued = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 5 },
    3000,
  );
  assert.equal(queued.job.replicaCount, 10);
});

test("仿索蓝发电机支付1500[C]并在3分钟后成为运行设施", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-METATHRAN",
  });
  state.flags.metathranRecipeUnlocked = true;
  const queued = queueMetathranProduction(state, 2000);

  assert.equal(queued.state.resources.amounts.C, 16500);
  assert.equal(queued.job.completesAt, 182000);
  assert.equal(settleProduction(queued.state, 181999).state.manaFacilities.length, 0);

  const completed = settleProduction(queued.state, 182000);
  assert.equal(completed.state.manaFacilities.length, 1);
  assert.equal(completed.completed[0].kind, "MANA_FACILITY");
});

test("两座已开启的仿索蓝发电机正确占用两个生产位", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-FACILITY-SLOTS",
  });
  state.manaFacilities = [
    {
      id: "FACILITY_ONE",
      type: METATHRAN_FACILITY_TYPE,
      enabled: true,
    },
    {
      id: "FACILITY_TWO",
      type: METATHRAN_FACILITY_TYPE,
      enabled: true,
    },
  ];
  assert.equal(getActiveManaProductionSlots(state), 2);
});

test("测试模式下生产免费且统一在2秒后完成", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    now: 1000,
    gameId: "CT-TEST-MODE-PRODUCTION",
  });
  state.settings.testMode = true;
  const before = state.resources.amounts.C;
  const queued = queueMetathranProduction(state, 2000);

  assert.equal(queued.state.resources.amounts.C, before);
  assert.equal(queued.job.completesAt, 4000);
  assert.equal(settleProduction(queued.state, 3999).state.manaFacilities.length, 0);
  assert.equal(settleProduction(queued.state, 4000).state.manaFacilities.length, 1);
});

test("取消生产全额退款，即使退款令资源暂时超过容量", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REFUND",
  });
  state.flags.metathranRecipeUnlocked = true;
  const queued = queueMetathranProduction(state, 2000);
  queued.state.resources.amounts.C = queued.state.resources.caps.C;

  const cancelled = cancelProduction(queued.state, queued.job.id);
  assert.equal(cancelled.resources.amounts.C, 21500);
  assert.equal(cancelled.productionQueue.length, 0);
});

test("法术力库扩容按已确认档位提升容量并保留同色加成", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-VAULT",
  });
  state.flags.gavonyFirstConquered = true;
  state.flags.manaVaultExpansionUnlocked = true;
  state.resources.amounts.C = 20000;

  const queued = queueManaVaultUpgrade(state, 2000);
  assert.equal(queued.job.targetLevel, 1);
  assert.equal(queued.job.cost.C, 10000);
  assert.equal(queued.job.completesAt, 302000);
  assert.equal(queued.state.resources.amounts.C, 10000);

  const completed = settleProduction(queued.state, 302000);
  assert.equal(completed.completed[0].kind, "MANA_VAULT");
  assert.equal(completed.state.base.manaVaultLevel, 1);
  assert.equal(completed.state.resources.caps.C, 30000);
  assert.equal(completed.state.resources.caps.W, 17);
  assert.equal(completed.state.resources.caps.U, 12);
  assert.equal(completed.state.flags.manaVaultExpansionUnlocked, false);
});

test("法术力库扩容需先通关加渥尼并曾经达到当前无色上限", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-VAULT-LOCK",
  });
  assert.throws(
    () => queueManaVaultUpgrade(state, 2000),
    /首次攻陷加渥尼/,
  );
  state.flags.gavonyFirstConquered = true;
  assert.throws(
    () => queueManaVaultUpgrade(state, 2000),
    /曾经达到上限/,
  );
});
