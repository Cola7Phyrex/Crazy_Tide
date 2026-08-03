import { COLOR_ORDER, COLORS, getLand, getOrigin } from "../data/game-data.js";
import { recordCareerEvent } from "../systems/career.js";
import {
  getCommandDisplayName,
  getGeneratorVersionDisplayName,
  getMapNodeDisplayName,
  getOutcomeDisplayName,
  getTerritoryDisplayName,
} from "../systems/content-presentation.js";

const MAX_RECENT_LOGS = 200;

const EVENT_META = {
  NEW_GAME_STARTED: { label: "系统", type: "system" },
  OFFLINE_RESOURCES_SETTLED: { label: "生产", type: "resource" },
  MANUAL_SAVE_COMPLETED: { label: "存档", type: "system" },
  SAVE_EXPORTED: { label: "存档", type: "system" },
  SAVE_IMPORTED: { label: "存档", type: "system" },
  EFFECTS_TOGGLED: { label: "设置", type: "system" },
  BLUEPRINT_SAVED: { label: "解锁", type: "reward" },
  BLUEPRINT_UPDATED: { label: "生产", type: "resource" },
  BLUEPRINT_DELETED: { label: "销毁", type: "system" },
  PROTOTYPE_REBUILT: { label: "生产", type: "resource" },
  PROTOTYPE_INSTANTIATED: { label: "生产", type: "resource" },
  PROTOTYPE_DESTROYED: { label: "销毁", type: "system" },
  LEGION_PRODUCTION_QUEUED: { label: "生产", type: "resource" },
  LEGION_PRODUCTION_COMPLETED: { label: "生产", type: "resource" },
  LEGION_REINFORCEMENT_COMPLETED: { label: "生产", type: "resource" },
  LEGION_DISBANDED: { label: "销毁", type: "system" },
  FACILITY_PRODUCTION_QUEUED: { label: "生产", type: "resource" },
  FACILITY_PRODUCTION_COMPLETED: { label: "生产", type: "resource" },
  MANA_VAULT_UPGRADE_QUEUED: { label: "生产", type: "resource" },
  MANA_VAULT_UPGRADE_COMPLETED: { label: "生产", type: "resource" },
  PRODUCTION_CANCELLED: { label: "生产", type: "resource" },
  EXPEDITION_STARTED: { label: "远征", type: "expedition" },
  EXPEDITION_COMPLETED: { label: "奖励", type: "reward" },
  EXPEDITION_ENDED: { label: "远征", type: "expedition" },
  GAVONY_CHALLENGE_REFRESHED: { label: "远征", type: "expedition" },
  MVP_THANKS_ACKNOWLEDGED: { label: "系统", type: "system" },
  VIRTUES_RUIN_CAST: { label: "远征", type: "expedition" },
  TASTE_FOR_MAYHEM_CAST: { label: "远征", type: "expedition" },
  GROUNDED_CAST: { label: "远征", type: "expedition" },
  REGION_ARCHIVED: { label: "归档", type: "system" },
  RANDOM_CELESTIAL_FROZEN: { label: "观测", type: "system" },
  CELESTIAL_ARCHIVED: { label: "归档", type: "system" },
  UNIVERSE_ARCHIVED: { label: "归档", type: "system" },
  SPACE_ANCHOR_ACTIVATED: { label: "基地", type: "system" },
  SPACE_ANCHOR_RETURNED: { label: "基地", type: "system" },
};

function createEventId(timestamp) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Math.random().toString(36).slice(2)}-${timestamp.toString(36)}`;
  return `EVENT_${randomPart}`;
}

export function createGameEvent(type, payload = {}, timestamp = Date.now()) {
  return {
    id: createEventId(timestamp),
    type,
    payload,
    timestamp,
  };
}

export function appendEvent(state, event) {
  return recordCareerEvent({
    ...state,
    recentLogs: [event, ...(state.recentLogs ?? [])].slice(0, MAX_RECENT_LOGS),
  }, event);
}

function formatGains(gained = {}) {
  return COLOR_ORDER.filter((color) => gained[color] > 0)
    .map((color) => `+${gained[color]} [${color}]`)
    .join(" / ");
}

export function presentEvent(event) {
  const meta = EVENT_META[event.type] ?? { label: "系统", type: "system" };
  const payload = event.payload ?? {};
  let text = event.type;

  switch (event.type) {
    case "NEW_GAME_STARTED": {
      const origin = getOrigin(payload.originId);
      const land = getLand(payload.landId);
      text = `新游戏建立：${origin?.shortName ?? "未知起源"} / ${land?.name ?? "未知基本地"}`;
      break;
    }
    case "OFFLINE_RESOURCES_SETTLED": {
      const minutes = Math.max(1, Math.round((payload.elapsedMs ?? 0) / 60000));
      text = `离线结算 ${minutes} 分钟：${formatGains(payload.gained) || "资源已达上限"}`;
      break;
    }
    case "MANUAL_SAVE_COMPLETED":
      text = "本地手动存档完成";
      break;
    case "SAVE_EXPORTED":
      text = "存档已导出为JSON文件";
      break;
    case "SAVE_IMPORTED":
      text = "外部存档通过校验并载入";
      break;
    case "EFFECTS_TOGGLED":
      text = payload.enabled ? "视觉扫描线与发光效果已启用" : "视觉扫描线与发光效果已关闭";
      break;
    case "VIRTUES_RUIN_CAST":
      text = "已施放道德瓦解／Virtue's Ruin：-2[B]";
      break;
    case "TASTE_FOR_MAYHEM_CAST":
      text = "已施放破坏之乐／Taste for Mayhem：-1[R]";
      break;
    case "GROUNDED_CAST":
      text = "已施放禁足／Grounded：-1[G]";
      break;
    case "BLUEPRINT_SAVED":
      text = `蓝图「${payload.name}」已保存，首次免费原体已实体化`;
      break;
    case "BLUEPRINT_UPDATED":
      text = `蓝图「${payload.name}」已完成二次编辑`;
      break;
    case "BLUEPRINT_DELETED":
      text = `蓝图「${payload.name}」已永久删除；设计成本不返还`;
      break;
    case "PROTOTYPE_REBUILT":
      text = `原体「${payload.name}」重构完成：-${payload.cost}[C]`;
      break;
    case "PROTOTYPE_INSTANTIATED":
      text = `原体「${payload.name}」已由保留蓝图重新实体化：-${payload.cost}[C]`;
      break;
    case "PROTOTYPE_DESTROYED":
      text = `原体「${payload.name}」已销毁；所属蓝图继续保留`;
      break;
    case "LEGION_PRODUCTION_QUEUED":
      text = `${payload.mode === "REINFORCE" ? "军团补充" : "镜映品生产"}开始：${payload.scaleHp}点军团生命 / ${payload.replicaCount}名复制体`;
      break;
    case "LEGION_PRODUCTION_COMPLETED":
      text = `军团「${payload.name}」已就绪`;
      break;
    case "LEGION_REINFORCEMENT_COMPLETED":
      text = `军团「${payload.name}」补充完成：+${payload.scaleHp}生命 / +${payload.replicaCount}名复制体`;
      break;
    case "LEGION_DISBANDED":
      text = `军团「${payload.name}」已解散：${payload.replicaCount}名复制体被销毁，资源不返还`;
      break;
    case "FACILITY_PRODUCTION_QUEUED":
      text = `仿索蓝发电机／Metathran Dynamo开始建造：${payload.cost ? `-${payload.cost}[C]` : "免费"} / 需要${payload.durationMs < 60000 ? `${Math.round(payload.durationMs / 1000)}秒` : `${Math.round(payload.durationMs / 60000)}分钟`}`;
      break;
    case "FACILITY_PRODUCTION_COMPLETED":
      text = `仿索蓝发电机／Metathran Dynamo建造完成：+100[C] / ${payload.cycleLabel ?? "分钟"}`;
      break;
    case "MANA_VAULT_UPGRADE_QUEUED":
      text = `法术力库Lv.${payload.level}扩容开始：${payload.cost ? `-${payload.cost}[C]` : "免费"} / ${payload.durationMs < 60000 ? `${Math.round(payload.durationMs / 1000)}秒` : `${Math.round(payload.durationMs / 60000)}分钟`}`;
      break;
    case "MANA_VAULT_UPGRADE_COMPLETED":
      text = `法术力库升级至Lv.${payload.level}：[C]容量提升至${payload.colorlessCap}`;
      break;
    case "PRODUCTION_CANCELLED":
      text = `生产已取消：退还${formatGains(payload.refund)}`;
      break;
    case "EXPEDITION_STARTED":
      text = `远征开始：${getTerritoryDisplayName(payload.territoryId)} / ${getCommandDisplayName(payload.command)}，传送门消耗500[C]`;
      break;
    case "EXPEDITION_COMPLETED":
    case "EXPEDITION_ENDED":
      text = payload.text ?? `远征结束：${getOutcomeDisplayName(payload.outcome)}`;
      break;
    case "GAVONY_CHALLENGE_REFRESHED":
      text = "加渥尼已手动刷新：坚守、稳定、巡逻与三支守军恢复";
      break;
    case "MVP_THANKS_ACKNOWLEDGED":
      text = "MVP感谢画面已确认，可以继续优化构筑与重复挑战";
      break;
    case "REGION_ARCHIVED":
      text = `${getMapNodeDisplayName(payload.regionId)}已压缩为毁灭档案：${payload.territoryCount ?? 0}块领土 / ${payload.rewardCount ?? 0}项奖励记录`;
      break;
    case "RANDOM_CELESTIAL_FROZEN":
      text = `随机${payload.celestialType === "PLANET" ? "星球" : "世界"}「${payload.name ?? "未命名天体"}」已固化：${getGeneratorVersionDisplayName(payload.generatorVersion)}`;
      break;
    case "CELESTIAL_ARCHIVED":
      text = `${getMapNodeDisplayName(payload.nodeId)}已归档`;
      break;
    case "UNIVERSE_ARCHIVED":
      text = `${getMapNodeDisplayName(payload.universeId)}已归档`;
      break;
    case "SPACE_ANCHOR_ACTIVATED":
      text = `基地已通过空间锚点降临现实维度：${getTerritoryDisplayName(payload.territoryId)}`;
      break;
    case "SPACE_ANCHOR_RETURNED":
      text = "基地已永久返回亚空间；空间锚点不返还";
      break;
    default:
      text = event.type;
  }

  return {
    ...meta,
    text,
    timestamp: event.timestamp,
  };
}

export function formatEventTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function getColorDisplayName(color) {
  return COLORS[color]?.fullName ?? color;
}
