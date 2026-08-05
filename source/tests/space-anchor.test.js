import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { INNISTRAD_FIXED_REWARDS } from "../src/data/reward-data.js";
import { grantReward } from "../src/systems/rewards.js";
import { settleEconomy } from "../src/systems/resources.js";
import {
  activateSpaceAnchor,
  getSpaceAnchorTargets,
  returnBaseToSubspace,
} from "../src/systems/space-anchor.js";
import { recordTerritoryVictory } from "../src/systems/world-map.js";

function worldCompleteState() {
  let state = createInitialState({
    originId: "ORIGIN_U",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-SPACE-ANCHOR",
  });
  state.worldMap.completedNodeIds = [
    "REGION_GAVONY",
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
    "REGION_MOORLAND",
    "REGION_THRABEN",
    "WORLD_INNISTRAD",
  ];
  state.worldMap.completedTerritoryIds = ["TERRITORY_TUTORIAL_W"];
  return grantReward(state, INNISTRAD_FIXED_REWARDS.SPACE_ANCHOR, {
    sourceId: "TERRITORY_HELVAULT",
    resolutionKey: "TEST:SPACE_ANCHOR",
    now: 2000,
  }).state;
}

test("空间锚点消耗唯一实例并以目标全部基本地替换开局基本地", () => {
  const state = worldCompleteState();
  const target = getSpaceAnchorTargets(state)[0];
  assert.equal(target.territoryId, "TERRITORY_TUTORIAL_W");
  assert.deepEqual(target.lands, [
    "LAND_PLAINS",
    "LAND_PLAINS",
    "LAND_PLAINS",
  ]);

  const anchored = activateSpaceAnchor(state, target.territoryId, 3000);
  assert.equal(anchored.base.anchorLocation.status, "ANCHORED");
  assert.equal(
    anchored.base.anchorLocation.descentMode,
    "REALITY_DIMENSION",
  );
  assert.equal(anchored.base.anchorLocation.universeId, "UNIVERSE_PRIMARY");
  assert.equal(anchored.base.anchorLocation.worldId, "WORLD_INNISTRAD");
  assert.equal(anchored.base.anchorLocation.regionId, "REGION_GAVONY");
  assert.equal(anchored.worldMap.baseLocationNodeId, "REGION_GAVONY");
  assert.equal(anchored.rewardProgress.instances[0].location, "CONSUMED");
  const produced = settleEconomy(anchored, 123000).state;
  assert.equal(produced.resources.amounts.U, 4);
  assert.equal(produced.resources.amounts.W, 3);
  assert.equal(produced.resources.amounts.B, 3);

  const returned = returnBaseToSubspace(produced, 124000);
  assert.equal(returned.base.anchorLocation.status, "RETURNED");
  assert.equal(returned.worldMap.baseLocationNodeId, "SUBSPACE_PRIMARY");
  const restored = settleEconomy(returned, 244000).state;
  assert.equal(restored.resources.amounts.U, 5);
  assert.equal(restored.resources.amounts.B, 4);
  assert.throws(
    () => activateSpaceAnchor(restored, target.territoryId, 245000),
    /不可逆地结束/,
  );
});

test("狱窖完成依尼翠时发放空间锚点与镇魔刃并登记世界完成", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-HELVAULT-REWARD",
  });
  state.worldMap.completedNodeIds = [
    "REGION_GAVONY",
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
    "REGION_MOORLAND",
  ];
  state.worldMap.completedTerritoryIds = [
    "TERRITORY_THRABEN_GATE_DISTRICT",
    "TERRITORY_THRABEN_BARRACKS_DISTRICT",
    "TERRITORY_THRABEN_CHURCH_DISTRICT",
  ];
  state = recordTerritoryVictory(
    state,
    "TERRITORY_HELVAULT",
    "CONQUEST",
    5000,
  );
  assert.ok(state.worldMap.completedNodeIds.includes("REGION_THRABEN"));
  assert.ok(state.worldMap.completedNodeIds.includes("WORLD_INNISTRAD"));
  assert.equal(state.worldMap.stats.worldsDestroyed, 1);
  assert.ok(state.artifacts.includes("ARTIFACT_SPACE_ANCHOR"));
  assert.ok(
    state.unlockedBiofactors.includes(
      "EQUIPMENT_ELBRUS_BINDING_BLADE",
    ),
  );
  assert.deepEqual(
    state.rewardProgress.instances
      .filter((item) =>
        [
          "ARTIFACT_SPACE_ANCHOR",
          "EQUIPMENT_ELBRUS_BINDING_BLADE",
        ].includes(item.contentId),
      )
      .map((item) => item.location),
    ["INVENTORY", "INVENTORY"],
  );
});
