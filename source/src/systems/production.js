import {
  METATHRAN_BUILD_COST,
  METATHRAN_BUILD_MS,
  METATHRAN_FACILITY_TYPE,
  MANA_VAULT_LEVELS,
} from "../data/artifact-data.js";
import { getLand, getOrigin } from "../data/game-data.js";
import { getActiveManaProductionSlots } from "./artifacts.js";
import {
  TEST_PRODUCTION_MS,
  canAffordGameCost,
  isTestMode,
  spendGameCost,
} from "./testing-mode.js";

const MANUFACTURING_MS_PER_SCALE_HP = 2000;

function createId(prefix, now) {
  const suffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${suffix}`.toUpperCase();
}

export function queueLegionProduction(
  state,
  { prototypeId, scaleHp },
  now = Date.now(),
) {
  const purchasedScaleHp = Number(scaleHp);
  if (!Number.isInteger(purchasedScaleHp) || purchasedScaleHp < 0) {
    throw new Error("军团生命必须是非负整数");
  }
  if (state.productionQueue.length >= state.base.productionQueueCap) {
    throw new Error("生产队列已满");
  }
  const prototype = state.prototypes.find((item) => item.id === prototypeId);
  if (!prototype || prototype.status !== "READY") {
    throw new Error("没有可用的实体原体");
  }
  const blueprint = state.blueprints.find(
    (item) => item.id === prototype.blueprintId,
  );
  if (!blueprint) throw new Error("原体所属蓝图不存在");
  if (blueprint.legendary || blueprint.legendaryOrigin) {
    throw new Error("传奇原体蓝图永久禁止制造复制体军团");
  }
  const scaleHpCap = Math.min(
    state.base.legionScaleCap ?? 10,
    blueprint.scaleHpCap ?? 10,
  );
  if (purchasedScaleHp > scaleHpCap) {
    throw new Error("超过当前军团生命上限");
  }
  const existingLegion = (state.legions ?? []).find(
    (item) => item.prototypeId === prototypeId,
  );
  if (existingLegion && purchasedScaleHp < 1) {
    throw new Error("补充军团生命必须是正整数");
  }
  if (existingLegion && state.activeExpedition?.legionId === existingLegion.id) {
    throw new Error("远征中的军团不能在基地补充");
  }
  const totalScaleHp =
    (existingLegion?.purchasedScaleHp ?? 0) + purchasedScaleHp;
  if (totalScaleHp > scaleHpCap) {
    throw new Error("超过当前军团生命总上限");
  }
  if (
    state.productionQueue.some((item) => item.prototypeId === prototypeId)
  ) {
    throw new Error("该原体的镜映品已经在生产");
  }
  const totalCost = purchasedScaleHp * blueprint.scaleHpCost;
  const cost = { C: totalCost };
  if (!canAffordGameCost(state, cost)) throw new Error("无色法术力不足");
  const durationMs = isTestMode(state)
    ? TEST_PRODUCTION_MS
    : purchasedScaleHp * MANUFACTURING_MS_PER_SCALE_HP;
  const job = {
    id: createId("PRODUCTION", now),
    type: "LEGION",
    mode: existingLegion ? "REINFORCE" : "CREATE",
    legionId: existingLegion?.id ?? null,
    prototypeId,
    blueprintId: blueprint.id,
    purchasedScaleHp,
    replicaCount: purchasedScaleHp * blueprint.replicasPerScaleHp,
    cost,
    startedAt: now,
    completesAt: now + durationMs,
  };

  const paidState = {
    ...state,
    resources: spendGameCost(state, cost),
  };
  if (durationMs === 0) {
    return completeLegionJob(paidState, job, now);
  }
  return {
    state: {
      ...paidState,
      productionQueue: [...paidState.productionQueue, job],
    },
    job,
    legion: null,
  };
}

export function queueMetathranProduction(state, now = Date.now()) {
  if (!state.flags.metathranRecipeUnlocked && !isTestMode(state)) {
    throw new Error("尚未获得仿索蓝发电机／Metathran Dynamo配方");
  }
  if (state.productionQueue.length >= state.base.productionQueueCap) {
    throw new Error("生产队列已满");
  }
  if (!canAffordGameCost(state, METATHRAN_BUILD_COST)) {
    throw new Error("无色法术力不足");
  }
  const job = {
    id: createId("PRODUCTION", now),
    type: "MANA_FACILITY",
    facilityType: METATHRAN_FACILITY_TYPE,
    cost: { ...METATHRAN_BUILD_COST },
    startedAt: now,
    completesAt:
      now + (isTestMode(state) ? TEST_PRODUCTION_MS : METATHRAN_BUILD_MS),
  };
  return {
    state: {
      ...state,
      resources: spendGameCost(state, job.cost),
      productionQueue: [...state.productionQueue, job],
    },
    job,
  };
}

export function queueManaVaultUpgrade(state, now = Date.now()) {
  const currentLevel = state.base.manaVaultLevel ?? 0;
  const nextLevel = MANA_VAULT_LEVELS[currentLevel + 1];
  if (!nextLevel) throw new Error("法术力库已达到当前最高等级");
  if (!state.flags.gavonyFirstConquered && !isTestMode(state)) {
    throw new Error("首次攻陷加渥尼后才可扩容法术力库");
  }
  if (!state.flags.manaVaultExpansionUnlocked && !isTestMode(state)) {
    throw new Error("本级[C]储存量需要曾经达到上限");
  }
  if (state.productionQueue.length >= state.base.productionQueueCap) {
    throw new Error("生产队列已满");
  }
  if (!canAffordGameCost(state, nextLevel.upgradeCost)) {
    throw new Error("无色法术力不足");
  }
  const job = {
    id: createId("PRODUCTION", now),
    type: "MANA_VAULT_UPGRADE",
    targetLevel: nextLevel.level,
    cost: { ...nextLevel.upgradeCost },
    startedAt: now,
    completesAt:
      now + (isTestMode(state) ? TEST_PRODUCTION_MS : nextLevel.upgradeMs),
  };
  return {
    state: {
      ...state,
      resources: spendGameCost(state, job.cost),
      productionQueue: [...state.productionQueue, job],
    },
    job,
  };
}

function completeLegionJob(state, job, now) {
  const blueprint = state.blueprints.find((item) => item.id === job.blueprintId);
  const prototype = state.prototypes.find((item) => item.id === job.prototypeId);
  if (!blueprint || !prototype) {
    return { state, job, legion: null };
  }
  const existingLegion = job.legionId
    ? (state.legions ?? []).find((item) => item.id === job.legionId)
    : null;
  if (existingLegion) {
    const legion = {
      ...existingLegion,
      purchasedScaleHp:
        (existingLegion.purchasedScaleHp ?? 0) + job.purchasedScaleHp,
      currentHp: existingLegion.currentHp + job.purchasedScaleHp,
      maxHp: existingLegion.maxHp + job.purchasedScaleHp,
      currentScaleHp:
        (existingLegion.currentScaleHp ??
          existingLegion.purchasedScaleHp ??
          0) + job.purchasedScaleHp,
      replicaCount: existingLegion.replicaCount + job.replicaCount,
      readyAt: now,
    };
    return {
      state: {
        ...state,
        productionQueue: state.productionQueue.filter(
          (item) => item.id !== job.id,
        ),
        legions: state.legions.map((item) =>
          item.id === legion.id ? legion : item,
        ),
      },
      job,
      legion,
      reinforced: true,
    };
  }
  const legion = {
    id: createId("LEGION", now),
    prototypeId: prototype.id,
    blueprintId: blueprint.id,
    name: `${prototype.name}军团`,
    purchasedScaleHp: job.purchasedScaleHp,
    currentScaleHp: job.purchasedScaleHp,
    temporaryScaleHp: 0,
    currentHp: blueprint.stats.hp + job.purchasedScaleHp,
    maxHp: blueprint.stats.hp + job.purchasedScaleHp,
    replicaCount: job.replicaCount,
    currentPower: blueprint.stats.power,
    currentDefense: blueprint.stats.defense,
    maxDefense: blueprint.stats.defense,
    abilities: [...blueprint.abilities],
    readyAt: now,
  };
  return {
    state: {
      ...state,
      productionQueue: state.productionQueue.filter(
        (item) => item.id !== job.id,
      ),
      legions: [...(state.legions ?? []), legion],
    },
    job,
    legion,
  };
}

function completeFacilityJob(state, job, now) {
  const occupiedSlots = getActiveManaProductionSlots(state);
  const facility = {
    id: createId("FACILITY", now),
    type: job.facilityType,
    enabled: occupiedSlots < state.base.manaProductionSlots,
    builtAt: now,
  };
  return {
    state: {
      ...state,
      productionQueue: state.productionQueue.filter(
        (item) => item.id !== job.id,
      ),
      manaFacilities: [...(state.manaFacilities ?? []), facility],
    },
    facility,
  };
}

function completeManaVaultUpgrade(state, job, now) {
  const level = MANA_VAULT_LEVELS[job.targetLevel];
  if (!level) return { state, level: null };
  const origin = getOrigin(state.base.originId);
  const land = getLand(state.base.landId);
  const matchedColor =
    origin?.color === land?.color ? origin.color : null;
  const caps = {
    ...state.resources.caps,
    C: level.colorlessCap,
  };
  for (const color of ["W", "U", "B", "R", "G"]) {
    caps[color] =
      level.coloredBaseCap + (color === matchedColor ? 5 : 0);
  }
  return {
    state: {
      ...state,
      base: {
        ...state.base,
        manaVaultLevel: level.level,
      },
      resources: {
        ...state.resources,
        caps,
      },
      productionQueue: state.productionQueue.filter(
        (item) => item.id !== job.id,
      ),
      flags: {
        ...state.flags,
        manaVaultExpansionUnlocked: false,
      },
    },
    level,
  };
}

export function settleProduction(state, now = Date.now()) {
  let nextState = state;
  const completed = [];
  for (const job of state.productionQueue) {
    if (job.completesAt <= now) {
      if (job.type === "MANA_VAULT_UPGRADE") {
        const result = completeManaVaultUpgrade(nextState, job, now);
        nextState = result.state;
        if (result.level) {
          completed.push({ kind: "MANA_VAULT", value: result.level });
        }
      } else if (job.type === "MANA_FACILITY") {
        const result = completeFacilityJob(nextState, job, now);
        nextState = result.state;
        if (result.facility) {
          completed.push({ kind: "MANA_FACILITY", value: result.facility });
        }
      } else {
        const result = completeLegionJob(nextState, job, now);
        nextState = result.state;
        if (result.legion) {
          completed.push({
            kind: result.reinforced ? "LEGION_REINFORCED" : "LEGION",
            value: result.legion,
            scaleHp: job.purchasedScaleHp,
            replicaCount: job.replicaCount,
          });
        }
      }
    }
  }
  return { state: nextState, completed };
}

export function cancelProduction(state, jobId) {
  const job = state.productionQueue.find((item) => item.id === jobId);
  if (!job) throw new Error("生产项目不存在");
  const amounts = { ...state.resources.amounts };
  if (!isTestMode(state)) {
    for (const [color, amount] of Object.entries(job.cost)) {
      amounts[color] += amount;
    }
  }
  return {
    ...state,
    resources: { ...state.resources, amounts },
    productionQueue: state.productionQueue.filter((item) => item.id !== jobId),
  };
}
