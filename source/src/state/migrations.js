import {
  createTerritoryStates,
  getTerritoriesForRegion,
} from "../data/territory-data.js";
import { CORE_ARTIFACT_IDS } from "../data/artifact-data.js";
import {
  createInitialWorldMapState,
  getMapNode,
  getProgressiveDiscoveredMapNodeIds,
} from "../data/world-map-data.js";
import { normalizeBiofactorId } from "../data/prototype-data.js";
import {
  createBlueprintDraftFromBlueprint,
  deriveBlueprint,
} from "../systems/blueprints.js";
import {
  grantReward,
  normalizeRewardProgress,
} from "../systems/rewards.js";
import { INNISTRAD_FIXED_REWARDS } from "../data/reward-data.js";
import { normalizeResidentProgress } from "../systems/residents.js";
import {
  normalizeAchievementProgress,
  normalizeCareerProgress,
} from "../systems/career.js";
import { LEGENDARY_PROTOTYPE_CATALOG } from "../data/legendary-prototype-data.js";
import {
  createLegendaryIdentity,
  normalizeLegendaryIdentity,
} from "../systems/legendary-prototypes.js";

const ABILITY_ID_MIGRATIONS = {
  ABILITY_WOODLAND_AFFINITY: "ABILITY_FORESTWALK",
  ABILITY_EQUIPPED_WARRIOR: "ABILITY_001",
  ABILITY_SHIELD_RECOVERY: "ABILITY_002",
  ABILITY_GREATSWORD_BREACH: "ABILITY_003",
  ABILITY_AUX_EQUIPMENT_GRID: "ABILITY_004",
};

function migrateAbilities(abilities = []) {
  return abilities.map((id) => ABILITY_ID_MIGRATIONS[id] ?? id);
}

function migrateBiofactorIds(ids = []) {
  return ids.map((id) => normalizeBiofactorId(id));
}

function migrateBlueprint(blueprint) {
  const currentBlueprint = {
    ...blueprint,
    placements: (blueprint.placements ?? []).map((placement) => ({
      ...placement,
      contentId: normalizeBiofactorId(placement.contentId),
    })),
    abilities: migrateAbilities(blueprint.abilities),
    abilityDetails: (blueprint.abilityDetails ?? []).map((ability) => ({
      ...ability,
      id: ABILITY_ID_MIGRATIONS[ability.id] ?? ability.id,
    })),
  };
  const derived = deriveBlueprint(
    createBlueprintDraftFromBlueprint(currentBlueprint),
  );
  if (!derived.designCost) return currentBlueprint;
  return {
    ...currentBlueprint,
    designCost: derived.designCost,
    equivalentValue: derived.equivalentValue,
    scaleHpCost: derived.scaleHpCost,
  };
}

function migrateRewardMetadata(rewards = {}) {
  const {
    fairyQueenMessage: legacyFairyQueenMessage,
    ...currentRewards
  } = rewards;
  return {
    ...currentRewards,
    ...(currentRewards.elfQueenMessage || !legacyFairyQueenMessage
      ? {}
      : { elfQueenMessage: legacyFairyQueenMessage }),
  };
}

function migrateExpeditionBiofactorIds(expedition) {
  if (!expedition) return expedition;
  const {
    startingUnlocks: legacyStartingUnlocks,
    ...currentExpedition
  } = expedition;
  const {
    unlockedFactors: legacyResultUnlocks,
    ...currentResult
  } = expedition.result ?? {};
  return {
    ...currentExpedition,
    startingBiofactorUnlocks: migrateBiofactorIds(
      expedition.startingBiofactorUnlocks ??
        legacyStartingUnlocks ??
        [],
    ),
    result: expedition.result
      ? {
          ...currentResult,
          unlockedBiofactors: migrateBiofactorIds(
            expedition.result.unlockedBiofactors ??
              legacyResultUnlocks ??
              [],
          ),
        }
      : expedition.result,
  };
}

function normalizeRegionRecords(records, completedNodeIds, now) {
  const source =
    records && typeof records === "object" && !Array.isArray(records)
      ? records
      : {};
  const regionIds = new Set([
    ...Object.keys(source),
    ...completedNodeIds.filter(
      (nodeId) => getMapNode(nodeId)?.type === "REGION",
    ),
  ]);
  return Object.fromEntries(
    [...regionIds].flatMap((regionId) => {
      if (getMapNode(regionId)?.type !== "REGION") return [];
      const record = source[regionId] ?? {};
      const defaultTerritoryIds = getTerritoriesForRegion(regionId).map(
        (territory) => territory.id,
      );
      const territoryIds = Array.from(new Set(
        Array.isArray(record.territoryIds) && record.territoryIds.length
          ? record.territoryIds
          : defaultTerritoryIds,
      ));
      const territoryResults = {};
      for (const territoryId of territoryIds) {
        const result = record.territoryResults?.[territoryId];
        if (result && Number.isFinite(result.completedAt)) {
          territoryResults[territoryId] = {
            victoryType: ["CONQUEST", "INFILTRATION", "UNKNOWN"].includes(
              result.victoryType,
            )
              ? result.victoryType
              : "UNKNOWN",
            completedAt: result.completedAt,
            legacyInferred: Boolean(result.legacyInferred),
          };
        } else if (completedNodeIds.includes(regionId)) {
          territoryResults[territoryId] = {
            victoryType: "UNKNOWN",
            completedAt: now,
            legacyInferred: true,
          };
        }
      }
      return [[regionId, {
        regionId,
        completedAt: Number.isFinite(record.completedAt)
          ? record.completedAt
          : completedNodeIds.includes(regionId)
            ? now
            : null,
        archivedAt: Number.isFinite(record.archivedAt)
          ? record.archivedAt
          : null,
        territoryIds,
        territoryResults,
        rewardRecordIds: Array.isArray(record.rewardRecordIds)
          ? Array.from(new Set(record.rewardRecordIds))
          : [],
        archive:
          record.archive && typeof record.archive === "object"
            ? record.archive
            : null,
        legacyInferred:
          Boolean(record.legacyInferred) || !source[regionId],
      }]];
    }),
  );
}

function normalizeLegendaryRecords(value, now) {
  const storedIdentities = Array.isArray(value.legendaryIdentities)
    ? value.legendaryIdentities
    : [];
  const identities = [];
  const configurations = (value.legendaryBlueprints ?? []).map((blueprint) => ({
    ...blueprint,
    placements: Array.isArray(blueprint.placements) ? blueprint.placements : [],
    archivedAt: Number.isFinite(blueprint.archivedAt) ? blueprint.archivedAt : null,
    unlockedAt: Number.isFinite(blueprint.unlockedAt) ? blueprint.unlockedAt : null,
    updatedAt: Number.isFinite(blueprint.updatedAt) ? blueprint.updatedAt : null,
  }));
  const prototypes = (value.legendaryPrototypes ?? []).map((entity) => {
    const definition = LEGENDARY_PROTOTYPE_CATALOG.find(
      (item) => item.id === entity.blueprintId || item.identityId === entity.identityId,
    );
    if (!definition) return entity;
    return {
      ...entity,
      identityId: definition.identityId,
      blueprintId: definition.id,
      injuryExpeditionsRemaining: Math.max(
        0,
        Number(entity.injuryExpeditionsRemaining ?? 0),
      ),
      intrinsicPlacements: Array.isArray(entity.intrinsicPlacements)
        ? entity.intrinsicPlacements
        : structuredClone(definition.intrinsicPlacements ?? []),
    };
  });
  for (const definition of LEGENDARY_PROTOTYPE_CATALOG) {
    const stored = storedIdentities.find(
      (item) => item.id === definition.identityId || item.blueprintId === definition.id,
    );
    const entity = prototypes.find((item) => item.identityId === definition.identityId);
    const unlocked = value.rewardProgress?.unlockedContentIds?.includes(definition.id);
    if (!stored && !entity && !unlocked) continue;
    const acquiredAt = value.rewardProgress?.ledger?.find(
      (record) => record.contentId === definition.id,
    )?.acquiredAt;
    const identity = normalizeLegendaryIdentity(
      stored ??
        createLegendaryIdentity(
          definition,
          acquiredAt ?? entity?.createdAt ?? now,
          entity?.progress,
        ),
      definition,
      now,
    );
    if (entity && !identity.entityHistory.some((record) => record.entityId === entity.id)) {
      identity.entityHistory.push({
        entityId: entity.id,
        createdAt: entity.createdAt ?? now,
        endedAt: entity.status === "DEAD" ? now : null,
        endReason: entity.status === "DEAD" ? "LEGACY_DEATH" : null,
      });
    }
    identities.push(identity);
    if (!configurations.some((item) => item.id === definition.id)) {
      configurations.push({
        id: definition.id,
        placements: [],
        archivedAt: null,
        unlockedAt: acquiredAt ?? entity?.createdAt ?? now,
        updatedAt: null,
      });
    }
  }
  return { configurations, identities, prototypes };
}

function applyCurrentDefaults(value) {
  const {
    unlockedFactors: legacyUnlockedFactors,
    ...currentValue
  } = value;
  const territoryDefaults = createTerritoryStates();
  let migratedTerritories = Object.fromEntries(
    Object.entries(territoryDefaults).map(([id, defaults]) => {
      const saved = value.territories?.[id] ?? {};
      const isUntouchedLegacyGavony =
        id === "TERRITORY_TOWN_WG" &&
        !saved.conquered &&
        (saved.currentFortitude ?? defaults.currentFortitude) === 50 &&
        (saved.currentStability ?? defaults.currentStability) === 40 &&
        (saved.activeGuardInstances?.length ?? 0) === 0;
      return [
        id,
        {
          ...defaults,
          ...saved,
          activeGuardInstances: isUntouchedLegacyGavony
            ? defaults.activeGuardInstances
            : (saved.activeGuardInstances ?? defaults.activeGuardInstances),
        },
      ];
    }),
  );
  const worldMapDefaults = createInitialWorldMapState();
  const inferredCompletedTerritoryIds = Object.values(migratedTerritories)
    .filter((territory) => territory.conquered)
    .map((territory) => territory.territoryId);
  if (
    value.flags?.gavonyFirstConquered &&
    !inferredCompletedTerritoryIds.includes("TERRITORY_TOWN_WG")
  ) {
    inferredCompletedTerritoryIds.push("TERRITORY_TOWN_WG");
  }
  const completedTerritoryIds = Array.from(
    new Set([
      ...(value.worldMap?.completedTerritoryIds ?? []),
      ...inferredCompletedTerritoryIds,
    ]),
  );
  const completedNodeIds = Array.from(
    new Set(value.worldMap?.completedNodeIds ?? []),
  );
  if (
    [
      "TERRITORY_TUTORIAL_W",
      "TERRITORY_TUTORIAL_G",
      "TERRITORY_TOWN_WG",
    ].every((id) => completedTerritoryIds.includes(id)) &&
    !completedNodeIds.includes("REGION_GAVONY")
  ) {
    completedNodeIds.push("REGION_GAVONY");
  }
  const innistradRegionIds = [
    "REGION_GAVONY",
    "REGION_NEPHALIA",
    "REGION_KESSIG",
    "REGION_STENSIA",
    "REGION_MOORLAND",
    "REGION_THRABEN",
  ];
  const legacyAnchorTerritoryId = value.base?.anchorLocation?.territoryId;
  const legacyAnchorRegionId =
    value.base?.anchorLocation?.regionId ??
    innistradRegionIds.find((regionId) =>
      getTerritoriesForRegion(regionId).some(
        (territory) => territory.id === legacyAnchorTerritoryId,
      ),
    ) ??
    null;
  if (
    innistradRegionIds.every((id) => completedNodeIds.includes(id)) &&
    !completedNodeIds.includes("WORLD_INNISTRAD")
  ) {
    completedNodeIds.push("WORLD_INNISTRAD");
  }
  const normalizedArchivedNodeIds = Array.from(
    new Set(value.worldMap?.archivedNodeIds ?? []),
  ).filter((nodeId) => {
    const node = getMapNode(nodeId);
    return (
      completedNodeIds.includes(nodeId) &&
      ["REGION", "WORLD", "PLANET", "UNIVERSE"].includes(node?.type)
    );
  });
  const completedAt = value.lastSavedAt ?? value.createdAt ?? Date.now();
  const celestialRecords = {
    ...(value.worldMap?.celestialRecords ?? {}),
  };
  if (completedNodeIds.includes("WORLD_INNISTRAD")) {
    celestialRecords.WORLD_INNISTRAD = {
      nodeId: "WORLD_INNISTRAD",
      name: "依尼翠",
      type: "WORLD",
      completedAt,
      archivedAt: normalizedArchivedNodeIds.includes("WORLD_INNISTRAD")
        ? completedAt
        : null,
      childNodeIds: [...innistradRegionIds],
      ...celestialRecords.WORLD_INNISTRAD,
    };
  }
  const discoveredNodeIds = getProgressiveDiscoveredMapNodeIds(
    completedNodeIds,
  );
  const worldMap = {
    ...worldMapDefaults,
    ...value.worldMap,
    homeNodeId: "BASE_PLAYER",
    discoveredNodeIds,
    completedNodeIds,
    archivedNodeIds: normalizedArchivedNodeIds,
    completedTerritoryIds,
    regionRecords: normalizeRegionRecords(
      value.worldMap?.regionRecords,
      completedNodeIds,
      value.lastSavedAt ?? value.createdAt ?? Date.now(),
    ),
    celestialRecords,
    universeRecords: {
      ...(value.worldMap?.universeRecords ?? {}),
    },
    generatedCelestials: Array.isArray(
        value.worldMap?.generatedCelestials,
      )
      ? value.worldMap.generatedCelestials
      : [],
    baseLocationNodeId:
      typeof value.worldMap?.baseLocationNodeId === "string"
        ? value.worldMap.baseLocationNodeId
        : value.base?.anchorLocation?.status === "ANCHORED"
          ? legacyAnchorRegionId ?? "WORLD_INNISTRAD"
          : "SUBSPACE_PRIMARY",
    stats: {
      ...worldMapDefaults.stats,
      ...value.worldMap?.stats,
      territoriesDestroyed: completedTerritoryIds.length,
      regionsDestroyed: completedNodeIds.filter(
        (id) => getMapNode(id)?.type === "REGION",
      ).length,
      worldsDestroyed: completedNodeIds.includes("WORLD_INNISTRAD") ? 1 : 0,
    },
  };
  for (const regionId of worldMap.archivedNodeIds.filter(
    (nodeId) => getMapNode(nodeId)?.type === "REGION",
  )) {
    for (const territory of getTerritoriesForRegion(regionId)) {
      delete migratedTerritories[territory.id];
    }
  }
  const inferredCareerCounters = {
    territoriesDestroyed: worldMap.stats.territoriesDestroyed,
    regionsDestroyed: worldMap.stats.regionsDestroyed,
    worldsDestroyed: worldMap.stats.worldsDestroyed,
    planetsDestroyed: worldMap.stats.planetsDestroyed,
    universesDestroyed: worldMap.stats.universesDestroyed,
    conquestVictories: worldMap.stats.conquestVictories,
    infiltrationVictories: worldMap.stats.infiltrationVictories,
  };
  const artifacts = Array.from(
    new Set([...(value.artifacts ?? []), ...CORE_ARTIFACT_IDS]),
  );
  const unlockedBiofactors = Array.from(
    new Set([
      ...migrateBiofactorIds(
        value.unlockedBiofactors ??
          legacyUnlockedFactors ??
          [],
      ),
      "RACE_HUMAN",
      "JOB_WARRIOR",
      "EQUIPMENT_BRONZE_SWORD",
      "EQUIPMENT_STOUT_SHIELD",
    ]),
  );
  if (
    artifacts.includes("ARTIFACT_SKAAB_NOTEBOOK") &&
    !unlockedBiofactors.includes("MODIFICATION_SKAABIFICATION")
  ) {
    unlockedBiofactors.push("MODIFICATION_SKAABIFICATION");
  }
  const legendary = normalizeLegendaryRecords(
    value,
    value.lastSavedAt ?? value.createdAt ?? Date.now(),
  );
  let migrated = {
    ...currentValue,
    settings: {
      executionWarningMode: "PAUSE",
      pauseAfterCombat: true,
      testMode: false,
      manaDisplayMode: "SYMBOL",
      themeId: "SEAL_TERMINAL",
      ...value.settings,
    },
    base: {
      legionScaleCap: 10,
      manaVaultLevel: 0,
      ...value.base,
      anchorLocation: {
        status: "SUBSPACE",
        descentMode: null,
        universeId: null,
        worldId: null,
        regionId: null,
        territoryId: null,
        territoryName: null,
        lands: [],
        anchoredAt: null,
        returnedAt: null,
        instanceId: null,
        ...(value.base?.anchorLocation ?? {}),
        ...(value.base?.anchorLocation?.status === "ANCHORED"
          ? {
              descentMode: "REALITY_DIMENSION",
              universeId: "UNIVERSE_PRIMARY",
              worldId: "WORLD_INNISTRAD",
              regionId: legacyAnchorRegionId ?? "WORLD_INNISTRAD",
            }
          : {}),
      },
    },
    territories: migratedTerritories,
    worldMap,
    unlockedBiofactors,
    blueprints: (value.blueprints ?? []).map((blueprint) =>
      migrateBlueprint(blueprint),
    ),
    legendaryBlueprints: legendary.configurations,
    legendaryIdentities: legendary.identities,
    legendaryPrototypes: legendary.prototypes,
    legions: (value.legions ?? []).map((legion) => ({
      ...legion,
      abilities: migrateAbilities(legion.abilities),
    })),
    activeExpedition: value.activeExpedition
      ? migrateExpeditionBiofactorIds({
          ...value.activeExpedition,
          combat: value.activeExpedition.combat
            ? {
                ...value.activeExpedition.combat,
                attacker: {
                  ...value.activeExpedition.combat.attacker,
                  abilities: migrateAbilities(
                    value.activeExpedition.combat.attacker?.abilities,
                  ),
                },
                defender: {
                  ...value.activeExpedition.combat.defender,
                  abilities: migrateAbilities(
                    value.activeExpedition.combat.defender?.abilities,
                  ),
                },
              }
            : value.activeExpedition.combat,
        })
      : null,
    lastExpedition: migrateExpeditionBiofactorIds(
      value.lastExpedition,
    ),
    battleReview: value.battleReview ?? null,
    artifacts,
    manaFacilities: value.manaFacilities ?? [],
    prismaticLens: {
      enabled: false,
      selectedColor: "W",
      ...value.prismaticLens,
    },
    rewards: migrateRewardMetadata(value.rewards),
    rewardProgress: normalizeRewardProgress(value.rewardProgress),
    residentProgress: normalizeResidentProgress(value.residentProgress),
    careerProgress: normalizeCareerProgress(value.careerProgress, {
      now: value.lastSavedAt ?? value.createdAt ?? Date.now(),
      legacyBaseline: !value.careerProgress,
      inferredCounters: inferredCareerCounters,
    }),
    achievementProgress: normalizeAchievementProgress(
      value.achievementProgress,
    ),
    flags: {
      firstVillageConquered: false,
      metathranRecipeUnlocked: false,
      gavonyFirstConquered: false,
      gavonyRefreshAvailable: false,
      mvpCompleted: false,
      mvpThanksPending: false,
      manaVaultExpansionUnlocked: false,
      guideFirstPrototypeCompleted: Boolean(value.prototypes?.length),
      guideRegionListened: false,
      guideFirstLegionCompleted: Boolean(value.legions?.length),
      guideLegionReinforced: false,
      guideThemeChanged:
        value.settings?.themeId && value.settings.themeId !== "SEAL_TERMINAL",
      ...value.flags,
    },
  };
  if (completedTerritoryIds.includes("TERRITORY_HELVAULT")) {
    const acquiredAt = value.lastSavedAt ?? value.createdAt ?? Date.now();
    for (const reward of [
      INNISTRAD_FIXED_REWARDS.SPACE_ANCHOR,
      INNISTRAD_FIXED_REWARDS.ELBRUS_BINDING_BLADE,
    ]) {
      migrated = grantReward(migrated, reward, {
        sourceId: "TERRITORY_HELVAULT",
        resolutionKey: `TERRITORY_HELVAULT:FIRST_COMPLETION:B:${reward.contentId}`,
        now: acquiredAt,
      }).state;
    }
  }
  return migrated;
}

export function migrateSaveData(value) {
  if (!value || typeof value !== "object") return value;
  if (value.schemaVersion === 9) return applyCurrentDefaults(value);
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(value.schemaVersion)) return value;

  return applyCurrentDefaults({
    ...value,
    schemaVersion: 9,
  });
}
