import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { parseSaveJson, validateSaveData } from "../src/state/save-schema.js";

test("有效的当前版本存档通过校验并迁移妖精女皇旧字段", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_FOREST",
    now: 1000,
    gameId: "CT-TEST-SAVE",
  });
  state.rewards.fairyQueenMessage = "旧版妖精女皇讯息";
  state.blueprints.push({
    id: "BLUEPRINT_OLD_GREATSWORD_COST",
    name: "旧价巨剑战士",
    raceId: "RACE_HUMAN",
    raceColor: "W",
    jobId: "JOB_WARRIOR",
    jobColor: null,
    placements: [
      {
        instanceId: "OLD_GREATSWORD",
        contentId: "EQUIPMENT_GREATSWORD",
        zoneId: "BASE",
        x: 0,
        y: 0,
        rotation: 0,
      },
    ],
    abilities: ["ABILITY_001", "ABILITY_003"],
    abilityDetails: [],
    designCost: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 300 },
    equivalentValue: 500,
    scaleHpCost: 250,
  });

  assert.equal(validateSaveData(state).valid, true);
  const parsed = parseSaveJson(JSON.stringify(state));
  assert.equal(parsed.gameId, "CT-TEST-SAVE");
  assert.equal(parsed.rewards.elfQueenMessage, "旧版妖精女皇讯息");
  assert.equal("fairyQueenMessage" in parsed.rewards, false);
  assert.equal(parsed.blueprints[0].designCost.C, 250);
  assert.equal(parsed.blueprints[0].equivalentValue, 450);
  assert.equal(parsed.blueprints[0].scaleHpCost, 225);
});

test("持有尸嵌笔记的旧档会补齐尸嵌化永久解锁", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    now: 1000,
    gameId: "CT-TEST-SKAAB-MIGRATION",
  });
  state.artifacts.push("ARTIFACT_SKAAB_NOTEBOOK");
  state.unlockedBiofactors = state.unlockedBiofactors.filter(
    (id) => id !== "MODIFICATION_SKAABIFICATION",
  );
  const migrated = parseSaveJson(JSON.stringify(state));
  assert.ok(
    migrated.unlockedBiofactors.includes(
      "MODIFICATION_SKAABIFICATION",
    ),
  );
});

test("旧版空间锚点存档补齐现实维度四级位置与高层档案字段", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    now: 1000,
    gameId: "CT-TEST-ANCHOR-LOCATION-MIGRATION",
  });
  state.base.anchorLocation = {
    status: "ANCHORED",
    territoryId: "TERRITORY_TUTORIAL_W",
    territoryName: "平原上的村庄",
    lands: ["LAND_PLAINS", "LAND_PLAINS", "LAND_PLAINS"],
    anchoredAt: 2000,
    returnedAt: null,
    instanceId: "INSTANCE_LEGACY_ANCHOR",
  };
  delete state.worldMap.celestialRecords;
  delete state.worldMap.universeRecords;
  delete state.worldMap.generatedCelestials;
  delete state.worldMap.baseLocationNodeId;

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.base.anchorLocation.descentMode, "REALITY_DIMENSION");
  assert.equal(migrated.base.anchorLocation.universeId, "UNIVERSE_PRIMARY");
  assert.equal(migrated.base.anchorLocation.worldId, "WORLD_INNISTRAD");
  assert.equal(migrated.base.anchorLocation.regionId, "REGION_GAVONY");
  assert.equal(migrated.worldMap.baseLocationNodeId, "REGION_GAVONY");
  assert.deepEqual(migrated.worldMap.generatedCelestials, []);
  assert.equal(validateSaveData(migrated).valid, true);
});

test("未知版本和损坏资源会被拒绝", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-BAD",
  });

  assert.equal(validateSaveData({ ...state, schemaVersion: 99 }).valid, false);
  state.resources.amounts.W = Number.NaN;
  assert.equal(validateSaveData(state).valid, false);
});

test("非JSON文件给出可理解的导入错误", () => {
  assert.throws(() => parseSaveJson("not-json"), /有效的JSON/);
});

test("开发期旧存档会恢复加渥尼三支守军并迁移异能ID", () => {
  const state = createInitialState({
    originId: "ORIGIN_G",
    landId: "LAND_FOREST",
    now: 1000,
    gameId: "CT-TEST-MIGRATION",
  });
  state.territories.TERRITORY_TOWN_WG.activeGuardInstances = [];
  state.blueprints.push({
    id: "BLUEPRINT_OLD",
    abilities: [
      "ABILITY_WOODLAND_AFFINITY",
      "ABILITY_EQUIPPED_WARRIOR",
    ],
    abilityDetails: [
      { id: "ABILITY_SHIELD_RECOVERY", name: "old" },
    ],
  });

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(
    migrated.territories.TERRITORY_TOWN_WG.activeGuardInstances.length,
    3,
  );
  assert.deepEqual(migrated.blueprints[0].abilities, [
    "ABILITY_FORESTWALK",
    "ABILITY_001",
  ]);
  assert.equal(
    migrated.blueprints[0].abilityDetails[0].id,
    "ABILITY_002",
  );
});

test("v2存档迁移到当前宏观地图层级并保留已征服领土", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-MAP-MIGRATION",
  });
  state.schemaVersion = 2;
  delete state.worldMap;
  state.territories.TERRITORY_TUTORIAL_W.conquered = true;

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.worldMap.homeNodeId, "BASE_PLAYER");
  assert.ok(
    migrated.worldMap.discoveredNodeIds.includes("WORLD_INNISTRAD"),
  );
  assert.deepEqual(migrated.worldMap.completedTerritoryIds, [
    "TERRITORY_TUTORIAL_W",
  ]);
  assert.equal(migrated.worldMap.stats.territoriesDestroyed, 1);
});

test("v3存档把旧装备与改造ID迁移为并列生物因子前缀", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-BIOFACTOR-MIGRATION",
  });
  state.schemaVersion = 3;
  state.unlockedFactors = [
    "RACE_HUMAN",
    "JOB_WARRIOR",
    "PART_BRONZE_SWORD",
    "FACTOR_ARM",
  ];
  delete state.unlockedBiofactors;
  state.blueprints.push({
    id: "BLUEPRINT_LEGACY_FACTORS",
    placements: [
      { instanceId: "OLD_EQUIPMENT", contentId: "PART_BRONZE_SWORD" },
      { instanceId: "OLD_MODIFICATION", contentId: "FACTOR_ARM" },
    ],
    abilities: [],
    abilityDetails: [],
  });

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.equal("unlockedFactors" in migrated, false);
  assert.ok(
    migrated.unlockedBiofactors.includes("EQUIPMENT_BRONZE_SWORD"),
  );
  assert.ok(
    migrated.unlockedBiofactors.includes("MODIFICATION_ARM"),
  );
  assert.deepEqual(
    migrated.blueprints[0].placements.map(
      (placement) => placement.contentId,
    ),
    ["EQUIPMENT_BRONZE_SWORD", "MODIFICATION_ARM"],
  );
});

test("v4存档迁移到当前Schema并补齐奖励、驻留者与统计进度", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REWARD-MIGRATION",
  });
  state.schemaVersion = 4;
  delete state.rewardProgress;

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.rewardProgress, {
    ledger: [],
    resolutions: {},
    instances: [],
    unlockedContentIds: [],
  });
  assert.deepEqual(migrated.residentProgress, {
    knownResidentIds: ["RESIDENT_LILITH"],
    selectedResidentId: "RESIDENT_LILITH",
    interactionCount: 0,
    lastDialogueId: null,
    seenDialogueIds: [],
    lastSpokenAt: null,
  });
  assert.equal(validateSaveData(migrated).valid, true);
});

test("v5存档迁移到当前Schema并保留奖励履历", () => {
  const state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    now: 1000,
    gameId: "CT-TEST-RESIDENT-MIGRATION",
  });
  state.schemaVersion = 5;
  delete state.residentProgress;
  state.rewardProgress.unlockedContentIds.push("SPELL_TEST_REWARD");

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.deepEqual(migrated.rewardProgress.unlockedContentIds, [
    "SPELL_TEST_REWARD",
  ]);
  assert.deepEqual(migrated.residentProgress.knownResidentIds, [
    "RESIDENT_LILITH",
  ]);
  assert.equal(validateSaveData(migrated).valid, true);
});

test("v6存档迁移到当前Schema并从地图反推可证明的永久统计", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-CAREER-MIGRATION",
  });
  state.schemaVersion = 6;
  delete state.careerProgress;
  delete state.achievementProgress;
  state.worldMap.completedTerritoryIds = ["TERRITORY_TUTORIAL_W"];
  state.worldMap.stats.territoriesDestroyed = 1;
  state.worldMap.stats.conquestVictories = 2;

  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.careerProgress.legacyBaseline, true);
  assert.equal(migrated.careerProgress.counters.territoriesDestroyed, 1);
  assert.equal(migrated.careerProgress.counters.conquestVictories, 2);
  assert.match(migrated.careerProgress.note, /自统计系统启用后/);
  assert.deepEqual(migrated.achievementProgress.pendingIds, []);
  assert.equal(validateSaveData(migrated).valid, true);
});

test("v7存档迁移到当前Schema并为已完成区域补建可追溯记录", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REGION-RECORD-MIGRATION",
  });
  state.schemaVersion = 7;
  delete state.worldMap.regionRecords;
  state.worldMap.completedTerritoryIds = [
    "TERRITORY_TUTORIAL_W",
    "TERRITORY_TUTORIAL_G",
    "TERRITORY_TOWN_WG",
  ];
  state.worldMap.completedNodeIds = ["REGION_GAVONY"];

  const migrated = parseSaveJson(JSON.stringify(state));
  const record = migrated.worldMap.regionRecords.REGION_GAVONY;
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(record.legacyInferred, true);
  assert.equal(record.territoryIds.length, 3);
  assert.equal(
    record.territoryResults.TERRITORY_TOWN_WG.victoryType,
    "UNKNOWN",
  );
  assert.equal(validateSaveData(migrated).valid, true);
});

test("v8存档把沃达连实体进度迁移为独立传奇身份档案", () => {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-LEGENDARY-MIGRATION",
  });
  state.schemaVersion = 8;
  delete state.legendaryIdentities;
  state.rewardProgress.unlockedContentIds.push(
    "LEGENDARY_BLUEPRINT_OLIVIA_VOLDAREN",
  );
  state.legendaryPrototypes.push({
    id: "LEGENDARY_PROTOTYPE_LEGACY",
    identityId: "LEGENDARY_IDENTITY_OLIVIA_VOLDAREN",
    blueprintId: "LEGENDARY_BLUEPRINT_OLIVIA_VOLDAREN",
    name: "奥莉薇亚·沃达连",
    status: "READY",
    currentHp: 5,
    maxHp: 5,
    currentLp: 4,
    createdAt: 1200,
    progress: {
      directKills: 23,
      commanderTriggers: 7,
      expeditionsCompleted: 4,
    },
  });
  const migrated = parseSaveJson(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 9);
  assert.equal(migrated.legendaryIdentities.length, 1);
  assert.equal(
    migrated.legendaryIdentities[0].contentProgress.directKills,
    23,
  );
  assert.equal(
    migrated.legendaryIdentities[0].entityHistory[0].entityId,
    "LEGENDARY_PROTOTYPE_LEGACY",
  );
  assert.equal(validateSaveData(migrated).valid, true);
});
