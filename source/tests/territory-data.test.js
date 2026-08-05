import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerritoryStates,
  getTerritory,
} from "../src/data/territory-data.js";

test("加渥尼巡逻队与三支守军严格匹配确认配置", () => {
  const gavony = getTerritory("TERRITORY_TOWN_WG");
  assert.deepEqual(
    {
      stats: [gavony.patrol.power, gavony.patrol.defense, gavony.patrol.hp],
      colors: gavony.patrol.colors,
      abilities: gavony.patrol.abilities,
      reward: gavony.patrol.firstReward,
    },
    {
      stats: [1, 1, 7],
      colors: ["W", "G"],
      abilities: ["ABILITY_REACH"],
      reward: { W: 1, G: 1, C: 200 },
    },
  );
  assert.deepEqual(
    gavony.garrison.templates.map((guard) => ({
      stats: [guard.power, guard.defense, guard.hp],
      colors: guard.colors,
      reward: guard.firstReward,
    })),
    [
      { stats: [2, 2, 12], colors: ["W"], reward: { W: 1, C: 300 } },
      { stats: [3, 1, 10], colors: ["G"], reward: { G: 1, C: 300 } },
      {
        stats: [2, 3, 11],
        colors: ["W", "G"],
        reward: { W: 1, G: 1, C: 400 },
      },
    ],
  );
  assert.deepEqual(gavony.conquestReward, { W: 2, G: 2, C: 1000 });
  assert.deepEqual(gavony.repeatReward, {
    C: 4000,
    randomColor: ["W", "G"],
  });
  assert.equal(
    createTerritoryStates().TERRITORY_TOWN_WG.activeGuardInstances.length,
    3,
  );
});
