import { createGameEvent } from "../core/events.js";
import { getLand, getOrigin } from "../data/game-data.js";
import { createResourceState } from "../systems/resources.js";
import { createTerritoryStates } from "../data/territory-data.js";
import { CORE_ARTIFACT_IDS } from "../data/artifact-data.js";
import { createInitialWorldMapState } from "../data/world-map-data.js";
import { createRewardProgressState } from "../systems/rewards.js";
import { createResidentProgressState } from "../systems/residents.js";
import {
  createAchievementProgressState,
  createCareerProgressState,
} from "../systems/career.js";

export const SAVE_SCHEMA_VERSION = 9;

function createGameId(now) {
  const randomPart =
    globalThis.crypto?.randomUUID?.().slice(0, 8).toUpperCase() ??
    Math.random().toString(36).slice(2, 10).toUpperCase();
  return `CT-${new Date(now).toISOString().slice(0, 10)}-${randomPart}`;
}

export function getInitialBiofactorIds(originColor) {
  return [
    "RACE_HUMAN",
    "JOB_WARRIOR",
    "EQUIPMENT_BRONZE_SWORD",
    "EQUIPMENT_STOUT_SHIELD",
    ...(originColor === "W" || originColor === "R"
      ? ["EQUIPMENT_GREATSWORD"]
      : []),
    ...(originColor === "W" || originColor === "U"
      ? ["RACE_SPIRIT"]
      : []),
    ...(originColor === "B" ? ["RACE_ZOMBIE", "JOB_ROGUE"] : []),
    ...(originColor === "U" ? ["JOB_ROGUE"] : []),
    ...(originColor === "R" ? ["RACE_GOBLIN"] : []),
    ...(originColor === "G"
      ? [
          "RACE_BEAST",
          "MODIFICATION_CLAWS",
          "EQUIPMENT_RANGERS_LONGBOW",
        ]
      : []),
  ];
}

export function createInitialState({
  originId,
  landId,
  now = Date.now(),
  gameId = createGameId(now),
}) {
  const origin = getOrigin(originId);
  const land = getLand(landId);

  if (!origin || !land) {
    throw new Error("无法建立新游戏：法术力起源或初始土地无效");
  }

  const initialEvent = createGameEvent(
    "NEW_GAME_STARTED",
    { originId, landId },
    now,
  );

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameId,
    createdAt: now,
    lastSavedAt: now,
    clock: {
      economyLastSettledAt: now,
      expeditionElapsedMs: 0,
      productionCycles: {
        ORIGIN: 0,
        LAND: 0,
        RESIDUE: 0,
      },
    },
    settings: {
      effectsEnabled: true,
      executionWarningMode: "PAUSE",
      pauseAfterCombat: true,
      testMode: false,
      manaDisplayMode: "SYMBOL",
      themeId: "SEAL_TERMINAL",
    },
    resources: createResourceState(origin.color, land.color),
    base: {
      originId,
      landId,
      anchorLocation: {
        status: "SUBSPACE",
        descentMode: null,
        universeId: null,
        worldId: null,
        regionId: null,
        territoryId: null,
        territoryName: null,
        lands: [],
        anchoredAt: null,
        returnedAt: null,
        instanceId: null,
      },
      residueActive: true,
      manaProductionSlots: 2,
      productionQueueCap: 1,
      blueprintCap: 10,
      prototypeCap: 3,
      legionScaleCap: 10,
      manaVaultLevel: 0,
    },
    artifacts: [...CORE_ARTIFACT_IDS],
    manaFacilities: [],
    manaProductionSlotAssignments: [],
    prismaticLens: {
      enabled: false,
      selectedColor: "W",
    },
    unlockedBiofactors: getInitialBiofactorIds(origin.color),
    blueprints: [],
    prototypes: [],
    legendaryBlueprints: [],
    legendaryIdentities: [],
    legendaryPrototypes: [],
    legions: [],
    productionQueue: [],
    territories: createTerritoryStates(),
    worldMap: createInitialWorldMapState(),
    activeExpedition: null,
    battleReview: null,
    intel: {},
    rewards: {},
    rewardProgress: createRewardProgressState(),
    residentProgress: createResidentProgressState(),
    careerProgress: createCareerProgressState(now),
    achievementProgress: createAchievementProgressState(),
    flags: {
      firstVillageConquered: false,
      metathranRecipeUnlocked: false,
      gavonyFirstConquered: false,
      gavonyRefreshAvailable: false,
      mvpCompleted: false,
      mvpThanksPending: false,
      manaVaultExpansionUnlocked: false,
      guideFirstPrototypeCompleted: false,
      guideRegionListened: false,
      guideFirstLegionCompleted: false,
      guideLegionReinforced: false,
      guideThemeChanged: false,
    },
    rngState: 1,
    recentLogs: [initialEvent],
  };
}
