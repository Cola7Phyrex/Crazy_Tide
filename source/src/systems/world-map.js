import {
  getTerritoriesForRegion,
  getTerritory,
  getTerritoryForState,
} from "../data/territory-data.js";
import {
  MAP_CONTENT_STATUS,
  getMapNode,
  getProgressiveDiscoveredMapNodeIds,
} from "../data/world-map-data.js";
import { getRegionArchiveProfile } from "../data/region-archive-data.js";
import {
  REGION_COMPLETION_REWARDS,
  LIMITED_RANDOM_REWARD_CATALOG,
  TERRITORY_FIXED_REWARDS,
} from "../data/reward-data.js";
import {
  getEligibleRewardCandidates,
  grantReward,
  resolveRewardSlot,
} from "./rewards.js";
import { applyCareerDelta } from "./career.js";

const PLANNED_TERRITORY_REGIONS = Object.freeze({
  TERRITORY_STENSIA_INN: "REGION_STENSIA",
  TERRITORY_VOLDAREN_ESTATE: "REGION_STENSIA",
  TERRITORY_NEPHALIA_DROWNYARD: "REGION_NEPHALIA",
  TERRITORY_THRABEN_GATE_DISTRICT: "REGION_THRABEN",
  TERRITORY_THRABEN_BARRACKS_DISTRICT: "REGION_THRABEN",
  TERRITORY_KESSIG_HUNTER_HOUSE: "REGION_KESSIG",
  TERRITORY_KESSIG_WOLF_RUN: "REGION_KESSIG",
});

export const INNISTRAD_REGION_IDS = Object.freeze([
  "REGION_GAVONY",
  "REGION_NEPHALIA",
  "REGION_KESSIG",
  "REGION_STENSIA",
  "REGION_MOORLAND",
  "REGION_THRABEN",
]);

export function getMapNodePresentationStatus(state, node) {
  if (state.worldMap.archivedNodeIds.includes(node.id)) {
    return { id: "archived", label: "已归档" };
  }
  if (state.worldMap.completedNodeIds.includes(node.id)) {
    return { id: "conquered", label: "已完成" };
  }
  if (
    !state.settings?.testMode &&
    !state.worldMap.discoveredNodeIds.includes(node.id)
  ) {
    return { id: "unobserved", label: "未观测" };
  }
  if (node.contentStatus === MAP_CONTENT_STATUS.PLANNED) {
    return { id: "planned", label: "已规划／待接入" };
  }
  if (node.contentStatus === MAP_CONTENT_STATUS.SAFE) {
    return { id: "secure", label: "安全节点" };
  }
  return { id: "known", label: "已观测" };
}

function getRequiredTerritoryIds(regionId) {
  return REGION_COMPLETION_REWARDS[regionId]?.requiredTerritoryIds ??
    getTerritoriesForRegion(regionId).map((item) => item.id);
}

function getRegionRewardRecords(state, regionId, territoryIds) {
  const sourceIds = new Set([regionId, ...territoryIds]);
  return (state.rewardProgress?.ledger ?? []).filter((record) =>
    sourceIds.has(record.sourceId) ||
    territoryIds.some((territoryId) =>
      record.resolutionKey?.startsWith(`${territoryId}:`),
    ),
  );
}

function createRegionRecord(
  state,
  regionId,
  now,
  previousRecord = null,
) {
  const territoryIds = getRequiredTerritoryIds(regionId);
  const territoryResults = { ...(previousRecord?.territoryResults ?? {}) };
  for (const territoryId of territoryIds) {
    if (territoryResults[territoryId]) continue;
    territoryResults[territoryId] = {
      victoryType: "UNKNOWN",
      completedAt: now,
      legacyInferred: true,
    };
  }
  return {
    regionId,
    completedAt: previousRecord?.completedAt ?? now,
    archivedAt: previousRecord?.archivedAt ?? null,
    territoryIds,
    territoryResults,
    rewardRecordIds: getRegionRewardRecords(
      state,
      regionId,
      territoryIds,
    ).map((record) => record.id),
    archive: previousRecord?.archive ?? null,
    legacyInferred: Boolean(previousRecord?.legacyInferred),
  };
}

export function recordTerritoryVictory(
  state,
  territoryId,
  victoryType,
  now = Date.now(),
) {
  const territory = getTerritoryForState(state, territoryId) ??
    getTerritory(territoryId);
  if (!state.worldMap) return state;
  const regionId =
    territory?.regionId ?? PLANNED_TERRITORY_REGIONS[territoryId];
  if (!territory && !regionId) return state;

  const completedTerritoryIds = Array.from(
    new Set([...state.worldMap.completedTerritoryIds, territoryId]),
  );
  const completedNodeIds = [...state.worldMap.completedNodeIds];
  const plannedRegion = REGION_COMPLETION_REWARDS[regionId];
  const requiredTerritoryIds = getRequiredTerritoryIds(regionId);
  const regionCompleted =
    requiredTerritoryIds.length > 0 &&
    requiredTerritoryIds.every((id) => completedTerritoryIds.includes(id));
  if (
    regionCompleted &&
    !completedNodeIds.includes(regionId)
  ) {
    completedNodeIds.push(regionId);
  }
  const worldCompleted = INNISTRAD_REGION_IDS.every((id) =>
    completedNodeIds.includes(id),
  );
  if (worldCompleted && !completedNodeIds.includes("WORLD_INNISTRAD")) {
    completedNodeIds.push("WORLD_INNISTRAD");
  }

  const stats = {
    ...state.worldMap.stats,
    territoriesDestroyed: completedTerritoryIds.length,
    regionsDestroyed: completedNodeIds.filter(
      (id) => getMapNode(id)?.type === "REGION",
    ).length,
    worldsDestroyed: completedNodeIds.includes("WORLD_INNISTRAD") ? 1 : 0,
  };
  if (victoryType === "INFILTRATION") {
    stats.infiltrationVictories += 1;
  } else {
    stats.conquestVictories += 1;
  }

  let nextState = {
    ...state,
    worldMap: {
      ...state.worldMap,
      completedTerritoryIds,
      completedNodeIds,
      discoveredNodeIds:
        getProgressiveDiscoveredMapNodeIds(completedNodeIds),
      regionRecords: {
        ...(state.worldMap.regionRecords ?? {}),
        [regionId]: {
          ...(state.worldMap.regionRecords?.[regionId] ?? {}),
          regionId,
          completedAt:
            state.worldMap.regionRecords?.[regionId]?.completedAt ??
            (regionCompleted ? now : null),
          archivedAt:
            state.worldMap.regionRecords?.[regionId]?.archivedAt ?? null,
          territoryIds: requiredTerritoryIds,
          territoryResults: {
            ...(state.worldMap.regionRecords?.[regionId]
              ?.territoryResults ?? {}),
            [territoryId]: state.worldMap.regionRecords?.[regionId]
              ?.territoryResults?.[territoryId] ?? {
                victoryType,
                completedAt: now,
                legacyInferred: false,
              },
          },
          rewardRecordIds:
            state.worldMap.regionRecords?.[regionId]?.rewardRecordIds ?? [],
          archive: state.worldMap.regionRecords?.[regionId]?.archive ?? null,
          legacyInferred: false,
        },
      },
      celestialRecords: {
        ...(state.worldMap.celestialRecords ?? {}),
        ...(worldCompleted
          ? {
              WORLD_INNISTRAD: {
                ...(state.worldMap.celestialRecords?.WORLD_INNISTRAD ?? {}),
                nodeId: "WORLD_INNISTRAD",
                name: "依尼翠",
                type: "WORLD",
                completedAt:
                  state.worldMap.celestialRecords?.WORLD_INNISTRAD
                    ?.completedAt ?? now,
                archivedAt:
                  state.worldMap.celestialRecords?.WORLD_INNISTRAD
                    ?.archivedAt ?? null,
                childNodeIds: [...INNISTRAD_REGION_IDS],
              },
            }
          : {}),
      },
      stats,
    },
  };
  for (const reward of TERRITORY_FIXED_REWARDS[territoryId] ?? []) {
    nextState = grantReward(nextState, reward, {
      sourceId: territoryId,
      resolutionKey: `${territoryId}:FIRST_COMPLETION:B:${reward.contentId}`,
      now,
    }).state;
  }
  for (const slot of territory?.rewardSlots ?? []) {
    const candidates = slot.catalogId === "INNISTRAD_LIMITED_RANDOM"
      ? LIMITED_RANDOM_REWARD_CATALOG
      : [];
    const eligible = getEligibleRewardCandidates(nextState, candidates, {
      grade: slot.grade,
      contextTags: slot.contextTags ?? territory.lands,
    });
    if (eligible.length === 0) continue;
    nextState = resolveRewardSlot(nextState, {
      resolutionKey: `${territoryId}:FIRST_COMPLETION:${slot.grade}:${slot.id}`,
      grade: slot.grade,
      candidates,
      contextTags: slot.contextTags ?? territory.lands,
      sourceId: territoryId,
      now,
    }).state;
  }
  if (regionCompleted && plannedRegion) {
    for (const reward of plannedRegion.rewards) {
      nextState = grantReward(nextState, reward, {
        sourceId: regionId,
        resolutionKey: `${regionId}:FIRST_COMPLETION:B:${reward.contentId}`,
        now,
      }).state;
    }
  }
  const originalStensiaTerritories = [
    "TERRITORY_STENSIA_INN",
    "TERRITORY_GEIER_REACH_SANITARIUM",
    "TERRITORY_STENSIA_BLOODHALL",
  ];
  if (
    originalStensiaTerritories.every((id) =>
      completedTerritoryIds.includes(id),
    )
  ) {
    const goblinReward = LIMITED_RANDOM_REWARD_CATALOG.find(
      (reward) => reward.contentId === "RACE_GOBLIN",
    );
    if (goblinReward) {
      nextState = grantReward(nextState, goblinReward, {
        sourceId: "REGION_STENSIA_ORIGINAL_THREE",
        resolutionKey: "REGION_STENSIA:ORIGINAL_THREE:D:RACE_GOBLIN",
        now,
      }).state;
    }
  }
  if (regionCompleted) {
    const completedRecord = createRegionRecord(
      nextState,
      regionId,
      now,
      nextState.worldMap.regionRecords?.[regionId],
    );
    nextState = {
      ...nextState,
      worldMap: {
        ...nextState.worldMap,
        regionRecords: {
          ...nextState.worldMap.regionRecords,
          [regionId]: completedRecord,
        },
      },
    };
  }
  return applyCareerDelta(nextState, {
    counters: {
      territoriesDestroyed:
        stats.territoriesDestroyed - state.worldMap.stats.territoriesDestroyed,
      regionsDestroyed:
        stats.regionsDestroyed - state.worldMap.stats.regionsDestroyed,
      worldsDestroyed:
        stats.worldsDestroyed - state.worldMap.stats.worldsDestroyed,
      planetsDestroyed:
        stats.planetsDestroyed - state.worldMap.stats.planetsDestroyed,
      universesDestroyed:
        stats.universesDestroyed - state.worldMap.stats.universesDestroyed,
      conquestVictories: victoryType === "INFILTRATION" ? 0 : 1,
      infiltrationVictories: victoryType === "INFILTRATION" ? 1 : 0,
    },
  }, now);
}

export function archiveCompletedRegion(state, regionId, now = Date.now()) {
  const region = getMapNode(regionId);
  if (region?.type !== "REGION") throw new Error("目标不是可归档区域");
  if (state.settings?.testMode) {
    throw new Error("测试模式不会写入永久毁灭档案");
  }
  if (state.worldMap.archivedNodeIds.includes(regionId)) {
    throw new Error("该区域已经归档");
  }
  if (!state.worldMap.completedNodeIds.includes(regionId)) {
    throw new Error("必须先完成区域内全部领土");
  }
  const activeTerritory = state.activeExpedition?.territoryId
    ? getTerritoryForState(state, state.activeExpedition.territoryId)
    : null;
  if (activeTerritory?.regionId === regionId) {
    throw new Error("区域内仍有远征进行，暂时不能归档");
  }

  const territoryIds = getRequiredTerritoryIds(regionId);
  const previousRecord = createRegionRecord(
    state,
    regionId,
    now,
    state.worldMap.regionRecords?.[regionId],
  );
  const rewardRecords = getRegionRewardRecords(
    state,
    regionId,
    territoryIds,
  );
  const territorySummaries = territoryIds.map((territoryId) => {
    const territory = getTerritoryForState(state, territoryId) ??
      getTerritory(territoryId);
    const territoryState = state.territories?.[territoryId];
    const result = previousRecord.territoryResults[territoryId];
    return {
      territoryId,
      name: territory?.name ?? "未知领土",
      victoryType: result?.victoryType ?? "UNKNOWN",
      completedAt: result?.completedAt ?? previousRecord.completedAt,
      destructionMarkCount: territoryState?.destructionMarks?.length ?? 0,
      generatorVersion:
        territoryState?.catalogSnapshot?.generatorVersion ?? null,
      lands: [...(territory?.lands ?? territoryState?.currentLands ?? [])],
      conquestText: territory?.conquestText ?? null,
    };
  });
  const archive = {
    archivedAt: now,
    consequence: getRegionArchiveProfile(regionId).consequence,
    territoryCount: territorySummaries.length,
    territories: territorySummaries,
    rewards: rewardRecords.map((record) => ({
      recordId: record.id,
      grade: record.grade,
      contentId: record.contentId ?? null,
      resources: record.resources ? { ...record.resources } : null,
      sourceId: record.sourceId ?? null,
      acquiredAt: record.acquiredAt,
    })),
  };
  const territories = { ...state.territories };
  for (const territoryId of territoryIds) delete territories[territoryId];
  const regionRecord = {
    ...previousRecord,
    archivedAt: now,
    rewardRecordIds: rewardRecords.map((record) => record.id),
    archive,
  };

  return {
    state: {
      ...state,
      territories,
      worldMap: {
        ...state.worldMap,
        archivedNodeIds: [
          ...state.worldMap.archivedNodeIds,
          regionId,
        ],
        regionRecords: {
          ...(state.worldMap.regionRecords ?? {}),
          [regionId]: regionRecord,
        },
      },
      flags: regionId === "REGION_GAVONY"
        ? { ...state.flags, gavonyRefreshAvailable: false }
        : state.flags,
    },
    archive,
  };
}
