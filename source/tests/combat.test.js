import test from "node:test";
import assert from "node:assert/strict";
import {
  createCombat,
  resolveCombatRound,
  simulateCombat,
} from "../src/systems/combat.js";

const unit = (overrides = {}) => ({
  id: "UNIT",
  name: "测试单位",
  power: 2,
  defense: 2,
  hp: 6,
  colors: ["W"],
  abilities: [],
  ...overrides,
});

test("力量等于防御时突破并至少造成1点生命伤害", () => {
  const result = resolveCombatRound(
    createCombat(unit(), unit({ id: "DEFENDER" })),
  );
  assert.equal(result.attacker.currentHp, 5);
  assert.equal(result.defender.currentHp, 5);
  assert.equal(result.attacker.currentDefense, 0);
  assert.equal(result.defender.currentDefense, 0);
});

test("同时伤害允许双方在同一回合同归于尽", () => {
  const result = simulateCombat(
    unit({ power: 3, defense: 0, hp: 2 }),
    unit({ id: "DEFENDER", power: 3, defense: 0, hp: 2 }),
  );
  assert.equal(result.winner, "BOTH_DEAD");
  assert.equal(result.round, 1);
});

test("破防后经历完整暴露回合再恢复一半防御", () => {
  let combat = createCombat(
    unit({ power: 2, defense: 5, hp: 20 }),
    unit({ id: "DEFENDER", power: 2, defense: 2, hp: 20 }),
  );
  combat = resolveCombatRound(combat);
  assert.equal(combat.defender.defenseStatus, "EXPOSED");
  combat = resolveCombatRound(combat);
  assert.equal(combat.defender.isExposedRound, true);
  assert.equal(combat.defender.currentDefense, 0);
  combat = resolveCombatRound(combat);
  assert.ok(combat.defender.currentDefense <= combat.defender.maxDefense);
});

test("连续三轮双方生命不变时进攻方失败", () => {
  const result = simulateCombat(
    unit({ power: 0, defense: 10, hp: 10 }),
    unit({ id: "DEFENDER", power: 0, defense: 10, hp: 10 }),
  );
  assert.equal(result.winner, "DEFENDER");
  assert.equal(result.reason, "STALEMATE");
  assert.equal(result.round, 3);
});

test("巨剑在破防时扩大生命伤害", () => {
  const normal = resolveCombatRound(
    createCombat(
      unit({ power: 2, defense: 0, hp: 10 }),
      unit({ id: "D1", power: 0, defense: 2, hp: 10 }),
    ),
  );
  const greatsword = resolveCombatRound(
    createCombat(
      unit({
        power: 2,
        defense: 0,
        hp: 10,
        abilities: ["ABILITY_003"],
      }),
      unit({ id: "D2", power: 0, defense: 2, hp: 10 }),
    ),
  );
  assert.equal(normal.defender.currentHp, 9);
  assert.equal(greatsword.defender.currentHp, 8);
});

test("吸血鬼对白色来源额外承受1点伤害", () => {
  const normal = resolveCombatRound(
    createCombat(
      unit({ power: 1, defense: 0 }),
      unit({ id: "NORMAL", power: 0, defense: 0, hp: 10 }),
    ),
  );
  const vampire = resolveCombatRound(
    createCombat(
      unit({ power: 1, defense: 0 }),
      unit({
        id: "VAMPIRE",
        power: 0,
        defense: 0,
        hp: 10,
        abilities: ["ABILITY_VAMPIRE_WHITE_DAMAGE_PLUS_1"],
      }),
    ),
  );
  assert.equal(normal.defender.currentHp - vampire.defender.currentHp, 1);
  assert.equal(vampire.rounds[0].attackOnDefender.whiteDamageBonus, 1);
});

test("嗜血每场至多触发一次并在下一场继续累计到2层", () => {
  let first = createCombat(
    unit({
      power: 1,
      defense: 0,
      hp: 20,
      colors: ["B"],
      abilities: ["ABILITY_VAMPIRE_BLOODTHIRST"],
    }),
    unit({ id: "TARGET", power: 0, defense: 0, hp: 20 }),
  );
  first = resolveCombatRound(first);
  assert.equal(first.attacker.bloodthirstStacks, 1);
  assert.equal(first.attacker.currentPower, 2);
  first = resolveCombatRound(first);
  assert.equal(first.attacker.bloodthirstStacks, 1);

  const second = resolveCombatRound(
    createCombat(
      unit({
        power: 1,
        defense: 0,
        hp: 20,
        colors: ["B"],
        abilities: ["ABILITY_VAMPIRE_BLOODTHIRST"],
        bloodthirstStacks: 1,
      }),
      unit({ id: "TARGET_TWO", power: 0, defense: 0, hp: 20 }),
    ),
  );
  assert.equal(second.attacker.bloodthirstStacks, 2);
  assert.equal(second.attacker.currentPower, 3);
});

test("狼人实际失去生命后本场激怒且不限一次", () => {
  let combat = createCombat(
    unit({
      power: 2,
      defense: 0,
      hp: 20,
      colors: ["R", "G"],
      abilities: ["ABILITY_WEREWOLF_ENRAGE"],
    }),
    unit({ id: "TARGET", power: 1, defense: 0, hp: 20 }),
  );
  combat = resolveCombatRound(combat);
  assert.equal(combat.attacker.currentPower, 3);
  combat = resolveCombatRound(combat);
  assert.equal(combat.attacker.currentPower, 4);
  assert.equal(combat.attacker.enrageStacks, 2);
});

test("石像鬼的战斗飞行获得高度优势", () => {
  const combat = createCombat(
    unit({
      abilities: ["ABILITY_COMBAT_FLIGHT"],
    }),
    unit({ id: "GROUND", colors: ["R"] }),
  );
  assert.equal(combat.attacker.maxDefense, 3);
});

test("士兵按开战时规模生命结阵或补员", () => {
  const abilities = [
    "ABILITY_SOLDIER_FORM_RANKS",
    "ABILITY_SOLDIER_REINFORCE",
  ];
  const formation = createCombat(
    unit({ abilities, scaleHp: 5 }),
    unit({ id: "ENEMY" }),
  );
  assert.equal(formation.attacker.currentPower, 4);
  assert.equal(formation.attacker.maxDefense, 3);
  assert.equal(formation.attacker.soldierFormation, true);

  const reinforced = createCombat(
    unit({ abilities, scaleHp: 4 }),
    unit({ id: "ENEMY_TWO" }),
  );
  assert.equal(reinforced.attacker.scaleHp, 5);
  assert.equal(reinforced.attacker.currentHp, 7);
  assert.equal(reinforced.attacker.temporaryScaleHp, 1);
});
