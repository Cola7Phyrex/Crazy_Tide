import assert from "node:assert/strict";
import test from "node:test";

import { presentEvent } from "../src/core/events.js";
import {
  ARTIFACT_CATALOG,
  ENCHANTMENT_CATALOG,
  SPELL_CATALOG,
} from "../src/data/arcana-data.js";
import {
  ABILITIES,
  COMPONENTS,
  JOBS,
  RACES,
} from "../src/data/prototype-data.js";
import {
  getContentDisplayName,
  getGeneratorVersionDisplayName,
} from "../src/systems/content-presentation.js";

const INTERNAL_ID_PATTERN =
  /\b(?:RACE|JOB|EQUIPMENT|MODIFICATION|ABILITY|ARTIFACT|ENCHANTMENT|SPELL|TERRITORY|REGION|WORLD|UNIVERSE|LEGENDARY|ACHIEVEMENT)_[A-Z0-9_]+\b/;

test("全部正式内容拥有不含内部ID或英文占位符的显示名", () => {
  const namedContent = [
    ...RACES,
    ...JOBS,
    ...COMPONENTS,
    ...ARTIFACT_CATALOG,
    ...ENCHANTMENT_CATALOG,
    ...SPELL_CATALOG,
    ...Object.values(ABILITIES),
  ];

  for (const item of namedContent) {
    assert.ok(item.name, "正式内容必须拥有显示名");
    assert.doesNotMatch(item.name, INTERNAL_ID_PATTERN);
    assert.doesNotMatch(item.name, /^Ability[_ ]\d+$/i);
  }
  assert.equal(getContentDisplayName("MODIFICATION_ARM"), "胳膊");
  assert.equal(getContentDisplayName("INTERNAL_UNKNOWN"), "未知内容");
  assert.deepEqual(
    ["ABILITY_001", "ABILITY_002", "ABILITY_003", "ABILITY_004"].map(
      (id) => ABILITIES[id].name,
    ),
    ["异能 1", "异能 2", "异能 3", "异能 4"],
  );
});

test("事件、领土与观测协议的正式文本不暴露内部ID", () => {
  const events = [
    {
      type: "EXPEDITION_STARTED",
      payload: { territoryId: "TERRITORY_TUTORIAL_W", command: "CONQUEST" },
    },
    {
      type: "REGION_ARCHIVED",
      payload: { regionId: "REGION_GAVONY", territoryCount: 3, rewardCount: 2 },
    },
    {
      type: "RANDOM_CELESTIAL_FROZEN",
      payload: {
        celestialId: "WORLD_RANDOM_1",
        celestialType: "WORLD",
        name: "灰烬回廊 1",
        generatorVersion: "INNISTRAD_V1",
      },
    },
    {
      type: "SPACE_ANCHOR_ACTIVATED",
      payload: { territoryId: "TERRITORY_TUTORIAL_W" },
    },
  ];

  for (const event of events) {
    assert.doesNotMatch(presentEvent({ ...event, timestamp: 0 }).text, INTERNAL_ID_PATTERN);
  }
  assert.equal(
    getGeneratorVersionDisplayName("INNISTRAD_V1"),
    "依尼翠观测协议·第一版",
  );
});
