import { nextRandom, rollChance } from "../core/random.js";
import {
  getGarrisonTemplate,
  getGarrisonTemplates,
  getTerritoryForState,
  createInitialGuardInstances,
  getTerritoryAccessReason,
  isTerritoryUnlocked,
} from "../data/territory-data.js";
import { createCombat, resolveCombatRound } from "./combat.js";
import {
  canAffordGameCost,
  isTestMode,
  spendGameCost,
} from "./testing-mode.js";
import { recordTerritoryVictory } from "./world-map.js";
import {
  GAVONY_FIXED_REWARDS,
  createBiofactorRewardDefinition,
  createManaRewardDefinition,
} from "../data/reward-data.js";
import { grantReward } from "./rewards.js";
import { getAbilityDefinition } from "../data/prototype-data.js";
import { getContentDisplayName } from "./content-presentation.js";
import {
  createBlueprintDraftFromBlueprint,
  deriveBlueprint,
} from "./blueprints.js";
import {
  deriveLegendaryBlueprint,
  recoverLegendaryInjuriesAfterExpedition,
  recordLegendaryCareer,
  recordLegendaryEntityEnd,
  recordLegendaryGrowthMetric,
  recordOliviaDirectKill,
  resolveLegendaryCommanderWipe,
} from "./legendary-prototypes.js";
import { applyCareerDelta } from "./career.js";

export const PORTAL_COST = 500;
export const TRAVEL_STEP_MS = 10000;
export const SCOUTED_TRAVEL_STEP_MS = 4000;
export const COMBAT_ROUND_MS = 5000;
export const INFILTRATION_CYCLE_MS = 10000;
export const EXECUTION_WARNING_MS = 60000;
export const VIRTUES_RUIN_ID = "ENCHANTMENT_VIRTUES_RUIN";
export const TASTE_FOR_MAYHEM_ID =
  "ENCHANTMENT_TASTE_FOR_MAYHEM";
export const GROUNDED_ID = "ENCHANTMENT_GROUNDED";
export const ELBRUS_ID = "EQUIPMENT_ELBRUS_BINDING_BLADE";

const WITHENGAR_BLUEPRINT = Object.freeze({
  id: "TEMPORARY_BLUEPRINT_WITHENGAR_UNBOUND",
  name: "解缚威森格",
  englishName: "Withengar Unbound",
  raceId: "RACE_DEMON",
  colors: ["B"],
  stats: Object.freeze({ power: 6, defense: 6, hp: 6 }),
  abilities: Object.freeze(["ABILITY_FLYING"]),
  legendary: true,
  legendaryOrigin: false,
});

function createId(prefix, now) {
  return `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function hasAbility(abilities, id) {
  return abilities?.includes(id);
}

function hasFlight(abilities = []) {
  return (
    hasAbility(abilities, "ABILITY_FLYING") ||
    hasAbility(abilities, "ABILITY_COMBAT_FLIGHT")
  );
}

function getTravelStepDuration(state, expedition) {
  if (
    Number.isFinite(expedition.travel.stepDurationMs) &&
    expedition.travel.stepDurationMs > 0
  ) {
    return expedition.travel.stepDurationMs;
  }
  return state.territories[expedition.territoryId]?.routeIntelLevel >= 1
    ? SCOUTED_TRAVEL_STEP_MS
    : TRAVEL_STEP_MS;
}

function isGrounded(expedition) {
  return expedition?.enchantmentId === GROUNDED_ID;
}

function getEffectiveAbilities(abilities = [], expedition) {
  return isGrounded(expedition)
    ? abilities.filter(
        (ability) =>
          ability !== "ABILITY_FLYING" &&
          ability !== "ABILITY_COMBAT_FLIGHT",
      )
    : [...abilities];
}

function addExpeditionLog(expedition, text, type = "expedition", now = Date.now()) {
  return {
    ...expedition,
    hadValidEncounter: true,
    logEntries: [
      ...(expedition.logEntries ?? []),
      { id: createId("EXPLOG", now), text, type, timestamp: now },
    ].slice(-120),
  };
}

function addExpeditionStats(expedition, delta = {}) {
  const stats = expedition.stats ?? {};
  const nextStats = {
    damageDealt: 0,
    damageTaken: 0,
    patrolsDefeated: 0,
    guardsDefeated: 0,
    fortitudeDamage: 0,
    stabilityDamage: 0,
    commanderAssistedDamage: 0,
    rewards: {},
    ...stats,
  };
  for (const [key, value] of Object.entries(delta)) {
    if (key === "rewards") continue;
    nextStats[key] = (nextStats[key] ?? 0) + value;
  }
  for (const [color, value] of Object.entries(delta.rewards ?? {})) {
    nextStats.rewards[color] = (nextStats.rewards[color] ?? 0) + value;
  }
  return { ...expedition, stats: nextStats };
}

function recordGrantedResources(expedition, beforeState, afterState) {
  const rewards = {};
  for (const color of ["W", "U", "B", "R", "G", "C"]) {
    const gained =
      afterState.resources.amounts[color] -
      beforeState.resources.amounts[color];
    if (gained > 0) rewards[color] = gained;
  }
  return addExpeditionStats(expedition, { rewards });
}

function withBattleReview(boundary, sourceState, combat, kind, now) {
  if (!sourceState.settings.pauseAfterCombat) return boundary;
  return {
    ...boundary,
    critical: true,
    state: {
      ...boundary.state,
      battleReview: {
        id: createId("BATTLE_REVIEW", now),
        kind,
        territoryId: combat.context.territoryId,
        combat,
        completedAt: now,
      },
    },
  };
}

function grantManaReward(
  state,
  reward,
  {
    rewardId,
    sourceId,
    resolutionKey,
    now,
    allowColoredOverflow = false,
  },
) {
  const hasPositiveAmount = Object.values(reward ?? {}).some(
    (value) => Number(value) > 0,
  );
  if (!hasPositiveAmount) return state;
  return grantReward(
    state,
    createManaRewardDefinition(rewardId, reward, {
      allowColoredOverflow,
    }),
    { sourceId, resolutionKey, now },
  ).state;
}

function grantBiofactorReward(
  state,
  biofactorId,
  { rewardId, sourceId, resolutionKey, now },
) {
  if (!biofactorId) return state;
  return grantReward(
    state,
    createBiofactorRewardDefinition(rewardId, biofactorId),
    { sourceId, resolutionKey, now },
  ).state;
}

function mergeRewardShares(shares) {
  return shares.reduce((reward, share) => {
    for (const [color, amount] of Object.entries(share)) {
      reward[color] = (reward[color] ?? 0) + amount;
    }
    return reward;
  }, {});
}

function resolveFirstConquestLoot(state, territory) {
  const territoryState = state.territories[territory.id];
  const shares = territory.conquestLootShares ?? [territory.conquestReward];
  const existing = territoryState.firstConquestLootResolution;
  if (existing) {
    return {
      state,
      reward: mergeRewardShares(
        existing.keptShareIndexes.map((index) => shares[index]).filter(Boolean),
      ),
    };
  }

  const markerCount = territoryState.destructionMarks?.length ?? 0;
  const lossCount = Math.min(markerCount, Math.max(0, shares.length - 1));
  const remainingIndexes = shares.map((_, index) => index);
  const lostShareIndexes = [];
  let rngState = state.rngState;

  for (let index = 0; index < lossCount; index += 1) {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    const selected = Math.floor(roll.value * remainingIndexes.length);
    lostShareIndexes.push(remainingIndexes.splice(selected, 1)[0]);
  }

  const resolution = {
    markerCount,
    keptShareIndexes: remainingIndexes,
    lostShareIndexes,
  };
  return {
    state: {
      ...state,
      rngState,
      territories: {
        ...state.territories,
        [territory.id]: {
          ...territoryState,
          firstConquestLootResolution: resolution,
        },
      },
    },
    reward: mergeRewardShares(
      remainingIndexes.map((index) => shares[index]).filter(Boolean),
    ),
  };
}

function applyConquestRewards(state, territory, now) {
  const isGavony = territory.id === "TERRITORY_TOWN_WG";
  const firstGavony = isGavony && !state.flags.gavonyFirstConquered;
  const territoryState = state.territories[territory.id];
  let nextState;

  if (isGavony && !firstGavony) {
    const roll = nextRandom(state.rngState);
    const randomColor =
      territory.repeatReward.randomColor[
        Math.floor(roll.value * territory.repeatReward.randomColor.length)
      ];
    nextState = grantManaReward(
      { ...state, rngState: roll.rngState },
      { C: territory.repeatReward.C, [randomColor]: 1 },
      {
        rewardId: `REWARD_A_${territory.id}_REPEAT`,
        sourceId: territory.id,
        resolutionKey: `${territory.id}:REPEAT:${territoryState.repeatCount + 1}:A`,
        now,
        allowColoredOverflow: true,
      },
    );
    nextState = {
      ...nextState,
      territories: {
        ...nextState.territories,
        [territory.id]: {
          ...nextState.territories[territory.id],
          repeatCount:
            nextState.territories[territory.id].repeatCount + 1,
        },
      },
      rewards: {
        ...nextState.rewards,
        lastGavonyRepeat: {
          C: territory.repeatReward.C,
          color: randomColor,
        },
      },
      flags: {
        ...nextState.flags,
        gavonyRefreshAvailable: true,
      },
    };
    return nextState;
  }

  const loot = resolveFirstConquestLoot(state, territory);
  nextState = grantManaReward(loot.state, loot.reward, {
    rewardId: `REWARD_A_${territory.id}_FIRST_COMPLETION`,
    sourceId: territory.id,
    resolutionKey: `${territory.id}:FIRST_COMPLETION:A`,
    now,
    allowColoredOverflow: true,
  });
  const firstVillage =
    territory.type === "村庄" && !nextState.flags.firstVillageConquered;
  if (firstGavony) {
    nextState = grantReward(nextState, GAVONY_FIXED_REWARDS.ELF, {
      sourceId: territory.id,
      resolutionKey: `${territory.id}:FIRST_COMPLETION:B:RACE_ELF`,
      now,
    }).state;
    nextState = grantReward(
      nextState,
      GAVONY_FIXED_REWARDS.PRISMATIC_LENS,
      {
        sourceId: territory.id,
        resolutionKey: `${territory.id}:FIRST_COMPLETION:B:PRISMATIC_LENS`,
        now,
      },
    ).state;
    return {
      ...nextState,
      prismaticLens: {
        enabled: false,
        selectedColor: "W",
      },
      flags: {
        ...nextState.flags,
        gavonyFirstConquered: true,
        gavonyRefreshAvailable: true,
        mvpCompleted: true,
        mvpThanksPending: true,
      },
      rewards: {
        ...nextState.rewards,
        elfQueenMessage:
          "来自妖精女皇的宣战讯息已经抵达亚空间锚点。",
      },
    };
  }
  if (!firstVillage) return nextState;

  nextState = grantReward(nextState, GAVONY_FIXED_REWARDS.THRAN_DYNAMO, {
    sourceId: territory.id,
    resolutionKey: "WORLD_INNISTRAD:FIRST_VILLAGE:B:THRAN_DYNAMO",
    now,
  }).state;
  return {
    ...nextState,
    base: {
      ...nextState.base,
      residueActive: false,
    },
    clock: {
      ...nextState.clock,
      productionCycles: {
        ...nextState.clock.productionCycles,
        RESIDUE: 0,
        THRAN_DYNAMO: 0,
      },
    },
    flags: {
      ...nextState.flags,
      firstVillageConquered: true,
      metathranRecipeUnlocked: true,
    },
  };
}

export function refreshGavonyChallenge(state) {
  const territory = getTerritoryForState(state, "TERRITORY_TOWN_WG");
  const territoryState = state.territories[territory.id];
  if (state.activeExpedition) throw new Error("远征进行中，无法刷新挑战");
  if (
    !state.flags.gavonyRefreshAvailable ||
    !territoryState.conquered
  ) {
    throw new Error("加渥尼当前不能刷新");
  }
  const generation = territoryState.repeatCount + 1;
  return {
    ...state,
    territories: {
      ...state.territories,
      [territory.id]: {
        ...territoryState,
        currentLands: [...territory.lands],
        currentFortitude: territory.maxFortitude,
        currentStability: territory.maxStability,
        activeGuardInstances: createInitialGuardInstances(
          territory,
          generation,
        ),
        conquered: false,
        patrolFirstRewardClaimed: true,
      },
    },
    flags: {
      ...state.flags,
      gavonyRefreshAvailable: false,
    },
  };
}

function getElbrusPlacement(blueprint) {
  return blueprint?.placements?.find(
    (placement) => placement.contentId === ELBRUS_ID,
  ) ?? null;
}

function detachElbrus(
  state,
  blueprintId,
  { location, now = Date.now() },
) {
  const blueprint = state.blueprints.find((item) => item.id === blueprintId);
  const placement = getElbrusPlacement(blueprint);
  if (!blueprint || !placement) return { state, instanceId: null };
  const stripped = {
    ...blueprint,
    placements: blueprint.placements.filter(
      (item) => item.instanceId !== placement.instanceId,
    ),
  };
  const derived = deriveBlueprint(
    createBlueprintDraftFromBlueprint(stripped),
  );
  return {
    state: {
      ...state,
      blueprints: state.blueprints.map((item) =>
        item.id === blueprintId
          ? {
              ...item,
              ...derived,
              id: item.id,
              createdAt: item.createdAt,
              updatedAt: now,
              legendary: true,
              legendaryOrigin: false,
            }
          : item,
      ),
      rewardProgress: {
        ...state.rewardProgress,
        instances: (state.rewardProgress?.instances ?? []).map((instance) =>
          instance.instanceId === placement.instanceId
            ? {
                ...instance,
                location,
                installedOnType: null,
                installedOnId: null,
                transformedAt:
                  location === "TRANSFORMED" ? now : instance.transformedAt,
              }
            : instance,
        ),
      },
    },
    instanceId: placement.instanceId,
  };
}

function detachLegendaryElbrus(
  state,
  blueprintId,
  { location, now = Date.now() },
) {
  const configuration = state.legendaryBlueprints?.find(
    (item) => item.id === blueprintId,
  );
  const placement = getElbrusPlacement(configuration);
  if (!configuration || !placement) return { state, instanceId: null };
  return {
    state: {
      ...state,
      legendaryBlueprints: state.legendaryBlueprints.map((item) =>
        item.id === blueprintId
          ? {
              ...item,
              placements: item.placements.filter(
                (entry) => entry.instanceId !== placement.instanceId,
              ),
              updatedAt: now,
            }
          : item,
      ),
      rewardProgress: {
        ...state.rewardProgress,
        instances: (state.rewardProgress?.instances ?? []).map((instance) =>
          instance.instanceId === placement.instanceId
            ? {
                ...instance,
                location,
                installedOnType: null,
                installedOnId: null,
                transformedAt:
                  location === "TRANSFORMED" ? now : instance.transformedAt,
              }
            : instance,
        ),
      },
    },
    instanceId: placement.instanceId,
  };
}

function returnElbrusToInventory(state, expedition, now) {
  if (!expedition.elbrusInstanceId) return state;
  return {
    ...state,
    rewardProgress: {
      ...state.rewardProgress,
      instances: (state.rewardProgress?.instances ?? []).map((instance) =>
        instance.instanceId === expedition.elbrusInstanceId
          ? {
              ...instance,
              location: "INVENTORY",
              installedOnType: null,
              installedOnId: null,
              returnedAt: now,
            }
          : instance,
      ),
    },
  };
}

function getExpeditionEntities(state, expedition = state.activeExpedition) {
  if (expedition?.elbrusTransformed) {
    const prototype = expedition.legendaryPrototypeId
      ? state.legendaryPrototypes?.find(
          (item) => item.id === expedition.legendaryPrototypeId,
        )
      : state.prototypes.find((item) => item.id === expedition.prototypeId);
    return {
      prototype,
      blueprint: WITHENGAR_BLUEPRINT,
      legion: {
        id: `WITHENGAR_${expedition.id}`,
        prototypeId: expedition.prototypeId,
        blueprintId: WITHENGAR_BLUEPRINT.id,
        name: WITHENGAR_BLUEPRINT.name,
        purchasedScaleHp: 0,
        currentScaleHp: 0,
        temporaryScaleHp: 0,
        currentHp: expedition.withengarCurrentHp ?? 6,
        maxHp: 6,
        replicaCount: 0,
        currentPower: 6,
        currentDefense: 6,
        maxDefense: 6,
        abilities: ["ABILITY_FLYING"],
      },
    };
  }
  if (expedition?.legendaryPrototypeId) {
    const legendaryEntity = state.legendaryPrototypes?.find(
      (item) => item.id === expedition.legendaryPrototypeId,
    );
    const blueprint = legendaryEntity
      ? deriveLegendaryBlueprint(
          state,
          legendaryEntity.blueprintId,
          legendaryEntity,
        )
      : null;
    const legion =
      legendaryEntity && blueprint
        ? {
            id: legendaryEntity.id,
            prototypeId: legendaryEntity.id,
            blueprintId: blueprint.id,
            name: legendaryEntity.name,
            purchasedScaleHp: 0,
            currentScaleHp: 0,
            temporaryScaleHp: 0,
            currentHp: legendaryEntity.currentHp,
            maxHp: legendaryEntity.maxHp,
            replicaCount: 0,
            currentPower: blueprint.stats.power,
            currentDefense: blueprint.stats.defense,
            maxDefense: blueprint.stats.defense,
            abilities: [...blueprint.abilities],
          }
        : null;
    return {
      legion,
      prototype: legendaryEntity,
      blueprint,
      legendaryEntity,
    };
  }
  let legion = state.legions.find((item) => item.id === expedition.legionId);
  const prototype = state.prototypes.find(
    (item) => item.id === expedition.prototypeId,
  );
  const blueprint = state.blueprints.find(
    (item) => item.id === expedition.blueprintId,
  );
  if (expedition.deploymentMode === "PROTOTYPE_SOLO" && prototype && blueprint) {
    legion = {
      id: prototype.id,
      prototypeId: prototype.id,
      blueprintId: blueprint.id,
      name: prototype.name,
      purchasedScaleHp: 0,
      currentScaleHp: 0,
      temporaryScaleHp: 0,
      currentHp: prototype.currentHp,
      maxHp: prototype.maxHp,
      replicaCount: 0,
      currentPower: blueprint.stats.power,
      currentDefense: blueprint.stats.defense,
      maxDefense: blueprint.stats.defense,
      abilities: [...blueprint.abilities],
    };
  }
  return { legion, prototype, blueprint };
}

function updateLegionFromCombat(state, expedition, combat) {
  if (expedition.elbrusTransformed) return state;
  if (expedition.legendaryPrototypeId) {
    return {
      ...state,
      legendaryPrototypes: (state.legendaryPrototypes ?? []).map((entity) =>
        entity.id === expedition.legendaryPrototypeId
          ? {
              ...entity,
              currentHp: combat.attacker.currentHp,
              maxHp: combat.attacker.maxHp,
              currentLp: expedition.legendaryLp ?? entity.currentLp,
            }
          : entity,
      ),
    };
  }
  if (expedition.deploymentMode === "PROTOTYPE_SOLO") {
    return {
      ...state,
      prototypes: state.prototypes.map((prototype) =>
        prototype.id === expedition.prototypeId
          ? {
              ...prototype,
              currentHp: combat.attacker.currentHp,
              maxHp: combat.attacker.maxHp,
            }
          : prototype,
      ),
    };
  }
  return {
    ...state,
    legions: state.legions.map((legion) =>
      legion.id === expedition.legionId
        ? {
            ...legion,
            currentHp: combat.attacker.currentHp,
            maxHp: combat.attacker.maxHp,
            currentDefense: combat.attacker.currentDefense,
            maxDefense: combat.attacker.maxDefense,
            currentScaleHp: combat.attacker.scaleHp,
            temporaryScaleHp: combat.attacker.temporaryScaleHp,
          }
        : legion,
    ),
  };
}

function applyElbrusTransformation(state, expedition, combat, now) {
  const record = combat.rounds.at(-1);
  if (
    expedition.elbrusTransformed ||
    !["PROTOTYPE_SOLO", "LEGENDARY_SOLO"].includes(
      expedition.deploymentMode,
    ) ||
    !record ||
    record.attackOnDefender.hpDamage <= 0
  ) {
    return { state, expedition, combat };
  }
  const { blueprint } = getExpeditionEntities(state, expedition);
  if (!getElbrusPlacement(blueprint)) {
    return { state, expedition, combat };
  }
  const detached = expedition.legendaryPrototypeId
    ? detachLegendaryElbrus(state, blueprint.id, {
        location: "TRANSFORMED",
        now,
      })
    : detachElbrus(state, expedition.blueprintId, {
        location: "TRANSFORMED",
        now,
      });
  const abilities = getEffectiveAbilities(["ABILITY_FLYING"], expedition);
  const flightDefense =
    hasFlight(abilities) &&
    !hasFlight(combat.defender.abilities) &&
    !hasAbility(combat.defender.abilities, "ABILITY_REACH")
      ? 1
      : 0;
  const attacker = {
    ...combat.attacker,
    id: `WITHENGAR_${expedition.id}`,
    name: WITHENGAR_BLUEPRINT.name,
    colors: ["B"],
    abilities,
    originalAbilities: ["ABILITY_FLYING"],
    basePower: 6,
    currentPower: 6,
    maxDefense: 6 + flightDefense,
    currentDefense: 6 + flightDefense,
    maxHp: 6,
    currentHp: 6,
    scaleHp: 0,
    temporaryScaleHp: 0,
    legendaryTemporaryHp: 0,
    bloodthirstStacks: 0,
    bloodthirstTriggered: false,
    enrageStacks: 0,
    soldierFormation: false,
    soldierReinforced: false,
    defenseStatus: "NORMAL",
    oddRemainderPending: false,
    isExposedRound: false,
  };
  const defenderDead = combat.defender.currentHp <= 0;
  const transformedCombat = {
    ...combat,
    attacker,
    noHpChangeStreak: 0,
    status: defenderDead ? "COMPLETE" : "ACTIVE",
    winner: defenderDead ? "ATTACKER" : null,
    reason: defenderDead ? "DEFENDER_DESTROYED" : null,
  };
  const transformedState = {
    ...detached.state,
    prototypes: detached.state.prototypes.map((prototype) =>
      prototype.id === expedition.prototypeId
        ? { ...prototype, status: "DEAD", currentHp: 0 }
        : prototype,
    ),
    legendaryPrototypes: (detached.state.legendaryPrototypes ?? []).map(
      (prototype) =>
        prototype.id === expedition.legendaryPrototypeId
          ? { ...prototype, status: "DEAD", currentHp: 0 }
          : prototype,
    ),
  };
  return {
    state: transformedState,
    expedition: addExpeditionLog(
      {
        ...expedition,
        elbrusTransformed: true,
        elbrusInstanceId: detached.instanceId,
        withengarCurrentHp: 6,
      },
      "镇魔刃埃布斯解开封印：装备者被消灭，解缚威森格以6/6/6形态替代其继续远征。",
      "combat",
      now,
    ),
    combat: transformedCombat,
  };
}

function applyLegendaryRoundEffects(
  state,
  expedition,
  previousCombat,
  combat,
  now = Date.now(),
) {
  const record = combat.rounds.at(-1);
  if (!record || record.round !== combat.round) {
    return { state, expedition, combat };
  }
  let nextState = state;
  let nextCombat = combat;
  let nextExpedition = {
    ...expedition,
    bloodthirstStacks: combat.attacker.bloodthirstStacks,
    legendaryTemporaryHp:
      combat.attacker.legendaryTemporaryHp ?? 0,
  };
  const elbrus = applyElbrusTransformation(
    nextState,
    nextExpedition,
    nextCombat,
    now,
  );
  nextState = elbrus.state;
  nextCombat = elbrus.combat;
  nextExpedition = elbrus.expedition;
  if (nextExpedition.elbrusTransformed) {
    nextExpedition.withengarCurrentHp = nextCombat.attacker.currentHp;
  }
  const commander = expedition.commanderLegendaryPrototypeId
    ? state.legendaryPrototypes?.find(
        (item) => item.id === expedition.commanderLegendaryPrototypeId,
      )
    : null;
  const commanderDefinition = commander
    ? deriveLegendaryBlueprint(state, commander.blueprintId, commander)
    : null;
  const soloEntity = expedition.legendaryPrototypeId
    ? state.legendaryPrototypes?.find(
        (item) => item.id === expedition.legendaryPrototypeId,
      )
    : null;
  const soloDefinition = soloEntity
    ? deriveLegendaryBlueprint(state, soloEntity.blueprintId, soloEntity)
    : null;

  if (
    expedition.commanderLegendaryPrototypeId &&
    commanderDefinition?.commander?.effect ===
      "EXPEDITION_POWER_AFTER_HP_DAMAGE" &&
    !expedition.commanderPowerTriggered &&
    record.attackOnDefender.hpDamage > 0
  ) {
    nextCombat = {
      ...nextCombat,
      attacker: {
        ...nextCombat.attacker,
        currentPower:
          nextCombat.attacker.currentPower +
          (commanderDefinition.commander.power ?? 1),
      },
    };
    nextExpedition.commanderPowerTriggered = true;
    nextState = recordLegendaryGrowthMetric(
      nextState,
      expedition.commanderLegendaryPrototypeId,
      "commanderTriggers",
    );
  }

  if (
    expedition.commanderLegendaryPrototypeId &&
    expedition.commanderPowerTriggered &&
    record.attackOnDefender.hpDamage > 0
  ) {
    nextExpedition = addExpeditionStats(nextExpedition, {
      commanderAssistedDamage: Math.min(
        1,
        record.attackOnDefender.hpDamage,
      ),
    });
  }

  const directNormalKill =
    expedition.legendaryPrototypeId &&
    soloDefinition?.abilities.includes("ABILITY_OLIVIA_DRINK_THE_LAST") &&
    previousCombat.defender.currentHp > 0 &&
    nextCombat.defender.currentHp <= 0 &&
    record.attackOnDefender.hpDamage > 0;
  if (directNormalKill) {
    nextState = recordOliviaDirectKill(
      nextState,
      expedition.legendaryPrototypeId,
      nextCombat.attacker.currentHp > 0,
    );
    const entity = nextState.legendaryPrototypes.find(
      (item) => item.id === expedition.legendaryPrototypeId,
    );
    nextExpedition.legendaryLp = entity.currentLp;
  }

  if (
    expedition.legendaryPrototypeId &&
    !nextExpedition.elbrusTransformed &&
    soloDefinition?.activeAbilities?.some(
      (ability) => ability.abilityId === "ABILITY_OLIVIA_BLOOD_FEAST",
    ) &&
    nextCombat.status === "ACTIVE" &&
    nextCombat.attacker.currentHp > 0 &&
    nextCombat.defender.currentHp > 0 &&
    record.attackOnDefender.hpDamage > 0 &&
    (nextExpedition.legendaryLp ?? 0) >= 2
  ) {
    nextExpedition.legendaryActionWindow = {
      abilityId: "ABILITY_OLIVIA_BLOOD_FEAST",
      round: nextCombat.round,
      enemyId: nextCombat.defender.id,
    };
  } else {
    nextExpedition.legendaryActionWindow = null;
  }
  return {
    state: nextState,
    expedition: nextExpedition,
    combat: nextCombat,
  };
}

function finishExpedition(
  state,
  expedition,
  {
    outcome,
    prototypeDead = false,
    text,
    now = Date.now(),
    preservePrototypeHp = false,
  },
) {
  let workingState = state;
  if (
    prototypeDead &&
    !expedition.elbrusTransformed &&
    expedition.deploymentMode === "PROTOTYPE_SOLO"
  ) {
    const detached = detachElbrus(workingState, expedition.blueprintId, {
      location: "INVENTORY",
      now,
    });
    workingState = detached.state;
    if (detached.instanceId) {
      expedition = {
        ...expedition,
        elbrusInstanceId: detached.instanceId,
      };
    }
  }
  if (
    prototypeDead &&
    !expedition.elbrusTransformed &&
    expedition.deploymentMode === "LEGENDARY_SOLO"
  ) {
    const legendaryEntity = workingState.legendaryPrototypes?.find(
      (item) => item.id === expedition.legendaryPrototypeId,
    );
    if (legendaryEntity) {
      const detached = detachLegendaryElbrus(
        workingState,
        legendaryEntity.blueprintId,
        { location: "INVENTORY", now },
      );
      workingState = detached.state;
      if (detached.instanceId) {
        expedition = {
          ...expedition,
          elbrusInstanceId: detached.instanceId,
        };
      }
    }
  }
  if (expedition.elbrusTransformed) {
    workingState = returnElbrusToInventory(workingState, expedition, now);
  }
  const effectivePrototypeDead =
    prototypeDead || Boolean(expedition.elbrusTransformed);
  const legendaryParticipantId =
    expedition.legendaryPrototypeId ??
    expedition.commanderLegendaryPrototypeId;
  if (legendaryParticipantId && expedition.hadValidEncounter) {
    workingState = recordLegendaryGrowthMetric(
      workingState,
      legendaryParticipantId,
      "expeditionsCompleted",
    );
    const duration = Math.max(0, now - (expedition.startedAt ?? now));
    const isSolo = expedition.legendaryPrototypeId === legendaryParticipantId;
    const victory = outcome === "SUCCESS";
    const assistedDamage = isSolo
      ? 0
      : expedition.stats?.commanderAssistedDamage ?? 0;
    const directDamage = isSolo ? expedition.stats?.damageDealt ?? 0 : 0;
    workingState = recordLegendaryCareer(
      workingState,
      legendaryParticipantId,
      {
        activeServiceTime: duration,
        expeditionTime: duration,
        effectiveDamage: directDamage + assistedDamage,
        damageTakenSurvived:
          isSolo && !effectivePrototypeDead
            ? expedition.stats?.damageTaken ?? 0
            : 0,
        expeditionsCompleted: 1,
        soloVictories: isSolo && victory ? 1 : 0,
        commanderVictories: !isSolo && victory ? 1 : 0,
        directDamage,
        assistedDamage,
      },
      now,
    );
  }
  if (effectivePrototypeDead && expedition.legendaryPrototypeId) {
    workingState = recordLegendaryEntityEnd(
      workingState,
      expedition.legendaryPrototypeId,
      "EXPEDITION_DEATH",
      now,
    );
  }
  const { prototype, blueprint, legion } = getExpeditionEntities(
    workingState,
    expedition,
  );
  const returningPrototypeHp = preservePrototypeHp
    ? prototype?.currentHp ?? blueprint?.stats.hp ?? 0
    : prototype?.maxHp ?? blueprint?.stats.hp ?? 0;
  const standbyLegion =
    expedition.deploymentMode !== "LEGENDARY_SOLO" &&
    !effectivePrototypeDead &&
    (expedition.deploymentMode ?? "LEGION") === "LEGION" &&
    prototype && blueprint && legion
      ? {
          ...legion,
          purchasedScaleHp: 0,
          currentScaleHp: 0,
          temporaryScaleHp: 0,
          currentHp: returningPrototypeHp,
          maxHp: blueprint.stats.hp,
          replicaCount: 0,
          currentPower: blueprint.stats.power,
          currentDefense: blueprint.stats.defense,
          maxDefense: blueprint.stats.defense,
          abilities: [...blueprint.abilities],
          readyAt: now,
        }
      : null;
  const result = {
    ...(expedition.stats ?? {}),
    unlockedBiofactors: workingState.unlockedBiofactors.filter(
      (id) =>
        !(expedition.startingBiofactorUnlocks ?? []).includes(id),
    ),
    unlockedArtifacts: workingState.artifacts.filter(
      (id) => !(expedition.startingArtifacts ?? []).includes(id),
    ),
    unlockedContent: Array.isArray(expedition.startingContentUnlocks)
      ? (workingState.rewardProgress?.unlockedContentIds ?? []).filter(
          (id) => !expedition.startingContentUnlocks.includes(id),
        )
      : Array.from(
          new Set(
            (workingState.rewardProgress?.ledger ?? [])
              .filter(
                (record) =>
                  record.contentId &&
                  record.acquiredAt >= (expedition.startedAt ?? now),
              )
              .map((record) => record.contentId),
          ),
        ),
  };
  const returningLegendaryBlueprint = expedition.legendaryPrototypeId
    ? deriveLegendaryBlueprint(
        workingState,
        workingState.legendaryPrototypes.find(
          (item) => item.id === expedition.legendaryPrototypeId,
        )?.blueprintId,
        workingState.legendaryPrototypes.find(
          (item) => item.id === expedition.legendaryPrototypeId,
        ),
      )
    : null;
  let commanderWipeOutcome = null;
  if (effectivePrototypeDead && expedition.commanderLegendaryPrototypeId) {
    const resolution = resolveLegendaryCommanderWipe(
      workingState,
      expedition.commanderLegendaryPrototypeId,
      now,
    );
    workingState = resolution.state;
    commanderWipeOutcome = resolution.outcome;
  }
  let nextState = {
    ...workingState,
    legions: [
      ...workingState.legions.filter(
        (item) => item.id !== expedition.legionId,
      ),
      ...(standbyLegion ? [standbyLegion] : []),
    ],
    prototypes: workingState.prototypes.map((item) => {
      if (item.id !== expedition.prototypeId) return item;
      if (effectivePrototypeDead) {
        return { ...item, status: "DEAD", currentHp: 0 };
      }
      return {
        ...item,
        status: "READY",
        currentHp: preservePrototypeHp ? item.currentHp : item.maxHp,
      };
    }),
    legendaryPrototypes: (workingState.legendaryPrototypes ?? []).map(
      (entity) => {
        if (entity.id === expedition.legendaryPrototypeId) {
          return {
            ...entity,
            status: effectivePrototypeDead ? "DEAD" : "READY",
            currentHp: effectivePrototypeDead
              ? 0
              : preservePrototypeHp
                ? Math.min(
                    entity.currentHp,
                    returningLegendaryBlueprint.stats.hp,
                  )
                : returningLegendaryBlueprint.stats.hp,
            maxHp: returningLegendaryBlueprint.stats.hp,
            currentLp: Math.min(
              expedition.legendaryLp ?? entity.currentLp,
              returningLegendaryBlueprint.maxLp,
            ),
            lastLpRestAt: now,
          };
        }
        if (entity.id === expedition.commanderLegendaryPrototypeId) {
          const commanderBlueprint = deriveLegendaryBlueprint(
            workingState,
            entity.blueprintId,
            entity,
          );
          return {
            ...entity,
            status:
              commanderWipeOutcome === "DEAD"
                ? "DEAD"
                : commanderWipeOutcome === "INJURED"
                  ? "INJURED"
                  : "READY",
            injuryExpeditionsRemaining:
              commanderWipeOutcome === "INJURED" ? 1 : 0,
            currentHp:
              commanderWipeOutcome === "DEAD"
                ? 0
                : commanderBlueprint.stats.hp,
            maxHp: commanderBlueprint.stats.hp,
            currentLp: Math.min(
              expedition.commanderLp ?? entity.currentLp,
              commanderBlueprint.maxLp,
            ),
            lastLpRestAt: now,
          };
        }
        return entity;
      },
    ),
    activeExpedition: null,
    lastExpedition: {
      ...expedition,
      outcome,
      commanderWipeOutcome,
      completedAt: now,
      summary:
        text +
        (expedition.elbrusTransformed
          ? " 解缚威森格在远征结束时消失，重新变为镇魔刃埃布斯并返回库存。"
          : "") +
        (commanderWipeOutcome === "ESCAPED"
          ? " 指挥官成功撤离。"
          : commanderWipeOutcome === "INJURED"
            ? " 指挥官负伤撤离，将缺席下一次正式远征。"
            : commanderWipeOutcome === "DEAD"
              ? " 指挥官撤离失败，当前传奇实体死亡。"
              : ""),
      result,
      resultAcknowledged: false,
      logEntries: [
        ...(expedition.logEntries ?? []),
        {
          id: createId("EXPLOG", now),
          text,
          type: outcome === "SUCCESS" ? "reward" : "expedition",
          timestamp: now,
        },
      ].slice(-120),
    },
  };
  if (expedition.hadValidEncounter) {
    nextState = recoverLegendaryInjuriesAfterExpedition(nextState, [
      expedition.legendaryPrototypeId,
      expedition.commanderLegendaryPrototypeId,
    ]);
  }
  if (!prototype && !effectivePrototypeDead) nextState = state;
  const expeditionStats = expedition.stats ?? {};
  const enemiesDefeated =
    (expeditionStats.patrolsDefeated ?? 0) +
    (expeditionStats.guardsDefeated ?? 0);
  nextState = applyCareerDelta(nextState, {
    counters: {
      expeditionVictories: outcome === "SUCCESS" ? 1 : 0,
      expeditionFailures: outcome === "FAILURE" ? 1 : 0,
      expeditionRetreats: ["RETURNED", "RECALLED"].includes(outcome) ? 1 : 0,
      patrolsDestroyed: expeditionStats.patrolsDefeated ?? 0,
      garrisonsDestroyed: expeditionStats.guardsDefeated ?? 0,
      combatDamageDealt: expeditionStats.damageDealt ?? 0,
      combatDamageTaken: expeditionStats.damageTaken ?? 0,
      fortitudeDamage: expeditionStats.fortitudeDamage ?? 0,
      stabilityDamage: expeditionStats.stabilityDamage ?? 0,
      prototypeDeaths: effectivePrototypeDead ? 1 : 0,
      replicasDestroyed: expedition.startingReplicaCount ?? 0,
    },
    records: {
      highestExpeditionDamage: {
        value: expeditionStats.damageDealt ?? 0,
        sourceId: expedition.id,
      },
      highestExpeditionDamageTaken: {
        value: expeditionStats.damageTaken ?? 0,
        sourceId: expedition.id,
      },
      highestExpeditionFortitudeDamage: {
        value: expeditionStats.fortitudeDamage ?? 0,
        sourceId: expedition.id,
      },
      highestExpeditionStabilityDamage: {
        value: expeditionStats.stabilityDamage ?? 0,
        sourceId: expedition.id,
      },
      highestEnemiesDefeated: {
        value: enemiesDefeated,
        sourceId: expedition.id,
      },
    },
  }, now);
  return {
    state: nextState,
    event: {
      type: outcome === "SUCCESS" ? "EXPEDITION_COMPLETED" : "EXPEDITION_ENDED",
      payload: {
        outcome,
        territoryId: expedition.territoryId,
        command: expedition.command,
        text,
      },
    },
    critical: true,
  };
}

function createPlayerCombatant(legion, blueprint, expedition) {
  const commanderPowerBonus =
    expedition.commanderPowerTriggered ? 1 : 0;
  return {
    id: legion.id,
    name: legion.name,
    power: blueprint.stats.power + commanderPowerBonus,
    defense: blueprint.stats.defense,
    hp: legion.currentHp,
    colors: blueprint.colors,
    abilities: getEffectiveAbilities(blueprint.abilities, expedition),
    originalAbilities: [...blueprint.abilities],
    scaleHp:
      legion.currentScaleHp ??
      Math.max(0, legion.currentHp - blueprint.stats.hp),
    temporaryScaleHp: legion.temporaryScaleHp ?? 0,
    bloodthirstStacks: expedition.bloodthirstStacks ?? 0,
    legendaryTemporaryHp:
      expedition.legendaryTemporaryHp ?? 0,
  };
}

function createEnemyCombatant(template, instanceId, expedition) {
  return {
    id: instanceId ?? template.id,
    name: template.name,
    power: template.power,
    defense: template.defense,
    hp: template.hp,
    colors: template.colors,
    abilities: getEffectiveAbilities(template.abilities, expedition),
    originalAbilities: [...template.abilities],
    scaleHp: template.scaleHp ?? 0,
    temporaryScaleHp: 0,
  };
}

function suppressFlyingInActiveCombat(combat) {
  if (!combat) return combat;
  const attacker = combat.attacker;
  const defender = combat.defender;

  function suppress(unit, opponent) {
    const hadReachBonus =
      hasAbility(unit.abilities, "ABILITY_REACH") &&
      hasFlight(opponent.abilities);
    const hadFlyingDefense =
      hasFlight(unit.abilities) &&
      !hasFlight(opponent.abilities) &&
      !hasAbility(opponent.abilities, "ABILITY_REACH");
    const maxDefense = Math.max(
      0,
      unit.maxDefense - (hadFlyingDefense ? 1 : 0),
    );
    return {
      ...unit,
      originalAbilities: [
        ...(unit.originalAbilities ?? unit.abilities),
      ],
      abilities: unit.abilities.filter(
        (ability) =>
          ability !== "ABILITY_FLYING" &&
          ability !== "ABILITY_COMBAT_FLIGHT",
      ),
      currentPower: unit.currentPower - (hadReachBonus ? 1 : 0),
      maxDefense,
      currentDefense: Math.min(unit.currentDefense, maxDefense),
    };
  }

  return {
    ...combat,
    attacker: suppress(attacker, defender),
    defender: suppress(defender, attacker),
  };
}

function restoreFlyingInActiveCombat(combat) {
  if (!combat) return combat;
  const attacker = combat.attacker;
  const defender = combat.defender;

  function restore(unit, opponent) {
    const abilities = unit.originalAbilities ?? unit.abilities;
    const opponentAbilities =
      opponent.originalAbilities ?? opponent.abilities;
    const reachBonus =
      hasAbility(abilities, "ABILITY_REACH") &&
      hasFlight(opponentAbilities)
        ? 1
        : 0;
    const flyingDefense =
      hasFlight(abilities) &&
      !hasFlight(opponentAbilities) &&
      !hasAbility(opponentAbilities, "ABILITY_REACH")
        ? 1
        : 0;
    const maxDefense = unit.maxDefense + flyingDefense;
    return {
      ...unit,
      abilities: [...abilities],
      currentPower: unit.currentPower + reachBonus,
      maxDefense,
      currentDefense: Math.min(
        maxDefense,
        unit.currentDefense + flyingDefense,
      ),
    };
  }

  return {
    ...combat,
    attacker: restore(attacker, defender),
    defender: restore(defender, attacker),
  };
}

function castExpeditionEnchantment(
  state,
  {
    id,
    name,
    originColor,
    cost,
    allowedCommands,
    allowedPhases,
    now,
  },
) {
  const colorName = {
    W: "白色",
    U: "蓝色",
    B: "黑色",
    R: "红色",
    G: "绿色",
  }[originColor] ?? originColor;
  if (!state.base.originId.endsWith(`_${originColor}`) && !isTestMode(state)) {
    throw new Error(`${name}需要${colorName}法术力起源`);
  }
  const expedition = state.activeExpedition;
  if (!expedition) throw new Error(`${name}需要一支正在远征的存活原体提供视野`);
  if (allowedCommands && !allowedCommands.includes(expedition.command)) {
    throw new Error(`${name}不能用于当前远征任务`);
  }
  if (!allowedPhases.includes(expedition.phase)) {
    throw new Error(`当前远征阶段不能施放${name}`);
  }
  if (expedition.enchantmentId === id) {
    throw new Error(`${name}已经生效`);
  }
  if (!canAffordGameCost(state, cost)) {
    const costText = Object.entries(cost)
      .map(([color, amount]) => `${amount}[${color}]`)
      .join("＋");
    throw new Error(`施放${name}需要${costText}`);
  }
  const replacementText = expedition.enchantmentId
    ? "；此前维持的结界已经结束"
    : "";
  const combat =
    expedition.enchantmentId === GROUNDED_ID && id !== GROUNDED_ID
      ? restoreFlyingInActiveCombat(expedition.combat)
      : expedition.combat;
  return {
    paidState: {
      ...state,
      resources: spendGameCost(state, cost),
    },
    expedition: addExpeditionLog(
      {
        ...expedition,
        enchantmentId: id,
        combat,
      },
      `${name}已生效${replacementText}。`,
      "expedition",
      now,
    ),
  };
}

function virtuesRuinApplies(state, territory) {
  const territoryState = state.territories[territory.id];
  return territoryState.activeGuardInstances.some((guard) => {
    if (guard.defeated) return false;
    return getGarrisonTemplate(
      territory,
      guard.templateId,
    )?.colors.includes("W");
  });
}

export function castVirtuesRuin(state, now = Date.now()) {
  if (!state.base.originId.endsWith("_B") && !isTestMode(state)) {
    throw new Error("道德瓦解需要黑色法术力起源");
  }
  const expedition = state.activeExpedition;
  if (!expedition || expedition.command !== "INFILTRATION") {
    throw new Error("道德瓦解只能对当前渗透远征施放");
  }
  if (
    !["TRAVELING", "INFILTRATING"].includes(expedition.phase)
  ) {
    throw new Error("当前阶段不能施放道德瓦解");
  }
  if (expedition.enchantmentId === VIRTUES_RUIN_ID) {
    throw new Error("道德瓦解已经生效");
  }
  if (!canAffordGameCost(state, { B: 2 })) {
    throw new Error("施放道德瓦解需要2[B]");
  }
  const territory = getTerritoryForState(state, expedition.territoryId);
  const applies = virtuesRuinApplies(state, territory);
  const nextExpedition = addExpeditionLog(
    {
      ...expedition,
      hadValidEncounter: true,
      enchantmentId: VIRTUES_RUIN_ID,
      virtuesRuinApplies: applies,
      infiltration: expedition.infiltration
        ? {
            ...expedition.infiltration,
            effective:
              expedition.infiltration.baseEffective +
              (applies ? 2 : 0),
          }
        : expedition.infiltration,
    },
    applies
      ? "道德瓦解已生效：白色守军令渗透+2、暴露率+6个百分点。"
      : "道德瓦解已施放，但目标当前没有白色守军，未获得加成。",
    "expedition",
    now,
  );
  return {
    ...state,
    resources: spendGameCost(state, { B: 2 }),
    activeExpedition: nextExpedition,
  };
}

export function castTasteForMayhem(state, now = Date.now()) {
  const cast = castExpeditionEnchantment(state, {
    id: TASTE_FOR_MAYHEM_ID,
    name: "破坏之乐",
    originColor: "R",
    cost: { R: 1 },
    allowedCommands: ["CONQUEST"],
    allowedPhases: ["TRAVELING", "PATROL_COMBAT", "GARRISON_COMBAT"],
    now,
  });
  return {
    ...cast.paidState,
    activeExpedition: addExpeditionLog(
      cast.expedition,
      "本次远征的坚守伤害将翻倍；实际造成坚守伤害后留下不可消除的永久破坏标记。领土首次沦陷时，每个标记随机减少1份可损失奖励；固定奖励不受影响，且至少保留1份可损失奖励。",
      "expedition",
      now,
    ),
  };
}

export function castGrounded(state, now = Date.now()) {
  const cast = castExpeditionEnchantment(state, {
    id: GROUNDED_ID,
    name: "禁足",
    originColor: "G",
    cost: { G: 1 },
    allowedCommands: null,
    allowedPhases: ["TRAVELING", "PATROL_COMBAT", "GARRISON_COMBAT"],
    now,
  });
  const expedition = {
    ...cast.expedition,
    combat: suppressFlyingInActiveCombat(cast.expedition.combat),
  };
  return {
    ...cast.paidState,
    activeExpedition: addExpeditionLog(
      expedition,
      "本次远征中所有军团的飞行规则标签已被压制；生物因子与蓝图保持不变。",
      "expedition",
      now,
    ),
  };
}

function startPatrolCombat(state, expedition, territory, step, now) {
  const { legion, blueprint } = getExpeditionEntities(state, expedition);
  const combat = createCombat(
    createPlayerCombatant(legion, blueprint, expedition),
    createEnemyCombatant(territory.patrol, null, expedition),
    { kind: "PATROL", territoryId: territory.id },
  );
  return {
    ...expedition,
    phase: "PATROL_COMBAT",
    combat,
    combatRemainingMs: COMBAT_ROUND_MS,
    pendingTravelStep: step,
    logEntries: [
      ...expedition.logEntries,
      {
        id: createId("EXPLOG", now),
        text: `移动第${step}步遭到${territory.patrol.name}拦截。`,
        type: "combat",
        timestamp: now,
      },
    ],
  };
}

function startGarrisonCombat(state, expedition, territory, guard, now) {
  const { legion, blueprint } = getExpeditionEntities(state, expedition);
  const template = getGarrisonTemplate(territory, guard.templateId);
  if (!template) throw new Error("守军模板不存在");
  const combat = createCombat(
    createPlayerCombatant(
      {
        ...legion,
        currentDefense: blueprint.stats.defense,
      },
      blueprint,
      expedition,
    ),
    createEnemyCombatant(template, guard.id, expedition),
    { kind: "GARRISON", territoryId: territory.id, guardId: guard.id },
  );
  return addExpeditionLog(
    {
      ...expedition,
      phase: "GARRISON_COMBAT",
      combat,
      combatRemainingMs: COMBAT_ROUND_MS,
      activeGuardId: guard.id,
    },
    `与${template.name}交战。`,
    "combat",
    now,
  );
}

function reinforceIfNeeded(state, territory) {
  const territoryState = state.territories[territory.id];
  const living = territoryState.activeGuardInstances.filter(
    (guard) => !guard.defeated,
  );
  if (
    living.length > 0 ||
    territoryState.currentFortitude <= 0 ||
    !territory.garrison
  ) {
    return state;
  }
  const templates = getGarrisonTemplates(territory);
  if (templates.length === 0) return state;
  const roll = nextRandom(state.rngState);
  const template = templates[Math.floor(roll.value * templates.length)];
  const reinforcementNumber =
    territoryState.activeGuardInstances.filter((item) => item.reinforced)
      .length + 1;
  return {
    ...state,
    rngState: roll.rngState,
    territories: {
      ...state.territories,
      [territory.id]: {
        ...territoryState,
        activeGuardInstances: [
          ...territoryState.activeGuardInstances,
          {
            id: `${template.templateId}_REINFORCED_${reinforcementNumber}`,
            templateId: template.templateId,
            reinforced: true,
            defeated: false,
            rewardClaimed: true,
          },
        ],
      },
    },
  };
}

export function startExpedition(
  state,
  {
    territoryId,
    legionId = null,
    prototypeId: soloPrototypeId = null,
    command,
    legendaryPrototypeId = null,
    commanderLegendaryPrototypeId = null,
  },
  now = Date.now(),
) {
  if (state.activeExpedition) throw new Error("已有远征正在进行");
  const territory = getTerritoryForState(state, territoryId);
  if (
    territory &&
    state.worldMap?.archivedNodeIds?.includes(territory.regionId)
  ) {
    throw new Error("该区域已经压缩为毁灭档案，不能再次远征");
  }
  let preparedState = state;
  let territoryState = preparedState.territories[territoryId];
  if (!territory || !territoryState) throw new Error("目标领土不存在");
  if (!isTerritoryUnlocked(state, territory)) {
    throw new Error(getTerritoryAccessReason(state, territory));
  }
  if (
    territoryState.conquered &&
    territory.id !== "TERRITORY_TOWN_WG" &&
    !isTestMode(state)
  ) {
    throw new Error("该领土已经沦陷");
  }
  if (legendaryPrototypeId && commanderLegendaryPrototypeId) {
    throw new Error("同一传奇原体不能同时单体出击并担任指挥官");
  }
  if (soloPrototypeId && (legendaryPrototypeId || commanderLegendaryPrototypeId)) {
    throw new Error("传奇化原体单体出击时不能配置其他传奇原体");
  }
  let legion;
  let prototype;
  let blueprint;
  let legendaryEntity = null;
  if (legendaryPrototypeId) {
    legendaryEntity = state.legendaryPrototypes?.find(
      (item) => item.id === legendaryPrototypeId,
    );
    if (!legendaryEntity || legendaryEntity.status !== "READY") {
      throw new Error("该传奇原体当前不能单体出击");
    }
    blueprint = deriveLegendaryBlueprint(
      state,
      legendaryEntity.blueprintId,
      legendaryEntity,
    );
    legion = {
      id: legendaryEntity.id,
      prototypeId: legendaryEntity.id,
      blueprintId: blueprint.id,
      name: legendaryEntity.name,
      currentHp: legendaryEntity.currentHp,
      maxHp: legendaryEntity.maxHp,
      currentScaleHp: 0,
      temporaryScaleHp: 0,
      purchasedScaleHp: 0,
      replicaCount: 0,
    };
    prototype = legendaryEntity;
  } else if (soloPrototypeId) {
    prototype = state.prototypes.find(
      (item) => item.id === soloPrototypeId,
    );
    blueprint = state.blueprints.find(
      (item) => item.id === prototype?.blueprintId,
    );
    if (
      !prototype ||
      prototype.status !== "READY" ||
      !blueprint?.legendary ||
      blueprint.legendaryOrigin
    ) {
      throw new Error("该传奇化原体当前不能单体出击");
    }
    if (
      state.legions.some((item) => item.prototypeId === prototype.id) ||
      state.productionQueue.some((item) => item.prototypeId === prototype.id)
    ) {
      throw new Error("传奇化原体必须脱离军团与生产队列后单体出击");
    }
    legion = {
      id: prototype.id,
      prototypeId: prototype.id,
      blueprintId: blueprint.id,
      name: prototype.name,
      currentHp: prototype.currentHp,
      maxHp: prototype.maxHp,
      currentScaleHp: 0,
      temporaryScaleHp: 0,
      purchasedScaleHp: 0,
      replicaCount: 0,
    };
  } else {
    legion = state.legions.find((item) => item.id === legionId);
    if (!legion) throw new Error("请选择一支待命军团或传奇原体");
    prototype = state.prototypes.find(
      (item) => item.id === legion.prototypeId,
    );
    blueprint = state.blueprints.find(
      (item) => item.id === legion.blueprintId,
    );
    if (!prototype || prototype.status !== "READY" || !blueprint) {
      throw new Error("军团中的原体当前不可用");
    }
    if (
      state.productionQueue.some(
        (item) =>
          item.type === "LEGION" &&
          (item.legionId === legion.id ||
            item.prototypeId === legion.prototypeId),
      )
    ) {
      throw new Error("该军团正在补充，完成后才能远征");
    }
  }
  let commanderEntity = null;
  let commanderBlueprint = null;
  if (commanderLegendaryPrototypeId) {
    commanderEntity = state.legendaryPrototypes?.find(
      (item) => item.id === commanderLegendaryPrototypeId,
    );
    if (!commanderEntity || commanderEntity.status !== "READY") {
      throw new Error("该传奇原体当前不能担任指挥官");
    }
    commanderBlueprint = deriveLegendaryBlueprint(
      state,
      commanderEntity.blueprintId,
      commanderEntity,
    );
  }
  if (!["RECON", "CONQUEST", "INFILTRATION"].includes(command)) {
    throw new Error("远征任务无效");
  }
  if (
    command === "INFILTRATION" &&
    !blueprint.abilities.some((ability) => ability.startsWith("ABILITY_INFILTRATE_"))
  ) {
    throw new Error("该原体没有渗透能力");
  }
  if (
    command === "INFILTRATION" &&
    territory.allowedInfiltratorRaceIds?.length &&
    !territory.allowedInfiltratorRaceIds.includes(blueprint.raceId) &&
    !isTestMode(state)
  ) {
    throw new Error("涅非利亚的尸潮只允许灵俑军团渗透");
  }
  const commanderCost = commanderEntity
    ? commanderBlueprint.commander?.cost ??
      commanderBlueprint.commanderCost ??
      {}
    : {};
  const expeditionCost = { C: PORTAL_COST };
  for (const [color, amount] of Object.entries(commanderCost)) {
    expeditionCost[color] = (expeditionCost[color] ?? 0) + amount;
  }
  if (!canAffordGameCost(state, expeditionCost)) {
    throw new Error(
      commanderEntity
        ? "法术力不足，无法支付传送门与传奇指挥官费用"
        : "开启远征传送门需要500[C]",
    );
  }

  const actualSteps = Math.max(
    1,
    territoryState.currentLands.length -
      (hasAbility(blueprint.abilities, "ABILITY_HASTE") ? 1 : 0),
  );
  const fixedTutorial =
    territory.type === "村庄" &&
    !territoryState.patrolFirstRewardClaimed;
  const stepDurationMs =
    territoryState.routeIntelLevel >= 1
      ? SCOUTED_TRAVEL_STEP_MS
      : TRAVEL_STEP_MS;
  if (command === "CONQUEST") {
    preparedState = reinforceIfNeeded(preparedState, territory);
    territoryState = preparedState.territories[territoryId];
  }
  const expedition = {
    id: createId("EXPEDITION", now),
    command,
    territoryId,
    legionId: legendaryPrototypeId || soloPrototypeId ? null : legionId,
    prototypeId: prototype.id,
    blueprintId: blueprint.id,
    deploymentMode: legendaryPrototypeId
      ? "LEGENDARY_SOLO"
      : soloPrototypeId
        ? "PROTOTYPE_SOLO"
        : "LEGION",
    startingReplicaCount: legendaryPrototypeId || soloPrototypeId
      ? 0
      : Math.max(0, legion.replicaCount ?? 0),
    legendaryPrototypeId,
    legendaryLp: legendaryEntity
      ? Math.min(
          blueprint.maxLp,
          Math.max(legendaryEntity.currentLp, blueprint.baseLp),
        )
      : null,
    legendaryTemporaryHp: 0,
    commanderLegendaryPrototypeId,
    commanderLp: commanderEntity
      ? Math.min(
          commanderBlueprint.maxLp,
          Math.max(
            commanderEntity.currentLp,
            commanderBlueprint.baseLp,
          ),
        )
      : null,
    commanderPowerTriggered: false,
    legendaryActionWindow: null,
    hadValidEncounter: false,
    phase: "TRAVELING",
    startedAt: now,
    playbackSpeed: 1,
    travel: {
      totalSteps: actualSteps,
      currentStep: 0,
      stepDurationMs,
      stepRemainingMs: stepDurationMs,
      patrolCleared: false,
      safeSteps: 0,
      fixedTutorial,
    },
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      patrolsDefeated: 0,
      guardsDefeated: 0,
      fortitudeDamage: 0,
      stabilityDamage: 0,
      commanderAssistedDamage: 0,
      rewards: {},
    },
    startingBiofactorUnlocks: [
      ...preparedState.unlockedBiofactors,
    ],
    startingArtifacts: [...preparedState.artifacts],
    startingContentUnlocks: [
      ...(preparedState.rewardProgress?.unlockedContentIds ?? []),
    ],
    logEntries: [
      {
        id: createId("EXPLOG", now),
        text: `远征传送门开启：${territory.name} / ${command}`,
        type: "expedition",
        timestamp: now,
      },
    ],
  };

  return {
    state: applyCareerDelta({
      ...preparedState,
      resources: spendGameCost(preparedState, expeditionCost),
      prototypes: preparedState.prototypes.map((item) =>
        !legendaryPrototypeId && item.id === prototype.id
          ? { ...item, status: "DEPLOYED" }
          : item,
      ),
      legendaryPrototypes: (
        preparedState.legendaryPrototypes ?? []
      ).map((entity) => {
        if (entity.id === legendaryPrototypeId) {
          return {
            ...entity,
            status: "DEPLOYED",
            currentLp: expedition.legendaryLp,
            lastLpRestAt: now,
          };
        }
        if (entity.id === commanderLegendaryPrototypeId) {
          return {
            ...entity,
            status: "COMMANDING",
            currentLp: expedition.commanderLp,
            lastLpRestAt: now,
          };
        }
        return entity;
      }),
      flags: { ...preparedState.flags, firstExpeditionStarted: true },
      activeExpedition: expedition,
    }, {
      counters: { expeditionsTotal: 1 },
    }, now),
    event: {
      type: "EXPEDITION_STARTED",
      payload: {
        territoryId,
        command,
        legionId: expedition.legionId,
        prototypeId: soloPrototypeId,
        legendaryPrototypeId,
        commanderLegendaryPrototypeId,
      },
    },
    critical: true,
  };
}

function arriveAtTerritory(state, expedition, now) {
  expedition = { ...expedition, hadValidEncounter: true };
  const territory = getTerritoryForState(state, expedition.territoryId);
  const territoryState = state.territories[territory.id];
  if (expedition.command === "RECON") {
    let nextTerritory = {
      ...territoryState,
      routeIntelLevel: Math.max(1, territoryState.routeIntelLevel),
    };
    let nextState = {
      ...state,
      territories: { ...state.territories, [territory.id]: nextTerritory },
    };
    let nextExpedition = addExpeditionLog(
      { ...expedition, phase: "SCOUTING" },
      "一级情报完成：路线已探查，今后跳过普通巡逻。",
      "intel",
      now,
    );

    if (nextTerritory.routeIntelLevel < 2) {
      const l2 = rollChance(nextState.rngState, 0.75 - territory.scoutingDifficulty);
      nextState = { ...nextState, rngState: l2.rngState };
      if (!l2.success) {
        return finishExpedition(nextState, nextExpedition, {
          outcome: "RETURNED",
          text: "二级侦查失败，先遣队安全撤回；一级情报已保留。",
          now,
        });
      }
      const metric = territory.preferredIntelMetric ?? "fortitude";
      nextTerritory = {
        ...nextTerritory,
        routeIntelLevel: 2,
        knownFortitude:
          nextTerritory.knownFortitude || metric === "fortitude",
        knownStability:
          nextTerritory.knownStability || metric === "stability",
      };
      nextState = {
        ...nextState,
        territories: { ...nextState.territories, [territory.id]: nextTerritory },
      };
      nextExpedition = addExpeditionLog(
        nextExpedition,
        `二级情报完成：公开${metric === "fortitude" ? "坚守值" : "稳定值"}与主要种族。`,
        "intel",
        now,
      );
    }

    if (nextTerritory.routeIntelLevel < 3) {
      const l3 = rollChance(nextState.rngState, 0.6 - territory.scoutingDifficulty);
      nextState = { ...nextState, rngState: l3.rngState };
      if (!l3.success) {
        return finishExpedition(nextState, nextExpedition, {
          outcome: "RETURNED",
          text: "三级侦查失败，先遣队安全撤回；已有情报已保留。",
          now,
        });
      }
      nextTerritory = {
        ...nextTerritory,
        routeIntelLevel: 3,
        knownFortitude: true,
        knownStability: true,
        revealedGuardTemplates:
          getGarrisonTemplates(territory).length > 0
            ? [getGarrisonTemplates(territory)[0].templateId]
            : [],
      };
      nextState = {
        ...nextState,
        territories: { ...nextState.territories, [territory.id]: nextTerritory },
      };
      nextExpedition = addExpeditionLog(
        nextExpedition,
        "三级情报完成：坚守、稳定与一种守军配置已公开。",
        "intel",
        now,
      );
    }
    return finishExpedition(nextState, nextExpedition, {
      outcome: "SUCCESS",
      text: "侦查任务完成，原体安全返回基地。",
      now,
    });
  }

  if (expedition.command === "CONQUEST") {
    const guard = territoryState.activeGuardInstances.find(
      (item) => !item.defeated,
    );
    if (!guard) return resolveSiege(state, expedition, now);
    return {
      state: {
        ...state,
        activeExpedition: startGarrisonCombat(
          state,
          expedition,
          territory,
          guard,
          now,
        ),
      },
      critical: false,
    };
  }

  const { blueprint } = getExpeditionEntities(state, expedition);
  const infiltrateTotal = blueprint.abilities.reduce((sum, ability) => {
    const match = ability.match(/^ABILITY_INFILTRATE_(\d+)$/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);
  const virtuesBonus =
    expedition.enchantmentId === VIRTUES_RUIN_ID &&
    virtuesRuinApplies(state, territory)
      ? 2
      : 0;
  const baseEffective = Math.max(
    0,
    infiltrateTotal - territory.infiltrationResistance,
  );
  return {
    state: {
      ...state,
      activeExpedition: addExpeditionLog(
        {
          ...expedition,
          phase: "INFILTRATING",
          infiltration: {
            total: infiltrateTotal,
            baseEffective,
            effective: baseEffective + virtuesBonus,
            cycleRemainingMs: INFILTRATION_CYCLE_MS,
          },
        },
        `开始渗透：每10秒削减${baseEffective + virtuesBonus}点稳定值。`,
        "expedition",
        now,
      ),
    },
    critical: false,
  };
}

function resolveTravelBoundary(state, expedition, now) {
  const territory = getTerritoryForState(state, expedition.territoryId);
  const territoryState = state.territories[territory.id];
  const { blueprint } = getExpeditionEntities(state, expedition);
  const nextStep = expedition.travel.currentStep + 1;
  const skipPatrol =
    territoryState.routeIntelLevel >= 1 ||
    (hasAbility(blueprint.abilities, "ABILITY_FORESTWALK") &&
      territoryState.currentLands.includes("LAND_FOREST"));
  const chance = Math.min(1, 0.1 + expedition.travel.safeSteps * 0.05);
  let encounter = false;
  let rngState = state.rngState;

  if (!skipPatrol && !expedition.travel.patrolCleared && territory.patrol) {
    if (expedition.travel.fixedTutorial) {
      encounter = nextStep === 2;
    } else {
      const roll = rollChance(rngState, chance);
      rngState = roll.rngState;
      encounter = roll.success;
    }
  }
  if (
    encounter &&
    !isGrounded(expedition) &&
    hasAbility(blueprint.abilities, "ABILITY_FLYING") &&
    !hasAbility(territory.patrol.abilities, "ABILITY_FLYING") &&
    !hasAbility(territory.patrol.abilities, "ABILITY_REACH")
  ) {
    encounter = false;
  }

  if (encounter) {
    return {
      state: {
        ...state,
        rngState,
        activeExpedition: startPatrolCombat(
          state,
          expedition,
          territory,
          nextStep,
          now,
        ),
      },
      critical: true,
    };
  }

  const nextTravel = {
    ...expedition.travel,
    currentStep: nextStep,
    safeSteps: expedition.travel.safeSteps + 1,
    stepRemainingMs: getTravelStepDuration(state, expedition),
  };
  const nextExpedition = addExpeditionLog(
    { ...expedition, travel: nextTravel },
    `移动第${nextStep}/${nextTravel.totalSteps}步安全完成。`,
    "expedition",
    now,
  );
  if (nextStep >= nextTravel.totalSteps) {
    return arriveAtTerritory({ ...state, rngState }, nextExpedition, now);
  }
  return {
    state: { ...state, rngState, activeExpedition: nextExpedition },
    critical: false,
  };
}

function resolvePatrolCombatBoundary(state, expedition, now) {
  const territory = getTerritoryForState(state, expedition.territoryId);
  let combat = resolveCombatRound(expedition.combat);
  let nextState = updateLegionFromCombat(state, expedition, combat);
  const legendary = applyLegendaryRoundEffects(
    nextState,
    expedition,
    expedition.combat,
    combat,
    now,
  );
  nextState = legendary.state;
  combat = legendary.combat;
  let nextExpedition = addExpeditionLog(
    {
      ...legendary.expedition,
      combat,
      combatRemainingMs: COMBAT_ROUND_MS,
    },
    `巡逻战第${combat.round}回合：己方${combat.attacker.currentHp}/${combat.attacker.maxHp}，敌方${combat.defender.currentHp}/${combat.defender.maxHp}。`,
    "combat",
    now,
  );
  nextExpedition = addExpeditionStats(nextExpedition, {
    damageDealt: Math.max(
      0,
      expedition.combat.defender.currentHp - combat.defender.currentHp,
    ),
    damageTaken: Math.max(
      0,
      expedition.combat.attacker.currentHp - combat.attacker.currentHp,
    ),
  });
  if (combat.status === "ACTIVE") {
    return {
      state: { ...nextState, activeExpedition: nextExpedition },
      critical: true,
    };
  }
  if (combat.winner !== "ATTACKER") {
    return withBattleReview(
      finishExpedition(nextState, nextExpedition, {
        outcome: "FAILURE",
        prototypeDead: true,
        text: "远征军被巡逻部队消灭，原体死亡。",
        now,
      }),
      state,
      combat,
      "PATROL",
      now,
    );
  }

  let territoryState = nextState.territories[territory.id];
  if (!territoryState.patrolFirstRewardClaimed) {
    const beforeReward = nextState;
    nextState = grantManaReward(nextState, territory.patrol.firstReward, {
      rewardId: `REWARD_A_${territory.id}_PATROL_FIRST`,
      sourceId: territory.patrol.id,
      resolutionKey: `${territory.id}:PATROL:FIRST:A`,
      now,
    });
    nextExpedition = recordGrantedResources(
      nextExpedition,
      beforeReward,
      nextState,
    );
    nextState = grantBiofactorReward(
      nextState,
      territory.patrol.biofactorId,
      {
        rewardId: `REWARD_B_${territory.id}_PATROL_BIOFACTOR`,
        sourceId: territory.patrol.id,
        resolutionKey: `${territory.id}:PATROL:FIRST:B`,
        now,
      },
    );
    territoryState = {
      ...territoryState,
      patrolFirstRewardClaimed: true,
    };
    nextState = {
      ...nextState,
      territories: {
        ...nextState.territories,
        [territory.id]: territoryState,
      },
    };
  }
  nextExpedition = addExpeditionStats(nextExpedition, {
    patrolsDefeated: 1,
  });
  nextExpedition = addExpeditionLog(
    {
      ...nextExpedition,
      phase: "TRAVELING",
      combat: null,
      travel: {
        ...nextExpedition.travel,
        currentStep: nextExpedition.pendingTravelStep,
        patrolCleared: true,
        stepRemainingMs: getTravelStepDuration(
          nextState,
          nextExpedition,
        ),
      },
      pendingTravelStep: null,
    },
    territory.patrol.biofactorId
      ? `巡逻部队已清除；首次生物因子「${getContentDisplayName(territory.patrol.biofactorId)}」已提取。`
      : "巡逻部队已清除；首次巡逻奖励已结算。",
    "reward",
    now,
  );
  if (nextExpedition.travel.currentStep >= nextExpedition.travel.totalSteps) {
    return withBattleReview(
      arriveAtTerritory(nextState, nextExpedition, now),
      state,
      combat,
      "PATROL",
      now,
    );
  }
  return withBattleReview(
    {
      state: { ...nextState, activeExpedition: nextExpedition },
      critical: true,
    },
    state,
    combat,
    "PATROL",
    now,
  );
}

function markGuardDefeated(state, territoryId, guardId) {
  const territoryState = state.territories[territoryId];
  return {
    ...state,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...territoryState,
        defeatedInitialGuards: [
          ...territoryState.defeatedInitialGuards,
          guardId,
        ],
        activeGuardInstances: territoryState.activeGuardInstances.map((guard) =>
          guard.id === guardId ? { ...guard, defeated: true } : guard,
        ),
      },
    },
  };
}

function resolveGarrisonCombatBoundary(state, expedition, now) {
  const territory = getTerritoryForState(state, expedition.territoryId);
  const guard = state.territories[territory.id].activeGuardInstances.find(
    (item) => item.id === expedition.activeGuardId,
  );
  const guardTemplate = getGarrisonTemplate(territory, guard.templateId);
  if (!guardTemplate) throw new Error("守军模板不存在");
  let combat = resolveCombatRound(expedition.combat);
  let nextState = updateLegionFromCombat(state, expedition, combat);
  const legendary = applyLegendaryRoundEffects(
    nextState,
    expedition,
    expedition.combat,
    combat,
    now,
  );
  nextState = legendary.state;
  combat = legendary.combat;
  let nextExpedition = addExpeditionLog(
    {
      ...legendary.expedition,
      combat,
      combatRemainingMs: COMBAT_ROUND_MS,
    },
    `守军战第${combat.round}回合：己方${combat.attacker.currentHp}/${combat.attacker.maxHp}，守军${combat.defender.currentHp}/${combat.defender.maxHp}。`,
    "combat",
    now,
  );
  nextExpedition = addExpeditionStats(nextExpedition, {
    damageDealt: Math.max(
      0,
      expedition.combat.defender.currentHp - combat.defender.currentHp,
    ),
    damageTaken: Math.max(
      0,
      expedition.combat.attacker.currentHp - combat.attacker.currentHp,
    ),
  });
  if (combat.status === "ACTIVE") {
    return {
      state: { ...nextState, activeExpedition: nextExpedition },
      critical: true,
    };
  }

  const remainingGuards = nextState.territories[
    territory.id
  ].activeGuardInstances.filter(
    (item) => !item.defeated && item.id !== guard.id,
  );
  if (combat.winner === "BOTH_DEAD") {
    nextState = markGuardDefeated(nextState, territory.id, guard.id);
    const beforeReward = nextState;
    nextState = grantManaReward(
      nextState,
      guard.reinforced || guard.rewardClaimed
        ? territory.garrison.reinforcedReward
        : guardTemplate.firstReward,
      {
        rewardId:
          guard.reinforced || guard.rewardClaimed
            ? `REWARD_A_${territory.id}_GARRISON_REINFORCED`
            : `REWARD_A_${territory.id}_${guard.templateId}_FIRST`,
        sourceId: guard.id,
        resolutionKey: `${territory.id}:GARRISON:${guard.id}:A`,
        now,
      },
    );
    nextExpedition = recordGrantedResources(
      nextExpedition,
      beforeReward,
      nextState,
    );
    nextExpedition = addExpeditionStats(nextExpedition, {
      guardsDefeated: 1,
    });
    nextState = grantReward(nextState, GAVONY_FIXED_REWARDS.BRAIN, {
      sourceId: guard.id,
      resolutionKey: "WORLD_INNISTRAD:FIRST_GARRISON:B:BRAIN",
      now,
    }).state;
    nextExpedition = addExpeditionLog(
      nextExpedition,
      `${guardTemplate.name}与远征军同归于尽；守军死亡与战果已保存。`,
      "reward",
      now,
    );
    if (
      remainingGuards.length === 0 &&
      nextState.territories[territory.id].currentFortitude <=
        combat.attacker.basePower
    ) {
      const beforeConquestReward = nextState;
      nextState = applyConquestRewards(nextState, territory, now);
      nextState = recordTerritoryVictory(
        nextState,
        territory.id,
        "CONQUEST",
        now,
      );
      nextExpedition = recordGrantedResources(
        nextExpedition,
        beforeConquestReward,
        nextState,
      );
      nextState = {
        ...nextState,
        territories: {
          ...nextState.territories,
          [territory.id]: {
            ...nextState.territories[territory.id],
            currentFortitude: 0,
            conquered: true,
          },
        },
      };
      return withBattleReview(
        finishExpedition(nextState, nextExpedition, {
          outcome: "SUCCESS",
          prototypeDead: true,
          text: "最后火花：原体自曝摧毁最后防线，领土沦陷。",
          now,
        }),
        state,
        combat,
        "GARRISON",
        now,
      );
    }
    return withBattleReview(
      finishExpedition(nextState, nextExpedition, {
        outcome: "FAILURE",
        prototypeDead: true,
        text:
          remainingGuards.length === 0
            ? "双方同归于尽；守军死亡已保存，但剩余坚守值过高，征服失败。"
            : "双方同归于尽；该守军死亡已保存，远征失败。",
        now,
      }),
      state,
      combat,
      "GARRISON",
      now,
    );
  }
  if (combat.winner !== "ATTACKER") {
    return withBattleReview(
      finishExpedition(nextState, nextExpedition, {
        outcome: "FAILURE",
        prototypeDead: true,
        text: "远征军被守军消灭，原体死亡。",
        now,
      }),
      state,
      combat,
      "GARRISON",
      now,
    );
  }

  nextState = markGuardDefeated(nextState, territory.id, guard.id);
  const reward =
    guard.reinforced || guard.rewardClaimed
      ? territory.garrison.reinforcedReward
      : guardTemplate.firstReward;
  const beforeReward = nextState;
  nextState = grantManaReward(nextState, reward, {
    rewardId:
      guard.reinforced || guard.rewardClaimed
        ? `REWARD_A_${territory.id}_GARRISON_REINFORCED`
        : `REWARD_A_${territory.id}_${guard.templateId}_FIRST`,
    sourceId: guard.id,
    resolutionKey: `${territory.id}:GARRISON:${guard.id}:A`,
    now,
  });
  nextExpedition = recordGrantedResources(
    nextExpedition,
    beforeReward,
    nextState,
  );
  nextExpedition = addExpeditionStats(nextExpedition, {
    guardsDefeated: 1,
  });
  nextState = grantReward(nextState, GAVONY_FIXED_REWARDS.BRAIN, {
    sourceId: guard.id,
    resolutionKey: "WORLD_INNISTRAD:FIRST_GARRISON:B:BRAIN",
    now,
  }).state;
  nextExpedition = addExpeditionLog(
    nextExpedition,
    `${guardTemplate.name}已被彻底消灭；战果立即保存。`,
    "reward",
    now,
  );

  const nextGuard = nextState.territories[
    territory.id
  ].activeGuardInstances.find((item) => !item.defeated);
  if (nextGuard) {
    return withBattleReview(
      {
        state: {
          ...nextState,
          activeExpedition: startGarrisonCombat(
            nextState,
            { ...nextExpedition, combat: null },
            territory,
            nextGuard,
            now,
          ),
        },
        critical: true,
      },
      state,
      combat,
      "GARRISON",
      now,
    );
  }
  return withBattleReview(
    resolveSiege(nextState, nextExpedition, now),
    state,
    combat,
    "GARRISON",
    now,
  );
}

function resolveSiege(state, expedition, now) {
  const territory = getTerritoryForState(state, expedition.territoryId);
  const territoryState = state.territories[territory.id];
  const { legion, blueprint } = getExpeditionEntities(state, expedition);
  const siegePower =
    blueprint.stats.power + (expedition.bloodthirstStacks ?? 0);
  const baseDamage = siegePower * legion.currentHp;
  const mayhemActive =
    expedition.enchantmentId === TASTE_FOR_MAYHEM_ID;
  const damage = baseDamage * (mayhemActive ? 2 : 1);
  const actualDamage = Math.min(territoryState.currentFortitude, damage);
  const currentFortitude = Math.max(
    0,
    territoryState.currentFortitude - damage,
  );
  const destructionMark =
    mayhemActive && actualDamage > 0
      ? {
          id: createId("DESTRUCTION_MARK", now),
          sourceId: TASTE_FOR_MAYHEM_ID,
          expeditionId: expedition.id,
          createdAt: now,
        }
      : null;
  let nextState = {
    ...state,
    territories: {
      ...state.territories,
      [territory.id]: {
        ...territoryState,
        currentFortitude,
        knownFortitude: damage > 0 || territoryState.knownFortitude,
        conquered: currentFortitude === 0,
        destructionMarks: destructionMark
          ? [...(territoryState.destructionMarks ?? []), destructionMark]
          : territoryState.destructionMarks,
      },
    },
  };
  let nextExpedition = addExpeditionLog(
    expedition,
    mayhemActive
      ? `现场守军已清空：${siegePower}力量 × ${legion.currentHp}剩余生命 = ${baseDamage}，破坏之乐×2，结算${damage}点坚守伤害并留下1个永久标记。`
      : `现场守军已清空：${siegePower}力量 × ${legion.currentHp}剩余生命 = ${damage}点坚守伤害。`,
    "combat",
    now,
  );
  nextExpedition = addExpeditionStats(nextExpedition, {
    fortitudeDamage: actualDamage,
    mayhemBaseDamage: mayhemActive ? baseDamage : 0,
    mayhemFinalDamage: mayhemActive ? damage : 0,
    destructionMarksAdded: destructionMark ? 1 : 0,
  });
  if (currentFortitude === 0) {
    const beforeReward = nextState;
    nextState = applyConquestRewards(nextState, territory, now);
    nextState = recordTerritoryVictory(
      nextState,
      territory.id,
      "CONQUEST",
      now,
    );
    nextExpedition = recordGrantedResources(
      nextExpedition,
      beforeReward,
      nextState,
    );
    return finishExpedition(nextState, nextExpedition, {
      outcome: "SUCCESS",
      text: `${territory.name}坚守值归零，领土沦陷。`,
      now,
    });
  }
  return finishExpedition(nextState, nextExpedition, {
    outcome: "RETURNED",
    text: `远征完成，领土剩余坚守值${currentFortitude}/${territory.maxFortitude}。`,
    now,
  });
}

function resolveInfiltrationBoundary(state, expedition, now) {
  const territory = getTerritoryForState(state, expedition.territoryId);
  const territoryState = state.territories[territory.id];
  const damage = expedition.infiltration.effective;
  const currentStability = Math.max(0, territoryState.currentStability - damage);
  let nextState = {
    ...state,
    territories: {
      ...state.territories,
      [territory.id]: {
        ...territoryState,
        currentStability,
        knownStability: damage > 0 || territoryState.knownStability,
        conquered: currentStability === 0,
      },
    },
  };
  let nextExpedition = addExpeditionLog(
    {
      ...expedition,
      infiltration: {
        ...expedition.infiltration,
        cycleRemainingMs: INFILTRATION_CYCLE_MS,
      },
    },
    `渗透周期完成：稳定值-${damage}，剩余${currentStability}/${territory.maxStability}。`,
    "expedition",
    now,
  );
  nextExpedition = addExpeditionStats(nextExpedition, {
    stabilityDamage: territoryState.currentStability - currentStability,
  });
  if (currentStability === 0) {
    const beforeReward = nextState;
    nextState = applyConquestRewards(nextState, territory, now);
    nextState = recordTerritoryVictory(
      nextState,
      territory.id,
      "INFILTRATION",
      now,
    );
    nextExpedition = recordGrantedResources(
      nextExpedition,
      beforeReward,
      nextState,
    );
    return finishExpedition(nextState, nextExpedition, {
      outcome: "SUCCESS",
      text: `${territory.name}稳定值归零，渗透胜利。`,
      now,
    });
  }

  const { blueprint } = getExpeditionEntities(nextState, nextExpedition);
  const biofactorExposureModifier = blueprint.abilities.reduce(
    (sum, abilityId) =>
      sum + (getAbilityDefinition(abilityId)?.infiltrationExposureModifier ?? 0),
    0,
  );
  const exposureRate = Math.min(
    1,
    Math.max(
      0,
      territory.exposureRate +
        biofactorExposureModifier +
        (expedition.enchantmentId === VIRTUES_RUIN_ID &&
        expedition.virtuesRuinApplies
          ? 0.06
          : 0),
    ),
  );
  const roll = rollChance(nextState.rngState, exposureRate);
  nextState = { ...nextState, rngState: roll.rngState };
  if (roll.success) {
    nextExpedition = addExpeditionLog(
      {
        ...nextExpedition,
        phase: "EXECUTION_WARNING",
        executionWarning: {
          remainingMs: EXECUTION_WARNING_MS,
          mode: nextState.settings.executionWarningMode,
        },
      },
      "原体身份暴露：进入60秒处决警告。",
      "warning",
      now,
    );
  }
  return {
    state: { ...nextState, activeExpedition: nextExpedition },
    critical: true,
  };
}

export function activateOliviaBloodFeast(state, now = Date.now()) {
  const expedition = state.activeExpedition;
  const window = expedition?.legendaryActionWindow;
  const combat = expedition?.combat;
  if (
    !window ||
    window.abilityId !== "ABILITY_OLIVIA_BLOOD_FEAST" ||
    !expedition.legendaryPrototypeId ||
    !combat
  ) {
    throw new Error("当前没有可用的血色邀宴窗口");
  }
  if ((expedition.legendaryLp ?? 0) < 2) {
    throw new Error("血色邀宴需要2 LP");
  }
  if (combat.attacker.currentHp <= 0 || combat.defender.currentHp <= 0) {
    throw new Error("沃达连与目标必须同时存活");
  }

  const damage = Math.min(2, combat.defender.currentHp);
  const defeated = damage >= combat.defender.currentHp;
  const temporaryHp = combat.attacker.legendaryTemporaryHp ?? 0;
  const gainsTemporaryHp = temporaryHp < 3;
  const legendaryLp = expedition.legendaryLp - 2;
  let nextCombat = {
    ...combat,
    attacker: {
      ...combat.attacker,
      currentHp:
        combat.attacker.currentHp + (gainsTemporaryHp ? 1 : 0),
      maxHp: combat.attacker.maxHp + (gainsTemporaryHp ? 1 : 0),
      legendaryTemporaryHp:
        temporaryHp + (gainsTemporaryHp ? 1 : 0),
    },
    defender: {
      ...combat.defender,
      currentHp: combat.defender.currentHp - damage,
    },
    status: defeated ? "COMPLETE" : combat.status,
    winner: defeated ? "ATTACKER" : combat.winner,
    reason: defeated ? "DEFENDER_DESTROYED_BY_BLOOD_FEAST" : combat.reason,
  };
  let nextState = {
    ...state,
    legendaryPrototypes: state.legendaryPrototypes.map((entity) =>
      entity.id === expedition.legendaryPrototypeId
        ? {
            ...entity,
            currentHp: nextCombat.attacker.currentHp,
            maxHp: nextCombat.attacker.maxHp,
            currentLp: legendaryLp,
          }
        : entity,
    ),
  };
  let resolvedLp = legendaryLp;
  if (defeated) {
    nextState = recordOliviaDirectKill(
      nextState,
      expedition.legendaryPrototypeId,
      true,
    );
    resolvedLp = nextState.legendaryPrototypes.find(
      (item) => item.id === expedition.legendaryPrototypeId,
    ).currentLp;
  }
  let nextExpedition = addExpeditionStats(
    {
      ...expedition,
      combat: nextCombat,
      legendaryLp: resolvedLp,
      legendaryTemporaryHp:
        nextCombat.attacker.legendaryTemporaryHp,
      legendaryActionWindow: null,
      combatRemainingMs: defeated ? 0 : COMBAT_ROUND_MS,
    },
    { damageDealt: damage },
  );
  nextExpedition = addExpeditionLog(
    nextExpedition,
    defeated
      ? `血色邀宴：支付2 LP并造成${damage}点直接生命伤害；目标被消灭，饮尽余温回复1 LP。`
      : `血色邀宴：支付2 LP并造成${damage}点直接生命伤害；${
          gainsTemporaryHp
            ? "沃达连获得1点远征临时生命。"
            : "远征临时生命已达3点上限。"
        }`,
    "combat",
    now,
  );
  return { ...nextState, activeExpedition: nextExpedition };
}

export function activateLegendaryAbility(
  state,
  abilityId,
  now = Date.now(),
) {
  if (abilityId === "ABILITY_OLIVIA_BLOOD_FEAST") {
    return activateOliviaBloodFeast(state, now);
  }
  throw new Error("当前传奇主动异能尚未接入执行器");
}

export function skipOliviaBloodFeast(state, now = Date.now()) {
  const expedition = state.activeExpedition;
  if (!expedition?.legendaryActionWindow) {
    throw new Error("当前没有可跳过的专属能力窗口");
  }
  return {
    ...state,
    activeExpedition: addExpeditionLog(
      {
        ...expedition,
        legendaryActionWindow: null,
        combatRemainingMs: COMBAT_ROUND_MS,
      },
      "沃达连放弃在本回合发动血色邀宴。",
      "combat",
      now,
    ),
  };
}

export function skipLegendaryAbility(state, now = Date.now()) {
  return skipOliviaBloodFeast(state, now);
}

export function advanceExpedition(state, elapsedMs, now = Date.now()) {
  if (state.battleReview || !state.activeExpedition || elapsedMs <= 0) {
    return { state, events: [], critical: false };
  }
  let nextState = state;
  let remaining = elapsedMs;
  const events = [];
  let critical = false;
  let guard = 0;

  while (nextState.activeExpedition && remaining > 0 && guard < 200) {
    guard += 1;
    const expedition = nextState.activeExpedition;
    let boundary;
    if (expedition.phase === "TRAVELING") {
      const stepDurationMs = getTravelStepDuration(nextState, expedition);
      const stepRemainingMs = Math.min(
        expedition.travel.stepRemainingMs ?? stepDurationMs,
        stepDurationMs,
      );
      const spend = Math.min(remaining, stepRemainingMs);
      remaining -= spend;
      const updated = {
        ...expedition,
        travel: {
          ...expedition.travel,
          stepDurationMs,
          stepRemainingMs: stepRemainingMs - spend,
        },
      };
      nextState = { ...nextState, activeExpedition: updated };
      if (updated.travel.stepRemainingMs > 0) break;
      boundary = resolveTravelBoundary(nextState, updated, now);
    } else if (
      expedition.phase === "PATROL_COMBAT" ||
      expedition.phase === "GARRISON_COMBAT"
    ) {
      const speed = expedition.playbackSpeed ?? 1;
      const availableCombatMs = remaining * speed;
      const spend = Math.min(availableCombatMs, expedition.combatRemainingMs);
      remaining -= spend / speed;
      const updated = {
        ...expedition,
        combatRemainingMs: expedition.combatRemainingMs - spend,
      };
      nextState = { ...nextState, activeExpedition: updated };
      if (updated.combatRemainingMs > 0) break;
      boundary =
        expedition.phase === "PATROL_COMBAT"
          ? resolvePatrolCombatBoundary(nextState, updated, now)
          : resolveGarrisonCombatBoundary(nextState, updated, now);
    } else if (expedition.phase === "INFILTRATING") {
      const spend = Math.min(
        remaining,
        expedition.infiltration.cycleRemainingMs,
      );
      remaining -= spend;
      const updated = {
        ...expedition,
        infiltration: {
          ...expedition.infiltration,
          cycleRemainingMs:
            expedition.infiltration.cycleRemainingMs - spend,
        },
      };
      nextState = { ...nextState, activeExpedition: updated };
      if (updated.infiltration.cycleRemainingMs > 0) break;
      boundary = resolveInfiltrationBoundary(nextState, updated, now);
    } else if (expedition.phase === "EXECUTION_WARNING") {
      if (expedition.executionWarning.mode === "PAUSE") break;
      const spend = Math.min(
        remaining,
        expedition.executionWarning.remainingMs,
      );
      remaining -= spend;
      const updated = {
        ...expedition,
        executionWarning: {
          ...expedition.executionWarning,
          remainingMs: expedition.executionWarning.remainingMs - spend,
        },
      };
      nextState = { ...nextState, activeExpedition: updated };
      if (updated.executionWarning.remainingMs > 0) break;
      boundary = finishExpedition(nextState, updated, {
        outcome: "FAILURE",
        prototypeDead: true,
        text: "处决警告结束，原体被处决。",
        now,
      });
    } else {
      break;
    }

    nextState = boundary.state;
    critical ||= Boolean(boundary.critical);
    if (boundary.event) events.push(boundary.event);
    if (nextState.battleReview) break;
  }
  return { state: nextState, events, critical };
}

export function acknowledgeBattleReview(state) {
  if (!state.battleReview) return state;
  return { ...state, battleReview: null };
}

export function setExpeditionSpeed(state, speed) {
  if (!state.activeExpedition) return state;
  const value = [1, 4, 20].includes(Number(speed)) ? Number(speed) : 1;
  return {
    ...state,
    activeExpedition: { ...state.activeExpedition, playbackSpeed: value },
  };
}

export function unsummonExpedition(state, now = Date.now()) {
  if (!state.base.originId.endsWith("_U") && !isTestMode(state)) {
    throw new Error("反召唤需要蓝色法术力起源");
  }
  const expedition = state.activeExpedition;
  if (!expedition) throw new Error("当前没有可召回的远征");
  if (
    expedition.command !== "INFILTRATION" ||
    !["INFILTRATING", "EXECUTION_WARNING"].includes(expedition.phase)
  ) {
    throw new Error("反召唤仅能在渗透或其处决警告阶段施放");
  }
  const prototype = state.prototypes.find(
    (item) => item.id === expedition.prototypeId,
  );
  if (!prototype || prototype.status === "DEAD") {
    throw new Error("原体已经死亡，无法反召唤");
  }
  if (!canAffordGameCost(state, { U: 3 })) {
    throw new Error("反召唤需要3[U]");
  }
  const paid = {
    ...state,
    resources: spendGameCost(state, { U: 3 }),
  };
  return finishExpedition(paid, expedition, {
    outcome: "RECALLED",
    text: "反召唤完成：原体返回基地，全部复制体湮灭。",
    now,
  });
}

export function acceptExecution(state, now = Date.now()) {
  const expedition = state.activeExpedition;
  if (!expedition || expedition.phase !== "EXECUTION_WARNING") {
    throw new Error("当前没有处决警告");
  }
  return finishExpedition(state, expedition, {
    outcome: "FAILURE",
    prototypeDead: true,
    text: "玩家放弃救援，原体被处决。",
    now,
  });
}
