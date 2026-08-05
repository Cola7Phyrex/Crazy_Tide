import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { createBlueprintDraft } from "../src/systems/blueprints.js";
import { saveNewBlueprint } from "../src/systems/prototypes.js";
import { queueLegionProduction } from "../src/systems/production.js";
import { INNISTRAD_FIXED_REWARDS } from "../src/data/reward-data.js";
import { grantReward } from "../src/systems/rewards.js";
import {
  advanceExpedition,
  acknowledgeBattleReview,
  castGrounded,
  castTasteForMayhem,
  castVirtuesRuin,
  COMBAT_ROUND_MS,
  INFILTRATION_CYCLE_MS,
  refreshGavonyChallenge,
  SCOUTED_TRAVEL_STEP_MS,
  startExpedition,
  TRAVEL_STEP_MS,
  unsummonExpedition,
} from "../src/systems/expedition.js";

function createReadyLegion({
  originId = "ORIGIN_W",
  landId = "LAND_PLAINS",
  raceId = "RACE_HUMAN",
  raceColor = "W",
  jobId = "JOB_WARRIOR",
  jobColor = null,
} = {}) {
  const state = createInitialState({
    originId,
    landId,
    now: 1000,
    gameId: "CT-TEST-EXPEDITION",
  });
  state.settings.pauseAfterCombat = false;
  const draft = createBlueprintDraft(raceColor);
  draft.raceId = raceId;
  draft.raceColor = raceColor;
  draft.jobId = jobId;
  draft.jobColor = jobColor;
  const saved = saveNewBlueprint(state, draft, 2000);
  const legion = queueLegionProduction(
    saved.state,
    { prototypeId: saved.prototype.id, scaleHp: 0 },
    3000,
  );
  return {
    state: legion.state,
    blueprint: saved.blueprint,
    prototype: saved.prototype,
    legion: legion.legion,
  };
}

test("第一次教学远征固定第一步安全、第二步遭遇巡逻", () => {
  const ready = createReadyLegion();
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  assert.equal(state.careerProgress.counters.expeditionsTotal, 1);
  assert.ok(
    state.achievementProgress.unlocked.ACHIEVEMENT_FIRST_EXPEDITION,
  );
  state = advanceExpedition(state, 10000, 14000).state;
  assert.equal(state.activeExpedition.phase, "TRAVELING");
  assert.equal(state.activeExpedition.travel.currentStep, 1);
  state = advanceExpedition(state, 10000, 24000).state;
  assert.equal(state.activeExpedition.phase, "PATROL_COMBAT");
  assert.equal(state.activeExpedition.pendingTravelStep, 2);
});

test("已探查路线每步耗时4秒，未探查路线仍为10秒", () => {
  const unknownRoute = createReadyLegion();
  let state = startExpedition(
    unknownRoute.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: unknownRoute.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  assert.equal(state.activeExpedition.travel.stepDurationMs, TRAVEL_STEP_MS);

  const knownRoute = createReadyLegion();
  knownRoute.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  state = startExpedition(
    knownRoute.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: knownRoute.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  assert.equal(
    state.activeExpedition.travel.stepDurationMs,
    SCOUTED_TRAVEL_STEP_MS,
  );
  state = advanceExpedition(state, SCOUTED_TRAVEL_STEP_MS - 1, 7999).state;
  assert.equal(state.activeExpedition.travel.currentStep, 0);
  assert.equal(state.activeExpedition.travel.stepRemainingMs, 1);
  state = advanceExpedition(state, 1, 8000).state;
  assert.equal(state.activeExpedition.travel.currentStep, 1);
  assert.equal(
    state.activeExpedition.travel.stepRemainingMs,
    SCOUTED_TRAVEL_STEP_MS,
  );
});

test("测试模式可直接攻击加渥尼且开启远征不消耗法术力", () => {
  const ready = createReadyLegion();
  ready.state.settings.testMode = true;
  const before = structuredClone(ready.state.resources.amounts);
  const started = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TOWN_WG",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;

  assert.ok(started.activeExpedition);
  assert.deepEqual(started.resources.amounts, before);
  assert.equal(started.careerProgress.counters.expeditionsTotal, 0);
});

test("军团补充生产完成前不能开启远征", () => {
  const ready = createReadyLegion();
  const queued = queueLegionProduction(
    ready.state,
    { prototypeId: ready.prototype.id, scaleHp: 1 },
    3500,
  ).state;

  assert.throws(
    () =>
      startExpedition(
        queued,
        {
          territoryId: "TERRITORY_TUTORIAL_W",
          legionId: ready.legion.id,
          command: "RECON",
        },
        4000,
      ),
    /正在补充/,
  );
});

test("每座尚未领取巡逻奖励的教学村庄都会在第二步固定遭遇", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_G",
    landId: "LAND_FOREST",
    raceColor: "G",
  });
  ready.state.flags.firstExpeditionStarted = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_G",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 20000, 24000).state;
  assert.equal(state.activeExpedition.phase, "PATROL_COMBAT");
  assert.equal(state.activeExpedition.pendingTravelStep, 2);
});

test("开启战斗结束暂停后必须确认复盘才能继续远征", () => {
  const ready = createReadyLegion();
  ready.state.settings.pauseAfterCombat = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 20000, 24000).state;
  state.activeExpedition.combat.attacker.currentPower = 30;
  state = advanceExpedition(
    state,
    COMBAT_ROUND_MS,
    24000 + COMBAT_ROUND_MS,
  ).state;
  assert.ok(state.battleReview);
  const frozen = structuredClone(state.activeExpedition);
  state = advanceExpedition(
    state,
    60000,
    24000 + COMBAT_ROUND_MS + 60000,
  ).state;
  assert.deepEqual(state.activeExpedition, frozen);
  state = acknowledgeBattleReview(state);
  assert.equal(state.battleReview, null);
  state = advanceExpedition(
    state,
    60000,
    24000 + COMBAT_ROUND_MS + 120000,
  ).state;
  assert.ok(state.lastExpedition);
  assert.ok(state.careerProgress.counters.combatDamageDealt > 0);
});

test("巡逻与守军掉落不会突破有色法术力容量", () => {
  const ready = createReadyLegion();
  ready.state.resources.amounts.W = ready.state.resources.caps.W;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 20000, 24000).state;
  state.activeExpedition.combat.attacker.currentPower = 20;
  state = advanceExpedition(state, 2000, 26000).state;

  assert.equal(state.resources.amounts.W, state.resources.caps.W);
});

test("敏捷从教学路线末端删除一步，移动步最低为1", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_R",
    landId: "LAND_MOUNTAIN",
    raceId: "RACE_GOBLIN",
    raceColor: "R",
    jobId: "JOB_NONE",
  });
  const state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  assert.equal(state.activeExpedition.travel.totalSteps, 2);
});

test("一级情报永久跳过巡逻并至少保留路线情报", () => {
  const ready = createReadyLegion();
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  ready.state.flags.firstExpeditionStarted = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 30000, 34000).state;
  assert.equal(state.activeExpedition, null);
  assert.ok(
    state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel >= 1,
  );
  assert.equal(state.lastExpedition.outcome === "SUCCESS" || state.lastExpedition.outcome === "RETURNED", true);
  assert.equal(state.legions.length, 1);
  assert.equal(state.legions[0].purchasedScaleHp, 0);
  assert.equal(state.legions[0].replicaCount, 0);
  assert.ok(state.lastExpedition.result);
  assert.equal(state.lastExpedition.resultAcknowledged, false);
  assert.equal(
    state.careerProgress.counters.expeditionVictories +
      state.careerProgress.counters.expeditionRetreats,
    1,
  );
});

test("渗透最后一轮先令稳定归零且不再消耗随机数判定暴露", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  ready.state.territories.TERRITORY_TUTORIAL_W.currentStability = 2;
  ready.state.flags.firstExpeditionStarted = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "INFILTRATION",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 12000, 16000).state;
  assert.equal(state.activeExpedition.phase, "INFILTRATING");
  const rngBeforeFinalCycle = state.rngState;
  state = advanceExpedition(state, 10000, 26000).state;
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.currentStability, 0);
  assert.equal(state.lastExpedition.outcome, "SUCCESS");
  assert.equal(state.rngState, rngBeforeFinalCycle);
  assert.equal(state.careerProgress.counters.infiltrationVictories, 1);
  assert.equal(state.careerProgress.counters.stabilityDamage, 2);
});

test("道德瓦解对白色守军提供渗透+2并消耗2点黑色法术力", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    raceColor: "B",
    jobId: "JOB_ROGUE",
    jobColor: "B",
  });
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  ready.state.territories.TERRITORY_TUTORIAL_W.currentStability = 4;
  ready.state.flags.firstExpeditionStarted = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "INFILTRATION",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 12000, 16000).state;
  assert.equal(state.activeExpedition.infiltration.effective, 2);
  const blackBefore = state.resources.amounts.B;
  state = castVirtuesRuin(state, 17000);

  assert.equal(state.resources.amounts.B, blackBefore - 2);
  assert.equal(state.activeExpedition.infiltration.effective, 4);
  assert.equal(state.activeExpedition.virtuesRuinApplies, true);
  state = advanceExpedition(state, 10000, 27000).state;
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.conquered, true);
});

test("道德瓦解在没有白色守军时不会增加渗透或暴露", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    raceColor: "B",
    jobId: "JOB_ROGUE",
    jobColor: "B",
  });
  ready.state.territories.TERRITORY_TUTORIAL_G.routeIntelLevel = 1;
  ready.state.flags.firstExpeditionStarted = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_G",
      legionId: ready.legion.id,
      command: "INFILTRATION",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 12000, 16000).state;
  state = castVirtuesRuin(state, 17000);

  assert.equal(state.activeExpedition.virtuesRuinApplies, false);
  assert.equal(state.activeExpedition.infiltration.effective, 2);
});

test("破坏之乐令坚守伤害翻倍、留下永久标记并至少保留一份战利品", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_R",
    landId: "LAND_MOUNTAIN",
    raceId: "RACE_GOBLIN",
    raceColor: "R",
    jobId: "JOB_NONE",
  });
  ready.state.flags.firstExpeditionStarted = true;
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  ready.state.territories.TERRITORY_TUTORIAL_W.currentFortitude = 12;
  ready.state.blueprints[0].stats.power = 3;
  ready.state.legions[0].currentHp = 2;
  ready.state.legions[0].maxHp = 2;

  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  state.territories.TERRITORY_TUTORIAL_W.activeGuardInstances =
    state.territories.TERRITORY_TUTORIAL_W.activeGuardInstances.map(
      (guard) => ({ ...guard, defeated: true }),
    );
  const redBefore = state.resources.amounts.R;
  state = castTasteForMayhem(state, 5000);
  assert.equal(state.resources.amounts.R, redBefore - 1);

  state = advanceExpedition(state, 30000, 35000).state;
  const territory = state.territories.TERRITORY_TUTORIAL_W;
  const resolution = territory.firstConquestLootResolution;

  assert.equal(territory.currentFortitude, 0);
  assert.equal(territory.conquered, true);
  assert.equal(territory.destructionMarks.length, 1);
  assert.equal(resolution.markerCount, 1);
  assert.equal(resolution.keptShareIndexes.length, 1);
  assert.equal(resolution.lostShareIndexes.length, 1);
  assert.equal(state.lastExpedition.result.mayhemBaseDamage, 6);
  assert.equal(state.lastExpedition.result.mayhemFinalDamage, 12);
  assert.equal(state.lastExpedition.result.fortitudeDamage, 12);
  assert.equal(state.lastExpedition.result.destructionMarksAdded, 1);
  assert.equal(
    Object.keys(state.lastExpedition.result.rewards).filter(
      (color) => state.lastExpedition.result.rewards[color] > 0,
    ).length,
    1,
  );
  assert.ok(state.artifacts.includes("ARTIFACT_THRAN_DYNAMO"));
  assert.equal(state.flags.metathranRecipeUnlocked, true);
  assert.equal(state.flags.firstVillageConquered, true);
});

test("禁足令飞行原体无法避开巡逻且不修改原始蓝图", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    raceId: "RACE_SPIRIT",
    raceColor: "W",
    jobId: "JOB_NONE",
  });
  ready.state.settings.testMode = true;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "RECON",
    },
    4000,
  ).state;
  state = castGrounded(state, 5000);
  state = advanceExpedition(state, 20000, 25000).state;

  assert.equal(state.activeExpedition.phase, "PATROL_COMBAT");
  assert.equal(
    state.activeExpedition.combat.attacker.abilities.includes(
      "ABILITY_FLYING",
    ),
    false,
  );
  assert.equal(state.activeExpedition.combat.defender.currentPower, 1);
  assert.equal(
    state.blueprints[0].abilities.includes("ABILITY_FLYING"),
    true,
  );
});

test("战斗中施放禁足会立即移除飞行防御和延势判断", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    raceId: "RACE_SPIRIT",
    raceColor: "W",
    jobId: "JOB_NONE",
  });
  ready.state.settings.testMode = true;
  ready.state.flags.firstExpeditionStarted = true;
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 12000, 16000).state;
  assert.equal(state.activeExpedition.phase, "GARRISON_COMBAT");
  assert.equal(
    state.activeExpedition.combat.attacker.maxDefense,
    ready.blueprint.stats.defense + 1,
  );

  state = castGrounded(state, 17000);
  assert.equal(
    state.activeExpedition.combat.attacker.maxDefense,
    ready.blueprint.stats.defense,
  );
  assert.equal(
    state.activeExpedition.combat.attacker.abilities.includes(
      "ABILITY_FLYING",
    ),
    false,
  );

  state = castTasteForMayhem(state, 18000);
  assert.equal(
    state.activeExpedition.combat.attacker.maxDefense,
    ready.blueprint.stats.defense + 1,
  );
  assert.equal(
    state.activeExpedition.combat.attacker.abilities.includes(
      "ABILITY_FLYING",
    ),
    true,
  );
});

test("征服依次消灭现场守军后按静态力量乘剩余生命结算坚守", () => {
  const ready = createReadyLegion();
  ready.state.flags.firstExpeditionStarted = true;
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  ready.state.blueprints[0].stats.power = 10;
  ready.state.blueprints[0].stats.defense = 10;
  ready.state.legions[0].currentPower = 10;
  ready.state.legions[0].currentDefense = 10;
  ready.state.legions[0].maxDefense = 10;
  ready.state.legions[0].currentHp = 20;
  ready.state.legions[0].maxHp = 20;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 12000, 16000).state;
  assert.equal(state.activeExpedition.phase, "GARRISON_COMBAT");
  state = advanceExpedition(state, 20000, 36000).state;
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.currentFortitude, 0);
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.conquered, true);
  assert.equal(
    state.territories.TERRITORY_TUTORIAL_W.defeatedInitialGuards.length,
    2,
  );
  assert.ok(state.unlockedBiofactors.includes("MODIFICATION_BRAIN"));
  assert.ok(state.artifacts.includes("ARTIFACT_THRAN_DYNAMO"));
  assert.equal(state.base.residueActive, false);
  assert.equal(state.flags.metathranRecipeUnlocked, true);
});

test("全部守军被消灭但坚守仍大于0时下次征服只补一支守军", () => {
  const ready = createReadyLegion();
  ready.state.flags.firstExpeditionStarted = true;
  const territory =
    ready.state.territories.TERRITORY_TUTORIAL_W;
  territory.currentFortitude = 8;
  territory.activeGuardInstances = territory.activeGuardInstances.map(
    (guard) => ({ ...guard, defeated: true }),
  );
  const started = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  const living = started.territories.TERRITORY_TUTORIAL_W.activeGuardInstances.filter(
    (guard) => !guard.defeated,
  );
  assert.equal(living.length, 1);
  assert.equal(living[0].reinforced, true);
});

test("最后一支守军同归于尽且剩余坚守不高于静态力量时触发最后火花", () => {
  const ready = createReadyLegion();
  ready.state.flags.firstExpeditionStarted = true;
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  const territory = ready.state.territories.TERRITORY_TUTORIAL_W;
  territory.currentFortitude = 5;
  territory.activeGuardInstances[0].defeated = true;
  ready.state.blueprints[0].stats.power = 10;
  ready.state.blueprints[0].stats.defense = 2;
  ready.state.legions[0].currentHp = 1;
  ready.state.legions[0].maxHp = 1;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 30000, 34000).state;
  state = advanceExpedition(state, 2000, 36000).state;
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.conquered, true);
  assert.equal(state.territories.TERRITORY_TUTORIAL_W.currentFortitude, 0);
  assert.equal(state.prototypes[0].status, "DEAD");
  assert.match(state.lastExpedition.summary, /最后火花/);
});

test("同归于尽但不能触发最后火花时仍永久保存守军死亡", () => {
  const ready = createReadyLegion();
  ready.state.flags.firstExpeditionStarted = true;
  ready.state.territories.TERRITORY_TUTORIAL_W.routeIntelLevel = 1;
  const territory = ready.state.territories.TERRITORY_TUTORIAL_W;
  territory.currentFortitude = 20;
  territory.activeGuardInstances[0].defeated = true;
  ready.state.blueprints[0].stats.power = 10;
  ready.state.blueprints[0].stats.defense = 2;
  ready.state.legions[0].currentHp = 1;
  ready.state.legions[0].maxHp = 1;
  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: ready.legion.id,
      command: "CONQUEST",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 32000, 36000).state;

  assert.equal(state.lastExpedition.outcome, "FAILURE");
  assert.equal(
    state.territories.TERRITORY_TUTORIAL_W.activeGuardInstances[1].defeated,
    true,
  );
  assert.equal(
    state.territories.TERRITORY_TUTORIAL_W.defeatedInitialGuards.length,
    1,
  );
  assert.match(state.lastExpedition.summary, /守军死亡已保存/);
});

test("加渥尼首次沦陷、手动刷新和重复奖励形成完整闭环", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.flags.firstVillageConquered = true;
  ready.state.flags.firstExpeditionStarted = true;
  const gavony = ready.state.territories.TERRITORY_TOWN_WG;
  gavony.routeIntelLevel = 1;
  gavony.currentStability = 2;

  let state = startExpedition(
    ready.state,
    {
      territoryId: "TERRITORY_TOWN_WG",
      legionId: ready.legion.id,
      command: "INFILTRATION",
    },
    4000,
  ).state;
  state = advanceExpedition(state, 50000, 54000).state;

  assert.equal(state.territories.TERRITORY_TOWN_WG.conquered, true);
  assert.equal(state.flags.gavonyFirstConquered, true);
  assert.equal(state.flags.mvpThanksPending, true);
  assert.ok(state.artifacts.includes("ARTIFACT_PRISMATIC_LENS"));
  assert.ok(state.unlockedBiofactors.includes("RACE_ELF"));
  assert.equal(state.resources.amounts.W, 2);
  assert.equal(state.resources.amounts.G, 2);
  const gavonyRewardRecords = state.rewardProgress.ledger.filter(
    (record) => record.sourceId === "TERRITORY_TOWN_WG",
  );
  assert.ok(gavonyRewardRecords.some((record) => record.grade === "A"));
  assert.ok(
    gavonyRewardRecords.some(
      (record) => record.rewardId === "REWARD_B_GAVONY_ELF",
    ),
  );
  const lensRecord = gavonyRewardRecords.find(
    (record) => record.rewardId === "REWARD_B_GAVONY_PRISMATIC_LENS",
  );
  assert.ok(lensRecord?.instanceId);
  assert.ok(
    state.rewardProgress.instances.some(
      (instance) => instance.instanceId === lensRecord.instanceId,
    ),
  );

  state = refreshGavonyChallenge(state);
  assert.equal(state.territories.TERRITORY_TOWN_WG.conquered, false);
  assert.equal(state.territories.TERRITORY_TOWN_WG.currentFortitude, 50);
  assert.equal(state.territories.TERRITORY_TOWN_WG.currentStability, 40);
  assert.equal(
    state.territories.TERRITORY_TOWN_WG.activeGuardInstances.length,
    3,
  );
  assert.ok(
    state.territories.TERRITORY_TOWN_WG.activeGuardInstances.every(
      (guard) => guard.rewardClaimed,
    ),
  );

  state.territories.TERRITORY_TOWN_WG.currentStability = 2;
  state.resources.amounts.C = 1000;
  const repeatLegion = state.legions.find(
    (item) => item.prototypeId === ready.prototype.id,
  );
  assert.ok(repeatLegion);
  const beforeColors = {
    W: state.resources.amounts.W,
    G: state.resources.amounts.G,
  };
  state = startExpedition(
    state,
    {
      territoryId: "TERRITORY_TOWN_WG",
      legionId: repeatLegion.id,
      command: "INFILTRATION",
    },
    61000,
  ).state;
  state = advanceExpedition(state, 50000, 111000).state;

  assert.equal(state.territories.TERRITORY_TOWN_WG.repeatCount, 1);
  assert.equal(state.resources.amounts.C, 4500);
  assert.equal(
    state.resources.amounts.W +
      state.resources.amounts.G -
      beforeColors.W -
      beforeColors.G,
    1,
  );
  assert.deepEqual(
    state.rewards.lastGavonyRepeat,
    state.resources.amounts.W > beforeColors.W
      ? { C: 4000, color: "W" }
      : { C: 4000, color: "G" },
  );
});

test("疯人院与血厅的固定结界会显示在当次渗透战利品中", () => {
  for (const [territoryId, contentId] of [
    [
      "TERRITORY_GEIER_REACH_SANITARIUM",
      "ENCHANTMENT_TASTE_FOR_MAYHEM",
    ],
    ["TERRITORY_STENSIA_BLOODHALL", "ENCHANTMENT_VIRTUES_RUIN"],
  ]) {
    const ready = createReadyLegion({
      originId: "ORIGIN_U",
      landId: "LAND_ISLAND",
      raceColor: "U",
      jobId: "JOB_ROGUE",
      jobColor: "U",
    });
    ready.state.settings.testMode = true;
    ready.state.territories[territoryId].currentStability = 1;

    let state = startExpedition(
      ready.state,
      {
        territoryId,
        legionId: ready.legion.id,
        command: "INFILTRATION",
      },
      4000,
    ).state;
    state.activeExpedition = {
      ...state.activeExpedition,
      phase: "INFILTRATING",
      infiltration: {
        base: 1,
        effective: 1,
        cycleRemainingMs: INFILTRATION_CYCLE_MS,
      },
    };
    state = advanceExpedition(
      state,
      INFILTRATION_CYCLE_MS,
      14000,
    ).state;

    assert.equal(state.lastExpedition.outcome, "SUCCESS");
    assert.ok(
      state.rewardProgress.unlockedContentIds.includes(contentId),
    );
    assert.ok(state.lastExpedition.result.unlockedContent.includes(contentId));
  }
});

test("直接暂停模式不会自动推进处决警告倒计时", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.activeExpedition = {
    id: "EXP_WARNING",
    command: "INFILTRATION",
    territoryId: "TERRITORY_TUTORIAL_W",
    legionId: ready.legion.id,
    prototypeId: ready.prototype.id,
    blueprintId: ready.blueprint.id,
    phase: "EXECUTION_WARNING",
    executionWarning: { remainingMs: 60000, mode: "PAUSE" },
    logEntries: [],
  };
  const result = advanceExpedition(ready.state, 120000, 200000).state;
  assert.equal(result.activeExpedition.executionWarning.remainingMs, 60000);
  assert.equal(result.prototypes[0].status, "READY");
});

test("暂停1分钟模式在60秒后处决原体", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.prototypes[0].status = "DEPLOYED";
  ready.state.activeExpedition = {
    id: "EXP_WARNING",
    command: "INFILTRATION",
    territoryId: "TERRITORY_TUTORIAL_W",
    legionId: ready.legion.id,
    prototypeId: ready.prototype.id,
    blueprintId: ready.blueprint.id,
    phase: "EXECUTION_WARNING",
    executionWarning: { remainingMs: 60000, mode: "PAUSE_60" },
    logEntries: [],
  };
  const result = advanceExpedition(ready.state, 60000, 64000).state;
  assert.equal(result.activeExpedition, null);
  assert.equal(result.prototypes[0].status, "DEAD");
});

test("反召唤在渗透处决警告中消耗3点蓝色法术力并只救回原体", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.prototypes[0].status = "DEPLOYED";
  ready.state.activeExpedition = {
    id: "EXP_WARNING",
    command: "INFILTRATION",
    territoryId: "TERRITORY_TUTORIAL_W",
    legionId: ready.legion.id,
    prototypeId: ready.prototype.id,
    blueprintId: ready.blueprint.id,
    phase: "EXECUTION_WARNING",
    executionWarning: { remainingMs: 60000, mode: "PAUSE" },
    logEntries: [],
  };
  const blueBefore = ready.state.resources.amounts.U;
  const insufficient = structuredClone(ready.state);
  insufficient.resources.amounts.U = 2;
  assert.throws(
    () => unsummonExpedition(insufficient, 4999),
    /需要3\[U\]/,
  );
  const result = unsummonExpedition(ready.state, 5000).state;
  assert.equal(result.resources.amounts.U, blueBefore - 3);
  assert.equal(result.legions.length, 1);
  assert.equal(result.legions[0].purchasedScaleHp, 0);
  assert.equal(result.legions[0].replicaCount, 0);
  assert.equal(result.prototypes[0].status, "READY");
  assert.equal(result.lastExpedition.outcome, "RECALLED");
});

test("反召唤不能在移动或征服任务中施放", () => {
  const ready = createReadyLegion({
    originId: "ORIGIN_U",
    landId: "LAND_ISLAND",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
  });
  ready.state.prototypes[0].status = "DEPLOYED";
  ready.state.activeExpedition = {
    id: "EXP_CONQUEST",
    command: "CONQUEST",
    territoryId: "TERRITORY_TUTORIAL_W",
    legionId: ready.legion.id,
    prototypeId: ready.prototype.id,
    blueprintId: ready.blueprint.id,
    phase: "TRAVELING",
    logEntries: [],
  };

  assert.throws(
    () => unsummonExpedition(ready.state, 5000),
    /仅能在渗透或其处决警告阶段/,
  );
});

test("镇魔刃在同归于尽的伤害交换中仍解缚威森格并在远征结束归库", () => {
  let state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-ELBRUS",
  });
  state.settings.pauseAfterCombat = false;
  state = grantReward(
    state,
    INNISTRAD_FIXED_REWARDS.ELBRUS_BINDING_BLADE,
    {
      sourceId: "TERRITORY_HELVAULT",
      resolutionKey: "TEST:ELBRUS",
      now: 1500,
    },
  ).state;
  const instance = state.rewardProgress.instances.find(
    (item) => item.contentId === "EQUIPMENT_ELBRUS_BINDING_BLADE",
  );
  const draft = createBlueprintDraft("W");
  draft.name = "持刃者";
  draft.placements.push({
    instanceId: instance.instanceId,
    contentId: "EQUIPMENT_ELBRUS_BINDING_BLADE",
    zoneId: "BASE",
    x: 0,
    y: 0,
    rotation: 0,
  });
  const saved = saveNewBlueprint(state, draft, 2000);
  assert.equal(saved.blueprint.stats.power, 1);
  assert.equal(saved.blueprint.legendary, true);
  assert.equal(
    saved.state.rewardProgress.instances.find(
      (item) => item.instanceId === instance.instanceId,
    ).location,
    "INSTALLED",
  );

  state = startExpedition(
    saved.state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      prototypeId: saved.prototype.id,
      command: "CONQUEST",
    },
    3000,
  ).state;
  state = advanceExpedition(state, 20000, 23000).state;
  assert.equal(state.activeExpedition.phase, "PATROL_COMBAT");
  state.activeExpedition.combat.attacker.currentHp = 1;
  state.activeExpedition.combat.attacker.currentDefense = 0;
  state.activeExpedition.combat.attacker.currentPower = 1;
  state.activeExpedition.combat.defender.currentHp = 1;
  state.activeExpedition.combat.defender.currentDefense = 0;
  state.activeExpedition.combat.defender.currentPower = 1;

  state = advanceExpedition(state, COMBAT_ROUND_MS, 28000).state;
  assert.equal(state.activeExpedition.elbrusTransformed, true);
  assert.equal(state.activeExpedition.withengarCurrentHp, 6);
  assert.equal(state.prototypes[0].status, "DEAD");
  assert.ok(
    state.activeExpedition.logEntries.some((entry) =>
      entry.text.includes("解缚威森格"),
    ),
  );
  assert.equal(
    state.rewardProgress.instances.find(
      (item) => item.instanceId === instance.instanceId,
    ).location,
    "TRANSFORMED",
  );

  state = advanceExpedition(state, 300000, 328000).state;
  assert.equal(state.activeExpedition, null);
  assert.equal(state.prototypes[0].status, "DEAD");
  assert.equal(
    state.rewardProgress.instances.find(
      (item) => item.instanceId === instance.instanceId,
    ).location,
    "INVENTORY",
  );
  assert.equal(
    state.blueprints[0].placements.some(
      (placement) =>
        placement.contentId === "EQUIPMENT_ELBRUS_BINDING_BLADE",
    ),
    false,
  );
  assert.match(state.lastExpedition.summary, /重新变为镇魔刃埃布斯/);
});
