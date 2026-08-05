import "subsetted-fonts/SarasaUiSC-Regular/SarasaUiSC-Regular.css";
import "./styles/base.css";
import manaWhiteUrl from "./assets/mana-symbols/W.svg";
import manaBlueUrl from "./assets/mana-symbols/U.svg";
import manaBlackUrl from "./assets/mana-symbols/B.svg";
import manaRedUrl from "./assets/mana-symbols/R.svg";
import manaGreenUrl from "./assets/mana-symbols/G.svg";
import manaColorlessUrl from "./assets/mana-symbols/C.svg";
import lilithPortraitUrl from "./assets/residents/lilith-subspace-engraving.png";
import oliviaPortraitUrl from "./assets/residents/olivia-voldaren-engraving.png";
import startupVoidExileUrl from "./assets/startup/cosmic-void-exile.webp";
import {
  navItems,
} from "./data/mock-data.js";
import { GameEngine } from "./core/game-engine.js";
import {
  formatEventTime,
  presentEvent,
} from "./core/events.js";
import {
  COLOR_ORDER,
  COLORS,
  LANDS,
  ORIGINS,
  getLand,
  getOrigin,
} from "./data/game-data.js";
import {
  ABILITIES,
  COMPONENTS,
  JOBS,
  RACES,
  getAbilityDefinition,
  getComponent,
  getJob,
  getRace,
  isContentUnlocked,
} from "./data/prototype-data.js";
import {
  TERRITORIES,
  getGarrisonTemplate,
  getTerritoryAccessReason,
  getTerritory,
  getTerritoryForState,
  getTerritoriesForRegion,
  isTerritoryUnlocked,
} from "./data/territory-data.js";
import {
  MAP_CONTENT_STATUS,
  MAP_NODE_TYPES,
  getMapChildren,
  getMapNode,
  getMapPath,
} from "./data/world-map-data.js";
import {
  SAVE_SCHEMA_VERSION,
  createInitialState,
  getInitialBiofactorIds,
} from "./state/initial-state.js";
import { BrowserStorageAdapter } from "./storage/browser-storage.js";
import {
  getMillisecondsToNextCollection,
  getProductionRates,
} from "./systems/resources.js";
import {
  canAffordGameCost,
  getResourceCycleMs,
  hasArtifact,
  isTestMode,
} from "./systems/testing-mode.js";
import {
  ARTIFACT_NAMES,
  MANA_VAULT_LEVELS,
  METATHRAN_FACILITY_TYPE,
  METATHRAN_YIELD_PER_MINUTE,
  PRISMATIC_LENS_ID,
  SPACE_ANCHOR_ID,
  THRAN_DYNAMO_ID,
  THRAN_YIELD_PER_MINUTE,
} from "./data/artifact-data.js";
import {
  ENCHANTMENT_CATALOG,
  SPELL_CATALOG,
  getUnlockedArtifacts,
  isArcanaUnlocked,
} from "./data/arcana-data.js";
import {
  DEFAULT_UI_THEME,
  ELF_QUEEN_DECLARATION,
  ELF_QUEEN_DECLARATION_TITLE,
  OPENING_NARRATIVE,
  resolveNarrativeEntry,
  SUBSPACE_SHOUT_RESPONSES,
  UI_THEMES,
  UI_THEME_IDS,
} from "./data/immersion-data.js";
import {
  createBlueprintDraft,
  createBlueprintDraftFromBlueprint,
  deriveBlueprint,
  findFirstPlacement,
  formatCost,
  getPlacementSize,
  inspectGrid,
  movePlacement,
} from "./systems/blueprints.js";
import {
  getBiofactorEffectItems,
  getBiofactorEffectTags,
  getBiofactorRequirementSummary,
  getBiofactorSearchText,
  hasVisibleAbilityTitle,
} from "./systems/biofactor-presentation.js";
import { isEmptyStandbyLegion } from "./systems/prototypes.js";
import {
  getActiveManaProductionSlots,
  getManaProductionSlotAssignments,
  MANA_FACILITY_GROUP_METATHRAN,
} from "./systems/artifacts.js";
import {
  getSpaceAnchorTargets,
  summarizeLandIds,
} from "./systems/space-anchor.js";
import {
  GROUNDED_ID,
  TASTE_FOR_MAYHEM_ID,
  VIRTUES_RUIN_ID,
} from "./systems/expedition.js";
import { getMapNodePresentationStatus } from "./systems/world-map.js";
import {
  canArchiveCelestial,
  canArchiveUniverse,
} from "./systems/cosmic-archive.js";
import {
  findTerritoryByName,
  parseTerminalInput,
} from "./systems/terminal.js";
import { getBaseStatusView } from "./systems/base-status.js";
import {
  getAvailableResidents,
  getResidentCurrentLine,
} from "./systems/residents.js";
import {
  OLIVIA_BLUEPRINT_ID,
  LEGENDARY_PROTOTYPE_CATALOG,
} from "./data/legendary-prototype-data.js";
import { GAME_RULE_ARCHIVE } from "./data/game-rules-data.js";
import {
  deriveLegendaryBlueprint,
  deriveOliviaBlueprint,
  getLegendaryConfiguration,
  getLegendaryIdentity,
  isLegendaryBlueprintUnlocked,
} from "./systems/legendary-prototypes.js";
import { getListeningContext } from "./systems/listening.js";
import {
  ACHIEVEMENTS,
  getAchievement,
} from "./data/achievement-data.js";
import { getAchievementProgressValue } from "./systems/career.js";
import {
  areAllGuideObjectivesComplete,
  getActiveGuideObjectives,
} from "./systems/objectives.js";
import {
  getAbilityDisplayName,
  getContentDisplayName,
  getGeneratorVersionDisplayName,
} from "./systems/content-presentation.js";

const app = document.querySelector("#app");
const MANA_SYMBOL_URLS = {
  W: manaWhiteUrl,
  U: manaBlueUrl,
  B: manaBlackUrl,
  R: manaRedUrl,
  G: manaGreenUrl,
  C: manaColorlessUrl,
};
const storage = new BrowserStorageAdapter();
const engine = new GameEngine(storage);
const loadedState = engine.load();
const displayState =
  loadedState ??
  createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: Date.now(),
    gameId: "CT-PREVIEW",
  });
let blueprintDraft = createBlueprintDraft(
  getOrigin(displayState.base.originId).color,
);
let editingBlueprintId = null;
let selectedLegendaryBlueprintId = null;
let movingPlacementId = null;
let prototypeMessage = "";
let prototypeMessageIsError = false;
let prototypeStateSignature = "";
let selectedTerritoryId = "TERRITORY_TUTORIAL_W";
let selectedMapNodeId = "REGION_GAVONY";
let selectedExpeditionCommand = "RECON";
let selectedLegionId = null;
let selectedCommanderLegendaryId = null;
let mapMessage = "";
let mapMessageIsError = false;
let factorSearchQuery = "";
let factorTypeFilter = "ALL";
let factorEffectFilter = "ALL";
let biofactorCatalogSearchQuery = "";
let biofactorCatalogTypeFilter = "ALL";
let biofactorCatalogEffectFilter = "ALL";
let mapStateSignature = "";
let expeditionStateSignature = "";
let baseRuntimeSignature = "";
let baseContextSignature = "";
let arcanaStateSignature = "";
let biofactorCatalogStateSignature = "";
let commandHistory = [];
let commandHistoryIndex = 0;
let openingNarrativeStep = 0;
let elfQueenNarrativeStep = 0;
let lastSubspaceWhisperIndex = -1;
let lastSubspaceShoutIndex = -1;

function getPreferredThemeId(state = null) {
  const themeId =
    state?.settings?.themeId ?? storage.loadSettings().themeId;
  return UI_THEME_IDS.includes(themeId) ? themeId : DEFAULT_UI_THEME;
}

function applyTheme(themeId) {
  document.documentElement.dataset.theme = UI_THEME_IDS.includes(themeId)
    ? themeId
    : DEFAULT_UI_THEME;
}

applyTheme(getPreferredThemeId(loadedState));

const resourceMarkup = COLOR_ORDER
  .map(
    (id) => {
      const { name, tone } = COLORS[id];
      const value = displayState.resources.amounts[id];
      const cap = displayState.resources.caps[id];
      return `
      <div class="mana" data-tone="${tone}" data-resource="${id}" title="${name}法术力 ${value}/${cap}">
        <div class="mana-label">
          <span class="mana-symbol">[${id}]</span>
          <span>${name}</span>
        </div>
        <div class="mana-amount">
          <span class="mana-value" data-resource-value>${value.toLocaleString("zh-CN")}</span>
          <span class="mana-cap">/<span data-resource-cap>${cap.toLocaleString("zh-CN")}</span></span>
        </div>
        <div class="mana-bar" aria-hidden="true">
          <span data-resource-progress style="width:${Math.min(100, (value / cap) * 100)}%"></span>
        </div>
      </div>
    `;
    },
  )
  .join("");

const navMarkup = (mobile = false) =>
  navItems
    .map(
      ({ id, key, label, icon }) => `
        <button class="nav-item ${id === "base" ? "is-active" : ""}" data-route="${id}"
          aria-label="${label}" title="${mobile ? label : `${key} — ${label}`}">
          <span class="nav-icon" aria-hidden="true">${icon}</span>
          <span class="nav-label">${label}</span>
          <span class="nav-key">${key}</span>
        </button>
      `,
    )
    .join("");

const emptyLogMarkup = `
  <div class="log-entry" data-type="system">
    <span class="log-time">--:--:--</span>
    <span class="log-type">系统</span>
    <span>等待建立新游戏</span>
  </div>
`;

function renderCompactLogs(state) {
  if (!state) return emptyLogMarkup;
  return state.recentLogs
    .slice(0, 4)
    .map((event) => {
      const { timestamp, type, label, text } = presentEvent(event);
      return `
      <div class="log-entry" data-type="${type}">
        <span class="log-time">${formatEventTime(timestamp)}</span>
        <span class="log-type">${label}</span>
        <span>${text}</span>
      </div>
    `;
    })
    .join("");
}

function renderLogRows(state) {
  if (!state) {
    return `<tr><td>--:--:--</td><td>系统</td><td>等待建立新游戏</td></tr>`;
  }
  return state.recentLogs
    .map((event) => {
      const { timestamp, label, text } = presentEvent(event);
      return `
        <tr data-log-label="${label}">
          <td>${formatEventTime(timestamp)}</td>
          <td>${label}</td>
          <td>${text}</td>
        </tr>
      `;
    })
    .join("");
}

const CAREER_COUNTER_GROUPS = Object.freeze([
  {
    title: "远征与毁灭",
    entries: [
      ["远征总数", "expeditionsTotal"],
      ["远征胜利", "expeditionVictories"],
      ["远征失败", "expeditionFailures"],
      ["安全返回／撤回", "expeditionRetreats"],
      ["征服胜利", "conquestVictories"],
      ["渗透胜利", "infiltrationVictories"],
      ["巡逻队毁灭", "patrolsDestroyed"],
      ["守军毁灭", "garrisonsDestroyed"],
      ["领土毁灭", "territoriesDestroyed"],
      ["区域毁灭", "regionsDestroyed"],
      ["世界／星球毁灭", ["worldsDestroyed", "planetsDestroyed"]],
      ["宇宙毁灭", "universesDestroyed"],
    ],
  },
  {
    title: "伤害与瓦解",
    entries: [
      ["战斗伤害", "combatDamageDealt"],
      ["承受伤害", "combatDamageTaken"],
      ["坚守伤害", "fortitudeDamage"],
      ["稳定削减", "stabilityDamage"],
    ],
  },
  {
    title: "创造与收藏",
    entries: [
      ["蓝图创建／删除", ["blueprintsCreated", "blueprintsDeleted"]],
      ["原体实体化", "prototypesInstantiated"],
      ["原体死亡", "prototypeDeaths"],
      ["原体重构", "prototypesRebuilt"],
      ["原体销毁", "prototypesDestroyed"],
      ["复制体制造／销毁", ["replicasCreated", "replicasDestroyed"]],
      ["内容解锁", "contentUnlocked"],
      ["传奇内容获得", "legendaryContentAcquired"],
    ],
  },
]);

const CAREER_RECORD_LABELS = Object.freeze({
  highestExpeditionDamage: "单次远征最高战斗伤害",
  highestExpeditionDamageTaken: "单次远征最高承受伤害",
  highestExpeditionFortitudeDamage: "单次远征最高坚守伤害",
  highestExpeditionStabilityDamage: "单次远征最高稳定削减",
  highestEnemiesDefeated: "单次远征最多消灭部队",
  highestReplicasCreatedAtOnce: "单批最多制造复制体",
});

function formatCounterValue(counters, key) {
  if (Array.isArray(key)) {
    return key.map((item) => counters[item] ?? 0).join(" / ");
  }
  return String(counters[key] ?? 0);
}

function renderCareerStatistics(state) {
  if (!state) return "";
  const career = state.careerProgress;
  const counters = career.counters;
  const currentContent = new Set([
    ...state.unlockedBiofactors,
    ...state.artifacts,
    ...state.rewardProgress.unlockedContentIds,
  ]).size;
  const currentMarkup = [
    [
      "现有蓝图",
      state.blueprints.length +
        state.legendaryBlueprints.filter((item) => !item.archivedAt).length,
    ],
    ["现有原体", state.prototypes.length + state.legendaryPrototypes.length],
    ["待命军团", state.legions.length],
    ["已完成领土", state.worldMap.completedTerritoryIds.length],
    ["当前内容收藏", currentContent],
  ].map(([label, value]) => `
    <div class="career-current-item"><span>${label}</span><strong>${value}</strong></div>
  `).join("");
  const groupsMarkup = CAREER_COUNTER_GROUPS.map((group) => `
    <section class="career-stat-group">
      <div class="panel-label">${group.title}</div>
      ${group.entries.map(([label, key]) => `
        <div class="career-stat-row">
          <span>${label}</span>
          <strong>${formatCounterValue(counters, key)}</strong>
        </div>
      `).join("")}
    </section>
  `).join("");
  const recordsMarkup = Object.entries(CAREER_RECORD_LABELS).map(
    ([key, label]) => {
      const record = career.records[key];
      return `
        <div class="career-record-card ${record ? "is-set" : ""}">
          <span>${label}</span>
          <strong>${record?.value ?? "—"}</strong>
          <small>${record ? formatDateTime(record.achievedAt) : "等待首次有效记录"}</small>
        </div>
      `;
    },
  ).join("");
  return `
    <div class="career-note ${career.legacyBaseline ? "is-legacy" : ""}">
      <strong>${career.legacyBaseline ? "迁移统计" : "完整统计"}</strong>
      <span>${escapeHtml(career.note)} 起始时间：${formatDateTime(career.trackingStartedAt)}</span>
    </div>
    <div class="panel-label archive-section-label">当前状态 // 不计入生涯累计</div>
    <div class="career-current-grid">${currentMarkup}</div>
    <div class="panel-label archive-section-label">生涯累计</div>
    <div class="career-stat-grid">${groupsMarkup}</div>
    <div class="panel-label archive-section-label">最高记录</div>
    <div class="career-record-grid">${recordsMarkup}</div>
  `;
}

function renderAchievements(state) {
  if (!state) return "";
  const unlocked = state.achievementProgress.unlocked;
  const unlockedCount = Object.keys(unlocked).length;
  return `
    <div class="achievement-summary">
      <div><span>已解锁</span><strong>${unlockedCount} / ${ACHIEVEMENTS.length}</strong></div>
      <div class="progress"><span style="width:${(unlockedCount / ACHIEVEMENTS.length) * 100}%"></span></div>
    </div>
    <div class="achievement-grid">
      ${ACHIEVEMENTS.map((achievement) => {
        const entry = unlocked[achievement.id];
        const hidden = achievement.hidden && !entry;
        const progress = Math.min(
          achievement.target,
          getAchievementProgressValue(state, achievement),
        );
        return `
          <article class="achievement-card ${entry ? "is-unlocked" : ""} ${hidden ? "is-hidden" : ""}">
            <div class="achievement-card-header">
              <span class="status-pill ${entry ? "" : "warning"}">${entry ? "已解锁" : hidden ? "隐藏" : "进行中"}</span>
              <small>${hidden ? "未知分类" : achievement.category}</small>
            </div>
            <h3>${hidden ? "隐藏成就" : escapeHtml(achievement.name)}</h3>
            <p>${hidden ? "继续改变这个世界以发现条件。" : escapeHtml(achievement.description)}</p>
            <div class="achievement-progress-row">
              <span>${hidden ? "? / ?" : `${progress} / ${achievement.target}`}</span>
              ${entry ? `<time>${formatDateTime(entry.unlockedAt)}</time>` : ""}
            </div>
            <div class="progress"><span style="width:${hidden ? 0 : (progress / achievement.target) * 100}%"></span></div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function matchesKeywordAbility(contentAbilityId, keywordAbilityId) {
  if (keywordAbilityId === "ABILITY_INFILTRATE_X") {
    return /^ABILITY_INFILTRATE_\d+$/.test(contentAbilityId);
  }
  return contentAbilityId === keywordAbilityId;
}

function isKeywordAbilityUnlocked(state, keywordAbilityId) {
  const unlockedContent = [...RACES, ...JOBS, ...COMPONENTS].filter((item) =>
    isContentUnlocked(item, state),
  );
  if (
    unlockedContent.some((item) =>
      item.abilities?.some((abilityId) =>
        matchesKeywordAbility(abilityId, keywordAbilityId),
      ),
    )
  ) {
    return true;
  }
  return LEGENDARY_PROTOTYPE_CATALOG.some(
    (item) =>
      isLegendaryBlueprintUnlocked(state, item.id) &&
      item.abilities?.some((abilityId) =>
        matchesKeywordAbility(abilityId, keywordAbilityId),
      ),
  );
}

function renderNamedAbilityArchive(state) {
  const namedAbilities = Object.entries(ABILITIES).filter(
    ([abilityId, ability]) =>
      ability.keyword === true &&
      isKeywordAbilityUnlocked(state, abilityId),
  );
  return `
    <div class="rules-card-grid">
      ${namedAbilities.length ? namedAbilities.map(([, ability]) => `
          <article class="rule-card ability-rule-card">
            <h3>${escapeHtml(ability.name)}</h3>
            <p>${escapeHtml(ability.description)}</p>
          </article>
        `).join("") : `<p class="empty-state">尚未解锁包含关键词异能的生物因子。</p>`}
    </div>
  `;
}

function renderGameRuleArchive() {
  return `
    <div class="rules-intro">
      <strong>默认规则与基础概率</strong>
      <span>这里记录游戏系统的基础规则与默认数值。</span>
    </div>
    <div class="rules-card-grid">
      ${GAME_RULE_ARCHIVE.map((rule) => `
        <article class="rule-card">
          <div class="panel-label">${escapeHtml(rule.category)}</div>
          <h3>${escapeHtml(rule.title)}</h3>
          <p>${escapeHtml(rule.detail)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

const compactLogs = renderCompactLogs(loadedState);

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><span>CT</span></div>
        <div>
          <div class="brand-title">CRAZYTIDE</div>
          <div class="brand-subtitle">SUBSPACE COMMAND SYSTEM // MVP.1</div>
        </div>
      </div>
      <div class="resource-strip" aria-label="法术力资源">
        ${resourceMarkup}
      </div>
      <div class="system-state">
        <div class="live-state"><span class="live-dot"></span><span data-live-state>在线运行</span></div>
        <button class="icon-button" id="save-menu-button" aria-label="打开设置与存档管理" title="设置与存档管理">▣</button>
        <button class="icon-button" id="effects-toggle" aria-label="切换视觉效果" aria-pressed="false" title="视觉效果">◌</button>
      </div>
    </header>

    <div class="workspace">
      <aside class="rail left-rail">
        <section class="rail-section">
          <div class="section-kicker">主控制</div>
          <nav class="side-nav" aria-label="主导航">${navMarkup()}</nav>
        </section>
        <section class="rail-section">
          <div class="section-kicker">当前目标</div>
          <div data-current-objectives></div>
        </section>
        <section class="rail-section">
          <div class="section-kicker">基地读数</div>
          <div class="mini-stat"><span>所处空间</span><strong data-base-location>亚空间</strong></div>
          <div class="mini-stat"><span>生产位</span><strong data-base-slots>0 / 2</strong></div>
          <div class="mini-stat"><span>蓝图槽</span><strong data-blueprint-cap>0 / 10</strong></div>
          <div class="mini-stat"><span>远征状态</span><strong data-expedition-status>待命</strong></div>
        </section>
      </aside>

      <main class="main-stage">
        <section class="screen is-active" data-screen="base">
          <div class="page-heading">
            <div>
              <div class="eyebrow">BASE // 亚空间锚点 07</div>
              <h1>基地控制台</h1>
            </div>
            <p>这里没有日出。只有被法术约束的机械，在虚空里维持着你刚刚苏醒的野心。</p>
          </div>
          <div class="screen-grid">
            <article class="panel col-7" data-facility-panel>
              <div class="panel-header">
                <div>
                  <div class="panel-label">MANA FACILITY // 法术力设施</div>
                  <div class="panel-title">亚空间残渣回收</div>
                </div>
                <span class="status-pill">自动运行</span>
              </div>
              <div class="artifact-display">
                <div class="artifact-core"><span>+25[C]</span></div>
                <div>
                  <div class="metric">
                    <div class="metric-row"><span>下一次收集</span><strong data-residue-countdown>01:00</strong></div>
                    <div class="progress"><span data-residue-progress style="width:0%"></span></div>
                  </div>
                  <div class="mini-stat"><span>产量</span><strong>25 [C] / 分钟</strong></div>
                  <div class="mini-stat"><span>生产位占用</span><strong>0</strong></div>
                  <div class="mini-stat"><span>终止条件</span><strong>获得索蓝发电机</strong></div>
                </div>
              </div>
            </article>
            <article class="panel col-5">
              <div class="panel-header">
              <div>
                <div class="panel-label">ORIGIN // 法术力起源</div>
                <div class="panel-title" data-origin-name>白色法术力起源</div>
              </div>
                <span class="status-pill">稳定</span>
              </div>
              <div class="metric">
                <div class="metric-row"><span>初始土地</span><strong data-land-name>平原</strong></div>
                <div class="progress"><span data-origin-progress style="width:40%"></span></div>
              </div>
              <div class="mini-stat"><span>有色产能</span><strong data-color-rate>2 [W] / 120秒</strong></div>
              <div class="mini-stat"><span>开局结构</span><strong data-opening-type>同色集中</strong></div>
              <div class="mini-stat"><span>主色储存上限</span><strong data-primary-cap>15 [W]</strong></div>
              <div class="mini-stat"><span>达到上限后</span><strong>停止储存（超出部分不保留）</strong></div>
            </article>
            <article class="panel col-12 slotted-facilities-panel" data-slotted-facilities-panel></article>
            <article class="panel col-12 base-context-mobile">
              <div class="base-context-grid">
                <section>
                  <div class="panel-label">SPACE STATUS // 空间状态</div>
                  <div data-base-vector-panel></div>
                </section>
                <section>
                  <div class="panel-label">ONLINE // 当前在线</div>
                  <div data-resident-panel></div>
                </section>
              </div>
            </article>
            <article class="panel col-4" data-artifact-panel>
              <div class="panel-header">
                <div class="panel-label">ARTIFACT // 核心神器</div>
                <span class="status-pill warning">2 未校准</span>
              </div>
              <div class="mini-stat"><span>生物因子提取器</span><strong>就绪</strong></div>
              <div class="mini-stat"><span>原体编辑器</span><strong>就绪</strong></div>
              <div class="mini-stat"><span>镜映品</span><strong>就绪</strong></div>
              <div class="mini-stat"><span>法术力库</span><strong>Lv.0</strong></div>
            </article>
            <article class="panel col-8">
              <div class="panel-header">
                <div class="panel-label">EVENT STREAM // 最近事件</div>
                <button class="terminal-button secondary" data-route="logs">查看全部</button>
              </div>
              <div class="terminal-log" data-event-stream>${compactLogs}</div>
            </article>
          </div>
        </section>

        <section class="screen" data-screen="prototype">
          <div id="prototype-content"></div>
        </section>

        <section class="screen" data-screen="biofactors">
          <div id="biofactors-content"></div>
        </section>

        <section class="screen" data-screen="artifacts">
          <div id="artifacts-content"></div>
        </section>

        <section class="screen" data-screen="enchantments">
          <div id="enchantments-content"></div>
        </section>

        <section class="screen" data-screen="spells">
          <div id="spells-content"></div>
        </section>

        <section class="screen" data-screen="map">
          <div id="map-content"></div>
        </section>

        <section class="screen" data-screen="expedition">
          <div id="expedition-content"></div>
        </section>

        <section class="screen" data-screen="logs">
          <div class="page-heading">
            <div>
              <div class="eyebrow">ARCHIVE // 本地记录</div>
              <h1>记录档案</h1>
            </div>
            <button class="terminal-button secondary" data-action="export-save">导出存档</button>
          </div>
          <div class="archive-tabs" role="tablist" aria-label="记录档案分类">
            ${[
              ["events", "事件记录"],
              ["statistics", "数据统计"],
              ["achievements", "成就档案"],
              ["abilities", "异能图鉴"],
              ["rules", "游戏规则"],
            ].map(([id, label], index) => `
              <button class="filter-button ${index === 0 ? "is-active" : ""}" data-archive-tab="${id}" role="tab">${label}</button>
            `).join("")}
          </div>
          <article class="panel archive-panel" data-archive-panel="events">
            <div class="filters" aria-label="事件记录筛选">
              ${["全部", "系统", "生产", "存档", "设置", "远征", "战斗", "奖励"].map((label, index) => `
                <button class="filter-button ${index === 0 ? "is-active" : ""}" data-filter="${label}">${label}</button>
              `).join("")}
            </div>
            <div style="overflow-x:auto">
              <table class="logs-table">
                <thead><tr><th>时间</th><th>类别</th><th>记录</th></tr></thead>
                <tbody>
                  ${renderLogRows(loadedState)}
                </tbody>
              </table>
            </div>
          </article>
          <article class="panel archive-panel" data-archive-panel="statistics" hidden>
            <div data-career-statistics>${renderCareerStatistics(loadedState ?? displayState)}</div>
          </article>
          <article class="panel archive-panel" data-archive-panel="achievements" hidden>
            <div data-achievements>${renderAchievements(loadedState ?? displayState)}</div>
          </article>
          <article class="panel archive-panel" data-archive-panel="abilities" hidden>
            <div data-keyword-abilities>${renderNamedAbilityArchive(loadedState ?? displayState)}</div>
          </article>
          <article class="panel archive-panel" data-archive-panel="rules" hidden>
            ${renderGameRuleArchive()}
          </article>
        </section>
      </main>

      <aside class="rail right-rail">
        <section class="rail-section" data-production-rail>
          <div class="section-kicker">生产队列</div>
          <div class="queue-item">
            <div class="queue-title"><span>残渣回收</span><span data-residue-countdown>01:00</span></div>
            <div class="progress"><span data-residue-progress style="width:0%"></span></div>
          </div>
          <button class="terminal-button secondary" style="width:100%">查看生产设施</button>
        </section>
        <section class="rail-section base-vector-rail">
          <div class="section-kicker">空间状态</div>
          <div data-base-vector-panel></div>
        </section>
        <section class="rail-section resident-rail">
          <div class="section-kicker">当前在线</div>
          <div data-resident-panel></div>
        </section>
        <section class="rail-section">
          <div class="section-kicker">信号流</div>
          <div class="terminal-log" data-event-stream>${compactLogs}</div>
        </section>
      </aside>
    </div>

    <section class="subspace-terminal" aria-label="亚空间终端">
      <div class="terminal-response" data-terminal-response role="status" aria-live="polite">
        <span class="terminal-response-source">SUBSPACE // 待命</span>
        <span data-terminal-response-text>输入 /帮助 查看指令，或向亚空间说点什么。</span>
      </div>
      <form class="command-form" id="command-form" autocomplete="off">
        <label class="sr-only" for="command-input">亚空间终端输入</label>
        <span class="command-prompt" aria-hidden="true">&gt;_</span>
        <input
          class="command-input"
          id="command-input"
          maxlength="160"
          placeholder="输入 /指令，或向亚空间说点什么……"
          spellcheck="false"
        >
        <button class="terminal-button command-submit" type="submit">发送</button>
      </form>
      <button class="terminal-button secondary listen-button" type="button" data-listen-subspace>
        ◉ 聆听
      </button>
    </section>

    <footer class="status-footer">
      <span data-autosave-status>AUTOSAVE // 等待新游戏</span>
      <span data-game-id>GAME ID: —</span>
      <span>1–9 切换页面 · ? 帮助</span>
    </footer>
    <nav class="mobile-nav" aria-label="移动端主导航">
      <button class="mobile-nav-toggle" type="button" data-mobile-nav-toggle aria-expanded="false" aria-label="展开菜单" title="菜单">
        <span class="nav-icon" aria-hidden="true">☰</span>
        <span class="nav-label">菜单</span>
      </button>
      ${navMarkup(true)}
    </nav>

    <dialog class="terminal-dialog startup-cover-dialog" id="startup-cover-dialog" aria-labelledby="startup-cover-title">
      <div class="startup-cover-shell" tabindex="-1">
        <h1 class="sr-only" id="startup-cover-title">CrazyTide 亚空间锚点启动</h1>
        <div class="startup-cover-frame" aria-hidden="true">
          <span>SUBSPACE BOOTSTRAP</span>
          <span>PROTOCOL // 07</span>
        </div>
        <figure class="startup-void-art">
          <img
            src="${startupVoidExileUrl}"
            alt="一个被放逐者独自漂浮在现实宇宙破裂边界之外"
          >
        </figure>
        <div class="startup-boot-log" aria-label="启动状态">
          <div class="startup-boot-row" style="--boot-delay: 0.72s">
            <span>SEAL INTEGRITY</span><i></i><strong>100%</strong>
          </div>
          <div class="startup-boot-row" style="--boot-delay: 0.88s">
            <span>MANA ORIGIN</span><i></i><strong>STABLE</strong>
          </div>
          <div class="startup-boot-row" style="--boot-delay: 1.04s">
            <span>SUBSPACE RESIDUE</span><i></i><strong>ACTIVE</strong>
          </div>
          <div class="startup-boot-row" style="--boot-delay: 1.2s">
            <span>REGIONAL CONSCIOUSNESS</span><i></i><strong>ONLINE</strong>
          </div>
          <div class="startup-boot-row" style="--boot-delay: 1.36s">
            <span>REALITY DIMENSION</span><i></i><strong>UNOBSERVED</strong>
          </div>
        </div>
        <div class="startup-authority">COMMAND AUTHORITY ACCEPTED</div>
        <div class="startup-actions">
          <button class="terminal-button${loadedState ? " secondary" : ""}" type="button" data-startup-new>建立新的法术力锚点</button>
          ${loadedState ? '<button class="terminal-button" type="button" data-startup-continue>继续既有存档</button>' : ""}
        </div>
        <p class="startup-skip-hint">按任意键或点击封面跳过启动演算</p>
      </div>
    </dialog>

    <dialog class="terminal-dialog setup-dialog" id="new-game-dialog">
      <form method="dialog" class="dialog-shell" id="new-game-form">
        <div class="dialog-header">
          <div>
            <div class="eyebrow">NEW GAME // 初始锚定</div>
            <h2>选择法术力起源与土地</h2>
          </div>
          <button class="icon-button dialog-close" value="cancel" aria-label="取消新游戏">×</button>
        </div>
        <p class="dialog-copy">
          起源和土地各提供3点对应法术力，并各自每120秒产出1点。同色组合产能集中且该色容量提升至15；异色组合更早获得双色资源。
        </p>
        <fieldset class="choice-fieldset">
          <legend>01 // 法术力起源</legend>
          <div class="choice-grid" data-origin-choices>
            ${ORIGINS.map((origin, index) => `
              <label class="choice-card" data-color="${origin.color}">
                <input type="radio" name="originId" value="${origin.id}" ${index === 0 ? "checked" : ""}>
                <span class="choice-symbol">[${origin.color}]</span>
                <strong>${origin.shortName}</strong>
                <small>${origin.direction}</small>
                <small class="origin-gifts">
                  <span>生物因子：${getInitialBiofactorIds(origin.color).map((id) => getContentDisplayName(id)).join("、")}</span>
                  <span>法术：${SPELL_CATALOG.filter((item) => item.originColors.includes(origin.color)).map((item) => item.name).join("、") || "无"}</span>
                  <span>结界：${ENCHANTMENT_CATALOG.filter((item) => item.originColors.includes(origin.color)).map((item) => item.name).join("、") || "无"}</span>
                </small>
              </label>
            `).join("")}
          </div>
        </fieldset>
        <fieldset class="choice-fieldset">
          <legend>02 // 初始土地</legend>
          <div class="choice-grid" data-land-choices>
            ${LANDS.map((land, index) => `
              <label class="choice-card" data-color="${land.color}">
                <input type="radio" name="landId" value="${land.id}" ${index === 0 ? "checked" : ""}>
                <span class="choice-symbol">[${land.color}]</span>
                <strong>${land.name}</strong>
                <small>${land.description}</small>
              </label>
            `).join("")}
          </div>
        </fieldset>
        <div class="opening-summary" id="opening-summary"></div>
        <div class="dialog-actions">
          <button class="terminal-button secondary dialog-cancel" value="cancel">取消</button>
          <button class="terminal-button" value="default" id="start-game-button">建立新游戏</button>
        </div>
      </form>
    </dialog>

    <dialog class="terminal-dialog save-dialog" id="save-dialog">
      <div class="dialog-shell">
        <div class="dialog-header">
          <div>
            <div class="eyebrow">SAVE CONTROL // SCHEMA v${SAVE_SCHEMA_VERSION}</div>
            <h2>设置与存档管理</h2>
          </div>
          <button class="icon-button" data-close-dialog="save-dialog" aria-label="关闭存档管理">×</button>
        </div>
        <div class="save-summary">
          <div class="mini-stat"><span>游戏ID</span><strong data-save-game-id>—</strong></div>
          <div class="mini-stat"><span>建立时间</span><strong data-save-created>—</strong></div>
          <div class="mini-stat"><span>最近保存</span><strong data-save-updated>—</strong></div>
          <div class="mini-stat"><span>存储位置</span><strong>浏览器本地</strong></div>
        </div>
        <label class="terminal-field">
          <span>渗透暴露后的处决警告</span>
          <select class="terminal-select" id="execution-warning-mode">
            <option value="PAUSE">暂停远征</option>
            <option value="PAUSE_60">暂停远征60s</option>
            <option value="CONTINUE">继续游戏</option>
          </select>
        </label>
        <label class="terminal-field">
          <span>战斗结束后的节奏</span>
          <select class="terminal-select" id="battle-end-pause">
            <option value="true">暂停并显示战斗复盘</option>
            <option value="false">自动继续远征</option>
          </select>
        </label>
        <label class="terminal-field">
          <span>法术力显示</span>
          <select class="terminal-select" id="mana-display-mode">
            <option value="SYMBOL">正常符号</option>
            <option value="LETTER">字母：[W] [U] [B] [R] [G] [C]</option>
          </select>
        </label>
        <label class="terminal-field">
          <span>界面配色</span>
          <select class="terminal-select" id="theme-select">
            ${UI_THEMES.map(
              (theme) =>
                `<option value="${theme.id}">${theme.name} // ${theme.description}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="test-mode-toggle">
          <input type="checkbox" id="test-mode-toggle">
          <span>
            <strong>测试模式</strong>
            <small>解锁全部内容档案与领土，但不自动实体化剧情神器；不消耗法术力；所有生产与收集周期缩短为2秒。</small>
          </span>
        </label>
        <p class="dialog-message" id="save-dialog-message" role="status"></p>
        <input class="sr-only" id="save-file-input" type="file" accept="application/json,.json">
        <div class="save-actions">
          <button class="terminal-button" data-action="manual-save">立即保存</button>
          <button class="terminal-button secondary" data-action="export-save">导出JSON</button>
          <button class="terminal-button secondary" data-action="import-save">导入JSON</button>
          <button class="terminal-button warning" data-action="prepare-new-game">开始新游戏</button>
        </div>
      </div>
    </dialog>

    <dialog class="terminal-dialog battle-review-dialog" id="battle-review-dialog">
      <div class="dialog-shell">
        <div data-battle-review-content></div>
        <div class="dialog-actions">
          <button class="terminal-button" data-acknowledge-battle-review>继续远征</button>
        </div>
      </div>
    </dialog>

    <dialog class="terminal-dialog expedition-result-dialog" id="expedition-result-dialog">
      <div class="dialog-shell">
        <div data-expedition-result-content></div>
        <div class="dialog-actions">
          <button class="terminal-button" data-acknowledge-expedition-result>确认结算</button>
        </div>
      </div>
    </dialog>

    <dialog class="terminal-dialog achievement-dialog" id="achievement-dialog">
      <div class="dialog-shell achievement-reveal-shell">
        <div class="narrative-sigil achievement-sigil" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="eyebrow">ACHIEVEMENT UNLOCKED // 成就解锁</div>
        <h2 data-achievement-reveal-name>—</h2>
        <p class="dialog-copy" data-achievement-reveal-description></p>
        <div class="mini-stat"><span>类别</span><strong data-achievement-reveal-category>—</strong></div>
        <div class="mini-stat"><span>奖励</span><strong data-achievement-reveal-reward>无额外奖励</strong></div>
        <div class="dialog-actions">
          <button class="terminal-button" data-acknowledge-achievement>写入档案</button>
        </div>
      </div>
    </dialog>

    <dialog class="terminal-dialog narrative-dialog" id="opening-narrative-dialog">
      <div class="dialog-shell narrative-shell">
        <div class="narrative-sigil" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="narrative-copy">
          <div class="eyebrow" data-opening-kicker></div>
          <h2 data-opening-title></h2>
          <p data-opening-body></p>
          <div class="narrative-progress" data-opening-progress aria-label="开局叙事进度"></div>
          <div class="dialog-actions">
            <button class="terminal-button secondary" data-opening-skip>跳过游戏介绍</button>
            <button class="terminal-button" data-opening-next>继续</button>
          </div>
        </div>
      </div>
    </dialog>

    <dialog class="terminal-dialog narrative-dialog queen-narrative-dialog" id="mvp-thanks-dialog">
      <div class="dialog-shell narrative-shell">
        <div class="narrative-sigil queen-sigil" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="narrative-copy">
          <div class="eyebrow" data-queen-kicker></div>
          <h2 data-queen-title></h2>
          <p data-queen-body></p>
          <div class="narrative-progress" data-queen-progress aria-label="妖精女皇宣战进度"></div>
          <div class="queen-resolution" data-queen-resolution hidden>
            <p class="system-reply">
              已记录新的敌对意志。威胁等级：尚无足够数据。建议：制造更多原体。
            </p>
            <div class="save-summary">
              <div class="mini-stat"><span>生物因子</span><strong>妖精／Elf</strong></div>
              <div class="mini-stat"><span>神器</span><strong>虹彩透镜／Prismatic Lens</strong></div>
              <div class="mini-stat"><span>法术力</span><strong>2[W]＋2[G]＋1000[C]</strong></div>
              <div class="mini-stat"><span>后续</span><strong>可手动刷新加渥尼</strong></div>
            </div>
          </div>
          <div class="dialog-actions">
            <button class="terminal-button secondary" data-queen-skip>中断传讯</button>
            <button class="terminal-button" data-queen-next>继续</button>
          </div>
        </div>
      </div>
    </dialog>

  </div>
`;

function enhanceManaSymbols(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (
      !parent ||
      parent.closest(
        "option, select, script, style, textarea, .mana-token",
      ) ||
      !/\[([WUBRGC])\]/.test(textNode.nodeValue)
    ) {
      continue;
    }
    const fragment = document.createDocumentFragment();
    const pieces = textNode.nodeValue.split(/\[([WUBRGC])\]/);
    pieces.forEach((piece, index) => {
      if (index % 2 === 0) {
        if (piece) fragment.append(document.createTextNode(piece));
        return;
      }
      const token = document.createElement("span");
      token.className = "mana-token";
      token.dataset.manaColor = piece;
      token.title = `${COLORS[piece].name}法术力`;
      const image = document.createElement("img");
      image.className = "mana-glyph";
      image.dataset.manaColor = piece;
      image.src = MANA_SYMBOL_URLS[piece];
      image.alt = `[${piece}]`;
      const letter = document.createElement("span");
      letter.className = "mana-letter";
      letter.textContent = `[${piece}]`;
      token.append(image, letter);
      fragment.append(token);
    });
    textNode.replaceWith(fragment);
  }
}

enhanceManaSymbols(app);
const manaSymbolObserver = new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "characterData") {
      enhanceManaSymbols(record.target.parentElement);
      continue;
    }
    record.addedNodes.forEach((node) => {
      enhanceManaSymbols(
        node.nodeType === Node.TEXT_NODE ? node.parentElement : node,
      );
    });
  }
});
manaSymbolObserver.observe(app, {
  childList: true,
  characterData: true,
  subtree: true,
});

let activeRoute = "base";
let activeLogFilter = "全部";
let activeArchiveTab = "events";
let pageIsPaused = document.hidden;

function setMobileNavExpanded(expanded) {
  const nav = document.querySelector(".mobile-nav");
  const toggle = nav?.querySelector("[data-mobile-nav-toggle]");
  if (!nav || !toggle) return;
  nav.classList.toggle("is-expanded", expanded);
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.setAttribute("aria-label", expanded ? "收起菜单" : "展开菜单");
}

function setRoute(route) {
  if (!navItems.some((item) => item.id === route)) return;
  activeRoute = route;

  document.querySelectorAll("[data-screen]").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === route);
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    const isActive = button.dataset.route === route;
    button.classList.toggle("is-active", isActive);
    if (button.classList.contains("nav-item")) {
      button.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });

  document.querySelector(".main-stage")?.scrollTo({ top: 0 });
  document.title = `CrazyTide // ${navItems.find((item) => item.id === route).label}`;
}

function pickNonRepeating(items, previousIndex) {
  if (!items.length) return { value: "", index: -1 };
  if (items.length === 1) return { value: items[0], index: 0 };
  let index = Math.floor(Math.random() * items.length);
  if (index === previousIndex) index = (index + 1) % items.length;
  return { value: items[index], index };
}

function setTerminalResponse(text, source = "SYSTEM // 指令确认", tone = "system") {
  const root = document.querySelector("[data-terminal-response]");
  if (!root) return;
  root.dataset.tone = tone;
  root.querySelector(".terminal-response-source").textContent = source;
  root.querySelector("[data-terminal-response-text]").textContent = text;
}

function getAvailableTerritories(state) {
  if (!state) return [];
  return TERRITORIES.filter((territory) =>
    isTerritoryUnlocked(state, territory),
  );
}

function terminalHelpText() {
  return [
    "/帮助",
    "/基地",
    "/建造",
    "/远征 [领土]",
    "/侦查 [领土]",
    "/征服 [领土]",
    "/渗透 [领土]",
    "/交谈 [Lilith／沃达连] [内容]",
    "/记录",
  ].join(" · ");
}

function selectTerritoryFromTerminal(state, argument) {
  const available = getAvailableTerritories(state);
  if (!argument) {
    return {
      territory: null,
      message: `可远征领土：${available.map((item) => item.name).join("、") || "无"}`,
    };
  }
  const territory = findTerritoryByName(TERRITORIES, argument);
  if (!territory) {
    return {
      territory: null,
      error: `没有找到领土「${argument}」。`,
    };
  }
  if (!available.some((item) => item.id === territory.id)) {
    return {
      territory: null,
      error: getTerritoryAccessReason(state, territory),
    };
  }
  return { territory };
}

function executeTerminalCommand(parsed) {
  const state = engine.state;
  if (parsed.kind === "EMPTY") return;
  if (parsed.kind === "SHOUT") {
    const result = pickNonRepeating(
      SUBSPACE_SHOUT_RESPONSES,
      lastSubspaceShoutIndex,
    );
    lastSubspaceShoutIndex = result.index;
    setTerminalResponse(
      result.value,
      "SUBSPACE // 回声无法归档",
      "subspace",
    );
    return;
  }
  if (parsed.kind === "UNKNOWN_COMMAND") {
    setTerminalResponse(
      parsed.rawCommand
        ? `未知指令「/${parsed.rawCommand}」。输入 /帮助 查看当前可用指令。`
        : "斜杠之后没有可以执行的指令。输入 /帮助 查看当前可用指令。",
      "SYSTEM // 无法解析",
      "warning",
    );
    return;
  }

  if (parsed.command === "HELP") {
    setTerminalResponse(terminalHelpText(), "SYSTEM // 指令索引");
    return;
  }
  if (!state) {
    setTerminalResponse(
      "请先完成起源锚定并建立新游戏。",
      "SYSTEM // 尚未锚定",
      "warning",
    );
    return;
  }
  if (parsed.command === "BASE") {
    setRoute("base");
    setTerminalResponse("已返回亚空间基地。");
    return;
  }
  if (parsed.command === "LOGS") {
    setRoute("logs");
    setTerminalResponse("已打开本地事件记录。");
    return;
  }
  if (parsed.command === "BUILD") {
    setRoute("artifacts");
    setTerminalResponse(
      state.flags.metathranRecipeUnlocked
        ? "已打开神器档案。当前可建造项目会在对应神器卡片中显示。"
        : "已打开神器档案。尚未发现可以建造的配方。",
    );
    return;
  }
  if (parsed.command === "TALK") {
    const result = engine.talkToResident(parsed.argument);
    setTerminalResponse(
      result.dialogue.text,
      `${result.resident.name.toUpperCase()} // ${result.resident.type}`,
      "resident",
    );
    return;
  }
  if (parsed.command === "EXPEDITION" && state.activeExpedition) {
    setRoute("expedition");
    setTerminalResponse("已接入当前远征信号。");
    return;
  }

  const selection = selectTerritoryFromTerminal(state, parsed.argument);
  if (selection.error) {
    setTerminalResponse(selection.error, "SYSTEM // 目标无效", "warning");
    return;
  }
  if (selection.territory) {
    selectedTerritoryId = selection.territory.id;
    selectedMapNodeId = selection.territory.regionId;
  }
  const commandMap = {
    RECON: "RECON",
    CONQUEST: "CONQUEST",
    INFILTRATION: "INFILTRATION",
  };
  if (commandMap[parsed.command]) {
    selectedExpeditionCommand = commandMap[parsed.command];
  }
  setRoute("map");
  renderMapScreen(state, true);

  const actionLabel = {
    EXPEDITION: "远征",
    RECON: "侦查",
    CONQUEST: "征服",
    INFILTRATION: "渗透",
  }[parsed.command];
  setTerminalResponse(
    selection.territory
      ? `已定位${selection.territory.name}并预选${actionLabel}。请在地图中选择军团并确认开启。`
      : `${selection.message}。已打开领土地图。`,
  );
}

function listenToSubspace() {
  const state = engine.state ?? displayState;
  const selectedTerritory = getTerritory(selectedTerritoryId);
  const context = getListeningContext(state, {
    observedNodeId: selectedMapNodeId,
    territoryId:
      selectedTerritory?.regionId === selectedMapNodeId
        ? selectedTerritory.id
        : null,
  });
  const result = pickNonRepeating(
    context.pool,
    lastSubspaceWhisperIndex,
  );
  lastSubspaceWhisperIndex = result.index;
  setTerminalResponse(result.value, context.source, "subspace");
  if (selectedMapNodeId?.startsWith("REGION_")) {
    engine.markGuideRegionListened();
  }
}

function renderCurrentObjectives(state) {
  const root = document.querySelector("[data-current-objectives]");
  if (!root) return;
  if (areAllGuideObjectivesComplete(state)) {
    root.innerHTML = `
      <div class="objective is-complete">
        <div class="objective-status">GUIDE // COMPLETE</div>
        <p>This is the way</p>
      </div>
    `;
    return;
  }
  root.innerHTML = getActiveGuideObjectives(state)
    .map((objective, index) => `
      <div class="objective">
        <div class="objective-status">指引 // ${String(index + 1).padStart(2, "0")}</div>
        <p>${escapeHtml(objective.text)}</p>
      </div>
    `)
    .join("");
}

function renderOpeningNarrative() {
  const dialog = document.querySelector("#opening-narrative-dialog");
  const sourceEntry = OPENING_NARRATIVE[openingNarrativeStep];
  if (!dialog || !sourceEntry) return;
  const land = getLand(
    engine.state?.base.landId ?? displayState.base.landId,
  );
  const entry = resolveNarrativeEntry(sourceEntry, {
    landName: land?.name ?? "初始基本地",
  });
  dialog.querySelector("[data-opening-kicker]").textContent = entry.kicker;
  dialog.querySelector("[data-opening-title]").textContent = entry.title;
  dialog.querySelector("[data-opening-body]").textContent = entry.body;
  dialog.querySelector("[data-opening-next]").textContent =
    openingNarrativeStep === OPENING_NARRATIVE.length - 1
      ? "开始游戏"
      : "继续";
  dialog.querySelector("[data-opening-progress]").innerHTML =
    OPENING_NARRATIVE.map(
      (_, index) =>
        `<span class="${index === openingNarrativeStep ? "is-active" : ""}">${String(index + 1).padStart(2, "0")}</span>`,
    ).join("");
}

function showOpeningNarrative() {
  const dialog = document.querySelector("#opening-narrative-dialog");
  if (!dialog) return;
  openingNarrativeStep = 0;
  renderOpeningNarrative();
  if (!dialog.open) dialog.showModal();
}

function renderElfQueenNarrative() {
  const dialog = document.querySelector("#mvp-thanks-dialog");
  const paragraph = ELF_QUEEN_DECLARATION[elfQueenNarrativeStep];
  if (!dialog || !paragraph) return;
  const isLast =
    elfQueenNarrativeStep === ELF_QUEEN_DECLARATION.length - 1;
  dialog.querySelector("[data-queen-kicker]").textContent =
    `HOSTILE TRANSMISSION // 王冠信号 ${String(elfQueenNarrativeStep + 1).padStart(2, "0")}`;
  dialog.querySelector("[data-queen-title]").textContent =
    ELF_QUEEN_DECLARATION_TITLE;
  dialog.querySelector("[data-queen-body]").textContent = paragraph;
  dialog.querySelector("[data-queen-next]").textContent = isLast
    ? "记录敌对意志"
    : "继续";
  dialog.querySelector("[data-queen-resolution]").hidden = !isLast;
  dialog.querySelector("[data-queen-progress]").innerHTML =
    ELF_QUEEN_DECLARATION.map(
      (_, index) =>
        `<span class="${index === elfQueenNarrativeStep ? "is-active" : ""}">${String(index + 1).padStart(2, "0")}</span>`,
    ).join("");
}

function finishElfQueenNarrative(interrupted = false) {
  document.querySelector("#mvp-thanks-dialog")?.close();
  engine.acknowledgeMvpThanks();
  setRoute("base");
  setTerminalResponse(
    interrupted
      ? "王冠信号已中断。敌对意志与宣战来源仍已完成记录。"
      : "妖精女皇的宣战已经归档。加渥尼不再是孤立事件。",
    "SYSTEM // 敌对意志确认",
  );
}

function formatClock(milliseconds) {
  if (milliseconds === null) return "已达上限";
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function setAllText(selector, text) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = text;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderCombatVitals(unit) {
  const normalizeValue = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };
  const currentDefense = normalizeValue(unit.currentDefense);
  const maxDefense = normalizeValue(unit.maxDefense);
  const currentHp = normalizeValue(unit.currentHp);
  const maxHp = normalizeValue(unit.maxHp);
  const defensePercent =
    maxDefense > 0 ? Math.min(100, (currentDefense / maxDefense) * 100) : 0;
  const hpPercent = maxHp > 0 ? Math.min(100, (currentHp / maxHp) * 100) : 0;

  return `
    <div class="combat-vitals">
      <div class="combat-vital combat-vital-defense">
        <div class="combat-vital-label">
          <span>剩余防御 / 最大防御</span>
          <strong>${currentDefense} / ${maxDefense}</strong>
        </div>
        <div
          class="combat-vital-track combat-vital-track-defense"
          role="progressbar"
          aria-label="剩余防御"
          aria-valuemin="0"
          aria-valuemax="${Math.max(1, maxDefense)}"
          aria-valuenow="${Math.min(currentDefense, Math.max(1, maxDefense))}"
        >
          <span style="width:${defensePercent}%"></span>
        </div>
      </div>
      <div class="combat-vital combat-vital-health">
        <div class="combat-vital-label">
          <span>当前生命 / 最大生命</span>
          <strong>${currentHp} / ${maxHp}</strong>
        </div>
        <div
          class="combat-vital-track combat-vital-track-health"
          role="progressbar"
          aria-label="当前生命"
          aria-valuemin="0"
          aria-valuemax="${Math.max(1, maxHp)}"
          aria-valuenow="${Math.min(currentHp, Math.max(1, maxHp))}"
        >
          <span style="width:${hpPercent}%"></span>
        </div>
      </div>
    </div>
  `;
}

function renderManaSelect(colors, selected, dataAttribute) {
  return `
    <div class="mana-choice-select">
      <span class="mana-choice-symbol">
        <img class="mana-choice-glyph" src="${MANA_SYMBOL_URLS[selected]}" alt="[${selected}]">
        <span class="mana-choice-letter">[${selected}]</span>
      </span>
      <select class="terminal-select" ${dataAttribute}>
        ${colors
          .map(
            (color) =>
              `<option value="${color}" ${selected === color ? "selected" : ""}>${COLORS[color].fullName}</option>`,
          )
          .join("")}
      </select>
    </div>
  `;
}

function componentCostLabel(component) {
  return formatCost({
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: component.colorlessCost ?? 0,
    ...component.colorCost,
  });
}

function renderBiofactorEffectSummary(content, emptyLabel = "无直接修正") {
  const items = getBiofactorEffectItems(content);
  return `
    <span class="biofactor-effect-summary" aria-label="效果摘要">
      ${
        items.length
          ? items
              .map(
                (item) =>
                  `<span class="biofactor-effect-chip" data-effect-tag="${item.tag}">${escapeHtml(item.label)}</span>`,
              )
              .join("")
          : `<span class="biofactor-effect-chip is-neutral">${emptyLabel}</span>`
      }
    </span>
  `;
}

function renderBiofactorAbilityDetails(content) {
  const abilityIds = content?.abilities ?? [];
  if (!abilityIds.length) return "";
  return `
    <span class="biofactor-ability-details">
      ${abilityIds
        .map((abilityId) => {
          const ability = getAbilityDefinition(abilityId);
          const abilityName = ability?.name ?? "未知异能";
          const description = escapeHtml(
            ability?.description ?? "暂无具体说明。",
          );
          return hasVisibleAbilityTitle(ability)
            ? `<span><strong>${escapeHtml(abilityName)}</strong>：${description}</span>`
            : `<span>${description}</span>`;
        })
        .join("")}
    </span>
  `;
}

function getBiofactorFilterState(root) {
  const isCatalog = root?.id === "biofactors-content";
  return isCatalog
    ? {
        query: biofactorCatalogSearchQuery,
        type: biofactorCatalogTypeFilter,
        effect: biofactorCatalogEffectFilter,
      }
    : {
        query: factorSearchQuery,
        type: factorTypeFilter,
        effect: factorEffectFilter,
      };
}

function applyBiofactorFilters(root = document) {
  const filters = getBiofactorFilterState(root);
  const cards = [
    ...root.querySelectorAll("[data-factor-browser-card]"),
  ];
  const normalizedQuery = filters.query
    .trim()
    .toLocaleLowerCase("zh-CN");
  let visibleCount = 0;

  for (const card of cards) {
    const typeMatches =
      filters.type === "ALL" ||
      card.dataset.factorType === filters.type;
    const effectMatches =
      filters.effect === "ALL" ||
      card.dataset.factorEffects
        .split(" ")
        .includes(filters.effect);
    const searchMatches =
      !normalizedQuery ||
      card.dataset.factorSearch.includes(normalizedQuery);
    card.hidden = !(typeMatches && effectMatches && searchMatches);
    if (!card.hidden) visibleCount += 1;
  }

  root.querySelectorAll("[data-factor-type-filter]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.factorTypeFilter === filters.type,
    );
  });
  root.querySelectorAll("[data-factor-effect-filter]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.factorEffectFilter === filters.effect,
    );
  });
  const result = root.querySelector("[data-factor-filter-result]");
  if (result) {
    result.textContent = `显示 ${visibleCount} / ${cards.length} 个因子`;
  }
  const empty = root.querySelector("[data-factor-filter-empty]");
  if (empty) empty.hidden = visibleCount > 0;
}

function getPrototypeSignature(state) {
  return JSON.stringify({
    testMode: isTestMode(state),
    blueprints: state.blueprints.map((item) => item.id),
    prototypes: state.prototypes.map((item) => [item.id, item.status]),
    legendaryBlueprints: state.legendaryBlueprints,
    legendaryIdentities: state.legendaryIdentities,
    legendaryPrototypes: state.legendaryPrototypes,
    legions: (state.legions ?? []).map((item) => [
      item.id,
      item.currentHp,
      item.maxHp,
      item.replicaCount,
      item.purchasedScaleHp,
    ]),
    queue: state.productionQueue.map((item) => [
      item.id,
      item.completesAt,
      item.purchasedScaleHp,
    ]),
    activeExpeditionLegionId: state.activeExpedition?.legionId ?? null,
  });
}

function renderLegendaryBlueprintOptions(state) {
  return LEGENDARY_PROTOTYPE_CATALOG.filter((definition) =>
    isLegendaryBlueprintUnlocked(state, definition.id),
  )
    .map(
      (definition) =>
        `<option value="${definition.id}" ${selectedLegendaryBlueprintId === definition.id ? "selected" : ""}>${escapeHtml(definition.name)}</option>`,
    )
    .join("");
}

function renderLegendaryPrototypeEditor(state) {
  const definition = LEGENDARY_PROTOTYPE_CATALOG.find(
    (item) => item.id === selectedLegendaryBlueprintId,
  );
  if (!definition || !isLegendaryBlueprintUnlocked(state, definition.id)) {
    selectedLegendaryBlueprintId = null;
    return "";
  }
  const entity = state.legendaryPrototypes.find(
    (item) => item.blueprintId === definition.id,
  );
  const configuration = getLegendaryConfiguration(state, definition.id);
  const blueprint = deriveLegendaryBlueprint(state, definition.id, entity);
  const race = getRace(definition.raceId);
  const job = getJob(definition.jobId ?? "JOB_NONE");
  const editable = !configuration.archivedAt && (!entity || entity.status === "READY");
  const equipmentZone = blueprint.grid.zones.find(
    (zone) => zone.kind === "LEGENDARY_EQUIPMENT",
  );
  const occupiedCells = blueprint.grid.zones.reduce(
    (sum, zone) => sum + zone.cells.filter(Boolean).length,
    0,
  );
  const totalCells = blueprint.grid.zones.reduce(
    (sum, zone) => sum + zone.cells.length,
    0,
  );
  const gridZones = blueprint.grid.zones
    .map((zone) => {
      const cells = zone.cells
        .map((instanceId) => {
          const placement = blueprint.placements.find(
            (item) => item.instanceId === instanceId,
          );
          const component = getComponent(placement?.contentId);
          return `<button class="grid-cell ${component ? "occupied" : ""}" type="button" disabled title="${escapeHtml(component?.name ?? "空格")}">${component ? escapeHtml(component.name.slice(0, 1)) : "+"}</button>`;
        })
        .join("");
      const zoneLabel =
        zone.kind === "LEGENDARY_EQUIPMENT"
          ? "传奇独立装备格"
          : zone.id === "BASE"
            ? "基础拓展格"
            : "附加拓展格";
      return `
        <div class="grid-zone ${zone.kind !== "BASE" ? "auxiliary-zone" : ""}">
          <div class="mini-stat"><span>${zoneLabel}</span><strong>${zone.width}×${zone.height}</strong></div>
          <div class="grid-editor prototype-grid" style="--grid-columns:${zone.width}" aria-label="${zoneLabel}">${cells}</div>
        </div>`;
    })
    .join("");
  const installed = blueprint.configurablePlacements.length
    ? blueprint.configurablePlacements
        .map((placement) => {
          const component = getComponent(placement.contentId);
          return `<div class="installed-factor">
            <div>
              <strong>${escapeHtml(component?.name ?? "未知生物因子")}</strong>
              <small>${placement.zoneId === "LEGENDARY_EQUIPMENT" ? "传奇独立1×1装备格" : "通用拓展格"} · ${component ? componentCostLabel(component) : "—"}</small>
              ${component ? renderBiofactorEffectSummary(component) : ""}
              ${component ? renderBiofactorAbilityDetails(component) : ""}
              <small class="installed-factor-description">${escapeHtml(component?.description ?? "")}</small>
            </div>
            <button class="micro-button danger" type="button" data-remove-olivia-component="${placement.instanceId}" ${editable ? "" : "disabled"}>移除</button>
          </div>`;
        })
        .join("")
    : `<p class="empty-state">尚未安装装备或改造。点击左侧因子即可自动放入合法空位。</p>`;
  const availableComponents = COMPONENTS.filter((component) =>
    isContentUnlocked(component, state),
  );
  const factors = availableComponents
    .map((component) => {
      const canUseEquipmentSlot =
        component.biofactorType === "EQUIPMENT" &&
        component.size.width === 1 &&
        component.size.height === 1 &&
        !component.providesAuxiliaryZone &&
        !equipmentZone?.cells.some(Boolean);
      const installed = blueprint.configurablePlacements.some(
        (placement) => placement.contentId === component.id,
      );
      return `<button
        class="factor-card factor-card-compact"
        type="button"
        data-add-olivia-component="${component.id}"
        data-olivia-zone="${canUseEquipmentSlot ? "LEGENDARY_EQUIPMENT" : "BASE"}"
        data-factor-browser-card
        data-factor-type="${component.biofactorType}"
        data-factor-effects="${getBiofactorEffectTags(component).join(" ")}"
        data-factor-search="${escapeHtml(getBiofactorSearchText(component))}"
        ${installed ? 'data-state="installed"' : ""}
        ${editable ? "" : "disabled"}
      >
        <span class="factor-card-title">◈ ${escapeHtml(component.name)}</span>
        <span class="factor-compact-size">${component.size.width}×${component.size.height}</span>
      </button>`;
    })
    .join("");
  const abilities = blueprint.abilityDetails
    .filter((ability) => !ability.special)
    .map(
      (ability) =>
        `<li>${hasVisibleAbilityTitle(ability) ? `<strong>[${escapeHtml(ability.name ?? "未知异能")}]</strong>` : ""}<span>${escapeHtml(ability.description ?? "暂无具体说明。")}</span></li>`,
    )
    .join("") || `<li><span>无衍生异能</span></li>`;
  const specialAbilities = blueprint.abilityDetails
    .filter((ability) => ability.special)
    .map(
      ({ name, description }) =>
        `<li><strong>[${escapeHtml(name ?? "未知专属能力")}]</strong><span>${escapeHtml(description ?? "暂无具体说明。")}</span></li>`,
    )
    .join("");

  return `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PROTOTYPE // 传奇生物因子构筑</div>
        <h1>原体编辑器</h1>
      </div>
      <span class="status-pill ${blueprint.valid ? "" : "warning"}">${blueprint.valid ? "传奇蓝图合法" : `${blueprint.issues.length}项待处理`}</span>
    </div>
    <div class="blueprint-layout">
      <article class="panel">
        <div class="panel-header"><div class="panel-label">01 // 身份锁定</div><span class="status-pill">传奇</span></div>
        <label class="terminal-field"><span>蓝图名称</span><input class="terminal-input" value="${escapeHtml(definition.name)}" disabled></label>
        <label class="terminal-field">
          <span>传奇</span>
          <select class="terminal-select" data-blueprint-legendary>
            <option value="">普通蓝图</option>
            ${renderLegendaryBlueprintOptions(state)}
          </select>
        </label>
        <p class="field-help">传奇蓝图固定种族、职业与法术力颜色；装备和改造共用下方拓展格。</p>
        <label class="terminal-field"><span>种族</span><input class="terminal-input" value="${escapeHtml(race.name)}" disabled></label>
        <label class="terminal-field"><span>种族法术力</span><input class="terminal-input" value="${definition.colors.map((color) => `[${color}]`).join("")}" disabled></label>
        <p class="field-help">${escapeHtml(race.description)}</p>
        ${renderBiofactorEffectSummary(race, "无额外异能")}
        ${renderBiofactorAbilityDetails(race)}
        <label class="terminal-field"><span>职业</span><input class="terminal-input" value="${escapeHtml(job.name)}" disabled></label>
        <p class="field-help">${escapeHtml(job.description)}</p>
        ${renderBiofactorEffectSummary(job)}
        ${renderBiofactorAbilityDetails(job)}
        <div class="panel-label factor-heading">02 // 装备因子与改造因子</div>
        <div class="factor-browser">
          <label class="terminal-field factor-search-field"><span>搜索生物因子</span><input class="terminal-input" type="search" value="${escapeHtml(factorSearchQuery)}" placeholder="名称、类别、异能或效果……" data-factor-search></label>
          <div class="factor-filter-row" role="group" aria-label="因子类型筛选">
            ${[["ALL", "全部"], ["EQUIPMENT", "装备"], ["MODIFICATION", "改造"]].map(([id, label]) => `<button class="filter-button ${factorTypeFilter === id ? "is-active" : ""}" type="button" data-factor-type-filter="${id}">${label}</button>`).join("")}
          </div>
          <div class="factor-filter-row effect-filters" role="group" aria-label="因子效果筛选">
            ${[["ALL", "全部效果"], ["POWER", "力量"], ["DEFENSE", "防御"], ["HP", "生命"], ["ABILITY", "异能"], ["FIELD", "字段"], ["LEGENDARY", "传奇"]].map(([id, label]) => `<button class="filter-button ${factorEffectFilter === id ? "is-active" : ""}" type="button" data-factor-effect-filter="${id}">${label}</button>`).join("")}
          </div>
          <div class="factor-filter-status" data-factor-filter-result role="status"></div>
        </div>
        <div class="factor-list">${factors}<div class="empty-state factor-filter-empty" data-factor-filter-empty hidden>没有符合当前搜索与筛选条件的因子。</div></div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><div class="panel-label">EXPANSION GRID // 共用拓展格</div><div class="panel-title">${escapeHtml(definition.name)}</div></div><span class="status-pill">${occupiedCells} / ${totalCells}</span></div>
        <div class="grid-zones">${gridZones}</div>
        <p class="field-help">兼容的1×1装备会优先进入传奇独立装备格；其余因子自动放入通用拓展格。</p>
        <div class="panel-label installed-factor-heading">已安装生物因子详情</div>
        <div class="installed-list">${installed}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div class="panel-label">FINAL ATTRIBUTES // 权威计算</div></div>
        <table class="stat-table"><tbody>
          <tr><td>颜色</td><td>${definition.colors.map((color) => `[${color}]`).join("")}</td></tr>
          <tr><td>力量</td><td>${blueprint.stats.power}</td></tr>
          <tr><td>防御</td><td>${blueprint.stats.defense}</td></tr>
          <tr><td>生命</td><td>${blueprint.stats.hp}</td></tr>
          <tr><td>LP</td><td>${blueprint.baseLp} / ${blueprint.maxLp}</td></tr>
          <tr><td>固定设计成本</td><td>${formatCost(definition.designCost)}</td></tr>
          <tr><td>已装因子成本</td><td>${formatCost(blueprint.factorCost)}</td></tr>
        </tbody></table>
        <div class="panel-label ability-heading">衍生异能</div>
        <ul class="ability-list">${abilities}</ul>
        ${specialAbilities ? `<div class="panel-label ability-heading">专属能力</div><ul class="ability-list">${specialAbilities}</ul>` : ""}
        ${blueprint.issues.length ? `<div class="validation-list">${blueprint.issues.map((issue) => `<p>! ${escapeHtml(issue)}</p>`).join("")}</div>` : `<div class="validation-ok">✓ 身份锁定、拓展格与因子配置均合法</div>`}
        <p class="dialog-message ${prototypeMessageIsError ? "is-error" : ""}" role="status">${escapeHtml(prototypeMessage)}</p>
        <p class="field-help">传奇蓝图的因子变更会立即保存。${editable ? "" : "当前状态不可编辑。"}</p>
      </article>
    </div>
    ${renderOliviaPanel(state)}
  `;
}

function renderOliviaPanel(state) {
  if (!isLegendaryBlueprintUnlocked(state, OLIVIA_BLUEPRINT_ID)) {
    return "";
  }
  const entity = state.legendaryPrototypes.find(
    (item) => item.blueprintId === OLIVIA_BLUEPRINT_ID,
  );
  const configuration = getLegendaryConfiguration(
    state,
    OLIVIA_BLUEPRINT_ID,
  );
  const identity = getLegendaryIdentity(
    state,
    "LEGENDARY_IDENTITY_OLIVIA_VOLDAREN",
  );
  const blueprint = deriveOliviaBlueprint(state, entity);
  const progress = identity?.contentProgress ?? entity?.progress ?? {
    directKills: 0,
    commanderTriggers: 0,
    expeditionsCompleted: 0,
  };
  const career = identity?.career ?? {};
  const statusLabel = configuration.archivedAt
    ? "蓝图已封存"
    : entity?.status === "INJURED"
      ? "负伤恢复"
      : entity?.status ?? "蓝图已解锁";
  return `
    <div class="page-heading compact-heading">
      <div>
        <div class="eyebrow">LEGENDARY STATUS // 实体与身份</div>
        <h2>奥莉薇亚·沃达连</h2>
      </div>
      <span class="status-pill">${statusLabel}</span>
    </div>
    <section class="blueprint-cards">
      <article class="blueprint-card">
        <div class="mini-stat"><span>力量 / 防御 / 生命</span><strong>${blueprint.stats.power} / ${blueprint.stats.defense} / ${blueprint.stats.hp}</strong></div>
        <div class="mini-stat"><span>LP</span><strong>${entity?.currentLp ?? blueprint.baseLp} / ${blueprint.maxLp}（出征保障 ${blueprint.baseLp}）</strong></div>
        <div class="mini-stat"><span>设计成本 / 实体化</span><strong>3[B]＋3[R] / 1200[C]</strong></div>
        <div class="mini-stat"><span>直接击杀</span><strong>${progress.directKills} / 100</strong></div>
        <div class="mini-stat"><span>指挥触发</span><strong>${progress.commanderTriggers} / 100</strong></div>
        <div class="mini-stat"><span>正式远征</span><strong>${progress.expeditionsCompleted} / 50</strong></div>
        ${
          configuration.archivedAt
            ? `<button class="terminal-button full-button" data-restore-legendary-blueprint="${OLIVIA_BLUEPRINT_ID}">解除封存</button>`
            : !entity
            ? `<button class="terminal-button full-button" data-instantiate-olivia>实体化沃达连 · ${isTestMode(state) ? "测试模式免费" : "1200[C]"}</button>`
            : entity.status === "DEAD"
              ? `<button class="terminal-button warning full-button" data-rebuild-olivia="${entity.id}">重构沃达连 · ${isTestMode(state) ? "测试模式免费" : "1200[C]"}</button>`
              : entity.status === "INJURED"
                ? `<p class="field-help">负伤撤离：需由另一次正式远征完成后恢复。</p>`
                : `<p class="field-help">基地休息每分钟恢复1 LP；单体出击或担任指挥官时停止恢复。</p>`
        }
        <div class="inline-actions">
          ${entity && !["DEPLOYED", "COMMANDING"].includes(entity.status) ? `<button class="micro-button danger" data-destroy-legendary-entity="${entity.id}">销毁当前实体</button>` : ""}
          ${!entity && !configuration.archivedAt ? `<button class="micro-button" data-archive-legendary-blueprint="${OLIVIA_BLUEPRINT_ID}">封存传奇蓝图</button>` : ""}
        </div>
      </article>
      <article class="blueprint-card">
        <div class="panel-label">传奇身份档案 · 跨实体永久保存</div>
        <div class="mini-stat"><span>实体世代</span><strong>${identity?.entityHistory?.length ?? 0}</strong></div>
        <div class="mini-stat"><span>有效伤害 / 承伤存活</span><strong>${career.effectiveDamage ?? 0} / ${career.damageTakenSurvived ?? 0}</strong></div>
        <div class="mini-stat"><span>单体胜利 / 指挥胜利</span><strong>${career.soloVictories ?? 0} / ${career.commanderVictories ?? 0}</strong></div>
        <div class="mini-stat"><span>直接伤害 / 协助伤害</span><strong>${career.directDamage ?? 0} / ${career.assistedDamage ?? 0}</strong></div>
        <div class="mini-stat"><span>远征时间 / 有效服役</span><strong>${formatClock(career.expeditionTime ?? 0)} / ${formatClock(career.activeServiceTime ?? 0)}</strong></div>
        <p class="field-help">蓝图提供制造来源；身份档案保存履历和成长；当前实体只保存生命、LP、伤势与装备状态。</p>
      </article>
    </section>
  `;
}

function renderPrototypeEditor(state, force = false) {
  const root = document.querySelector("#prototype-content");
  if (!root || !state) return;
  const signature = getPrototypeSignature(state);
  if (!force && prototypeStateSignature === signature) return;
  prototypeStateSignature = signature;

  const race = getRace(blueprintDraft.raceId);
  const job = getJob(blueprintDraft.jobId);
  const result = deriveBlueprint(blueprintDraft, state);
  const grid = inspectGrid(blueprintDraft);
  const availableRaces = RACES.filter((item) =>
    isContentUnlocked(item, state),
  );
  const availableJobs = JOBS.filter((item) =>
    isContentUnlocked(item, state),
  );
  const availableComponents = COMPONENTS.filter((item) =>
    isContentUnlocked(item, state),
  );
  const occupiedCells = grid.zones.reduce(
    (sum, zone) => sum + zone.cells.filter(Boolean).length,
    0,
  );
  const totalCells = grid.zones.reduce(
    (sum, zone) => sum + zone.cells.length,
    0,
  );
  if (
    movingPlacementId &&
    !blueprintDraft.placements.some(
      (item) => item.instanceId === movingPlacementId,
    )
  ) {
    movingPlacementId = null;
  }
  const gridZones = grid.zones
    .map((zone, zoneIndex) => {
      const cells = zone.cells
        .map((instanceId, cellIndex) => {
          const x = cellIndex % zone.width;
          const y = Math.floor(cellIndex / zone.width);
          const placement = blueprintDraft.placements.find(
            (item) => item.instanceId === instanceId,
          );
          const component = getComponent(placement?.contentId);
          let validMoveTarget = false;
          if (movingPlacementId) {
            try {
              movePlacement(blueprintDraft, movingPlacementId, {
                zoneId: zone.id,
                x,
                y,
              });
              validMoveTarget = true;
            } catch {
              validMoveTarget = false;
            }
          }
          const isMovingComponent =
            placement?.instanceId === movingPlacementId;
          const actionAttribute = movingPlacementId
            ? validMoveTarget
              ? `data-move-placement-target="${movingPlacementId}" data-zone-id="${zone.id}" data-x="${x}" data-y="${y}"`
              : "disabled"
            : component
              ? `data-begin-move="${placement.instanceId}"`
              : "disabled";
          const title = movingPlacementId
            ? validMoveTarget
              ? `移动到${zone.kind === "BASE" ? "基础格" : zone.kind === "AUX_GENERAL" ? "附加通用区" : "附加装备区"} ${x + 1},${y + 1}`
              : "此处不能放置"
            : component
              ? `移动${component.name}`
              : "空格";
          return `
            <button
              class="grid-cell ${component ? "occupied" : ""} ${validMoveTarget ? "move-target" : ""} ${isMovingComponent ? "moving-source" : ""}"
              type="button"
              ${actionAttribute}
              title="${title}"
            >${movingPlacementId && validMoveTarget ? "◎" : component ? component.name.slice(0, 1) : "+"}</button>
          `;
        })
        .join("");
      return `
        <div class="grid-zone ${zone.kind !== "BASE" ? "auxiliary-zone" : ""}">
          <div class="mini-stat">
            <span>${
              zone.kind === "BASE"
                ? zone.id === "BASE"
                  ? "基础拓展格"
                  : "第二基础拓展格"
                : zone.kind === "AUX_GENERAL"
                  ? "尸嵌化附加通用区"
                  : `胳膊附加装备区 ${zoneIndex}`
            }</span>
            <strong>${zone.width}×${zone.height}</strong>
          </div>
          <div class="grid-editor prototype-grid" style="--grid-columns:${zone.width}" aria-label="${zone.kind === "BASE" ? "原体基础拓展格" : zone.kind === "AUX_GENERAL" ? "尸嵌化附加通用区" : "胳膊附加装备区"}">${cells}</div>
        </div>`;
    })
    .join("");

  const placements = blueprintDraft.placements.length
    ? blueprintDraft.placements
        .map((placement) => {
          const component = getComponent(placement.contentId);
          const placementSize = getPlacementSize(
            component,
            placement.rotation,
          );
          const nextRotation = placement.rotation === 90 ? 0 : 90;
          let canRotate = true;
          if (
            component.rotatable &&
            component.size.width !== component.size.height
          ) {
            try {
              movePlacement(blueprintDraft, placement.instanceId, {
                zoneId: placement.zoneId ?? "BASE",
                x: placement.x,
                y: placement.y,
                rotation: nextRotation,
              });
            } catch {
              canRotate = false;
            }
          }
          return `
            <div class="installed-factor">
              <div>
                <strong>${component.name}</strong>
                <small>${
                  component.slotless
                    ? "不占格"
                    : `${placementSize.width}×${placementSize.height}${placement.rotation === 90 ? " · 已旋转" : ""} · ${(placement.zoneId ?? "BASE").startsWith("BASE") ? "基础格" : (placement.zoneId ?? "").startsWith("AUX_") ? "附加拓展区" : "装备格"}`
                } · ${componentCostLabel(component)}</small>
                ${renderBiofactorEffectSummary(component)}
                ${renderBiofactorAbilityDetails(component)}
                <small class="installed-factor-description">${escapeHtml(component.description)}</small>
              </div>
              <div class="inline-actions">
                ${
                  component.slotless
                    ? ""
                    : `<button class="micro-button ${movingPlacementId === placement.instanceId ? "is-active" : ""}" type="button" data-begin-move="${placement.instanceId}">${movingPlacementId === placement.instanceId ? "取消移动" : "移动"}</button>`
                }
                ${
                  component.rotatable && component.size.width !== component.size.height
                    ? `<button class="micro-button" type="button" data-rotate-placement="${placement.instanceId}" ${canRotate ? "" : "disabled"} title="${canRotate ? "旋转生物因子" : "另一方向无法放入当前拓展格"}">旋转</button>`
                    : ""
                }
                <button class="micro-button danger" type="button" data-remove-placement="${placement.instanceId}">移除</button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="empty-state">尚未安装装备或改造。点击左侧因子即可自动放入合法空位。</p>`;

  const abilities = result.abilityDetails
    .filter((ability) => !ability.special)
    .map(
      (ability) =>
        `<li>${hasVisibleAbilityTitle(ability) ? `<strong>[${escapeHtml(ability.name ?? "未知异能")}]</strong>` : ""}<span>${escapeHtml(ability.description ?? "暂无具体说明。")}</span></li>`,
    )
    .join("") || `<li><span>无衍生异能</span></li>`;
  const specialAbilities = result.abilityDetails
    .filter((ability) => ability.special)
    .map(
      ({ name, description }) =>
        `<li><strong>[${escapeHtml(name ?? "未知专属能力")}]</strong><span>${escapeHtml(description ?? "暂无具体说明。")}</span></li>`,
    )
    .join("");

  const blueprintCards = state.blueprints.length
    ? state.blueprints
        .map((blueprint) => {
          const prototype = state.prototypes.find(
            (item) => item.blueprintId === blueprint.id,
          );
          const legion = (state.legions ?? []).find(
            (item) => item.blueprintId === blueprint.id,
          );
          const jobItem = state.productionQueue.find(
            (item) => item.blueprintId === blueprint.id,
          );
          const maxScale = Math.min(
            state.base.legionScaleCap ?? 10,
            blueprint.scaleHpCap ?? 10,
          );
          const currentScale = legion?.purchasedScaleHp ?? 0;
          const remainingScale = Math.max(0, maxScale - currentScale);
          const defaultScale = Math.min(3, remainingScale);
          const legionInExpedition =
            Boolean(legion) &&
            state.activeExpedition?.legionId === legion.id;
          const prototypeInExpedition =
            Boolean(prototype) &&
            (prototype.status === "DEPLOYED" ||
              state.activeExpedition?.prototypeId === prototype.id);
          const emptyStandbyLegion = isEmptyStandbyLegion(legion);
          const canDisbandLegion =
            Boolean(legion) && !legionInExpedition && !jobItem;
          const canDestroyPrototype =
            Boolean(prototype) &&
            !prototypeInExpedition &&
            !legion &&
            !jobItem;
          const canDeleteBlueprint =
            !prototype &&
            !legion &&
            !jobItem &&
            state.activeExpedition?.blueprintId !== blueprint.id;
          const lifecycleHint = legionInExpedition
            ? "远征中的军团不能解散；请等待远征结束。"
            : jobItem
              ? "关联的镜映品正在生产；需先在生产队列中取消。"
              : legion
                ? "先解散军团，才能销毁原体。"
                : prototypeInExpedition
                  ? "远征中的原体不能销毁。"
                  : prototype
                    ? "销毁原体后，才能永久删除蓝图。"
                    : "蓝图现在可以永久删除，也可以支付蓝图价值重新实体化原体。";
          return `
            <article class="blueprint-card">
              <div class="panel-header">
                <div>
                  <div class="panel-label">${blueprint.colors.map((color) => `[${color}]`).join("")} // ${getRace(blueprint.raceId).name}</div>
                  <div class="panel-title">${escapeHtml(blueprint.name)}</div>
                </div>
                <span class="status-pill">${!prototype ? "仅存蓝图" : prototype.status === "DEAD" ? "原体死亡" : legion && jobItem ? "补充中" : emptyStandbyLegion ? "军团待命 · 0复制体" : legion ? "军团待命" : jobItem ? "复制中" : "原体待命"}</span>
              </div>
              <div class="mini-stat"><span>力量 / 防御 / 原体生命</span><strong>${blueprint.stats.power} / ${blueprint.stats.defense} / ${blueprint.stats.hp}</strong></div>
              <div class="mini-stat"><span>每点军团生命</span><strong>${blueprint.scaleHpCost}[C]</strong></div>
              <div class="prototype-ready">
                <div class="mini-stat"><span>实体原体</span><strong>${escapeHtml(prototype?.name ?? "未实体化")}</strong></div>
                <div class="mini-stat"><span>原体状态 / 生命</span><strong>${!prototype ? `未实体化 · — / ${blueprint.stats.hp}` : `${prototype.status === "DEAD" ? "死亡" : prototype.status === "DEPLOYED" ? "远征中" : "基地待命"} · ${prototype.currentHp ?? 0} / ${prototype.maxHp ?? blueprint.stats.hp}`}</strong></div>
              </div>
              ${
                (!legion || emptyStandbyLegion) &&
                !jobItem &&
                prototype?.status !== "DEPLOYED"
                  ? `<button class="terminal-button secondary full-button" data-edit-blueprint="${blueprint.id}">二次编辑蓝图</button>`
                  : ""
              }
              ${
                prototype?.status === "DEAD"
                  ? `<button class="terminal-button warning full-button" data-rebuild-prototype="${prototype.id}">重构原体 · ${blueprint.equivalentValue}[C]</button>`
                  : !prototype
                    ? `<div class="scale-control">
                        <p class="field-help">首次免费原体资格已经消耗；重新实体化不会刷新该资格。</p>
                        <button class="terminal-button full-button" data-instantiate-prototype="${blueprint.id}">重新实体化原体 · ${isTestMode(state) ? "测试模式免费" : `${blueprint.equivalentValue}[C]`}</button>
                      </div>`
                    : legion
                    ? `<div class="legion-ready">
                        <strong>${legion.name}</strong>
                        <span>${legion.currentPower}/${legion.currentDefense}/${legion.currentHp} · ${legion.replicaCount}名复制体 · 已购${currentScale}/${maxScale}点军团生命</span>
                      </div>
                      ${
                        jobItem
                          ? `<div class="metric production-job" data-production-job="${jobItem.id}" data-completes-at="${jobItem.completesAt}" data-started-at="${jobItem.startedAt}">
                              <div class="metric-row"><span>军团补充中 · +${jobItem.purchasedScaleHp}生命</span><strong data-job-countdown>${formatClock(jobItem.completesAt - Date.now())}</strong></div>
                              <div class="progress"><span data-job-progress style="width:0%"></span></div>
                            </div>`
                          : remainingScale > 0
                          ? `<div class="scale-control">
                              <label for="scale-${prototype.id}">补充军团生命：<strong data-scale-output="${prototype.id}">${defaultScale}</strong> / 剩余${remainingScale}</label>
                              <input id="scale-${prototype.id}" type="range" min="1" max="${remainingScale}" value="${Math.max(1, defaultScale)}" data-scale-input="${prototype.id}" ${legionInExpedition ? "disabled" : ""}>
                              <div class="mini-stat"><span>新增复制体 / 成本</span><strong data-scale-summary="${prototype.id}">${Math.max(1, defaultScale) * blueprint.replicasPerScaleHp}人 / ${Math.max(1, defaultScale) * blueprint.scaleHpCost}[C]</strong></div>
                              <button class="terminal-button full-button" data-queue-legion="${prototype.id}" ${legionInExpedition ? "disabled" : ""}>${legionInExpedition ? "远征中无法补充" : "补充军团"}</button>
                            </div>`
                          : `<p class="field-help">军团生命已达到当前总上限。</p>`
                      }`
                    : jobItem
                      ? `<div class="metric production-job" data-production-job="${jobItem.id}" data-completes-at="${jobItem.completesAt}" data-started-at="${jobItem.startedAt}">
                          <div class="metric-row"><span>镜映品生产中</span><strong data-job-countdown>${formatClock(jobItem.completesAt - Date.now())}</strong></div>
                          <div class="progress"><span data-job-progress style="width:0%"></span></div>
                        </div>`
                      : `<div class="scale-control">
                          <label for="scale-${prototype.id}">购买军团生命：<strong data-scale-output="${prototype.id}">3</strong> / ${maxScale}</label>
                          <input id="scale-${prototype.id}" type="range" min="0" max="${maxScale}" value="3" data-scale-input="${prototype.id}">
                          <div class="mini-stat"><span>复制体 / 总成本</span><strong data-scale-summary="${prototype.id}">${3 * blueprint.replicasPerScaleHp}人 / ${3 * blueprint.scaleHpCost}[C]</strong></div>
                          <button class="terminal-button full-button" data-queue-legion="${prototype.id}">启动镜映品</button>
                        </div>`
              }
              <div class="lifecycle-controls">
                <div class="panel-label">LIFECYCLE // 生命周期管理</div>
                <p class="field-help">${lifecycleHint}</p>
                ${
                  legion
                    ? `<button class="terminal-button danger full-button" data-disband-legion="${legion.id}" ${canDisbandLegion ? "" : "disabled"}>解散军团 · 不退款</button>`
                    : ""
                }
                ${
                  prototype
                    ? `<button class="terminal-button danger full-button" data-destroy-prototype="${prototype.id}" ${canDestroyPrototype ? "" : "disabled"}>销毁原体 · 保留蓝图</button>`
                    : ""
                }
                <button class="terminal-button danger full-button" data-delete-blueprint="${blueprint.id}" ${canDeleteBlueprint ? "" : "disabled"}>永久删除蓝图 · 不退款</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state large">还没有蓝图。完成上方设计并保存后，将免费实体化第一具原体。</div>`;

  if (selectedLegendaryBlueprintId) {
    root.innerHTML = `
      ${renderLegendaryPrototypeEditor(state)}
      <div class="page-heading compact-heading">
        <div>
          <div class="eyebrow">MIRRORWORKS // 镜映品生产</div>
          <h2>蓝图与待命军团</h2>
        </div>
        <span class="status-pill">${state.blueprints.length} / ${state.base.blueprintCap} 蓝图</span>
      </div>
      <section class="blueprint-cards">${blueprintCards}</section>
    `;
    applyBiofactorFilters(root);
    return;
  }

  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PROTOTYPE // 生物因子构筑</div>
        <h1>原体编辑器</h1>
      </div>
      <span class="status-pill ${result.valid ? "" : "warning"}">${result.valid ? "蓝图合法" : `${result.issues.length}项待处理`}</span>
    </div>
    <div class="blueprint-layout">
      <article class="panel">
        <div class="panel-header">
          <div class="panel-label">01 // 种族与职业</div>
          <span class="status-pill">${availableComponents.length} 因子可用</span>
        </div>
        <label class="terminal-field">
          <span>蓝图名称</span>
          <input class="terminal-input" data-blueprint-name value="${escapeHtml(blueprintDraft.name)}" maxlength="30">
        </label>
        ${
          renderLegendaryBlueprintOptions(state)
            ? `<label class="terminal-field">
                <span>传奇</span>
                <select class="terminal-select" data-blueprint-legendary>
                  <option value="" selected>普通蓝图</option>
                  ${renderLegendaryBlueprintOptions(state)}
                </select>
              </label>
              <p class="field-help">选择已解锁的传奇原体蓝图后，种族、职业和法术力颜色将由传奇身份锁定。</p>`
            : ""
        }
        <label class="terminal-field">
          <span>种族</span>
          <select class="terminal-select" data-blueprint-race>
            ${availableRaces.map((item) => `<option value="${item.id}" ${item.id === race.id ? "selected" : ""}>${item.name} / ${item.englishName}</option>`).join("")}
          </select>
        </label>
        <label class="terminal-field">
          <span>种族法术力</span>
          ${renderManaSelect(race.availableColors, blueprintDraft.raceColor, "data-blueprint-race-color")}
        </label>
        <p class="field-help">${race.description}</p>
        ${renderBiofactorEffectSummary(race, "无额外异能")}
        ${renderBiofactorAbilityDetails(race)}
        <label class="terminal-field">
          <span>职业</span>
          <select class="terminal-select" data-blueprint-job>
            ${availableJobs.map((item) => `<option value="${item.id}" ${item.id === job.id ? "selected" : ""}>${item.name} / ${item.englishName}</option>`).join("")}
          </select>
        </label>
        ${
          job.availableColors.length
            ? `<label class="terminal-field"><span>职业法术力</span>${renderManaSelect(job.availableColors, blueprintDraft.jobColor, "data-blueprint-job-color")}</label>`
            : ""
        }
        <p class="field-help">${job.description}</p>
        ${renderBiofactorEffectSummary(job)}
        ${renderBiofactorAbilityDetails(job)}
        <div class="panel-label factor-heading">02 // 装备因子与改造因子</div>
        <div class="factor-browser">
          <label class="terminal-field factor-search-field">
            <span>搜索生物因子</span>
            <input
              class="terminal-input"
              type="search"
              value="${escapeHtml(factorSearchQuery)}"
              placeholder="名称、类别、异能或效果……"
              data-factor-search
            >
          </label>
          <div class="factor-filter-row" role="group" aria-label="因子类型筛选">
            ${[
              ["ALL", "全部"],
              ["EQUIPMENT", "装备"],
              ["MODIFICATION", "改造"],
            ]
              .map(
                ([id, label]) =>
                  `<button class="filter-button ${factorTypeFilter === id ? "is-active" : ""}" type="button" data-factor-type-filter="${id}">${label}</button>`,
              )
              .join("")}
          </div>
          <div class="factor-filter-row effect-filters" role="group" aria-label="因子效果筛选">
            ${[
              ["ALL", "全部效果"],
              ["POWER", "力量"],
              ["DEFENSE", "防御"],
              ["HP", "生命"],
              ["ABILITY", "异能"],
              ["FIELD", "字段"],
              ["LEGENDARY", "传奇"],
            ]
              .map(
                ([id, label]) =>
                  `<button class="filter-button ${factorEffectFilter === id ? "is-active" : ""}" type="button" data-factor-effect-filter="${id}">${label}</button>`,
              )
              .join("")}
          </div>
          <div class="factor-filter-status" data-factor-filter-result role="status"></div>
        </div>
        <div class="factor-list">
          ${availableComponents
            .map(
              (component) => {
                const installed = blueprintDraft.placements.some(
                  (placement) => placement.contentId === component.id,
                );
                return `
                <button
                  class="factor-card factor-card-compact"
                  type="button"
                  data-add-component="${component.id}"
                  data-factor-browser-card
                  data-factor-type="${component.biofactorType}"
                  data-factor-effects="${getBiofactorEffectTags(component).join(" ")}"
                  data-factor-search="${escapeHtml(getBiofactorSearchText(component))}"
                  ${installed ? 'data-state="installed"' : ""}
                >
                  <span class="factor-card-title">◈ ${escapeHtml(component.name)}</span>
                  <span class="factor-compact-size">${component.size.width}×${component.size.height}</span>
                </button>
              `;
              },
            )
            .join("")}
          <div class="empty-state factor-filter-empty" data-factor-filter-empty hidden>没有符合当前搜索与筛选条件的因子。</div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-label">EXPANSION GRID // ${race.grid.width} × ${race.grid.height}</div>
            <div class="panel-title">${escapeHtml(blueprintDraft.name)}</div>
          </div>
          <span class="status-pill">${occupiedCells} / ${totalCells}</span>
        </div>
        <div class="grid-zones">${gridZones}</div>
        ${
          movingPlacementId
            ? `<div class="move-notice"><span>正在移动生物因子：请选择带◎的目标格。</span><button class="micro-button" type="button" data-cancel-move>取消</button></div>`
            : `<p class="field-help">点击已安装因子的“移动”按钮，再选择一个合法目标格。</p>`
        }
        <div class="panel-label installed-factor-heading">已安装生物因子详情</div>
        <div class="installed-list">${placements}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div class="panel-label">FINAL ATTRIBUTES // 权威计算</div></div>
        <table class="stat-table">
          <tbody>
            <tr><td>颜色</td><td>${result.colors.map((color) => `[${color}]`).join("")}</td></tr>
            <tr><td>力量</td><td>${result.stats.power}</td></tr>
            <tr><td>防御</td><td>${result.stats.defense}</td></tr>
            <tr><td>生命</td><td>${result.stats.hp}</td></tr>
            <tr><td>形态</td><td>${result.fields.form}</td></tr>
            <tr><td>材质</td><td>${result.fields.material}</td></tr>
            <tr><td>智力</td><td>${result.fields.intelligent ? "有" : "无"}</td></tr>
            <tr><td>语言</td><td>${result.fields.canCommunicate ? "有" : "无"}</td></tr>
            <tr><td>设计成本</td><td>${formatCost(result.designCost)}</td></tr>
            <tr><td>每点军团生命</td><td>${result.scaleHpCost}[C]</td></tr>
          </tbody>
        </table>
        <div class="panel-label ability-heading">衍生异能</div>
        <ul class="ability-list">${abilities}</ul>
        ${specialAbilities ? `<div class="panel-label ability-heading">专属能力</div><ul class="ability-list">${specialAbilities}</ul>` : ""}
        ${
          result.issues.length
            ? `<div class="validation-list">${result.issues.map((issue) => `<p>! ${issue}</p>`).join("")}</div>`
            : `<div class="validation-ok">✓ 拓展格、字段和成本计算均合法</div>`
        }
        <p class="dialog-message ${prototypeMessageIsError ? "is-error" : ""}" role="status">${escapeHtml(prototypeMessage)}</p>
        <button class="terminal-button full-button" data-save-blueprint ${result.valid ? "" : "disabled"}>${editingBlueprintId ? "支付完整设计成本并保存修改" : "支付成本并保存蓝图"}</button>
        ${
          editingBlueprintId
            ? `<button class="terminal-button secondary full-button" data-cancel-blueprint-edit>取消二次编辑</button>
               <p class="field-help">修改沿用原蓝图与原体，不再赠送免费原体；按修改后的完整设计成本支付。</p>`
            : `<p class="field-help">每份新蓝图首次保存时，免费实体化一具原体。</p>`
        }
      </article>
    </div>
    <div class="page-heading compact-heading">
      <div>
        <div class="eyebrow">MIRRORWORKS // 镜映品生产</div>
        <h2>蓝图与待命军团</h2>
      </div>
      <span class="status-pill">${state.blueprints.length} / ${state.base.blueprintCap} 蓝图</span>
    </div>
    <section class="blueprint-cards">${blueprintCards}</section>
  `;
  applyBiofactorFilters(root);
}

function getBiofactorTypeLabel(content) {
  return {
    RACE: "种族因子",
    JOB: "职业因子",
    EQUIPMENT: "装备因子",
    MODIFICATION: "改造因子",
  }[content.biofactorType] ?? content.category ?? "生物因子";
}

function getBiofactorDimensionLabel(content) {
  if (content.biofactorType === "RACE") {
    if (content.baseZones?.length > 1) {
      return `基础拓展格 ${content.baseZones
        .map((zone) => `${zone.width}×${zone.height}`)
        .join("＋")}`;
    }
    return `基础拓展格 ${content.grid.width}×${content.grid.height}`;
  }
  if (content.slotless) return "不占拓展格";
  if (content.size) {
    return `占用 ${content.size.width}×${content.size.height}`;
  }
  return "不占拓展格";
}

function getBiofactorCatalogCost(content) {
  const parts = [];
  if (content.fixedColorCost) {
    for (const [color, amount] of Object.entries(content.fixedColorCost)) {
      if (amount > 0) parts.push(`${amount}[${color}]`);
    }
  } else if ((content.colorCost ?? 0) > 0) {
    const colors = (content.availableColors ?? [])
      .map((color) => `[${color}]`)
      .join("／");
    parts.push(`${content.colorCost}${colors || "点有色法术力"}`);
  } else if (content.colorCost && typeof content.colorCost === "object") {
    for (const [color, amount] of Object.entries(content.colorCost)) {
      if (amount > 0) parts.push(`${amount}[${color}]`);
    }
  }
  if ((content.colorlessCost ?? 0) > 0) {
    parts.push(`${content.colorlessCost}[C]`);
  }
  return parts.join(" + ") || "无额外成本";
}

function renderBiofactorCatalogMeta(content) {
  const requirements = getBiofactorRequirementSummary(content);
  const fieldSummary = content.fields
    ? `${content.fields.form}／${content.fields.material}／智力${content.fields.intelligent ? "有" : "无"}／语言${content.fields.canCommunicate ? "有" : "无"}${content.fields.artifact ? "／神器" : ""}`
    : "";
  const details = [
    ["分类", `${getBiofactorTypeLabel(content)}${content.subcategory ? `／${content.subcategory}` : ""}`],
    ["格位", getBiofactorDimensionLabel(content)],
    ["成本", getBiofactorCatalogCost(content)],
    requirements ? ["安装要求", requirements] : null,
    fieldSummary ? ["基础字段", fieldSummary] : null,
    content.replicasPerScaleHp
      ? ["每点军团生命", `${content.replicasPerScaleHp}个复制体`]
      : null,
    content.scaleHpCap
      ? ["购买规模上限", `${content.scaleHpCap}点军团生命`]
      : null,
  ].filter(Boolean);
  return details
    .map(
      ([label, value]) =>
        `<div class="mini-stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
}

function renderBiofactorCatalog(state, force = false) {
  const root = document.querySelector("#biofactors-content");
  if (!root) return;
  const signature = JSON.stringify({
    originId: state.base.originId,
    testMode: isTestMode(state),
    unlockedBiofactors: state.unlockedBiofactors,
  });
  if (!force && signature === biofactorCatalogStateSignature) {
    applyBiofactorFilters(root);
    return;
  }
  biofactorCatalogStateSignature = signature;

  const contents = [...RACES, ...JOBS, ...COMPONENTS].filter((content) =>
    isContentUnlocked(content, state),
  );
  const cards = contents
    .map((content) => {
      const requirements = getBiofactorRequirementSummary(content);
      return `
        <article
          class="catalog-card biofactor-catalog-card"
          data-factor-browser-card
          data-factor-type="${content.biofactorType}"
          data-factor-effects="${getBiofactorEffectTags(content).join(" ")}"
          data-factor-search="${escapeHtml(getBiofactorSearchText(content))}"
        >
          <div class="panel-header">
            <div>
              <div class="panel-label">${escapeHtml(`${getBiofactorTypeLabel(content)}${content.subcategory ? ` // ${content.subcategory}` : ""}`)}</div>
              <div class="panel-title">${escapeHtml(content.name)}／${escapeHtml(content.englishName)}</div>
            </div>
            <span class="status-pill">${getBiofactorTypeLabel(content)}</span>
          </div>
          <p>${escapeHtml(content.description)}</p>
          <div class="biofactor-catalog-effects">
            ${renderBiofactorEffectSummary(content)}
            ${renderBiofactorAbilityDetails(content)}
            ${requirements ? `<span class="factor-requirement">要求：${escapeHtml(requirements)}</span>` : ""}
          </div>
          <div class="catalog-meta">${renderBiofactorCatalogMeta(content)}</div>
        </article>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">BIOFACTOR ARCHIVE // 已解锁构筑资料</div>
        <h1>生物因子档案</h1>
      </div>
      <span class="status-pill">${contents.length} 项已解锁</span>
    </div>
    <article class="panel biofactor-catalog-browser">
      <div class="factor-browser">
        <label class="terminal-field factor-search-field">
          <span>搜索生物因子</span>
          <input
            class="terminal-input"
            type="search"
            value="${escapeHtml(biofactorCatalogSearchQuery)}"
            placeholder="名称、类别、异能或效果……"
            data-factor-search
          >
        </label>
        <div class="factor-filter-row" role="group" aria-label="档案类型筛选">
          ${[
            ["ALL", "全部"],
            ["RACE", "种族"],
            ["JOB", "职业"],
            ["EQUIPMENT", "装备"],
            ["MODIFICATION", "改造"],
          ]
            .map(
              ([id, label]) =>
                `<button class="filter-button ${biofactorCatalogTypeFilter === id ? "is-active" : ""}" type="button" data-factor-type-filter="${id}">${label}</button>`,
            )
            .join("")}
        </div>
        <div class="factor-filter-row effect-filters" role="group" aria-label="档案效果筛选">
          ${[
            ["ALL", "全部效果"],
            ["POWER", "力量"],
            ["DEFENSE", "防御"],
            ["HP", "生命"],
            ["ABILITY", "异能"],
            ["FIELD", "字段"],
            ["LEGENDARY", "传奇"],
          ]
            .map(
              ([id, label]) =>
                `<button class="filter-button ${biofactorCatalogEffectFilter === id ? "is-active" : ""}" type="button" data-factor-effect-filter="${id}">${label}</button>`,
            )
            .join("")}
        </div>
        <div class="factor-filter-status" data-factor-filter-result role="status"></div>
      </div>
    </article>
    <section class="catalog-grid biofactor-catalog-grid">
      ${cards}
      <div class="empty-state large factor-filter-empty" data-factor-filter-empty hidden>没有符合当前搜索与筛选条件的生物因子。</div>
    </section>
  `;
  applyBiofactorFilters(root);
}

function renderCatalogCard(
  item,
  meta = [],
  statusLabel = "已解锁",
  isLocked = false,
  actions = "",
) {
  return `
    <article class="catalog-card ${isLocked ? "is-locked" : ""}">
      <div class="panel-header">
        <div>
          <div class="panel-label">${escapeHtml(item.category ?? item.timing ?? "奥秘档案")}</div>
          <div class="panel-title">${item.name}／${item.englishName}</div>
        </div>
        <span class="status-pill ${isLocked ? "warning" : ""}">${statusLabel}</span>
      </div>
      <p>${item.effect}</p>
      <div class="catalog-meta">
        ${meta
          .filter(Boolean)
          .map(
            ([label, value]) =>
              `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`,
          )
          .join("")}
      </div>
      ${actions}
    </article>
  `;
}

function renderArcanaScreens(state, force = false) {
  const artifactsRoot = document.querySelector("#artifacts-content");
  const enchantmentsRoot = document.querySelector("#enchantments-content");
  const spellsRoot = document.querySelector("#spells-content");
  if (!artifactsRoot || !enchantmentsRoot || !spellsRoot) return;
  const signature = JSON.stringify({
    originId: state.base.originId,
    testMode: isTestMode(state),
    artifacts: state.artifacts,
    metathranRecipeUnlocked: state.flags.metathranRecipeUnlocked,
    manaFacilities: state.manaFacilities,
    manaVaultLevel: state.base.manaVaultLevel,
    prismaticLens: state.prismaticLens,
    productionQueue: state.productionQueue,
    anchorLocation: state.base.anchorLocation,
    rewardInstances: state.rewardProgress.instances,
  });
  if (!force && signature === arcanaStateSignature) return;
  arcanaStateSignature = signature;

  const artifacts = getUnlockedArtifacts(state);
  const enchantments = ENCHANTMENT_CATALOG.filter((item) =>
    isArcanaUnlocked(item, state),
  );
  const spells = SPELL_CATALOG.filter((item) =>
    isArcanaUnlocked(item, state),
  );
  const testing = isTestMode(state);
  const facilityJob = state.productionQueue.find(
    (item) => item.type === "MANA_FACILITY",
  );
  const artifactCards = artifacts
    .map((item) => {
      const facilityCount =
        item.id === "ARTIFACT_METATHRAN_DYNAMO"
          ? state.manaFacilities.filter(
              (facility) => facility.type === METATHRAN_FACILITY_TYPE,
            ).length
          : null;
      const stateLabel =
        item.id === "ARTIFACT_MANA_VAULT"
          ? `Lv.${state.base.manaVaultLevel ?? 0}`
          : item.id === "ARTIFACT_METATHRAN_DYNAMO"
            ? `配方已解锁 · ${facilityCount}座`
            : item.id === PRISMATIC_LENS_ID
              ? state.prismaticLens.enabled
                ? "运行中"
                : "已关闭"
              : item.id === THRAN_DYNAMO_ID
                ? "自动运行"
                : item.id === SPACE_ANCHOR_ID
                  ? state.base.anchorLocation?.status === "ANCHORED"
                    ? `现实降临：${state.base.anchorLocation.territoryName}`
                    : state.base.anchorLocation?.status === "RETURNED"
                      ? "已返回亚空间"
                      : "可使用"
                : "就绪";
      let buildControl =
        item.id === "ARTIFACT_METATHRAN_DYNAMO"
          ? facilityJob
            ? `<div class="metric production-job artifact-build-control" data-production-job="${facilityJob.id}" data-completes-at="${facilityJob.completesAt}" data-started-at="${facilityJob.startedAt}">
                <div class="metric-row"><span>新设施建造中</span><strong data-job-countdown>${formatClock(facilityJob.completesAt - Date.now())}</strong></div>
                <div class="progress"><span data-job-progress></span></div>
                <button class="terminal-button secondary full-button" data-cancel-production="${facilityJob.id}">${testing ? "取消建造" : "取消并退还1500[C]"}</button>
              </div>`
            : `<button class="terminal-button full-button artifact-build-control" data-build-metathran ${
                state.productionQueue.length >= state.base.productionQueueCap
                  ? "disabled"
                  : ""
              }>建造仿索蓝发电机 · ${testing ? "免费" : "1500[C]"} · ${testing ? "00:02" : "03:00"}</button>`
          : "";
      if (item.id === SPACE_ANCHOR_ID) {
        const location = state.base.anchorLocation;
        const targets = getSpaceAnchorTargets(state);
        const instance = state.rewardProgress.instances.find(
          (entry) =>
            entry.contentId === SPACE_ANCHOR_ID &&
            entry.location === "INVENTORY",
        );
        if (location?.status === "ANCHORED") {
          const output = summarizeLandIds(location.lands)
            .map((land) => `${land.count}[${land.color}]`)
            .join(" + ");
          buildControl = `
            <div class="intel-block"><strong>现实维度持续产出</strong><span>${escapeHtml(output)} / 120秒；基地位于${escapeHtml(location.territoryName)}，法术力起源继续运行。</span></div>
            <button class="terminal-button danger full-button" data-return-space-anchor>永久返回亚空间</button>
          `;
        } else if (location?.status === "RETURNED") {
          buildControl = `<p class="empty-state">空间锚点已经消耗，基地已不可逆地返回亚空间。</p>`;
        } else if (instance && targets.length) {
          buildControl = `
            <label class="terminal-field">
              <span>现实维度降临目标</span>
              <select class="terminal-select" data-space-anchor-target>
                ${targets.map((target) => {
                  const output = target.landSummary
                    .map((land) => `${land.count}[${land.color}]`)
                    .join(" + ");
                  return `<option value="${target.territoryId}">${escapeHtml(target.name)} · ${escapeHtml(output)} / 120秒</option>`;
                }).join("")}
              </select>
            </label>
            <button class="terminal-button full-button" data-activate-space-anchor>消耗空间锚点并降临现实维度</button>
          `;
        } else {
          buildControl = `<p class="empty-state">完全通关一个世界后，才能选择其中的已征服领土。</p>`;
        }
      }
      return renderCatalogCard(
        item,
        [
          ["分类", item.category],
          ["状态", stateLabel],
        ],
        "已解锁",
        false,
        buildControl,
      );
    })
    .join("");

  artifactsRoot.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">ARTIFACT ARCHIVE // 永久记录</div>
        <h1>已解锁神器</h1>
      </div>
      <span class="status-pill">${artifacts.length} 项</span>
    </div>
    <section class="catalog-grid">${artifactCards}</section>
  `;
  enchantmentsRoot.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">ENCHANTMENT ARCHIVE // 持续法术</div>
        <h1>结界档案</h1>
      </div>
      <span class="status-pill">${enchantments.length} 项已解锁</span>
    </div>
    <section class="catalog-grid">
      ${enchantments.map((item) =>
        renderCatalogCard(item, [
          ["施放成本", item.cost],
          ["生效时点", item.timing],
          ["当前接入", item.implementation],
        ]),
      ).join("")}
    </section>
  `;
  spellsRoot.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">SPELL ARCHIVE // 瞬时术式</div>
        <h1>法术档案</h1>
      </div>
      <span class="status-pill">${spells.length} 项已解锁</span>
    </div>
    <section class="catalog-grid">
      ${spells.map((item) =>
        renderCatalogCard(item, [
          ["施放成本", item.cost],
          ["施放时点", item.timing],
          ["当前接入", item.implementation],
        ]),
      ).join("")}
    </section>
  `;
}

function updateProductionTimers(state) {
  const cycleMs = getResourceCycleMs(state);
  const colorCycleMs = getResourceCycleMs(state, "COLOR");
  document.querySelectorAll("[data-production-job]").forEach((element) => {
    const completesAt = Number(element.dataset.completesAt);
    const startedAt = Number(element.dataset.startedAt);
    const duration = Math.max(1, completesAt - startedAt);
    const remaining = Math.max(0, completesAt - Date.now());
    element.querySelector("[data-job-countdown]").textContent =
      formatClock(remaining);
    element.querySelector("[data-job-progress]").style.width =
      `${Math.min(100, ((duration - remaining) / duration) * 100)}%`;
  });
  const hasThran = hasArtifact(state, THRAN_DYNAMO_ID);
  const sourceId = hasThran ? "THRAN_DYNAMO" : "RESIDUE";
  const sourceCycle = state.clock.productionCycles?.[sourceId] ?? 0;
  const sourcePaused =
    state.resources.amounts.C >= state.resources.caps.C;
  setAllText(
    "[data-base-source-countdown]",
    sourcePaused ? "已达上限" : formatClock(cycleMs - sourceCycle),
  );
  document.querySelectorAll("[data-base-source-progress]").forEach((bar) => {
    bar.style.width = `${sourcePaused ? 0 : (sourceCycle / cycleMs) * 100}%`;
  });

  document.querySelectorAll("[data-facility-cycle]").forEach((element) => {
    const facilityId = element.dataset.facilityCycle;
    const facility = state.manaFacilities.find(
      (item) => item.id === facilityId,
    );
    if (!facility) return;
    const cycle = state.clock.productionCycles?.[facilityId] ?? 0;
    const disabled = facility.enabled === false;
    const capped = state.resources.amounts.C >= state.resources.caps.C;
    const countdown = element.querySelector("[data-facility-countdown]");
    const progress = element.querySelector("[data-facility-progress]");
    if (countdown) {
      countdown.textContent = disabled
        ? "已关闭"
        : capped
          ? "已达上限"
          : formatClock(cycleMs - cycle);
    }
    if (progress) {
      progress.style.width = `${disabled || capped ? 0 : (cycle / cycleMs) * 100}%`;
    }
  });

  const prismCycle =
    state.clock.productionCycles?.PRISMATIC_LENS ?? 0;
  const prismColor = state.prismaticLens?.selectedColor ?? "W";
  const prismPaused =
    !state.prismaticLens?.enabled ||
    state.resources.amounts[prismColor] >= state.resources.caps[prismColor] ||
    (!isTestMode(state) && state.resources.amounts.C < 400);
  setAllText(
    "[data-prismatic-countdown]",
    prismPaused ? "已暂停" : formatClock(colorCycleMs - prismCycle),
  );
  document.querySelectorAll("[data-prismatic-progress]").forEach((bar) => {
    bar.style.width = `${prismPaused ? 0 : (prismCycle / colorCycleMs) * 100}%`;
  });
}

const MANA_COLOR_VARIABLES = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  C: "var(--mana-c)",
};

function getSelectedResident(state) {
  const availableResidents = getAvailableResidents(state);
  return (
    availableResidents.find(
      (resident) =>
        resident.id === state.residentProgress?.selectedResidentId,
    ) ?? availableResidents[0]
  );
}

const RESIDENT_PORTRAITS = Object.freeze({
  RESIDENT_LILITH: {
    url: lilithPortraitUrl,
    tone: "lilith",
    alt: "Lilith的亚空间能量体版画：兜帽中的星空与光环构成无面轮廓",
    signal: "SUBSPACE ENTITY // STATIC RESONANCE",
  },
  RESIDENT_OLIVIA_VOLDAREN: {
    url: oliviaPortraitUrl,
    tone: "olivia",
    alt: "奥莉薇娅·沃达连的红色版画肖像：手持酒杯的吸血鬼贵族",
    signal: "VAMPIRE NOBILITY // VOLDAREN",
  },
});

function renderBaseStatusVector(state) {
  const status = getBaseStatusView(state);
  const resident = getSelectedResident(state);
  const haloOpacity = (0.12 + status.manaSaturation * 0.7).toFixed(2);
  const haloWidth = (1.5 + status.manaSaturation * 4).toFixed(2);
  const manaPercent = Math.round(status.manaSaturation * 100);
  const modeClass = `is-${status.linkMode}`;
  const productionClass = status.productionActive
    ? "is-producing"
    : "is-idle";
  const manaColor =
    MANA_COLOR_VARIABLES[status.dominantManaColor] ??
    MANA_COLOR_VARIABLES.C;
  const originColor =
    MANA_COLOR_VARIABLES[status.originColor] ?? MANA_COLOR_VARIABLES.C;
  const landColor =
    MANA_COLOR_VARIABLES[status.landColor] ?? MANA_COLOR_VARIABLES.C;
  const accessibleLabel = [
    `空间内法术力${status.manaStatus}，最高负载${manaPercent}%`,
    status.productionLabel,
    status.expeditionLabel,
  ].join("；");

  return `
    <div
      class="base-vector-card ${modeClass} ${productionClass}"
      style="--base-mana-color:${manaColor};--base-origin-color:${originColor};--base-land-color:${landColor};--base-halo-opacity:${haloOpacity};--base-halo-width:${haloWidth}px"
    >
      <svg class="base-vector-svg" viewBox="0 0 260 154" role="img" aria-label="${escapeHtml(accessibleLabel)}">
        <g class="base-grid-lines" aria-hidden="true">
          <path d="M18 30H242M18 77H242M18 124H242"></path>
          <path d="M45 14V140M130 14V140M215 14V140"></path>
        </g>
        <circle class="base-mana-halo halo-outer" cx="130" cy="76" r="53"></circle>
        <circle class="base-mana-halo halo-inner" cx="130" cy="76" r="45"></circle>
        <g class="base-orbital-ring" aria-hidden="true">
          <circle cx="130" cy="76" r="39"></circle>
          <path class="base-origin-arc" d="M103 48 A39 39 0 0 1 157 48"></path>
          <path class="base-land-arc" d="M157 104 A39 39 0 0 1 103 104"></path>
        </g>
        <g class="base-anchor-core" aria-hidden="true">
          <path class="base-core-shell" d="M130 44L158 60V92L130 108L102 92V60Z"></path>
          <path class="base-core-inner" d="M130 55L147 65V87L130 97L113 87V65Z"></path>
          <circle class="base-core-point" cx="130" cy="76" r="7"></circle>
          <path class="base-core-cross" d="M130 28V44M130 108V124M82 76H102M158 76H178"></path>
        </g>
        <g class="base-production-node" aria-hidden="true">
          <path class="base-flow-line" d="M38 112C66 112 73 99 102 88"></path>
          <rect x="25" y="102" width="25" height="20" rx="2"></rect>
          <path d="M30 112H45M37.5 106V118"></path>
        </g>
        <g class="base-expedition-link" aria-hidden="true">
          <path class="base-link-beam" d="M158 76H218"></path>
          <ellipse class="base-portal-outer" cx="226" cy="76" rx="11" ry="27"></ellipse>
          <ellipse class="base-portal-inner" cx="226" cy="76" rx="5" ry="19"></ellipse>
        </g>
        <g class="base-anchor-node" aria-hidden="true">
          <path d="M130 108V135"></path>
          <path d="M119 135H141L136 143H124Z"></path>
        </g>
        <text class="base-vector-label" x="20" y="19">SPACE STATUS</text>
        <text class="base-vector-code" x="238" y="143" text-anchor="end">${escapeHtml(resident.signalLabel ?? `${resident.name.toUpperCase()} / ONLINE`)}</text>
      </svg>
      <div class="base-vector-readouts">
        <div><span>法术力</span><strong>${status.manaStatus} · ${manaPercent}%</strong></div>
        <div><span>生产</span><strong>${status.productionLabel}</strong></div>
        <div><span>远征</span><strong>${status.expeditionLabel}</strong></div>
      </div>
    </div>
  `;
}

function renderResidentCard(state) {
  const availableResidents = getAvailableResidents(state);
  const resident = getSelectedResident(state);
  const line = getResidentCurrentLine(state, resident.id);
  const progress = state.residentProgress;
  const hasSpoken = resident.dialogue.some((dialogue) =>
    progress?.seenDialogueIds?.includes(dialogue.id),
  );
  const portrait = RESIDENT_PORTRAITS[resident.id] ?? null;
  return `
    <article class="resident-card ${resident.id.includes("OLIVIA") ? "is-olivia" : "is-lilith"}">
      <label class="resident-selector">
        <span>通讯对象</span>
        <select class="terminal-select" data-resident-select>
          ${availableResidents
            .map(
              (candidate) =>
                `<option value="${candidate.id}" ${candidate.id === resident.id ? "selected" : ""}>${escapeHtml(candidate.shortName ?? candidate.name)}</option>`,
            )
            .join("")}
        </select>
      </label>
      ${
        portrait
          ? `<figure class="resident-engraving is-${portrait.tone}">
              <img src="${portrait.url}" alt="${portrait.alt}" decoding="async">
              <figcaption>${portrait.signal}</figcaption>
            </figure>`
          : ""
      }
      <div class="resident-heading">
        <div class="resident-sigil" aria-hidden="true">
          <span></span>
          <i></i>
        </div>
        <div>
          <div class="resident-name">${escapeHtml(resident.name)}</div>
          <div class="resident-meta">${escapeHtml(resident.type)} // ${escapeHtml(resident.disposition)}</div>
        </div>
        <span class="resident-presence">${hasSpoken ? "已响应" : "已觉醒"}</span>
      </div>
      <p class="resident-line">“${escapeHtml(line)}”</p>
      <button
        class="terminal-button secondary full-button resident-talk-button"
        type="button"
        data-talk-resident="${resident.id}"
      >与 ${escapeHtml(resident.shortName ?? resident.name)} 交谈</button>
    </article>
  `;
}

function renderBaseContext(state) {
  const status = getBaseStatusView(state);
  const progress = state.residentProgress;
  const signature = JSON.stringify({
    mana: status.manaLoads.map((item) => [item.color, item.amount, item.cap]),
    productionCount: status.productionCount,
    expeditionPhase: state.activeExpedition?.phase ?? null,
    expeditionCommand: state.activeExpedition?.command ?? null,
    blueprintCount: state.blueprints.length,
    firstVillageConquered: state.flags.firstVillageConquered,
    gavonyFirstConquered: state.flags.gavonyFirstConquered,
    lastDialogueId: progress?.lastDialogueId ?? null,
    interactionCount: progress?.interactionCount ?? 0,
    selectedResidentId: progress?.selectedResidentId ?? null,
    availableResidentIds: getAvailableResidents(state).map(
      (item) => item.id,
    ),
  });
  if (signature === baseContextSignature) return;
  baseContextSignature = signature;
  const vectorMarkup = renderBaseStatusVector(state);
  const residentMarkup = renderResidentCard(state);
  document.querySelectorAll("[data-base-vector-panel]").forEach((panel) => {
    panel.innerHTML = vectorMarkup;
  });
  document.querySelectorAll("[data-resident-panel]").forEach((panel) => {
    panel.innerHTML = residentMarkup;
  });
}

function renderBaseRuntime(state) {
  const facilityPanel = document.querySelector("[data-facility-panel]");
  const slottedFacilitiesPanel = document.querySelector(
    "[data-slotted-facilities-panel]",
  );
  const artifactPanel = document.querySelector("[data-artifact-panel]");
  const productionRail = document.querySelector("[data-production-rail]");
  if (
    !facilityPanel ||
    !slottedFacilitiesPanel ||
    !artifactPanel ||
    !productionRail
  ) {
    return;
  }
  const signature = JSON.stringify({
    testMode: isTestMode(state),
    artifacts: state.artifacts,
    facilities: state.manaFacilities,
    slotAssignments: state.manaProductionSlotAssignments,
    prismaticLens: state.prismaticLens,
    productionQueue: state.productionQueue.map((job) => ({
      id: job.id,
      type: job.type,
      targetLevel: job.targetLevel,
      startedAt: job.startedAt,
      completesAt: job.completesAt,
    })),
    manaProductionSlots: state.base.manaProductionSlots,
    manaVaultLevel: state.base.manaVaultLevel ?? 0,
    metathranRecipeUnlocked: state.flags.metathranRecipeUnlocked,
    manaVaultExpansionUnlocked: state.flags.manaVaultExpansionUnlocked,
  });
  if (signature === baseRuntimeSignature) return;
  baseRuntimeSignature = signature;

  const cycleMs = getResourceCycleMs(state);
  const colorCycleMs = getResourceCycleMs(state, "COLOR");
  const testing = isTestMode(state);
  const cycleLabel = testing ? "2秒" : "分钟";
  const hasThran = hasArtifact(state, THRAN_DYNAMO_ID);
  const facilities = (state.manaFacilities ?? []).filter(
    (item) => item.type === METATHRAN_FACILITY_TYPE,
  );
  const lensAvailable = hasArtifact(state, PRISMATIC_LENS_ID);
  const activeSlots = getActiveManaProductionSlots(state);
  const slotAssignments = getManaProductionSlotAssignments(state);
  const vaultLevel = state.base.manaVaultLevel ?? 0;
  const nextVaultLevel = MANA_VAULT_LEVELS[vaultLevel + 1] ?? null;
  const vaultJob = state.productionQueue.find(
    (item) => item.type === "MANA_VAULT_UPGRADE",
  );
  const sourceId = hasThran ? "THRAN_DYNAMO" : "RESIDUE";
  const sourceProgress =
    (state.clock.productionCycles?.[sourceId] ?? 0) / cycleMs;
  const sourceRemaining =
    state.resources.amounts.C >= state.resources.caps.C
      ? null
      : cycleMs - (state.clock.productionCycles?.[sourceId] ?? 0);
  const sourceName = hasThran
    ? "索蓝发电机／Thran Dynamo"
    : "亚空间残渣回收";
  const sourceYield = hasThran ? THRAN_YIELD_PER_MINUTE : 25;

  facilityPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-label">MANA FACILITY // 法术力设施</div>
        <div class="panel-title">${sourceName}</div>
      </div>
      <span class="status-pill">自动运行</span>
    </div>
    <div class="artifact-display">
      <div class="artifact-core"><span>+${sourceYield}[C]</span></div>
      <div>
        <div class="metric">
          <div class="metric-row"><span>下一次收集</span><strong data-base-source-countdown>${formatClock(sourceRemaining)}</strong></div>
          <div class="progress"><span data-base-source-progress style="width:${sourceProgress * 100}%"></span></div>
        </div>
        <div class="mini-stat"><span>产量</span><strong>${sourceYield} [C] / ${cycleLabel}</strong></div>
        <div class="mini-stat"><span>生产位占用</span><strong>${activeSlots} / ${state.base.manaProductionSlots}</strong></div>
        <div class="mini-stat"><span>${hasThran ? "永久设施" : "终止条件"}</span><strong>${hasThran ? "不占生产位" : "获得索蓝发电机"}</strong></div>
      </div>
    </div>
  `;

  const metathranActiveCount = facilities.filter(
    (facility) => facility.enabled !== false,
  ).length;
  const lensActiveCount =
    lensAvailable && state.prismaticLens.enabled ? 1 : 0;
  const facilityOptions = [
    ...(facilities.length
      ? [
          {
            id: MANA_FACILITY_GROUP_METATHRAN,
            name: "仿索蓝发电机",
            count: `${metathranActiveCount}/${facilities.length}`,
          },
        ]
      : []),
    ...(lensAvailable
      ? [
          {
            id: PRISMATIC_LENS_ID,
            name: "虹彩透镜",
            count: `${lensActiveCount}/1`,
          },
        ]
      : []),
  ];
  const slotCards = slotAssignments
    .map((assignedId, slotIndex) => {
      const facility = facilities.find((item) => item.id === assignedId);
      const isPrismatic = assignedId === PRISMATIC_LENS_ID;
      const selectedGroupId = facility
        ? MANA_FACILITY_GROUP_METATHRAN
        : isPrismatic
          ? PRISMATIC_LENS_ID
          : null;
      const cycleId = isPrismatic ? "PRISMATIC_LENS" : assignedId;
      const cycle = cycleId
        ? state.clock.productionCycles?.[cycleId] ?? 0
        : 0;
      const capped = facility
        ? state.resources.amounts.C >= state.resources.caps.C
        : false;
      const detail = facility
        ? `
          <div class="metric" data-facility-cycle="${facility.id}">
            <div class="metric-row"><span>下一次产出 · +${METATHRAN_YIELD_PER_MINUTE}[C]</span><strong data-facility-countdown>${capped ? "已达上限" : formatClock(cycleMs - cycle)}</strong></div>
            <div class="progress"><span data-facility-progress style="width:${capped ? 0 : (cycle / cycleMs) * 100}%"></span></div>
          </div>`
        : isPrismatic
          ? `
            <label class="terminal-field compact-field">
              <span>转换目标 · ${testing ? "每2秒免费获得1点" : "每120秒消耗400[C]获得1点"}</span>
              ${renderManaSelect(["W", "U", "B", "R", "G"], state.prismaticLens.selectedColor, "data-prismatic-color")}
            </label>
            <div class="metric">
              <div class="metric-row"><span>转换周期</span><strong data-prismatic-countdown>${formatClock(colorCycleMs - cycle)}</strong></div>
              <div class="progress"><span data-prismatic-progress style="width:${(cycle / colorCycleMs) * 100}%"></span></div>
            </div>`
          : `<div class="empty-state mana-slot-empty">此生产位当前不运行设施。</div>`;
      return `
        <article class="mana-slot-card ${assignedId ? "is-active" : "is-empty"}">
          <div class="facility-card-header">
            <div>
              <div class="panel-label">PRODUCTION SLOT ${String(slotIndex + 1).padStart(2, "0")}</div>
              <strong>生产位 ${slotIndex + 1}</strong>
            </div>
            <span class="status-pill ${assignedId ? "" : "warning"}">${assignedId ? "运行中" : "空置"}</span>
          </div>
          <label class="terminal-field compact-field">
            <span>启用设施</span>
            <div class="facility-group-select">
              <select class="terminal-select" data-mana-production-slot="${slotIndex}">
                <option value="" ${assignedId ? "" : "selected"}>不运行</option>
                ${facilityOptions
                  .map(
                    (option) =>
                      `<option value="${option.id}" ${selectedGroupId === option.id ? "selected" : ""}>${selectedGroupId === option.id ? option.name : `${option.name}　　${option.count}`}</option>`,
                  )
                  .join("")}
              </select>
              ${
                selectedGroupId
                  ? `<span class="facility-group-count">${facilityOptions.find((option) => option.id === selectedGroupId)?.count ?? ""}</span>`
                  : ""
              }
            </div>
          </label>
          ${detail}
        </article>
      `;
    })
    .join("");
  slottedFacilitiesPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-label">SLOTTED MANA FACILITIES // 占用生产位的法术力设施</div>
        <div class="panel-title">设施控制台</div>
      </div>
      <span class="status-pill ${activeSlots >= state.base.manaProductionSlots ? "warning" : ""}">${activeSlots} / ${state.base.manaProductionSlots} 运行中</span>
    </div>
    <p class="field-help">每个框体代表1个固定生产位。可直接选择已拥有的设施，或选择“不运行”主动空置。</p>
    <div class="facility-inventory">
      <div class="mini-stat"><span>仿索蓝发电机</span><strong>${metathranActiveCount} / ${facilities.length}</strong></div>
      ${
        lensAvailable
          ? `<div class="mini-stat"><span>虹彩透镜</span><strong>${lensActiveCount} / 1</strong></div>`
          : ""
      }
    </div>
    <div class="mana-slot-grid" style="--mana-slot-columns:${Math.min(state.base.manaProductionSlots, 4)}">${slotCards}</div>
  `;

  artifactPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-label">RECENT UNLOCKS // 近期解锁</div>
        <div class="panel-title">神器一览</div>
      </div>
      <button class="micro-button" data-route="artifacts">查看全部</button>
    </div>
    ${
      state.flags.metathranRecipeUnlocked || isTestMode(state)
        ? `<div class="mini-stat"><span>法术力设施候选</span><strong>仿索蓝发电机配方已解锁</strong></div>`
        : ""
    }
    ${state.artifacts
      .slice(-3)
      .reverse()
      .map(
        (id) =>
          `<div class="mini-stat"><span>${ARTIFACT_NAMES[id] ?? "未知神器"}</span><strong>${
            id === THRAN_DYNAMO_ID
              ? `+200[C]/${cycleLabel}`
              : id === "ARTIFACT_MANA_VAULT"
                ? `Lv.${vaultLevel}`
                : "就绪"
          }</strong></div>`,
      )
      .join("")}
    ${
      vaultJob
        ? `<div class="metric production-job" data-production-job="${vaultJob.id}" data-completes-at="${vaultJob.completesAt}" data-started-at="${vaultJob.startedAt}">
            <div class="metric-row"><span>法术力库扩容至Lv.${vaultJob.targetLevel}</span><strong data-job-countdown>${formatClock(vaultJob.completesAt - Date.now())}</strong></div>
            <div class="progress"><span data-job-progress></span></div>
            <button class="terminal-button secondary full-button" data-cancel-production="${vaultJob.id}">取消并退还${vaultJob.cost.C}[C]</button>
          </div>`
        : nextVaultLevel &&
            (state.flags.manaVaultExpansionUnlocked || isTestMode(state))
          ? `<button class="terminal-button full-button" data-upgrade-mana-vault ${
              state.productionQueue.length >= state.base.productionQueueCap
                ? "disabled"
                : ""
            }>扩容至Lv.${nextVaultLevel.level} · ${testing ? "免费" : `${nextVaultLevel.upgradeCost.C}[C]`} · ${formatClock(testing ? 2000 : nextVaultLevel.upgradeMs)}</button>`
          : !nextVaultLevel
            ? `<p class="field-help">法术力库已达到当前最高等级。</p>`
            : ""
    }
  `;

  const queueItems = state.productionQueue.length
    ? state.productionQueue
        .map(
          (job) => `
            <div class="queue-item production-job" data-production-job="${job.id}" data-completes-at="${job.completesAt}" data-started-at="${job.startedAt}">
              <div class="queue-title"><span>${
                job.type === "LEGION"
                  ? "镜映品"
                  : job.type === "MANA_VAULT_UPGRADE"
                    ? "法术力库扩容"
                    : "仿索蓝发电机"
              }</span><span data-job-countdown>${formatClock(job.completesAt - Date.now())}</span></div>
              <div class="progress"><span data-job-progress></span></div>
            </div>`,
        )
        .join("")
    : `<p class="empty-state">没有建造项目</p>`;
  productionRail.innerHTML = `
    <div class="section-kicker">生产队列</div>
    ${queueItems}
    <div class="mini-stat"><span>法术力设施</span><strong>${activeSlots} / ${state.base.manaProductionSlots}</strong></div>
  `;
}

function commandName(command) {
  return {
    RECON: "侦查",
    CONQUEST: "征服",
    INFILTRATION: "渗透",
  }[command] ?? "未知指令";
}

function phaseName(phase) {
  return {
    TRAVELING: "移动中",
    PATROL_COMBAT: "巡逻战斗",
    SCOUTING: "侦查中",
    GARRISON_COMBAT: "守军战斗",
    INFILTRATING: "渗透中",
    EXECUTION_WARNING: "处决警告",
  }[phase] ?? "状态未知";
}

function outcomeName(outcome) {
  return {
    SUCCESS: "胜利",
    FAILURE: "失败",
    RETURNED: "完成并返回",
    RECALLED: "反召唤返回",
  }[outcome] ?? "已结束";
}

function unlockedContentName(id) {
  return getContentDisplayName(id);
}

function renderRewardItems(rewards = {}) {
  const entries = ["W", "U", "B", "R", "G", "C"]
    .filter((color) => (rewards[color] ?? 0) > 0)
    .map(
      (color) =>
        `<div class="reward-chip"><strong>+${rewards[color]}[${color}]</strong><span>法术力</span></div>`,
    );
  return entries.length
    ? entries.join("")
    : `<p class="empty-state">本次没有获得法术力奖励。</p>`;
}

function renderExpeditionResultSummary(last) {
  const result = last?.result ?? {};
  const unlocks = [
    ...(result.unlockedBiofactors ?? []),
    ...(result.unlockedArtifacts ?? []),
    ...(result.unlockedContent ?? []),
  ];
  return `
    <div class="result-metrics">
      <div><span>战斗伤害</span><strong>${result.damageDealt ?? 0}</strong></div>
      <div><span>消灭巡逻队</span><strong>${result.patrolsDefeated ?? 0}</strong></div>
      <div><span>消灭守军</span><strong>${result.guardsDefeated ?? 0}</strong></div>
      <div><span>坚守值削减</span><strong>${result.fortitudeDamage ?? 0}</strong></div>
      <div><span>稳定值削减</span><strong>${result.stabilityDamage ?? 0}</strong></div>
    </div>
    <div class="panel-label result-heading">REWARDS // 实际入库</div>
    <div class="reward-grid">${renderRewardItems(result.rewards)}</div>
    ${
      (result.destructionMarksAdded ?? 0) > 0
        ? `<div class="validation-warning">破坏之乐：基础坚守伤害${result.mayhemBaseDamage ?? 0}，翻倍后${result.mayhemFinalDamage ?? 0}；目标新增${result.destructionMarksAdded}个永久破坏标记。</div>`
        : ""
    }
    ${
      unlocks.length
        ? `<div class="panel-label result-heading">UNLOCKED // 新解锁</div>
           <div class="unlock-list">${unlocks.map((id) => `<span>◇ ${escapeHtml(unlockedContentName(id))}</span>`).join("")}</div>`
        : ""
    }
  `;
}

function renderBattleReviewDialog(state) {
  const dialog = document.querySelector("#battle-review-dialog");
  const root = dialog?.querySelector("[data-battle-review-content]");
  const review = state.battleReview;
  if (!dialog || !root) return;
  if (!review) {
    if (dialog.open) dialog.close();
    return;
  }
  const combat = review.combat;
  const enemyAbilities = combat.defender.abilities?.length
    ? combat.defender.abilities
        .map((id) => getAbilityDisplayName(id))
        .join("／")
    : "无";
  root.innerHTML = `
    <div class="dialog-header">
      <div>
        <div class="eyebrow">BATTLE REVIEW // 战斗已暂停</div>
        <h2>${review.kind === "PATROL" ? "巡逻战结束" : "守军战结束"}</h2>
      </div>
      <span class="status-pill">${combat.winner === "ATTACKER" ? "己方胜利" : combat.winner === "BOTH_DEAD" ? "同归于尽" : "己方失败"}</span>
    </div>
    <div class="combatants review-combatants">
      <div class="combatant">
        <div class="panel-label">PLAYER LEGION</div>
        <p>${escapeHtml(combat.attacker.name)}</p>
        <div class="mini-stat"><span>配置力量 / 防御 / 生命</span><strong>${combat.attacker.basePower} / ${combat.attacker.maxDefense} / ${combat.attacker.maxHp}</strong></div>
        <div class="mini-stat"><span>最终力量 / 防御 / 生命</span><strong>${combat.attacker.currentPower} / ${combat.attacker.currentDefense} / ${combat.attacker.currentHp}</strong></div>
      </div>
      <div class="versus">FINAL</div>
      <div class="combatant enemy">
        <div class="panel-label">ENEMY CONFIGURATION</div>
        <p>${escapeHtml(combat.defender.name)}</p>
        <div class="mini-stat"><span>配置力量 / 防御 / 生命</span><strong>${combat.defender.basePower} / ${combat.defender.maxDefense} / ${combat.defender.maxHp}</strong></div>
        <div class="mini-stat"><span>最终力量 / 防御 / 生命</span><strong>${combat.defender.currentPower} / ${combat.defender.currentDefense} / ${combat.defender.currentHp}</strong></div>
        <div class="mini-stat"><span>颜色</span><strong>${combat.defender.colors.map((color) => `[${color}]`).join("")}</strong></div>
        <div class="mini-stat"><span>异能</span><strong>${escapeHtml(enemyAbilities)}</strong></div>
      </div>
    </div>
    <div class="combat-log review-log" aria-label="本场逐回合战报">
      ${combat.rounds.map((round) => `
        <p>
          <span class="round">[ROUND ${String(round.round).padStart(2, "0")}]</span>
          己方造成${round.attackOnDefender.hpDamage}生命伤害、${round.attackOnDefender.defenseDamage}防御伤害；
          敌方造成${round.attackOnAttacker.hpDamage}生命伤害、${round.attackOnAttacker.defenseDamage}防御伤害。
          生命：${round.attackerHpStart}→${round.attackerHpEnd} / ${round.defenderHpStart}→${round.defenderHpEnd}
        </p>
      `).join("")}
    </div>
    <p class="dialog-copy">远征时钟已经暂停。确认战报与敌方配置后再继续。</p>
  `;
  if (!dialog.open) dialog.showModal();
}

function renderExpeditionResultDialog(state) {
  const dialog = document.querySelector("#expedition-result-dialog");
  const root = dialog?.querySelector("[data-expedition-result-content]");
  const last = state.lastExpedition;
  if (!dialog || !root) return;
  const shouldOpen =
    Boolean(last && !last.resultAcknowledged) && !state.battleReview;
  if (!shouldOpen) {
    if (dialog.open) dialog.close();
    return;
  }
  const territory = getTerritoryForState(state, last.territoryId);
  root.innerHTML = `
    <div class="dialog-header">
      <div>
        <div class="eyebrow">EXPEDITION RESULT // 数据结算</div>
        <h2>${territory?.name ?? "未知领土"} · ${outcomeName(last.outcome)}</h2>
      </div>
      <span class="status-pill">${commandName(last.command)}</span>
    </div>
    <p class="dialog-copy">${escapeHtml(last.summary)}</p>
    ${renderExpeditionResultSummary(last)}
  `;
  if (!dialog.open) dialog.showModal();
}

function getTerritoryArcaneEffect(state, territoryId) {
  const expedition = state.activeExpedition;
  if (
    expedition?.territoryId === territoryId &&
    expedition.enchantmentId
  ) {
    return {
      [VIRTUES_RUIN_ID]: {
        id: "VIRTUES_RUIN",
        label: "道德瓦解生效中",
        detail: "白色守军令渗透+2，同时使每轮暴露率提高6个百分点。",
        className: "virtues-ruin",
      },
      [TASTE_FOR_MAYHEM_ID]: {
        id: "TASTE_FOR_MAYHEM",
        label: "破坏之乐生效中",
        detail:
          "坚守伤害×2；造成实际坚守伤害后留下不可消除的永久标记，并减少该领土首次沦陷时的可损失奖励。",
        className: "taste-for-mayhem",
      },
      [GROUNDED_ID]: {
        id: "GROUNDED",
        label: "禁足生效中",
        detail: "本次远征中的所有军团暂时失去飞行异能。",
        className: "grounded",
      },
    }[expedition.enchantmentId] ?? null;
  }
  return null;
}

function renderTerritoryArcaneEffect(effect, compact = false) {
  if (!effect) return "";
  return `
    <span class="territory-arcane-effect ${effect.className} ${compact ? "is-compact" : ""}" aria-label="${effect.label}">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="arcane-orbit outer" cx="50" cy="50" r="43"></circle>
        <circle class="arcane-orbit inner" cx="50" cy="50" r="33"></circle>
        <path class="arcane-rune" d="M50 8 L61 35 L91 38 L68 57 L75 87 L50 70 L25 87 L32 57 L9 38 L39 35 Z"></path>
      </svg>
      ${compact ? "" : `<small>${effect.label}</small>`}
    </span>
  `;
}

function renderTerritoryDestructionMarks(count) {
  if (count < 1) return "";
  const label = `${count}个破坏之乐永久标记；标记不可消除，并会减少首次沦陷时的可损失奖励`;
  return `
    <span class="territory-destruction-aura" aria-label="${label}" title="${label}">
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <ellipse class="mayhem-scar-ring outer" cx="60" cy="40" rx="54" ry="31"></ellipse>
        <ellipse class="mayhem-scar-ring inner" cx="60" cy="40" rx="42" ry="23"></ellipse>
        <path class="mayhem-scar-slash first" d="M23 57 L45 17 L54 39 L76 13 L66 43 L96 27"></path>
        <path class="mayhem-scar-slash second" d="M29 29 L47 45 L58 31 L72 59 L83 39 L98 50"></path>
      </svg>
      <span class="mayhem-mark-count" aria-hidden="true">×${count}</span>
    </span>
  `;
}

function renderMapReinforcementControl(state, legion, blueprint) {
  if (!legion || !blueprint) return "";
  const prototype = state.prototypes.find(
    (item) => item.id === legion.prototypeId,
  );
  if (!prototype) return "";

  const maxScale = Math.min(
    state.base.legionScaleCap ?? 10,
    blueprint.scaleHpCap ?? 10,
  );
  const currentScale = legion.purchasedScaleHp ?? 0;
  const remainingScale = Math.max(0, maxScale - currentScale);
  const job = state.productionQueue.find(
    (item) =>
      item.type === "LEGION" &&
      (item.legionId === legion.id ||
        item.prototypeId === legion.prototypeId),
  );

  if (job) {
    return `
      <div class="map-reinforcement-control">
        <div class="panel-label">QUICK REINFORCEMENT // 快捷补充</div>
        <div class="metric production-job" data-production-job="${job.id}" data-completes-at="${job.completesAt}" data-started-at="${job.startedAt}">
          <div class="metric-row"><span>正在补充${job.replicaCount}名复制体 · +${job.purchasedScaleHp}军团生命</span><strong data-job-countdown>${formatClock(job.completesAt - Date.now())}</strong></div>
          <div class="progress"><span data-job-progress style="width:0%"></span></div>
        </div>
        <p class="field-help">补充完成前，该军团不可开启远征。</p>
      </div>
    `;
  }

  if (remainingScale < 1) {
    return `
      <div class="map-reinforcement-control">
        <div class="panel-label">QUICK REINFORCEMENT // 快捷补充</div>
        <div class="mini-stat"><span>复制体 / 已购军团生命</span><strong>${legion.replicaCount}人 / ${currentScale} / ${maxScale}</strong></div>
        <p class="field-help">该军团已经达到当前军团生命总上限。</p>
      </div>
    `;
  }

  const defaultScale = Math.min(3, remainingScale);
  const replicaCount = defaultScale * blueprint.replicasPerScaleHp;
  const cost = defaultScale * blueprint.scaleHpCost;
  const queueFull =
    state.productionQueue.length >= state.base.productionQueueCap;
  const affordable = canAffordGameCost(state, { C: cost });
  const disabledReason = queueFull
    ? "生产队列已满"
    : !affordable
      ? "无色法术力不足"
      : "";

  return `
    <div class="map-reinforcement-control">
      <div class="panel-label">QUICK REINFORCEMENT // 快捷补充</div>
      <div class="mini-stat"><span>现有复制体 / 已购军团生命</span><strong>${legion.replicaCount}人 / ${currentScale} / ${maxScale}</strong></div>
      <label for="map-reinforce-${prototype.id}">
        补充人数：<strong data-map-reinforcement-output="${prototype.id}">${replicaCount}人（+${defaultScale}军团生命）</strong>
      </label>
      <input
        id="map-reinforce-${prototype.id}"
        type="range"
        min="1"
        max="${remainingScale}"
        value="${defaultScale}"
        data-map-reinforcement-input="${prototype.id}"
        data-replicas-per-scale="${blueprint.replicasPerScaleHp}"
        data-scale-cost="${blueprint.scaleHpCost}"
        ${queueFull ? "disabled" : ""}
      >
      <button
        class="terminal-button secondary full-button"
        data-map-reinforce="${prototype.id}"
        data-map-reinforcement-cost="${cost}"
        data-map-reinforcement-queue-full="${queueFull}"
        ${disabledReason ? "disabled" : ""}
      >${disabledReason || `补充${replicaCount}人 · ${isTestMode(state) ? "测试模式免费" : `${cost}[C]`}`}</button>
      <p class="field-help">按正常费用与生产时间结算，并占用1个生产位。</p>
    </div>
  `;
}

function updateMapReinforcementAvailability(state) {
  const button = document.querySelector("[data-map-reinforce]");
  if (!button) return;
  const queueFull =
    button.dataset.mapReinforcementQueueFull === "true";
  const cost = Number(button.dataset.mapReinforcementCost);
  button.disabled =
    queueFull || !canAffordGameCost(state, { C: cost });
}

function getMapSignature(state) {
  return JSON.stringify({
    testMode: isTestMode(state),
    selectedMapNodeId,
    selectedTerritoryId,
    selectedExpeditionCommand,
    selectedLegionId,
    selectedCommanderLegendaryId,
    active: [
      state.activeExpedition?.id ?? null,
      state.activeExpedition?.phase ?? null,
      state.activeExpedition?.enchantmentId ?? null,
    ],
    firstVillage: state.flags.firstVillageConquered,
    gavonyRefresh: state.flags.gavonyRefreshAvailable,
    legionScaleCap: state.base.legionScaleCap,
    productionQueue: state.productionQueue.map((item) => [
      item.id,
      item.prototypeId,
      item.purchasedScaleHp,
      item.completesAt,
    ]),
    legions: state.legions.map((item) => [
      item.id,
      item.currentPower,
      item.currentDefense,
      item.currentHp,
      item.maxHp,
      item.replicaCount,
      item.purchasedScaleHp,
    ]),
    legendaryPrototypes: state.legendaryPrototypes.map((item) => [
      item.id,
      item.status,
      item.currentHp,
      item.currentLp,
    ]),
    territories: Object.values(state.territories).map((item) => [
      item.territoryId,
      item.currentFortitude,
      item.currentStability,
      item.routeIntelLevel,
      item.knownFortitude,
      item.knownStability,
      item.conquered,
      item.destructionMarks?.length ?? 0,
    ]),
    worldMap: state.worldMap,
    message: mapMessage,
  });
}

const MAP_NODE_TYPE_LABELS = {
  [MAP_NODE_TYPES.MULTIVERSE]: "多元宇宙",
  [MAP_NODE_TYPES.SUBSPACE]: "亚空间",
  [MAP_NODE_TYPES.UNIVERSE]: "宇宙",
  [MAP_NODE_TYPES.WORLD]: "世界",
  [MAP_NODE_TYPES.PLANET]: "星球",
  [MAP_NODE_TYPES.BASE]: "基地地点",
  [MAP_NODE_TYPES.REGION]: "区域",
};

function renderMapBreadcrumbs(nodeId) {
  return `
    <nav class="map-breadcrumbs" aria-label="地图层级">
      ${getMapPath(nodeId)
        .map(
          (node, index, path) => `
            <button
              class="map-breadcrumb ${index === path.length - 1 ? "is-current" : ""}"
              data-map-node="${node.id}"
              ${index === path.length - 1 ? 'aria-current="page"' : ""}
            >${escapeHtml(node.name)}</button>
          `,
        )
        .join('<span aria-hidden="true">›</span>')}
    </nav>
  `;
}

function getArchiveContentName(contentId) {
  if (!contentId) return null;
  return getContentDisplayName(contentId);
}

function renderArchiveReward(reward) {
  const contentName = getArchiveContentName(reward.contentId);
  const resources = Object.entries(reward.resources ?? {})
    .filter(([, value]) => value > 0)
    .map(([color, value]) => `${value}[${color}]`)
    .join(" / ");
  return `
    <div class="region-archive-reward">
      <span>${escapeHtml(contentName || resources || "已结算奖励")}</span>
      <small>${escapeHtml(reward.grade ?? "—")}类 · ${formatDateTime(reward.acquiredAt)}</small>
    </div>
  `;
}

function renderArchivedRegionScreen(root, state, node) {
  const record = state.worldMap.regionRecords?.[node.id];
  const archive = record?.archive;
  const territories = archive?.territories ?? record?.territoryIds?.map(
    (territoryId) => ({
      territoryId,
      name: getTerritory(territoryId)?.name ?? "未知领土",
      victoryType:
        record?.territoryResults?.[territoryId]?.victoryType ?? "UNKNOWN",
      completedAt:
        record?.territoryResults?.[territoryId]?.completedAt ??
        record?.completedAt,
      destructionMarkCount: 0,
    }),
  ) ?? [];
  const rewards = archive?.rewards ?? [];
  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">DESTRUCTION ARCHIVE // ${escapeHtml(node.name)}</div>
        <h1>${escapeHtml(node.name)} · 毁灭档案</h1>
      </div>
      <p>活动地图已压缩；永久奖励、完成时间、领土结果与剧情后果继续保留。</p>
    </div>
    ${renderMapBreadcrumbs(node.id)}
    <div class="screen-grid region-archive-layout">
      <article class="panel col-8 region-archive-dossier">
        <div class="panel-header">
          <div>
            <div class="panel-label">ARCHIVED REGION // 已归档</div>
            <div class="panel-title">${escapeHtml(node.name)}</div>
          </div>
          <span class="status-pill">只读档案</span>
        </div>
        <div class="region-archive-timeline">
          <div><span>区域完成</span><strong>${formatDateTime(record?.completedAt)}</strong></div>
          <div><span>压缩归档</span><strong>${formatDateTime(record?.archivedAt)}</strong></div>
          <div><span>领土数量</span><strong>${territories.length}</strong></div>
          <div><span>奖励记录</span><strong>${rewards.length}</strong></div>
        </div>
        <div class="intel-block region-archive-consequence">
          <strong>永久后果</strong>
          <span>${escapeHtml(archive?.consequence ?? "该区域的永久结果已写入档案。")}</span>
        </div>
        <div class="panel-label map-stat-heading">领土结算</div>
        <div class="region-archive-territories">
          ${territories.map((territory) => `
            <div class="region-archive-territory">
              <div>
                <strong>${escapeHtml(territory.name)}</strong>
                <small>永久领土记录</small>
              </div>
              <span>${territory.victoryType === "CONQUEST" ? "征服" : territory.victoryType === "INFILTRATION" ? "渗透" : "旧档／未知"}</span>
              <time>${formatDateTime(territory.completedAt)}</time>
              ${territory.destructionMarkCount ? `<small>破坏之乐标记 ×${territory.destructionMarkCount}</small>` : ""}
            </div>
          `).join("")}
        </div>
      </article>
      <article class="panel col-4">
        <div class="panel-label">REWARD LEDGER // 关键奖励</div>
        <div class="region-archive-rewards">
          ${rewards.length
            ? rewards.map(renderArchiveReward).join("")
            : `<p class="empty-state">旧存档或该区域没有可单独列出的奖励记录；已拥有内容不会被移除。</p>`}
        </div>
        <div class="validation-ok">✓ 归档不会重复发奖、增加毁灭计数或改变已解锁内容。</div>
      </article>
    </div>
  `;
}

function renderMacroMapScreen(root, state, node) {
  const children = getMapChildren(node.id);
  const nodeStatus = getMapNodePresentationStatus(state, node);
  const childNodes = children.length
    ? children
        .map((child) => {
          const status = getMapNodePresentationStatus(state, child);
          const unobserved = status.id === "unobserved";
          return `
            <button
              class="map-node macro-map-node"
              data-map-node="${child.id}"
              data-status="${status.id}"
              style="left:${child.map.x}%;top:${child.map.y}%"
              ${unobserved ? "disabled" : ""}
            >
              <strong>${escapeHtml(child.name)}</strong>
              <small>${MAP_NODE_TYPE_LABELS[child.type]} · ${status.label}</small>
            </button>
          `;
        })
        .join("")
    : `
        <div class="map-empty-signal">
          <strong>NO CHILD SIGNAL</strong>
          <span>${node.contentStatus === MAP_CONTENT_STATUS.PLANNED ? "该区域名称已经归档，具体领土内容尚未接入。" : "当前节点没有可继续展开的地图目标。"}</span>
        </div>
      `;
  const stats = state.worldMap.stats;
  const celestialArchive = state.worldMap.celestialRecords?.[node.id];
  const universeArchive = state.worldMap.universeRecords?.[node.id];
  const isArchived = state.worldMap.archivedNodeIds.includes(node.id);
  const canFreeze =
    node.type === MAP_NODE_TYPES.UNIVERSE &&
    state.worldMap.completedNodeIds.includes("WORLD_INNISTRAD") &&
    !isArchived &&
    state.worldMap.generatedCelestials.length < 8;
  const generatedCelestials = state.worldMap.generatedCelestials ?? [];
  const archiveControl = [MAP_NODE_TYPES.WORLD, MAP_NODE_TYPES.PLANET].includes(
      node.type,
    )
    ? isArchived
      ? `<div class="validation-ok">✓ ${escapeHtml(node.name)}已于${formatDateTime(celestialArchive?.archivedAt)}归档；其区域档案保持只读。</div>`
      : `<button class="terminal-button danger full-button" data-archive-celestial="${node.id}" ${canArchiveCelestial(state, node.id) ? "" : "disabled"}>归档整个${MAP_NODE_TYPE_LABELS[node.type]}</button>
        <p class="field-help">完成并压缩全部区域后可用。归档不会重复计算毁灭或发放奖励。</p>`
    : node.type === MAP_NODE_TYPES.UNIVERSE
      ? isArchived
        ? `<div class="validation-ok">✓ 宇宙已于${formatDateTime(universeArchive?.archivedAt)}封存；包含${universeArchive?.childNodeIds?.length ?? 0}个正式天体与${universeArchive?.frozenSurveyIds?.length ?? 0}份随机观测快照。</div>`
        : `<button class="terminal-button danger full-button" data-archive-universe="${node.id}" ${canArchiveUniverse(state, node.id) ? "" : "disabled"}>归档现实纬度宇宙</button>
          <p class="field-help">所有正式世界与星球归档后可用。随机观测快照会随宇宙档案封存，但不阻塞归档。</p>`
      : "";
  const cosmicSurveyMarkup = node.type === MAP_NODE_TYPES.UNIVERSE
    ? `
      <section class="panel cosmic-survey-panel">
        <div class="panel-header">
          <div>
            <div class="panel-label">FROZEN SURVEY // 随机天体固化</div>
            <div class="panel-title">冻结生成结果，不随版本或重载变化</div>
          </div>
          <span class="status-pill">${generatedCelestials.length} / 8</span>
        </div>
        <p class="field-help">依尼翠完全通关后开放。每次观测会把种子、生成器版本以及完整区域、领土、基本地和难度摘要写入当前存档。</p>
        <div class="cosmic-survey-actions">
          <button class="terminal-button" data-freeze-celestial="WORLD" ${canFreeze ? "" : "disabled"}>固化随机世界</button>
          <button class="terminal-button secondary" data-freeze-celestial="PLANET" ${canFreeze ? "" : "disabled"}>固化随机星球</button>
        </div>
        <div class="catalog-grid cosmic-survey-grid">
          ${generatedCelestials.length
            ? generatedCelestials.map((record, index) => `
                <article class="catalog-card">
                  <div class="panel-header">
                    <div>
                      <div class="panel-label">观测档案 // ${index + 1}</div>
                      <div class="panel-title">${escapeHtml(record.name)}</div>
                    </div>
                    <span class="status-pill">${MAP_NODE_TYPE_LABELS[record.type]}</span>
                  </div>
                  <div class="mini-stat"><span>固化规则</span><strong>${escapeHtml(getGeneratorVersionDisplayName(record.generatorVersion))}</strong></div>
                  <div class="mini-stat"><span>区域／领土</span><strong>${record.regions.length} / ${record.territoryCount}</strong></div>
                  <div class="mini-stat"><span>固化时间</span><strong>${formatDateTime(record.frozenAt)}</strong></div>
                </article>
              `).join("")
            : `<p class="empty-state">尚无随机天体快照。固化仅建立不可漂移的观测档案，尚不把随机领土接入远征。</p>`}
        </div>
      </section>
    `
    : "";

  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">${MAP_NODE_TYPE_LABELS[node.type].toUpperCase()} NETWORK // ${escapeHtml(node.name)}</div>
        <h1>${escapeHtml(node.name)}</h1>
      </div>
      <p>${escapeHtml(node.description)}</p>
    </div>
    ${renderMapBreadcrumbs(node.id)}
    <div class="screen-grid">
      <article class="col-8">
        <div class="map-canvas macro-map-canvas" aria-label="${escapeHtml(node.name)}下级节点地图">
          ${childNodes}
        </div>
      </article>
      <article class="panel col-4">
        <div class="panel-header">
          <div>
            <div class="panel-label">SCOPE // ${escapeHtml(node.name)}</div>
            <div class="panel-title">${escapeHtml(node.name)}</div>
          </div>
          <span class="status-pill ${nodeStatus.id === "planned" ? "warning" : ""}">${nodeStatus.label}</span>
        </div>
        <p class="field-help">${escapeHtml(node.description)}</p>
        <div class="mini-stat"><span>节点类型</span><strong>${MAP_NODE_TYPE_LABELS[node.type]}</strong></div>
        <div class="mini-stat"><span>直接父级</span><strong>${node.parentId ? escapeHtml(getMapNode(node.parentId)?.name ?? node.parentId) : "无／根节点"}</strong></div>
        <div class="mini-stat"><span>可见子节点</span><strong>${children.length}</strong></div>
        ${
          node.type === MAP_NODE_TYPES.SUBSPACE
            ? `<div class="validation-ok">✓ 亚空间与宇宙同级；基地不属于可征服地图。</div>`
            : ""
        }
        ${
          node.type === MAP_NODE_TYPES.UNIVERSE
            ? `<div class="validation-ok">✓ 世界与星球在此层同级，彼此不互相包含。</div>`
            : ""
        }
        <div class="panel-label map-stat-heading">毁灭档案</div>
        <div class="mini-stat"><span>领土／区域</span><strong>${stats.territoriesDestroyed} / ${stats.regionsDestroyed}</strong></div>
        <div class="mini-stat"><span>世界／星球</span><strong>${stats.worldsDestroyed} / ${stats.planetsDestroyed}</strong></div>
        <div class="mini-stat"><span>宇宙</span><strong>${stats.universesDestroyed}</strong></div>
        <div class="mini-stat"><span>征服／渗透胜利</span><strong>${stats.conquestVictories} / ${stats.infiltrationVictories}</strong></div>
        ${archiveControl}
      </article>
    </div>
    ${cosmicSurveyMarkup}
  `;
}

function renderMapScreen(state, force = false) {
  const root = document.querySelector("#map-content");
  if (!root || !state) return;
  const signature = getMapSignature(state);
  if (!force && signature === mapStateSignature) return;
  mapStateSignature = signature;

  const mapNode =
    getMapNode(selectedMapNodeId) ?? getMapNode("REGION_GAVONY");
  if (
    mapNode.type === MAP_NODE_TYPES.REGION &&
    state.worldMap.archivedNodeIds.includes(mapNode.id)
  ) {
    renderArchivedRegionScreen(root, state, mapNode);
    return;
  }
  const regionTerritories =
    mapNode.type === MAP_NODE_TYPES.REGION
      ? getTerritoriesForRegion(mapNode.id, state)
      : [];
  if (mapNode.type !== MAP_NODE_TYPES.REGION || !regionTerritories.length) {
    renderMacroMapScreen(root, state, mapNode);
    return;
  }

  const territory =
    regionTerritories.find((item) => item.id === selectedTerritoryId) ??
    regionTerritories[0];
  const testing = isTestMode(state);
  selectedTerritoryId = territory.id;
  const territoryState = state.territories[territory.id];
  const locked = !isTerritoryUnlocked(state, territory);
  const availableLegions = state.legions.filter((legion) => {
    const prototype = state.prototypes.find(
      (item) => item.id === legion.prototypeId,
    );
    return prototype?.status === "READY";
  });
  const availableLegendaryPrototypes = state.legendaryPrototypes.filter(
    (entity) => entity.status === "READY",
  );
  const availableSoloPrototypes = state.prototypes.filter((prototype) => {
    const blueprint = state.blueprints.find(
      (item) => item.id === prototype.blueprintId,
    );
    return (
      prototype.status === "READY" &&
      blueprint?.legendary &&
      !blueprint.legendaryOrigin &&
      !state.legions.some((legion) => legion.prototypeId === prototype.id) &&
      !state.productionQueue.some((job) => job.prototypeId === prototype.id)
    );
  });
  const availableExpeditionUnits = [
    ...availableLegions,
    ...availableSoloPrototypes,
    ...availableLegendaryPrototypes,
  ];
  if (
    !selectedLegionId ||
    !availableExpeditionUnits.some((item) => item.id === selectedLegionId)
  ) {
    selectedLegionId = availableExpeditionUnits[0]?.id ?? null;
  }
  const selectedLegion = availableLegions.find(
    (item) => item.id === selectedLegionId,
  );
  const selectedLegendaryPrototype = availableLegendaryPrototypes.find(
    (item) => item.id === selectedLegionId,
  );
  const selectedSoloPrototype = availableSoloPrototypes.find(
    (item) => item.id === selectedLegionId,
  );
  const selectedBlueprint = selectedLegendaryPrototype
    ? deriveLegendaryBlueprint(
        state,
        selectedLegendaryPrototype.blueprintId,
        selectedLegendaryPrototype,
      )
    : state.blueprints.find(
        (item) =>
          item.id ===
          (selectedSoloPrototype?.blueprintId ?? selectedLegion?.blueprintId),
      );
  const availableCommanders = selectedLegion
    ? availableLegendaryPrototypes
    : [];
  if (
    selectedCommanderLegendaryId &&
    !availableCommanders.some(
      (item) => item.id === selectedCommanderLegendaryId,
    )
  ) {
    selectedCommanderLegendaryId = null;
  }
  const selectedCommander = availableCommanders.find(
    (item) => item.id === selectedCommanderLegendaryId,
  );
  const selectedCommanderBlueprint = selectedCommander
    ? deriveLegendaryBlueprint(
        state,
        selectedCommander.blueprintId,
        selectedCommander,
      )
    : null;
  const selectedCommanderCost = selectedCommanderBlueprint
    ? formatCost(selectedCommanderBlueprint.commander?.cost ?? {})
    : null;
  const canInfiltrate = selectedBlueprint?.abilities.some((ability) =>
    ability.startsWith("ABILITY_INFILTRATE_"),
  );
  const satisfiesTerritoryInfiltrationRule =
    testing ||
    !territory.allowedInfiltratorRaceIds?.length ||
    territory.allowedInfiltratorRaceIds.includes(selectedBlueprint?.raceId);
  const canInfiltrateTerritory =
    canInfiltrate && satisfiesTerritoryInfiltrationRule;
  const selectedLegionJob = state.productionQueue.find(
    (item) =>
      item.type === "LEGION" &&
      (item.legionId === selectedLegion?.id ||
        item.prototypeId === selectedLegion?.prototypeId),
  );
  const regionRecord = state.worldMap.regionRecords?.[mapNode.id];
  const regionCompleted = state.worldMap.completedNodeIds.includes(mapNode.id);

  const nodes = `
    ${regionTerritories.map((item) => {
      const itemState = state.territories[item.id];
      const arcaneEffect = getTerritoryArcaneEffect(state, item.id);
      const destructionMarkCount =
        itemState.destructionMarks?.length ?? 0;
      const itemLocked = !isTerritoryUnlocked(state, item);
      const status = itemLocked
        ? "locked"
        : itemState.conquered
          ? "conquered"
          : "known";
      const subtitle = itemLocked
        ? "信号受阻"
        : itemState.conquered
          ? "沦陷遗址"
          : `情报 Lv.${itemState.routeIntelLevel}`;
      return `
        <button
          class="map-node ${item.id === territory.id ? "is-selected" : ""} ${arcaneEffect ? "has-arcane-effect" : ""} ${destructionMarkCount ? "has-destruction-marks" : ""}"
          data-territory="${item.id}"
          data-status="${status}"
          style="left:${item.map.x}%;top:${item.map.y}%"
        >
          <strong>${itemLocked ? "??? // " : ""}${itemLocked ? "未知信号" : item.name}</strong>
          <small>${subtitle}</small>
          ${renderTerritoryDestructionMarks(destructionMarkCount)}
          ${renderTerritoryArcaneEffect(arcaneEffect, true)}
        </button>
      `;
    }).join("")}
  `;

  const fortitudeText =
    territoryState.knownFortitude || territoryState.conquered
      ? `${territoryState.currentFortitude} / ${territory.maxFortitude}`
      : "???";
  const stabilityText =
    territoryState.knownStability || territoryState.conquered
      ? `${territoryState.currentStability} / ${territory.maxStability}`
      : "???";
  const intelStatus = territoryState.conquered
    ? "已沦陷"
    : `情报 Lv.${territoryState.routeIntelLevel}`;

  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">REGION // ${escapeHtml(mapNode.name)}</div>
        <h1>${escapeHtml(mapNode.name)} · 领土地图</h1>
      </div>
      <p>选择一支待命军团，支付500[C]开启侦查、征服或渗透远征。</p>
    </div>
    ${renderMapBreadcrumbs(mapNode.id)}
    ${regionCompleted ? `
      <article class="region-completion-banner">
        <div>
          <div class="panel-label">REGION COMPLETE // 可压缩</div>
          <strong>${escapeHtml(mapNode.name)}已经完成</strong>
          <span>首次完成：${formatDateTime(regionRecord?.completedAt)}。压缩后领土战场会从活动地图移除，奖励、时间、结果和永久后果保留。</span>
        </div>
        <button class="terminal-button danger" data-archive-region="${mapNode.id}" ${testing ? "disabled" : ""}>压缩为毁灭档案</button>
      </article>
    ` : ""}
    <div class="screen-grid">
      <article class="col-8">
        <div class="map-canvas territory-map-canvas" aria-label="${escapeHtml(mapNode.name)}领土节点地图">${nodes}</div>
      </article>
      <article class="panel col-4" id="territory-detail">
        <div class="panel-header">
          <div>
            <div class="panel-label">TARGET // ${escapeHtml(locked ? "未知信号" : territory.name)}</div>
            <div class="panel-title">${locked ? "未知信号" : territory.name}</div>
          </div>
          <span class="status-pill ${locked ? "warning" : ""}">${locked ? "未解锁" : intelStatus}</span>
        </div>
        ${
          locked
            ? `<p class="empty-state large">${escapeHtml(getTerritoryAccessReason(state, territory))}</p>`
            : `
              <p class="field-help">${territory.description}</p>
              ${
                territoryState.conquered && territory.conquestText
                  ? `<div class="intel-block"><strong>沦陷记录</strong><span>${escapeHtml(territory.conquestText)}</span></div>`
                  : territoryState.routeIntelLevel >= 2 && territory.scoutingText
                    ? `<div class="intel-block"><strong>区域侦查</strong><span>${escapeHtml(territory.scoutingText)}</span></div>`
                    : ""
              }
              <div class="mini-stat"><span>颜色</span><strong>${territory.colors.map((color) => `[${color}]`).join("")}</strong></div>
              <div class="mini-stat"><span>主要种族</span><strong>${territoryState.routeIntelLevel >= 2 || territoryState.conquered ? territory.primaryRace : "???"}</strong></div>
              <div class="mini-stat"><span>移动步</span><strong>${Math.max(1, territoryState.currentLands.length)}</strong></div>
              <div class="mini-stat"><span>坚守值</span><strong>${fortitudeText}</strong></div>
              <div class="mini-stat"><span>稳定值</span><strong>${stabilityText}</strong></div>
              <div class="mini-stat"><span>巡逻判定</span><strong>${territoryState.routeIntelLevel >= 1 ? "路线已探查 / 跳过 / 每步4秒" : "10%起，每步+5% / 每步10秒"}</strong></div>
              ${
                (territoryState.destructionMarks?.length ?? 0) > 0
                  ? `<div class="mayhem-mark-warning">
                      <strong>破坏之乐永久标记 ×${territoryState.destructionMarks.length}</strong>
                      <span>不可消除；首次沦陷时，每个标记随机减少1份可损失奖励。固定奖励不受影响，且至少保留1份可损失奖励。</span>
                    </div>`
                  : ""
              }
              ${(
                territoryState.routeIntelLevel >= 3 && territory.garrison
                  ? territoryState.revealedGuardTemplates
                      .map((templateId) =>
                        getGarrisonTemplate(territory, templateId),
                      )
                      .filter(Boolean)
                      .map(
                        (template) =>
                          `<div class="intel-block"><strong>${template.name}</strong><span>${template.power}/${template.defense}/${template.hp} · 已公开守军模板</span></div>`,
                      )
                      .join("")
                  : ""
              )}
              ${
                territoryState.conquered && !testing
                  ? `<div class="validation-ok">✓ 该领土已经沦陷，不再接受普通远征。</div>
                    ${
                      territory.id === "TERRITORY_TOWN_WG" &&
                      state.flags.gavonyRefreshAvailable &&
                      !state.flags.mvpThanksPending
                        ? `<button class="terminal-button full-button" data-refresh-gavony>手动刷新加渥尼挑战</button>
                           <p class="field-help">刷新后恢复50坚守、40稳定、巡逻队与三支守军；一次性奖励不会重置。</p>`
                        : ""
                    }`
                  : `
                    <div class="panel-label expedition-setup-heading">远征配置</div>
                    <label class="terminal-field">
                      <span>出战单位</span>
                      <select class="terminal-select" data-expedition-legion ${availableExpeditionUnits.length ? "" : "disabled"}>
                        ${
                          availableExpeditionUnits.length
                            ? [
                                ...availableLegions.map((legion) => `<option value="${legion.id}" ${legion.id === selectedLegionId ? "selected" : ""}>军团 · ${escapeHtml(legion.name)} · ${legion.currentPower}/${legion.currentDefense}/${legion.currentHp}</option>`),
                                ...availableSoloPrototypes.map((prototype) => {
                                  const blueprint = state.blueprints.find((item) => item.id === prototype.blueprintId);
                                  return `<option value="${prototype.id}" ${prototype.id === selectedLegionId ? "selected" : ""}>单体 · ${escapeHtml(prototype.name)} · ${blueprint.stats.power}/${blueprint.stats.defense}/${prototype.currentHp}</option>`;
                                }),
                                ...availableLegendaryPrototypes.map((entity) => {
                                  const legendaryBlueprint = deriveLegendaryBlueprint(state, entity.blueprintId, entity);
                                  return `<option value="${entity.id}" ${entity.id === selectedLegionId ? "selected" : ""}>单体 · ${escapeHtml(entity.name)} · ${legendaryBlueprint.stats.power}/${legendaryBlueprint.stats.defense}/${entity.currentHp} · LP ${entity.currentLp}/${legendaryBlueprint.maxLp}</option>`;
                                }),
                              ].join("")
                            : `<option>暂无可用军团或传奇原体</option>`
                        }
                      </select>
                    </label>
                    ${renderMapReinforcementControl(state, selectedLegion, selectedBlueprint)}
                    ${
                      selectedLegion
                        ? `<label class="terminal-field">
                            <span>指挥官</span>
                            <select class="terminal-select" data-expedition-commander>
                              <option value="">不配置指挥官</option>
                              ${availableCommanders.map((entity) => {
                                const commanderBlueprint = deriveLegendaryBlueprint(state, entity.blueprintId, entity);
                                return `<option value="${entity.id}" ${entity.id === selectedCommanderLegendaryId ? "selected" : ""}>${escapeHtml(entity.name)} · ${formatCost(commanderBlueprint.commander?.cost ?? {})} · LP ${entity.currentLp}</option>`;
                              }).join("")}
                            </select>
                          </label>`
                        : ""
                    }
                    <div class="command-tabs" role="group" aria-label="远征任务">
                      ${[
                        ["RECON", "侦查"],
                        ["CONQUEST", "征服"],
                        ["INFILTRATION", "渗透"],
                      ].map(([id, label]) => `<button class="filter-button ${selectedExpeditionCommand === id ? "is-active" : ""}" data-expedition-command="${id}">${label}</button>`).join("")}
                    </div>
                    <div class="mission-hint">
                      ${
                        selectedLegionJob
                          ? "当前军团正在补充复制体；生产完成后才可开启远征。"
                          : selectedExpeditionCommand === "RECON"
                          ? "推荐：永久取得路线、领土数值与守军情报；鉴定失败会安全撤回。"
                          : selectedExpeditionCommand === "CONQUEST"
                            ? "消灭全部现场守军后，以静态力量×剩余总生命攻击坚守值。"
                            : canInfiltrateTerritory
                              ? "每10秒攻击稳定值；暴露后有60秒时间使用反召唤。"
                              : canInfiltrate && !satisfiesTerritoryInfiltrationRule
                                ? "涅非利亚的尸潮只允许灵俑军团执行渗透。"
                                : "当前军团没有渗透X，无法执行此任务。"
                      }
                    </div>
                    <p class="dialog-message ${mapMessageIsError ? "is-error" : ""}" role="status">${escapeHtml(mapMessage)}</p>
                    <button class="terminal-button full-button" data-start-expedition ${availableExpeditionUnits.length && !selectedLegionJob && !state.activeExpedition && (selectedExpeditionCommand !== "INFILTRATION" || canInfiltrateTerritory) ? "" : "disabled"}>
                      开启${commandName(selectedExpeditionCommand)}远征 · 500[C]${selectedCommanderCost ? `＋${selectedCommanderCost}` : ""}
                    </button>
                    ${
                      state.activeExpedition
                        ? `<button class="terminal-button secondary full-button" data-route="expedition">查看当前远征</button>`
                        : ""
                    }
                  `
              }
            `
        }
      </article>
    </div>
  `;
}

function getExpeditionSignature(state) {
  const expedition = state.activeExpedition;
  return JSON.stringify({
    expedition,
    last: state.lastExpedition?.completedAt,
    u: state.resources.amounts.U,
  });
}

function renderExpeditionScreen(state, force = false) {
  const root = document.querySelector("#expedition-content");
  if (!root || !state) return;
  const signature = getExpeditionSignature(state);
  if (!force && signature === expeditionStateSignature) return;
  expeditionStateSignature = signature;
  const expedition = state.activeExpedition;

  if (!expedition) {
    const last = state.lastExpedition;
    root.innerHTML = `
      <div class="page-heading">
        <div><div class="eyebrow">EXPEDITION // 远征监视器</div><h1>当前无远征</h1></div>
        <button class="terminal-button" data-route="map">返回领土地图</button>
      </div>
      ${
        last
          ? `<article class="panel">
              <div class="panel-header">
                <div><div class="panel-label">LAST EXPEDITION // ${outcomeName(last.outcome)}</div><div class="panel-title">${escapeHtml(last.summary)}</div></div>
              </div>
              ${renderExpeditionResultSummary(last)}
              <div class="combat-log">${last.logEntries.map((entry) => `<p><span class="round">[${entry.type.toUpperCase()}]</span> ${escapeHtml(entry.text)}</p>`).join("")}</div>
            </article>`
          : `<div class="empty-state large">前往领土地图，选择待命军团与任务类型。</div>`
      }
    `;
    return;
  }

  const territory = getTerritoryForState(state, expedition.territoryId);
  const territoryState = state.territories[territory.id];
  const deployedPrototype = state.prototypes.find(
    (item) => item.id === expedition.prototypeId,
  );
  const legion =
    state.legions.find((item) => item.id === expedition.legionId) ??
    state.legendaryPrototypes.find(
      (item) => item.id === expedition.legendaryPrototypeId,
    ) ??
    (expedition.elbrusTransformed
      ? {
          name: "解缚威森格",
          currentHp: expedition.withengarCurrentHp ?? 6,
          maxHp: 6,
        }
      : expedition.deploymentMode === "PROTOTYPE_SOLO"
        ? deployedPrototype
        : null);
  const commander = state.legendaryPrototypes.find(
    (item) => item.id === expedition.commanderLegendaryPrototypeId,
  );
  const combat = expedition.combat;
  const originColor = getOrigin(state.base.originId).color;
  const canCastVirtuesRuin = originColor === "B" || isTestMode(state);
  const canCastTasteForMayhem =
    originColor === "R" || isTestMode(state);
  const canCastGrounded = originColor === "G" || isTestMode(state);
  const canUnsummon =
    (originColor === "U" || isTestMode(state)) &&
    expedition.command === "INFILTRATION" &&
    ["INFILTRATING", "EXECUTION_WARNING"].includes(expedition.phase);
  const arcaneEffect = getTerritoryArcaneEffect(state, territory.id);
  const enchantmentName =
    ENCHANTMENT_CATALOG.find(
      (item) => item.id === expedition.enchantmentId,
    )?.name ?? "无";
  const canCastTravelOrCombat = [
    "TRAVELING",
    "PATROL_COMBAT",
    "GARRISON_COMBAT",
  ].includes(expedition.phase);
  const enchantmentActions = [
    canCastVirtuesRuin &&
    expedition.command === "INFILTRATION" &&
    ["TRAVELING", "INFILTRATING"].includes(expedition.phase) &&
    expedition.enchantmentId !== VIRTUES_RUIN_ID
      ? `<button class="terminal-button secondary full-button" data-cast-virtues-ruin ${isTestMode(state) || state.resources.amounts.B >= 2 ? "" : "disabled"}>道德瓦解 · ${isTestMode(state) ? "测试模式免费" : "2[B]"}</button>`
      : "",
    canCastTasteForMayhem &&
    expedition.command === "CONQUEST" &&
    canCastTravelOrCombat &&
    expedition.enchantmentId !== TASTE_FOR_MAYHEM_ID
      ? `<button class="terminal-button secondary full-button" data-cast-taste-for-mayhem ${isTestMode(state) || state.resources.amounts.R >= 1 ? "" : "disabled"}>破坏之乐 · ${isTestMode(state) ? "测试模式免费" : "1[R]"}</button>`
      : "",
    canCastGrounded &&
    canCastTravelOrCombat &&
    expedition.enchantmentId !== GROUNDED_ID
      ? `<button class="terminal-button secondary full-button" data-cast-grounded ${isTestMode(state) || state.resources.amounts.G >= 1 ? "" : "disabled"}>禁足 · ${isTestMode(state) ? "测试模式免费" : "1[G]"}</button>`
      : "",
  ].filter(Boolean).join("");
  const phaseDetails =
    expedition.phase === "TRAVELING"
      ? `
        <div class="metric">
          <div class="metric-row"><span>移动进度</span><strong>${expedition.travel.currentStep} / ${expedition.travel.totalSteps}</strong></div>
          <div class="progress"><span style="width:${(expedition.travel.currentStep / expedition.travel.totalSteps) * 100}%"></span></div>
        </div>
        <div class="mini-stat"><span>下一步</span><strong>${formatClock(expedition.travel.stepRemainingMs)}</strong></div>
      `
      : expedition.phase === "INFILTRATING"
        ? `
          <div class="metric">
            <div class="metric-row"><span>稳定值</span><strong>${territoryState.currentStability} / ${territory.maxStability}</strong></div>
            <div class="progress"><span style="width:${(territoryState.currentStability / territory.maxStability) * 100}%"></span></div>
          </div>
          <div class="mini-stat"><span>有效渗透</span><strong>${expedition.infiltration.effective}</strong></div>
          <div class="mini-stat"><span>下一周期</span><strong>${formatClock(expedition.infiltration.cycleRemainingMs)}</strong></div>
        `
        : expedition.phase === "EXECUTION_WARNING"
          ? `
            <div class="execution-warning">
              <strong>原体即将被处决</strong>
              <span>${expedition.executionWarning.mode === "PAUSE" ? "直接暂停：倒计时已冻结" : formatClock(expedition.executionWarning.remainingMs)}</span>
              ${
                canUnsummon
                  ? `<p>反召唤只救回原体；全部复制体湮灭，本次任务失败。</p>
                     <button class="terminal-button warning full-button" data-unsummon ${isTestMode(state) || state.resources.amounts.U >= 3 ? "" : "disabled"}>反召唤 · ${isTestMode(state) ? "测试模式免费" : "3[U]"}</button>`
                  : ""
              }
              <button class="terminal-button secondary full-button" data-accept-execution>放弃救援</button>
            </div>
          `
          : "";

  const combatMarkup = combat
    ? `
      <article class="panel col-12">
        <div class="panel-header">
          <div><div class="panel-label">COMBAT // ${combat.context.kind}</div><div class="panel-title">${phaseName(expedition.phase)}</div></div>
          <span class="status-pill warning">ROUND ${String(combat.round).padStart(2, "0")}</span>
        </div>
        <div class="combatants">
          <div class="combatant">
            <div class="panel-label">PLAYER LEGION</div>
            <p>${escapeHtml(combat.attacker.name)}</p>
            <div class="mini-stat combat-power"><span>当前力量</span><strong>${combat.attacker.currentPower}</strong></div>
            ${renderCombatVitals(combat.attacker)}
          </div>
          <div class="versus">VS // ROUND ${combat.round + 1}</div>
          <div class="combatant enemy">
            <div class="panel-label">DEFENDER</div>
            <p>${escapeHtml(combat.defender.name)}</p>
            <div class="mini-stat combat-power"><span>当前力量</span><strong>${combat.defender.currentPower}</strong></div>
            ${renderCombatVitals(combat.defender)}
          </div>
        </div>
        ${
          expedition.legendaryActionWindow
              ? `<div class="execution-warning">
                <strong>专属能力窗口：血色邀宴</strong>
                <span>下一回合到来前可支付2 LP，对当前目标造成2点直接生命伤害，并获得1点远征临时生命（最多3点）；战斗不会为选择暂停。</span>
                <div class="inline-actions">
                  <button class="terminal-button warning" data-activate-olivia-blood-feast>发动 · 2 LP</button>
                  <button class="terminal-button secondary" data-skip-olivia-blood-feast>本回合不发动</button>
                </div>
              </div>`
            : ""
        }
      </article>
    `
    : "";

  root.innerHTML = `
    <div class="page-heading">
      <div>
        <div class="eyebrow">EXPEDITION // ${expedition.phase}</div>
        <h1>${territory.name} · ${phaseName(expedition.phase)}</h1>
      </div>
      ${
        ["PATROL_COMBAT", "GARRISON_COMBAT"].includes(expedition.phase)
          ? `<div class="speed-controls">
              ${[1, 4, 20].map((speed) => `<button class="terminal-button secondary ${expedition.playbackSpeed === speed ? "is-active" : ""}" data-expedition-speed="${speed}">${speed === 20 ? "快速" : `×${speed}`}</button>`).join("")}
            </div>`
          : ""
      }
    </div>
    ${arcaneEffect ? `<div class="expedition-arcane-field">${renderTerritoryArcaneEffect(arcaneEffect)}<div><strong>${arcaneEffect.label}</strong><span>${arcaneEffect.detail}</span></div></div>` : ""}
    <div class="screen-grid">
      ${combatMarkup}
      <article class="col-8">
        <div class="combat-log" aria-label="远征战报">
          ${expedition.logEntries.map((entry) => `<p><span class="round">[${entry.type.toUpperCase()}]</span> ${escapeHtml(entry.text)}</p>`).join("")}
          <p class="empty-line">_ 等待下一次结算</p>
        </div>
      </article>
      <article class="panel col-4">
        <div class="panel-header"><div class="panel-label">EXPEDITION STATE</div><span class="status-pill">${phaseName(expedition.phase)}</span></div>
        <div class="mini-stat"><span>目标</span><strong>${territory.name}</strong></div>
        <div class="mini-stat"><span>任务</span><strong>${commandName(expedition.command)}</strong></div>
        <div class="mini-stat"><span>${expedition.deploymentMode === "LEGION" ? "军团生命" : "原体生命"}</span><strong>${legion?.currentHp ?? 0} / ${legion?.maxHp ?? 0}</strong></div>
        ${expedition.elbrusTransformed ? `<div class="validation-ok">✓ 解缚威森格正在替代已毁灭的装备者；远征结束后会重新变为镇魔刃埃布斯。</div>` : ""}
        ${
          expedition.legendaryPrototypeId
            ? `<div class="mini-stat"><span>沃达连 LP</span><strong>${expedition.legendaryLp} · 临时生命 ${expedition.legendaryTemporaryHp ?? 0}/3</strong></div>`
            : ""
        }
        ${
          commander
            ? `<div class="mini-stat"><span>指挥官</span><strong>${escapeHtml(commander.name)} · LP ${expedition.commanderLp}</strong></div>
               <div class="mini-stat"><span>指挥力量</span><strong>${expedition.commanderPowerTriggered ? "已触发 +1（不计坚守）" : "等待首次生命伤害"}</strong></div>`
            : ""
        }
        <div class="mini-stat"><span>当前结界</span><strong>${enchantmentName}</strong></div>
        ${phaseDetails}
        ${enchantmentActions}
        ${
          canUnsummon && expedition.phase !== "EXECUTION_WARNING"
            ? `<button class="terminal-button warning full-button" data-unsummon ${isTestMode(state) || state.resources.amounts.U >= 3 ? "" : "disabled"}>反召唤 · ${isTestMode(state) ? "测试模式免费" : "3[U]"}</button>`
            : ""
        }
      </article>
    </div>
  `;
}

function applyLogFilter() {
  document.querySelectorAll("[data-log-label]").forEach((row) => {
    row.hidden =
      activeLogFilter !== "全部" && row.dataset.logLabel !== activeLogFilter;
  });
}

function setArchiveTab(tabId) {
  if (!["events", "statistics", "achievements", "abilities", "rules"].includes(tabId)) return;
  activeArchiveTab = tabId;
  document.querySelectorAll("[data-archive-tab]").forEach((button) => {
    const active = button.dataset.archiveTab === tabId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-archive-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.archivePanel !== tabId;
  });
}

function renderAchievementDialog(state) {
  const dialog = document.querySelector("#achievement-dialog");
  if (!dialog) return;
  const achievementId = state.achievementProgress.pendingIds[0];
  const achievement = getAchievement(achievementId);
  if (!achievement) {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.dataset.achievementId = achievement.id;
  dialog.querySelector("[data-achievement-reveal-name]").textContent =
    achievement.name;
  dialog.querySelector("[data-achievement-reveal-description]").textContent =
    achievement.description;
  dialog.querySelector("[data-achievement-reveal-category]").textContent =
    achievement.category;
  dialog.querySelector("[data-achievement-reveal-reward]").textContent =
    achievement.reward ? "奖励已先行写入存档" : "无额外奖励";
  const anotherDialogOpen = document.querySelector(
    "dialog[open]:not(#achievement-dialog)",
  );
  const blocked =
    state.battleReview ||
    (state.lastExpedition && state.lastExpedition.resultAcknowledged !== true) ||
    state.flags.mvpThanksPending ||
    anotherDialogOpen;
  if (!blocked && !dialog.open) dialog.showModal();
  if (blocked && dialog.open) dialog.close();
}

function updateStateUI(state) {
  if (!state) return;

  renderCurrentObjectives(state);

  for (const color of COLOR_ORDER) {
    const resource = document.querySelector(`[data-resource="${color}"]`);
    if (!resource) continue;
    const value = state.resources.amounts[color];
    const cap = state.resources.caps[color];
    resource.querySelector("[data-resource-value]").textContent =
      value.toLocaleString("zh-CN");
    resource.querySelector("[data-resource-cap]").textContent =
      cap.toLocaleString("zh-CN");
    resource.querySelector("[data-resource-progress]").style.width =
      `${Math.min(100, (value / cap) * 100)}%`;
    resource.title = `${COLORS[color].name}法术力 ${value}/${cap}`;
  }

  const origin = getOrigin(state.base.originId);
  const land = getLand(state.base.landId);
  const rates = getProductionRates(state);
  const anchored = state.base.anchorLocation?.status === "ANCHORED";
  const sameColor = !anchored && origin.color === land.color;
  const productionPeriod = isTestMode(state) ? "2秒" : "120秒";
  const colorRate = ["W", "U", "B", "R", "G"]
    .filter((color) => rates[color] > 0)
    .map((color) => `${rates[color]} [${color}]`)
    .join(" + ") + ` / ${productionPeriod}`;
  const primaryCap = state.resources.caps[origin.color];

  setAllText("[data-origin-name]", origin.name);
  setAllText("[data-origin-short]", origin.shortName);
  setAllText(
    "[data-land-name]",
    anchored ? state.base.anchorLocation.territoryName : land.name,
  );
  setAllText(
    "[data-base-location]",
    anchored
      ? `现实维度／${state.base.anchorLocation.territoryName}`
      : "亚空间",
  );
  setAllText(
    "[data-opening-type]",
    anchored ? "空间锚定" : sameColor ? "同色集中" : "异色并行",
  );
  setAllText("[data-color-rate]", colorRate);
  setAllText("[data-primary-cap]", `${primaryCap} [${origin.color}]`);
  setAllText(
    "[data-base-slots]",
    `${getActiveManaProductionSlots(state)} / ${state.base.manaProductionSlots}`,
  );
  setAllText(
    "[data-blueprint-cap]",
    `${state.blueprints.length} / ${state.base.blueprintCap}`,
  );

  document.querySelector("[data-origin-progress]").style.width =
    `${Math.min(100, (state.resources.amounts[origin.color] / primaryCap) * 100)}%`;

  const residueMs = getMillisecondsToNextCollection(state, "C");
  setAllText("[data-residue-countdown]", formatClock(residueMs));
  document.querySelectorAll("[data-residue-progress]").forEach((bar) => {
    bar.style.width = `${state.resources.fractions.C * 100}%`;
  });

  const eventMarkup = renderCompactLogs(state);
  document.querySelectorAll("[data-event-stream]").forEach((stream) => {
    stream.innerHTML = eventMarkup;
  });
  const logBody = document.querySelector(".logs-table tbody");
  if (logBody) {
    logBody.innerHTML = renderLogRows(state);
    applyLogFilter();
  }
  const careerStatistics = document.querySelector("[data-career-statistics]");
  if (careerStatistics) {
    careerStatistics.innerHTML = renderCareerStatistics(state);
  }
  const achievements = document.querySelector("[data-achievements]");
  if (achievements) achievements.innerHTML = renderAchievements(state);
  const keywordAbilities = document.querySelector("[data-keyword-abilities]");
  if (keywordAbilities) {
    keywordAbilities.innerHTML = renderNamedAbilityArchive(state);
  }
  setArchiveTab(activeArchiveTab);

  setAllText("[data-game-id]", `GAME ID: ${state.gameId}`);
  const secondsSinceSave = Math.max(
    0,
    Math.floor((Date.now() - state.lastSavedAt) / 1000),
  );
  setAllText(
    "[data-autosave-status]",
    `AUTOSAVE // ${secondsSinceSave === 0 ? "刚刚" : `${secondsSinceSave}秒前`}`,
  );

  setAllText("[data-save-game-id]", state.gameId);
  setAllText("[data-save-created]", formatDateTime(state.createdAt));
  setAllText("[data-save-updated]", formatDateTime(state.lastSavedAt));
  setAllText(
    "[data-expedition-status]",
    state.activeExpedition ? phaseName(state.activeExpedition.phase) : "待命",
  );
  const warningMode = document.querySelector("#execution-warning-mode");
  if (warningMode) warningMode.value = state.settings.executionWarningMode;
  const battlePause = document.querySelector("#battle-end-pause");
  if (battlePause) {
    battlePause.value = state.settings.pauseAfterCombat === false
      ? "false"
      : "true";
  }
  const testModeToggle = document.querySelector("#test-mode-toggle");
  if (testModeToggle) testModeToggle.checked = isTestMode(state);
  const manaDisplayMode = ["SYMBOL", "LETTER"].includes(
    state.settings.manaDisplayMode,
  )
    ? state.settings.manaDisplayMode
    : "SYMBOL";
  const manaDisplaySelect = document.querySelector("#mana-display-mode");
  if (manaDisplaySelect) manaDisplaySelect.value = manaDisplayMode;
  const themeId = UI_THEME_IDS.includes(state.settings.themeId)
    ? state.settings.themeId
    : DEFAULT_UI_THEME;
  const themeSelect = document.querySelector("#theme-select");
  if (themeSelect) themeSelect.value = themeId;
  applyTheme(themeId);
  setAllText(
    "[data-live-state]",
    isTestMode(state) ? "测试模式" : "在线运行",
  );
  document.body.classList.toggle("test-mode", isTestMode(state));
  const thanksDialog = document.querySelector("#mvp-thanks-dialog");
  if (thanksDialog) {
    const expeditionResultPending =
      Boolean(state.lastExpedition) &&
      state.lastExpedition.resultAcknowledged !== true;
    if (
      state.flags.mvpThanksPending &&
      !state.battleReview &&
      !expeditionResultPending &&
      !thanksDialog.open
    ) {
      elfQueenNarrativeStep = 0;
      renderElfQueenNarrative();
      thanksDialog.showModal();
    } else if (
      (!state.flags.mvpThanksPending ||
        state.battleReview ||
        expeditionResultPending) &&
      thanksDialog.open
    ) {
      thanksDialog.close();
    }
  }
  renderPrototypeEditor(state);
  renderBiofactorCatalog(state);
  renderBaseRuntime(state);
  renderBaseContext(state);
  renderArcanaScreens(state);
  updateProductionTimers(state);
  renderMapScreen(state);
  updateMapReinforcementAvailability(state);
  renderExpeditionScreen(state);
  renderBattleReviewDialog(state);
  renderExpeditionResultDialog(state);
  renderAchievementDialog(state);

  const effectsEnabled = state.settings.effectsEnabled !== false;
  document.body.classList.toggle("effects-off", !effectsEnabled);
  document.body.classList.toggle(
    "mana-display-letters",
    manaDisplayMode === "LETTER",
  );
  const effectsButton = document.querySelector("#effects-toggle");
  effectsButton.classList.toggle("is-active", !effectsEnabled);
  effectsButton.setAttribute("aria-pressed", effectsEnabled ? "false" : "true");
}

function updateOpeningSummary() {
  const form = document.querySelector("#new-game-form");
  const data = new FormData(form);
  const origin = getOrigin(data.get("originId"));
  const land = getLand(data.get("landId"));
  if (!origin || !land) return;
  const sameColor = origin.color === land.color;
  document.querySelector("#opening-summary").innerHTML = sameColor
    ? `<strong>同色集中：</strong>初始 6 [${origin.color}]，每120秒产出 2 [${origin.color}]，容量 15。`
    : `<strong>异色并行：</strong>初始 3 [${origin.color}] + 3 [${land.color}]，每120秒两色各产出1点，容量均为10。`;
}

function showNewGameDialog(replacingExisting = false) {
  const dialog = document.querySelector("#new-game-dialog");
  dialog.dataset.replacing = replacingExisting ? "true" : "false";
  dialog.querySelectorAll(".dialog-close, .dialog-cancel").forEach((button) => {
    button.hidden = !replacingExisting;
  });
  document.querySelector("#start-game-button").textContent = replacingExisting
    ? "覆盖并建立新游戏"
    : "建立新游戏";
  updateOpeningSummary();
  if (!dialog.open) dialog.showModal();
}

function skipStartupCoverAnimation() {
  document
    .querySelector("#startup-cover-dialog .startup-cover-shell")
    ?.classList.add("is-skipped");
}

function showStartupCover() {
  const dialog = document.querySelector("#startup-cover-dialog");
  const shell = dialog?.querySelector(".startup-cover-shell");
  if (!dialog || !shell) return;
  shell.classList.remove("is-skipped");
  if (!dialog.open) dialog.showModal();
  shell.focus({ preventScroll: true });
}

function setSaveMessage(message, isError = false) {
  const element = document.querySelector("#save-dialog-message");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function setPrototypeMessage(message, isError = false) {
  prototypeMessage = message;
  prototypeMessageIsError = isError;
  renderPrototypeEditor(engine.state, true);
}

function openSaveDialog() {
  if (!engine.state) {
    showNewGameDialog(false);
    return;
  }
  updateStateUI(engine.state);
  setSaveMessage("");
  document.querySelector("#save-dialog").showModal();
}

function downloadSave() {
  try {
    const json = engine.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CrazyTide-${engine.state.gameId}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveMessage("存档已导出。");
  } catch (error) {
    setSaveMessage(error.message, true);
  }
}

document.addEventListener("click", (event) => {
  const mobileNavToggle = event.target.closest("[data-mobile-nav-toggle]");
  if (mobileNavToggle) {
    setMobileNavExpanded(
      !mobileNavToggle.closest(".mobile-nav")?.classList.contains("is-expanded"),
    );
    return;
  }

  const acknowledgeAchievementButton = event.target.closest(
    "[data-acknowledge-achievement]",
  );
  if (acknowledgeAchievementButton) {
    const dialog = document.querySelector("#achievement-dialog");
    engine.acknowledgeAchievement(dialog?.dataset.achievementId ?? null);
    return;
  }

  const instantiateOliviaButton = event.target.closest(
    "[data-instantiate-olivia]",
  );
  if (instantiateOliviaButton) {
    try {
      engine.instantiateOlivia();
      prototypeMessage = "奥莉薇亚·沃达连已完成实体化。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const rebuildOliviaButton = event.target.closest("[data-rebuild-olivia]");
  if (rebuildOliviaButton) {
    try {
      engine.rebuildOlivia(rebuildOliviaButton.dataset.rebuildOlivia);
      prototypeMessage = "奥莉薇亚·沃达连已完成重构。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const destroyLegendaryEntityButton = event.target.closest(
    "[data-destroy-legendary-entity]",
  );
  if (destroyLegendaryEntityButton) {
    if (
      !globalThis.confirm(
        "确认销毁当前传奇实体？身份档案与永久成长保留，独立传奇因子将归库；重新实体化仍需支付完整费用。",
      )
    ) {
      return;
    }
    try {
      engine.destroyLegendaryEntity(
        destroyLegendaryEntityButton.dataset.destroyLegendaryEntity,
      );
      prototypeMessage = "当前传奇实体已销毁；身份档案继续保留。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const archiveLegendaryButton = event.target.closest(
    "[data-archive-legendary-blueprint]",
  );
  if (archiveLegendaryButton) {
    try {
      engine.archiveLegendaryBlueprint(
        archiveLegendaryButton.dataset.archiveLegendaryBlueprint,
      );
      prototypeMessage = "传奇蓝图已封存，不再占用活动蓝图位置。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const restoreLegendaryButton = event.target.closest(
    "[data-restore-legendary-blueprint]",
  );
  if (restoreLegendaryButton) {
    try {
      engine.restoreLegendaryBlueprint(
        restoreLegendaryButton.dataset.restoreLegendaryBlueprint,
      );
      prototypeMessage = "传奇蓝图已解除封存，可重新实体化。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const addOliviaComponentButton = event.target.closest(
    "[data-add-olivia-component]",
  );
  if (addOliviaComponentButton) {
    try {
      const blueprint = deriveOliviaBlueprint(
        engine.state,
        engine.state.legendaryPrototypes.find(
          (item) => item.blueprintId === OLIVIA_BLUEPRINT_ID,
        ),
      );
      const zone = addOliviaComponentButton.dataset.oliviaZone;
      let position;
      if (zone === "LEGENDARY_EQUIPMENT") {
        position = {
          zoneId: "LEGENDARY_EQUIPMENT",
          x: 0,
          y: 0,
          rotation: 0,
        };
      } else {
        const draft = {
          name: "奥莉薇亚·沃达连",
          raceId: "RACE_VAMPIRE",
          raceColor: "B",
          jobId: "JOB_NONE",
          jobColor: null,
          placements: blueprint.placements.filter(
            (item) => item.zoneId !== "LEGENDARY_EQUIPMENT",
          ),
        };
        position = findFirstPlacement(
          draft,
          addOliviaComponentButton.dataset.addOliviaComponent,
        );
        if (!position) throw new Error("沃达连的通用拓展区没有合法空位");
      }
      engine.updateOliviaPlacements([
        ...blueprint.placements,
        {
          instanceId: `OLIVIA_FACTOR_${Date.now().toString(36).toUpperCase()}`,
          contentId:
            addOliviaComponentButton.dataset.addOliviaComponent,
          ...position,
        },
      ]);
      prototypeMessage = "沃达连蓝图修改已保存。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const removeOliviaComponentButton = event.target.closest(
    "[data-remove-olivia-component]",
  );
  if (removeOliviaComponentButton) {
    try {
      const blueprint = deriveOliviaBlueprint(
        engine.state,
        engine.state.legendaryPrototypes.find(
          (item) => item.blueprintId === OLIVIA_BLUEPRINT_ID,
        ),
      );
      engine.updateOliviaPlacements(
        blueprint.placements.filter(
          (item) =>
            item.instanceId !==
            removeOliviaComponentButton.dataset.removeOliviaComponent,
        ),
      );
      prototypeMessage = "沃达连蓝图修改已保存。";
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const residentButton = event.target.closest("[data-talk-resident]");
  if (residentButton) {
    try {
      const result = engine.talkToResident(
        "",
        residentButton.dataset.talkResident,
      );
      setTerminalResponse(
        result.dialogue.text,
        `${result.resident.name.toUpperCase()} // ${result.resident.type}`,
        "resident",
      );
    } catch (error) {
      setTerminalResponse(
        error.message,
        "SYSTEM // 驻留者链路",
        "warning",
      );
    }
    return;
  }

  const listenButton = event.target.closest("[data-listen-subspace]");
  if (listenButton) {
    listenToSubspace();
    return;
  }

  const openingSkipButton = event.target.closest("[data-opening-skip]");
  if (openingSkipButton) {
    document.querySelector("#opening-narrative-dialog")?.close();
    setTerminalResponse(
      "游戏介绍已跳过。基地控制权已开放。",
      "SYSTEM // 锚定完成",
    );
    return;
  }

  const openingNextButton = event.target.closest("[data-opening-next]");
  if (openingNextButton) {
    if (openingNarrativeStep >= OPENING_NARRATIVE.length - 1) {
      document.querySelector("#opening-narrative-dialog")?.close();
      setTerminalResponse(
        "基地控制权恢复。第一个目标：完成原体设计。",
        "SYSTEM // 锚定完成",
      );
    } else {
      openingNarrativeStep += 1;
      renderOpeningNarrative();
    }
    return;
  }

  const queenSkipButton = event.target.closest("[data-queen-skip]");
  if (queenSkipButton) {
    finishElfQueenNarrative(true);
    return;
  }

  const queenNextButton = event.target.closest("[data-queen-next]");
  if (queenNextButton) {
    if (
      elfQueenNarrativeStep >=
      ELF_QUEEN_DECLARATION.length - 1
    ) {
      finishElfQueenNarrative();
    } else {
      elfQueenNarrativeStep += 1;
      renderElfQueenNarrative();
    }
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    setRoute(routeButton.dataset.route);
    if (routeButton.closest(".mobile-nav")) setMobileNavExpanded(false);
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    activeLogFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button === filterButton);
    });
    applyLogFilter();
    return;
  }

  const archiveTabButton = event.target.closest("[data-archive-tab]");
  if (archiveTabButton) {
    setArchiveTab(archiveTabButton.dataset.archiveTab);
    return;
  }

  const factorTypeButton = event.target.closest(
    "[data-factor-type-filter]",
  );
  if (factorTypeButton) {
    const filterRoot =
      factorTypeButton.closest(
        "#prototype-content, #biofactors-content",
      ) ?? document;
    if (filterRoot.id === "biofactors-content") {
      biofactorCatalogTypeFilter =
        factorTypeButton.dataset.factorTypeFilter;
    } else {
      factorTypeFilter = factorTypeButton.dataset.factorTypeFilter;
    }
    applyBiofactorFilters(filterRoot);
    return;
  }

  const factorEffectButton = event.target.closest(
    "[data-factor-effect-filter]",
  );
  if (factorEffectButton) {
    const filterRoot =
      factorEffectButton.closest(
        "#prototype-content, #biofactors-content",
      ) ?? document;
    if (filterRoot.id === "biofactors-content") {
      biofactorCatalogEffectFilter =
        factorEffectButton.dataset.factorEffectFilter;
    } else {
      factorEffectFilter = factorEffectButton.dataset.factorEffectFilter;
    }
    applyBiofactorFilters(filterRoot);
    return;
  }

  const addComponentButton = event.target.closest("[data-add-component]");
  if (addComponentButton) {
    const component = getComponent(addComponentButton.dataset.addComponent);
    const installedCount = blueprintDraft.placements.filter(
      (item) => item.contentId === component.id,
    ).length;
    if (
      Number.isInteger(component.maxInstallations) &&
      installedCount >= component.maxInstallations
    ) {
      setPrototypeMessage(
        `${component.name}最多安装${component.maxInstallations}个。`,
        true,
      );
      return;
    }
    if (
      component.unique &&
      blueprintDraft.placements.some(
        (item) => item.contentId === component.id,
      )
    ) {
      setPrototypeMessage(`${component.name}不能重复安装。`, true);
      return;
    }
    const independentLegendaryInstance = component.legendary
      ? engine.state.rewardProgress?.instances?.find(
          (instance) =>
            instance.contentId === component.id &&
            instance.location === "INVENTORY",
        )
      : null;
    if (component.legendary && !independentLegendaryInstance) {
      setPrototypeMessage(`${component.name}没有可用的唯一实体。`, true);
      return;
    }
    const editingBlueprint = editingBlueprintId
      ? engine.state.blueprints.find((item) => item.id === editingBlueprintId)
      : null;
    if (
      component.legendary &&
      !editingBlueprint?.legendary &&
      !blueprintDraft.legendary &&
      !globalThis.confirm(
        "安装传奇因子会令该蓝图永久传奇化，并永久失去复制军团的资格；以后卸下因子也不会恢复。是否继续？",
      )
    ) {
      return;
    }
    const placement =
      findFirstPlacement(blueprintDraft, component.id, 0) ??
      (component.rotatable
        ? findFirstPlacement(blueprintDraft, component.id, 90)
        : null);
    if (!placement) {
      setPrototypeMessage(`拓展格无法容纳${component.name}。`, true);
      return;
    }
    blueprintDraft.placements.push({
      instanceId:
        independentLegendaryInstance?.instanceId ??
        `PLACEMENT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      contentId: component.id,
      ...placement,
    });
    if (component.legendary) blueprintDraft.legendary = true;
    prototypeMessage = `${component.name}已安装。`;
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const movePlacementTarget = event.target.closest(
    "[data-move-placement-target]",
  );
  if (movePlacementTarget) {
    try {
      const movingComponent = getComponent(
        blueprintDraft.placements.find(
          (item) =>
            item.instanceId ===
            movePlacementTarget.dataset.movePlacementTarget,
        )?.contentId,
      );
      blueprintDraft = movePlacement(
        blueprintDraft,
        movePlacementTarget.dataset.movePlacementTarget,
        {
          zoneId: movePlacementTarget.dataset.zoneId,
          x: Number(movePlacementTarget.dataset.x),
          y: Number(movePlacementTarget.dataset.y),
        },
      );
      movingPlacementId = null;
      prototypeMessage = `${movingComponent?.name ?? "生物因子"}已移动。`;
      prototypeMessageIsError = false;
      renderPrototypeEditor(engine.state, true);
    } catch (error) {
      setPrototypeMessage(error.message, true);
    }
    return;
  }

  const beginMoveButton = event.target.closest("[data-begin-move]");
  if (beginMoveButton) {
    movingPlacementId =
      movingPlacementId === beginMoveButton.dataset.beginMove
        ? null
        : beginMoveButton.dataset.beginMove;
    prototypeMessage = movingPlacementId
      ? "请选择带◎的合法目标格。"
      : "已取消移动。";
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const cancelMoveButton = event.target.closest("[data-cancel-move]");
  if (cancelMoveButton) {
    movingPlacementId = null;
    prototypeMessage = "已取消移动。";
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const removePlacementButton = event.target.closest("[data-remove-placement]");
  if (removePlacementButton) {
    const removedId = removePlacementButton.dataset.removePlacement;
    const auxiliaryZoneId = `AUX_${removedId}`;
    const removedPlacement = blueprintDraft.placements.find(
      (item) => item.instanceId === removedId,
    );
    const removedComponent = getComponent(removedPlacement?.contentId);
    const occupiedAuxiliaryZone = blueprintDraft.placements.some(
      (item) => (item.zoneId ?? "BASE") === auxiliaryZoneId,
    );
    if (removedComponent?.requireEmptyAuxOnRemove && occupiedAuxiliaryZone) {
      setPrototypeMessage("必须先清空尸嵌化提供的附加通用区。", true);
      return;
    }
    blueprintDraft.placements = blueprintDraft.placements.filter(
      (item) =>
        item.instanceId !== removedId &&
        (item.zoneId ?? "BASE") !== auxiliaryZoneId,
    );
    if (movingPlacementId === removedId) movingPlacementId = null;
    prototypeMessage = "";
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const editBlueprintButton = event.target.closest("[data-edit-blueprint]");
  if (editBlueprintButton) {
    const blueprint = engine.state.blueprints.find(
      (item) => item.id === editBlueprintButton.dataset.editBlueprint,
    );
    if (!blueprint) return;
    selectedLegendaryBlueprintId = null;
    editingBlueprintId = blueprint.id;
    movingPlacementId = null;
    blueprintDraft = createBlueprintDraftFromBlueprint(blueprint);
    prototypeMessage = `正在二次编辑「${blueprint.name}」。`;
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    document.querySelector("#prototype-content")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return;
  }

  const cancelBlueprintEditButton = event.target.closest(
    "[data-cancel-blueprint-edit]",
  );
  if (cancelBlueprintEditButton) {
    editingBlueprintId = null;
    movingPlacementId = null;
    blueprintDraft = createBlueprintDraft(
      getOrigin(engine.state.base.originId).color,
    );
    prototypeMessage = "已取消二次编辑。";
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const rotatePlacementButton = event.target.closest("[data-rotate-placement]");
  if (rotatePlacementButton) {
    const placement = blueprintDraft.placements.find(
      (item) =>
        item.instanceId === rotatePlacementButton.dataset.rotatePlacement,
    );
    try {
      blueprintDraft = movePlacement(blueprintDraft, placement.instanceId, {
        zoneId: placement.zoneId ?? "BASE",
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation === 90 ? 0 : 90,
      });
      prototypeMessage = "";
      renderPrototypeEditor(engine.state, true);
    } catch (error) {
      setPrototypeMessage(error.message, true);
    }
    return;
  }

  const saveBlueprintButton = event.target.closest("[data-save-blueprint]");
  if (saveBlueprintButton) {
    try {
      const blueprint = editingBlueprintId
        ? engine.updateBlueprint(editingBlueprintId, blueprintDraft)
        : engine.saveBlueprint(blueprintDraft);
      const wasEditing = Boolean(editingBlueprintId);
      editingBlueprintId = null;
      movingPlacementId = null;
      const originColor = getOrigin(engine.state.base.originId).color;
      blueprintDraft = createBlueprintDraft(originColor);
      prototypeMessage = wasEditing
        ? `蓝图「${blueprint.name}」已更新。`
        : `蓝图「${blueprint.name}」已保存，免费原体已实体化。`;
      prototypeMessageIsError = false;
      renderPrototypeEditor(engine.state, true);
    } catch (error) {
      setPrototypeMessage(error.message, true);
    }
    return;
  }

  const rebuildButton = event.target.closest("[data-rebuild-prototype]");
  if (rebuildButton) {
    try {
      engine.rebuildPrototype(rebuildButton.dataset.rebuildPrototype);
      prototypeMessage = "原体重构完成。";
      prototypeMessageIsError = false;
      renderPrototypeEditor(engine.state, true);
    } catch (error) {
      setPrototypeMessage(error.message, true);
    }
    return;
  }

  const disbandLegionButton = event.target.closest(
    "[data-disband-legion]",
  );
  if (disbandLegionButton) {
    const legion = engine.state.legions.find(
      (item) => item.id === disbandLegionButton.dataset.disbandLegion,
    );
    if (
      !legion ||
      !window.confirm(
        `确认解散军团「${legion.name}」？全部${legion.replicaCount ?? 0}名复制体将永久销毁，已经投入的法术力不会返还。原体和蓝图会继续保留。`,
      )
    ) {
      return;
    }
    try {
      engine.disbandLegion(legion.id);
      prototypeMessage = `军团「${legion.name}」已解散；原体返回独立待命状态。`;
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const destroyPrototypeButton = event.target.closest(
    "[data-destroy-prototype]",
  );
  if (destroyPrototypeButton) {
    const prototype = engine.state.prototypes.find(
      (item) =>
        item.id === destroyPrototypeButton.dataset.destroyPrototype,
    );
    const blueprint = engine.state.blueprints.find(
      (item) => item.id === prototype?.blueprintId,
    );
    if (
      !prototype ||
      !blueprint ||
      !window.confirm(
        `确认销毁原体「${prototype.name}」？实体将永久消失，资源不会返还。蓝图会继续保留；以后重新实体化需要支付${blueprint.equivalentValue}[C]。`,
      )
    ) {
      return;
    }
    try {
      engine.destroyPrototype(prototype.id);
      prototypeMessage = `原体「${prototype.name}」已销毁，蓝图仍然保留。`;
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const instantiatePrototypeButton = event.target.closest(
    "[data-instantiate-prototype]",
  );
  if (instantiatePrototypeButton) {
    const blueprint = engine.state.blueprints.find(
      (item) =>
        item.id ===
        instantiatePrototypeButton.dataset.instantiatePrototype,
    );
    if (!blueprint) return;
    try {
      engine.instantiatePrototype(blueprint.id);
      prototypeMessage = `蓝图「${blueprint.name}」的原体已重新实体化。`;
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const deleteBlueprintButton = event.target.closest(
    "[data-delete-blueprint]",
  );
  if (deleteBlueprintButton) {
    const blueprint = engine.state.blueprints.find(
      (item) =>
        item.id === deleteBlueprintButton.dataset.deleteBlueprint,
    );
    if (
      !blueprint ||
      !window.confirm(
        `确认永久删除蓝图「${blueprint.name}」？设计成本不会返还，此操作无法撤销。`,
      )
    ) {
      return;
    }
    try {
      engine.deleteBlueprint(blueprint.id);
      if (editingBlueprintId === blueprint.id) {
        editingBlueprintId = null;
        movingPlacementId = null;
        blueprintDraft = createBlueprintDraft(
          getOrigin(engine.state.base.originId).color,
        );
      }
      prototypeMessage = `蓝图「${blueprint.name}」已永久删除。`;
      prototypeMessageIsError = false;
    } catch (error) {
      prototypeMessage = error.message;
      prototypeMessageIsError = true;
    }
    renderPrototypeEditor(engine.state, true);
    return;
  }

  const queueLegionButton = event.target.closest("[data-queue-legion]");
  if (queueLegionButton) {
    const prototypeId = queueLegionButton.dataset.queueLegion;
    const isReinforcement = engine.state.legions.some(
      (item) => item.prototypeId === prototypeId,
    );
    const scale = document.querySelector(
      `[data-scale-input="${prototypeId}"]`,
    )?.value;
    try {
      engine.queueLegion(prototypeId, Number(scale));
      prototypeMessage = isReinforcement
        ? "军团补充已启动。"
        : "镜映品生产已启动。";
      prototypeMessageIsError = false;
      renderPrototypeEditor(engine.state, true);
    } catch (error) {
      setPrototypeMessage(error.message, true);
    }
    return;
  }

  const buildMetathranButton = event.target.closest("[data-build-metathran]");
  if (buildMetathranButton) {
    try {
      engine.queueMetathran();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const upgradeManaVaultButton = event.target.closest(
    "[data-upgrade-mana-vault]",
  );
  if (upgradeManaVaultButton) {
    try {
      engine.queueManaVaultUpgrade();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const cancelProductionButton = event.target.closest(
    "[data-cancel-production]",
  );
  if (cancelProductionButton) {
    try {
      engine.cancelProduction(cancelProductionButton.dataset.cancelProduction);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const toggleFacilityButton = event.target.closest(
    "[data-toggle-mana-facility]",
  );
  if (toggleFacilityButton) {
    try {
      engine.setManaFacilityEnabled(
        toggleFacilityButton.dataset.toggleManaFacility,
        toggleFacilityButton.dataset.nextEnabled === "true",
      );
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const togglePrismaticButton = event.target.closest(
    "[data-toggle-prismatic]",
  );
  if (togglePrismaticButton) {
    try {
      engine.setPrismaticLensEnabled(
        togglePrismaticButton.dataset.nextEnabled === "true",
      );
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const virtuesRuinButton = event.target.closest(
    "[data-cast-virtues-ruin]",
  );
  if (virtuesRuinButton) {
    try {
      engine.castVirtuesRuin();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const tasteForMayhemButton = event.target.closest(
    "[data-cast-taste-for-mayhem]",
  );
  if (tasteForMayhemButton) {
    try {
      engine.castTasteForMayhem();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const groundedButton = event.target.closest("[data-cast-grounded]");
  if (groundedButton) {
    try {
      engine.castGrounded();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const activateSpaceAnchorButton = event.target.closest(
    "[data-activate-space-anchor]",
  );
  if (activateSpaceAnchorButton) {
    const select = document.querySelector("[data-space-anchor-target]");
    const target = getSpaceAnchorTargets(engine.state).find(
      (item) => item.territoryId === select?.value,
    );
    if (!target) return;
    const output = target.landSummary
      .map((land) => `${land.count}[${land.color}]`)
      .join(" + ");
    if (!window.confirm(
      `确认消耗【空间锚点】，让基地降临现实维度的${target.name}？\n\n新的基本地产出：${output} / 120秒。法术力起源继续运行。空间锚点不会返还。`,
    )) return;
    try {
      engine.activateSpaceAnchor(target.territoryId);
      setTerminalResponse(`基地已降临现实维度：${target.name}。`);
      renderArcanaScreens(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const returnSpaceAnchorButton = event.target.closest(
    "[data-return-space-anchor]",
  );
  if (returnSpaceAnchorButton) {
    if (!window.confirm(
      "确认永久返回亚空间？\n\n领土基本地产出将停止，开局基本地恢复运行。此过程不可逆，已经消耗的【空间锚点】不会返还，也无法再次迁移。",
    )) return;
    try {
      engine.returnBaseToSubspace();
      setTerminalResponse("基地已永久返回亚空间；空间锚点不返还。");
      renderArcanaScreens(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const mapNodeButton = event.target.closest("[data-map-node]");
  if (mapNodeButton) {
    const node = getMapNode(mapNodeButton.dataset.mapNode);
    if (!node) return;
    if (
      !isTestMode(engine.state) &&
      !engine.state.worldMap.discoveredNodeIds.includes(node.id)
    ) {
      return;
    }
    if (node.type === MAP_NODE_TYPES.BASE) {
      setRoute("base");
      setTerminalResponse("已返回亚空间基地。");
      return;
    }
    selectedMapNodeId = node.id;
    const regionTerritories =
      node.type === MAP_NODE_TYPES.REGION
        ? getTerritoriesForRegion(node.id, engine.state)
        : [];
    if (regionTerritories.length) {
      selectedTerritoryId = regionTerritories[0].id;
    }
    mapMessage = "";
    renderMapScreen(engine.state, true);
    return;
  }

  const territoryButton = event.target.closest("[data-territory]");
  if (territoryButton && territoryButton.dataset.status !== "locked") {
    selectedTerritoryId = territoryButton.dataset.territory;
    mapMessage = "";
    renderMapScreen(engine.state, true);
    return;
  }

  const archiveRegionButton = event.target.closest("[data-archive-region]");
  if (archiveRegionButton) {
    const regionId = archiveRegionButton.dataset.archiveRegion;
    const region = getMapNode(regionId);
    if (
      !window.confirm(
        `确认把${region?.name ?? "未知区域"}压缩为毁灭档案？\n\n区域领土将从活动地图移除，之后不能再次远征或刷新；奖励、完成时间、胜利方式和永久后果会保留。`,
      )
    ) return;
    try {
      engine.archiveRegion(regionId);
      mapMessage = "区域已压缩为毁灭档案。";
      mapMessageIsError = false;
      renderMapScreen(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const freezeCelestialButton = event.target.closest(
    "[data-freeze-celestial]",
  );
  if (freezeCelestialButton) {
    try {
      const record = engine.freezeRandomCelestial(
        freezeCelestialButton.dataset.freezeCelestial,
      );
      mapMessage = `${record.name}已固化；生成版本与完整摘要已写入存档。`;
      mapMessageIsError = false;
      renderMapScreen(engine.state, true);
    } catch (error) {
      mapMessage = error.message;
      mapMessageIsError = true;
      renderMapScreen(engine.state, true);
    }
    return;
  }

  const archiveCelestialButton = event.target.closest(
    "[data-archive-celestial]",
  );
  if (archiveCelestialButton) {
    const nodeId = archiveCelestialButton.dataset.archiveCelestial;
    const node = getMapNode(nodeId);
    if (!window.confirm(
      `确认归档${node?.name ?? "未知天体"}？\n\n全部区域毁灭档案会保持只读；不会重复发奖或增加已经登记的世界／星球毁灭计数。`,
    )) return;
    try {
      engine.archiveCelestial(nodeId);
      mapMessage = `${node?.name ?? "未知天体"}已归档。`;
      mapMessageIsError = false;
      renderMapScreen(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const archiveUniverseButton = event.target.closest(
    "[data-archive-universe]",
  );
  if (archiveUniverseButton) {
    const nodeId = archiveUniverseButton.dataset.archiveUniverse;
    if (!window.confirm(
      "确认归档现实纬度宇宙？\n\n全部正式世界与星球档案、以及当前随机观测快照会被封存。该操作不可逆。",
    )) return;
    try {
      engine.archiveUniverse(nodeId);
      mapMessage = "现实纬度宇宙已归档。";
      mapMessageIsError = false;
      renderMapScreen(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const refreshGavonyButton = event.target.closest("[data-refresh-gavony]");
  if (refreshGavonyButton) {
    try {
      engine.refreshGavony();
      mapMessage = "加渥尼挑战已刷新。";
      mapMessageIsError = false;
      renderMapScreen(engine.state, true);
    } catch (error) {
      mapMessage = error.message;
      mapMessageIsError = true;
      renderMapScreen(engine.state, true);
    }
    return;
  }

  const acknowledgeBattleReviewButton = event.target.closest(
    "[data-acknowledge-battle-review]",
  );
  if (acknowledgeBattleReviewButton) {
    engine.acknowledgeBattleReview();
    return;
  }

  const acknowledgeExpeditionResultButton = event.target.closest(
    "[data-acknowledge-expedition-result]",
  );
  if (acknowledgeExpeditionResultButton) {
    engine.acknowledgeExpeditionResult();
    return;
  }

  const commandButton = event.target.closest("[data-expedition-command]");
  if (commandButton) {
    selectedExpeditionCommand = commandButton.dataset.expeditionCommand;
    mapMessage = "";
    renderMapScreen(engine.state, true);
    return;
  }

  const mapReinforceButton = event.target.closest("[data-map-reinforce]");
  if (mapReinforceButton) {
    const prototypeId = mapReinforceButton.dataset.mapReinforce;
    const scale = Number(
      document.querySelector(
        `[data-map-reinforcement-input="${prototypeId}"]`,
      )?.value,
    );
    const prototype = engine.state.prototypes.find(
      (item) => item.id === prototypeId,
    );
    const blueprint = engine.state.blueprints.find(
      (item) => item.id === prototype?.blueprintId,
    );
    try {
      engine.queueLegion(prototypeId, scale);
      const replicaCount =
        scale * (blueprint?.replicasPerScaleHp ?? 0);
      mapMessage = `已将${replicaCount}名复制体加入生产队列；补充完成前该军团不可远征。`;
      mapMessageIsError = false;
    } catch (error) {
      mapMessage = error.message;
      mapMessageIsError = true;
    }
    renderMapScreen(engine.state, true);
    return;
  }

  const startExpeditionButton = event.target.closest("[data-start-expedition]");
  if (startExpeditionButton) {
    try {
      const selectedLegendaryPrototype =
        engine.state.legendaryPrototypes.find(
          (item) => item.id === selectedLegionId,
        );
      const selectedSoloPrototype = engine.state.prototypes.find(
        (item) => {
          if (item.id !== selectedLegionId) return false;
          const blueprint = engine.state.blueprints.find(
            (entry) => entry.id === item.blueprintId,
          );
          return blueprint?.legendary && !blueprint.legendaryOrigin;
        },
      );
      engine.startExpedition(
        selectedTerritoryId,
        selectedLegendaryPrototype || selectedSoloPrototype
          ? null
          : selectedLegionId,
        selectedExpeditionCommand,
        {
          legendaryPrototypeId:
            selectedLegendaryPrototype?.id ?? null,
          prototypeId: selectedSoloPrototype?.id ?? null,
          commanderLegendaryPrototypeId:
            selectedLegendaryPrototype || selectedSoloPrototype
              ? null
              : selectedCommanderLegendaryId,
        },
      );
      mapMessage = "";
      mapMessageIsError = false;
      setRoute("expedition");
      renderExpeditionScreen(engine.state, true);
    } catch (error) {
      mapMessage = error.message;
      mapMessageIsError = true;
      renderMapScreen(engine.state, true);
    }
    return;
  }

  const speedButton = event.target.closest("[data-expedition-speed]");
  if (speedButton) {
    engine.setExpeditionSpeed(Number(speedButton.dataset.expeditionSpeed));
    renderExpeditionScreen(engine.state, true);
    return;
  }

  const activateBloodFeastButton = event.target.closest(
    "[data-activate-olivia-blood-feast]",
  );
  if (activateBloodFeastButton) {
    try {
      engine.activateOliviaBloodFeast();
    } catch (error) {
      window.alert(error.message);
    }
    renderExpeditionScreen(engine.state, true);
    return;
  }

  const skipBloodFeastButton = event.target.closest(
    "[data-skip-olivia-blood-feast]",
  );
  if (skipBloodFeastButton) {
    try {
      engine.skipOliviaBloodFeast();
    } catch (error) {
      window.alert(error.message);
    }
    renderExpeditionScreen(engine.state, true);
    return;
  }

  const unsummonButton = event.target.closest("[data-unsummon]");
  if (unsummonButton) {
    try {
      engine.unsummon();
      renderExpeditionScreen(engine.state, true);
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  const acceptExecutionButton = event.target.closest("[data-accept-execution]");
  if (acceptExecutionButton) {
    if (
      !window.confirm(
        "确认放弃救援？原体将被处决，之后需要按蓝图价值支付[C]重构。",
      )
    ) {
      return;
    }
    engine.acceptExecution();
    renderExpeditionScreen(engine.state, true);
    return;
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) {
    document.querySelector(`#${closeButton.dataset.closeDialog}`)?.close();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  switch (actionButton.dataset.action) {
    case "manual-save":
      engine.saveManual();
      setSaveMessage("本地存档完成。");
      break;
    case "export-save":
      downloadSave();
      break;
    case "import-save":
      document.querySelector("#save-file-input").click();
      break;
    case "prepare-new-game":
      document.querySelector("#save-dialog").close();
      showNewGameDialog(true);
      break;
  }
});

document.querySelector("#effects-toggle")?.addEventListener("click", (event) => {
  const nextEnabled = document.body.classList.contains("effects-off");
  document.body.classList.toggle("effects-off", !nextEnabled);
  event.currentTarget.classList.toggle("is-active", !nextEnabled);
  event.currentTarget.setAttribute("aria-pressed", nextEnabled ? "false" : "true");
  engine.setEffectsEnabled(nextEnabled);
});

document.querySelector("#save-menu-button")?.addEventListener("click", openSaveDialog);

document.querySelector("#execution-warning-mode")?.addEventListener("change", (event) => {
  engine.setExecutionWarningMode(event.target.value);
  setSaveMessage("处决警告方式已保存。");
});

document.querySelector("#battle-end-pause")?.addEventListener("change", (event) => {
  engine.setPauseAfterCombat(event.target.value === "true");
  setSaveMessage("战斗结束暂停设置已保存。");
});

document.querySelector("#mana-display-mode")?.addEventListener("change", (event) => {
  engine.setManaDisplayMode(event.target.value);
  setSaveMessage(
    event.target.value === "LETTER"
      ? "法术力已切换为字母显示。"
      : "法术力已切换为正常符号。",
  );
});

document.querySelector("#theme-select")?.addEventListener("change", (event) => {
  engine.setThemeId(event.target.value);
  const theme = UI_THEMES.find((item) => item.id === event.target.value);
  setSaveMessage(`界面配色已切换为「${theme?.name ?? event.target.value}」。`);
});

document.querySelector("#test-mode-toggle")?.addEventListener("change", (event) => {
  engine.setTestMode(event.target.checked);
  setSaveMessage(
    event.target.checked
      ? "测试模式已开启：档案全解锁、免费消耗、2秒生产与收集；剧情神器不会自动实体化。"
      : "测试模式已关闭，恢复正常规则。",
  );
});

document.querySelector("#new-game-form")?.addEventListener("change", updateOpeningSummary);

document.querySelector("#command-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#command-input");
  const rawInput = input.value;
  const parsed = parseTerminalInput(rawInput);
  if (parsed.kind === "EMPTY") return;
  commandHistory.push(rawInput.trim());
  commandHistory = commandHistory.slice(-30);
  commandHistoryIndex = commandHistory.length;
  input.value = "";
  executeTerminalCommand(parsed);
});

document.querySelector("#command-input")?.addEventListener("keydown", (event) => {
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  if (!commandHistory.length) return;
  if (event.key === "ArrowUp") {
    commandHistoryIndex = Math.max(0, commandHistoryIndex - 1);
    event.currentTarget.value = commandHistory[commandHistoryIndex];
  } else {
    commandHistoryIndex = Math.min(
      commandHistory.length,
      commandHistoryIndex + 1,
    );
    event.currentTarget.value =
      commandHistoryIndex === commandHistory.length
        ? ""
        : commandHistory[commandHistoryIndex];
  }
  event.currentTarget.setSelectionRange(
    event.currentTarget.value.length,
    event.currentTarget.value.length,
  );
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-factor-search]")) {
    const filterRoot =
      event.target.closest("#prototype-content, #biofactors-content") ??
      document;
    if (filterRoot.id === "biofactors-content") {
      biofactorCatalogSearchQuery = event.target.value;
    } else {
      factorSearchQuery = event.target.value;
    }
    applyBiofactorFilters(filterRoot);
    return;
  }
  if (event.target.matches("[data-blueprint-name]")) {
    blueprintDraft.name = event.target.value;
    document.querySelector(
      "#prototype-content .prototype-grid",
    )?.closest(".panel")?.querySelector(".panel-title")?.replaceChildren(
      event.target.value || "未命名原体",
    );
    return;
  }
  if (event.target.matches("[data-scale-input]")) {
    const prototypeId = event.target.dataset.scaleInput;
    const prototype = engine.state?.prototypes.find(
      (item) => item.id === prototypeId,
    );
    const blueprint = engine.state?.blueprints.find(
      (item) => item.id === prototype?.blueprintId,
    );
    if (!blueprint) return;
    const scale = Number(event.target.value);
    setAllText(`[data-scale-output="${prototypeId}"]`, String(scale));
    setAllText(
      `[data-scale-summary="${prototypeId}"]`,
      `${scale * blueprint.replicasPerScaleHp}人 / ${scale * blueprint.scaleHpCost}[C]`,
    );
    return;
  }
  if (event.target.matches("[data-map-reinforcement-input]")) {
    const prototypeId = event.target.dataset.mapReinforcementInput;
    const scale = Number(event.target.value);
    const replicasPerScale = Number(event.target.dataset.replicasPerScale);
    const scaleCost = Number(event.target.dataset.scaleCost);
    const replicaCount = scale * replicasPerScale;
    setAllText(
      `[data-map-reinforcement-output="${prototypeId}"]`,
      `${replicaCount}人（+${scale}军团生命）`,
    );
    const button = document.querySelector(
      `[data-map-reinforce="${prototypeId}"]`,
    );
    if (button) {
      button.dataset.mapReinforcementCost = String(scale * scaleCost);
      button.textContent = `补充${replicaCount}人 · ${
        isTestMode(engine.state) ? "测试模式免费" : `${scale * scaleCost}[C]`
      }`;
      updateMapReinforcementAvailability(engine.state);
    }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-blueprint-legendary]")) {
    selectedLegendaryBlueprintId = event.target.value || null;
    editingBlueprintId = null;
    movingPlacementId = null;
    prototypeMessage = selectedLegendaryBlueprintId
      ? "已切换至传奇蓝图；身份字段已锁定，因子配置会立即保存。"
      : "已切换至普通蓝图编辑。";
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }
  if (event.target.matches("[data-resident-select]")) {
    try {
      engine.selectResident(event.target.value);
    } catch (error) {
      setTerminalResponse(
        error.message,
        "SYSTEM // 驻留者链路",
        "warning",
      );
      renderBaseContext(engine.state);
    }
    return;
  }
  if (event.target.matches("[data-blueprint-race]")) {
    const nextRace = getRace(event.target.value);
    blueprintDraft.raceId = nextRace.id;
    blueprintDraft.raceColor = nextRace.availableColors.includes(
      getOrigin(engine.state.base.originId).color,
    )
      ? getOrigin(engine.state.base.originId).color
      : nextRace.availableColors[0];
    blueprintDraft.placements = [];
    movingPlacementId = null;
    prototypeMessage = "更换种族后已清空拓展格。";
    prototypeMessageIsError = false;
    renderPrototypeEditor(engine.state, true);
    return;
  }
  if (event.target.matches("[data-blueprint-race-color]")) {
    blueprintDraft.raceColor = event.target.value;
    renderPrototypeEditor(engine.state, true);
    return;
  }
  if (event.target.matches("[data-blueprint-job]")) {
    const nextJob = getJob(event.target.value);
    blueprintDraft.jobId = nextJob.id;
    blueprintDraft.jobColor = nextJob.availableColors[0] ?? null;
    renderPrototypeEditor(engine.state, true);
    return;
  }
  if (event.target.matches("[data-blueprint-job-color]")) {
    blueprintDraft.jobColor = event.target.value;
    renderPrototypeEditor(engine.state, true);
    return;
  }
  if (event.target.matches("[data-expedition-legion]")) {
    selectedLegionId = event.target.value;
    selectedCommanderLegendaryId = null;
    mapMessage = "";
    renderMapScreen(engine.state, true);
    return;
  }
  if (event.target.matches("[data-expedition-commander]")) {
    selectedCommanderLegendaryId = event.target.value || null;
    mapMessage = "";
    renderMapScreen(engine.state, true);
    return;
  }
  if (event.target.matches("[data-mana-production-slot]")) {
    try {
      engine.assignManaProductionSlotGroup(
        Number(event.target.dataset.manaProductionSlot),
        event.target.value || null,
      );
    } catch (error) {
      window.alert(error.message);
      renderBaseRuntime(engine.state);
    }
    return;
  }
  if (event.target.matches("[data-prismatic-color]")) {
    try {
      engine.setPrismaticLensColor(event.target.value);
    } catch (error) {
      window.alert(error.message);
    }
  }
});

document.querySelector("#new-game-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const dialog = document.querySelector("#new-game-dialog");
  if (submitter?.value === "cancel") {
    if (engine.state) dialog.close();
    return;
  }

  const formData = new FormData(event.currentTarget);
  engine.startNewGame(formData.get("originId"), formData.get("landId"));
  selectedLegendaryBlueprintId = null;
  editingBlueprintId = null;
  movingPlacementId = null;
  blueprintDraft = createBlueprintDraft(
    getOrigin(engine.state.base.originId).color,
  );
  prototypeMessage = "";
  prototypeStateSignature = "";
  renderPrototypeEditor(engine.state, true);
  const savedSettings = storage.loadSettings();
  if (savedSettings.effectsEnabled === false) {
    engine.setEffectsEnabled(false);
  }
  if (
    ["PAUSE", "PAUSE_60", "CONTINUE"].includes(
      savedSettings.executionWarningMode,
    )
  ) {
    engine.setExecutionWarningMode(savedSettings.executionWarningMode);
  }
  if (typeof savedSettings.pauseAfterCombat === "boolean") {
    engine.setPauseAfterCombat(savedSettings.pauseAfterCombat);
  }
  if (typeof savedSettings.testMode === "boolean") {
    engine.setTestMode(savedSettings.testMode);
  }
  if (["SYMBOL", "LETTER"].includes(savedSettings.manaDisplayMode)) {
    engine.setManaDisplayMode(savedSettings.manaDisplayMode);
  }
  if (UI_THEME_IDS.includes(savedSettings.themeId)) {
    engine.setThemeId(savedSettings.themeId);
  }
  dialog.close();
  setRoute("base");
  showOpeningNarrative();
});

document.querySelector("#new-game-dialog")?.addEventListener("cancel", (event) => {
  if (!engine.state) event.preventDefault();
});

document.querySelector("#startup-cover-dialog")?.addEventListener("cancel", (event) => {
  event.preventDefault();
  skipStartupCoverAnimation();
});

document.querySelector("#startup-cover-dialog")?.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("button")) skipStartupCoverAnimation();
});

document.querySelector("#startup-cover-dialog")?.addEventListener("keydown", (event) => {
  const shell = event.currentTarget.querySelector(".startup-cover-shell");
  event.stopPropagation();
  if (shell?.classList.contains("is-skipped")) return;
  event.preventDefault();
  skipStartupCoverAnimation();
});

document.querySelector("[data-startup-new]")?.addEventListener("click", () => {
  document.querySelector("#startup-cover-dialog")?.close();
  showNewGameDialog(Boolean(engine.state));
});

document.querySelector("[data-startup-continue]")?.addEventListener("click", () => {
  document.querySelector("#startup-cover-dialog")?.close();
});

document.querySelector("#save-file-input")?.addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const [file] = input.files;
  if (!file) return;
  try {
    engine.importJson(await file.text());
    selectedLegendaryBlueprintId = null;
    editingBlueprintId = null;
    movingPlacementId = null;
    setSaveMessage(`已载入：${file.name}`);
  } catch (error) {
    setSaveMessage(error.message, true);
  } finally {
    input.value = "";
  }
});

document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  if (event.key === "/") {
    event.preventDefault();
    document.querySelector("#command-input")?.focus();
    return;
  }
  if (event.key === "?") {
    setTerminalResponse(terminalHelpText(), "SYSTEM // 指令索引");
    return;
  }
  if (event.key === "Escape") {
    setMobileNavExpanded(false);
    return;
  }
  const item = navItems.find((navItem) => navItem.key === event.key);
  if (item) setRoute(item.id);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pageIsPaused = true;
    engine.tick();
    engine.persist();
  } else {
    pageIsPaused = false;
    engine.settleAfterPause();
  }
});

window.addEventListener("beforeunload", () => {
  engine.tick();
  engine.persist();
});

engine.subscribe(updateStateUI);
if (engine.state) updateStateUI(engine.state);

setInterval(() => {
  if (!pageIsPaused) engine.tick();
}, 500);

setRoute(activeRoute);
if (!engine.state) {
  const savedSettings = storage.loadSettings();
  if (savedSettings.effectsEnabled === false) {
    document.body.classList.add("effects-off");
  }
  document.body.classList.toggle(
    "mana-display-letters",
    savedSettings.manaDisplayMode === "LETTER",
  );
}
showStartupCover();
