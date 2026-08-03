import {
  REGION_LISTENING_TEXTS,
  SUBSPACE_WHISPERS,
} from "../data/immersion-data.js";
import {
  getTerritoriesForRegion,
  getTerritoryForState,
} from "../data/territory-data.js";
import { MAP_NODE_TYPES, getMapNode } from "../data/world-map-data.js";

export const LISTENING_STATES = Object.freeze({
  UNSCOUTED: "UNSCOUTED",
  SCOUTED: "SCOUTED",
  EXPEDITION_ACTIVE: "EXPEDITION_ACTIVE",
  DAMAGED: "DAMAGED",
  CONQUERED: "CONQUERED",
});

function isDamaged(territory, territoryState) {
  if (!territory || !territoryState) return false;
  return (
    territoryState.currentFortitude < territory.maxFortitude ||
    territoryState.currentStability < territory.maxStability
  );
}

function getTerritoryListeningState(state, territory) {
  const territoryState = state.territories?.[territory.id];
  if (territoryState?.conquered) return LISTENING_STATES.CONQUERED;
  if (state.activeExpedition?.territoryId === territory.id) {
    return LISTENING_STATES.EXPEDITION_ACTIVE;
  }
  if (isDamaged(territory, territoryState)) return LISTENING_STATES.DAMAGED;
  if ((territoryState?.routeIntelLevel ?? 0) >= 1) {
    return LISTENING_STATES.SCOUTED;
  }
  return LISTENING_STATES.UNSCOUTED;
}

function getRegionListeningState(state, territories) {
  if (
    territories.length > 0 &&
    territories.every((territory) => state.territories?.[territory.id]?.conquered)
  ) return LISTENING_STATES.CONQUERED;
  if (
    territories.some(
      (territory) => state.activeExpedition?.territoryId === territory.id,
    )
  ) return LISTENING_STATES.EXPEDITION_ACTIVE;
  if (
    territories.some((territory) =>
      isDamaged(territory, state.territories?.[territory.id]),
    )
  ) return LISTENING_STATES.DAMAGED;
  if (
    territories.some(
      (territory) =>
        (state.territories?.[territory.id]?.routeIntelLevel ?? 0) >= 1,
    )
  ) return LISTENING_STATES.SCOUTED;
  return LISTENING_STATES.UNSCOUTED;
}

export function getListeningContext(
  state,
  { observedNodeId = null, territoryId = null } = {},
) {
  const observedNode = getMapNode(observedNodeId);
  const territory = territoryId
    ? getTerritoryForState(state, territoryId)
    : null;
  const regionId =
    territory?.regionId ??
    (observedNode?.type === MAP_NODE_TYPES.REGION ? observedNode.id : null);
  if (!regionId || !REGION_LISTENING_TEXTS[regionId]) {
    return {
      regionId: null,
      territoryId: null,
      stateId: null,
      pool: SUBSPACE_WHISPERS,
      source: "SUBSPACE // 无法测定来源",
    };
  }
  const regionTerritories = getTerritoriesForRegion(regionId, state);
  const scopedTerritory = territory?.regionId === regionId ? territory : null;
  const stateId = state.worldMap?.archivedNodeIds?.includes(regionId)
    ? LISTENING_STATES.CONQUERED
    : scopedTerritory
      ? getTerritoryListeningState(state, scopedTerritory)
      : getRegionListeningState(state, regionTerritories);
  const stateLabel = {
    UNSCOUTED: "未侦查",
    SCOUTED: "已侦查",
    CONQUERED: "已征服",
  }[stateId] ?? "状态未知";
  return {
    regionId,
    territoryId: scopedTerritory?.id ?? null,
    stateId,
    pool: REGION_LISTENING_TEXTS[regionId][stateId] ?? SUBSPACE_WHISPERS,
    source: `聆听 // ${scopedTerritory?.name ?? observedNode?.name ?? "未知区域"} // ${stateLabel}`,
  };
}
