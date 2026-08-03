export const CORE_ARTIFACT_IDS = [
  "ARTIFACT_BIOFACTOR_EXTRACTOR",
  "ARTIFACT_PROTOTYPE_EDITOR",
  "ARTIFACT_MIRRORWORKS",
  "ARTIFACT_MANA_VAULT",
  "ARTIFACT_EXPEDITION_GATE",
];

export const THRAN_DYNAMO_ID = "ARTIFACT_THRAN_DYNAMO";
export const METATHRAN_FACILITY_TYPE = "MANA_FACILITY_METATHRAN";
export const PRISMATIC_LENS_ID = "ARTIFACT_PRISMATIC_LENS";
export const SKAAB_NOTEBOOK_ID = "ARTIFACT_SKAAB_NOTEBOOK";
export const SPACE_ANCHOR_ID = "ARTIFACT_SPACE_ANCHOR";

export const ARTIFACT_NAMES = {
  ARTIFACT_BIOFACTOR_EXTRACTOR: "生物因子提取器",
  ARTIFACT_PROTOTYPE_EDITOR: "原体编辑器",
  ARTIFACT_MIRRORWORKS: "镜映品",
  ARTIFACT_MANA_VAULT: "法术力库",
  ARTIFACT_EXPEDITION_GATE: "远征传送门",
  ARTIFACT_THRAN_DYNAMO: "索蓝发电机／Thran Dynamo",
  ARTIFACT_PRISMATIC_LENS: "虹彩透镜／Prismatic Lens",
  ARTIFACT_SKAAB_NOTEBOOK: "尸嵌笔记／Skaab Notebook",
  ARTIFACT_SPACE_ANCHOR: "空间锚点／Space Anchor",
};

export const METATHRAN_BUILD_COST = { C: 1500 };
export const METATHRAN_BUILD_MS = 180000;
export const METATHRAN_YIELD_PER_MINUTE = 100;
export const THRAN_YIELD_PER_MINUTE = 200;

export const MANA_VAULT_LEVELS = [
  {
    level: 0,
    coloredBaseCap: 10,
    colorlessCap: 20000,
    upgradeCost: null,
    upgradeMs: 0,
  },
  {
    level: 1,
    coloredBaseCap: 12,
    colorlessCap: 30000,
    upgradeCost: { C: 10000 },
    upgradeMs: 300000,
  },
  {
    level: 2,
    coloredBaseCap: 14,
    colorlessCap: 50000,
    upgradeCost: { C: 15000 },
    upgradeMs: 600000,
  },
  {
    level: 3,
    coloredBaseCap: 16,
    colorlessCap: 80000,
    upgradeCost: { C: 25000 },
    upgradeMs: 900000,
  },
];
