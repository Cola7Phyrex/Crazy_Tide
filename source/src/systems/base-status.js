import { COLOR_ORDER } from "../data/game-data.js";

const EXPEDITION_PHASE_NAMES = {
  TRAVELING: "远征移动",
  PATROL_COMBAT: "巡逻交战",
  SCOUTING: "侦查连接",
  GARRISON_COMBAT: "守军交战",
  INFILTRATING: "渗透连接",
  EXECUTION_WARNING: "处决警告",
};

export function getBaseStatusView(state) {
  const manaLoads = COLOR_ORDER.map((color) => {
    const amount = Number(state.resources?.amounts?.[color] ?? 0);
    const cap = Math.max(1, Number(state.resources?.caps?.[color] ?? 1));
    return {
      color,
      amount,
      cap,
      ratio: Math.max(0, Math.min(1, amount / cap)),
    };
  });
  const dominantMana = manaLoads.reduce(
    (highest, item) => (item.ratio > highest.ratio ? item : highest),
    manaLoads[0],
  );
  const expedition = state.activeExpedition;
  const executionWarning = expedition?.phase === "EXECUTION_WARNING";
  const infiltrationActive =
    expedition?.command === "INFILTRATION" ||
    expedition?.phase === "INFILTRATING";
  const productionCount = state.productionQueue?.length ?? 0;
  const manaStatus =
    dominantMana.ratio >= 0.95
      ? "接近饱和"
      : dominantMana.ratio >= 0.8
        ? "高负载"
        : dominantMana.ratio >= 0.5
          ? "稳定充能"
          : "低负载";

  return {
    originColor: state.base.originId?.slice(-1) ?? "C",
    landColor:
      {
        LAND_PLAINS: "W",
        LAND_ISLAND: "U",
        LAND_SWAMP: "B",
        LAND_MOUNTAIN: "R",
        LAND_FOREST: "G",
      }[state.base.landId] ?? "C",
    manaLoads,
    dominantManaColor: dominantMana.color,
    manaSaturation: dominantMana.ratio,
    manaStatus,
    productionActive: productionCount > 0,
    productionCount,
    productionLabel:
      productionCount > 0 ? `构筑队列 ${productionCount}` : "生产待命",
    expeditionActive: Boolean(expedition),
    executionWarning,
    infiltrationActive,
    expeditionLabel: expedition
      ? (EXPEDITION_PHASE_NAMES[expedition.phase] ?? "远征连接")
      : "链路待命",
    linkMode: executionWarning
      ? "critical"
      : infiltrationActive
        ? "covert"
        : expedition
          ? "open"
          : "idle",
  };
}
