import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { createBlueprintDraft } from "../src/systems/blueprints.js";
import {
  getComponent,
  getJob,
  isContentUnlocked,
} from "../src/data/prototype-data.js";
import {
  ARTIFACT_CATALOG,
  ENCHANTMENT_CATALOG,
  SPELL_CATALOG,
  getUnlockedArtifacts,
  isArcanaUnlocked,
} from "../src/data/arcana-data.js";
import { PRISMATIC_LENS_ID } from "../src/data/artifact-data.js";
import { hasArtifact } from "../src/systems/testing-mode.js";

function stateFor(originId) {
  return createInitialState({
    originId,
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: `CT-UNLOCK-${originId}`,
  });
}

test("新蓝图默认使用人类与无职业", () => {
  const draft = createBlueprintDraft("W");
  assert.equal(draft.raceId, "RACE_HUMAN");
  assert.equal(draft.jobId, "JOB_NONE");
});

test("装备、职业、法术与结界按起源颜色解锁", () => {
  const white = stateFor("ORIGIN_W");
  const blue = stateFor("ORIGIN_U");
  const black = stateFor("ORIGIN_B");
  const red = stateFor("ORIGIN_R");
  const green = stateFor("ORIGIN_G");

  assert.equal(isContentUnlocked(getComponent("EQUIPMENT_GREATSWORD"), white), true);
  assert.equal(isContentUnlocked(getComponent("EQUIPMENT_GREATSWORD"), red), true);
  assert.equal(isContentUnlocked(getComponent("EQUIPMENT_GREATSWORD"), blue), false);
  assert.equal(isContentUnlocked(getJob("JOB_ROGUE"), blue), true);
  assert.equal(isContentUnlocked(getJob("JOB_ROGUE"), black), true);
  assert.equal(isContentUnlocked(getJob("JOB_ROGUE"), white), false);
  assert.equal(isContentUnlocked(getComponent("MODIFICATION_CLAWS"), green), true);
  assert.equal(
    isContentUnlocked(getComponent("EQUIPMENT_RANGERS_LONGBOW"), green),
    true,
  );

  const demystify = SPELL_CATALOG.find((item) => item.id === "SPELL_DEMYSTIFY");
  const unsummon = SPELL_CATALOG.find((item) => item.id === "SPELL_UNSUMMON");
  const virtuesRuin = ENCHANTMENT_CATALOG.find(
    (item) => item.id === "ENCHANTMENT_VIRTUES_RUIN",
  );
  const mayhem = ENCHANTMENT_CATALOG.find(
    (item) => item.id === "ENCHANTMENT_TASTE_FOR_MAYHEM",
  );
  const grounded = ENCHANTMENT_CATALOG.find(
    (item) => item.id === "ENCHANTMENT_GROUNDED",
  );

  assert.equal(isArcanaUnlocked(demystify, white), true);
  assert.equal(isArcanaUnlocked(unsummon, blue), true);
  assert.equal(isArcanaUnlocked(virtuesRuin, black), true);
  assert.equal(isArcanaUnlocked(mayhem, red), true);
  assert.equal(isArcanaUnlocked(grounded, green), true);
  assert.equal(isArcanaUnlocked(unsummon, white), false);
});

test("测试模式解锁全部档案但不凭空授予尚未获得的神器实体", () => {
  const state = stateFor("ORIGIN_U");
  state.settings.testMode = true;

  assert.equal(isContentUnlocked(getComponent("MODIFICATION_ELVEN_EARS"), state), true);
  assert.equal(isContentUnlocked(getComponent("EQUIPMENT_GREATSWORD"), state), true);
  assert.equal(
    SPELL_CATALOG.every((item) => isArcanaUnlocked(item, state)),
    true,
  );
  assert.equal(
    ENCHANTMENT_CATALOG.every((item) => isArcanaUnlocked(item, state)),
    true,
  );
  assert.equal(getUnlockedArtifacts(state).length, ARTIFACT_CATALOG.length);
  assert.equal(hasArtifact(state, PRISMATIC_LENS_ID), false);
});
