import test from "node:test";
import assert from "node:assert/strict";
import {
  ARTIFACT_CATALOG,
  ENCHANTMENT_CATALOG,
  SPELL_CATALOG,
} from "../src/data/arcana-data.js";
import {
  LEGENDARY_PROTOTYPE_CATALOG,
} from "../src/data/legendary-prototype-data.js";
import { GAME_RULE_ARCHIVE } from "../src/data/game-rules-data.js";
import {
  ABILITIES,
  COMPONENTS,
  JOBS,
  RACES,
  SPECIAL_ABILITIES,
  getAbilityDefinition,
} from "../src/data/prototype-data.js";
import {
  DEFAULT_COLORLESS_GUARD_BLUEPRINT,
  TERRITORIES,
  createTerritoryStates,
} from "../src/data/territory-data.js";
import {
  GAVONY_FIXED_REWARDS,
  INNISTRAD_FIXED_REWARDS,
  LIMITED_RANDOM_REWARD_CATALOG,
} from "../src/data/reward-data.js";
import { validateRewardDefinition } from "../src/systems/rewards.js";
import fs from "node:fs";

function mergeShares(shares) {
  return shares.reduce((reward, share) => {
    for (const [color, amount] of Object.entries(share)) {
      reward[color] = (reward[color] ?? 0) + amount;
    }
    return reward;
  }, {});
}

test("档案公开关键默认规则并准确说明飞行与延势", () => {
  const mainSource = fs.readFileSync(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    mainSource,
    /领土、异能、结界和测试模式可以在此基础上产生修正/,
  );
  const ruleById = Object.fromEntries(
    GAME_RULE_ARCHIVE.map((rule) => [rule.id, rule]),
  );
  assert.match(ruleById.PATROL_CHANCE.detail, /10%/);
  assert.match(ruleById.PATROL_CHANCE.detail, /5个百分点/);
  assert.doesNotMatch(ruleById.PATROL_CHANCE.detail, /教学/);
  assert.match(ruleById.INFILTRATION_EXPOSURE.detail, /6%/);
  assert.doesNotMatch(ruleById.INFILTRATION_EXPOSURE.detail, /涅非利亚|敏锐听觉|尸嵌|道德瓦解/);
  assert.doesNotMatch(ruleById.TRAVEL_TIME.detail, /敏捷/);
  assert.doesNotMatch(ruleById.CONQUEST_DAMAGE.detail, /破坏之乐/);
  assert.match(ruleById.REPLICA_ATTRITION.detail, /不会回收|全部复制体/);
  assert.match(ruleById.COMBAT_SIMULTANEOUS.detail, /同时/);
  assert.match(ABILITIES.ABILITY_FLYING.description, /最大防御与当前防御同时\+1/);
  assert.match(ABILITIES.ABILITY_FLYING.description, /避开该次遭遇/);
  assert.match(ABILITIES.ABILITY_REACH.description, /阻止对方获得飞行提供的防御\+1/);
  assert.deepEqual(
    Object.entries(ABILITIES)
      .filter(([, ability]) => ability.keyword)
      .map(([id]) => id),
    [
      "ABILITY_FLYING",
      "ABILITY_HASTE",
      "ABILITY_FORESTWALK",
      "ABILITY_INFILTRATE_X",
      "ABILITY_REACH",
      "ABILITY_VAMPIRE_BLOODTHIRST",
      "ABILITY_WEREWOLF_ENRAGE",
    ],
  );
  assert.equal(ABILITIES.ABILITY_INFILTRATE_X.name, "渗透X");
  assert.equal(
    ABILITIES.ABILITY_INFILTRATE_X.description,
    "每个渗透周期提供X点渗透值。",
  );
  assert.equal(getAbilityDefinition("ABILITY_INFILTRATE_4").name, "渗透4");
  assert.equal(
    getAbilityDefinition("ABILITY_INFILTRATE_4").description,
    "每个渗透周期提供4点渗透值。",
  );
  assert.equal(ABILITIES.ABILITY_KEEN_HEARING.name, "异能 5");
  assert.equal(ABILITIES.ABILITY_VAMPIRE_WHITE_DAMAGE_PLUS_1.name, "异能 6");
  assert.equal(ABILITIES.ABILITY_INFILTRATION_EXPOSURE_PLUS_15.name, "异能 8");
  assert.equal(ABILITIES.ABILITY_COMBAT_FLIGHT.name, "异能 9");
  assert.equal(ABILITIES.ABILITY_SOLDIER_FORM_RANKS.name, "异能 10");
  assert.equal(ABILITIES.ABILITY_SOLDIER_REINFORCE.name, "异能 11");
  const specialAbilityIds = [
    "ABILITY_OLIVIA_BLOOD_FEAST",
    "ABILITY_OLIVIA_DRINK_THE_LAST",
    "ABILITY_OLIVIA_COMMANDER",
    "ABILITY_ELBRUS_TRANSFORM",
  ];
  for (const id of specialAbilityIds) {
    assert.equal(ABILITIES[id], undefined);
    assert.equal(SPECIAL_ABILITIES[id].special, true);
    assert.equal(getAbilityDefinition(id), SPECIAL_ABILITIES[id]);
  }
});

test("正式内容ID在全部目录中唯一且使用正确前缀", () => {
  const equipment = COMPONENTS.filter(
    (item) => item.biofactorType === "EQUIPMENT",
  );
  const modifications = COMPONENTS.filter(
    (item) => item.biofactorType === "MODIFICATION",
  );
  const groups = [
    ["RACE_", RACES],
    ["JOB_", JOBS],
    ["EQUIPMENT_", equipment],
    ["MODIFICATION_", modifications],
    ["ABILITY_", Object.entries(ABILITIES).map(([id, value]) => ({ id, ...value }))],
    ["ARTIFACT_", ARTIFACT_CATALOG],
    ["ENCHANTMENT_", ENCHANTMENT_CATALOG],
    ["SPELL_", SPELL_CATALOG],
    ["LEGENDARY_BLUEPRINT_", LEGENDARY_PROTOTYPE_CATALOG],
    ["TERRITORY_", TERRITORIES],
  ];
  const ids = groups.flatMap(([, entries]) =>
    entries.map((entry) => entry.id),
  );
  assert.equal(new Set(ids).size, ids.length);
  for (const [prefix, entries] of groups) {
    if (!prefix) continue;
    assert.ok(
      entries.every((entry) => entry.id.startsWith(prefix)),
      `${prefix}目录存在前缀错误`,
    );
  }
});

test("全部结界已接入规则，揭秘明确标记为无目标休眠", () => {
  assert.ok(
    ENCHANTMENT_CATALOG.every(
      (item) => item.implementation === "可施放",
    ),
  );
  const demystify = SPELL_CATALOG.find(
    (item) => item.id === "SPELL_DEMYSTIFY",
  );
  assert.match(demystify.implementation, /合法休眠/);
  assert.match(demystify.implementation, /无敌方结界目标/);
});

test("破坏之乐公开说明包含永久标记、不可消除与减奖规则", () => {
  const mayhem = ENCHANTMENT_CATALOG.find(
    (item) => item.id === "ENCHANTMENT_TASTE_FOR_MAYHEM",
  );
  assert.match(mayhem.effect, /不可消除/);
  assert.match(mayhem.effect, /永久标记/);
  assert.match(mayhem.effect, /减少1份可损失奖励/);
  assert.match(mayhem.effect, /固定奖励不受影响/);
  assert.match(mayhem.effect, /至少保留1份/);
});

test("每块领土的首次沦陷奖励已拆成可损失份额并保留迁移默认值", () => {
  const states = createTerritoryStates();
  for (const territory of TERRITORIES) {
    assert.ok(territory.conquestLootShares.length >= 1);
    assert.deepEqual(
      mergeShares(territory.conquestLootShares),
      territory.conquestReward,
    );
    assert.deepEqual(states[territory.id].destructionMarks, []);
    assert.equal(
      states[territory.id].firstConquestLootResolution,
      null,
    );
  }
});

test("无色领土默认守军使用组构体与青铜剑模板", () => {
  assert.equal(DEFAULT_COLORLESS_GUARD_BLUEPRINT.raceId, "RACE_CONSTRUCT");
  assert.deepEqual(
    DEFAULT_COLORLESS_GUARD_BLUEPRINT.equipmentIds,
    ["EQUIPMENT_BRONZE_SWORD"],
  );
  assert.deepEqual(
    DEFAULT_COLORLESS_GUARD_BLUEPRINT.stats,
    { power: 1, defense: 1, hp: 3 },
  );
});

test("A/B/C/D奖励目录通过元数据契约校验", () => {
  const catalog = [
    ...Object.values(GAVONY_FIXED_REWARDS),
    ...Object.values(INNISTRAD_FIXED_REWARDS),
    ...LIMITED_RANDOM_REWARD_CATALOG,
  ];
  for (const reward of catalog) {
    assert.deepEqual(validateRewardDefinition(reward), {
      valid: true,
      error: null,
    });
  }
  assert.ok(
    LIMITED_RANDOM_REWARD_CATALOG.every(
      (reward) =>
        reward.grade === "D" &&
        ((reward.requiredTags?.length ?? 0) > 0 ||
          (reward.anyTags?.length ?? 0) > 0),
    ),
  );
});

test("当前审计目录数量与实施矩阵基线一致", () => {
  assert.deepEqual(
    {
      races: RACES.length,
      jobs: JOBS.length,
      components: COMPONENTS.length,
      abilities: Object.keys(ABILITIES).length,
      artifacts: ARTIFACT_CATALOG.length,
      enchantments: ENCHANTMENT_CATALOG.length,
      spells: SPELL_CATALOG.length,
      territories: TERRITORIES.length,
      legendaryPrototypes: LEGENDARY_PROTOTYPE_CATALOG.length,
    },
    {
      races: 10,
      jobs: 4,
      components: 12,
      abilities: 18,
      artifacts: 10,
      enchantments: 3,
      spells: 2,
      territories: 18,
      legendaryPrototypes: 1,
    },
  );
});
