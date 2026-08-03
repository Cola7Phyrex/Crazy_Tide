export function nextRandom(rngState = 1) {
  let value = Number(rngState) >>> 0;
  if (value === 0) value = 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const nextState = value >>> 0;
  return {
    rngState: nextState,
    value: nextState / 0x100000000,
  };
}

export function rollChance(rngState, chance) {
  const result = nextRandom(rngState);
  return {
    ...result,
    success: result.value < Math.max(0, Math.min(1, chance)),
  };
}
