import test from "node:test";
import assert from "node:assert/strict";
import {
  GENERATED_INNISTRAD_TERRITORIES,
  getTerritory,
  getTerritoryAccessReason,
  getTerritoryForState,
  isTerritoryUnlocked,
} from "../src/data/territory-data.js";
import {
  INNISTRAD_OFFICIAL_SEED,
  LAND_COLOR_BY_ID,
  PLANNED_INNISTRAD_TERRITORIES,
  REGION_GENERATION_PROFILES,
} from "../src/data/territory-generator-data.js";
import { createInitialState } from "../src/state/initial-state.js";
import {
  createBlueprintDraft,
  deriveBlueprint,
  findFirstPlacement,
} from "../src/systems/blueprints.js";
import { startExpedition } from "../src/systems/expedition.js";
import {
  TerritoryGenerationError,
  generateOfficialInnistradTerritories,
  generateTerritory,
  inspectEnemyBuildCatalog,
  validateGeneratedTerritory,
} from "../src/systems/territory-generator.js";

test("依尼翠固定种子稳定生成15块领土", () => {
  const first = generateOfficialInnistradTerritories();
  const second = generateOfficialInnistradTerritories(INNISTRAD_OFFICIAL_SEED);
  assert.equal(first.length, 15);
  assert.deepEqual(first, second);
  assert.deepEqual(first, GENERATED_INNISTRAD_TERRITORIES);
});

test("生成领土固化守军、数值、奖励槽与三阶段文本", () => {
  for (const territory of GENERATED_INNISTRAD_TERRITORIES) {
    assert.ok(territory.generator.version);
    assert.ok(territory.generator.seed);
    assert.ok(territory.patrol.generatedBlueprint.buildId);
    assert.ok(territory.garrison.templates.length > 0);
    assert.ok(Array.isArray(territory.rewardSlots));
    assert.ok(territory.description);
    assert.ok(territory.scoutingText);
    assert.ok(territory.conquestText);
  }
});

test("新游戏把生成配置写入存档，后续目录变化不会改写旧档", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-TERRITORY-SNAPSHOT",
  });
  const territoryId = "TERRITORY_NEPHALIA_DROWNYARD";
  const snapshot = state.territories[territoryId].catalogSnapshot;
  assert.equal(snapshot.territoryId, territoryId);
  assert.ok(snapshot.generatorVersion);
  assert.ok(snapshot.patrol.generatedBlueprint.buildId);
  assert.ok(snapshot.garrison.templates.length > 0);

  const preservedFortitude = 777;
  const alteredState = {
    ...state,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...state.territories[territoryId],
        catalogSnapshot: {
          ...snapshot,
          maxFortitude: preservedFortitude,
        },
      },
    },
  };
  assert.notEqual(getTerritory(territoryId).maxFortitude, preservedFortitude);
  assert.equal(
    getTerritoryForState(alteredState, territoryId).maxFortitude,
    preservedFortitude,
  );
});

test("全部敌军构筑通过正式蓝图推导且颜色受基本地支持", () => {
  assert.ok(inspectEnemyBuildCatalog().every((build) => build.valid));
  for (const territory of GENERATED_INNISTRAD_TERRITORIES) {
    const validation = validateGeneratedTerritory(territory);
    assert.deepEqual(validation.issues, [], territory.id);
    const supported = new Set(
      territory.lands.map((landId) => LAND_COLOR_BY_ID[landId]),
    );
    for (const template of [
      territory.patrol,
      ...territory.garrison.templates,
    ]) {
      assert.ok(
        template.colors.every(
          (color) => color === "C" || supported.has(color),
        ),
        `${territory.id}:${template.name}`,
      );
      assert.ok(template.generatedBlueprint.buildId);
      assert.ok(Number.isInteger(template.scaleHp));
    }
  }
});

test("区域种族禁令、荒野省精怪与涅非利亚渗透规则通过审计", () => {
  for (const territory of GENERATED_INNISTRAD_TERRITORIES) {
    const profile = REGION_GENERATION_PROFILES[territory.regionId];
    for (const template of territory.garrison.templates) {
      const blueprint = template.generatedBlueprint;
      if (blueprint.systemFallback) continue;
      assert.equal(
        profile.forbiddenRaceIds.includes(blueprint.raceId),
        false,
      );
      if (territory.regionId === "REGION_MOORLAND") {
        assert.equal(blueprint.raceId, "RACE_SPIRIT");
      }
    }
    if (territory.regionId === "REGION_NEPHALIA") {
      assert.deepEqual(territory.allowedInfiltratorRaceIds, ["RACE_ZOMBIE"]);
    }
  }
});

test("固定奖励在守军中获得展示，军营区恰有2至3支士兵军团", () => {
  for (const plan of PLANNED_INNISTRAD_TERRITORIES) {
    const territory = getTerritory(plan.id);
    const tags = new Set(territory.garrison.templates.flatMap(
      (template) => template.generatedBlueprint.tags,
    ));
    for (const tag of plan.requiredBuildTags ?? []) assert.ok(tags.has(tag));
  }
  const barracks = getTerritory("TERRITORY_THRABEN_BARRACKS_DISTRICT");
  const soldierCount = barracks.garrison.templates.reduce(
    (sum, template) => sum + (
      template.generatedBlueprint.tags.includes("SOLDIER")
        ? template.initialCount
        : 0
    ),
    0,
  );
  assert.ok(soldierCount >= 2 && soldierCount <= 3);
});

test("沃达连邸与狱窖按稳定前置领土ID解锁", () => {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-TERRITORY-ACCESS",
  });
  const estate = getTerritory("TERRITORY_VOLDAREN_ESTATE");
  const helvault = getTerritory("TERRITORY_HELVAULT");
  state.worldMap.discoveredNodeIds.push(
    "REGION_STENSIA",
    "REGION_THRABEN",
  );
  assert.equal(isTerritoryUnlocked(state, estate), false);
  assert.equal(isTerritoryUnlocked(state, helvault), false);
  assert.match(getTerritoryAccessReason(state, estate), /旅店/);

  const completedTerritoryIds = [
    ...estate.requiresTerritoryIds,
    ...helvault.requiresTerritoryIds,
  ];
  const unlockedState = {
    ...state,
    worldMap: { ...state.worldMap, completedTerritoryIds },
  };
  assert.equal(isTerritoryUnlocked(unlockedState, estate), true);
  assert.equal(isTerritoryUnlocked(unlockedState, helvault), true);
});

function withInfiltratorBlueprint(state, raceId) {
  const draft = createBlueprintDraft(raceId === "RACE_ZOMBIE" ? "B" : "U");
  draft.name = raceId === "RACE_ZOMBIE" ? "装脑灵俑浪客" : "人类浪客";
  draft.raceId = raceId;
  draft.raceColor = raceId === "RACE_ZOMBIE" ? "B" : "U";
  draft.jobId = "JOB_ROGUE";
  draft.jobColor = "U";
  if (raceId === "RACE_ZOMBIE") {
    const placement = findFirstPlacement(draft, "MODIFICATION_BRAIN");
    draft.placements.push({
      instanceId: "TEST_BRAIN_1",
      contentId: "MODIFICATION_BRAIN",
      ...placement,
    });
  }
  const derived = deriveBlueprint(draft);
  assert.equal(derived.valid, true, derived.issues.join("；"));
  const blueprintId = "BLUEPRINT_TEST_INFILTRATOR";
  const blueprint = { ...derived, id: blueprintId };
  return {
    ...state,
    resources: {
      ...state.resources,
      amounts: { ...state.resources.amounts, C: 1000 },
    },
    blueprints: [blueprint],
    prototypes: [{
      id: "PROTOTYPE_TEST_INFILTRATOR",
      blueprintId,
      name: draft.name,
      status: "READY",
    }],
    legions: [{
      id: "LEGION_TEST_INFILTRATOR",
      prototypeId: "PROTOTYPE_TEST_INFILTRATOR",
      blueprintId,
      name: draft.name,
      currentHp: blueprint.stats.hp + 5,
      maxHp: blueprint.stats.hp + 5,
      currentScaleHp: 5,
      temporaryScaleHp: 0,
      purchasedScaleHp: 5,
      replicaCount: 5,
    }],
  };
}

test("涅非利亚拒绝人类浪客渗透，但接受装脑灵俑浪客", () => {
  const makeState = () => {
    const state = createInitialState({
      originId: "ORIGIN_U",
      landId: "LAND_ISLAND",
      now: 1000,
      gameId: "CT-TEST-NEPHALIA-INFILTRATION",
    });
    state.worldMap.discoveredNodeIds.push("REGION_NEPHALIA");
    return state;
  };
  const humanState = withInfiltratorBlueprint(makeState(), "RACE_HUMAN");
  assert.throws(
    () => startExpedition(humanState, {
      territoryId: "TERRITORY_NEPHALIA_DROWNYARD",
      legionId: humanState.legions[0].id,
      command: "INFILTRATION",
    }, 2000),
    /只允许灵俑军团渗透/,
  );

  const zombieState = withInfiltratorBlueprint(makeState(), "RACE_ZOMBIE");
  const started = startExpedition(zombieState, {
    territoryId: "TERRITORY_NEPHALIA_DROWNYARD",
    legionId: zombieState.legions[0].id,
    command: "INFILTRATION",
  }, 2000);
  assert.equal(started.state.activeExpedition.command, "INFILTRATION");
});

test("沃达连邸与狱窖难度显著高于自由探索领土", () => {
  const ordinary = GENERATED_INNISTRAD_TERRITORIES.filter(
    (territory) => territory.generator.difficultyId === "FREE_EXPLORATION",
  );
  const estate = getTerritory("TERRITORY_VOLDAREN_ESTATE");
  const helvault = getTerritory("TERRITORY_HELVAULT");
  assert.ok(estate.maxFortitude > Math.max(...ordinary.map((item) => item.maxFortitude)));
  assert.ok(helvault.maxFortitude > estate.maxFortitude);
  assert.ok(helvault.maxStability > estate.maxStability);
});

test("生成失败使用结构化错误而非静默降级", () => {
  assert.throws(
    () => generateTerritory({
      id: "TERRITORY_INVALID",
      name: "无配置领土",
      shortName: "无配置",
      regionId: "REGION_UNKNOWN",
      type: "测试",
      map: { x: 0, y: 0 },
    }),
    (error) =>
      error instanceof TerritoryGenerationError &&
      error.code === "UNKNOWN_REGION_PROFILE",
  );
});
