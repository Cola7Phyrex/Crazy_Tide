import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { METATHRAN_FACILITY_TYPE } from "../src/data/artifact-data.js";
import {
  areAllGuideObjectivesComplete,
  getActiveGuideObjectives,
} from "../src/systems/objectives.js";

function makeState() {
  return createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-GUIDE",
  });
}

test("当前目标最多显示两条并随已完成动作递补", () => {
  const state = makeState();
  assert.deepEqual(
    getActiveGuideObjectives(state).map((item) => item.id),
    ["FIRST_PROTOTYPE", "LISTEN_REGION"],
  );

  state.flags.guideFirstPrototypeCompleted = true;
  assert.deepEqual(
    getActiveGuideObjectives(state).map((item) => item.id),
    ["LISTEN_REGION", "FORM_LEGION"],
  );
});

test("仿索蓝目标只在配方解锁后出现且全部完成时结束指引", () => {
  const state = makeState();
  state.flags = {
    ...state.flags,
    guideFirstPrototypeCompleted: true,
    guideRegionListened: true,
    guideFirstLegionCompleted: true,
    guideLegionReinforced: true,
    guideThemeChanged: true,
  };
  state.worldMap.completedTerritoryIds = ["TERRITORY_TUTORIAL_W"];
  state.worldMap.completedNodeIds = ["REGION_GAVONY"];

  assert.deepEqual(getActiveGuideObjectives(state), []);
  assert.equal(areAllGuideObjectivesComplete(state), false);

  state.flags.metathranRecipeUnlocked = true;
  assert.equal(getActiveGuideObjectives(state)[0].id, "BUILD_METATHRAN");
  state.manaFacilities.push({ type: METATHRAN_FACILITY_TYPE });
  assert.equal(areAllGuideObjectivesComplete(state), true);
});
