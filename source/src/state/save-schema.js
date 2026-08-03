import { COLOR_ORDER, getLand, getOrigin } from "../data/game-data.js";
import { SAVE_SCHEMA_VERSION } from "./initial-state.js";
import { migrateSaveData } from "./migrations.js";

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

export function validateSaveData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "存档不是有效对象" };
  }

  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `不支持的存档版本：${String(value.schemaVersion)}`,
    };
  }

  if (typeof value.gameId !== "string" || !value.gameId.startsWith("CT-")) {
    return { valid: false, error: "存档缺少有效的游戏ID" };
  }

  if (!getOrigin(value.base?.originId) || !getLand(value.base?.landId)) {
    return { valid: false, error: "存档中的起源或土地无效" };
  }
  const anchorLocation = value.base?.anchorLocation;
  if (
    !anchorLocation ||
    !["SUBSPACE", "ANCHORED", "RETURNED"].includes(anchorLocation.status) ||
    !Array.isArray(anchorLocation.lands) ||
    anchorLocation.lands.some((landId) => !getLand(landId)) ||
    (anchorLocation.status === "ANCHORED" &&
      (typeof anchorLocation.territoryId !== "string" ||
        anchorLocation.descentMode !== "REALITY_DIMENSION" ||
        anchorLocation.universeId !== "UNIVERSE_PRIMARY" ||
        anchorLocation.worldId !== "WORLD_INNISTRAD" ||
        typeof anchorLocation.regionId !== "string" ||
        anchorLocation.lands.length === 0))
  ) {
    return { valid: false, error: "存档中的空间锚点位置无效" };
  }

  if (!isFiniteNonNegative(value.clock?.economyLastSettledAt)) {
    return { valid: false, error: "存档经济时钟无效" };
  }

  for (const color of COLOR_ORDER) {
    const amount = value.resources?.amounts?.[color];
    const cap = value.resources?.caps?.[color];
    const fraction = value.resources?.fractions?.[color];
    if (
      !isFiniteNonNegative(amount) ||
      !isFiniteNonNegative(cap) ||
      !isFiniteNonNegative(fraction) ||
      fraction >= 1
    ) {
      return { valid: false, error: `资源字段 [${color}] 无效` };
    }
  }

  if (!Array.isArray(value.recentLogs)) {
    return { valid: false, error: "存档事件记录无效" };
  }

  if (
    value.worldMap?.homeNodeId !== "BASE_PLAYER" ||
    !Array.isArray(value.worldMap?.discoveredNodeIds) ||
    !Array.isArray(value.worldMap?.completedNodeIds) ||
    !Array.isArray(value.worldMap?.archivedNodeIds) ||
    !Array.isArray(value.worldMap?.completedTerritoryIds) ||
    typeof value.worldMap?.baseLocationNodeId !== "string" ||
    !value.worldMap?.regionRecords ||
    typeof value.worldMap.regionRecords !== "object" ||
    Array.isArray(value.worldMap.regionRecords) ||
    !value.worldMap?.celestialRecords ||
    typeof value.worldMap.celestialRecords !== "object" ||
    Array.isArray(value.worldMap.celestialRecords) ||
    !value.worldMap?.universeRecords ||
    typeof value.worldMap.universeRecords !== "object" ||
    Array.isArray(value.worldMap.universeRecords) ||
    !Array.isArray(value.worldMap?.generatedCelestials) ||
    !value.worldMap?.stats ||
    typeof value.worldMap.stats !== "object"
  ) {
    return { valid: false, error: "存档宏观地图状态无效" };
  }

  for (const [nodeId, record] of Object.entries(
    value.worldMap.celestialRecords,
  )) {
    if (
      record?.nodeId !== nodeId ||
      !["WORLD", "PLANET"].includes(record.type) ||
      !Array.isArray(record.childNodeIds) ||
      !isFiniteNonNegative(record.completedAt) ||
      (record.archivedAt !== null &&
        !isFiniteNonNegative(record.archivedAt))
    ) {
      return { valid: false, error: "世界／星球归档字段无效" };
    }
  }

  for (const [nodeId, record] of Object.entries(
    value.worldMap.universeRecords,
  )) {
    if (
      record?.nodeId !== nodeId ||
      !Array.isArray(record.childNodeIds) ||
      !Array.isArray(record.frozenSurveyIds) ||
      !isFiniteNonNegative(record.completedAt) ||
      !isFiniteNonNegative(record.archivedAt)
    ) {
      return { valid: false, error: "宇宙归档字段无效" };
    }
  }

  for (const record of value.worldMap.generatedCelestials) {
    if (
      typeof record?.id !== "string" ||
      typeof record.name !== "string" ||
      !["WORLD", "PLANET"].includes(record.type) ||
      typeof record.generatorVersion !== "string" ||
      typeof record.seed !== "string" ||
      !isFiniteNonNegative(record.frozenAt) ||
      !Array.isArray(record.regions) ||
      record.regions.some(
        (region) =>
          typeof region?.id !== "string" ||
          !Array.isArray(region.territories) ||
          region.territories.some(
            (territory) =>
              typeof territory?.id !== "string" ||
              !Array.isArray(territory.lands) ||
              territory.lands.length === 0 ||
              territory.lands.some((landId) => !getLand(landId)) ||
              !isFiniteNonNegative(territory.difficultyRating),
          ),
      )
    ) {
      return { valid: false, error: "随机天体固化快照无效" };
    }
  }

  for (const [regionId, record] of Object.entries(
    value.worldMap.regionRecords,
  )) {
    if (
      !regionId.startsWith("REGION_") ||
      record?.regionId !== regionId ||
      !Array.isArray(record.territoryIds) ||
      !record.territoryResults ||
      typeof record.territoryResults !== "object" ||
      !Array.isArray(record.rewardRecordIds) ||
      (record.completedAt !== null &&
        !isFiniteNonNegative(record.completedAt)) ||
      (record.archivedAt !== null &&
        !isFiniteNonNegative(record.archivedAt))
    ) {
      return { valid: false, error: "区域毁灭档案字段无效" };
    }
  }

  for (const key of [
    "territoriesDestroyed",
    "regionsDestroyed",
    "worldsDestroyed",
    "planetsDestroyed",
    "universesDestroyed",
    "conquestVictories",
    "infiltrationVictories",
  ]) {
    if (!isFiniteNonNegative(value.worldMap.stats[key])) {
      return { valid: false, error: "存档宏观地图统计无效" };
    }
  }

  if (
    !value.rewardProgress ||
    typeof value.rewardProgress !== "object" ||
    !Array.isArray(value.rewardProgress.ledger) ||
    !value.rewardProgress.resolutions ||
    typeof value.rewardProgress.resolutions !== "object" ||
    Array.isArray(value.rewardProgress.resolutions) ||
    !Array.isArray(value.rewardProgress.instances) ||
    !Array.isArray(value.rewardProgress.unlockedContentIds)
  ) {
    return { valid: false, error: "奖励分级与履历字段无效" };
  }

  for (const territory of Object.values(value.territories ?? {})) {
    const snapshot = territory?.catalogSnapshot;
    if (snapshot === null || snapshot === undefined) continue;
    if (
      typeof snapshot !== "object" ||
      snapshot.territoryId !== territory.territoryId ||
      typeof snapshot.generatorVersion !== "string" ||
      !Array.isArray(snapshot.lands) ||
      !snapshot.patrol ||
      !Array.isArray(snapshot.garrison?.templates)
    ) {
      return { valid: false, error: "存档中的生成领土配置快照无效" };
    }
  }

  if (
    !value.residentProgress ||
    typeof value.residentProgress !== "object" ||
    !Array.isArray(value.residentProgress.knownResidentIds) ||
    typeof value.residentProgress.selectedResidentId !== "string" ||
    !isFiniteNonNegative(value.residentProgress.interactionCount) ||
    !Array.isArray(value.residentProgress.seenDialogueIds) ||
    (value.residentProgress.lastDialogueId !== null &&
      typeof value.residentProgress.lastDialogueId !== "string") ||
    (value.residentProgress.lastSpokenAt !== null &&
      !isFiniteNonNegative(value.residentProgress.lastSpokenAt))
  ) {
    return { valid: false, error: "基地驻留者进度字段无效" };
  }

  if (
    !value.careerProgress ||
    typeof value.careerProgress !== "object" ||
    !isFiniteNonNegative(value.careerProgress.trackingStartedAt) ||
    typeof value.careerProgress.legacyBaseline !== "boolean" ||
    typeof value.careerProgress.note !== "string" ||
    !value.careerProgress.counters ||
    typeof value.careerProgress.counters !== "object" ||
    !value.careerProgress.records ||
    typeof value.careerProgress.records !== "object"
  ) {
    return { valid: false, error: "永久统计字段无效" };
  }
  for (const counterValue of Object.values(value.careerProgress.counters)) {
    if (!isFiniteNonNegative(counterValue)) {
      return { valid: false, error: "永久统计累计值无效" };
    }
  }

  if (
    !value.achievementProgress ||
    typeof value.achievementProgress !== "object" ||
    !value.achievementProgress.unlocked ||
    typeof value.achievementProgress.unlocked !== "object" ||
    Array.isArray(value.achievementProgress.unlocked) ||
    !Array.isArray(value.achievementProgress.pendingIds)
  ) {
    return { valid: false, error: "成就档案字段无效" };
  }

  for (const key of [
    "unlockedBiofactors",
    "blueprints",
    "prototypes",
    "legendaryBlueprints",
    "legendaryIdentities",
    "legendaryPrototypes",
    "legions",
    "productionQueue",
    "artifacts",
    "manaFacilities",
  ]) {
    if (!Array.isArray(value[key])) {
      return { valid: false, error: `存档字段 ${key} 无效` };
    }
  }

  for (const identity of value.legendaryIdentities) {
    if (
      typeof identity?.id !== "string" ||
      typeof identity?.blueprintId !== "string" ||
      !identity.career ||
      typeof identity.career !== "object" ||
      !identity.contentProgress ||
      typeof identity.contentProgress !== "object" ||
      !Array.isArray(identity.entityHistory) ||
      !Array.isArray(identity.intrinsicFactorHistory)
    ) {
      return { valid: false, error: "传奇身份档案字段无效" };
    }
  }

  if (
    !value.prismaticLens ||
    typeof value.prismaticLens !== "object" ||
    !["W", "U", "B", "R", "G"].includes(value.prismaticLens.selectedColor)
  ) {
    return { valid: false, error: "虹彩透镜状态无效" };
  }

  return { valid: true, error: null };
}

export function parseSaveJson(jsonText) {
  let value;
  try {
    value = JSON.parse(jsonText);
  } catch {
    throw new Error("文件不是有效的JSON存档");
  }

  const migrated = migrateSaveData(value);
  const validation = validateSaveData(migrated);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return migrated;
}
