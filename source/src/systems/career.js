import { ACHIEVEMENTS } from "../data/achievement-data.js";

export const CAREER_COUNTER_KEYS = Object.freeze([
  "expeditionsTotal",
  "expeditionVictories",
  "expeditionFailures",
  "expeditionRetreats",
  "conquestVictories",
  "infiltrationVictories",
  "patrolsDestroyed",
  "garrisonsDestroyed",
  "territoriesDestroyed",
  "regionsDestroyed",
  "worldsDestroyed",
  "planetsDestroyed",
  "universesDestroyed",
  "combatDamageDealt",
  "combatDamageTaken",
  "fortitudeDamage",
  "stabilityDamage",
  "blueprintsCreated",
  "blueprintsDeleted",
  "prototypesInstantiated",
  "prototypeDeaths",
  "prototypesRebuilt",
  "prototypesDestroyed",
  "replicasCreated",
  "replicasDestroyed",
  "contentUnlocked",
  "legendaryContentAcquired",
]);

export const CAREER_RECORD_KEYS = Object.freeze([
  "highestExpeditionDamage",
  "highestExpeditionDamageTaken",
  "highestExpeditionFortitudeDamage",
  "highestExpeditionStabilityDamage",
  "highestEnemiesDefeated",
  "highestReplicasCreatedAtOnce",
]);

function zeroCounters() {
  return Object.fromEntries(CAREER_COUNTER_KEYS.map((key) => [key, 0]));
}

function emptyRecords() {
  return Object.fromEntries(CAREER_RECORD_KEYS.map((key) => [key, null]));
}

export function createCareerProgressState(now = Date.now(), options = {}) {
  return {
    trackingStartedAt: now,
    legacyBaseline: Boolean(options.legacyBaseline),
    note: options.legacyBaseline
      ? "旧档只能迁移当前可推导数据；其余累计自统计系统启用后开始记录。"
      : "从本局建立时开始完整记录。",
    counters: {
      ...zeroCounters(),
      ...(options.inferredCounters ?? {}),
    },
    records: emptyRecords(),
  };
}

export function createAchievementProgressState() {
  return {
    unlocked: {},
    pendingIds: [],
  };
}

export function normalizeCareerProgress(progress, options = {}) {
  const now = options.now ?? Date.now();
  if (!progress || typeof progress !== "object") {
    return createCareerProgressState(now, {
      legacyBaseline: Boolean(options.legacyBaseline),
      inferredCounters: options.inferredCounters,
    });
  }
  const counters = zeroCounters();
  for (const key of CAREER_COUNTER_KEYS) {
    const value = Number(progress.counters?.[key] ?? 0);
    counters[key] = Number.isFinite(value) && value >= 0 ? value : 0;
  }
  const records = emptyRecords();
  for (const key of CAREER_RECORD_KEYS) {
    const record = progress.records?.[key];
    records[key] = record && Number.isFinite(record.value) && record.value >= 0
      ? {
          value: record.value,
          achievedAt: Number.isFinite(record.achievedAt)
            ? record.achievedAt
            : now,
          sourceId: record.sourceId ?? null,
        }
      : null;
  }
  return {
    trackingStartedAt: Number.isFinite(progress.trackingStartedAt)
      ? progress.trackingStartedAt
      : now,
    legacyBaseline: Boolean(progress.legacyBaseline),
    note: typeof progress.note === "string"
      ? progress.note
      : "从统计系统启用后开始记录。",
    counters,
    records,
  };
}

export function normalizeAchievementProgress(progress = {}) {
  const unlocked =
    progress.unlocked &&
    typeof progress.unlocked === "object" &&
    !Array.isArray(progress.unlocked)
      ? progress.unlocked
      : {};
  return {
    unlocked: Object.fromEntries(
      Object.entries(unlocked)
        .filter(([id, entry]) =>
          id.startsWith("ACHIEVEMENT_") &&
          entry &&
          Number.isFinite(entry.unlockedAt),
        )
        .map(([id, entry]) => [
          id,
          {
            unlockedAt: entry.unlockedAt,
            rewardResolved: Boolean(entry.rewardResolved),
          },
        ]),
    ),
    pendingIds: Array.from(
      new Set(
        (Array.isArray(progress.pendingIds) ? progress.pendingIds : [])
          .filter((id) => typeof id === "string" && id.startsWith("ACHIEVEMENT_")),
      ),
    ),
  };
}

export function getAchievementProgressValue(state, achievement) {
  return Number(state.careerProgress?.counters?.[achievement.metric] ?? 0);
}

export function evaluateAchievements(state, now = Date.now()) {
  if (state.settings?.testMode) return state;
  const progress = normalizeAchievementProgress(state.achievementProgress);
  const newlyUnlocked = ACHIEVEMENTS.filter(
    (achievement) =>
      !progress.unlocked[achievement.id] &&
      getAchievementProgressValue(state, achievement) >= achievement.target,
  );
  if (newlyUnlocked.length === 0) {
    return { ...state, achievementProgress: progress };
  }
  const unlocked = { ...progress.unlocked };
  for (const achievement of newlyUnlocked) {
    unlocked[achievement.id] = {
      unlockedAt: now,
      rewardResolved: achievement.reward === null,
    };
  }
  return {
    ...state,
    achievementProgress: {
      unlocked,
      pendingIds: Array.from(new Set([
        ...progress.pendingIds,
        ...newlyUnlocked.map((achievement) => achievement.id),
      ])),
    },
  };
}

export function applyCareerDelta(
  state,
  { counters = {}, records = {} } = {},
  now = Date.now(),
) {
  if (state.settings?.testMode) return state;
  const career = normalizeCareerProgress(state.careerProgress, { now });
  const nextCounters = { ...career.counters };
  for (const [key, rawValue] of Object.entries(counters)) {
    if (!CAREER_COUNTER_KEYS.includes(key)) continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value === 0) continue;
    nextCounters[key] = Math.max(0, nextCounters[key] + value);
  }
  const nextRecords = { ...career.records };
  for (const [key, rawRecord] of Object.entries(records)) {
    if (!CAREER_RECORD_KEYS.includes(key)) continue;
    const candidate = typeof rawRecord === "number"
      ? { value: rawRecord }
      : rawRecord;
    if (!candidate || !Number.isFinite(candidate.value) || candidate.value < 0) {
      continue;
    }
    if ((nextRecords[key]?.value ?? -1) >= candidate.value) continue;
    nextRecords[key] = {
      value: candidate.value,
      achievedAt: now,
      sourceId: candidate.sourceId ?? null,
    };
  }
  return evaluateAchievements({
    ...state,
    careerProgress: {
      ...career,
      counters: nextCounters,
      records: nextRecords,
    },
    achievementProgress: normalizeAchievementProgress(
      state.achievementProgress,
    ),
  }, now);
}

export function recordCareerEvent(state, event) {
  const payload = event.payload ?? {};
  const now = event.timestamp ?? Date.now();
  switch (event.type) {
    case "BLUEPRINT_SAVED":
      return applyCareerDelta(state, {
        counters: { blueprintsCreated: 1, prototypesInstantiated: 1 },
      }, now);
    case "BLUEPRINT_DELETED":
      return applyCareerDelta(state, {
        counters: { blueprintsDeleted: 1 },
      }, now);
    case "PROTOTYPE_INSTANTIATED":
    case "LEGENDARY_PROTOTYPE_INSTANTIATED":
      return applyCareerDelta(state, {
        counters: { prototypesInstantiated: 1 },
      }, now);
    case "PROTOTYPE_REBUILT":
    case "LEGENDARY_PROTOTYPE_REBUILT":
      return applyCareerDelta(state, {
        counters: { prototypesRebuilt: 1 },
      }, now);
    case "PROTOTYPE_DESTROYED":
      return applyCareerDelta(state, {
        counters: { prototypesDestroyed: 1 },
      }, now);
    case "LEGION_PRODUCTION_COMPLETED":
    case "LEGION_REINFORCEMENT_COMPLETED": {
      const replicaCount = Math.max(0, Number(payload.replicaCount ?? 0));
      return applyCareerDelta(state, {
        counters: { replicasCreated: replicaCount },
        records: {
          highestReplicasCreatedAtOnce: {
            value: replicaCount,
            sourceId: payload.legionId ?? null,
          },
        },
      }, now);
    }
    case "LEGION_DISBANDED":
      return applyCareerDelta(state, {
        counters: {
          replicasDestroyed: Math.max(0, Number(payload.replicaCount ?? 0)),
        },
      }, now);
    default:
      return state;
  }
}

export function acknowledgeAchievement(state, achievementId = null) {
  const progress = normalizeAchievementProgress(state.achievementProgress);
  const targetId = achievementId ?? progress.pendingIds[0];
  if (!targetId) return state;
  return {
    ...state,
    achievementProgress: {
      ...progress,
      pendingIds: progress.pendingIds.filter((id) => id !== targetId),
    },
  };
}
