import {
  createBlueprintDraftFromBlueprint,
  deriveBlueprint,
} from "./blueprints.js";
import { getComponent } from "../data/prototype-data.js";
import {
  canAffordGameCost,
  spendGameCost,
} from "./testing-mode.js";

function createId(prefix, now) {
  const suffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${suffix}`.toUpperCase();
}

function getIndependentLegendaryPlacements(placements = []) {
  return placements.filter(
    (placement) => getComponent(placement.contentId)?.legendary,
  );
}

function syncIndependentLegendaryInstances(
  state,
  blueprintId,
  previousPlacements = [],
  nextPlacements = [],
) {
  const previousIds = new Set(
    getIndependentLegendaryPlacements(previousPlacements).map(
      (placement) => placement.instanceId,
    ),
  );
  const nextIds = new Set(
    getIndependentLegendaryPlacements(nextPlacements).map(
      (placement) => placement.instanceId,
    ),
  );
  return {
    ...state,
    rewardProgress: {
      ...state.rewardProgress,
      instances: (state.rewardProgress?.instances ?? []).map((instance) => {
        if (nextIds.has(instance.instanceId)) {
          return {
            ...instance,
            location: "INSTALLED",
            installedOnType: "BLUEPRINT",
            installedOnId: blueprintId,
          };
        }
        if (previousIds.has(instance.instanceId)) {
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
  };
}

export function isEmptyStandbyLegion(legion) {
  return (
    Boolean(legion) &&
    (legion.purchasedScaleHp ?? 0) === 0 &&
    (legion.replicaCount ?? 0) === 0
  );
}

export function saveNewBlueprint(state, draft, now = Date.now()) {
  if (state.blueprints.length >= state.base.blueprintCap) {
    throw new Error("蓝图槽已满");
  }
  if (
    state.prototypes.length +
      (state.legendaryPrototypes?.length ?? 0) >=
    state.base.prototypeCap
  ) {
    throw new Error("实体原体槽已满，无法发放首次免费原体");
  }

  const derived = deriveBlueprint(draft, state);
  if (!derived.valid) throw new Error(derived.issues[0]);
  if (!canAffordGameCost(state, derived.designCost)) {
    throw new Error("法术力不足，无法保存该蓝图");
  }

  const blueprintId = createId("BLUEPRINT", now);
  const prototypeId = createId("PROTOTYPE", now + 1);
  const blueprint = {
    id: blueprintId,
    ...derived,
    createdAt: now,
    hasGrantedFreePrototype: true,
  };
  const prototype = {
    id: prototypeId,
    blueprintId,
    name: derived.name,
    status: "READY",
    currentHp: derived.stats.hp,
    maxHp: derived.stats.hp,
    createdAt: now,
    rebuildCount: 0,
  };

  const nextState = syncIndependentLegendaryInstances(
    {
      ...state,
      resources: spendGameCost(state, derived.designCost),
      blueprints: [...state.blueprints, blueprint],
      prototypes: [...state.prototypes, prototype],
    },
    blueprintId,
    [],
    blueprint.placements,
  );
  return {
    state: nextState,
    blueprint,
    prototype,
  };
}

export function updateExistingBlueprint(
  state,
  blueprintId,
  draft,
  now = Date.now(),
) {
  const blueprint = state.blueprints.find((item) => item.id === blueprintId);
  if (!blueprint) throw new Error("蓝图不存在");
  const prototype = state.prototypes.find(
    (item) => item.blueprintId === blueprintId,
  );
  if (prototype?.status === "DEPLOYED") {
    throw new Error("远征中的原体不能编辑");
  }
  if (
    (state.legions ?? []).some(
      (item) =>
        item.blueprintId === blueprintId && !isEmptyStandbyLegion(item),
    )
  ) {
    throw new Error("请先结束或解散该蓝图的待命军团");
  }
  if (
    state.productionQueue.some((item) => item.blueprintId === blueprintId)
  ) {
    throw new Error("该蓝图的镜映品正在生产");
  }

  const derived = deriveBlueprint(draft, state);
  if (!derived.valid) throw new Error(derived.issues[0]);
  const becomesLegendary = !blueprint.legendary && derived.legendary;
  if (
    becomesLegendary &&
    ((state.legions ?? []).some((item) => item.blueprintId === blueprintId) ||
      state.activeExpedition?.blueprintId === blueprintId ||
      state.productionQueue.some((item) => item.blueprintId === blueprintId))
  ) {
    throw new Error("安装传奇因子前必须结束远征、取消生产并解散军团壳");
  }
  if (!canAffordGameCost(state, derived.designCost)) {
    throw new Error("法术力不足，无法保存蓝图修改");
  }
  const updatedBlueprint = {
    ...blueprint,
    ...derived,
    legendary: Boolean(blueprint.legendary || derived.legendary),
    id: blueprint.id,
    createdAt: blueprint.createdAt,
    updatedAt: now,
    hasGrantedFreePrototype: true,
  };
  const updatedPrototype = prototype
    ? {
        ...prototype,
        name: derived.name,
        maxHp: derived.stats.hp,
        currentHp:
          prototype.status === "DEAD" ? 0 : derived.stats.hp,
        updatedAt: now,
      }
    : null;
  let nextState = syncIndependentLegendaryInstances(
    {
      ...state,
      resources: spendGameCost(state, derived.designCost),
      blueprints: state.blueprints.map((item) =>
        item.id === blueprintId ? updatedBlueprint : item,
      ),
      prototypes: state.prototypes.map((item) =>
        item.id === prototype?.id ? updatedPrototype : item,
      ),
      legions: (state.legions ?? []).map((item) =>
        item.blueprintId === blueprintId && isEmptyStandbyLegion(item)
          ? {
              ...item,
              name: `${derived.name}军团`,
              currentHp: derived.stats.hp,
              maxHp: derived.stats.hp,
              currentPower: derived.stats.power,
              currentDefense: derived.stats.defense,
              maxDefense: derived.stats.defense,
              abilities: [...derived.abilities],
              readyAt: now,
            }
          : item,
      ),
    },
    blueprintId,
    blueprint.placements,
    updatedBlueprint.placements,
  );
  return {
    state: nextState,
    blueprint: updatedBlueprint,
    prototype: updatedPrototype,
  };
}

export function disbandLegion(state, legionId) {
  const legion = (state.legions ?? []).find((item) => item.id === legionId);
  if (!legion) throw new Error("军团不存在");
  if (state.activeExpedition?.legionId === legionId) {
    throw new Error("远征中的军团不能解散");
  }
  if (
    state.productionQueue.some(
      (item) =>
        item.legionId === legionId ||
        (item.type === "LEGION" &&
          item.prototypeId === legion.prototypeId),
    )
  ) {
    throw new Error("该军团正在生产或补充，需先取消生产");
  }
  return {
    state: {
      ...state,
      legions: state.legions.filter((item) => item.id !== legionId),
    },
    legion,
  };
}

export function destroyPrototype(state, prototypeId) {
  const prototype = state.prototypes.find((item) => item.id === prototypeId);
  if (!prototype) throw new Error("原体不存在");
  if (
    prototype.status === "DEPLOYED" ||
    state.activeExpedition?.prototypeId === prototypeId
  ) {
    throw new Error("远征中的原体不能销毁");
  }
  if (
    (state.legions ?? []).some(
      (item) => item.prototypeId === prototypeId,
    )
  ) {
    throw new Error("请先解散该原体所属的军团");
  }
  if (
    state.productionQueue.some(
      (item) => item.prototypeId === prototypeId,
    )
  ) {
    throw new Error("该原体的镜映品正在生产，需先取消生产");
  }
  const blueprint = state.blueprints.find(
    (item) => item.id === prototype.blueprintId,
  );
  const returnedPlacements = getIndependentLegendaryPlacements(
    blueprint?.placements,
  );
  const returnedIds = new Set(
    returnedPlacements.map((placement) => placement.instanceId),
  );
  const nextBlueprints = state.blueprints.map((item) =>
    item.id === prototype.blueprintId
      ? {
          ...item,
          placements: item.placements.filter(
            (placement) => !returnedIds.has(placement.instanceId),
          ),
        }
      : item,
  );
  let nextState = syncIndependentLegendaryInstances(
    {
      ...state,
      blueprints: nextBlueprints,
      prototypes: state.prototypes.filter(
        (item) => item.id !== prototypeId,
      ),
    },
    prototype.blueprintId,
    returnedPlacements,
    [],
  );
  const strippedBlueprint = nextState.blueprints.find(
    (item) => item.id === prototype.blueprintId,
  );
  if (strippedBlueprint && returnedIds.size) {
    const derived = deriveBlueprint(
      createBlueprintDraftFromBlueprint(strippedBlueprint),
      nextState,
    );
    nextState = {
      ...nextState,
      blueprints: nextState.blueprints.map((item) =>
        item.id === strippedBlueprint.id
          ? {
              ...item,
              ...derived,
              id: item.id,
              legendary: true,
              legendaryOrigin: false,
            }
          : item,
      ),
    };
  }
  return {
    state: nextState,
    prototype,
  };
}

export function instantiatePrototype(
  state,
  blueprintId,
  now = Date.now(),
) {
  const blueprint = state.blueprints.find(
    (item) => item.id === blueprintId,
  );
  if (!blueprint) throw new Error("蓝图不存在");
  if (
    state.prototypes.some((item) => item.blueprintId === blueprintId)
  ) {
    throw new Error("该蓝图已经拥有实体原体");
  }
  if (
    state.prototypes.length +
      (state.legendaryPrototypes?.length ?? 0) >=
    state.base.prototypeCap
  ) {
    throw new Error("实体原体槽已满");
  }
  const cost = { C: blueprint.equivalentValue };
  if (!canAffordGameCost(state, cost)) {
    throw new Error("无色法术力不足");
  }
  const prototype = {
    id: createId("PROTOTYPE", now),
    blueprintId,
    name: blueprint.name,
    status: "READY",
    currentHp: blueprint.stats.hp,
    maxHp: blueprint.stats.hp,
    createdAt: now,
    rebuildCount: 0,
  };
  return {
    state: {
      ...state,
      resources: spendGameCost(state, cost),
      prototypes: [...state.prototypes, prototype],
    },
    prototype,
    cost,
  };
}

export function deleteBlueprint(state, blueprintId) {
  const blueprint = state.blueprints.find(
    (item) => item.id === blueprintId,
  );
  if (!blueprint) throw new Error("蓝图不存在");
  if (
    state.activeExpedition?.blueprintId === blueprintId
  ) {
    throw new Error("远征正在使用该蓝图");
  }
  if (
    state.productionQueue.some(
      (item) => item.blueprintId === blueprintId,
    )
  ) {
    throw new Error("该蓝图关联的镜映品正在生产，需先取消生产");
  }
  if (
    (state.legions ?? []).some(
      (item) => item.blueprintId === blueprintId,
    )
  ) {
    throw new Error("请先解散该蓝图所属的军团");
  }
  if (
    state.prototypes.some(
      (item) => item.blueprintId === blueprintId,
    )
  ) {
    throw new Error("请先销毁该蓝图对应的实体原体");
  }
  return {
    state: {
      ...state,
      blueprints: state.blueprints.filter(
        (item) => item.id !== blueprintId,
      ),
    },
    blueprint,
  };
}

export function markPrototypeDead(state, prototypeId) {
  const prototype = state.prototypes.find((item) => item.id === prototypeId);
  if (!prototype) throw new Error("原体不存在");
  return {
    ...state,
    prototypes: state.prototypes.map((item) =>
      item.id === prototypeId
        ? { ...item, status: "DEAD", currentHp: 0 }
        : item,
    ),
    legions: (state.legions ?? []).filter(
      (legion) => legion.prototypeId !== prototypeId,
    ),
  };
}

export function rebuildPrototype(state, prototypeId, now = Date.now()) {
  const prototype = state.prototypes.find((item) => item.id === prototypeId);
  if (!prototype) throw new Error("原体不存在");
  if (prototype.status !== "DEAD") throw new Error("该原体不需要重构");
  const blueprint = state.blueprints.find(
    (item) => item.id === prototype.blueprintId,
  );
  if (!blueprint) throw new Error("原体所属蓝图不存在");
  const cost = { C: blueprint.equivalentValue };
  if (!canAffordGameCost(state, cost)) throw new Error("无色法术力不足");

  return {
    ...state,
    resources: spendGameCost(state, cost),
    prototypes: state.prototypes.map((item) =>
      item.id === prototypeId
        ? {
            ...item,
            status: "READY",
            currentHp: item.maxHp,
            rebuiltAt: now,
            rebuildCount: item.rebuildCount + 1,
          }
        : item,
    ),
  };
}
