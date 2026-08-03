import {
  METATHRAN_FACILITY_TYPE,
  PRISMATIC_LENS_ID,
} from "../data/artifact-data.js";
import { hasArtifact } from "./testing-mode.js";

export const MANA_FACILITY_GROUP_METATHRAN = "GROUP_METATHRAN_DYNAMO";

export function getActiveManaProductionSlots(state) {
  const metathran = (state.manaFacilities ?? []).filter(
    (facility) =>
      facility.type === METATHRAN_FACILITY_TYPE &&
      facility.enabled !== false,
  ).length;
  const prismatic =
    hasArtifact(state, PRISMATIC_LENS_ID) &&
    state.prismaticLens?.enabled
      ? 1
      : 0;
  return metathran + prismatic;
}

export function getManaProductionSlotAssignments(state) {
  const activeFacilities = (state.manaFacilities ?? [])
    .filter(
      (facility) =>
        facility.type === METATHRAN_FACILITY_TYPE &&
        facility.enabled !== false,
    )
    .map((facility) => facility.id);
  if (
    hasArtifact(state, PRISMATIC_LENS_ID) &&
    state.prismaticLens?.enabled
  ) {
    activeFacilities.push(PRISMATIC_LENS_ID);
  }
  const availableIds = new Set(activeFacilities);
  const usedIds = new Set();
  const savedAssignments = Array.isArray(state.manaProductionSlotAssignments)
    ? state.manaProductionSlotAssignments
    : [];
  const assignments = Array.from(
    { length: state.base.manaProductionSlots },
    (_, index) => {
      const id = savedAssignments[index] ?? null;
      if (!id || !availableIds.has(id) || usedIds.has(id)) return null;
      usedIds.add(id);
      return id;
    },
  );
  for (const id of activeFacilities) {
    if (usedIds.has(id)) continue;
    const emptyIndex = assignments.indexOf(null);
    if (emptyIndex === -1) break;
    assignments[emptyIndex] = id;
    usedIds.add(id);
  }
  return assignments;
}

function resetCycle(state, id) {
  return {
    ...state,
    clock: {
      ...state.clock,
      productionCycles: {
        ...state.clock.productionCycles,
        [id]: 0,
      },
    },
  };
}

export function assignManaProductionSlot(state, slotIndex, facilityId) {
  const slotCount = state.base.manaProductionSlots;
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= slotCount
  ) {
    throw new Error("法术力生产位不存在");
  }
  if (facilityId !== null) {
    const isMetathran = (state.manaFacilities ?? []).some(
      (facility) =>
        facility.id === facilityId &&
        facility.type === METATHRAN_FACILITY_TYPE,
    );
    const isPrismatic =
      facilityId === PRISMATIC_LENS_ID &&
      hasArtifact(state, PRISMATIC_LENS_ID);
    if (!isMetathran && !isPrismatic) {
      throw new Error("法术力设施不存在");
    }
  }

  const assignments = getManaProductionSlotAssignments(state);
  const previousFacilityId = assignments[slotIndex];
  assignments.forEach((assignedId, index) => {
    if (assignedId === facilityId && index !== slotIndex) {
      assignments[index] = null;
    }
  });
  assignments[slotIndex] = facilityId;
  const enabledIds = new Set(assignments.filter(Boolean));
  let nextState = {
    ...state,
    manaProductionSlotAssignments: assignments,
    manaFacilities: (state.manaFacilities ?? []).map((facility) => ({
      ...facility,
      enabled: enabledIds.has(facility.id),
    })),
    prismaticLens: {
      ...state.prismaticLens,
      enabled: enabledIds.has(PRISMATIC_LENS_ID),
    },
  };

  const previouslyEnabledIds = new Set(
    getManaProductionSlotAssignments(state).filter(Boolean),
  );
  for (const id of previouslyEnabledIds) {
    if (!enabledIds.has(id)) {
      nextState = resetCycle(
        nextState,
        id === PRISMATIC_LENS_ID ? "PRISMATIC_LENS" : id,
      );
    }
  }
  if (
    previousFacilityId === facilityId &&
    facilityId !== null &&
    enabledIds.has(facilityId)
  ) {
    return state;
  }
  return nextState;
}

export function assignManaProductionSlotGroup(state, slotIndex, groupId) {
  if (groupId === null) {
    return assignManaProductionSlot(state, slotIndex, null);
  }
  if (groupId === PRISMATIC_LENS_ID) {
    return assignManaProductionSlot(state, slotIndex, PRISMATIC_LENS_ID);
  }
  if (groupId !== MANA_FACILITY_GROUP_METATHRAN) {
    throw new Error("法术力设施类型不存在");
  }

  const assignments = getManaProductionSlotAssignments(state);
  const currentFacility = (state.manaFacilities ?? []).find(
    (facility) => facility.id === assignments[slotIndex],
  );
  if (currentFacility?.type === METATHRAN_FACILITY_TYPE) {
    return state;
  }
  const assignedIds = new Set(assignments.filter(Boolean));
  const nextFacility = (state.manaFacilities ?? []).find(
    (facility) =>
      facility.type === METATHRAN_FACILITY_TYPE &&
      !assignedIds.has(facility.id),
  );
  if (!nextFacility) {
    throw new Error("没有可启用的仿索蓝发电机");
  }
  return assignManaProductionSlot(state, slotIndex, nextFacility.id);
}

export function setManaFacilityEnabled(state, facilityId, enabled) {
  const facility = state.manaFacilities.find((item) => item.id === facilityId);
  if (!facility) throw new Error("法术力设施不存在");
  if (enabled && facility.enabled === false) {
    if (
      getActiveManaProductionSlots(state) >=
      state.base.manaProductionSlots
    ) {
      throw new Error("法术力生产位已满");
    }
  }
  const nextState = {
    ...state,
    manaFacilities: state.manaFacilities.map((item) =>
      item.id === facilityId ? { ...item, enabled } : item,
    ),
  };
  return enabled ? nextState : resetCycle(nextState, facilityId);
}

export function setPrismaticLensEnabled(state, enabled) {
  if (!hasArtifact(state, PRISMATIC_LENS_ID)) {
    throw new Error("尚未获得虹彩透镜");
  }
  if (enabled && !state.prismaticLens.enabled) {
    if (
      getActiveManaProductionSlots(state) >=
      state.base.manaProductionSlots
    ) {
      throw new Error("法术力生产位已满");
    }
  }
  return resetCycle(
    {
      ...state,
      prismaticLens: {
        ...state.prismaticLens,
        enabled,
      },
    },
    "PRISMATIC_LENS",
  );
}

export function setPrismaticLensColor(state, selectedColor) {
  if (!["W", "U", "B", "R", "G"].includes(selectedColor)) {
    throw new Error("虹彩透镜目标颜色无效");
  }
  return resetCycle(
    {
      ...state,
      prismaticLens: {
        ...state.prismaticLens,
        selectedColor,
      },
    },
    "PRISMATIC_LENS",
  );
}
