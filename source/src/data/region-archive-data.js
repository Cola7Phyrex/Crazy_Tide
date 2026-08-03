export const REGION_ARCHIVE_PROFILES = Object.freeze({
  REGION_GAVONY: Object.freeze({
    consequence:
      "加渥尼三处领土全部沦陷；妖精女皇的宣战与亚空间基地坐标已经写入长期档案。",
  }),
  REGION_NEPHALIA: Object.freeze({
    consequence:
      "涅非利亚的灵俑防线被清除；尸嵌资料、渗透限制与已取得内容继续永久生效。",
  }),
  REGION_KESSIG: Object.freeze({
    consequence:
      "凯锡革的狩猎领地被清空；区域完成奖励与狼人相关内容继续永久保留。",
  }),
  REGION_STENSIA: Object.freeze({
    consequence:
      "史顿襄的吸血鬼据点全部失守；沃达连相关奖励与鬼怪保底结果继续永久保留。",
  }),
  REGION_MOORLAND: Object.freeze({
    consequence:
      "荒野省的飞行精怪防线已经消散；区域内获得的精怪内容继续永久保留。",
  }),
  REGION_THRABEN: Object.freeze({
    consequence:
      "瑟班的正规防线全部瓦解；城门、军营、教会与狱窖的结算结果已经冻结。",
  }),
});

export function getRegionArchiveProfile(regionId) {
  return REGION_ARCHIVE_PROFILES[regionId] ?? {
    consequence: "该区域的领土与永久后果已经压缩为毁灭档案。",
  };
}
