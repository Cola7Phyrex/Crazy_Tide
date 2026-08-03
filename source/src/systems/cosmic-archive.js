import { nextRandom } from "../core/random.js";
import { getMapChildren, getMapNode } from "../data/world-map-data.js";
import { applyCareerDelta } from "./career.js";

export const COSMIC_GENERATOR_VERSION = "COSMIC_V1";

const WORLD_NAMES = Object.freeze([
  "灰烬回廊",
  "长夜镜海",
  "无钟庭院",
  "猩红星墓",
  "静默环城",
  "逆潮荒原",
]);
const REGION_NAMES = Object.freeze([
  "断光原",
  "沉星沼",
  "空冠城",
  "逆风海",
  "赤月山脊",
  "寂语林",
]);
const LAND_IDS = Object.freeze([
  "LAND_PLAINS",
  "LAND_ISLAND",
  "LAND_SWAMP",
  "LAND_MOUNTAIN",
  "LAND_FOREST",
]);

function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}

function createRng(seed) {
  let rngState = hashSeed(seed);
  return {
    next() {
      const roll = nextRandom(rngState);
      rngState = roll.rngState;
      return roll.value;
    },
    integer(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}

function createFrozenSnapshot(seed, type, index, now) {
  const rng = createRng(`${seed}:${type}:${COSMIC_GENERATOR_VERSION}`);
  const suffix = hashSeed(seed).toString(36).toUpperCase().padStart(7, "0");
  const nodeId = `${type}_PROCEDURAL_${suffix}`;
  const regionCount = rng.integer(3, 5);
  const usedRegionNames = new Set();
  const regions = Array.from({ length: regionCount }, (_, regionIndex) => {
    let name = rng.pick(REGION_NAMES);
    while (usedRegionNames.has(name)) {
      name = `${rng.pick(REGION_NAMES)}·${regionIndex + 1}`;
    }
    usedRegionNames.add(name);
    const territoryCount = rng.integer(2, 4);
    return {
      id: `REGION_${suffix}_${regionIndex + 1}`,
      name,
      map: {
        x: rng.integer(18, 82),
        y: rng.integer(18, 82),
      },
      territories: Array.from(
        { length: territoryCount },
        (_, territoryIndex) => {
          const landCount = rng.integer(3, 6);
          return {
            id: `TERRITORY_${suffix}_${regionIndex + 1}_${territoryIndex + 1}`,
            name: `${name}${territoryIndex + 1}号领土`,
            lands: Array.from({ length: landCount }, () => rng.pick(LAND_IDS)),
            difficultyRating: rng.integer(120, 360),
          };
        },
      ),
    };
  });
  return {
    id: nodeId,
    name: `${rng.pick(WORLD_NAMES)} ${index + 1}`,
    englishName: `Procedural ${type === "PLANET" ? "Planet" : "World"} ${suffix}`,
    type,
    parentId: "UNIVERSE_PRIMARY",
    generatorVersion: COSMIC_GENERATOR_VERSION,
    seed,
    frozenAt: now,
    status: "FROZEN",
    regions,
    territoryCount: regions.reduce(
      (sum, region) => sum + region.territories.length,
      0,
    ),
  };
}

export function freezeRandomCelestial(
  state,
  type = "WORLD",
  now = Date.now(),
) {
  if (!["WORLD", "PLANET"].includes(type)) {
    throw new Error("只能固化随机世界或星球");
  }
  if (!state.worldMap?.completedNodeIds?.includes("WORLD_INNISTRAD")) {
    throw new Error("完全通关依尼翠后才能稳定观测新的随机天体");
  }
  if (state.worldMap.archivedNodeIds.includes("UNIVERSE_PRIMARY")) {
    throw new Error("现实纬度宇宙已经归档，不能继续写入随机天体");
  }
  const records = state.worldMap.generatedCelestials ?? [];
  if (records.length >= 8) {
    throw new Error("当前存档最多保留8个随机天体快照");
  }
  const roll = nextRandom(state.rngState);
  const seed = `${state.gameId}:${records.length}:${Math.floor(roll.value * 0xffffffff)}`;
  const record = createFrozenSnapshot(seed, type, records.length, now);
  return {
    state: {
      ...state,
      rngState: roll.rngState,
      worldMap: {
        ...state.worldMap,
        generatedCelestials: [...records, record],
      },
    },
    record,
  };
}

export function canArchiveCelestial(state, nodeId) {
  const node = getMapNode(nodeId);
  if (!node || !["WORLD", "PLANET"].includes(node.type)) return false;
  if (!state.worldMap.completedNodeIds.includes(nodeId)) return false;
  const children = getMapChildren(nodeId);
  return (
    children.length > 0 &&
    children.every((child) =>
      state.worldMap.archivedNodeIds.includes(child.id),
    )
  );
}

export function archiveCelestial(state, nodeId, now = Date.now()) {
  const node = getMapNode(nodeId);
  if (!node || !["WORLD", "PLANET"].includes(node.type)) {
    throw new Error("目标不是可归档的世界或星球");
  }
  if (state.settings?.testMode) throw new Error("测试模式不会写入天体归档");
  if (state.worldMap.archivedNodeIds.includes(nodeId)) {
    throw new Error(`${node.name}已经归档`);
  }
  if (!canArchiveCelestial(state, nodeId)) {
    throw new Error("必须先完成并压缩该天体的全部区域");
  }
  if (state.activeExpedition) throw new Error("远征进行中，不能归档天体");
  const childNodeIds = getMapChildren(nodeId).map((child) => child.id);
  const record = {
    nodeId,
    name: node.name,
    type: node.type,
    completedAt:
      state.worldMap.celestialRecords?.[nodeId]?.completedAt ?? now,
    archivedAt: now,
    childNodeIds,
    regionArchives: childNodeIds.map(
      (regionId) => state.worldMap.regionRecords?.[regionId]?.archive ?? null,
    ),
  };
  return {
    state: {
      ...state,
      worldMap: {
        ...state.worldMap,
        archivedNodeIds: [...state.worldMap.archivedNodeIds, nodeId],
        celestialRecords: {
          ...(state.worldMap.celestialRecords ?? {}),
          [nodeId]: record,
        },
      },
    },
    record,
  };
}

export function canArchiveUniverse(state, universeId) {
  const universe = getMapNode(universeId);
  if (universe?.type !== "UNIVERSE") return false;
  const activeChildren = getMapChildren(universeId).filter(
    (node) => ["WORLD", "PLANET"].includes(node.type),
  );
  return (
    activeChildren.length > 0 &&
    activeChildren.every((child) =>
      state.worldMap.archivedNodeIds.includes(child.id),
    )
  );
}

export function archiveUniverse(
  state,
  universeId = "UNIVERSE_PRIMARY",
  now = Date.now(),
) {
  const universe = getMapNode(universeId);
  if (universe?.type !== "UNIVERSE") throw new Error("目标不是宇宙节点");
  if (state.settings?.testMode) throw new Error("测试模式不会写入宇宙归档");
  if (state.worldMap.archivedNodeIds.includes(universeId)) {
    throw new Error(`${universe.name}已经归档`);
  }
  if (!canArchiveUniverse(state, universeId)) {
    throw new Error("必须先归档宇宙内全部正式世界与星球");
  }
  if (state.activeExpedition) throw new Error("远征进行中，不能归档宇宙");
  const record = {
    nodeId: universeId,
    name: universe.name,
    completedAt: now,
    archivedAt: now,
    childNodeIds: getMapChildren(universeId)
      .filter((node) => ["WORLD", "PLANET"].includes(node.type))
      .map((node) => node.id),
    frozenSurveyIds: (state.worldMap.generatedCelestials ?? []).map(
      (item) => item.id,
    ),
  };
  const nextState = {
    ...state,
    worldMap: {
      ...state.worldMap,
      completedNodeIds: Array.from(
        new Set([...state.worldMap.completedNodeIds, universeId]),
      ),
      archivedNodeIds: [...state.worldMap.archivedNodeIds, universeId],
      universeRecords: {
        ...(state.worldMap.universeRecords ?? {}),
        [universeId]: record,
      },
      stats: {
        ...state.worldMap.stats,
        universesDestroyed: state.worldMap.stats.universesDestroyed + 1,
      },
    },
  };
  return {
    state: applyCareerDelta(
      nextState,
      { counters: { universesDestroyed: 1 } },
      now,
    ),
    record,
  };
}
