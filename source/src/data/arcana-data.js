export const ARTIFACT_CATALOG = [
  {
    id: "ARTIFACT_BIOFACTOR_EXTRACTOR",
    name: "生物因子提取器",
    englishName: "Biofactor Extractor",
    category: "核心神器",
    effect: "记录并永久解锁首次成功提取的生物因子。",
  },
  {
    id: "ARTIFACT_PROTOTYPE_EDITOR",
    name: "原体编辑器",
    englishName: "Prototype Editor",
    category: "核心神器",
    effect: "编辑、保存原体蓝图，并可重构死亡的实体原体。",
  },
  {
    id: "ARTIFACT_MIRRORWORKS",
    name: "镜映品",
    englishName: "Mirrorworks",
    category: "核心神器",
    effect: "根据原体蓝图制造复制体，并组建或补充军团。",
  },
  {
    id: "ARTIFACT_MANA_VAULT",
    name: "法术力库",
    englishName: "Mana Vault",
    category: "法术力神器",
    effect: "提供全部法术力储存容量，并可在满足条件后扩容。",
  },
  {
    id: "ARTIFACT_EXPEDITION_GATE",
    name: "远征传送门",
    englishName: "Expedition Gate",
    category: "核心神器",
    effect: "消耗500[C]开启远征通道。",
  },
  {
    id: "ARTIFACT_THRAN_DYNAMO",
    name: "索蓝发电机",
    englishName: "Thran Dynamo",
    category: "法术力神器",
    effect: "每60秒生产200[C]，不占用法术力生产位。",
  },
  {
    id: "ARTIFACT_METATHRAN_DYNAMO",
    name: "仿索蓝发电机",
    englishName: "Metathran Dynamo",
    category: "法术力设施",
    effect: "可重复建造；每座每60秒生产100[C]，运行时占用1个生产位。",
    recipeFlag: "metathranRecipeUnlocked",
  },
  {
    id: "ARTIFACT_PRISMATIC_LENS",
    name: "虹彩透镜",
    englishName: "Prismatic Lens",
    category: "法术力神器",
    effect: "每120秒消耗400[C]，转化为1点指定颜色的法术力。",
  },
  {
    id: "ARTIFACT_SKAAB_NOTEBOOK",
    name: "尸嵌笔记",
    englishName: "Skaab Notebook",
    category: "生物改造神器",
    effect: "首次获得时永久解锁改造生物因子“尸嵌化”。",
  },
  {
    id: "ARTIFACT_SPACE_ANCHOR",
    name: "空间锚点",
    englishName: "Space Anchor",
    category: "一次性神器",
    effect:
      "消耗后将基地迁移至已完全通关世界中的一处已征服领土，以该领土的基本地取代开局基本地产出；可不可逆地返回亚空间。",
  },
];

export const ENCHANTMENT_CATALOG = [
  {
    id: "ENCHANTMENT_VIRTUES_RUIN",
    name: "道德瓦解",
    englishName: "Virtue's Ruin",
    cost: "2[B]",
    timing: "渗透远征",
    effect: "存在白色守军时，每轮渗透+2，暴露率+6个百分点。",
    implementation: "可施放",
    originColors: ["B"],
  },
  {
    id: "ENCHANTMENT_TASTE_FOR_MAYHEM",
    name: "破坏之乐",
    englishName: "Taste for Mayhem",
    cost: "1[R]",
    timing: "征服远征",
    effect:
      "本次远征造成的坚守伤害翻倍；实际造成坚守伤害后留下不可消除的永久标记。领土首次沦陷时，每个标记随机减少1份可损失奖励；固定奖励不受影响，且至少保留1份可损失奖励。",
    implementation: "可施放",
    originColors: ["R"],
  },
  {
    id: "ENCHANTMENT_GROUNDED",
    name: "禁足",
    englishName: "Grounded",
    cost: "1[G]",
    timing: "本次远征",
    effect: "本次远征涉及的所有军团暂时失去飞行异能。",
    implementation: "可施放",
    originColors: ["G"],
  },
];

export const SPELL_CATALOG = [
  {
    id: "SPELL_DEMYSTIFY",
    name: "揭秘",
    englishName: "Demystify",
    cost: "1[W]",
    timing: "侦查／战斗／渗透",
    effect: "消灭敌方领土上的一个结界；没有合法目标时不可施放。",
    implementation: "合法休眠 · 当前无敌方结界目标",
    originColors: ["W"],
  },
  {
    id: "SPELL_UNSUMMON",
    name: "反召唤",
    englishName: "Unsummon",
    cost: "3[U]",
    timing: "渗透／处决警告",
    effect: "召回仍存活的原体并终止远征；全部复制体湮灭。",
    implementation: "仅限渗透任务",
    originColors: ["U"],
  },
];

export function getUnlockedArtifacts(state) {
  if (state.settings?.testMode) return [...ARTIFACT_CATALOG];
  return ARTIFACT_CATALOG.filter((item) =>
    item.recipeFlag
      ? Boolean(state.flags[item.recipeFlag])
      : state.artifacts.includes(item.id),
  );
}

export function isArcanaUnlocked(item, state) {
  if (state.settings?.testMode) return true;
  if (state.rewardProgress?.unlockedContentIds?.includes(item.id)) {
    return true;
  }
  const originColor = state.base.originId.replace("ORIGIN_", "");
  return item.originColors?.includes(originColor) ?? true;
}
