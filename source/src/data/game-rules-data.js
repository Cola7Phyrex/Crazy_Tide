export const GAME_RULE_ARCHIVE = Object.freeze([
  Object.freeze({
    id: "COMBAT_SIMULTANEOUS",
    category: "战斗",
    title: "同时伤害",
    detail:
      "每回合双方先以回合开始时的状态同时计算攻击，再同时承受结果。即使一方在本回合被消灭，它已经计算出的攻击仍会生效，因此可能同归于尽。",
  }),
  Object.freeze({
    id: "COMBAT_DAMAGE",
    category: "战斗",
    title: "力量、防御与生命伤害",
    detail:
      "力量低于当前防御时，只削减等量防御；力量大于或等于当前防御时，防御归零，并造成“力量－当前防御＋1”点生命伤害。力量为0时不会造成伤害。",
  }),
  Object.freeze({
    id: "COMBAT_DEFENSE_RECOVERY",
    category: "战斗",
    title: "破防、暴露与防御恢复",
    detail:
      "有防御的单位被破防后，下一回合保持0防御并处于暴露状态；再下一回合恢复最大防御的一半（向下取整、至少1点）。最大防御为奇数时，再下一回合补回除以2产生的1点余数，最终停在向上取整的一半。",
  }),
  Object.freeze({
    id: "COMBAT_FAILURE_LIMITS",
    category: "战斗",
    title: "僵局与回合上限",
    detail:
      "连续3回合双方生命都没有变化，或战斗达到20回合仍未结束，均判定进攻方失败。",
  }),
  Object.freeze({
    id: "REPLICA_ATTRITION",
    category: "军团",
    title: "复制体不会回收",
    detail:
      "复制体是一次远征消耗品。远征结束时，无论任务胜负或复制体是否仍存活，全部复制体与已购买的军团生命都会清空；存活的原体会以0复制体的待命军团壳返回基地，需要重新补充。",
  }),
  Object.freeze({
    id: "PATROL_CHANCE",
    category: "远征",
    title: "基础巡逻遭遇率",
    detail:
      "未探明路线的第一步基础巡逻遭遇率为10%，之后每安全通过一步增加5个百分点。路线情报达到1级后永久跳过巡逻判定；教学领土首次远征使用固定教学遭遇。",
  }),
  Object.freeze({
    id: "TRAVEL_TIME",
    category: "远征",
    title: "移动步数与时间",
    detail:
      "默认每块基本地对应1个移动步，每步10秒；路线情报达到1级后每步缩短为4秒。敏捷令总步数减少1，但最低仍为1步。",
  }),
  Object.freeze({
    id: "INFILTRATION_CYCLE",
    category: "渗透",
    title: "渗透周期与有效值",
    detail:
      "渗透每10秒结算一次。有效渗透等于原体全部渗透值减去目标渗透抗性，最低为0；每次结算削减等量稳定值。稳定值在本轮归零时立即胜利，不再进行暴露判定。",
  }),
  Object.freeze({
    id: "INFILTRATION_EXPOSURE",
    category: "渗透",
    title: "基础渗透暴露率",
    detail:
      "大多数领土每个未致胜渗透周期的基础暴露率为6%；涅非利亚领土为8%。敏锐听觉－2个百分点，尸嵌暴露＋15个百分点，道德瓦解满足条件时再＋6个百分点，最终限制在0%至100%。",
  }),
  Object.freeze({
    id: "CONQUEST_DAMAGE",
    category: "征服",
    title: "坚守伤害",
    detail:
      "清除本次现场守军后，基础坚守伤害等于原体蓝图的静态力量乘军团剩余生命。战斗内临时力量通常不计入坚守；破坏之乐会按其规则翻倍并留下永久破坏标记。",
  }),
  Object.freeze({
    id: "OFFLINE_PROGRESS",
    category: "时间",
    title: "锁屏与离线推进",
    detail:
      "锁屏、切到后台或关闭页面后，重新返回时会补算资源、生产和远征时间。战斗复盘、直接暂停的处决警告，以及必须由玩家选择的明确暂停点仍会停止推进。",
  }),
]);
