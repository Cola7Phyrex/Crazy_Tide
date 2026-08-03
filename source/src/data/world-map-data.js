export const MAP_NODE_TYPES = Object.freeze({
  MULTIVERSE: "MULTIVERSE",
  SUBSPACE: "SUBSPACE",
  UNIVERSE: "UNIVERSE",
  WORLD: "WORLD",
  PLANET: "PLANET",
  BASE: "BASE",
  REGION: "REGION",
});

export const MAP_CONTENT_STATUS = Object.freeze({
  STRUCTURAL: "STRUCTURAL",
  SAFE: "SAFE",
  ACTIVE: "ACTIVE",
  PLANNED: "PLANNED",
});

export const WORLD_MAP_NODES = [
  {
    id: "MULTIVERSE_ROOT",
    name: "多元宇宙",
    englishName: "Multiverse",
    type: MAP_NODE_TYPES.MULTIVERSE,
    parentId: null,
    contentStatus: MAP_CONTENT_STATUS.STRUCTURAL,
    map: { x: 50, y: 50 },
    description: "全部已观测宇宙与亚空间分支的最高层档案。",
  },
  {
    id: "SUBSPACE_PRIMARY",
    name: "亚空间",
    englishName: "Subspace",
    type: MAP_NODE_TYPES.SUBSPACE,
    parentId: "MULTIVERSE_ROOT",
    contentStatus: MAP_CONTENT_STATUS.SAFE,
    map: { x: 27, y: 52 },
    description: "与宇宙同级的非现实分支。玩家基地固定于此。",
  },
  {
    id: "UNIVERSE_PRIMARY",
    name: "现实纬度宇宙",
    englishName: "Reality Dimension Universe",
    type: MAP_NODE_TYPES.UNIVERSE,
    parentId: "MULTIVERSE_ROOT",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 73, y: 48 },
    description: "依尼翠当前所属的现实纬度宇宙。",
  },
  {
    id: "BASE_PLAYER",
    name: "亚空间基地",
    englishName: "Subspace Base",
    type: MAP_NODE_TYPES.BASE,
    parentId: "SUBSPACE_PRIMARY",
    contentStatus: MAP_CONTENT_STATUS.SAFE,
    map: { x: 50, y: 50 },
    description: "不可征服的固定基地地点，也是所有远征的出发点。",
  },
  {
    id: "WORLD_INNISTRAD",
    name: "依尼翠",
    englishName: "Innistrad",
    type: MAP_NODE_TYPES.WORLD,
    parentId: "UNIVERSE_PRIMARY",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 50, y: 50 },
    description: "第一世界。当前规划六个区域，共十八个领土。",
  },
  {
    id: "REGION_GAVONY",
    name: "加渥尼",
    englishName: "Gavony",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 27, y: 29 },
    description: "第一批可远征区域，包含两座村庄与加渥尼镇区。",
  },
  {
    id: "REGION_NEPHALIA",
    name: "涅非利亚",
    englishName: "Nephalia",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 52, y: 23 },
    description: "沉船地、牧场与学院所在区域；灵俑防线坚韧，只有灵俑军团能够执行渗透。",
  },
  {
    id: "REGION_KESSIG",
    name: "凯锡革",
    englishName: "Kessig",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 77, y: 33 },
    description: "猎手小屋与狼栖地所在区域；野兽与狼人依靠高基础数值正面狩猎。",
  },
  {
    id: "REGION_STENSIA",
    name: "史顿襄",
    englishName: "Stensia",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 73, y: 72 },
    description: "旅店、疯人院、血厅与沃达连邸所在区域；吸血鬼会在见血后持续增强。",
  },
  {
    id: "REGION_MOORLAND",
    name: "荒野省",
    englishName: "Moorland",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 47, y: 78 },
    description: "闹鬼荒野所在区域；普通守军全部为具有飞行能力的精怪。",
  },
  {
    id: "REGION_THRABEN",
    name: "瑟班城",
    englishName: "Thraben",
    type: MAP_NODE_TYPES.REGION,
    parentId: "WORLD_INNISTRAD",
    contentStatus: MAP_CONTENT_STATUS.ACTIVE,
    map: { x: 22, y: 68 },
    description: "城门、军营、教会与狱窖所在的最终城市区域，正规士兵与神器守卫构成高强度防线。",
  },
];

const NODE_BY_ID = new Map(WORLD_MAP_NODES.map((node) => [node.id, node]));

export const INITIAL_DISCOVERED_MAP_NODE_IDS = Object.freeze([
  "MULTIVERSE_ROOT",
  "SUBSPACE_PRIMARY",
  "UNIVERSE_PRIMARY",
  "BASE_PLAYER",
  "WORLD_INNISTRAD",
  "REGION_GAVONY",
]);

export const MIDGAME_REGION_IDS = Object.freeze([
  "REGION_NEPHALIA",
  "REGION_KESSIG",
  "REGION_STENSIA",
  "REGION_MOORLAND",
]);

export const FINAL_REGION_ID = "REGION_THRABEN";

export function getProgressiveDiscoveredMapNodeIds(
  completedNodeIds = [],
) {
  const completed = new Set(completedNodeIds);
  const discovered = new Set(INITIAL_DISCOVERED_MAP_NODE_IDS);
  for (const nodeId of completed) {
    if (getMapNode(nodeId)?.type === MAP_NODE_TYPES.REGION) {
      discovered.add(nodeId);
    }
  }
  if (completed.has("REGION_GAVONY")) {
    MIDGAME_REGION_IDS.forEach((regionId) => discovered.add(regionId));
  }
  if (MIDGAME_REGION_IDS.every((regionId) => completed.has(regionId))) {
    discovered.add(FINAL_REGION_ID);
  }
  return [...discovered];
}

export function getMapNode(id) {
  return NODE_BY_ID.get(id) ?? null;
}

export function getMapChildren(parentId) {
  return WORLD_MAP_NODES.filter((node) => node.parentId === parentId);
}

export function getMapPath(nodeId) {
  const path = [];
  const visited = new Set();
  let node = getMapNode(nodeId);
  while (node && !visited.has(node.id)) {
    path.unshift(node);
    visited.add(node.id);
    node = node.parentId ? getMapNode(node.parentId) : null;
  }
  return path;
}

export function createInitialWorldMapState() {
  return {
    homeNodeId: "BASE_PLAYER",
    discoveredNodeIds: getProgressiveDiscoveredMapNodeIds(),
    completedNodeIds: [],
    archivedNodeIds: [],
    completedTerritoryIds: [],
    regionRecords: {},
    celestialRecords: {},
    universeRecords: {},
    generatedCelestials: [],
    baseLocationNodeId: "SUBSPACE_PRIMARY",
    stats: {
      territoriesDestroyed: 0,
      regionsDestroyed: 0,
      worldsDestroyed: 0,
      planetsDestroyed: 0,
      universesDestroyed: 0,
      conquestVictories: 0,
      infiltrationVictories: 0,
    },
  };
}
