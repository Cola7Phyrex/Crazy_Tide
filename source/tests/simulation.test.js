import test from "node:test";
import assert from "node:assert/strict";
import { LANDS, ORIGINS } from "../src/data/game-data.js";
import { createInitialState } from "../src/state/initial-state.js";
import {
  createBlueprintDraft,
  deriveBlueprint,
  findFirstPlacement,
} from "../src/systems/blueprints.js";
import {
  rebuildPrototype,
  saveNewBlueprint,
} from "../src/systems/prototypes.js";
import {
  queueLegionProduction,
  settleProduction,
} from "../src/systems/production.js";
import {
  advanceExpedition,
  startExpedition,
} from "../src/systems/expedition.js";
import { getProductionRates, settleEconomy } from "../src/systems/resources.js";

function createStandardDraft(color) {
  const draft = createBlueprintDraft(color);
  draft.jobId = "JOB_WARRIOR";
  const contentIds = ["EQUIPMENT_BRONZE_SWORD", "EQUIPMENT_STOUT_SHIELD"];
  if (["W", "R"].includes(color)) contentIds.push("EQUIPMENT_GREATSWORD");
  if (color === "G") contentIds.push("EQUIPMENT_RANGERS_LONGBOW");
  for (const contentId of contentIds) {
    const position = findFirstPlacement(draft, contentId);
    draft.placements.push({
      instanceId: `SIM_${contentId}`,
      contentId,
      ...position,
    });
  }
  return draft;
}

function createStandardRun(originId, landId, now = 1000) {
  const origin = ORIGINS.find((item) => item.id === originId);
  const state = createInitialState({
    originId,
    landId,
    now,
    gameId: `CT-SIM-${originId}-${landId}`,
  });
  state.settings.pauseAfterCombat = false;
  const saved = saveNewBlueprint(
    state,
    createStandardDraft(origin.color),
    now + 1,
  );
  return {
    state: saved.state,
    blueprint: saved.blueprint,
    prototypeId: saved.prototype.id,
    now: now + 1,
  };
}

function createFullLegion(run) {
  let state = run.state;
  let now = run.now + 1;
  const prototype = state.prototypes.find(
    (item) => item.id === run.prototypeId,
  );
  if (prototype.status === "DEAD") {
    state = rebuildPrototype(state, run.prototypeId, now);
    now += 1;
  }
  const queued = queueLegionProduction(
    state,
    { prototypeId: run.prototypeId, scaleHp: 10 },
    now,
  );
  const completed = settleProduction(
    queued.state,
    queued.job.completesAt,
  );
  return {
    ...run,
    state: completed.state,
    legionId: completed.state.legions.at(-1).id,
    now: queued.job.completesAt,
  };
}

function runConquest(run, territoryId) {
  const withLegion = createFullLegion(run);
  const startedAt = withLegion.now + 1;
  const started = startExpedition(
    withLegion.state,
    {
      territoryId,
      legionId: withLegion.legionId,
      command: "CONQUEST",
    },
    startedAt,
  );
  const finished = advanceExpedition(
    started.state,
    300000,
    startedAt + 300000,
  );
  return {
    ...withLegion,
    state: finished.state,
    now: startedAt + 300000,
  };
}

function waitForColorless(run, minutes = 60) {
  const now = run.now + minutes * 60000;
  return {
    ...run,
    state: settleEconomy(run.state, now).state,
    now,
  };
}

test("五种起源×五种土地的25种开局都能建立标准蓝图和满规模军团", () => {
  let checked = 0;
  for (const origin of ORIGINS) {
    for (const land of LANDS) {
      const initial = createInitialState({
        originId: origin.id,
        landId: land.id,
        now: 1000,
        gameId: `CT-OPENING-${origin.id}-${land.id}`,
      });
      const derived = deriveBlueprint(
        createStandardDraft(origin.color),
        initial,
      );
      assert.equal(
        derived.valid,
        true,
        `${origin.id}/${land.id}标准蓝图应合法`,
      );
      const run = createStandardRun(origin.id, land.id);
      const full = createFullLegion(run);
      const coloredRate = Object.entries(getProductionRates(initial))
        .filter(([color]) => color !== "C")
        .reduce((sum, [, value]) => sum + value, 0);

      assert.equal(coloredRate, 2);
      assert.equal(full.state.legions.length, 1);
      assert.equal(full.state.legions[0].purchasedScaleHp, 10);
      assert.ok(
        full.state.resources.amounts.C >= 10000,
        `${origin.id}/${land.id}开局仍应保留足够的失败恢复储备`,
      );
      checked += 1;
    }
  }
  assert.equal(checked, 25);
});

test("标准构筑可分别攻陷两座教学村庄并取得阶段6入口", () => {
  for (const [originId, landId, territoryId] of [
    ["ORIGIN_W", "LAND_PLAINS", "TERRITORY_TUTORIAL_W"],
    ["ORIGIN_G", "LAND_FOREST", "TERRITORY_TUTORIAL_G"],
  ]) {
    let run = createStandardRun(originId, landId);
    run.state.flags.firstExpeditionStarted = true;
    run.state.territories[territoryId].routeIntelLevel = 1;
    for (
      let attempt = 0;
      attempt < 4 && !run.state.territories[territoryId].conquered;
      attempt += 1
    ) {
      run = runConquest(run, territoryId);
    }
    assert.equal(run.state.territories[territoryId].conquered, true);
    assert.equal(run.state.flags.firstVillageConquered, true);
    assert.ok(run.state.artifacts.includes("ARTIFACT_THRAN_DYNAMO"));
    assert.ok(run.state.resources.amounts.C >= 0);
  }
});

test("未侦查路线的随机巡逻下，两座教学村庄均保持高通关率", () => {
  for (const [originId, landId, territoryId] of [
    ["ORIGIN_W", "LAND_PLAINS", "TERRITORY_TUTORIAL_W"],
    ["ORIGIN_G", "LAND_FOREST", "TERRITORY_TUTORIAL_G"],
  ]) {
    let successes = 0;
    const samples = 40;
    for (let seed = 1; seed <= samples; seed += 1) {
      let run = createStandardRun(originId, landId);
      run.state.flags.firstExpeditionStarted = true;
      run.state.rngState = seed;
      for (
        let attempt = 0;
        attempt < 4 && !run.state.territories[territoryId].conquered;
        attempt += 1
      ) {
        run = runConquest(run, territoryId);
      }
      if (run.state.territories[territoryId].conquered) successes += 1;
    }
    assert.ok(
      successes / samples >= 0.9,
      `${territoryId}四次远征内通关率为${successes}/${samples}`,
    );
  }
});

test("标准构筑可通过跨远征进度攻陷加渥尼且不会资源软锁", () => {
  let run = createStandardRun("ORIGIN_W", "LAND_PLAINS");
  run.state.flags.firstExpeditionStarted = true;
  run.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  while (!run.state.territories.TERRITORY_TUTORIAL_W.conquered) {
    run = runConquest(run, "TERRITORY_TUTORIAL_W");
  }
  run.state.territories.TERRITORY_TOWN_WG.routeIntelLevel = 1;

  let attempts = 0;
  while (
    !run.state.territories.TERRITORY_TOWN_WG.conquered &&
    attempts < 8
  ) {
    run = waitForColorless(run);
    run = runConquest(run, "TERRITORY_TOWN_WG");
    attempts += 1;
  }

  assert.equal(run.state.territories.TERRITORY_TOWN_WG.conquered, true);
  assert.ok(attempts >= 2 && attempts <= 8);
  assert.equal(run.state.flags.mvpCompleted, true);
  assert.ok(run.state.artifacts.includes("ARTIFACT_PRISMATIC_LENS"));
  assert.ok(run.state.resources.amounts.C >= 0);
});
