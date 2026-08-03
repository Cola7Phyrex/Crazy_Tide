import {
  ABILITIES,
  BIOFACTOR_TYPES,
  getComponent,
  getJob,
  getRace,
  isContentUnlocked,
} from "../data/prototype-data.js";

const COLORED_MANA_SHADOW_VALUE = 200;
const SCALE_COST_STEP = 5;

function emptyCost() {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function addCost(target, source = {}) {
  for (const [color, amount] of Object.entries(source)) {
    target[color] = (target[color] ?? 0) + amount;
  }
}

const FIELD_LABELS = {
  form: "形态",
  material: "材质",
  artifact: "神器",
  intelligent: "智力",
  canCommunicate: "语言能力",
  professionCompatible: "职业兼容性",
};

function formatFieldValue(value) {
  if (value === true) return "有";
  if (value === false) return "无";
  if (value === undefined || value === null) return "未定义";
  return String(value);
}

function getRequirementIssues(name, fields, requirements = {}) {
  return Object.entries(requirements)
    .filter(([key, expected]) => fields[key] !== expected)
    .map(([key, expected]) => {
      const label = FIELD_LABELS[key] ?? key;
      return `${name}要求${label}为${formatFieldValue(expected)}（当前为${formatFieldValue(fields[key])}）`;
    });
}

export function createBlueprintDraft(originColor = "W") {
  return {
    name: "未命名原体",
    raceId: "RACE_HUMAN",
    raceColor: originColor,
    jobId: "JOB_NONE",
    jobColor: null,
    placements: [],
  };
}

export function createBlueprintDraftFromBlueprint(blueprint) {
  return {
    id: blueprint.id,
    blueprintId: blueprint.id,
    name: blueprint.name,
    raceId: blueprint.raceId,
    raceColor: blueprint.raceColor,
    jobId: blueprint.jobId,
    jobColor: blueprint.jobColor,
    legendary: Boolean(blueprint.legendary),
    placements: structuredClone(blueprint.placements ?? []),
  };
}

export function getPlacementSize(component, rotation = 0) {
  const turn = component.rotatable && Math.abs(rotation) % 180 === 90;
  return turn
    ? { width: component.size.height, height: component.size.width }
    : { ...component.size };
}

export function inspectGrid(draft) {
  const race = getRace(draft.raceId);
  if (!race) {
    return { valid: false, issues: ["必须选择有效种族"], cells: [] };
  }

  const baseZones = (race.baseZones ?? [
    { id: "BASE", width: race.grid.width, height: race.grid.height },
  ]).map((zone) => ({
    ...zone,
    kind: "BASE",
    cells: Array.from({ length: zone.width * zone.height }, () => null),
  }));
  const baseZoneMap = new Map(baseZones.map((zone) => [zone.id, zone]));
  const issues = [];
  const validProviders = [];

  for (const placement of draft.placements ?? []) {
    const zoneId = placement.zoneId ?? "BASE";
    const component = getComponent(placement.contentId);
    if (!component) {
      issues.push("蓝图中存在无法识别的生物因子");
      continue;
    }
    if (component.slotless) {
      if (zoneId !== "SLOTLESS") {
        issues.push(`${component.name}是不占格因子，不能安装在拓展格中`);
      }
      continue;
    }
    if (!baseZoneMap.has(zoneId)) continue;

    if (component.occupiesAllBaseZones) {
      const occupied = baseZones.some((zone) =>
        zone.cells.some((cell) => cell !== null),
      );
      if (occupied) {
        issues.push(`${component.name}要求全部基础拓展格为空`);
        continue;
      }
      for (const zone of baseZones) {
        zone.cells.fill(placement.instanceId);
      }
      validProviders.push({ placement, component });
      continue;
    }

    const baseZone = baseZoneMap.get(zoneId);
    const { width, height } = getPlacementSize(component, placement.rotation);
    let placementValid = true;
    if (
      placement.x < 0 ||
      placement.y < 0 ||
      placement.x + width > baseZone.width ||
      placement.y + height > baseZone.height
    ) {
      issues.push(`${component.name}超出拓展格`);
      continue;
    }
    for (let y = placement.y; y < placement.y + height; y += 1) {
      for (let x = placement.x; x < placement.x + width; x += 1) {
        const index = y * baseZone.width + x;
        if (baseZone.cells[index]) {
          issues.push(`${component.name}与其他因子重叠`);
          placementValid = false;
        } else {
          baseZone.cells[index] = placement.instanceId;
        }
      }
    }
    if (
      placementValid &&
      (component.id === "MODIFICATION_ARM" ||
        component.providesAuxiliaryZone)
    ) {
      validProviders.push({ placement, component });
    }
  }

  const auxiliaryZones = validProviders.map(({ placement, component }) => {
    const definition = component.providesAuxiliaryZone ?? {
      kind: "AUX_EQUIPMENT",
      width: 1,
      height: 2,
    };
    return {
      id: `AUX_${placement.instanceId}`,
      kind: definition.kind,
      sourceInstanceId: placement.instanceId,
      width: definition.width,
      height: definition.height,
      cells: Array.from(
        { length: definition.width * definition.height },
        () => null,
      ),
    };
  });
  const zoneMap = new Map(
    [...baseZones, ...auxiliaryZones].map((zone) => [zone.id, zone]),
  );

  for (const placement of draft.placements ?? []) {
    const zoneId = placement.zoneId ?? "BASE";
    if (zoneId === "SLOTLESS" || baseZoneMap.has(zoneId)) continue;
    const component = getComponent(placement.contentId);
    if (!component) continue;
    const zone = zoneMap.get(zoneId);
    if (!zone) {
      issues.push(`${component.name}所在的附加拓展区已不存在`);
      continue;
    }
    if (zone.kind === "AUX_EQUIPMENT" &&
        component.biofactorType !== BIOFACTOR_TYPES.EQUIPMENT) {
      issues.push(`${component.name}不能安装在附加装备区`);
      continue;
    }
    if (
      zone.kind === "AUX_GENERAL" &&
      (component.slotless ||
        component.id === "MODIFICATION_ARM" ||
        component.providesAuxiliaryZone)
    ) {
      issues.push(`${component.name}不能在附加通用区内继续提供拓展区`);
      continue;
    }
    const { width, height } = getPlacementSize(
      component,
      placement.rotation,
    );
    if (
      placement.x < 0 ||
      placement.y < 0 ||
      placement.x + width > zone.width ||
      placement.y + height > zone.height
    ) {
      issues.push(`${component.name}超出附加装备区`);
      continue;
    }
    for (let y = placement.y; y < placement.y + height; y += 1) {
      for (let x = placement.x; x < placement.x + width; x += 1) {
        const index = y * zone.width + x;
        if (zone.cells[index]) {
          issues.push(`${component.name}与附加装备区中的其他因子重叠`);
        } else {
          zone.cells[index] = placement.instanceId;
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    cells: baseZones[0].cells,
    zones: [...baseZones, ...auxiliaryZones],
  };
}

export function findFirstPlacement(draft, contentId, rotation = 0) {
  const race = getRace(draft.raceId);
  const component = getComponent(contentId);
  if (!race || !component) return null;
  if (component.slotless) {
    return { zoneId: "SLOTLESS", x: 0, y: 0, rotation: 0 };
  }
  const size = getPlacementSize(component, rotation);
  const grid = inspectGrid(draft);
  const baseZones = grid.zones.filter((zone) => zone.kind === "BASE");
  if (component.occupiesAllBaseZones) {
    const allEmpty = baseZones.every((zone) =>
      zone.cells.every((cell) => cell === null),
    );
    return allEmpty
      ? { zoneId: baseZones[0]?.id ?? "BASE", x: 0, y: 0, rotation: 0 }
      : null;
  }
  const auxiliaryZones = grid.zones.filter((zone) => {
    if (zone.kind === "AUX_EQUIPMENT") {
      return component.biofactorType === BIOFACTOR_TYPES.EQUIPMENT;
    }
    if (zone.kind !== "AUX_GENERAL") return false;
    return (
      component.id !== "MODIFICATION_ARM" &&
      !component.providesAuxiliaryZone
    );
  });
  const zones = [...auxiliaryZones, ...baseZones];

  for (const zone of zones) {
    for (let y = 0; y <= zone.height - size.height; y += 1) {
      for (let x = 0; x <= zone.width - size.width; x += 1) {
        let fits = true;
        for (let dy = 0; dy < size.height && fits; dy += 1) {
          for (let dx = 0; dx < size.width; dx += 1) {
            if (zone.cells[(y + dy) * zone.width + x + dx]) {
              fits = false;
              break;
            }
          }
        }
        if (fits) return { zoneId: zone.id, x, y, rotation };
      }
    }
  }
  return null;
}

export function movePlacement(
  draft,
  instanceId,
  { zoneId = "BASE", x, y, rotation },
) {
  const placement = draft.placements.find(
    (item) => item.instanceId === instanceId,
  );
  if (!placement) throw new Error("要移动的生物因子不存在");
  const component = getComponent(placement.contentId);
  if (component?.slotless) throw new Error("不占格因子无需移动");
  const candidate = structuredClone(draft);
  const moved = candidate.placements.find(
    (item) => item.instanceId === instanceId,
  );
  moved.zoneId = zoneId;
  moved.x = Number(x);
  moved.y = Number(y);
  if (rotation !== undefined) moved.rotation = rotation;
  const inspection = inspectGrid(candidate);
  if (!inspection.valid) {
    throw new Error(inspection.issues[0] ?? "目标位置不合法");
  }
  return candidate;
}

export function deriveBlueprint(draft, state = null) {
  const race = getRace(draft.raceId);
  const job = getJob(draft.jobId ?? "JOB_NONE");
  const issues = [];
  if (!race) issues.push("必须选择有效种族");
  if (!job) issues.push("职业无效");
  if (!race || !job) return { valid: false, issues };

  if (!race.availableColors.includes(draft.raceColor)) {
    issues.push(`${race.name}不能使用[${draft.raceColor}]创造`);
  }
  if (
    job.availableColors.length > 0 &&
    !job.availableColors.includes(draft.jobColor)
  ) {
    issues.push(`${job.name}必须选择合法的职业颜色`);
  }
  if (state && !isContentUnlocked(race, state)) issues.push(`${race.name}尚未解锁`);
  if (state && !isContentUnlocked(job, state)) issues.push(`${job.name}尚未解锁`);

  const stats = {
    power: race.stats.power + job.stats.power,
    defense: race.stats.defense + job.stats.defense,
    hp: race.stats.hp + job.stats.hp,
  };
  const fields = { artifact: false, ...race.fields };
  const abilities = [...race.abilities, ...job.abilities];
  const designCost = emptyCost();
  if (race.fixedColorCost) {
    addCost(designCost, race.fixedColorCost);
  } else {
    designCost[draft.raceColor] += race.colorCost;
  }
  designCost.C += race.colorlessCost ?? 0;
  designCost.C += job.colorlessCost ?? 0;
  if (job.colorCost > 0) designCost[draft.jobColor] += job.colorCost;

  const seenUnique = new Set();
  const installationCounts = new Map();
  const seenLegendaryInstanceIds = new Set();
  let equipmentCount = 0;
  let hasLegendaryFactor = false;
  for (const placement of draft.placements ?? []) {
    const component = getComponent(placement.contentId);
    if (!component) continue;
    if (state && !isContentUnlocked(component, state)) {
      issues.push(`${component.name}尚未解锁`);
    }
    if (component.unique && seenUnique.has(component.id)) {
      issues.push(`${component.name}不能重复安装`);
    }
    const installationCount = (installationCounts.get(component.id) ?? 0) + 1;
    installationCounts.set(component.id, installationCount);
    if (
      Number.isInteger(component.maxInstallations) &&
      installationCount > component.maxInstallations
    ) {
      issues.push(`${component.name}最多安装${component.maxInstallations}个`);
    }
    if (component.legendary) {
      hasLegendaryFactor = true;
      if (seenLegendaryInstanceIds.has(placement.instanceId)) {
        issues.push(`${component.name}的同一唯一实例不能重复安装`);
      }
      seenLegendaryInstanceIds.add(placement.instanceId);
      if (state) {
        const instance = state.rewardProgress?.instances?.find(
          (item) =>
            item.instanceId === placement.instanceId &&
            item.contentId === component.id,
        );
        if (!instance) {
          issues.push(`${component.name}需要对应的唯一因子实例`);
        } else if (
          instance.location !== "INVENTORY" &&
          instance.installedOnId !== draft.id &&
          instance.installedOnId !== draft.blueprintId
        ) {
          issues.push(`${component.name}的唯一实例已安装在其他原体上`);
        }
      }
    }
    if (
      component.allowedRaceIds &&
      !component.allowedRaceIds.includes(race.id)
    ) {
      issues.push(`${component.name}不能安装在${race.name}原体上`);
    }
    seenUnique.add(component.id);
    issues.push(
      ...getRequirementIssues(
        component.name,
        fields,
        component.requirements,
      ),
    );
    stats.power += component.stats.power;
    stats.defense += component.stats.defense;
    stats.hp += component.stats.hp;
    if (component.biofactorType === BIOFACTOR_TYPES.EQUIPMENT) {
      equipmentCount += 1;
    }
    addCost(designCost, component.colorCost);
    designCost.C += component.colorlessCost ?? 0;
    abilities.push(
      ...component.abilities.filter(
        (ability) =>
          !component.duplicateEffectsMeaningless ||
          !abilities.includes(ability),
      ),
    );
    Object.assign(fields, component.fieldChanges ?? {});
  }

  issues.push(...getRequirementIssues(job.name, fields, job.requirements));
  if (job.id === "JOB_WARRIOR" && equipmentCount > 0) stats.power += 1;
  if (stats.hp < 1) issues.push("最终生命必须至少为1");

  const grid = inspectGrid(draft);
  issues.push(...grid.issues);

  const colors = ["W", "U", "B", "R", "G"].filter(
    (color) => designCost[color] > 0,
  );
  const coloredCost = colors.reduce(
    (sum, color) => sum + designCost[color],
    0,
  );
  const equivalentValue =
    designCost.C + coloredCost * COLORED_MANA_SHADOW_VALUE;
  const scaleHpCost =
    Math.ceil(equivalentValue / 2 / SCALE_COST_STEP) * SCALE_COST_STEP;

  return {
    valid: issues.length === 0,
    issues,
    name: draft.name.trim() || "未命名原体",
    raceId: race.id,
    raceColor: draft.raceColor,
    jobId: job.id,
    jobColor: draft.jobColor,
    placements: structuredClone(draft.placements ?? []),
    colors,
    fields,
    abilities,
    abilityDetails: [...new Set(abilities)].map((id) => ({
      id,
      ...ABILITIES[id],
    })),
    stats,
    grid: {
      ...race.grid,
      cells: grid.cells,
      zones: structuredClone(grid.zones),
    },
    designCost,
    equivalentValue,
    scaleHpCost,
    replicasPerScaleHp: race.replicasPerScaleHp,
    scaleHpCap: race.scaleHpCap ?? 10,
    legendary: Boolean(draft.legendary || hasLegendaryFactor),
    legendaryOrigin: false,
  };
}

export function canAffordCost(resources, cost) {
  return Object.entries(cost).every(
    ([color, amount]) => (resources.amounts[color] ?? 0) >= amount,
  );
}

export function spendCost(resources, cost) {
  if (!canAffordCost(resources, cost)) {
    throw new Error("法术力不足，无法保存该蓝图");
  }
  const amounts = { ...resources.amounts };
  for (const [color, amount] of Object.entries(cost)) {
    amounts[color] -= amount;
  }
  return { ...resources, amounts };
}

export function formatCost(cost) {
  return ["W", "U", "B", "R", "G", "C"]
    .filter((color) => cost[color] > 0)
    .map((color) => `${cost[color]}[${color}]`)
    .join(" + ") || "0";
}
