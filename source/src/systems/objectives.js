import { METATHRAN_FACILITY_TYPE } from "../data/artifact-data.js";

export const GUIDE_OBJECTIVES = Object.freeze([
  {
    id: "FIRST_PROTOTYPE",
    text: "完成第一具原体的设计与实体化",
    isComplete: (state) =>
      Boolean(
        state.flags?.guideFirstPrototypeCompleted ||
        state.prototypes?.length ||
        state.legendaryPrototypes?.length,
      ),
  },
  {
    id: "LISTEN_REGION",
    text: "在区域地图中聆听一次当地信号",
    isComplete: (state) => Boolean(state.flags?.guideRegionListened),
  },
  {
    id: "FORM_LEGION",
    text: "使用镜映品，将一具原体扩展为军团",
    isComplete: (state) =>
      Boolean(state.flags?.guideFirstLegionCompleted || state.legions?.length),
  },
  {
    id: "FIRST_TERRITORY",
    text: "通过征服或渗透，使一处领土沦陷",
    isComplete: (state) =>
      Boolean(state.worldMap?.completedTerritoryIds?.length),
  },
  {
    id: "DESTROY_GAVONY",
    text: "完全毁灭加渥尼区域",
    isComplete: (state) =>
      Boolean(state.worldMap?.completedNodeIds?.includes("REGION_GAVONY")),
  },
  {
    id: "REINFORCE_LEGION",
    text: "补充一支军团的复制体数量",
    isComplete: (state) => Boolean(state.flags?.guideLegionReinforced),
  },
  {
    id: "BUILD_METATHRAN",
    text: "在神器页面建造仿索蓝发电机",
    isUnlocked: (state) => Boolean(state.flags?.metathranRecipeUnlocked),
    isComplete: (state) =>
      Boolean(
        state.manaFacilities?.some(
          (facility) => facility.type === METATHRAN_FACILITY_TYPE,
        ),
      ),
  },
  {
    id: "CHANGE_THEME",
    text: "在右上角的设置中更改页面配色",
    isComplete: (state) => Boolean(state.flags?.guideThemeChanged),
  },
]);

export function getActiveGuideObjectives(state, limit = 2) {
  if (!state) return [];
  return GUIDE_OBJECTIVES.filter(
    (objective) =>
      (objective.isUnlocked?.(state) ?? true) &&
      !objective.isComplete(state),
  ).slice(0, limit);
}

export function areAllGuideObjectivesComplete(state) {
  return GUIDE_OBJECTIVES.every((objective) => objective.isComplete(state));
}
