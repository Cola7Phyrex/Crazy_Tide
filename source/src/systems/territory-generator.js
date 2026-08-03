import { nextRandom } from "../core/random.js";
import {
  getComponent,
  getJob,
  getRace,
} from "../data/prototype-data.js";
import { getLand } from "../data/game-data.js";
import {
  INNISTRAD_OFFICIAL_SEED,
  LAND_COLOR_BY_ID,
  PLANNED_INNISTRAD_TERRITORIES,
  REGION_GENERATION_PROFILES,
  TERRITORY_DIFFICULTY_PROFILES,
  TERRITORY_GENERATOR_VERSION,
} from "../data/territory-generator-data.js";
import {
  createBlueprintDraft,
  deriveBlueprint,
  findFirstPlacement,
} from "./blueprints.js";

const ENEMY_BUILD_CATALOG = Object.freeze([
  {
    id: "BUILD_ZOMBIE",
    name: "无智灵俑",
    regions: ["REGION_NEPHALIA"],
    raceId: "RACE_ZOMBIE",
    raceColor: "B",
    jobId: "JOB_NONE",
    tags: ["ZOMBIE", "DURABLE"],
  },
  {
    id: "BUILD_ZOMBIE_SWORD",
    name: "持剑灵俑",
    regions: ["REGION_NEPHALIA"],
    raceId: "RACE_ZOMBIE",
    raceColor: "B",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["ZOMBIE", "DURABLE", "ARMED"],
  },
  {
    id: "BUILD_ZOMBIE_ROGUE",
    name: "装脑灵俑浪客",
    regions: ["REGION_NEPHALIA"],
    raceId: "RACE_ZOMBIE",
    raceColor: "B",
    jobId: "JOB_ROGUE",
    jobColor: "U",
    componentIds: ["MODIFICATION_BRAIN"],
    tags: ["ZOMBIE", "ROGUE"],
  },
  {
    id: "BUILD_ZOMBIE_SKAAB",
    name: "尸嵌灵俑",
    regions: ["REGION_NEPHALIA"],
    raceId: "RACE_ZOMBIE",
    raceColor: "B",
    jobId: "JOB_NONE",
    componentIds: ["MODIFICATION_SKAABIFICATION"],
    tags: ["ZOMBIE", "DURABLE", "SKAAB"],
  },
  {
    id: "BUILD_HUMAN_ROGUE_U",
    name: "海港人类浪客",
    regions: ["REGION_NEPHALIA"],
    raceId: "RACE_HUMAN",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["HUMAN", "ROGUE"],
  },
  {
    id: "BUILD_BEAST_CLAWS",
    name: "利爪野兽",
    regions: ["REGION_KESSIG"],
    raceId: "RACE_BEAST",
    raceColor: "G",
    jobId: "JOB_NONE",
    componentIds: ["MODIFICATION_CLAWS"],
    tags: ["BEAST", "RAW_POWER"],
  },
  {
    id: "BUILD_WEREWOLF",
    name: "凯锡革狼人",
    regions: ["REGION_KESSIG"],
    raceId: "RACE_WEREWOLF",
    raceColor: "R",
    jobId: "JOB_NONE",
    tags: ["WEREWOLF", "RAW_POWER"],
  },
  {
    id: "BUILD_WEREWOLF_SWORD",
    name: "持剑狼人战士",
    regions: ["REGION_KESSIG"],
    raceId: "RACE_WEREWOLF",
    raceColor: "R",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["WEREWOLF", "RAW_POWER"],
  },
  {
    id: "BUILD_HUMAN_GREATSWORD_R",
    name: "山地巨剑猎手",
    regions: ["REGION_KESSIG", "REGION_STENSIA"],
    raceId: "RACE_HUMAN",
    raceColor: "R",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_GREATSWORD"],
    tags: ["HUMAN", "RAW_POWER"],
  },
  {
    id: "BUILD_ELF_LONGBOW",
    name: "林地长弓手",
    regions: ["REGION_KESSIG", "REGION_THRABEN"],
    raceId: "RACE_ELF",
    raceColor: "G",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_RANGERS_LONGBOW"],
    tags: ["ELF", "RAW_POWER", "REACH"],
  },
  {
    id: "BUILD_VAMPIRE_SWORD",
    name: "吸血鬼剑士",
    regions: ["REGION_STENSIA"],
    raceId: "RACE_VAMPIRE",
    raceColor: "B",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["VAMPIRE", "BLOODTHIRST"],
  },
  {
    id: "BUILD_VAMPIRE_REVELER",
    name: "欢腾吸血鬼",
    regions: ["REGION_STENSIA"],
    raceId: "RACE_VAMPIRE",
    raceColor: "B",
    jobId: "JOB_NONE",
    componentIds: ["MODIFICATION_VAMPIRE_REVELER"],
    tags: ["VAMPIRE", "BLOODTHIRST", "FLYING"],
  },
  {
    id: "BUILD_VAMPIRE_RAIDER",
    name: "劫掠吸血鬼",
    regions: ["REGION_STENSIA"],
    raceId: "RACE_VAMPIRE",
    raceColor: "B",
    jobId: "JOB_NONE",
    componentIds: ["MODIFICATION_VAMPIRE_RAIDER"],
    tags: ["VAMPIRE", "BLOODTHIRST", "HASTE"],
  },
  {
    id: "BUILD_VAMPIRE_WINGED_RAIDER",
    name: "飞翼劫掠吸血鬼",
    regions: ["REGION_STENSIA"],
    raceId: "RACE_VAMPIRE",
    raceColor: "B",
    jobId: "JOB_NONE",
    componentIds: [
      "MODIFICATION_VAMPIRE_REVELER",
      "MODIFICATION_VAMPIRE_RAIDER",
    ],
    tags: ["VAMPIRE", "BLOODTHIRST", "FLYING", "HASTE"],
  },
  {
    id: "BUILD_SPIRIT",
    name: "荒野精怪",
    regions: ["REGION_MOORLAND", "REGION_THRABEN"],
    raceId: "RACE_SPIRIT",
    raceColor: "U",
    jobId: "JOB_NONE",
    tags: ["SPIRIT", "FLYING"],
  },
  {
    id: "BUILD_SPIRIT_WARRIOR",
    name: "精怪剑士",
    regions: ["REGION_MOORLAND", "REGION_THRABEN"],
    raceId: "RACE_SPIRIT",
    raceColor: "W",
    jobId: "JOB_WARRIOR",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["SPIRIT", "FLYING"],
  },
  {
    id: "BUILD_SPIRIT_ROGUE",
    name: "幽影精怪浪客",
    regions: ["REGION_MOORLAND"],
    raceId: "RACE_SPIRIT",
    raceColor: "U",
    jobId: "JOB_ROGUE",
    jobColor: "U",
    tags: ["SPIRIT", "FLYING", "ROGUE"],
  },
  {
    id: "BUILD_HUMAN_SOLDIER_SHIELD",
    name: "瑟班持盾士兵",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_HUMAN",
    raceColor: "W",
    jobId: "JOB_SOLDIER",
    jobColor: "W",
    componentIds: ["EQUIPMENT_STOUT_SHIELD"],
    tags: ["HUMAN", "SOLDIER"],
  },
  {
    id: "BUILD_HUMAN_SOLDIER_SWORD",
    name: "瑟班持剑士兵",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_HUMAN",
    raceColor: "W",
    jobId: "JOB_SOLDIER",
    jobColor: "W",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["HUMAN", "SOLDIER"],
  },
  {
    id: "BUILD_HUMAN_SOLDIER_GREATSWORD",
    name: "瑟班重装士兵",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_HUMAN",
    raceColor: "W",
    jobId: "JOB_SOLDIER",
    jobColor: "W",
    componentIds: ["EQUIPMENT_GREATSWORD"],
    tags: ["HUMAN", "SOLDIER", "GREATSWORD"],
  },
  {
    id: "BUILD_ELF_SOLDIER_LONGBOW",
    name: "瑟班妖精长弓士兵",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_ELF",
    raceColor: "G",
    jobId: "JOB_SOLDIER",
    jobColor: "W",
    componentIds: ["EQUIPMENT_RANGERS_LONGBOW"],
    tags: ["ELF", "SOLDIER", "REACH"],
  },
  {
    id: "BUILD_SPIRIT_SOLDIER",
    name: "教会精怪士兵",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_SPIRIT",
    raceColor: "W",
    jobId: "JOB_SOLDIER",
    jobColor: "W",
    componentIds: ["EQUIPMENT_STOUT_SHIELD"],
    tags: ["SPIRIT", "SOLDIER", "FLYING"],
  },
  {
    id: "BUILD_GARGOYLE",
    name: "瑟班石像鬼",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_GARGOYLE",
    raceColor: "C",
    jobId: "JOB_NONE",
    tags: ["GARGOYLE", "FLYING"],
  },
  {
    id: "BUILD_GARGOYLE_SWORD",
    name: "持剑石像鬼",
    regions: ["REGION_THRABEN"],
    raceId: "RACE_GARGOYLE",
    raceColor: "C",
    jobId: "JOB_NONE",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["GARGOYLE", "FLYING", "ARMED_GARGOYLE"],
  },
  {
    id: "BUILD_CONSTRUCT_SWORD",
    name: "组构体持剑守卫",
    regions: [],
    raceId: "RACE_CONSTRUCT",
    raceColor: "C",
    jobId: "JOB_NONE",
    componentIds: ["EQUIPMENT_BRONZE_SWORD"],
    tags: ["CONSTRUCT", "SYSTEM_FALLBACK"],
    systemFallback: true,
  },
]);

export class TerritoryGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TerritoryGenerationError";
    this.code = code;
    this.details = details;
  }
}

function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}

function createRng(seed) {
  let rngState = hashSeed(seed);
  return {
    next() {
      const roll = nextRandom(rngState);
      rngState = roll.rngState;
      return roll.value;
    },
    integer(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}

function makePlacement(draft, contentId, index) {
  const component = getComponent(contentId);
  if (!component) {
    throw new TerritoryGenerationError(
      "UNKNOWN_COMPONENT",
      "敌军构筑引用了无法识别的生物因子",
    );
  }
  const target = findFirstPlacement(draft, contentId);
  if (!target) {
    throw new TerritoryGenerationError(
      "NO_COMPONENT_SPACE",
      `${draft.name}无法安装${component.name}`,
      { draft, contentId },
    );
  }
  draft.placements.push({
    instanceId: `SYSTEM_${contentId}_${index + 1}`,
    contentId,
    ...target,
  });
}

function deriveEnemyBuild(definition) {
  const draft = createBlueprintDraft(definition.raceColor);
  draft.name = definition.name;
  draft.raceId = definition.raceId;
  draft.raceColor = definition.raceColor;
  draft.jobId = definition.jobId;
  draft.jobColor = definition.jobColor ?? null;
  for (const [index, contentId] of (definition.componentIds ?? []).entries()) {
    makePlacement(draft, contentId, index);
  }
  const blueprint = deriveBlueprint(draft);
  if (!blueprint.valid) {
    throw new TerritoryGenerationError(
      "INVALID_ENEMY_BUILD",
      `敌军构筑“${definition.name}”不合法：${blueprint.issues.join("；")}`,
      { definition, issues: blueprint.issues },
    );
  }
  return {
    ...definition,
    blueprint,
    colors: blueprint.colors.length ? blueprint.colors : ["C"],
  };
}

const DERIVED_ENEMY_BUILDS = ENEMY_BUILD_CATALOG.map(deriveEnemyBuild);

function isColorSupported(build, supportedColors) {
  return build.colors.every(
    (color) => color === "C" || supportedColors.includes(color),
  );
}

function generateLands(plan, profile, difficulty, rng) {
  const count = rng.integer(...difficulty.landCount);
  const lands = [...new Set(plan.requiredLandIds ?? [])];
  while (lands.length < count) lands.push(rng.pick(profile.preferredLandIds));
  return lands;
}

function chooseBuilds(plan, profile, supportedColors, targetCount, rng) {
  const ordinary = DERIVED_ENEMY_BUILDS.filter(
    (build) =>
      build.regions.includes(plan.regionId) &&
      isColorSupported(build, supportedColors) &&
      !profile.forbiddenRaceIds.includes(build.raceId),
  );
  const selected = [];
  for (const tag of plan.requiredBuildTags ?? []) {
    const matching = ordinary.filter((build) => build.tags.includes(tag));
    const pick = matching.find(
      (build) => !selected.some((item) => item.id === build.id),
    ) ?? matching[0];
    if (!pick) {
      throw new TerritoryGenerationError(
        "UNSATISFIED_REWARD_ENCOUNTER",
        `${plan.name}没有可展示奖励“${tag}”的合法敌军构筑`,
        { territoryId: plan.id, tag, supportedColors },
      );
    }
    if (!selected.some((build) => build.id === pick.id)) selected.push(pick);
  }
  const constrainedTags = Object.keys(plan.requiredTagInstanceRanges ?? {});
  const shuffled = ordinary.map((build) => ({
    build,
    roll: rng.next(),
  })).sort((leftEntry, rightEntry) => {
    const left = leftEntry.build;
    const right = rightEntry.build;
    const leftConstrained = constrainedTags.some((tag) => left.tags.includes(tag));
    const rightConstrained = constrainedTags.some((tag) => right.tags.includes(tag));
    if (leftConstrained !== rightConstrained) return leftConstrained ? 1 : -1;
    return leftEntry.roll - rightEntry.roll;
  }).map((entry) => entry.build);
  for (const build of shuffled) {
    if (selected.length >= targetCount) break;
    if (!selected.some((item) => item.id === build.id)) selected.push(build);
  }
  if (!selected.length) {
    const fallback = DERIVED_ENEMY_BUILDS.find(
      (build) => build.id === profile.fallbackBuildId,
    );
    if (fallback) selected.push(fallback);
  }
  if (!selected.length) {
    throw new TerritoryGenerationError(
      "NO_LEGAL_ENEMY_BUILD",
      `${plan.name}没有合法敌军构筑且无法使用系统后备守军`,
      { territoryId: plan.id, supportedColors },
    );
  }
  while (selected.length < targetCount) {
    selected.push(selected[selected.length % selected.length]);
  }
  return selected.slice(0, targetCount);
}

function allocateGuardCounts(builds, totalCount, plan, rng) {
  const counts = builds.map(() => 1);
  let remaining = Math.max(0, totalCount - counts.length);
  const soldierRange = plan.requiredTagInstanceRanges?.SOLDIER;
  if (soldierRange) {
    const soldierIndex = builds.findIndex((build) =>
      build.tags.includes("SOLDIER"),
    );
    const soldierTarget = rng.integer(...soldierRange);
    if (soldierIndex >= 0) {
      const currentSoldierCount = builds.filter((build) =>
        build.tags.includes("SOLDIER"),
      ).length;
      const added = Math.min(
        remaining,
        Math.max(0, soldierTarget - currentSoldierCount),
      );
      counts[soldierIndex] += added;
      remaining -= added;
    }
  }
  const constrainedTags = Object.keys(plan.requiredTagInstanceRanges ?? {});
  const unconstrainedIndexes = builds
    .map((build, index) => ({ build, index }))
    .filter(({ build }) =>
      !constrainedTags.some((tag) => build.tags.includes(tag)),
    )
    .map(({ index }) => index);
  const allocationIndexes = unconstrainedIndexes.length
    ? unconstrainedIndexes
    : builds.map((_, index) => index);
  while (remaining > 0) {
    const index = allocationIndexes[rng.integer(0, allocationIndexes.length - 1)];
    counts[index] += 1;
    remaining -= 1;
  }
  return counts;
}

function makeManaReward(colors, coloredMana, colorlessMana) {
  const reward = { C: colorlessMana };
  for (let index = 0; index < coloredMana; index += 1) {
    const color = colors[index % colors.length];
    reward[color] = (reward[color] ?? 0) + 1;
  }
  return reward;
}

function makeLootShares(reward) {
  return Object.entries(reward).map(([color, amount]) => ({ [color]: amount }));
}

function makeCombatTemplate(build, scaleHp, id, name, initialCount, reward) {
  return {
    templateId: id,
    id,
    name,
    power: build.blueprint.stats.power,
    defense: build.blueprint.stats.defense,
    hp: build.blueprint.stats.hp + scaleHp,
    scaleHp,
    colors: [...build.colors],
    abilities: [...build.blueprint.abilities],
    initialCount,
    firstReward: reward,
    generatedBlueprint: {
      buildId: build.id,
      raceId: build.raceId,
      jobId: build.jobId,
      componentIds: [...(build.componentIds ?? [])],
      tags: [...build.tags],
      systemFallback: Boolean(build.systemFallback),
      equivalentValue: build.blueprint.equivalentValue,
    },
  };
}

export function validateGeneratedTerritory(territory, plan = null) {
  const sourcePlan = plan ?? PLANNED_INNISTRAD_TERRITORIES.find(
    (item) => item.id === territory.id,
  );
  const profile = REGION_GENERATION_PROFILES[territory.regionId];
  const difficulty = TERRITORY_DIFFICULTY_PROFILES[
    sourcePlan?.difficultyId ??
      (territory.regionId === "REGION_THRABEN" ? "THRABEN" : "FREE_EXPLORATION")
  ];
  const issues = [];
  const supportedColors = [...new Set(territory.lands.map(
    (landId) => LAND_COLOR_BY_ID[landId],
  ).filter(Boolean))];
  if (!profile) issues.push("缺少区域生成配置");
  if (!difficulty) issues.push("缺少难度配置");
  if (difficulty && (
    territory.lands.length < difficulty.landCount[0] ||
    territory.lands.length > difficulty.landCount[1]
  )) issues.push("基本地数量超出难度预算");
  for (const landId of sourcePlan?.requiredLandIds ?? []) {
    if (!territory.lands.includes(landId)) {
      issues.push(`缺少指定基本地「${getLand(landId)?.name ?? "未知基本地"}」`);
    }
  }
  const templates = [territory.patrol, ...(territory.garrison?.templates ?? [])];
  for (const template of templates) {
    if (!template) continue;
    if (!template.colors.every(
      (color) => color === "C" || supportedColors.includes(color),
    )) issues.push(`${template.name}的颜色不受领土基本地支持`);
    const raceId = template.generatedBlueprint?.raceId;
    if (
      profile?.forbiddenRaceIds.includes(raceId) &&
      !template.generatedBlueprint?.systemFallback
    ) issues.push(`${template.name}使用了区域禁止种族「${getRace(raceId)?.name ?? "未知种族"}」`);
    if (
      territory.regionId === "REGION_MOORLAND" &&
      raceId !== "RACE_SPIRIT" &&
      !template.generatedBlueprint?.systemFallback
    ) issues.push(`${template.name}违反荒野省普通守军仅限精怪规则`);
  }
  const guardTemplates = territory.garrison?.templates ?? [];
  const allTags = new Set(guardTemplates.flatMap(
    (template) => template.generatedBlueprint?.tags ?? [],
  ));
  for (const tag of sourcePlan?.requiredBuildTags ?? []) {
    if (!allTags.has(tag)) issues.push(`守军未展示奖励相关标签${tag}`);
  }
  for (const [tag, [minimum, maximum]] of Object.entries(
    sourcePlan?.requiredTagInstanceRanges ?? {},
  )) {
    const count = guardTemplates.reduce(
      (sum, template) => sum + (
        template.generatedBlueprint?.tags.includes(tag)
          ? template.initialCount
          : 0
      ),
      0,
    );
    if (count < minimum || count > maximum) {
      issues.push(`${tag}军团数量应为${minimum}–${maximum}，实际为${count}`);
    }
  }
  if (
    territory.regionId === "REGION_NEPHALIA" &&
    territory.allowedInfiltratorRaceIds?.join(",") !== "RACE_ZOMBIE"
  ) issues.push("涅非利亚必须只允许灵俑军团渗透");
  return { valid: issues.length === 0, issues, supportedColors };
}

export function generateTerritory(plan, seed = INNISTRAD_OFFICIAL_SEED) {
  const profile = REGION_GENERATION_PROFILES[plan.regionId];
  if (!profile) {
    throw new TerritoryGenerationError(
      "UNKNOWN_REGION_PROFILE",
      `${plan.name}缺少区域生成配置`,
      { plan },
    );
  }
  const difficultyId = plan.difficultyId ??
    (plan.regionId === "REGION_THRABEN" ? "THRABEN" : "FREE_EXPLORATION");
  const difficulty = TERRITORY_DIFFICULTY_PROFILES[difficultyId];
  if (!difficulty) {
    throw new TerritoryGenerationError(
      "UNKNOWN_DIFFICULTY_PROFILE",
      `${plan.name}缺少难度生成配置`,
      { plan, difficultyId },
    );
  }
  const rng = createRng(`${seed}:${plan.id}:${TERRITORY_GENERATOR_VERSION}`);
  const lands = generateLands(plan, profile, difficulty, rng);
  const colors = [...new Set(lands.map((landId) => LAND_COLOR_BY_ID[landId]))];
  const templateCount = Math.max(
    (plan.requiredBuildTags ?? []).length,
    rng.integer(...difficulty.guardTemplateCount),
  );
  const builds = chooseBuilds(plan, profile, colors, templateCount, rng);
  const totalGuardCount = Math.max(
    templateCount,
    rng.integer(...difficulty.guardCount),
  );
  const counts = allocateGuardCounts(builds, totalGuardCount, plan, rng);
  const garrisonTemplates = builds.map((build, index) => {
    const scaleHp = rng.integer(...difficulty.guardScaleHp);
    return makeCombatTemplate(
      build,
      scaleHp,
      `GARRISON_${plan.id}_${index + 1}`,
      `${plan.shortName}守军${index + 1} · ${build.name}`,
      counts[index],
      makeManaReward(colors, 1, 250 + scaleHp * 25),
    );
  });
  const patrolBuild = builds[rng.integer(0, builds.length - 1)];
  const patrolScaleHp = rng.integer(...difficulty.patrolScaleHp);
  const patrol = makeCombatTemplate(
    patrolBuild,
    patrolScaleHp,
    `PATROL_${plan.id}`,
    `${plan.shortName}巡逻队 · ${patrolBuild.name}`,
    1,
    makeManaReward(colors, 1, 150 + patrolScaleHp * 25),
  );
  patrol.biofactorId = null;
  const conquestReward = makeManaReward(
    colors,
    difficulty.conquestColorMana,
    difficulty.conquestColorlessMana,
  );
  const maxFortitude = rng.integer(...difficulty.fortitude) +
    (profile.fortitudeBonus ?? 0);
  const maxStability = rng.integer(...difficulty.stability);
  const territory = {
    id: plan.id,
    name: plan.name,
    shortName: plan.shortName,
    aliases: [...(plan.aliases ?? [])],
    regionId: plan.regionId,
    type: plan.type,
    colors,
    primaryRace: profile.primaryRace,
    lands,
    map: { ...plan.map },
    maxFortitude,
    maxStability,
    infiltrationResistance: plan.regionId === "REGION_NEPHALIA" ? 1 : 0,
    exposureRate: plan.regionId === "REGION_NEPHALIA" ? 0.08 : 0.06,
    scoutingDifficulty: difficultyId === "HELVAULT" ? 3 :
      difficultyId === "THRABEN" || difficultyId === "VOLDAREN_ESTATE" ? 2 : 1,
    preferredIntelMetric:
      plan.regionId === "REGION_NEPHALIA" ? "fortitude" : "stability",
    allowedInfiltratorRaceIds:
      plan.regionId === "REGION_NEPHALIA" ? ["RACE_ZOMBIE"] : null,
    requiresTerritoryIds: [...(plan.requiresTerritoryIds ?? [])],
    accessConditionText: plan.accessConditionText ?? null,
    patrol,
    garrison: {
      templates: garrisonTemplates,
      reinforcedReward: { C: Math.round(difficulty.conquestColorlessMana / 5) },
    },
    conquestReward,
    conquestLootShares: makeLootShares(conquestReward),
    rewardSlots: lands.every((landId) => landId === "LAND_MOUNTAIN")
      ? [{
          id: "MOUNTAIN_LIMITED_RANDOM",
          grade: "D",
          catalogId: "INNISTRAD_LIMITED_RANDOM",
          contextTags: ["LAND_MOUNTAIN"],
        }]
      : [],
    rewardHint: plan.rewardHint,
    generator: {
      version: TERRITORY_GENERATOR_VERSION,
      seed,
      difficultyId,
      regionTendency: profile.tendency,
      buildIds: builds.map((build) => build.id),
      totalGuardCount,
    },
    description: plan.texts?.environment ??
      `${profile.name}的${plan.type}。基本地决定守军颜色，区域战斗倾向为“${profile.tendency}”。`,
    scoutingText: plan.texts?.scouting ?? null,
    conquestText: plan.texts?.conquered ?? null,
  };
  const validation = validateGeneratedTerritory(territory, plan);
  if (!validation.valid) {
    throw new TerritoryGenerationError(
      "INVALID_GENERATED_TERRITORY",
      `${plan.name}生成结果未通过验证：${validation.issues.join("；")}`,
      { plan, territory, issues: validation.issues },
    );
  }
  return territory;
}

export function generateOfficialInnistradTerritories(
  seed = INNISTRAD_OFFICIAL_SEED,
) {
  return PLANNED_INNISTRAD_TERRITORIES.map((plan) =>
    generateTerritory(plan, seed),
  );
}

export function getGeneratedTerritoryMetrics(territories) {
  return territories.map((territory) => ({
    id: territory.id,
    regionId: territory.regionId,
    lands: territory.lands.length,
    colors: [...territory.colors],
    guardTemplates: territory.garrison.templates.length,
    guardCount: territory.garrison.templates.reduce(
      (sum, template) => sum + template.initialCount,
      0,
    ),
    guardTypes: territory.garrison.templates.map(
      (template) => template.generatedBlueprint.buildId,
    ),
    fortitude: territory.maxFortitude,
    stability: territory.maxStability,
    difficultyId: territory.generator.difficultyId,
  }));
}

export function inspectEnemyBuildCatalog() {
  return DERIVED_ENEMY_BUILDS.map((build) => ({
    id: build.id,
    name: build.name,
    raceId: build.raceId,
    jobId: build.jobId,
    colors: [...build.colors],
    tags: [...build.tags],
    valid: build.blueprint.valid,
  }));
}
