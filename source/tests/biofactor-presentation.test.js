import test from "node:test";
import assert from "node:assert/strict";
import {
  getBiofactorEffectItems,
  getBiofactorEffectTags,
  getBiofactorRequirementSummary,
  matchesBiofactorFilters,
} from "../src/systems/biofactor-presentation.js";
import {
  BIOFACTOR_TYPES,
  getComponent,
  getRace,
} from "../src/data/prototype-data.js";

test("生物因子效果摘要由权威属性、异能和字段变化自动生成", () => {
  const claws = getComponent("MODIFICATION_CLAWS");
  const brain = getComponent("MODIFICATION_BRAIN");
  const shield = getComponent("EQUIPMENT_STOUT_SHIELD");

  assert.deepEqual(
    getBiofactorEffectItems(claws).map((item) => item.label),
    ["力量+1", "生命+1"],
  );
  assert.ok(getBiofactorEffectTags(shield).includes("DEFENSE"));
  assert.ok(getBiofactorEffectTags(shield).includes("ABILITY"));
  assert.deepEqual(
    getBiofactorEffectItems(brain).map((item) => item.label),
    ["智力→有"],
  );
  assert.equal(getBiofactorRequirementSummary(brain), "");
});

test("生物因子搜索可命中名称、ID、类别和异能效果", () => {
  const shield = getComponent("EQUIPMENT_STOUT_SHIELD");
  assert.equal(
    matchesBiofactorFilters(shield, { query: "Stout Shield" }),
    true,
  );
  assert.equal(
    matchesBiofactorFilters(shield, { query: "防御恢复" }),
    true,
  );
  assert.equal(
    matchesBiofactorFilters(shield, { query: "MODIFICATION" }),
    false,
  );
});

test("生物因子类型、效果与未来传奇筛选可以组合", () => {
  const claws = getComponent("MODIFICATION_CLAWS");
  assert.equal(
    matchesBiofactorFilters(claws, {
      type: "MODIFICATION",
      effect: "POWER",
    }),
    true,
  );
  assert.equal(
    matchesBiofactorFilters(claws, {
      type: "EQUIPMENT",
      effect: "POWER",
    }),
    false,
  );

  const legendaryEquipment = {
    id: "EQUIPMENT_TEST_LEGENDARY",
    name: "测试传奇装备",
    englishName: "Test Legendary Equipment",
    biofactorType: BIOFACTOR_TYPES.EQUIPMENT,
    stats: { power: 1, defense: 0, hp: 0 },
    abilities: [],
    requirements: {},
    legendary: true,
  };
  assert.equal(
    matchesBiofactorFilters(legendaryEquipment, {
      type: "EQUIPMENT",
      effect: "LEGENDARY",
    }),
    true,
  );

  const spirit = getRace("RACE_SPIRIT");
  assert.equal(
    matchesBiofactorFilters(spirit, {
      type: "RACE",
      effect: "ABILITY",
    }),
    true,
  );
});
