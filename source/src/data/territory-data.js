import { generateOfficialInnistradTerritories } from "../systems/territory-generator.js";

export const DEFAULT_COLORLESS_GUARD_BLUEPRINT = Object.freeze({
  id: "SYSTEM_BLUEPRINT_CONSTRUCT_BRONZE_SWORD_GUARD",
  name: "组构体持剑守卫",
  raceId: "RACE_CONSTRUCT",
  raceColor: "C",
  jobId: "JOB_NONE",
  equipmentIds: ["EQUIPMENT_BRONZE_SWORD"],
  stats: Object.freeze({ power: 1, defense: 1, hp: 3 }),
  designCost: Object.freeze({ C: 300 }),
  replicasPerScaleHp: 3,
  systemOnly: true,
});

export const GAVONY_TERRITORIES = [
  {
    id: "TERRITORY_TUTORIAL_W",
    name: "平原上的村庄",
    shortName: "平原村庄",
    aliases: ["白色教学村庄", "白色村庄"],
    regionId: "REGION_GAVONY",
    type: "村庄",
    colors: ["W"],
    primaryRace: "人类",
    lands: ["LAND_PLAINS", "LAND_PLAINS", "LAND_PLAINS"],
    map: { x: 45, y: 30 },
    maxFortitude: 20,
    maxStability: 20,
    infiltrationResistance: 0,
    exposureRate: 0.06,
    scoutingDifficulty: 0,
    preferredIntelMetric: "fortitude",
    patrol: {
      id: "PATROL_W_VILLAGE_ARCHER",
      name: "白村巡逻弓手",
      power: 1,
      defense: 1,
      hp: 6,
      colors: ["W", "G"],
      abilities: ["ABILITY_REACH"],
      firstReward: { W: 1, C: 100 },
      biofactorId: "MODIFICATION_ARM",
    },
    garrison: {
      templates: [
        {
          templateId: "GARRISON_W_VILLAGE_MILITIA",
          name: "白村持剑民兵",
          power: 2,
          defense: 2,
          hp: 9,
          colors: ["W"],
          abilities: ["ABILITY_001"],
          initialCount: 2,
          firstReward: { W: 1, C: 200 },
        },
      ],
      reinforcedReward: { C: 100 },
    },
    conquestReward: { W: 3, C: 500 },
    conquestLootShares: [{ W: 3 }, { C: 500 }],
    description: "三个平原环绕的秩序村庄，民兵防线均衡而耐久。",
  },
  {
    id: "TERRITORY_TUTORIAL_G",
    name: "森林中的村庄",
    shortName: "森林村庄",
    aliases: ["绿色教学村庄", "绿色村庄"],
    regionId: "REGION_GAVONY",
    type: "村庄",
    colors: ["G"],
    primaryRace: "妖精",
    lands: ["LAND_FOREST", "LAND_FOREST", "LAND_FOREST"],
    map: { x: 46, y: 77 },
    maxFortitude: 20,
    maxStability: 20,
    infiltrationResistance: 0,
    exposureRate: 0.06,
    scoutingDifficulty: 0,
    preferredIntelMetric: "stability",
    patrol: {
      id: "PATROL_G_VILLAGE_ARCHER",
      name: "绿村巡林弓手",
      power: 2,
      defense: 0,
      hp: 5,
      colors: ["G"],
      abilities: ["ABILITY_REACH", "ABILITY_FORESTWALK"],
      firstReward: { G: 1, C: 100 },
      biofactorId: "MODIFICATION_ELVEN_EARS",
    },
    garrison: {
      templates: [
        {
          templateId: "GARRISON_G_VILLAGE_WARRIOR",
          name: "绿村林地剑士",
          power: 3,
          defense: 1,
          hp: 8,
          colors: ["G"],
          abilities: ["ABILITY_FORESTWALK", "ABILITY_001"],
          initialCount: 2,
          firstReward: { G: 1, C: 200 },
        },
      ],
      reinforcedReward: { C: 100 },
    },
    conquestReward: { G: 3, C: 500 },
    conquestLootShares: [{ G: 3 }, { C: 500 }],
    description: "三个树林构成的妖精村庄，守军高攻低防。",
  },
  {
    id: "TERRITORY_TOWN_WG",
    name: "加渥尼镇区",
    shortName: "加渥尼镇区",
    aliases: ["加渥尼"],
    regionId: "REGION_GAVONY",
    type: "城镇",
    colors: ["W", "G"],
    primaryRace: "人类 / 妖精",
    lands: [
      "LAND_PLAINS",
      "LAND_PLAINS",
      "LAND_FOREST",
      "LAND_FOREST",
    ],
    map: { x: 79, y: 51 },
    maxFortitude: 50,
    maxStability: 40,
    infiltrationResistance: 0,
    exposureRate: 0.06,
    scoutingDifficulty: 0,
    preferredIntelMetric: "stability",
    locked: true,
    patrol: {
      id: "PATROL_TOWN_WG_LONGBOW",
      name: "加渥尼巡逻长弓手",
      power: 1,
      defense: 1,
      hp: 7,
      colors: ["W", "G"],
      abilities: ["ABILITY_REACH"],
      firstReward: { W: 1, G: 1, C: 200 },
      biofactorId: null,
    },
    garrison: {
      templates: [
        {
          templateId: "GARRISON_TOWN_WG_HUMAN_SWORD",
          name: "加渥尼守军1 · 人类剑士",
          power: 2,
          defense: 2,
          hp: 12,
          colors: ["W"],
          abilities: ["ABILITY_001"],
          initialCount: 1,
          firstReward: { W: 1, C: 300 },
        },
        {
          templateId: "GARRISON_TOWN_WG_ELF_LONGBOW",
          name: "加渥尼守军2 · 妖精长弓手",
          power: 3,
          defense: 1,
          hp: 10,
          colors: ["G"],
          abilities: ["ABILITY_FORESTWALK", "ABILITY_REACH", "ABILITY_001"],
          initialCount: 1,
          firstReward: { G: 1, C: 300 },
        },
        {
          templateId: "GARRISON_TOWN_WG_HUMAN_SHIELD_BOW",
          name: "加渥尼守军3 · 白绿盾弓手",
          power: 2,
          defense: 3,
          hp: 11,
          colors: ["W", "G"],
          abilities: ["ABILITY_REACH", "ABILITY_001", "ABILITY_002"],
          initialCount: 1,
          firstReward: { W: 1, G: 1, C: 400 },
        },
      ],
      reinforcedReward: {},
    },
    conquestReward: { W: 2, G: 2, C: 1000 },
    conquestLootShares: [{ W: 2 }, { G: 2 }, { C: 1000 }],
    repeatReward: { C: 4000, randomColor: ["W", "G"] },
    description: "四块白绿基本地组成的边境城镇，由一支巡逻队和三支各具特色的守军共同防守。",
  },
];

export const GENERATED_INNISTRAD_TERRITORIES =
  generateOfficialInnistradTerritories();

export const TERRITORIES = [
  ...GAVONY_TERRITORIES,
  ...GENERATED_INNISTRAD_TERRITORIES,
];

export function createTerritoryCatalogSnapshot(territory) {
  if (!territory?.generator) return null;
  return structuredClone({
    territoryId: territory.id,
    generatorVersion: territory.generator.version,
    seed: territory.generator.seed,
    colors: territory.colors,
    lands: territory.lands,
    maxFortitude: territory.maxFortitude,
    maxStability: territory.maxStability,
    infiltrationResistance: territory.infiltrationResistance,
    exposureRate: territory.exposureRate,
    scoutingDifficulty: territory.scoutingDifficulty,
    preferredIntelMetric: territory.preferredIntelMetric,
    patrol: territory.patrol,
    garrison: territory.garrison,
    rewardSlots: territory.rewardSlots ?? [],
    description: territory.description,
    scoutingText: territory.scoutingText ?? null,
    conquestText: territory.conquestText ?? null,
    generator: territory.generator,
  });
}

function isTerritoryCompleted(state, territoryId) {
  return Boolean(
    state?.worldMap?.completedTerritoryIds?.includes(territoryId) ||
    state?.territories?.[territoryId]?.conquered,
  );
}

export function isTerritoryUnlocked(state, territory) {
  if (!territory) return false;
  if (state?.settings?.testMode) return true;
  if (!state?.worldMap?.discoveredNodeIds?.includes(territory.regionId)) {
    return false;
  }
  if (
    territory.id === "TERRITORY_TOWN_WG" &&
    !state?.flags?.firstVillageConquered
  ) return false;
  return (territory.requiresTerritoryIds ?? []).every((territoryId) =>
    isTerritoryCompleted(state, territoryId),
  );
}

export function getTerritoryAccessReason(state, territory) {
  if (isTerritoryUnlocked(state, territory)) return null;
  if (!state?.worldMap?.discoveredNodeIds?.includes(territory?.regionId)) {
    return territory?.regionId === "REGION_THRABEN"
      ? "完全毁灭依尼翠其余五个区域后，才能锁定瑟班城。"
      : "完全毁灭加渥尼后，才能锁定该区域。";
  }
  if (territory?.id === "TERRITORY_TOWN_WG") {
    return "攻陷任意一座教学村庄后，亚空间探针才能锁定这座白绿城镇。";
  }
  if (territory?.accessConditionText) return territory.accessConditionText;
  const missingNames = (territory?.requiresTerritoryIds ?? [])
    .filter((territoryId) => !isTerritoryCompleted(state, territoryId))
    .map((territoryId) => getTerritory(territoryId)?.name ?? "未知领土");
  return missingNames.length
    ? `需要先攻陷：${missingNames.join("、")}。`
    : "该领土尚未开放。";
}

export function getTerritory(id) {
  return TERRITORIES.find((territory) => territory.id === id);
}

export function getTerritoryForState(state, id) {
  const territory = getTerritory(id);
  const snapshot = state?.territories?.[id]?.catalogSnapshot;
  if (!territory || !snapshot) return territory;
  return {
    ...territory,
    ...structuredClone(snapshot),
    id: territory.id,
    regionId: territory.regionId,
    name: territory.name,
    shortName: territory.shortName,
    aliases: [...territory.aliases],
    type: territory.type,
    map: { ...territory.map },
    requiresTerritoryIds: [...(territory.requiresTerritoryIds ?? [])],
    accessConditionText: territory.accessConditionText ?? null,
    allowedInfiltratorRaceIds: territory.allowedInfiltratorRaceIds
      ? [...territory.allowedInfiltratorRaceIds]
      : null,
  };
}

export function getTerritoriesForRegion(regionId, state = null) {
  return TERRITORIES.filter(
    (territory) => territory.regionId === regionId,
  ).map((territory) =>
    state ? getTerritoryForState(state, territory.id) : territory,
  );
}

export function getGarrisonTemplates(territory) {
  return territory?.garrison?.templates ?? [];
}

export function getGarrisonTemplate(territory, templateId) {
  return getGarrisonTemplates(territory).find(
    (template) => template.templateId === templateId,
  );
}

export function createInitialGuardInstances(territory, generation = 0) {
  return getGarrisonTemplates(territory).flatMap((template) =>
    Array.from({ length: template.initialCount }, (_, index) => ({
      id: `${template.templateId}_${generation}_${index + 1}`,
      templateId: template.templateId,
      reinforced: false,
      defeated: false,
      rewardClaimed: generation > 0,
    })),
  );
}

export function createTerritoryStates() {
  return Object.fromEntries(
    TERRITORIES.map((territory) => [
      territory.id,
      {
        territoryId: territory.id,
        currentLands: [...territory.lands],
        currentFortitude: territory.maxFortitude,
        currentStability: territory.maxStability,
        defeatedInitialGuards: [],
        activeGuardInstances: createInitialGuardInstances(territory),
        routeIntelLevel: 0,
        knownFortitude: false,
        knownStability: false,
        revealedGuardTemplates: [],
        patrolFirstRewardClaimed: false,
        destructionMarks: [],
        firstConquestLootResolution: null,
        catalogSnapshot: createTerritoryCatalogSnapshot(territory),
        conquered: false,
        repeatCount: 0,
      },
    ]),
  );
}
