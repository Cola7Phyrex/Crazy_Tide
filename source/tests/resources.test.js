import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import {
  getProductionRates,
  settleEconomy,
} from "../src/systems/resources.js";
import {
  METATHRAN_FACILITY_TYPE,
  PRISMATIC_LENS_ID,
  THRAN_DYNAMO_ID,
} from "../src/data/artifact-data.js";
import {
  assignManaProductionSlot,
  assignManaProductionSlotGroup,
  getManaProductionSlotAssignments,
  MANA_FACILITY_GROUP_METATHRAN,
  setManaFacilityEnabled,
  setPrismaticLensColor,
  setPrismaticLensEnabled,
} from "../src/systems/artifacts.js";

test("同色开局获得6点法术力、15点容量和每120秒2点产能", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-SAME",
  });

  assert.equal(state.resources.amounts.W, 6);
  assert.equal(state.resources.caps.W, 15);
  assert.equal(getProductionRates(state.base).W, 2);
});

test("异色开局分别获得3点资源并各自产出1点", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-SPLIT",
  });

  assert.equal(state.resources.amounts.U, 3);
  assert.equal(state.resources.amounts.B, 3);
  assert.equal(state.resources.caps.U, 10);
  assert.equal(getProductionRates(state.base).U, 1);
  assert.equal(getProductionRates(state.base).B, 1);
});

test("有色法术力每120秒结算，无色残渣仍每60秒结算", () => {
  const state = createInitialState({
    originId: "ORIGIN_G",
    landId: "LAND_FOREST",
    now: 1000,
    gameId: "CT-TEST-MINUTE",
  });
  const firstMinute = settleEconomy(state, 61000);

  assert.equal(firstMinute.state.resources.amounts.G, 6);
  assert.equal(firstMinute.state.resources.amounts.C, 18025);
  assert.equal(firstMinute.gained.G, 0);
  assert.equal(firstMinute.gained.C, 25);

  const secondMinute = settleEconomy(firstMinute.state, 121000);
  assert.equal(secondMinute.state.resources.amounts.G, 8);
  assert.equal(secondMinute.state.resources.amounts.C, 18050);
  assert.equal(secondMinute.gained.G, 2);
  assert.equal(secondMinute.gained.C, 25);
});

test("120秒周期完成前不提前发放同色法术力", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-BATCH",
  });
  const beforeCycle = settleEconomy(state, 60999);

  assert.equal(beforeCycle.state.resources.amounts.W, 6);
  assert.equal(beforeCycle.state.resources.amounts.C, 18000);
  assert.ok(beforeCycle.state.resources.fractions.C > 0.99);

  const completedCycle = settleEconomy(beforeCycle.state, 121000);
  assert.equal(completedCycle.state.resources.amounts.W, 8);
  assert.equal(completedCycle.state.resources.amounts.C, 18050);
  assert.equal(completedCycle.state.resources.fractions.C, 0);
});

test("测试模式把法术力生产周期缩短为2秒", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-MODE-CYCLE",
  });
  state.settings.testMode = true;
  const before = structuredClone(state.resources.amounts);
  const result = settleEconomy(state, 3000);

  assert.equal(result.state.resources.amounts.B, before.B + 2);
  assert.equal(result.state.resources.amounts.C, before.C + 25);
});

test("资源达到容量后不会储存可延后领取的溢出产量", () => {
  const state = createInitialState({
    originId: "ORIGIN_R",
    landId: "LAND_MOUNTAIN",
    now: 1000,
    gameId: "CT-TEST-CAP",
  });
  state.resources.amounts.R = 14;

  const capped = settleEconomy(state, 121000).state;
  assert.equal(capped.resources.amounts.R, 15);
  assert.equal(capped.resources.fractions.R, 0);

  capped.resources.amounts.R = 14;
  const next = settleEconomy(capped, 121001).state;
  assert.equal(next.resources.amounts.R, 14);
});

test("经济离线结算不会推进远征时钟", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_ISLAND",
    now: 1000,
    gameId: "CT-TEST-CLOCK",
  });
  state.clock.expeditionElapsedMs = 7300;

  const result = settleEconomy(state, 301000).state;
  assert.equal(result.clock.expeditionElapsedMs, 7300);
});

test("索蓝与仿索蓝发电机各自按60秒整批结算", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-DYNAMOS",
  });
  state.base.residueActive = false;
  state.artifacts.push(THRAN_DYNAMO_ID);
  state.manaFacilities.push({
    id: "FACILITY_TEST",
    type: METATHRAN_FACILITY_TYPE,
    enabled: true,
  });
  state.resources.amounts.C = 10000;

  const before = settleEconomy(state, 60999);
  assert.equal(before.state.resources.amounts.C, 10000);

  const completed = settleEconomy(before.state, 61000);
  assert.equal(completed.state.resources.amounts.C, 10300);
  assert.equal(getProductionRates(completed.state).C, 300);
});

test("虹彩透镜每120秒消耗400无色并产生1点所选颜色", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-PRISM",
  });
  state.base.residueActive = false;
  state.artifacts.push(PRISMATIC_LENS_ID);
  state = setPrismaticLensColor(state, "U");
  state = setPrismaticLensEnabled(state, true);

  const before = settleEconomy(state, 60999);
  assert.equal(before.state.resources.amounts.U, 0);
  assert.equal(before.state.resources.amounts.C, 18000);

  const completed = settleEconomy(before.state, 121000);
  assert.equal(completed.state.resources.amounts.U, 1);
  assert.equal(completed.state.resources.amounts.C, 17600);
});

test("虹彩透镜切换颜色会清空未完成周期", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-PRISM-RESET",
  });
  state.base.residueActive = false;
  state.artifacts.push(PRISMATIC_LENS_ID);
  state = setPrismaticLensColor(state, "U");
  state = setPrismaticLensEnabled(state, true);
  state = settleEconomy(state, 31000).state;
  state = setPrismaticLensColor(state, "G");

  state = settleEconomy(state, 61000).state;
  assert.equal(state.resources.amounts.U, 0);
  assert.equal(state.resources.amounts.G, 0);
  state = settleEconomy(state, 150999).state;
  assert.equal(state.resources.amounts.G, 0);
  state = settleEconomy(state, 151000).state;
  assert.equal(state.resources.amounts.G, 1);
});

test("虹彩透镜与仿索蓝发电机共同遵守两个生产位上限", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-PRISM-SLOTS",
  });
  state.artifacts.push(PRISMATIC_LENS_ID);
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
  assert.throws(
    () => setPrismaticLensEnabled(state, true),
    /法术力生产位已满/,
  );
  state = setManaFacilityEnabled(state, "FACILITY_TWO", false);
  state = setPrismaticLensEnabled(state, true);
  assert.equal(state.prismaticLens.enabled, true);
});

test("固定生产位可分配设施、主动空置并避免重复占用", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-FIXED-SLOTS",
  });
  state.artifacts.push(PRISMATIC_LENS_ID);
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

  state = assignManaProductionSlot(state, 0, PRISMATIC_LENS_ID);
  assert.deepEqual(getManaProductionSlotAssignments(state), [
    PRISMATIC_LENS_ID,
    "FACILITY_TWO",
  ]);
  assert.equal(state.manaFacilities[0].enabled, false);
  assert.equal(state.prismaticLens.enabled, true);

  state = assignManaProductionSlot(state, 1, null);
  assert.deepEqual(getManaProductionSlotAssignments(state), [
    PRISMATIC_LENS_ID,
    null,
  ]);
  assert.equal(state.manaFacilities[1].enabled, false);

  state = assignManaProductionSlot(state, 1, PRISMATIC_LENS_ID);
  assert.deepEqual(getManaProductionSlotAssignments(state), [
    null,
    PRISMATIC_LENS_ID,
  ]);
});

test("同名设施在生产位下拉菜单中按类型依次启用", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-GROUPED-SLOTS",
  });
  state.manaFacilities = ["ONE", "TWO", "THREE"].map((suffix) => ({
    id: `FACILITY_${suffix}`,
    type: METATHRAN_FACILITY_TYPE,
    enabled: false,
  }));

  state = assignManaProductionSlotGroup(
    state,
    0,
    MANA_FACILITY_GROUP_METATHRAN,
  );
  assert.deepEqual(getManaProductionSlotAssignments(state), [
    "FACILITY_ONE",
    null,
  ]);

  state = assignManaProductionSlotGroup(
    state,
    1,
    MANA_FACILITY_GROUP_METATHRAN,
  );
  assert.deepEqual(getManaProductionSlotAssignments(state), [
    "FACILITY_ONE",
    "FACILITY_TWO",
  ]);
  assert.deepEqual(
    state.manaFacilities.map((facility) => facility.enabled),
    [true, true, false],
  );
});

test("加渥尼通关后曾达到当前无色上限会永久显示下一档扩容", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-VAULT-UNLOCK",
  });
  state.flags.gavonyFirstConquered = true;
  state.resources.amounts.C = state.resources.caps.C;

  const settled = settleEconomy(state, 1001).state;
  assert.equal(settled.flags.manaVaultExpansionUnlocked, true);
  settled.resources.amounts.C = 1000;
  const later = settleEconomy(settled, 1002).state;
  assert.equal(later.flags.manaVaultExpansionUnlocked, true);
});
