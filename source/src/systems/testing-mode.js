import { canAffordCost, spendCost } from "./blueprints.js";

export const TEST_PRODUCTION_MS = 2000;
export const TEST_RESOURCE_CYCLE_MS = 2000;
export const COLOR_RESOURCE_CYCLE_MS = 120000;
export const COLORLESS_RESOURCE_CYCLE_MS = 60000;

export function isTestMode(state) {
  return state?.settings?.testMode === true;
}

export function canAffordGameCost(state, cost) {
  return isTestMode(state) || canAffordCost(state.resources, cost);
}

export function spendGameCost(state, cost) {
  return isTestMode(state)
    ? state.resources
    : spendCost(state.resources, cost);
}

export function hasArtifact(state, artifactId) {
  return state.artifacts?.includes(artifactId) ?? false;
}

export function getResourceCycleMs(state, resourceKind = "COLORLESS") {
  if (isTestMode(state)) return TEST_RESOURCE_CYCLE_MS;
  return resourceKind === "COLOR"
    ? COLOR_RESOURCE_CYCLE_MS
    : COLORLESS_RESOURCE_CYCLE_MS;
}
