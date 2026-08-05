import test from "node:test";
import assert from "node:assert/strict";
import {
  MAP_NODE_TYPES,
  createInitialWorldMapState,
  getMapChildren,
  getMapNode,
  getMapPath,
  getProgressiveDiscoveredMapNodeIds,
} from "../src/data/world-map-data.js";
import { getTerritoriesForRegion } from "../src/data/territory-data.js";
import { createInitialState } from "../src/state/initial-state.js";
import {
  archiveCompletedRegion,
  getMapNodePresentationStatus,
  recordTerritoryVictory,
} from "../src/systems/world-map.js";
import { startExpedition } from "../src/systems/expedition.js";
import { parseSaveJson } from "../src/state/save-schema.js";

test("宏观地图保持两组同级关系且依尼翠登记为世界", () => {
  const subspace = getMapNode("SUBSPACE_PRIMARY");
  const universe = getMapNode("UNIVERSE_PRIMARY");
  const innistrad = getMapNode("WORLD_INNISTRAD");

  assert.equal(subspace.parentId, "MULTIVERSE_ROOT");
  assert.equal(universe.parentId, "MULTIVERSE_ROOT");
  assert.equal(universe.name, "现实纬度宇宙");
  assert.equal(innistrad.parentId, "UNIVERSE_PRIMARY");
  assert.equal(innistrad.type, MAP_NODE_TYPES.WORLD);
  assert.equal(getMapNode("BASE_PLAYER").parentId, "SUBSPACE_PRIMARY");
  assert.deepEqual(
    getMapChildren("MULTIVERSE_ROOT").map((node) => node.id),
    ["SUBSPACE_PRIMARY", "UNIVERSE_PRIMARY"],
  );
});

test("依尼翠六个区域与十八块领土正确挂接", () => {
  assert.equal(getMapChildren("WORLD_INNISTRAD").length, 6);
  assert.deepEqual(
    getTerritoriesForRegion("REGION_GAVONY").map((item) => item.id),
    [
      "TERRITORY_TUTORIAL_W",
      "TERRITORY_TUTORIAL_G",
      "TERRITORY_TOWN_WG",
    ],
  );
  assert.equal(getTerritoriesForRegion("REGION_NEPHALIA").length, 4);
  assert.equal(getTerritoriesForRegion("REGION_KESSIG").length, 2);
  assert.equal(getTerritoriesForRegion("REGION_STENSIA").length, 4);
  assert.equal(getTerritoriesForRegion("REGION_MOORLAND").length, 1);
  assert.equal(getTerritoriesForRegion("REGION_THRABEN").length, 4);
  assert.deepEqual(
    getMapPath("REGION_GAVONY").map((node) => node.id),
    [
      "MULTIVERSE_ROOT",
      "UNIVERSE_PRIMARY",
      "WORLD_INNISTRAD",
      "REGION_GAVONY",
    ],
  );
});

test("瑟班城在四个中期区域全部完成后才开放", () => {
  const beforeFinal = getProgressiveDiscoveredMapNodeIds([
    "REGION_GAVONY",
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
  ]);
  assert.equal(beforeFinal.includes("REGION_THRABEN"), false);

  const finalUnlocked = getProgressiveDiscoveredMapNodeIds([
    "REGION_GAVONY",
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
    "REGION_MOORLAND",
  ]);
  assert.ok(finalUnlocked.includes("REGION_THRABEN"));
});

test("未解锁区域显示为未观测，测试模式则恢复为可选的已观测状态", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-UNOBSERVED-REGIONS",
  });
  const nephalia = getMapNode("REGION_NEPHALIA");
  assert.deepEqual(getMapNodePresentationStatus(state, nephalia), {
    id: "unobserved",
    label: "未观测",
  });

  state.settings.testMode = true;
  assert.deepEqual(getMapNodePresentationStatus(state, nephalia), {
    id: "known",
    label: "已观测",
  });
});

test("新游戏建立地图档案且三领土完成后只累计一次区域", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-WORLD-MAP",
  });
  assert.deepEqual(state.worldMap, createInitialWorldMapState());
  assert.equal(
    state.worldMap.discoveredNodeIds.includes("REGION_NEPHALIA"),
    false,
  );
  assert.equal(
    state.worldMap.discoveredNodeIds.includes("REGION_THRABEN"),
    false,
  );

  state = recordTerritoryVictory(
    state,
    "TERRITORY_TUTORIAL_W",
    "CONQUEST",
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_TUTORIAL_G",
    "INFILTRATION",
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_TOWN_WG",
    "CONQUEST",
  );

  assert.equal(state.worldMap.stats.territoriesDestroyed, 3);
  assert.equal(state.worldMap.stats.regionsDestroyed, 1);
  assert.equal(state.worldMap.stats.conquestVictories, 2);
  assert.equal(state.worldMap.stats.infiltrationVictories, 1);
  assert.ok(state.worldMap.completedNodeIds.includes("REGION_GAVONY"));
  for (const regionId of [
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
    "REGION_MOORLAND",
  ]) {
    assert.ok(state.worldMap.discoveredNodeIds.includes(regionId));
  }
  assert.equal(
    state.worldMap.discoveredNodeIds.includes("REGION_THRABEN"),
    false,
  );

  state = recordTerritoryVictory(
    state,
    "TERRITORY_TOWN_WG",
    "CONQUEST",
  );
  assert.equal(state.worldMap.stats.territoriesDestroyed, 3);
  assert.equal(state.worldMap.stats.regionsDestroyed, 1);
  assert.equal(state.worldMap.stats.conquestVictories, 3);
});

test("依尼翠计划领土发放固定奖励且凯锡革双领土完成后解锁狼人", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-INNISTRAD-REWARDS",
  });
  state = recordTerritoryVictory(
    state,
    "TERRITORY_STENSIA_INN",
    "CONQUEST",
    2000,
  );
  assert.ok(state.unlockedBiofactors.includes("RACE_VAMPIRE"));

  state = recordTerritoryVictory(
    state,
    "TERRITORY_VOLDAREN_ESTATE",
    "CONQUEST",
    2500,
  );
  assert.ok(
    state.rewardProgress.unlockedContentIds.includes(
      "LEGENDARY_BLUEPRINT_OLIVIA_VOLDAREN",
    ),
  );

  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_HUNTER_HOUSE",
    "CONQUEST",
    3000,
  );
  assert.equal(state.unlockedBiofactors.includes("RACE_WEREWOLF"), false);
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_WOLF_RUN",
    "INFILTRATION",
    4000,
  );
  assert.ok(state.unlockedBiofactors.includes("RACE_WEREWOLF"));
  assert.ok(state.worldMap.completedNodeIds.includes("REGION_KESSIG"));
});

test("史顿襄原有三领土完成后保底解锁鬼怪且重复结算幂等", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-STENSIA-GOBLIN-GUARANTEE",
  });
  for (const [index, territoryId] of [
    "TERRITORY_STENSIA_INN",
    "TERRITORY_GEIER_REACH_SANITARIUM",
    "TERRITORY_STENSIA_BLOODHALL",
  ].entries()) {
    state = recordTerritoryVictory(
      state,
      territoryId,
      "CONQUEST",
      2000 + index,
    );
  }

  assert.ok(state.unlockedBiofactors.includes("RACE_GOBLIN"));
  const goblinRecords = state.rewardProgress.ledger.filter(
    (record) => record.contentId === "RACE_GOBLIN",
  );
  assert.equal(goblinRecords.length, 1);
  assert.equal(goblinRecords[0].grade, "D");
  assert.equal(goblinRecords[0].sourceId, "REGION_STENSIA_ORIGINAL_THREE");

  state = recordTerritoryVictory(
    state,
    "TERRITORY_STENSIA_BLOODHALL",
    "CONQUEST",
    3000,
  );
  assert.equal(
    state.rewardProgress.ledger.filter(
      (record) => record.contentId === "RACE_GOBLIN",
    ).length,
    1,
  );
});

test("纯山脉领土的D槽按土地标签发放鬼怪奖励", () => {
  const territoryId = "TERRITORY_KESSIG_HUNTER_HOUSE";
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-MOUNTAIN-D-SLOT",
  });
  const snapshot = state.territories[territoryId].catalogSnapshot;
  const mountainState = {
    ...state,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...state.territories[territoryId],
        catalogSnapshot: {
          ...snapshot,
          lands: ["LAND_MOUNTAIN", "LAND_MOUNTAIN"],
          rewardSlots: [{
            id: "MOUNTAIN_LIMITED_RANDOM",
            grade: "D",
            catalogId: "INNISTRAD_LIMITED_RANDOM",
            contextTags: ["LAND_MOUNTAIN"],
          }],
        },
      },
    },
  };

  const result = recordTerritoryVictory(
    mountainState,
    territoryId,
    "CONQUEST",
    2000,
  );
  assert.ok(result.unlockedBiofactors.includes("RACE_GOBLIN"));
  assert.ok(
    result.rewardProgress.resolutions[
      `${territoryId}:FIRST_COMPLETION:D:MOUNTAIN_LIMITED_RANDOM`
    ],
  );
});

test("区域完成记录冻结首次时间、胜利方式与关键奖励来源", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REGION-COMPLETION-RECORD",
  });
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_HUNTER_HOUSE",
    "CONQUEST",
    2000,
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_WOLF_RUN",
    "INFILTRATION",
    3000,
  );

  const record = state.worldMap.regionRecords.REGION_KESSIG;
  assert.equal(record.completedAt, 3000);
  assert.equal(
    record.territoryResults.TERRITORY_KESSIG_HUNTER_HOUSE.victoryType,
    "CONQUEST",
  );
  assert.equal(
    record.territoryResults.TERRITORY_KESSIG_WOLF_RUN.victoryType,
    "INFILTRATION",
  );
  assert.ok(record.rewardRecordIds.length >= 1);
  assert.ok(state.unlockedBiofactors.includes("RACE_WEREWOLF"));
});

test("完成区域可压缩为只读档案且不重复奖励或毁灭计数", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REGION-ARCHIVE",
  });
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_HUNTER_HOUSE",
    "CONQUEST",
    2000,
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_WOLF_RUN",
    "INFILTRATION",
    3000,
  );
  const ledgerLength = state.rewardProgress.ledger.length;
  const mapStats = structuredClone(state.worldMap.stats);
  const careerRegions = state.careerProgress.counters.regionsDestroyed;

  const result = archiveCompletedRegion(state, "REGION_KESSIG", 4000);
  const archived = result.state;
  assert.ok(archived.worldMap.archivedNodeIds.includes("REGION_KESSIG"));
  assert.equal(
    archived.territories.TERRITORY_KESSIG_HUNTER_HOUSE,
    undefined,
  );
  assert.equal(archived.territories.TERRITORY_KESSIG_WOLF_RUN, undefined);
  assert.ok(archived.territories.TERRITORY_TUTORIAL_W);
  assert.deepEqual(archived.worldMap.stats, mapStats);
  assert.equal(archived.rewardProgress.ledger.length, ledgerLength);
  assert.equal(
    archived.careerProgress.counters.regionsDestroyed,
    careerRegions,
  );
  assert.equal(result.archive.territoryCount, 2);
  assert.equal(result.archive.territories[0].victoryType, "CONQUEST");
  assert.equal(result.archive.territories[1].victoryType, "INFILTRATION");
  assert.ok(result.archive.rewards.length >= 1);
  assert.throws(
    () => archiveCompletedRegion(archived, "REGION_KESSIG", 5000),
    /已经归档/,
  );
  assert.throws(
    () => startExpedition(archived, {
      territoryId: "TERRITORY_KESSIG_HUNTER_HOUSE",
      legionId: "LEGION_NONE",
      command: "CONQUEST",
    }),
    /毁灭档案/,
  );

  const reloaded = parseSaveJson(JSON.stringify(archived));
  assert.equal(
    reloaded.territories.TERRITORY_KESSIG_HUNTER_HOUSE,
    undefined,
  );
  assert.equal(
    reloaded.worldMap.regionRecords.REGION_KESSIG.archive.territoryCount,
    2,
  );
});

test("未完成、测试模式或存在区域远征时不能建立毁灭档案", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-REGION-ARCHIVE-GUARDS",
  });
  assert.throws(
    () => archiveCompletedRegion(state, "REGION_KESSIG", 2000),
    /完成区域内全部领土/,
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_HUNTER_HOUSE",
    "CONQUEST",
    2000,
  );
  state = recordTerritoryVictory(
    state,
    "TERRITORY_KESSIG_WOLF_RUN",
    "CONQUEST",
    3000,
  );
  assert.throws(
    () => archiveCompletedRegion({
      ...state,
      settings: { ...state.settings, testMode: true },
    }, "REGION_KESSIG", 4000),
    /测试模式/,
  );
  assert.throws(
    () => archiveCompletedRegion({
      ...state,
      activeExpedition: {
        territoryId: "TERRITORY_KESSIG_HUNTER_HOUSE",
      },
    }, "REGION_KESSIG", 4000),
    /仍有远征/,
  );
});
