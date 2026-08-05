import {
  BIOFACTOR_TYPES,
  getAbilityDefinition,
  getComponent,
  isContentUnlocked,
} from "../data/prototype-data.js";
import {
  LEGENDARY_PROTOTYPE_CATALOG,
  OLIVIA_BLUEPRINT_ID,
  OLIVIA_IDENTITY_ID,
  getLegendaryPrototypeDefinition,
} from "../data/legendary-prototype-data.js";
import { deriveBlueprint, inspectGrid } from "./blueprints.js";
import {
  canAffordGameCost,
  isTestMode,
  spendGameCost,
} from "./testing-mode.js";
import { nextRandom } from "../core/random.js";

export const LEGENDARY_CAREER_FIELDS = Object.freeze([
  "identityAge",
  "activeServiceTime",
  "expeditionTime",
  "effectiveDamage",
  "damageTakenSurvived",
  "expeditionsCompleted",
  "soloVictories",
  "commanderVictories",
  "directDamage",
  "assistedDamage",
]);

function createId(prefix, now) {
  const suffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${suffix}`.toUpperCase();
}

function emptyCost() {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function addCost(target, source = {}) {
  for (const [color, amount] of Object.entries(source)) {
    target[color] = (target[color] ?? 0) + amount;
  }
}

export function createLegendaryCareer() {
  return Object.fromEntries(LEGENDARY_CAREER_FIELDS.map((key) => [key, 0]));
}

export function createLegendaryProgress() {
  return {
    directKills: 0,
    commanderTriggers: 0,
    expeditionsCompleted: 0,
    powerGrowthUnlocked: false,
    lpGrowthUnlocked: false,
    hpGrowthUnlocked: false,
    unlockedNodeIds: [],
  };
}

export function createLegendaryIdentity(definition, now = Date.now(), progress = {}) {
  return {
    id: definition.identityId,
    blueprintId: definition.id,
    name: definition.name,
    legendaryOrigin: true,
    createdAt: now,
    updatedAt: now,
    career: createLegendaryCareer(),
    contentProgress: { ...createLegendaryProgress(), ...progress },
    intrinsicFactorHistory: [],
    entityHistory: [],
  };
}

export function normalizeLegendaryIdentity(identity, definition, now = Date.now()) {
  const career = createLegendaryCareer();
  for (const key of LEGENDARY_CAREER_FIELDS) {
    career[key] = Math.max(0, Number(identity?.career?.[key] ?? 0));
  }
  return {
    ...createLegendaryIdentity(definition, identity?.createdAt ?? now),
    ...identity,
    id: definition.identityId,
    blueprintId: definition.id,
    name: definition.name,
    career,
    contentProgress: {
      ...createLegendaryProgress(),
      ...(identity?.contentProgress ?? identity?.progress ?? {}),
      unlockedNodeIds: Array.from(new Set(
        identity?.contentProgress?.unlockedNodeIds ??
          identity?.progress?.unlockedNodeIds ??
          [],
      )),
    },
    intrinsicFactorHistory: Array.isArray(identity?.intrinsicFactorHistory)
      ? identity.intrinsicFactorHistory
      : [],
    entityHistory: Array.isArray(identity?.entityHistory)
      ? identity.entityHistory
      : [],
  };
}

export function getLegendaryPermissions(subject = {}) {
  const legendaryOrigin = Boolean(subject.legendaryOrigin);
  const legendary = legendaryOrigin || Boolean(subject.legendary);
  return {
    legendary,
    legendaryOrigin,
    canReplicate: !legendary,
    hasIdentityArchive: legendaryOrigin,
    canGrow: legendaryOrigin,
    usesLp: legendaryOrigin,
    canCommand: legendaryOrigin,
    canBePermanentlyDeleted: !legendaryOrigin,
    canBeArchived: legendaryOrigin,
  };
}

export function getLegendaryDefinitionForEntity(entity) {
  return entity
    ? getLegendaryPrototypeDefinition(entity.blueprintId)
    : undefined;
}

export function getLegendaryIdentity(state, identityId) {
  const definition = LEGENDARY_PROTOTYPE_CATALOG.find(
    (item) => item.identityId === identityId,
  );
  if (!definition) return null;
  const stored = state.legendaryIdentities?.find((item) => item.id === identityId);
  if (stored) return normalizeLegendaryIdentity(stored, definition);
  const legacyEntity = state.legendaryPrototypes?.find(
    (item) => item.identityId === identityId,
  );
  if (!legacyEntity) return null;
  return normalizeLegendaryIdentity(
    createLegendaryIdentity(
      definition,
      legacyEntity.createdAt ?? state.createdAt ?? Date.now(),
      legacyEntity.progress,
    ),
    definition,
  );
}

function upsertIdentity(state, identity) {
  return {
    ...state,
    legendaryIdentities: [
      ...(state.legendaryIdentities ?? []).filter((item) => item.id !== identity.id),
      identity,
    ],
  };
}

function ensureIdentity(state, definition, now = Date.now(), legacyProgress = {}) {
  const current = getLegendaryIdentity(state, definition.identityId);
  if (current) return { state: upsertIdentity(state, current), identity: current };
  const identity = createLegendaryIdentity(definition, now, legacyProgress);
  return { state: upsertIdentity(state, identity), identity };
}

export function isLegendaryBlueprintUnlocked(
  state,
  blueprintId = OLIVIA_BLUEPRINT_ID,
) {
  return (
    state.settings?.testMode ||
    state.rewardProgress?.unlockedContentIds?.includes(blueprintId)
  );
}

export function getLegendaryConfiguration(
  state,
  blueprintId = OLIVIA_BLUEPRINT_ID,
) {
  return (
    state.legendaryBlueprints?.find((item) => item.id === blueprintId) ?? {
      id: blueprintId,
      placements: [],
      archivedAt: null,
      unlockedAt: null,
      updatedAt: null,
    }
  );
}

function getGrowthEffects(definition, progress) {
  const effects = { power: 0, defense: 0, hp: 0, baseLp: 0, maxLp: 0 };
  const unlockedNodeIds = new Set(progress?.unlockedNodeIds ?? []);
  for (const node of definition.growth?.nodes ?? []) {
    if (unlockedNodeIds.has(node.id) || progress?.[node.metric] >= node.threshold) {
      for (const [key, value] of Object.entries(node.effects ?? {})) {
        effects[key] = (effects[key] ?? 0) + value;
      }
    }
  }
  return effects;
}

function getEntityProgress(state, entity, definition) {
  const identity = getLegendaryIdentity(state, definition.identityId);
  if (!identity) return { ...createLegendaryProgress(), ...(entity?.progress ?? {}) };
  const identityProgress = identity.contentProgress;
  const legacy = entity?.progress ?? {};
  return {
    ...identityProgress,
    directKills: Math.max(identityProgress.directKills ?? 0, legacy.directKills ?? 0),
    commanderTriggers: Math.max(
      identityProgress.commanderTriggers ?? 0,
      legacy.commanderTriggers ?? 0,
    ),
    expeditionsCompleted: Math.max(
      identityProgress.expeditionsCompleted ?? 0,
      legacy.expeditionsCompleted ?? 0,
    ),
    powerGrowthUnlocked:
      identityProgress.powerGrowthUnlocked || legacy.powerGrowthUnlocked || false,
    lpGrowthUnlocked:
      identityProgress.lpGrowthUnlocked || legacy.lpGrowthUnlocked || false,
    hpGrowthUnlocked:
      identityProgress.hpGrowthUnlocked || legacy.hpGrowthUnlocked || false,
    unlockedNodeIds: Array.from(new Set([
      ...(identityProgress.unlockedNodeIds ?? []),
      ...(legacy.unlockedNodeIds ?? []),
    ])),
  };
}

export function deriveLegendaryBlueprint(state, blueprintId, entity = null) {
  const definition = getLegendaryPrototypeDefinition(blueprintId);
  if (!definition) throw new Error("传奇原体蓝图不存在");
  const configuration = getLegendaryConfiguration(state, blueprintId);
  const intrinsicPlacements = entity?.intrinsicPlacements ?? definition.intrinsicPlacements ?? [];
  const placements = [...intrinsicPlacements, ...(configuration.placements ?? [])];
  const equipmentZoneDefinition = definition.grid.equipmentZone;
  const equipmentPlacements = equipmentZoneDefinition
    ? placements.filter((item) => item.zoneId === equipmentZoneDefinition.id)
    : [];
  const basePlacements = equipmentZoneDefinition
    ? placements.filter((item) => item.zoneId !== equipmentZoneDefinition.id)
    : placements;
  const validationDraft = {
    name: definition.name,
    raceId: definition.raceId,
    raceColor: definition.colors[0],
    jobId: definition.jobId ?? "JOB_NONE",
    jobColor: definition.jobColor ?? null,
    placements: structuredClone(basePlacements),
  };
  const normalValidation = deriveBlueprint(validationDraft);
  const issues = [...normalValidation.issues];
  if (equipmentZoneDefinition && equipmentPlacements.length > 1) {
    issues.push(`${definition.name}的独立装备格最多安装一件装备`);
  }
  for (const placement of equipmentPlacements) {
    const component = getComponent(placement.contentId);
    if (!component) {
      issues.push("蓝图中存在无法识别的生物因子");
      continue;
    }
    if (component.biofactorType !== BIOFACTOR_TYPES.EQUIPMENT) {
      issues.push(`${component.name}不能安装在${definition.name}的独立装备格`);
    }
    if (
      component.size.width !== equipmentZoneDefinition.width ||
      component.size.height !== equipmentZoneDefinition.height ||
      component.providesAuxiliaryZone
    ) {
      issues.push(
        `${component.name}必须是恰好${equipmentZoneDefinition.width}×${equipmentZoneDefinition.height}且不提供拓展区的装备`,
      );
    }
  }

  const seenUnique = new Set();
  const installationCounts = new Map();
  const seenLegendaryInstanceIds = new Set();
  const stats = { ...definition.stats };
  const abilities = [...definition.abilities];
  const factorCost = emptyCost();
  for (const placement of placements) {
    const component = getComponent(placement.contentId);
    if (!component) continue;
    if (state && !isContentUnlocked(component, state)) issues.push(`${component.name}尚未解锁`);
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
      if (seenLegendaryInstanceIds.has(placement.instanceId)) {
        issues.push(`${component.name}的同一唯一实例不能重复安装`);
      }
      seenLegendaryInstanceIds.add(placement.instanceId);
    }
    seenUnique.add(component.id);
    if (component.allowedRaceIds && !component.allowedRaceIds.includes(definition.raceId)) {
      issues.push(`${component.name}不能安装在${definition.name}上`);
    }
    stats.power += component.stats.power;
    stats.defense += component.stats.defense;
    stats.hp += component.stats.hp;
    abilities.push(
      ...component.abilities.filter(
        (ability) =>
          !component.duplicateEffectsMeaningless ||
          !abilities.includes(ability),
      ),
    );
    addCost(factorCost, component.colorCost);
    factorCost.C += component.colorlessCost ?? 0;
  }
  const progress = getEntityProgress(state, entity, definition);
  const growth = getGrowthEffects(definition, progress);
  stats.power += growth.power;
  stats.defense += growth.defense;
  stats.hp += growth.hp;

  const grid = inspectGrid(validationDraft);
  const equipmentZone = equipmentZoneDefinition
    ? {
        ...equipmentZoneDefinition,
        kind: "LEGENDARY_EQUIPMENT",
        cells: [equipmentPlacements[0]?.instanceId ?? null],
      }
    : null;
  return {
    ...definition,
    valid: issues.length === 0,
    issues,
    placements: structuredClone(placements),
    configurablePlacements: structuredClone(configuration.placements ?? []),
    stats,
    abilities: [...new Set(abilities)],
    abilityDetails: [...new Set(abilities)].map((id) => ({
      id,
      ...getAbilityDefinition(id),
    })),
    baseLp: definition.lp.base + growth.baseLp,
    maxLp: definition.lp.max + growth.maxLp,
    factorCost,
    archived: Boolean(configuration.archivedAt),
    grid: {
      width: definition.grid.width,
      height: definition.grid.height,
      cells: grid.cells,
      zones: [...grid.zones, ...(equipmentZone ? [equipmentZone] : [])],
    },
  };
}

export function deriveOliviaBlueprint(state, entity = null) {
  return deriveLegendaryBlueprint(state, OLIVIA_BLUEPRINT_ID, entity);
}

export function instantiateLegendary(state, blueprintId, now = Date.now()) {
  const definition = getLegendaryPrototypeDefinition(blueprintId);
  if (!definition || !isLegendaryBlueprintUnlocked(state, blueprintId)) {
    throw new Error("尚未获得该传奇原体蓝图");
  }
  const configuration = getLegendaryConfiguration(state, blueprintId);
  if (configuration.archivedAt) throw new Error("请先解除该传奇蓝图的封存");
  if (state.legendaryPrototypes?.some((item) => item.identityId === definition.identityId)) {
    throw new Error(`${definition.name}当前已经拥有实体`);
  }
  if (
    state.prototypes.length + (state.legendaryPrototypes?.length ?? 0) >=
    state.base.prototypeCap
  ) {
    throw new Error("实体原体槽已满");
  }
  const blueprintState = state.legendaryBlueprints?.some(
    (item) => item.id === blueprintId,
  )
    ? state
    : {
        ...state,
        legendaryBlueprints: [
          ...(state.legendaryBlueprints ?? []),
          {
            ...configuration,
            id: blueprintId,
            unlockedAt: now,
          },
        ],
      };
  let ensured = ensureIdentity(blueprintState, definition, now);
  const blueprint = deriveLegendaryBlueprint(ensured.state, blueprintId);
  if (!blueprint.valid) throw new Error(blueprint.issues[0]);
  const cost = { C: definition.equivalentValue };
  if (!canAffordGameCost(ensured.state, cost)) {
    throw new Error(`实体化${definition.name}需要${definition.equivalentValue}[C]`);
  }
  const progress = ensured.identity.contentProgress;
  const entity = {
    id: createId("LEGENDARY_PROTOTYPE", now),
    identityId: definition.identityId,
    blueprintId,
    name: definition.name,
    status: "READY",
    currentHp: blueprint.stats.hp,
    maxHp: blueprint.stats.hp,
    currentLp: blueprint.baseLp,
    lastLpRestAt: now,
    progress: structuredClone(progress),
    intrinsicPlacements: structuredClone(definition.intrinsicPlacements ?? []),
    createdAt: now,
    rebuildCount: ensured.identity.entityHistory.length,
  };
  const identity = {
    ...ensured.identity,
    updatedAt: now,
    entityHistory: [
      ...ensured.identity.entityHistory,
      { entityId: entity.id, createdAt: now, endedAt: null, endReason: null },
    ],
  };
  ensured = { state: upsertIdentity(ensured.state, identity), identity };
  return {
    state: {
      ...ensured.state,
      resources: spendGameCost(ensured.state, cost),
      legendaryPrototypes: [...(ensured.state.legendaryPrototypes ?? []), entity],
    },
    entity,
    identity,
    cost,
  };
}

export function instantiateOlivia(state, now = Date.now()) {
  return instantiateLegendary(state, OLIVIA_BLUEPRINT_ID, now);
}

export function rebuildLegendary(state, entityId, now = Date.now()) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) throw new Error("传奇原体不存在");
  if (entity.status !== "DEAD") throw new Error("只有死亡的传奇原体可以重构");
  const definition = getLegendaryDefinitionForEntity(entity);
  if (!definition) throw new Error("传奇原体蓝图不存在");
  const ensured = ensureIdentity(state, definition, now, entity.progress);
  const resetEntity = {
    ...entity,
    intrinsicPlacements: structuredClone(definition.intrinsicPlacements ?? []),
  };
  const blueprint = deriveLegendaryBlueprint(ensured.state, definition.id, resetEntity);
  const cost = { C: definition.equivalentValue };
  if (!canAffordGameCost(ensured.state, cost)) {
    throw new Error(`重构${definition.name}需要${definition.equivalentValue}[C]`);
  }
  const rebuilt = {
    ...resetEntity,
    id: createId("LEGENDARY_PROTOTYPE", now),
    status: "READY",
    injuryExpeditionsRemaining: 0,
    currentHp: blueprint.stats.hp,
    maxHp: blueprint.stats.hp,
    currentLp: blueprint.baseLp,
    lastLpRestAt: now,
    progress: structuredClone(ensured.identity.contentProgress),
    rebuiltAt: now,
    rebuildCount: (entity.rebuildCount ?? 0) + 1,
  };
  const identity = {
    ...ensured.identity,
    updatedAt: now,
    entityHistory: [
      ...ensured.identity.entityHistory.map((record) =>
        record.entityId === entity.id && record.endedAt === null
          ? { ...record, endedAt: now, endReason: "REBUILT_AFTER_DEATH" }
          : record,
      ),
      {
        entityId: rebuilt.id,
        createdAt: now,
        endedAt: null,
        endReason: null,
      },
    ],
  };
  const identityState = upsertIdentity(ensured.state, identity);
  return {
    state: {
      ...identityState,
      resources: spendGameCost(identityState, cost),
      legendaryPrototypes: identityState.legendaryPrototypes.map((item) =>
        item.id === entityId ? rebuilt : item,
      ),
    },
    entity: rebuilt,
    identity,
    cost,
  };
}

export function rebuildOlivia(state, entityId, now = Date.now()) {
  return rebuildLegendary(state, entityId, now);
}

export function returnLegendaryIndependentFactors(state, placements = []) {
  const ids = new Set(
    placements
      .filter((placement) => getComponent(placement.contentId)?.legendary)
      .map((placement) => placement.instanceId),
  );
  if (!ids.size) return state;
  return {
    ...state,
    rewardProgress: {
      ...state.rewardProgress,
      instances: (state.rewardProgress?.instances ?? []).map((instance) =>
        ids.has(instance.instanceId)
          ? { ...instance, location: "INVENTORY", installedOnId: null }
          : instance,
      ),
    },
  };
}

export function destroyLegendaryEntity(state, entityId, now = Date.now()) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) throw new Error("传奇原体不存在");
  if (["DEPLOYED", "COMMANDING"].includes(entity.status)) {
    throw new Error("远征中的传奇原体不能销毁");
  }
  const definition = getLegendaryDefinitionForEntity(entity);
  const configuration = getLegendaryConfiguration(state, entity.blueprintId);
  const independentIds = new Set(
    configuration.placements
      .filter((placement) => getComponent(placement.contentId)?.legendary)
      .map((placement) => placement.instanceId),
  );
  let nextState = returnLegendaryIndependentFactors(
    state,
    configuration.placements,
  );
  if (independentIds.size) {
    nextState = {
      ...nextState,
      legendaryBlueprints: (nextState.legendaryBlueprints ?? []).map((item) =>
        item.id === entity.blueprintId
          ? {
              ...item,
              placements: item.placements.filter(
                (placement) => !independentIds.has(placement.instanceId),
              ),
              updatedAt: now,
            }
          : item,
      ),
    };
  }
  const identity = getLegendaryIdentity(nextState, entity.identityId);
  if (identity) {
    nextState = upsertIdentity(nextState, {
      ...identity,
      updatedAt: now,
      entityHistory: identity.entityHistory.map((record) =>
        record.entityId === entity.id && record.endedAt === null
          ? { ...record, endedAt: now, endReason: "DESTROYED" }
          : record,
      ),
    });
  }
  return {
    state: {
      ...nextState,
      legendaryPrototypes: nextState.legendaryPrototypes.filter(
        (item) => item.id !== entityId,
      ),
    },
    entity,
    definition,
  };
}

export function archiveLegendaryBlueprint(state, blueprintId, now = Date.now()) {
  const definition = getLegendaryPrototypeDefinition(blueprintId);
  if (!definition || !isLegendaryBlueprintUnlocked(state, blueprintId)) {
    throw new Error("传奇原体蓝图不存在");
  }
  if (state.legendaryPrototypes?.some((item) => item.blueprintId === blueprintId)) {
    throw new Error("封存前必须先销毁当前传奇原体实体");
  }
  const current = getLegendaryConfiguration(state, blueprintId);
  const nextState = returnLegendaryIndependentFactors(state, current.placements);
  const configuration = {
    ...current,
    id: blueprintId,
    placements: current.placements.filter(
      (placement) => !getComponent(placement.contentId)?.legendary,
    ),
    archivedAt: now,
    updatedAt: now,
  };
  return {
    state: {
      ...nextState,
      legendaryBlueprints: [
        ...(nextState.legendaryBlueprints ?? []).filter((item) => item.id !== blueprintId),
        configuration,
      ],
    },
    configuration,
  };
}

export function restoreLegendaryBlueprint(state, blueprintId, now = Date.now()) {
  const current = getLegendaryConfiguration(state, blueprintId);
  if (!current.archivedAt) throw new Error("该传奇蓝图当前没有封存");
  const configuration = { ...current, archivedAt: null, updatedAt: now };
  return {
    state: {
      ...state,
      legendaryBlueprints: [
        ...(state.legendaryBlueprints ?? []).filter((item) => item.id !== blueprintId),
        configuration,
      ],
    },
    configuration,
  };
}

export function destroyIntrinsicLegendaryFactor(state, entityId, instanceId, now = Date.now()) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) throw new Error("传奇原体不存在");
  if (entity.status !== "READY") throw new Error("只有基地待命实体可以调整固有因子");
  const placement = (entity.intrinsicPlacements ?? []).find(
    (item) => item.instanceId === instanceId,
  );
  if (!placement) throw new Error("固有传奇因子不存在");
  const identity = getLegendaryIdentity(state, entity.identityId);
  const nextIdentity = identity
    ? {
        ...identity,
        updatedAt: now,
        intrinsicFactorHistory: [
          ...identity.intrinsicFactorHistory,
          { instanceId, contentId: placement.contentId, destroyedAt: now, entityId },
        ],
      }
    : null;
  const nextEntity = {
    ...entity,
    intrinsicPlacements: entity.intrinsicPlacements.filter(
      (item) => item.instanceId !== instanceId,
    ),
  };
  let nextState = nextIdentity ? upsertIdentity(state, nextIdentity) : state;
  return {
    ...nextState,
    legendaryPrototypes: nextState.legendaryPrototypes.map((item) =>
      item.id === entityId ? nextEntity : item,
    ),
  };
}

export function recordLegendaryEntityEnd(
  state,
  entityId,
  reason,
  now = Date.now(),
) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) return state;
  const definition = getLegendaryDefinitionForEntity(entity);
  if (!definition) return state;
  const ensured = ensureIdentity(state, definition, now, entity.progress);
  return upsertIdentity(ensured.state, {
    ...ensured.identity,
    updatedAt: now,
    entityHistory: ensured.identity.entityHistory.map((record) =>
      record.entityId === entityId && record.endedAt === null
        ? { ...record, endedAt: now, endReason: reason }
        : record,
    ),
  });
}

export function resolveLegendaryCommanderWipe(
  state,
  entityId,
  now = Date.now(),
) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) throw new Error("传奇指挥官不存在");
  const roll = nextRandom(state.rngState);
  const outcome =
    roll.value < 1 / 3
      ? "ESCAPED"
      : roll.value < 2 / 3
        ? "INJURED"
        : "DEAD";
  let nextState = { ...state, rngState: roll.rngState };
  if (outcome === "DEAD") {
    const configuration = getLegendaryConfiguration(nextState, entity.blueprintId);
    const independentIds = new Set(
      configuration.placements
        .filter((placement) => getComponent(placement.contentId)?.legendary)
        .map((placement) => placement.instanceId),
    );
    nextState = returnLegendaryIndependentFactors(
      nextState,
      configuration.placements,
    );
    nextState = {
      ...nextState,
      legendaryBlueprints: (nextState.legendaryBlueprints ?? []).map((item) =>
        item.id === entity.blueprintId
          ? {
              ...item,
              placements: item.placements.filter(
                (placement) => !independentIds.has(placement.instanceId),
              ),
              updatedAt: now,
            }
          : item,
      ),
    };
    nextState = recordLegendaryEntityEnd(
      nextState,
      entityId,
      "COMMANDER_WIPE_DEATH",
      now,
    );
  }
  return {
    state: {
      ...nextState,
      legendaryPrototypes: nextState.legendaryPrototypes.map((item) =>
        item.id === entityId
          ? {
              ...item,
              status:
                outcome === "DEAD"
                  ? "DEAD"
                  : outcome === "INJURED"
                    ? "INJURED"
                    : "READY",
              currentHp: outcome === "DEAD" ? 0 : item.maxHp,
              injuryExpeditionsRemaining: outcome === "INJURED" ? 1 : 0,
            }
          : item,
      ),
    },
    outcome,
    roll: roll.value,
  };
}

export function recoverLegendaryInjuriesAfterExpedition(
  state,
  excludedEntityIds = [],
) {
  const excluded = new Set(excludedEntityIds.filter(Boolean));
  return {
    ...state,
    legendaryPrototypes: (state.legendaryPrototypes ?? []).map((entity) => {
      if (entity.status !== "INJURED" || excluded.has(entity.id)) return entity;
      const remaining = Math.max(
        0,
        (entity.injuryExpeditionsRemaining ?? 1) - 1,
      );
      return {
        ...entity,
        injuryExpeditionsRemaining: remaining,
        status: remaining === 0 ? "READY" : "INJURED",
      };
    }),
  };
}

export function updateLegendaryPlacements(state, blueprintId, placements, now = Date.now()) {
  const definition = getLegendaryPrototypeDefinition(blueprintId);
  if (!definition) throw new Error("传奇原体蓝图不存在");
  const existing = getLegendaryConfiguration(state, blueprintId);
  if (existing.archivedAt) throw new Error("封存中的传奇蓝图不能编辑");
  const candidateState = {
    ...state,
    legendaryBlueprints: [
      ...(state.legendaryBlueprints ?? []).filter((item) => item.id !== blueprintId),
      { ...existing, id: blueprintId, placements },
    ],
  };
  const entity = state.legendaryPrototypes?.find(
    (item) => item.identityId === definition.identityId,
  );
  if (entity && entity.status !== "READY") {
    throw new Error(`${definition.name}出征或死亡时不能调整蓝图`);
  }
  for (const placement of placements) {
    const component = getComponent(placement.contentId);
    if (!component?.legendary) continue;
    const instance = state.rewardProgress?.instances?.find(
      (item) =>
        item.instanceId === placement.instanceId &&
        item.contentId === placement.contentId,
    );
    if (!instance) throw new Error(`${component.name}需要对应的唯一因子实例`);
    if (
      instance.location !== "INVENTORY" &&
      instance.installedOnId !== blueprintId
    ) {
      throw new Error(`${component.name}的唯一实例已安装在其他原体上`);
    }
  }
  const blueprint = deriveLegendaryBlueprint(candidateState, blueprintId, entity);
  if (!blueprint.valid) throw new Error(blueprint.issues[0]);
  if (!canAffordGameCost(state, blueprint.factorCost)) {
    throw new Error(`法术力不足，无法保存${definition.name}蓝图修改`);
  }
  const updatedEntity = entity
    ? { ...entity, maxHp: blueprint.stats.hp, currentHp: blueprint.stats.hp, updatedAt: now }
    : null;
  const previousIndependentIds = new Set(
    existing.placements
      .filter((placement) => getComponent(placement.contentId)?.legendary)
      .map((placement) => placement.instanceId),
  );
  const nextIndependentIds = new Set(
    placements
      .filter((placement) => getComponent(placement.contentId)?.legendary)
      .map((placement) => placement.instanceId),
  );
  return {
    state: {
      ...candidateState,
      resources: spendGameCost(state, blueprint.factorCost),
      legendaryBlueprints: candidateState.legendaryBlueprints.map((item) =>
        item.id === blueprintId ? { ...item, updatedAt: now } : item,
      ),
      legendaryPrototypes: (state.legendaryPrototypes ?? []).map((item) =>
        item.id === entity?.id ? updatedEntity : item,
      ),
      rewardProgress: {
        ...state.rewardProgress,
        instances: (state.rewardProgress?.instances ?? []).map((instance) => {
          if (nextIndependentIds.has(instance.instanceId)) {
            return {
              ...instance,
              location: "INSTALLED",
              installedOnType: "LEGENDARY_BLUEPRINT",
              installedOnId: blueprintId,
            };
          }
          if (previousIndependentIds.has(instance.instanceId)) {
            return {
              ...instance,
              location: "INVENTORY",
              installedOnType: null,
              installedOnId: null,
            };
          }
          return instance;
        }),
      },
    },
    blueprint,
    entity: updatedEntity,
  };
}

export function updateOliviaPlacements(state, placements, now = Date.now()) {
  return updateLegendaryPlacements(state, OLIVIA_BLUEPRINT_ID, placements, now);
}

export function recordLegendaryCareer(state, entityId, delta = {}, now = Date.now()) {
  if (isTestMode(state)) return state;
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) return state;
  const definition = getLegendaryDefinitionForEntity(entity);
  if (!definition) return state;
  const ensured = ensureIdentity(state, definition, now, entity.progress);
  const career = { ...ensured.identity.career };
  career.identityAge = Math.max(
    career.identityAge,
    Math.max(0, now - ensured.identity.createdAt),
  );
  for (const key of LEGENDARY_CAREER_FIELDS) {
    if (key === "identityAge") continue;
    career[key] = Math.max(0, career[key] + Number(delta[key] ?? 0));
  }
  return upsertIdentity(ensured.state, {
    ...ensured.identity,
    updatedAt: now,
    career,
  });
}

function updateLegendaryProgress(state, entityId, updater, now = Date.now()) {
  const entity = state.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) return state;
  const definition = getLegendaryDefinitionForEntity(entity);
  if (!definition) return state;
  const ensured = ensureIdentity(state, definition, now, entity.progress);
  const progress = getEntityProgress(ensured.state, entity, definition);
  const updatedProgress = updater({ ...progress });
  const unlockedNodeIds = new Set(updatedProgress.unlockedNodeIds ?? []);
  for (const node of definition.growth?.nodes ?? []) {
    if ((updatedProgress[node.metric] ?? 0) >= node.threshold) unlockedNodeIds.add(node.id);
  }
  updatedProgress.unlockedNodeIds = [...unlockedNodeIds];
  updatedProgress.powerGrowthUnlocked = unlockedNodeIds.has("OLIVIA_POWER_I");
  updatedProgress.lpGrowthUnlocked = unlockedNodeIds.has("OLIVIA_LP_I");
  updatedProgress.hpGrowthUnlocked = unlockedNodeIds.has("OLIVIA_HP_I");
  let nextState = upsertIdentity(ensured.state, {
    ...ensured.identity,
    updatedAt: now,
    contentProgress: updatedProgress,
  });
  nextState = {
    ...nextState,
    legendaryPrototypes: nextState.legendaryPrototypes.map((item) =>
      item.id === entityId ? { ...item, progress: structuredClone(updatedProgress) } : item,
    ),
  };
  return nextState;
}

export function recordOliviaDirectKill(state, entityId, canGainLp = true) {
  let nextState = recordLegendaryGrowthMetric(
    state,
    entityId,
    "directKills",
  );
  if (!canGainLp) return nextState;
  const entity = nextState.legendaryPrototypes?.find((item) => item.id === entityId);
  if (!entity) return nextState;
  const blueprint = deriveLegendaryBlueprint(nextState, entity.blueprintId, entity);
  return {
    ...nextState,
    legendaryPrototypes: nextState.legendaryPrototypes.map((item) =>
      item.id === entityId
        ? { ...item, currentLp: Math.min(blueprint.maxLp, item.currentLp + 1) }
        : item,
    ),
  };
}

export function recordOliviaCommanderTrigger(state, entityId) {
  return recordLegendaryGrowthMetric(
    state,
    entityId,
    "commanderTriggers",
  );
}

export function recordOliviaExpeditionCompletion(state, entityId) {
  return recordLegendaryGrowthMetric(
    state,
    entityId,
    "expeditionsCompleted",
  );
}

export function recordLegendaryGrowthMetric(
  state,
  entityId,
  metric,
  amount = 1,
) {
  return updateLegendaryProgress(state, entityId, (progress) => {
    if (!isTestMode(state)) {
      const entity = state.legendaryPrototypes?.find(
        (item) => item.id === entityId,
      );
      const definition = getLegendaryDefinitionForEntity(entity);
      const threshold = Math.max(
        0,
        ...((definition?.growth?.nodes ?? [])
          .filter((node) => node.metric === metric)
          .map((node) => node.threshold)),
      );
      const cap = threshold || Number.MAX_SAFE_INTEGER;
      progress[metric] = Math.min(
        cap,
        Math.max(0, Number(progress[metric] ?? 0) + Number(amount ?? 0)),
      );
    }
    return progress;
  });
}

export function settleLegendaryRest(state, now = Date.now()) {
  let changed = false;
  const legendaryPrototypes = (state.legendaryPrototypes ?? []).map((entity) => {
    if (
      entity.status !== "READY" ||
      state.activeExpedition?.legendaryPrototypeId === entity.id ||
      state.activeExpedition?.commanderLegendaryPrototypeId === entity.id
    ) {
      return entity;
    }
    const blueprint = deriveLegendaryBlueprint(state, entity.blueprintId, entity);
    const currentLp = Math.min(entity.currentLp, blueprint.maxLp);
    if (currentLp >= blueprint.maxLp) {
      if (currentLp === entity.currentLp) return entity;
      changed = true;
      return { ...entity, currentLp, lastLpRestAt: now };
    }
    const elapsed = Math.max(0, now - (entity.lastLpRestAt ?? now));
    const cycles = Math.floor(elapsed / blueprint.lp.restIntervalMs);
    if (cycles < 1) return entity;
    changed = true;
    return {
      ...entity,
      currentLp: Math.min(blueprint.maxLp, currentLp + cycles),
      lastLpRestAt:
        currentLp + cycles >= blueprint.maxLp
          ? now
          : (entity.lastLpRestAt ?? now) + cycles * blueprint.lp.restIntervalMs,
    };
  });
  return changed ? { ...state, legendaryPrototypes } : state;
}
