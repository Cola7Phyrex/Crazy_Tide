import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { INNISTRAD_FIXED_REWARDS } from "../src/data/reward-data.js";
import {
  OLIVIA_BLUEPRINT_ID,
} from "../src/data/legendary-prototype-data.js";
import {
  archiveLegendaryBlueprint,
  deriveOliviaBlueprint,
  destroyLegendaryEntity,
  getLegendaryIdentity,
  getLegendaryPermissions,
  instantiateOlivia,
  recordLegendaryCareer,
  rebuildOlivia,
  recordOliviaCommanderTrigger,
  recordOliviaDirectKill,
  recordOliviaExpeditionCompletion,
  settleLegendaryRest,
  restoreLegendaryBlueprint,
  resolveLegendaryCommanderWipe,
  recoverLegendaryInjuriesAfterExpedition,
  updateOliviaPlacements,
} from "../src/systems/legendary-prototypes.js";
import {
  acceptExecution,
  activateOliviaBloodFeast,
  advanceExpedition,
  startExpedition,
} from "../src/systems/expedition.js";
import { createCombat } from "../src/systems/combat.js";
import { grantReward } from "../src/systems/rewards.js";

function oliviaState() {
  const state = createInitialState({
    originId: "ORIGIN_B",
    landId: "LAND_SWAMP",
    now: 1000,
    gameId: "CT-TEST-OLIVIA",
  });
  state.rewardProgress.unlockedContentIds.push(OLIVIA_BLUEPRINT_ID);
  state.resources.amounts.R = 3;
  return state;
}

function instantiate(state = oliviaState(), now = 2000) {
  return instantiateOlivia(state, now);
}

test("沃达连蓝图不会免费生成实体，实体化支付1200无色", () => {
  const state = oliviaState();
  assert.equal(state.legendaryPrototypes.length, 0);
  const result = instantiate(state);
  assert.equal(
    result.state.resources.amounts.C,
    state.resources.amounts.C - 1200,
  );
  assert.equal(result.entity.currentLp, 3);
  assert.deepEqual(
    deriveOliviaBlueprint(result.state, result.entity).stats,
    { power: 4, defense: 4, hp: 5 },
  );
  assert.ok(
    deriveOliviaBlueprint(result.state, result.entity).abilities.includes(
      "ABILITY_FLYING",
    ),
  );
  assert.throws(() => instantiateOlivia(result.state, 3000), /已经拥有实体/);
});

test("沃达连在基地每分钟恢复1 LP至上限，出征时最低补至基础LP", () => {
  const instantiated = instantiate();
  const entityId = instantiated.entity.id;
  let state = {
    ...instantiated.state,
    legendaryPrototypes: instantiated.state.legendaryPrototypes.map(
      (entity) => ({
        ...entity,
        currentLp: 0,
        lastLpRestAt: 2000,
      }),
    ),
  };
  state = settleLegendaryRest(state, 182000);
  assert.equal(state.legendaryPrototypes[0].currentLp, 3);
  state = settleLegendaryRest(state, 362000);
  assert.equal(state.legendaryPrototypes[0].currentLp, 6);

  state.legendaryPrototypes[0].currentLp = 2;
  const started = startExpedition(
    state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      command: "RECON",
      legendaryPrototypeId: entityId,
    },
    400000,
  );
  assert.equal(started.state.activeExpedition.legendaryLp, 3);
  assert.equal(
    started.state.legendaryPrototypes[0].status,
    "DEPLOYED",
  );
  assert.equal(
    settleLegendaryRest(started.state, 1000000)
      .legendaryPrototypes[0].currentLp,
    3,
  );
});

test("沃达连分别以0、2、3、5、6 LP出发时得到3、3、3、5、6 LP", () => {
  const expected = new Map([
    [0, 3],
    [2, 3],
    [3, 3],
    [5, 5],
    [6, 6],
  ]);
  for (const [currentLp, departureLp] of expected) {
    const instantiated = instantiate(oliviaState(), 2000 + currentLp);
    const state = {
      ...instantiated.state,
      legendaryPrototypes: instantiated.state.legendaryPrototypes.map(
        (entity) => ({ ...entity, currentLp }),
      ),
    };
    const started = startExpedition(
      state,
      {
        territoryId: "TERRITORY_TUTORIAL_W",
        command: "RECON",
        legendaryPrototypeId: instantiated.entity.id,
      },
      10000 + currentLp,
    );
    assert.equal(
      started.state.activeExpedition.legendaryLp,
      departureLp,
    );
  }
});

test("沃达连独立装备格只接受恰好1×1的装备", () => {
  const instantiated = instantiate();
  const shield = updateOliviaPlacements(
    instantiated.state,
    [
      {
        instanceId: "OLIVIA_SHIELD",
        contentId: "EQUIPMENT_STOUT_SHIELD",
        zoneId: "LEGENDARY_EQUIPMENT",
        x: 0,
        y: 0,
        rotation: 0,
      },
    ],
    3000,
  );
  assert.equal(
    shield.blueprint.grid.zones.find(
      (zone) => zone.kind === "LEGENDARY_EQUIPMENT",
    ).cells[0],
    "OLIVIA_SHIELD",
  );
  assert.throws(
    () =>
      updateOliviaPlacements(
        instantiated.state,
        [
          {
            instanceId: "OLIVIA_GREATSWORD",
            contentId: "EQUIPMENT_GREATSWORD",
            zoneId: "LEGENDARY_EQUIPMENT",
            x: 0,
            y: 0,
            rotation: 0,
          },
        ],
        3000,
      ),
    /恰好1×1/,
  );
});

test("镇魔刃安装在原生传奇原体上也会在生命伤害后解缚", () => {
  let state = grantReward(
    oliviaState(),
    INNISTRAD_FIXED_REWARDS.ELBRUS_BINDING_BLADE,
    {
      sourceId: "TERRITORY_HELVAULT",
      resolutionKey: "TEST:OLIVIA:ELBRUS",
      now: 1500,
    },
  ).state;
  const instance = state.rewardProgress.instances.find(
    (item) => item.contentId === "EQUIPMENT_ELBRUS_BINDING_BLADE",
  );
  state = updateOliviaPlacements(
    state,
    [
      {
        instanceId: instance.instanceId,
        contentId: "EQUIPMENT_ELBRUS_BINDING_BLADE",
        zoneId: "LEGENDARY_EQUIPMENT",
        x: 0,
        y: 0,
        rotation: 0,
      },
    ],
    1800,
  ).state;
  const instantiated = instantiateOlivia(state, 2000);
  state = startExpedition(
    {
      ...instantiated.state,
      settings: {
        ...instantiated.state.settings,
        pauseAfterCombat: false,
      },
    },
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      command: "CONQUEST",
      legendaryPrototypeId: instantiated.entity.id,
    },
    3000,
  ).state;
  state = advanceExpedition(state, 20000, 23000).state;
  state.activeExpedition.combat.attacker.currentPower = 1;
  state.activeExpedition.combat.defender.currentDefense = 0;
  state = advanceExpedition(state, 5000, 28000).state;

  assert.equal(state.activeExpedition.elbrusTransformed, true);
  assert.equal(state.activeExpedition.withengarCurrentHp, 6);
  assert.equal(state.legendaryPrototypes[0].status, "DEAD");
  assert.equal(
    state.rewardProgress.instances.find(
      (item) => item.instanceId === instance.instanceId,
    ).location,
    "TRANSFORMED",
  );
  assert.equal(state.legendaryBlueprints[0].placements.length, 0);
});

test("血色邀宴消灭目标时先支付2 LP再因击杀回复1 LP", () => {
  const instantiated = instantiate();
  const entity = {
    ...instantiated.entity,
    status: "DEPLOYED",
  };
  const combat = createCombat(
    {
      id: entity.id,
      name: entity.name,
      power: 4,
      defense: 4,
      hp: 5,
      colors: ["B", "R"],
      abilities: ["ABILITY_FLYING"],
    },
    {
      id: "TARGET",
      name: "测试目标",
      power: 0,
      defense: 0,
      hp: 2,
    },
  );
  const state = {
    ...instantiated.state,
    legendaryPrototypes: [entity],
    activeExpedition: {
      id: "EXPEDITION_OLIVIA_FEAST",
      legendaryPrototypeId: entity.id,
      legendaryLp: 3,
      legendaryTemporaryHp: 0,
      legendaryActionWindow: {
        abilityId: "ABILITY_OLIVIA_BLOOD_FEAST",
        round: 1,
        enemyId: "TARGET",
      },
      combat,
      stats: { damageDealt: 0, rewards: {} },
      logEntries: [],
    },
  };
  const result = activateOliviaBloodFeast(state, 3000);
  assert.equal(result.activeExpedition.legendaryLp, 2);
  assert.equal(result.activeExpedition.legendaryTemporaryHp, 1);
  assert.equal(result.activeExpedition.combat.defender.currentHp, 0);
  assert.equal(
    result.legendaryPrototypes[0].progress.directKills,
    1,
  );
});

test("血色邀宴选择窗口不会冻结当前战斗回合", () => {
  const instantiated = instantiate();
  const entity = { ...instantiated.entity, status: "DEPLOYED" };
  const combat = createCombat(
    {
      id: entity.id,
      name: entity.name,
      power: 4,
      defense: 4,
      hp: 5,
      colors: ["B", "R"],
      abilities: ["ABILITY_FLYING"],
    },
    {
      id: "TARGET_NON_PAUSE",
      name: "未决目标",
      power: 1,
      defense: 1,
      hp: 5,
    },
  );
  const state = {
    ...instantiated.state,
    legendaryPrototypes: [entity],
    activeExpedition: {
      id: "EXPEDITION_NON_PAUSE",
      phase: "PATROL_COMBAT",
      playbackSpeed: 1,
      combatRemainingMs: 1500,
      legendaryPrototypeId: entity.id,
      legendaryLp: 3,
      legendaryActionWindow: {
        abilityId: "ABILITY_OLIVIA_BLOOD_FEAST",
        round: 1,
        enemyId: "TARGET_NON_PAUSE",
      },
      combat,
      logEntries: [],
    },
  };
  const result = advanceExpedition(state, 500, 3500);
  assert.equal(result.state.activeExpedition.combatRemainingMs, 1000);
  assert.equal(
    result.state.activeExpedition.legendaryActionWindow.abilityId,
    "ABILITY_OLIVIA_BLOOD_FEAST",
  );
});

test("沃达连指挥力量在生命伤害后生效但不参与坚守", () => {
  const instantiated = instantiate();
  const entity = instantiated.entity;
  let state = {
    ...instantiated.state,
    settings: {
      ...instantiated.state.settings,
      pauseAfterCombat: false,
    },
    blueprints: [
      {
        id: "BLUEPRINT_COMMAND_TEST",
        name: "指挥测试军团",
        stats: { power: 2, defense: 0, hp: 10 },
        colors: ["W"],
        abilities: [],
      },
    ],
    prototypes: [
      {
        id: "PROTOTYPE_COMMAND_TEST",
        blueprintId: "BLUEPRINT_COMMAND_TEST",
        name: "测试原体",
        status: "READY",
        currentHp: 10,
        maxHp: 10,
      },
    ],
    legions: [
      {
        id: "LEGION_COMMAND_TEST",
        prototypeId: "PROTOTYPE_COMMAND_TEST",
        blueprintId: "BLUEPRINT_COMMAND_TEST",
        name: "指挥测试军团",
        purchasedScaleHp: 0,
        currentScaleHp: 0,
        temporaryScaleHp: 0,
        currentHp: 10,
        maxHp: 10,
        replicaCount: 0,
      },
    ],
  };
  const started = startExpedition(
    state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: "LEGION_COMMAND_TEST",
      command: "CONQUEST",
      commanderLegendaryPrototypeId: entity.id,
    },
    3000,
  ).state;
  const guard =
    started.territories.TERRITORY_TUTORIAL_W.activeGuardInstances[0];
  const combat = createCombat(
    {
      id: "LEGION_COMMAND_TEST",
      name: "指挥测试军团",
      power: 2,
      defense: 0,
      hp: 10,
      colors: ["W"],
      abilities: [],
    },
    {
      id: guard.id,
      name: "残血守军",
      power: 0,
      defense: 0,
      hp: 2,
      colors: ["W"],
      abilities: [],
    },
  );
  state = {
    ...started,
    territories: {
      ...started.territories,
      TERRITORY_TUTORIAL_W: {
        ...started.territories.TERRITORY_TUTORIAL_W,
        currentFortitude: 100,
        activeGuardInstances: [guard],
      },
    },
    activeExpedition: {
      ...started.activeExpedition,
      phase: "GARRISON_COMBAT",
      activeGuardId: guard.id,
      hadValidEncounter: true,
      combat,
      combatRemainingMs: 0,
    },
  };
  const result = advanceExpedition(state, 1, 4000).state;
  assert.equal(result.lastExpedition.commanderPowerTriggered, true);
  assert.equal(
    result.lastExpedition.combat.attacker.currentPower,
    3,
  );
  assert.equal(
    result.territories.TERRITORY_TUTORIAL_W.currentFortitude,
    80,
  );
  assert.equal(
    result.legendaryPrototypes[0].progress.commanderTriggers,
    1,
  );
});

test("沃达连三条永久成长轨迹并行且各自只解锁一次", () => {
  const instantiated = instantiate();
  const entityId = instantiated.entity.id;
  let state = {
    ...instantiated.state,
    legendaryPrototypes: instantiated.state.legendaryPrototypes.map(
      (entity) => ({
        ...entity,
        progress: {
          ...entity.progress,
          directKills: 99,
          commanderTriggers: 99,
          expeditionsCompleted: 49,
        },
      }),
    ),
  };
  state = recordOliviaDirectKill(state, entityId, false);
  state = recordOliviaCommanderTrigger(state, entityId);
  state = recordOliviaExpeditionCompletion(state, entityId);
  const blueprint = deriveOliviaBlueprint(
    state,
    state.legendaryPrototypes[0],
  );
  assert.deepEqual(blueprint.stats, {
    power: 5,
    defense: 4,
    hp: 6,
  });
  assert.equal(blueprint.baseLp, 4);
  assert.equal(blueprint.maxLp, 7);
});

test("测试模式中的击杀、指挥触发与远征不会推进永久成长", () => {
  const instantiated = instantiate();
  const entityId = instantiated.entity.id;
  let state = {
    ...instantiated.state,
    settings: {
      ...instantiated.state.settings,
      testMode: true,
    },
  };
  state = recordOliviaDirectKill(state, entityId, true);
  state = recordOliviaCommanderTrigger(state, entityId);
  state = recordOliviaExpeditionCompletion(state, entityId);
  assert.deepEqual(state.legendaryPrototypes[0].progress, {
    directKills: 0,
    commanderTriggers: 0,
    expeditionsCompleted: 0,
    powerGrowthUnlocked: false,
    lpGrowthUnlocked: false,
    hpGrowthUnlocked: false,
    unlockedNodeIds: [],
  });
  assert.equal(state.legendaryPrototypes[0].currentLp, 4);
});

test("通用权限矩阵区分普通传奇化蓝图与原生传奇身份", () => {
  assert.deepEqual(getLegendaryPermissions({ legendary: true }), {
    legendary: true,
    legendaryOrigin: false,
    canReplicate: false,
    hasIdentityArchive: false,
    canGrow: false,
    usesLp: false,
    canCommand: false,
    canBePermanentlyDeleted: true,
    canBeArchived: false,
  });
  const origin = getLegendaryPermissions({ legendaryOrigin: true });
  assert.equal(origin.canReplicate, false);
  assert.equal(origin.hasIdentityArchive, true);
  assert.equal(origin.canGrow, true);
  assert.equal(origin.usesLp, true);
  assert.equal(origin.canCommand, true);
  assert.equal(origin.canBeArchived, true);
});

test("传奇身份档案跨实体销毁、蓝图封存与重新实体化永久保留", () => {
  const instantiated = instantiate();
  const entityId = instantiated.entity.id;
  let state = recordOliviaDirectKill(instantiated.state, entityId, false);
  state = recordLegendaryCareer(
    state,
    entityId,
    { effectiveDamage: 7, directDamage: 7, expeditionsCompleted: 1 },
    5000,
  );
  state = destroyLegendaryEntity(state, entityId, 6000).state;
  assert.equal(state.legendaryPrototypes.length, 0);
  assert.equal(
    getLegendaryIdentity(state, "LEGENDARY_IDENTITY_OLIVIA_VOLDAREN")
      .contentProgress.directKills,
    1,
  );
  state = archiveLegendaryBlueprint(state, OLIVIA_BLUEPRINT_ID, 7000).state;
  assert.ok(state.legendaryBlueprints[0].archivedAt);
  assert.throws(() => instantiateOlivia(state, 8000), /解除.*封存/);
  state = restoreLegendaryBlueprint(state, OLIVIA_BLUEPRINT_ID, 9000).state;
  const second = instantiateOlivia(state, 10000);
  const identity = getLegendaryIdentity(
    second.state,
    "LEGENDARY_IDENTITY_OLIVIA_VOLDAREN",
  );
  assert.equal(second.entity.progress.directKills, 1);
  assert.equal(identity.career.effectiveDamage, 7);
  assert.equal(identity.entityHistory.length, 2);
});

test("死亡重构会建立新实体世代并继承同一身份成长", () => {
  const instantiated = instantiate();
  const oldEntityId = instantiated.entity.id;
  let state = recordOliviaDirectKill(
    instantiated.state,
    oldEntityId,
    false,
  );
  state = {
    ...state,
    legendaryPrototypes: state.legendaryPrototypes.map((entity) => ({
      ...entity,
      status: "DEAD",
      currentHp: 0,
    })),
  };
  const rebuilt = rebuildOlivia(state, oldEntityId, 7000);
  assert.notEqual(rebuilt.entity.id, oldEntityId);
  assert.equal(rebuilt.entity.progress.directKills, 1);
  assert.equal(rebuilt.identity.entityHistory.length, 2);
  assert.equal(
    rebuilt.identity.entityHistory[0].endReason,
    "REBUILT_AFTER_DEATH",
  );
});

test("指挥官全灭结算按存档随机数固化撤离、负伤与死亡", () => {
  const cases = [
    [1, "ESCAPED", "READY"],
    [5376, "INJURED", "INJURED"],
    [10752, "DEAD", "DEAD"],
  ];
  for (const [rngState, expectedOutcome, expectedStatus] of cases) {
    const instantiated = instantiate();
    const result = resolveLegendaryCommanderWipe(
      { ...instantiated.state, rngState },
      instantiated.entity.id,
    );
    assert.equal(result.outcome, expectedOutcome);
    assert.equal(result.state.legendaryPrototypes[0].status, expectedStatus);
    assert.notEqual(result.state.rngState, rngState);
  }
});

test("负伤传奇必须缺席，并在另一场正式远征完成后恢复", () => {
  const instantiated = instantiate();
  const entity = {
    ...instantiated.entity,
    status: "INJURED",
    injuryExpeditionsRemaining: 1,
  };
  const injuredState = {
    ...instantiated.state,
    legendaryPrototypes: [entity],
  };
  assert.throws(
    () =>
      startExpedition(
        injuredState,
        {
          territoryId: "TERRITORY_TUTORIAL_W",
          command: "RECON",
          legendaryPrototypeId: entity.id,
        },
        3000,
      ),
    /不能单体出击/,
  );
  const recovered = recoverLegendaryInjuriesAfterExpedition(injuredState);
  assert.equal(recovered.legendaryPrototypes[0].status, "READY");
  assert.equal(
    recovered.legendaryPrototypes[0].injuryExpeditionsRemaining,
    0,
  );
});

test("正式远征中的军团全灭会写入指挥官负伤结算", () => {
  const instantiated = instantiate();
  const entity = instantiated.entity;
  let state = {
    ...instantiated.state,
    rngState: 5376,
    blueprints: [
      {
        id: "BLUEPRINT_WIPE_TEST",
        name: "全灭测试军团",
        raceId: "RACE_HUMAN",
        stats: { power: 1, defense: 0, hp: 5 },
        colors: ["W"],
        abilities: [],
      },
    ],
    prototypes: [
      {
        id: "PROTOTYPE_WIPE_TEST",
        blueprintId: "BLUEPRINT_WIPE_TEST",
        name: "全灭测试原体",
        status: "READY",
        currentHp: 5,
        maxHp: 5,
      },
    ],
    legions: [
      {
        id: "LEGION_WIPE_TEST",
        prototypeId: "PROTOTYPE_WIPE_TEST",
        blueprintId: "BLUEPRINT_WIPE_TEST",
        name: "全灭测试军团",
        purchasedScaleHp: 0,
        currentScaleHp: 0,
        temporaryScaleHp: 0,
        currentHp: 5,
        maxHp: 5,
        replicaCount: 0,
      },
    ],
  };
  state = startExpedition(
    state,
    {
      territoryId: "TERRITORY_TUTORIAL_W",
      legionId: "LEGION_WIPE_TEST",
      command: "CONQUEST",
      commanderLegendaryPrototypeId: entity.id,
    },
    3000,
  ).state;
  state = {
    ...state,
    rngState: 5376,
    activeExpedition: {
      ...state.activeExpedition,
      phase: "EXECUTION_WARNING",
      hadValidEncounter: true,
    },
  };
  const finished = acceptExecution(state, 9000).state;
  assert.equal(finished.lastExpedition.commanderWipeOutcome, "INJURED");
  assert.match(finished.lastExpedition.summary, /负伤撤离/);
  assert.equal(finished.legendaryPrototypes[0].status, "INJURED");
});
