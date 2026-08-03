import { nextRandom } from "../core/random.js";
import {
  REWARD_CONTENT_TYPES,
  REWARD_DELIVERY_TYPES,
  REWARD_GRADES,
} from "../data/reward-data.js";
import { applyCareerDelta } from "./career.js";
import { getLegendaryPrototypeDefinition } from "../data/legendary-prototype-data.js";
import { createLegendaryIdentity } from "./legendary-prototypes.js";

const VALID_GRADES = new Set(Object.values(REWARD_GRADES));
const VALID_DELIVERY_TYPES = new Set(
  Object.values(REWARD_DELIVERY_TYPES),
);
const VALID_CONTENT_TYPES = new Set(Object.values(REWARD_CONTENT_TYPES));
const RESOURCE_COLORS = ["W", "U", "B", "R", "G", "C"];

export function createRewardProgressState() {
  return {
    ledger: [],
    resolutions: {},
    instances: [],
    unlockedContentIds: [],
  };
}

export function normalizeRewardProgress(progress = {}) {
  return {
    ledger: Array.isArray(progress.ledger) ? progress.ledger : [],
    resolutions:
      progress.resolutions &&
      typeof progress.resolutions === "object" &&
      !Array.isArray(progress.resolutions)
        ? progress.resolutions
        : {},
    instances: Array.isArray(progress.instances) ? progress.instances : [],
    unlockedContentIds: Array.isArray(progress.unlockedContentIds)
      ? progress.unlockedContentIds
      : [],
  };
}

export function validateRewardDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    return { valid: false, error: "奖励定义不是对象" };
  }
  if (typeof definition.id !== "string" || !definition.id.startsWith("REWARD_")) {
    return { valid: false, error: "奖励配置缺少稳定标识" };
  }
  if (!VALID_GRADES.has(definition.grade)) {
    return { valid: false, error: "奖励配置的等级无效" };
  }
  if (!VALID_DELIVERY_TYPES.has(definition.deliveryType)) {
    return { valid: false, error: "奖励配置的交付形态无效" };
  }
  if (!VALID_CONTENT_TYPES.has(definition.contentType)) {
    return { valid: false, error: "奖励配置的内容类型无效" };
  }
  if (
    definition.deliveryType === REWARD_DELIVERY_TYPES.RESOURCE &&
    (!definition.resources || typeof definition.resources !== "object")
  ) {
    return { valid: false, error: "A类奖励配置缺少资源包" };
  }
  if (
    definition.deliveryType !== REWARD_DELIVERY_TYPES.RESOURCE &&
    typeof definition.contentId !== "string"
  ) {
    return { valid: false, error: "奖励配置缺少内容标识" };
  }
  if (
    definition.grade === REWARD_GRADES.LIMITED_RANDOM &&
    (definition.requiredTags?.length ?? 0) === 0 &&
    (definition.anyTags?.length ?? 0) === 0
  ) {
    return { valid: false, error: "D类奖励配置缺少限定标签" };
  }
  if (
    definition.drawWeight !== undefined &&
    (!Number.isFinite(definition.drawWeight) || definition.drawWeight <= 0)
  ) {
    return { valid: false, error: "奖励配置的抽取权重无效" };
  }
  return { valid: true, error: null };
}

function assertRewardDefinition(definition) {
  const validation = validateRewardDefinition(definition);
  if (!validation.valid) throw new Error(validation.error);
}

function ownsRewardContent(state, definition) {
  if (!definition.unique || !definition.contentId) return false;
  if (
    definition.contentType === REWARD_CONTENT_TYPES.BIOFACTOR &&
    state.unlockedBiofactors?.includes(definition.contentId)
  ) {
    return true;
  }
  if (
    definition.contentType === REWARD_CONTENT_TYPES.ARTIFACT &&
    state.artifacts?.includes(definition.contentId)
  ) {
    return true;
  }
  return normalizeRewardProgress(state.rewardProgress).unlockedContentIds.includes(
    definition.contentId,
  );
}

function matchesLimitedTags(definition, contextTags) {
  const tags = new Set(contextTags);
  const requiredTags = definition.requiredTags ?? [];
  const anyTags = definition.anyTags ?? [];
  const excludedTags = definition.excludedTags ?? [];
  return (
    requiredTags.every((tag) => tags.has(tag)) &&
    (anyTags.length === 0 || anyTags.some((tag) => tags.has(tag))) &&
    excludedTags.every((tag) => !tags.has(tag))
  );
}

export function getEligibleRewardCandidates(
  state,
  candidates,
  { grade, contextTags = [] } = {},
) {
  if (!VALID_GRADES.has(grade)) throw new Error("奖励池等级无效");
  return candidates.filter((definition) => {
    const validation = validateRewardDefinition(definition);
    if (!validation.valid || definition.grade !== grade) return false;
    if (ownsRewardContent(state, definition)) return false;
    if (
      grade === REWARD_GRADES.LIMITED_RANDOM &&
      !matchesLimitedTags(definition, contextTags)
    ) {
      return false;
    }
    return true;
  });
}

function grantResources(state, definition) {
  const amounts = { ...state.resources.amounts };
  for (const color of RESOURCE_COLORS) {
    const value = Number(definition.resources?.[color] ?? 0);
    if (value <= 0) continue;
    const cap = state.resources.caps[color];
    const allowOverflow =
      definition.allowColoredOverflow === true && color !== "C";
    amounts[color] = allowOverflow
      ? amounts[color] + value
      : Math.min(cap, amounts[color] + value);
  }
  return {
    ...state,
    resources: { ...state.resources, amounts },
  };
}

function createInstanceId(definition, resolutionKey, now, instanceIndex) {
  const stablePart = String(resolutionKey ?? definition.id)
    .replace(/[^A-Z0-9_]/gi, "_")
    .toUpperCase();
  return `REWARD_INSTANCE_${stablePart}_${now}_${instanceIndex + 1}`;
}

function deliverReward(state, definition, resolutionKey, now) {
  let nextState = state;
  let instanceId = null;
  const progress = normalizeRewardProgress(nextState.rewardProgress);

  if (definition.deliveryType === REWARD_DELIVERY_TYPES.RESOURCE) {
    nextState = grantResources(nextState, definition);
  } else if (
    definition.contentType === REWARD_CONTENT_TYPES.BIOFACTOR &&
    definition.deliveryType === REWARD_DELIVERY_TYPES.ENTITY
  ) {
    instanceId = createInstanceId(
      definition,
      resolutionKey,
      now,
      progress.instances.length,
    );
    nextState = {
      ...nextState,
      unlockedBiofactors: Array.from(
        new Set([...(nextState.unlockedBiofactors ?? []), definition.contentId]),
      ),
    };
  } else if (definition.contentType === REWARD_CONTENT_TYPES.BIOFACTOR) {
    nextState = {
      ...nextState,
      unlockedBiofactors: Array.from(
        new Set([...(nextState.unlockedBiofactors ?? []), definition.contentId]),
      ),
    };
  } else if (
    definition.contentType === REWARD_CONTENT_TYPES.ARTIFACT &&
    definition.deliveryType === REWARD_DELIVERY_TYPES.ENTITY
  ) {
    instanceId = createInstanceId(
      definition,
      resolutionKey,
      now,
      progress.instances.length,
    );
    nextState = {
      ...nextState,
      artifacts: Array.from(
        new Set([...(nextState.artifacts ?? []), definition.contentId]),
      ),
    };
    if (definition.contentId === "ARTIFACT_SKAAB_NOTEBOOK") {
      nextState = {
        ...nextState,
        unlockedBiofactors: Array.from(
          new Set([
            ...(nextState.unlockedBiofactors ?? []),
            "MODIFICATION_SKAABIFICATION",
          ]),
        ),
      };
    }
  } else {
    nextState = {
      ...nextState,
      rewardProgress: {
        ...progress,
        unlockedContentIds: Array.from(
          new Set([...progress.unlockedContentIds, definition.contentId]),
        ),
      },
    };
    const legendaryDefinition = getLegendaryPrototypeDefinition(
      definition.contentId,
    );
    if (
      legendaryDefinition &&
      !(nextState.legendaryIdentities ?? []).some(
        (identity) => identity.id === legendaryDefinition.identityId,
      )
    ) {
      nextState = {
        ...nextState,
        legendaryIdentities: [
          ...(nextState.legendaryIdentities ?? []),
          createLegendaryIdentity(legendaryDefinition, now),
        ],
        legendaryBlueprints: [
          ...(nextState.legendaryBlueprints ?? []).filter(
            (blueprint) => blueprint.id !== legendaryDefinition.id,
          ),
          {
            id: legendaryDefinition.id,
            placements: [],
            archivedAt: null,
            unlockedAt: now,
            updatedAt: null,
          },
        ],
      };
    }
  }

  return { state: nextState, instanceId };
}

function storeResolution(state, resolutionKey, resolution) {
  if (!resolutionKey) return state;
  const progress = normalizeRewardProgress(state.rewardProgress);
  return {
    ...state,
    rewardProgress: {
      ...progress,
      resolutions: {
        ...progress.resolutions,
        [resolutionKey]: resolution,
      },
    },
  };
}

function appendRewardRecord(state, definition, context) {
  const progress = normalizeRewardProgress(state.rewardProgress);
  const record = {
    id: `REWARD_RECORD_${context.now}_${progress.ledger.length + 1}`,
    rewardId: definition.id,
    grade: definition.grade,
    deliveryType: definition.deliveryType,
    contentType: definition.contentType,
    contentId: definition.contentId ?? null,
    resources: definition.resources ? { ...definition.resources } : null,
    sourceId: context.sourceId ?? null,
    resolutionKey: context.resolutionKey ?? null,
    acquiredAt: context.now,
    instanceId: context.instanceId ?? null,
    fallbackForGrade: context.fallbackForGrade ?? null,
  };
  return {
    state: {
      ...state,
      rewardProgress: {
        ...progress,
        ledger: [...progress.ledger, record],
        instances: context.instanceId
          ? [
              ...progress.instances,
              {
                instanceId: context.instanceId,
                rewardId: definition.id,
                contentId: definition.contentId,
                acquiredAt: context.now,
                sourceId: context.sourceId ?? null,
                location: "INVENTORY",
              },
            ]
          : progress.instances,
      },
    },
    record,
  };
}

export function grantReward(
  state,
  definition,
  {
    sourceId = null,
    resolutionKey = null,
    now = Date.now(),
    fallbackForGrade = null,
  } = {},
) {
  assertRewardDefinition(definition);
  const progress = normalizeRewardProgress(state.rewardProgress);
  if (resolutionKey && progress.resolutions[resolutionKey]) {
    return {
      state,
      record: progress.ledger.find(
        (item) => item.id === progress.resolutions[resolutionKey].recordId,
      ) ?? null,
      resolution: progress.resolutions[resolutionKey],
      repeated: true,
    };
  }

  if (ownsRewardContent(state, definition)) {
    const resolution = {
      rewardId: definition.id,
      recordId: null,
      outcome: "ALREADY_OWNED",
      fallback: fallbackForGrade !== null,
      resolvedAt: now,
    };
    return {
      state: storeResolution(state, resolutionKey, resolution),
      record: null,
      resolution,
      repeated: false,
    };
  }

  const delivered = deliverReward(state, definition, resolutionKey, now);
  const recorded = appendRewardRecord(delivered.state, definition, {
    sourceId,
    resolutionKey,
    now,
    instanceId: delivered.instanceId,
    fallbackForGrade,
  });
  const resolution = {
    rewardId: definition.id,
    recordId: recorded.record.id,
    outcome: "GRANTED",
    fallback: fallbackForGrade !== null,
    resolvedAt: now,
  };
  const unlockedBefore = new Set([
    ...(state.unlockedBiofactors ?? []),
    ...(state.artifacts ?? []),
    ...progress.unlockedContentIds,
  ]);
  const deliveredProgress = normalizeRewardProgress(recorded.state.rewardProgress);
  const unlockedAfter = new Set([
    ...(recorded.state.unlockedBiofactors ?? []),
    ...(recorded.state.artifacts ?? []),
    ...deliveredProgress.unlockedContentIds,
  ]);
  const newContentIds = [...unlockedAfter].filter(
    (contentId) => !unlockedBefore.has(contentId),
  );
  const storedState = storeResolution(
    recorded.state,
    resolutionKey,
    resolution,
  );
  const progressedState = applyCareerDelta(storedState, {
    counters: {
      contentUnlocked: newContentIds.length,
      legendaryContentAcquired: newContentIds.filter(
        (contentId) => contentId.startsWith("LEGENDARY_"),
      ).length,
    },
  }, now);
  return {
    state: progressedState,
    record: recorded.record,
    resolution,
    repeated: false,
  };
}

function pickWeightedCandidate(rngState, candidates) {
  const totalWeight = candidates.reduce(
    (sum, item) => sum + (item.drawWeight ?? 1),
    0,
  );
  const roll = nextRandom(rngState);
  let cursor = roll.value * totalWeight;
  for (const candidate of candidates) {
    cursor -= candidate.drawWeight ?? 1;
    if (cursor < 0) return { candidate, rngState: roll.rngState };
  }
  return {
    candidate: candidates[candidates.length - 1],
    rngState: roll.rngState,
  };
}

export function resolveRewardSlot(
  state,
  {
    resolutionKey,
    grade,
    candidates,
    contextTags = [],
    fallback = null,
    sourceId = null,
    now = Date.now(),
  },
) {
  if (!resolutionKey) throw new Error("奖励槽缺少resolutionKey");
  if (!VALID_GRADES.has(grade)) throw new Error("奖励槽等级无效");
  const progress = normalizeRewardProgress(state.rewardProgress);
  if (progress.resolutions[resolutionKey]) {
    return {
      state,
      resolution: progress.resolutions[resolutionKey],
      repeated: true,
    };
  }

  const eligible = getEligibleRewardCandidates(state, candidates, {
    grade,
    contextTags,
  });
  let selected = null;
  let nextState = state;
  if (grade === REWARD_GRADES.RANDOM || grade === REWARD_GRADES.LIMITED_RANDOM) {
    if (eligible.length > 0) {
      const picked = pickWeightedCandidate(state.rngState, eligible);
      selected = picked.candidate;
      nextState = { ...state, rngState: picked.rngState };
    }
  } else {
    // A/B是明确来源的固定结算。即使旧存档已经拥有唯一内容，也要让
    // grantReward固化ALREADY_OWNED结果，不能把“已拥有”误判为空池并发回退。
    selected =
      candidates.find(
        (definition) =>
          validateRewardDefinition(definition).valid &&
          definition.grade === grade,
      ) ?? null;
  }

  if (!selected && fallback) {
    assertRewardDefinition(fallback);
    selected = fallback;
  }
  if (!selected) {
    throw new Error(`奖励槽${resolutionKey}没有合法候选或回退`);
  }

  const result = grantReward(nextState, selected, {
    sourceId,
    resolutionKey,
    now,
    fallbackForGrade: selected === fallback ? grade : null,
  });
  return {
    ...result,
    eligibleRewardIds: eligible.map((item) => item.id),
  };
}
