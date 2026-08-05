import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import { getBaseStatusView } from "../src/systems/base-status.js";
import {
  getAvailableResidents,
  getResidentContextTags,
  getResidentCurrentLine,
  selectResident,
  talkToResident,
} from "../src/systems/residents.js";
import { OLIVIA_BLUEPRINT_ID } from "../src/data/legendary-prototype-data.js";
import { RESIDENT_OLIVIA_ID } from "../src/data/resident-data.js";

function createState() {
  return createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-BASE-CONTEXT",
  });
}

test("空间状态由法术力负载、生产队列与远征链路派生", () => {
  const state = createState();
  state.resources.amounts.W = state.resources.caps.W;
  state.productionQueue.push({
    id: "PRODUCTION_TEST",
    type: "LEGION",
  });
  state.activeExpedition = {
    command: "INFILTRATION",
    phase: "INFILTRATING",
  };

  const view = getBaseStatusView(state);
  assert.equal(view.dominantManaColor, "W");
  assert.equal(view.manaSaturation, 1);
  assert.equal(view.manaStatus, "接近饱和");
  assert.equal(view.productionActive, true);
  assert.equal(view.productionCount, 1);
  assert.equal(view.linkMode, "covert");
  assert.equal(view.expeditionLabel, "渗透连接");
});

test("处决警告覆盖普通远征链路状态", () => {
  const state = createState();
  state.activeExpedition = {
    command: "CONQUEST",
    phase: "EXECUTION_WARNING",
  };
  const view = getBaseStatusView(state);
  assert.equal(view.linkMode, "critical");
  assert.equal(view.executionWarning, true);
  assert.equal(view.expeditionLabel, "处决警告");
});

test("Lilith按基地上下文回应并保存交谈进度", () => {
  const state = createState();
  const rngBefore = state.rngState;
  const result = talkToResident(state, { now: 2000 });

  assert.equal(result.resident.name, "Lilith");
  assert.equal(result.dialogue.id, "LILITH_FIRST_CONTACT");
  assert.equal(result.state.residentProgress.interactionCount, 1);
  assert.equal(result.state.residentProgress.lastSpokenAt, 2000);
  assert.ok(
    result.state.residentProgress.seenDialogueIds.includes(
      "LILITH_FIRST_CONTACT",
    ),
  );
  assert.equal(result.state.rngState, rngBefore);
  assert.equal(
    getResidentCurrentLine(result.state),
    result.dialogue.text,
  );
});

test("Lilith识别名字与自我身份关键词", () => {
  const state = createState();
  const first = talkToResident(state, {
    argument: "Lilith 你是谁",
    now: 2000,
  });
  const second = talkToResident(first.state, {
    argument: "Lilith 你是谁",
    now: 3000,
  });
  assert.match(first.dialogue.id, /^LILITH_ABOUT_SELF_/);
  assert.match(first.dialogue.text, /亚空间/);
  assert.notEqual(second.dialogue.id, first.dialogue.id);
});

test("高法术力负载不会长期垄断Lilith的回应", () => {
  const state = createState();
  const firstContact = talkToResident(state, { now: 2000 });
  const manaLine = talkToResident(firstContact.state, { now: 3000 });
  const alternateScene = talkToResident(manaLine.state, { now: 4000 });
  const nextManaLine = talkToResident(alternateScene.state, { now: 5000 });

  assert.match(
    manaLine.dialogue.id,
    /^LILITH_COLORLESS_MANA_NEAR_CAP_/,
  );
  assert.match(alternateScene.dialogue.id, /^LILITH_NO_BLUEPRINTS_/);
  assert.match(
    nextManaLine.dialogue.id,
    /^LILITH_COLORLESS_MANA_NEAR_CAP_/,
  );
  assert.notEqual(nextManaLine.dialogue.id, manaLine.dialogue.id);
});

test("Lilith上下文同时识别远征、渗透与法术力高负载", () => {
  const state = createState();
  state.resources.amounts.C = state.resources.caps.C;
  state.activeExpedition = {
    command: "INFILTRATION",
    phase: "INFILTRATING",
  };
  assert.deepEqual(
    getResidentContextTags(state).filter((tag) =>
      [
        "EXPEDITION_ACTIVE",
        "INFILTRATION_ACTIVE",
        "MANA_NEAR_CAP",
      ].includes(tag),
    ),
    [
      "INFILTRATION_ACTIVE",
      "EXPEDITION_ACTIVE",
      "MANA_NEAR_CAP",
    ],
  );
});

test("Lilith识别死亡原体、待命军团与远征结果场景", () => {
  const state = createState();
  state.prototypes.push({ id: "PROTOTYPE_TEST", status: "DEAD" });
  state.legions.push({ id: "LEGION_TEST", currentHp: 3 });
  state.lastExpedition = { outcome: "FAILURE" };
  const tags = getResidentContextTags(state);

  assert.ok(tags.includes("PROTOTYPE_DEAD"));
  assert.ok(tags.includes("LEGION_READY"));
  assert.ok(tags.includes("LAST_EXPEDITION_FAILURE"));
});

test("沃达连蓝图解锁后可切换在线对象并保持独立首次联系", () => {
  let state = createState();
  assert.throws(
    () =>
      talkToResident(state, {
        argument: "沃达连 你是谁",
        now: 1500,
      }),
    /沃达连尚未接入基地通讯/,
  );
  state = talkToResident(state, { now: 2000 }).state;
  assert.deepEqual(
    getAvailableResidents(state).map((resident) => resident.id),
    ["RESIDENT_LILITH"],
  );

  state.rewardProgress.unlockedContentIds.push(OLIVIA_BLUEPRINT_ID);
  assert.deepEqual(
    getAvailableResidents(state).map((resident) => resident.id),
    ["RESIDENT_LILITH", RESIDENT_OLIVIA_ID],
  );
  state = selectResident(state, RESIDENT_OLIVIA_ID);
  const firstContact = talkToResident(state, { now: 3000 });
  assert.equal(firstContact.resident.id, RESIDENT_OLIVIA_ID);
  assert.equal(firstContact.dialogue.id, "OLIVIA_FIRST_CONTACT");
  assert.match(firstContact.dialogue.text, /效忠|利益|力量/);

  const addressed = talkToResident(firstContact.state, {
    argument: "沃达连 你是谁",
    now: 4000,
  });
  assert.equal(addressed.resident.id, RESIDENT_OLIVIA_ID);
  assert.match(addressed.dialogue.id, /^OLIVIA_ABOUT_SELF_/);
  assert.equal(
    addressed.state.residentProgress.selectedResidentId,
    RESIDENT_OLIVIA_ID,
  );
});
