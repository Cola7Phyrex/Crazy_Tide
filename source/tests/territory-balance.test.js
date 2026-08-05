import test from "node:test";
import assert from "node:assert/strict";
import { simulateCombat } from "../src/systems/combat.js";
import { generateOfficialInnistradTerritories } from "../src/systems/territory-generator.js";

const territories = generateOfficialInnistradTerritories();

function getBalanceMetrics(territory) {
  const guardBody = territory.garrison.templates.reduce(
    (sum, template) =>
      sum + template.initialCount * (template.hp + template.defense),
    0,
  );
  const guardPower = territory.garrison.templates.reduce(
    (sum, template) => sum + template.initialCount * template.power,
    0,
  );
  return {
    guardBody,
    guardPower,
    score:
      territory.maxFortitude +
      territory.maxStability +
      guardBody +
      guardPower * 2,
  };
}

test("15块生成领土没有全零攻击守军群或空防线", () => {
  assert.equal(territories.length, 15);
  for (const territory of territories) {
    assert.ok(territory.garrison.templates.length >= 2, territory.id);
    assert.ok(
      territory.garrison.templates.reduce(
        (sum, template) => sum + template.initialCount,
        0,
      ) >= 3,
      territory.id,
    );
    assert.ok(
      territory.garrison.templates.some((template) => template.power > 0),
      `${territory.id}的全部守军都没有攻击能力`,
    );
  }
});

test("轻量战斗探针不会与任何守军模板停滞或触发20回合上限", () => {
  const probe = {
    id: "BALANCE_PROBE_MID",
    name: "中档校准探针",
    power: 4,
    defense: 4,
    hp: 20,
    scaleHp: 10,
    colors: ["W"],
    abilities: [],
  };
  for (const territory of territories) {
    for (const template of territory.garrison.templates) {
      const result = simulateCombat(probe, {
        id: template.id,
        name: template.name,
        power: template.power,
        defense: template.defense,
        hp: template.hp,
        scaleHp: template.scaleHp,
        colors: template.colors,
        abilities: template.abilities,
      });
      assert.notEqual(result.reason, "STALEMATE", template.name);
      assert.notEqual(result.reason, "ROUND_LIMIT", template.name);
      assert.ok(result.round <= 6, `${template.name}战斗耗时异常`);
    }
  }
});

test("四档难度保持自由探索、沃达连邸、瑟班与狱窖的层级", () => {
  const byDifficulty = Object.groupBy(territories, (territory) =>
    territory.generator.difficultyId,
  );
  const freeScores = byDifficulty.FREE_EXPLORATION.map(
    (territory) => getBalanceMetrics(territory).score,
  );
  const freeMinimum = Math.min(...freeScores);
  const freeMaximum = Math.max(...freeScores);
  assert.ok(freeMaximum / freeMinimum < 1.5);

  const estateScore = getBalanceMetrics(byDifficulty.VOLDAREN_ESTATE[0]).score;
  assert.ok(estateScore > freeMaximum * 1.25);
  for (const thraben of byDifficulty.THRABEN) {
    assert.ok(getBalanceMetrics(thraben).score > freeMaximum);
  }
  const helvaultScore = getBalanceMetrics(byDifficulty.HELVAULT[0]).score;
  assert.ok(helvaultScore > Math.max(
    estateScore,
    ...byDifficulty.THRABEN.map(
      (territory) => getBalanceMetrics(territory).score,
    ),
  ) * 1.15);
});
