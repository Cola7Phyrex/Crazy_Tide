import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { parseSaveJson } from "../src/state/save-schema.js";
import {
  COSMIC_GENERATOR_VERSION,
  archiveCelestial,
  archiveUniverse,
  freezeRandomCelestial,
} from "../src/systems/cosmic-archive.js";

const REGION_IDS = [
  "REGION_GAVONY",
  "REGION_NEPHALIA",
  "REGION_KESSIG",
  "REGION_STENSIA",
  "REGION_MOORLAND",
  "REGION_THRABEN",
];

function completedWorldState() {
  const state = createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-COSMIC-ARCHIVE",
  });
  state.worldMap.completedNodeIds = [...REGION_IDS, "WORLD_INNISTRAD"];
  state.worldMap.stats.regionsDestroyed = REGION_IDS.length;
  state.worldMap.stats.worldsDestroyed = 1;
  state.worldMap.celestialRecords.WORLD_INNISTRAD = {
    nodeId: "WORLD_INNISTRAD",
    name: "依尼翠",
    type: "WORLD",
    completedAt: 2000,
    archivedAt: null,
    childNodeIds: [...REGION_IDS],
  };
  return state;
}

test("随机世界与星球按种子完整固化并通过存档往返", () => {
  const original = completedWorldState();
  const first = freezeRandomCelestial(
    structuredClone(original),
    "WORLD",
    3000,
  );
  const replay = freezeRandomCelestial(
    structuredClone(original),
    "WORLD",
    3000,
  );
  assert.deepEqual(first.record, replay.record);
  assert.equal(first.record.generatorVersion, COSMIC_GENERATOR_VERSION);
  assert.ok(first.record.regions.length >= 3);
  assert.ok(first.record.regions.every((region) => region.territories.length));

  const planet = freezeRandomCelestial(first.state, "PLANET", 4000);
  assert.equal(planet.record.type, "PLANET");
  assert.notEqual(planet.record.id, first.record.id);

  const loaded = parseSaveJson(JSON.stringify(planet.state));
  assert.deepEqual(
    loaded.worldMap.generatedCelestials,
    planet.state.worldMap.generatedCelestials,
  );
});

test("世界归档要求全部区域已压缩，之后才能归档宇宙", () => {
  const state = completedWorldState();
  assert.throws(
    () => archiveCelestial(state, "WORLD_INNISTRAD", 3000),
    /全部区域/,
  );
  state.worldMap.archivedNodeIds = [...REGION_IDS];

  const worldResult = archiveCelestial(state, "WORLD_INNISTRAD", 3000);
  assert.ok(
    worldResult.state.worldMap.archivedNodeIds.includes("WORLD_INNISTRAD"),
  );
  assert.equal(worldResult.record.archivedAt, 3000);
  assert.equal(worldResult.state.worldMap.stats.worldsDestroyed, 1);

  const universeResult = archiveUniverse(
    worldResult.state,
    "UNIVERSE_PRIMARY",
    4000,
  );
  assert.ok(
    universeResult.state.worldMap.archivedNodeIds.includes(
      "UNIVERSE_PRIMARY",
    ),
  );
  assert.equal(universeResult.state.worldMap.stats.universesDestroyed, 1);
  assert.equal(
    universeResult.state.careerProgress.counters.universesDestroyed,
    1,
  );
  assert.throws(
    () => archiveUniverse(
      universeResult.state,
      "UNIVERSE_PRIMARY",
      5000,
    ),
    /已经归档/,
  );
});

test("随机天体数量受存档上限约束且宇宙归档后禁止继续观测", () => {
  let state = completedWorldState();
  for (let index = 0; index < 8; index += 1) {
    state = freezeRandomCelestial(state, "WORLD", 3000 + index).state;
  }
  assert.throws(
    () => freezeRandomCelestial(state, "WORLD", 5000),
    /最多保留8个/,
  );

  state.worldMap.archivedNodeIds = [
    ...REGION_IDS,
    "WORLD_INNISTRAD",
  ];
  state = archiveUniverse(state, "UNIVERSE_PRIMARY", 6000).state;
  assert.throws(
    () => freezeRandomCelestial(state, "PLANET", 7000),
    /已经归档/,
  );
});
