export const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];

export const COLORS = {
  W: { id: "W", name: "白", fullName: "白色", tone: "white" },
  U: { id: "U", name: "蓝", fullName: "蓝色", tone: "blue" },
  B: { id: "B", name: "黑", fullName: "黑色", tone: "black" },
  R: { id: "R", name: "红", fullName: "红色", tone: "red" },
  G: { id: "G", name: "绿", fullName: "绿色", tone: "green" },
  C: { id: "C", name: "无色", fullName: "无色", tone: "colorless" },
};

export const ORIGINS = [
  {
    id: "ORIGIN_W",
    color: "W",
    name: "白色法术力起源",
    shortName: "白色起源",
    direction: "规模 / 纪律 / 传教",
  },
  {
    id: "ORIGIN_U",
    color: "U",
    name: "蓝色法术力起源",
    shortName: "蓝色起源",
    direction: "侦查 / 渗透 / 法术",
  },
  {
    id: "ORIGIN_B",
    color: "B",
    name: "黑色法术力起源",
    shortName: "黑色起源",
    direction: "腐化 / 复生 / 牺牲",
  },
  {
    id: "ORIGIN_R",
    color: "R",
    name: "红色法术力起源",
    shortName: "红色起源",
    direction: "敏捷 / 战斗 / 破坏",
  },
  {
    id: "ORIGIN_G",
    color: "G",
    name: "绿色法术力起源",
    shortName: "绿色起源",
    direction: "生长 / 规模 / 巨物",
  },
];

export const LANDS = [
  { id: "LAND_PLAINS", color: "W", name: "平原", description: "稳定而开阔的白色基本地" },
  { id: "LAND_ISLAND", color: "U", name: "海岛", description: "被潮汐与迷雾包围的蓝色基本地" },
  { id: "LAND_SWAMP", color: "B", name: "沼泽", description: "持续腐化又充满养分的黑色基本地" },
  { id: "LAND_MOUNTAIN", color: "R", name: "山脉", description: "炽热、陡峭且躁动的红色基本地" },
  { id: "LAND_FOREST", color: "G", name: "树林", description: "生命密集生长的绿色基本地" },
];

export function getOrigin(originId) {
  return ORIGINS.find((origin) => origin.id === originId);
}

export function getLand(landId) {
  return LANDS.find((land) => land.id === landId);
}

