import { appendEvent, createGameEvent } from "./events.js";
import {
  hasResourceGain,
  settleEconomy,
} from "../systems/resources.js";
import { createInitialState } from "../state/initial-state.js";
import {
  deleteBlueprint,
  destroyPrototype,
  disbandLegion,
  instantiatePrototype,
  rebuildPrototype,
  saveNewBlueprint,
  updateExistingBlueprint,
} from "../systems/prototypes.js";
import {
  cancelProduction,
  queueLegionProduction,
  queueManaVaultUpgrade,
  queueMetathranProduction,
  settleProduction,
} from "../systems/production.js";
import {
  assignManaProductionSlot,
  assignManaProductionSlotGroup,
  setManaFacilityEnabled,
  setPrismaticLensColor,
  setPrismaticLensEnabled,
} from "../systems/artifacts.js";
import { isTestMode } from "../systems/testing-mode.js";
import { UI_THEME_IDS } from "../data/immersion-data.js";
import {
  acknowledgeBattleReview,
  acceptExecution,
  activateOliviaBloodFeast,
  advanceExpedition,
  castGrounded,
  castTasteForMayhem,
  castVirtuesRuin,
  refreshGavonyChallenge,
  setExpeditionSpeed,
  skipOliviaBloodFeast,
  startExpedition,
  unsummonExpedition,
} from "../systems/expedition.js";
import {
  selectResident,
  talkToResident,
} from "../systems/residents.js";
import {
  archiveLegendaryBlueprint,
  destroyLegendaryEntity,
  instantiateOlivia,
  rebuildOlivia,
  restoreLegendaryBlueprint,
  settleLegendaryRest,
  updateOliviaPlacements,
} from "../systems/legendary-prototypes.js";
import { settleAchievementRewards } from "../systems/achievement-rewards.js";
import { acknowledgeAchievement } from "../systems/career.js";
import { archiveCompletedRegion } from "../systems/world-map.js";
import {
  activateSpaceAnchor,
  returnBaseToSubspace,
} from "../systems/space-anchor.js";
import {
  archiveCelestial,
  archiveUniverse,
  freezeRandomCelestial,
} from "../systems/cosmic-archive.js";

const AUTOSAVE_INTERVAL_MS = 5000;
const OFFLINE_LOG_THRESHOLD_MS = 5000;

export class GameEngine {
  constructor(storageAdapter, now = () => Date.now()) {
    this.storage = storageAdapter;
    this.now = now;
    this.state = null;
    this.lastPersistedAt = 0;
    this.lastActiveTickAt = null;
    this.subscribers = new Set();
  }

  load() {
    const loadedState = this.storage.load();
    if (!loadedState) return null;

    const now = this.now();
    const settlement = settleEconomy(loadedState, now);
    this.state = settleLegendaryRest(
      settleProduction(settlement.state, now).state,
      now,
    );

    if (
      settlement.elapsedMs >= OFFLINE_LOG_THRESHOLD_MS &&
      hasResourceGain(settlement.gained)
    ) {
      this.state = appendEvent(
        this.state,
        createGameEvent(
          "OFFLINE_RESOURCES_SETTLED",
          {
            elapsedMs: settlement.elapsedMs,
            gained: settlement.gained,
          },
          now,
        ),
      );
    }

    this.persist(now);
    this.lastActiveTickAt = now;
    return this.state;
  }

  startNewGame(originId, landId) {
    const now = this.now();
    this.state = createInitialState({ originId, landId, now });
    this.lastActiveTickAt = now;
    this.persist(now);
    this.emit();
    return this.state;
  }

  archiveRegion(regionId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = archiveCompletedRegion(this.state, regionId, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "REGION_ARCHIVED",
        {
          regionId,
          territoryCount: result.archive.territoryCount,
          rewardCount: result.archive.rewards.length,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.archive;
  }

  freezeRandomCelestial(type) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = freezeRandomCelestial(this.state, type, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "RANDOM_CELESTIAL_FROZEN",
        {
          celestialId: result.record.id,
          name: result.record.name,
          celestialType: result.record.type,
          seed: result.record.seed,
          generatorVersion: result.record.generatorVersion,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.record;
  }

  archiveCelestial(nodeId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = archiveCelestial(this.state, nodeId, now);
    this.state = appendEvent(
      result.state,
      createGameEvent("CELESTIAL_ARCHIVED", { nodeId }, now),
    );
    this.persist(now);
    this.emit();
    return result.record;
  }

  archiveUniverse(universeId = "UNIVERSE_PRIMARY") {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = archiveUniverse(this.state, universeId, now);
    this.state = appendEvent(
      result.state,
      createGameEvent("UNIVERSE_ARCHIVED", { universeId }, now),
    );
    this.persist(now);
    this.emit();
    return result.record;
  }

  activateSpaceAnchor(territoryId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const settled = settleEconomy(this.state, now).state;
    this.state = appendEvent(
      activateSpaceAnchor(settled, territoryId, now),
      createGameEvent("SPACE_ANCHOR_ACTIVATED", { territoryId }, now),
    );
    this.persist(now);
    this.emit();
  }

  returnBaseToSubspace() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const settled = settleEconomy(this.state, now).state;
    this.state = appendEvent(
      returnBaseToSubspace(settled, now),
      createGameEvent("SPACE_ANCHOR_RETURNED", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  tick(now = this.now()) {
    if (!this.state) return null;
    this.state = settleEconomy(this.state, now).state;
    const production = settleProduction(this.state, now);
    this.state = production.state;
    this.state = settleLegendaryRest(this.state, now);
    for (const item of production.completed) {
      if (item.kind === "LEGION") {
        this.state = appendEvent(
          this.state,
          createGameEvent(
            "LEGION_PRODUCTION_COMPLETED",
            {
              name: item.value.name,
              legionId: item.value.id,
              replicaCount: item.replicaCount,
            },
            now,
          ),
        );
      } else if (item.kind === "LEGION_REINFORCED") {
        this.state = appendEvent(
          this.state,
          createGameEvent(
            "LEGION_REINFORCEMENT_COMPLETED",
            {
              name: item.value.name,
              legionId: item.value.id,
              scaleHp: item.scaleHp,
              replicaCount: item.replicaCount,
            },
            now,
          ),
        );
      } else if (item.kind === "MANA_FACILITY") {
        this.state = appendEvent(
          this.state,
          createGameEvent(
            "FACILITY_PRODUCTION_COMPLETED",
            {
              facilityId: item.value.id,
              cycleLabel: isTestMode(this.state) ? "2秒" : "分钟",
            },
            now,
          ),
        );
      } else if (item.kind === "MANA_VAULT") {
        this.state = appendEvent(
          this.state,
          createGameEvent(
            "MANA_VAULT_UPGRADE_COMPLETED",
            {
              level: item.value.level,
              colorlessCap: item.value.colorlessCap,
            },
            now,
          ),
        );
      }
    }
    const activeElapsed = this.lastActiveTickAt === null
      ? 0
      : Math.max(0, now - this.lastActiveTickAt);
    this.lastActiveTickAt = now;
    const expedition = advanceExpedition(this.state, activeElapsed, now);
    this.state = expedition.state;
    for (const event of expedition.events) {
      this.state = appendEvent(
        this.state,
        createGameEvent(event.type, event.payload, now),
      );
    }

    if (
      expedition.critical ||
      now - this.lastPersistedAt >= AUTOSAVE_INTERVAL_MS
    ) {
      this.persist(now);
    }

    this.emit();
    return this.state;
  }

  settleAfterPause(now = this.now()) {
    if (!this.state) return null;
    const settlement = settleEconomy(this.state, now);
    const production = settleProduction(settlement.state, now);
    this.state = settleLegendaryRest(production.state, now);
    this.lastActiveTickAt = now;

    if (
      settlement.elapsedMs >= OFFLINE_LOG_THRESHOLD_MS &&
      hasResourceGain(settlement.gained)
    ) {
      this.state = appendEvent(
        this.state,
        createGameEvent(
          "OFFLINE_RESOURCES_SETTLED",
          {
            elapsedMs: settlement.elapsedMs,
            gained: settlement.gained,
          },
          now,
        ),
      );
    }

    this.persist(now);
    this.emit();
    return this.state;
  }

  saveBlueprint(draft) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = saveNewBlueprint(this.state, draft, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "BLUEPRINT_SAVED",
        { blueprintId: result.blueprint.id, name: result.blueprint.name },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.blueprint;
  }

  updateBlueprint(blueprintId, draft) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = updateExistingBlueprint(
      this.state,
      blueprintId,
      draft,
      now,
    );
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "BLUEPRINT_UPDATED",
        { blueprintId, name: result.blueprint.name },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.blueprint;
  }

  rebuildPrototype(prototypeId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const prototype = this.state.prototypes.find(
      (item) => item.id === prototypeId,
    );
    const blueprint = this.state.blueprints.find(
      (item) => item.id === prototype?.blueprintId,
    );
    this.state = rebuildPrototype(this.state, prototypeId, now);
    this.state = appendEvent(
      this.state,
      createGameEvent(
        "PROTOTYPE_REBUILT",
        { name: prototype.name, cost: blueprint.equivalentValue },
        now,
      ),
    );
    this.persist(now);
    this.emit();
  }

  disbandLegion(legionId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = disbandLegion(this.state, legionId);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "LEGION_DISBANDED",
        {
          legionId,
          name: result.legion.name,
          replicaCount: result.legion.replicaCount ?? 0,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
  }

  destroyPrototype(prototypeId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = destroyPrototype(this.state, prototypeId);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "PROTOTYPE_DESTROYED",
        {
          prototypeId,
          name: result.prototype.name,
          blueprintId: result.prototype.blueprintId,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
  }

  instantiatePrototype(blueprintId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const blueprint = this.state.blueprints.find(
      (item) => item.id === blueprintId,
    );
    const result = instantiatePrototype(
      this.state,
      blueprintId,
      now,
    );
    this.state = appendEvent(
      {
        ...result.state,
        flags: {
          ...result.state.flags,
          guideFirstPrototypeCompleted: true,
        },
      },
      createGameEvent(
        "PROTOTYPE_INSTANTIATED",
        {
          blueprintId,
          prototypeId: result.prototype.id,
          name: result.prototype.name,
          cost: blueprint.equivalentValue,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.prototype;
  }

  deleteBlueprint(blueprintId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = deleteBlueprint(this.state, blueprintId);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "BLUEPRINT_DELETED",
        { blueprintId, name: result.blueprint.name },
        now,
      ),
    );
    this.persist(now);
    this.emit();
  }

  queueLegion(prototypeId, scaleHp) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = queueLegionProduction(
      this.state,
      { prototypeId, scaleHp },
      now,
    );
    this.state = appendEvent(
      {
        ...result.state,
        flags: {
          ...result.state.flags,
          guideFirstLegionCompleted:
            result.job?.mode === "CREATE" || Boolean(result.legion)
              ? true
              : result.state.flags?.guideFirstLegionCompleted,
          guideLegionReinforced:
            result.job?.mode === "REINFORCE" || result.reinforced
              ? true
              : result.state.flags?.guideLegionReinforced,
        },
      },
      createGameEvent(
        "LEGION_PRODUCTION_QUEUED",
        {
          scaleHp: Number(scaleHp),
          mode: result.job?.mode ?? "CREATE",
          replicaCount:
            result.job?.replicaCount ?? result.legion?.replicaCount ?? 0,
        },
        now,
      ),
    );
    if (result.legion) {
      this.state = appendEvent(
        this.state,
        createGameEvent(
          result.reinforced
            ? "LEGION_REINFORCEMENT_COMPLETED"
            : "LEGION_PRODUCTION_COMPLETED",
          {
            name: result.legion.name,
            legionId: result.legion.id,
            scaleHp: Number(scaleHp),
            replicaCount: result.job?.replicaCount ?? 0,
          },
          now,
        ),
      );
    }
    this.persist(now);
    this.emit();
    return result;
  }

  queueMetathran() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = queueMetathranProduction(this.state, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "FACILITY_PRODUCTION_QUEUED",
        {
          cost: isTestMode(this.state) ? 0 : result.job.cost.C,
          durationMs: result.job.completesAt - result.job.startedAt,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result;
  }

  queueManaVaultUpgrade() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = queueManaVaultUpgrade(this.state, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "MANA_VAULT_UPGRADE_QUEUED",
        {
          level: result.job.targetLevel,
          cost: isTestMode(this.state) ? 0 : result.job.cost.C,
          durationMs: result.job.completesAt - result.job.startedAt,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result;
  }

  cancelProduction(jobId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const job = this.state.productionQueue.find((item) => item.id === jobId);
    if (!job) throw new Error("生产项目不存在");
    this.state = cancelProduction(this.state, jobId);
    this.state = appendEvent(
      this.state,
      createGameEvent("PRODUCTION_CANCELLED", { refund: job.cost }, now),
    );
    this.persist(now);
    this.emit();
  }

  setManaFacilityEnabled(facilityId, enabled) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = setManaFacilityEnabled(this.state, facilityId, enabled);
    this.persist(now);
    this.emit();
  }

  assignManaProductionSlot(slotIndex, facilityId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = assignManaProductionSlot(
      this.state,
      slotIndex,
      facilityId || null,
    );
    this.persist(now);
    this.emit();
  }

  assignManaProductionSlotGroup(slotIndex, groupId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = assignManaProductionSlotGroup(
      this.state,
      slotIndex,
      groupId || null,
    );
    this.persist(now);
    this.emit();
  }

  setPrismaticLensEnabled(enabled) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = setPrismaticLensEnabled(this.state, enabled);
    this.persist(now);
    this.emit();
  }

  setPrismaticLensColor(color) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = setPrismaticLensColor(this.state, color);
    this.persist(now);
    this.emit();
  }

  startExpedition(
    territoryId,
    legionId,
    command,
    {
      legendaryPrototypeId = null,
      commanderLegendaryPrototypeId = null,
      prototypeId = null,
    } = {},
  ) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = startExpedition(
      this.state,
      {
        territoryId,
        legionId,
        command,
        prototypeId,
        legendaryPrototypeId,
        commanderLegendaryPrototypeId,
      },
      now,
    );
    this.state = appendEvent(
      result.state,
      createGameEvent(result.event.type, result.event.payload, now),
    );
    this.lastActiveTickAt = now;
    this.persist(now);
    this.emit();
    return this.state.activeExpedition;
  }

  instantiateOlivia() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = instantiateOlivia(this.state, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "LEGENDARY_PROTOTYPE_INSTANTIATED",
        {
          prototypeId: result.entity.id,
          name: result.entity.name,
          cost: result.cost.C,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.entity;
  }

  rebuildOlivia(entityId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = rebuildOlivia(this.state, entityId, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "LEGENDARY_PROTOTYPE_REBUILT",
        {
          prototypeId: result.entity.id,
          previousPrototypeId: entityId,
          name: result.entity.name,
          cost: result.cost.C,
        },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.entity;
  }

  updateOliviaPlacements(placements) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = updateOliviaPlacements(this.state, placements, now);
    this.state = result.state;
    this.persist(now);
    this.emit();
    return result.blueprint;
  }

  destroyLegendaryEntity(entityId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = destroyLegendaryEntity(this.state, entityId, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(
        "LEGENDARY_ENTITY_DESTROYED",
        { prototypeId: entityId, name: result.entity.name },
        now,
      ),
    );
    this.persist(now);
    this.emit();
    return result.entity;
  }

  archiveLegendaryBlueprint(blueprintId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = archiveLegendaryBlueprint(this.state, blueprintId, now);
    this.state = result.state;
    this.persist(now);
    this.emit();
    return result.configuration;
  }

  restoreLegendaryBlueprint(blueprintId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = restoreLegendaryBlueprint(this.state, blueprintId, now);
    this.state = result.state;
    this.persist(now);
    this.emit();
    return result.configuration;
  }

  activateOliviaBloodFeast() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = activateOliviaBloodFeast(this.state, now);
    this.persist(now);
    this.emit();
  }

  skipOliviaBloodFeast() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = skipOliviaBloodFeast(this.state, now);
    this.persist(now);
    this.emit();
  }

  setExpeditionSpeed(speed) {
    if (!this.state) return;
    this.state = setExpeditionSpeed(this.state, speed);
    this.persist(this.now());
    this.emit();
  }

  castVirtuesRuin() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = castVirtuesRuin(this.state, now);
    this.state = appendEvent(
      this.state,
      createGameEvent("VIRTUES_RUIN_CAST", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  castTasteForMayhem() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = castTasteForMayhem(this.state, now);
    this.state = appendEvent(
      this.state,
      createGameEvent("TASTE_FOR_MAYHEM_CAST", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  castGrounded() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = castGrounded(this.state, now);
    this.state = appendEvent(
      this.state,
      createGameEvent("GROUNDED_CAST", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  unsummon() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = unsummonExpedition(this.state, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(result.event.type, result.event.payload, now),
    );
    this.persist(now);
    this.emit();
  }

  acceptExecution() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = acceptExecution(this.state, now);
    this.state = appendEvent(
      result.state,
      createGameEvent(result.event.type, result.event.payload, now),
    );
    this.persist(now);
    this.emit();
  }

  refreshGavony() {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = refreshGavonyChallenge(this.state);
    this.state = appendEvent(
      this.state,
      createGameEvent("GAVONY_CHALLENGE_REFRESHED", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  acknowledgeMvpThanks() {
    if (!this.state?.flags.mvpThanksPending) return;
    const now = this.now();
    this.state = {
      ...this.state,
      flags: {
        ...this.state.flags,
        mvpThanksPending: false,
      },
    };
    this.state = appendEvent(
      this.state,
      createGameEvent("MVP_THANKS_ACKNOWLEDGED", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  acknowledgeAchievement(achievementId = null) {
    if (!this.state) return;
    const now = this.now();
    this.state = acknowledgeAchievement(this.state, achievementId);
    this.persist(now);
    this.emit();
  }

  selectResident(residentId) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    this.state = selectResident(this.state, residentId);
    this.persist(now);
    this.emit();
  }

  talkToResident(argument = "", residentId = null) {
    if (!this.state) throw new Error("请先建立新游戏");
    const now = this.now();
    const result = talkToResident(this.state, {
      residentId,
      argument,
      now,
    });
    this.state = result.state;
    this.persist(now);
    this.emit();
    return result;
  }

  setExecutionWarningMode(mode) {
    if (!["PAUSE", "PAUSE_60", "CONTINUE"].includes(mode)) {
      throw new Error("处决警告模式无效");
    }
    if (!this.state) return;
    const now = this.now();
    this.state = {
      ...this.state,
      settings: { ...this.state.settings, executionWarningMode: mode },
    };
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  setPauseAfterCombat(enabled) {
    if (!this.state) return;
    const now = this.now();
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        pauseAfterCombat: Boolean(enabled),
      },
    };
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  setTestMode(enabled) {
    if (!this.state) return;
    const now = this.now();
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        testMode: Boolean(enabled),
      },
    };
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  setManaDisplayMode(mode) {
    if (!["SYMBOL", "LETTER"].includes(mode)) {
      throw new Error("法术力显示模式无效");
    }
    if (!this.state) {
      this.storage.saveSettings({
        ...this.storage.loadSettings(),
        manaDisplayMode: mode,
      });
      return;
    }
    const now = this.now();
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        manaDisplayMode: mode,
      },
    };
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  setThemeId(themeId) {
    if (!UI_THEME_IDS.includes(themeId)) {
      throw new Error("界面配色无效");
    }
    if (!this.state) {
      this.storage.saveSettings({
        ...this.storage.loadSettings(),
        themeId,
      });
      return;
    }
    const now = this.now();
    const changed = this.state.settings.themeId !== themeId;
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        themeId,
      },
      flags: {
        ...this.state.flags,
        guideThemeChanged:
          this.state.flags?.guideThemeChanged || changed,
      },
    };
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  markGuideRegionListened() {
    if (!this.state || this.state.flags?.guideRegionListened) return;
    const now = this.now();
    this.state = {
      ...this.state,
      flags: {
        ...this.state.flags,
        guideRegionListened: true,
      },
    };
    this.persist(now);
    this.emit();
  }

  acknowledgeBattleReview() {
    if (!this.state?.battleReview) return;
    const now = this.now();
    this.state = acknowledgeBattleReview(this.state);
    this.persist(now);
    this.emit();
  }

  acknowledgeExpeditionResult() {
    if (!this.state?.lastExpedition || this.state.lastExpedition.resultAcknowledged) {
      return;
    }
    const now = this.now();
    this.state = {
      ...this.state,
      lastExpedition: {
        ...this.state.lastExpedition,
        resultAcknowledged: true,
      },
    };
    this.persist(now);
    this.emit();
  }

  saveManual() {
    if (!this.state) return;
    const now = this.now();
    this.state = appendEvent(
      this.state,
      createGameEvent("MANUAL_SAVE_COMPLETED", {}, now),
    );
    this.persist(now);
    this.emit();
  }

  exportJson() {
    if (!this.state) throw new Error("没有可以导出的游戏存档");
    const now = this.now();
    this.state = appendEvent(
      this.state,
      createGameEvent("SAVE_EXPORTED", {}, now),
    );
    this.persist(now);
    this.emit();
    return this.storage.export(this.state);
  }

  importJson(jsonText) {
    const now = this.now();
    const importedState = this.storage.import(jsonText);
    const settlement = settleEconomy(importedState, now);
    const production = settleProduction(settlement.state, now);
    this.state = appendEvent(
      production.state,
      createGameEvent("SAVE_IMPORTED", {}, now),
    );
    this.lastActiveTickAt = now;
    this.persist(now);
    this.emit();
    return this.state;
  }

  setEffectsEnabled(enabled) {
    const now = this.now();

    if (!this.state) {
      this.storage.saveSettings({
        ...this.storage.loadSettings(),
        effectsEnabled: enabled,
      });
      return;
    }

    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        effectsEnabled: enabled,
      },
    };
    this.state = appendEvent(
      this.state,
      createGameEvent("EFFECTS_TOGGLED", { enabled }, now),
    );
    this.storage.saveSettings(this.state.settings);
    this.persist(now);
    this.emit();
  }

  persist(now = this.now()) {
    if (!this.state) return;
    this.state = settleAchievementRewards({
      ...this.state,
      lastSavedAt: now,
    }, now);
    this.storage.save(this.state);
    this.lastPersistedAt = now;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  emit() {
    for (const callback of this.subscribers) callback(this.state);
  }
}
