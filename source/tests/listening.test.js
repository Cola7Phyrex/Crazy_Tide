import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import {
  LISTENING_STATES,
  getListeningContext,
} from "../src/systems/listening.js";

function makeState() {
  return createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-LISTENING",
  });
}

test("聆听按观测区域和领土状态切换文本池", () => {
  const territoryId = "TERRITORY_NEPHALIA_DROWNYARD";
  let state = makeState();
  const options = {
    observedNodeId: "REGION_NEPHALIA",
    territoryId,
  };
  assert.equal(
    getListeningContext(state, options).stateId,
    LISTENING_STATES.UNSCOUTED,
  );

  state = {
    ...state,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...state.territories[territoryId],
        routeIntelLevel: 1,
      },
    },
  };
  assert.equal(
    getListeningContext(state, options).stateId,
    LISTENING_STATES.SCOUTED,
  );

  state = {
    ...state,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...state.territories[territoryId],
        currentFortitude: state.territories[territoryId].currentFortitude - 1,
      },
    },
  };
  assert.equal(
    getListeningContext(state, options).stateId,
    LISTENING_STATES.DAMAGED,
  );

  state = {
    ...state,
    activeExpedition: { territoryId },
  };
  assert.equal(
    getListeningContext(state, options).stateId,
    LISTENING_STATES.EXPEDITION_ACTIVE,
  );

  state = {
    ...state,
    activeExpedition: null,
    territories: {
      ...state.territories,
      [territoryId]: {
        ...state.territories[territoryId],
        conquered: true,
      },
    },
  };
  const conquered = getListeningContext(state, options);
  assert.equal(conquered.stateId, LISTENING_STATES.CONQUERED);
  assert.match(conquered.source, /涅非利亚沉船地/);
  assert.ok(conquered.pool.every((line) => /潮|涅非利亚|尸|实验/.test(line)));
});

test("没有观测区域时继续使用亚空间全局聆听", () => {
  const context = getListeningContext(makeState(), {
    observedNodeId: "WORLD_INNISTRAD",
  });
  assert.equal(context.regionId, null);
  assert.equal(context.stateId, null);
  assert.match(context.source, /SUBSPACE/);
  assert.ok(context.pool.length >= 10);
});

test("已压缩区域继续使用已征服聆听文本而不会退回未侦查状态", () => {
  const state = makeState();
  const territoryId = "TERRITORY_KESSIG_HUNTER_HOUSE";
  const territories = { ...state.territories };
  delete territories[territoryId];
  const archived = {
    ...state,
    territories,
    worldMap: {
      ...state.worldMap,
      archivedNodeIds: ["REGION_KESSIG"],
    },
  };
  const context = getListeningContext(archived, {
    observedNodeId: "REGION_KESSIG",
    territoryId,
  });
  assert.equal(context.stateId, LISTENING_STATES.CONQUERED);
});
