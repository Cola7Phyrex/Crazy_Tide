import { ACHIEVEMENTS } from "../data/achievement-data.js";
import {
  ARTIFACT_CATALOG,
  ENCHANTMENT_CATALOG,
  SPELL_CATALOG,
} from "../data/arcana-data.js";
import { getLand, getOrigin } from "../data/game-data.js";
import { LEGENDARY_PROTOTYPE_CATALOG } from "../data/legendary-prototype-data.js";
import {
  getAbilityDefinition,
  getComponent,
  getJob,
  getRace,
} from "../data/prototype-data.js";
import { getTerritory } from "../data/territory-data.js";
import { getMapNode } from "../data/world-map-data.js";

const ARCANA_CATALOG = [
  ...ARTIFACT_CATALOG,
  ...ENCHANTMENT_CATALOG,
  ...SPELL_CATALOG,
];

const COMMAND_NAMES = Object.freeze({
  RECON: "侦查",
  CONQUEST: "征服",
  INFILTRATION: "渗透",
});

const OUTCOME_NAMES = Object.freeze({
  SUCCESS: "成功",
  FAILURE: "失败",
  RETURNED: "返航",
  RECALLED: "已召回",
});

const GENERATOR_VERSION_NAMES = Object.freeze({
  INNISTRAD_V1: "依尼翠观测协议·第一版",
});

export function getAbilityDisplayName(abilityId) {
  return getAbilityDefinition(abilityId)?.name ?? "未知异能";
}

export function getCommandDisplayName(command) {
  return COMMAND_NAMES[command] ?? "未知指令";
}

export function getOutcomeDisplayName(outcome) {
  return OUTCOME_NAMES[outcome] ?? "已结束";
}

export function getGeneratorVersionDisplayName(version) {
  return GENERATOR_VERSION_NAMES[version] ?? "当前观测协议";
}

export function getTerritoryDisplayName(territoryId) {
  return getTerritory(territoryId)?.name ?? "未知领土";
}

export function getMapNodeDisplayName(nodeId) {
  return getMapNode(nodeId)?.name ?? "未知地图节点";
}

export function getContentDisplayName(contentId) {
  if (!contentId) return "未知内容";
  return (
    getRace(contentId)?.name ??
    getJob(contentId)?.name ??
    getComponent(contentId)?.name ??
    getOrigin(contentId)?.shortName ??
    getLand(contentId)?.name ??
    getTerritory(contentId)?.name ??
    getMapNode(contentId)?.name ??
    ARCANA_CATALOG.find((item) => item.id === contentId)?.name ??
    LEGENDARY_PROTOTYPE_CATALOG.find((item) => item.id === contentId)?.name ??
    ACHIEVEMENTS.find((item) => item.id === contentId)?.name ??
    "未知内容"
  );
}
