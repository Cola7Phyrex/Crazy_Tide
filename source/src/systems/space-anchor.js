import { getLand } from "../data/game-data.js";
import {
  getTerritory,
  getTerritoryForState,
} from "../data/territory-data.js";
import { SPACE_ANCHOR_ID } from "../data/artifact-data.js";

function getArchivedTerritory(state, territoryId) {
  for (const [regionId, record] of Object.entries(
    state.worldMap?.regionRecords ?? {},
  )) {
    const archived = record?.archive?.territories?.find(
      (item) => item.territoryId === territoryId,
    );
    if (archived) return { ...archived, regionId };
  }
  return null;
}

function getAnchorInstance(state) {
  return state.rewardProgress?.instances?.find(
    (instance) => instance.contentId === SPACE_ANCHOR_ID,
  ) ?? null;
}

export function summarizeLandIds(lands = []) {
  const counts = new Map();
  for (const landId of lands) {
    counts.set(landId, (counts.get(landId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([landId, count]) => {
      const land = getLand(landId);
      return {
        landId,
        count,
        name: land?.name ?? "未知基本地",
        color: land?.color ?? "C",
      };
    });
}

export function getSpaceAnchorTargets(state) {
  if (!state.worldMap?.completedNodeIds?.includes("WORLD_INNISTRAD")) {
    return [];
  }
  return (state.worldMap.completedTerritoryIds ?? []).flatMap(
    (territoryId) => {
      const archived = getArchivedTerritory(state, territoryId);
      const territory = getTerritoryForState(state, territoryId) ??
        getTerritory(territoryId);
      const lands = archived?.lands ?? territory?.lands ?? [];
      if (!lands.length) return [];
      return [{
        territoryId,
        name: archived?.name ?? territory?.name ?? "未知领土",
        regionId: archived?.regionId ?? territory?.regionId ?? null,
        lands: [...lands],
        landSummary: summarizeLandIds(lands),
        archived: Boolean(archived),
      }];
    },
  );
}

function resetLandProductionCycles(productionCycles = {}) {
  return Object.fromEntries(
    Object.entries(productionCycles).filter(
      ([id]) => id !== "LAND" && !id.startsWith("ANCHORED_LAND_"),
    ),
  );
}

export function activateSpaceAnchor(
  state,
  territoryId,
  now = Date.now(),
) {
  const location = state.base?.anchorLocation;
  if (location?.status === "ANCHORED") {
    throw new Error("基地已经通过空间锚点驻扎在其他领土");
  }
  if (location?.status === "RETURNED") {
    throw new Error("本次空间锚点迁移已经不可逆地结束");
  }
  const instance = getAnchorInstance(state);
  if (!instance || instance.location !== "INVENTORY") {
    throw new Error("没有可使用的空间锚点");
  }
  const target = getSpaceAnchorTargets(state).find(
    (item) => item.territoryId === territoryId,
  );
  if (!target) {
    throw new Error("只能迁移至已经完全通关世界中的已征服领土");
  }
  return {
    ...state,
    base: {
      ...state.base,
      anchorLocation: {
        status: "ANCHORED",
        descentMode: "REALITY_DIMENSION",
        universeId: "UNIVERSE_PRIMARY",
        worldId: "WORLD_INNISTRAD",
        regionId: target.regionId,
        territoryId: target.territoryId,
        territoryName: target.name,
        lands: [...target.lands],
        anchoredAt: now,
        returnedAt: null,
        instanceId: instance.instanceId,
      },
    },
    worldMap: {
      ...state.worldMap,
      baseLocationNodeId: target.regionId ?? "WORLD_INNISTRAD",
    },
    clock: {
      ...state.clock,
      economyLastSettledAt: now,
      productionCycles: resetLandProductionCycles(
        state.clock.productionCycles,
      ),
    },
    rewardProgress: {
      ...state.rewardProgress,
      instances: state.rewardProgress.instances.map((item) =>
        item.instanceId === instance.instanceId
          ? {
              ...item,
              location: "CONSUMED",
              consumedAt: now,
              consumedFor: target.territoryId,
            }
          : item,
      ),
    },
  };
}

export function returnBaseToSubspace(state, now = Date.now()) {
  const location = state.base?.anchorLocation;
  if (location?.status !== "ANCHORED") {
    throw new Error("基地当前没有驻扎在外部领土");
  }
  return {
    ...state,
    base: {
      ...state.base,
      anchorLocation: {
        ...location,
        status: "RETURNED",
        descentMode: null,
        universeId: null,
        worldId: null,
        regionId: null,
        territoryId: null,
        territoryName: null,
        lands: [],
        returnedAt: now,
      },
    },
    worldMap: {
      ...state.worldMap,
      baseLocationNodeId: "SUBSPACE_PRIMARY",
    },
    clock: {
      ...state.clock,
      economyLastSettledAt: now,
      productionCycles: {
        ...resetLandProductionCycles(state.clock.productionCycles),
        LAND: 0,
      },
    },
  };
}
