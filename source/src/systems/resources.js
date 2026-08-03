import { COLOR_ORDER, getLand, getOrigin } from "../data/game-data.js";
import {
  METATHRAN_FACILITY_TYPE,
  METATHRAN_YIELD_PER_MINUTE,
  PRISMATIC_LENS_ID,
  THRAN_DYNAMO_ID,
  THRAN_YIELD_PER_MINUTE,
} from "../data/artifact-data.js";
import {
  getResourceCycleMs,
  hasArtifact,
  isTestMode,
} from "./testing-mode.js";

export const BASE_COLOR_CAP = 10;
export const MATCHED_COLOR_CAP = 15;
export const INITIAL_COLOR_MANA = 3;
export const INITIAL_COLORLESS_MANA = 18000;
export const COLORLESS_CAP = 20000;
export const RESIDUE_RATE_PER_MINUTE = 25;
export const COLOR_PRODUCTION_CYCLE_MS = 120000;
export const PRODUCTION_CYCLE_MS = 60000;
export const PRISMATIC_C_COST_PER_CYCLE = 400;

const DEFAULT_PRODUCTION_CYCLES = {
  ORIGIN: 0,
  LAND: 0,
  RESIDUE: 0,
};

export function createResourceState(originColor, landColor) {
  const amounts = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0]));
  const caps = Object.fromEntries(COLOR_ORDER.map((color) => [color, BASE_COLOR_CAP]));
  const fractions = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0]));

  amounts[originColor] += INITIAL_COLOR_MANA;
  amounts[landColor] += INITIAL_COLOR_MANA;
  amounts.C = INITIAL_COLORLESS_MANA;
  caps.C = COLORLESS_CAP;

  if (originColor === landColor) {
    caps[originColor] = MATCHED_COLOR_CAP;
  }

  return { amounts, caps, fractions };
}

export function getProductionRates(baseOrState) {
  const base = baseOrState.base ?? baseOrState;
  const rates = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0]));
  const origin = getOrigin(base.originId);
  const land = getLand(base.landId);
  const anchoredLands = base.anchorLocation?.status === "ANCHORED"
    ? base.anchorLocation.lands ?? []
    : null;

  if (origin) rates[origin.color] += 1;
  if (anchoredLands) {
    for (const landId of anchoredLands) {
      const anchoredLand = getLand(landId);
      if (anchoredLand) rates[anchoredLand.color] += 1;
    }
  } else if (land) rates[land.color] += 1;
  const hasThran = hasArtifact(baseOrState, THRAN_DYNAMO_ID);
  if (base.residueActive && !hasThran) rates.C += RESIDUE_RATE_PER_MINUTE;
  if (hasThran) {
    rates.C += THRAN_YIELD_PER_MINUTE;
  }
  for (const facility of baseOrState.manaFacilities ?? []) {
    if (facility.type === METATHRAN_FACILITY_TYPE && facility.enabled !== false) {
      rates.C += METATHRAN_YIELD_PER_MINUTE;
    }
  }

  return rates;
}

function getProductionSources(state) {
  const base = state.base ?? state;
  const origin = getOrigin(base.originId);
  const land = getLand(base.landId);
  const anchoredLands = base.anchorLocation?.status === "ANCHORED"
    ? base.anchorLocation.lands ?? []
    : null;
  const sources = [];

  if (origin) {
    sources.push({ id: "ORIGIN", color: origin.color, yieldPerCycle: 1 });
  }
  if (anchoredLands) {
    anchoredLands.forEach((landId, index) => {
      const anchoredLand = getLand(landId);
      if (!anchoredLand) return;
      sources.push({
        id: `ANCHORED_LAND_${index}`,
        color: anchoredLand.color,
        yieldPerCycle: 1,
      });
    });
  } else if (land) {
    sources.push({ id: "LAND", color: land.color, yieldPerCycle: 1 });
  }
  const hasThran = hasArtifact(state, THRAN_DYNAMO_ID);
  if (base.residueActive && !hasThran) {
    sources.push({
      id: "RESIDUE",
      color: "C",
      yieldPerCycle: RESIDUE_RATE_PER_MINUTE,
    });
  }
  if (hasThran) {
    sources.push({
      id: "THRAN_DYNAMO",
      color: "C",
      yieldPerCycle: THRAN_YIELD_PER_MINUTE,
    });
  }
  for (const facility of state.manaFacilities ?? []) {
    if (facility.type !== METATHRAN_FACILITY_TYPE || facility.enabled === false) {
      continue;
    }
    sources.push({
      id: facility.id,
      color: "C",
      yieldPerCycle: METATHRAN_YIELD_PER_MINUTE,
    });
  }

  return sources;
}

function getSourceCycleMs(state, source) {
  return getResourceCycleMs(
    state,
    source.color === "C" ? "COLORLESS" : "COLOR",
  );
}

export function settleEconomy(state, now = Date.now()) {
  const lastSettledAt = state.clock.economyLastSettledAt ?? now;
  const elapsedMs = Math.max(0, now - lastSettledAt);
  const amounts = { ...state.resources.amounts };
  const fractions = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0]));
  const productionCycles = {
    ...DEFAULT_PRODUCTION_CYCLES,
    ...(state.clock.productionCycles ?? {}),
  };
  const gained = Object.fromEntries(COLOR_ORDER.map((color) => [color, 0]));

  for (const source of getProductionSources(state)) {
    const { color, id, yieldPerCycle } = source;
    const productionCycleMs = getSourceCycleMs(state, source);
    const cap = state.resources.caps[color];
    productionCycles[id] ??= 0;

    if (amounts[color] >= cap) {
      productionCycles[id] = 0;
      continue;
    }

    const totalProgress = productionCycles[id] + elapsedMs;
    const completedCycles = Math.floor(totalProgress / productionCycleMs);
    const producedUnits = completedCycles * yieldPerCycle;
    const storedUnits = Math.min(producedUnits, cap - amounts[color]);

    amounts[color] += storedUnits;
    gained[color] += storedUnits;
    productionCycles[id] =
      amounts[color] >= cap ? 0 : totalProgress % productionCycleMs;
  }

  const lensEnabled =
    hasArtifact(state, PRISMATIC_LENS_ID) &&
    state.prismaticLens?.enabled;
  if (lensEnabled) {
    const productionCycleMs = getResourceCycleMs(state, "COLOR");
    const targetColor = state.prismaticLens.selectedColor;
    productionCycles.PRISMATIC_LENS ??= 0;
    if (
      amounts[targetColor] >= state.resources.caps[targetColor] ||
      (!isTestMode(state) && amounts.C < PRISMATIC_C_COST_PER_CYCLE)
    ) {
      productionCycles.PRISMATIC_LENS = 0;
    } else {
      const totalProgress =
        productionCycles.PRISMATIC_LENS + elapsedMs;
      const completedCycles = Math.floor(
        totalProgress / productionCycleMs,
      );
      const payableCycles = isTestMode(state)
        ? completedCycles
        : Math.floor(amounts.C / PRISMATIC_C_COST_PER_CYCLE);
      const storableCycles =
        state.resources.caps[targetColor] - amounts[targetColor];
      const convertedCycles = Math.min(
        completedCycles,
        payableCycles,
        storableCycles,
      );
      if (!isTestMode(state)) {
        amounts.C -= convertedCycles * PRISMATIC_C_COST_PER_CYCLE;
      }
      amounts[targetColor] += convertedCycles;
      gained[targetColor] += convertedCycles;
      productionCycles.PRISMATIC_LENS =
        amounts[targetColor] >= state.resources.caps[targetColor] ||
        (!isTestMode(state) && amounts.C < PRISMATIC_C_COST_PER_CYCLE)
          ? 0
          : totalProgress % productionCycleMs;
    }
  } else {
    productionCycles.PRISMATIC_LENS = 0;
  }

  for (const source of getProductionSources(state)) {
    if (amounts[source.color] >= state.resources.caps[source.color]) continue;
    const productionCycleMs = getSourceCycleMs(state, source);
    fractions[source.color] = Math.max(
      fractions[source.color],
      productionCycles[source.id] / productionCycleMs,
    );
  }
  if (
    lensEnabled &&
    amounts[state.prismaticLens.selectedColor] <
      state.resources.caps[state.prismaticLens.selectedColor] &&
    (isTestMode(state) || amounts.C >= PRISMATIC_C_COST_PER_CYCLE)
  ) {
    const productionCycleMs = getResourceCycleMs(state, "COLOR");
    fractions[state.prismaticLens.selectedColor] = Math.max(
      fractions[state.prismaticLens.selectedColor],
      productionCycles.PRISMATIC_LENS / productionCycleMs,
    );
  }

  const manaVaultExpansionUnlocked =
    state.flags?.manaVaultExpansionUnlocked ||
    (state.flags?.gavonyFirstConquered &&
      amounts.C >= state.resources.caps.C);

  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        amounts,
        fractions,
      },
      clock: {
        ...state.clock,
        economyLastSettledAt: now,
        productionCycles,
      },
      flags: {
        ...state.flags,
        manaVaultExpansionUnlocked,
      },
    },
    gained,
    elapsedMs,
  };
}

export function hasResourceGain(gained) {
  return COLOR_ORDER.some((color) => (gained[color] ?? 0) > 0);
}

export function getMillisecondsToNextCollection(state, color) {
  if (state.resources.amounts[color] >= state.resources.caps[color]) {
    return null;
  }

  const matchingSources = getProductionSources(state).filter(
    (source) => source.color === color,
  );
  if (matchingSources.length === 0) return null;

  const productionCycles = {
    ...DEFAULT_PRODUCTION_CYCLES,
    ...(state.clock.productionCycles ?? {}),
  };
  return Math.min(
    ...matchingSources.map(
      (source) =>
        getSourceCycleMs(state, source) - productionCycles[source.id],
    ),
  );
}
