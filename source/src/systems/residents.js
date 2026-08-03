import {
  RESIDENT_CATALOG,
  RESIDENT_LILITH_ID,
  RESIDENT_OLIVIA_ID,
  getResident,
} from "../data/resident-data.js";
import {
  OLIVIA_BLUEPRINT_ID,
  OLIVIA_IDENTITY_ID,
} from "../data/legendary-prototype-data.js";

export function createResidentProgressState() {
  return {
    knownResidentIds: [RESIDENT_LILITH_ID],
    selectedResidentId: RESIDENT_LILITH_ID,
    interactionCount: 0,
    lastDialogueId: null,
    seenDialogueIds: [],
    lastSpokenAt: null,
  };
}

export function normalizeResidentProgress(progress = {}) {
  const defaults = createResidentProgressState();
  return {
    knownResidentIds: Array.from(
      new Set([
        ...defaults.knownResidentIds,
        ...(Array.isArray(progress.knownResidentIds)
          ? progress.knownResidentIds
          : []),
      ]),
    ),
    selectedResidentId:
      typeof progress.selectedResidentId === "string"
        ? progress.selectedResidentId
        : defaults.selectedResidentId,
    interactionCount: Number.isFinite(progress.interactionCount)
      ? Math.max(0, Math.floor(progress.interactionCount))
      : 0,
    lastDialogueId:
      typeof progress.lastDialogueId === "string"
        ? progress.lastDialogueId
        : null,
    seenDialogueIds: Array.isArray(progress.seenDialogueIds)
      ? Array.from(new Set(progress.seenDialogueIds.filter((id) => typeof id === "string")))
      : [],
    lastSpokenAt: Number.isFinite(progress.lastSpokenAt)
      ? progress.lastSpokenAt
      : null,
  };
}

export function getAvailableResidents(state) {
  const progress = normalizeResidentProgress(state?.residentProgress);
  const oliviaAvailable =
    progress.knownResidentIds.includes(RESIDENT_OLIVIA_ID) ||
    state?.rewardProgress?.unlockedContentIds?.includes(OLIVIA_BLUEPRINT_ID) ||
    state?.legendaryBlueprints?.some(
      (blueprint) => blueprint.id === OLIVIA_BLUEPRINT_ID,
    ) ||
    state?.legendaryIdentities?.some(
      (identity) => identity.id === OLIVIA_IDENTITY_ID,
    ) ||
    state?.legendaryPrototypes?.some(
      (prototype) => prototype.blueprintId === OLIVIA_BLUEPRINT_ID,
    );
  return [
    getResident(RESIDENT_LILITH_ID),
    ...(oliviaAvailable ? [getResident(RESIDENT_OLIVIA_ID)] : []),
  ].filter(Boolean);
}

export function selectResident(state, residentId) {
  const resident = getAvailableResidents(state).find(
    (item) => item.id === residentId,
  );
  if (!resident) throw new Error("这名角色当前没有接入基地通讯");
  const progress = normalizeResidentProgress(state.residentProgress);
  return {
    ...state,
    residentProgress: {
      ...progress,
      knownResidentIds: Array.from(
        new Set([...progress.knownResidentIds, resident.id]),
      ),
      selectedResidentId: resident.id,
    },
  };
}

export function getResidentContextTags(
  state,
  residentId = RESIDENT_LILITH_ID,
) {
  const tags = [];
  const progress = normalizeResidentProgress(state.residentProgress);
  const resident = getResident(residentId);
  const hasSpokenToResident = resident?.dialogue.some((line) =>
    progress.seenDialogueIds.includes(line.id),
  );
  if (!hasSpokenToResident) tags.push("FIRST_CONTACT");
  const expedition = state.activeExpedition;
  if (expedition?.phase === "EXECUTION_WARNING") {
    tags.push("EXECUTION_WARNING");
  }
  if (
    expedition?.command === "INFILTRATION" ||
    expedition?.phase === "INFILTRATING"
  ) {
    tags.push("INFILTRATION_ACTIVE");
  }
  if (expedition) tags.push("EXPEDITION_ACTIVE");
  if ((state.productionQueue?.length ?? 0) > 0) {
    tags.push("PRODUCTION_ACTIVE");
  }
  const nearCapColors = Object.keys(state.resources?.amounts ?? {}).filter((color) => {
    const cap = Number(state.resources?.caps?.[color] ?? 0);
    return cap > 0 && Number(state.resources.amounts[color] ?? 0) / cap >= 0.8;
  });
  if (nearCapColors.length > 0) tags.push("MANA_NEAR_CAP");
  if (nearCapColors.includes("C")) tags.push("COLORLESS_MANA_NEAR_CAP");
  if (nearCapColors.some((color) => color !== "C")) {
    tags.push("COLORED_MANA_NEAR_CAP");
  }
  if ((state.blueprints?.length ?? 0) === 0) tags.push("NO_BLUEPRINTS");
  if (state.prototypes?.some((prototype) => prototype.status === "DEAD")) {
    tags.push("PROTOTYPE_DEAD");
  } else if (
    state.prototypes?.some((prototype) => prototype.status === "READY")
  ) {
    tags.push("PROTOTYPE_READY");
  }
  if (
    !expedition &&
    state.legions?.some((legion) => Number(legion.currentHp ?? 0) > 0)
  ) {
    tags.push("LEGION_READY");
  }
  if (state.lastExpedition?.outcome === "SUCCESS") {
    tags.push("LAST_EXPEDITION_SUCCESS");
  } else if (state.lastExpedition?.outcome === "FAILURE") {
    tags.push("LAST_EXPEDITION_FAILURE");
  }
  if ((state.rewardProgress?.ledger?.length ?? 0) > 0) {
    tags.push("REWARD_HISTORY");
  }
  if (state.flags?.gavonyFirstConquered) tags.push("GAVONY_COMPLETE");
  if (state.flags?.firstVillageConquered) {
    tags.push("FIRST_TERRITORY_COMPLETE");
  }
  if (!expedition && (state.productionQueue?.length ?? 0) === 0) {
    tags.push("BASE_IDLE");
  }
  return tags;
}

export function getResidentCurrentLine(state, residentId = RESIDENT_LILITH_ID) {
  const resident = getResident(residentId);
  if (!resident) return "";
  const progress = normalizeResidentProgress(state.residentProgress);
  return (
    resident.dialogue.find((line) => line.id === progress.lastDialogueId)?.text ??
    resident.defaultLine
  );
}

function normalizeResidentArgument(resident, argument) {
  let query = String(argument ?? "").trim();
  const aliases = [...resident.aliases].sort((a, b) => b.length - a.length);
  const addressedBy = aliases.find(
    (alias) =>
      query.toLowerCase() === alias.toLowerCase() ||
      query.toLowerCase().startsWith(`${alias.toLowerCase()} `),
  );
  if (addressedBy) query = query.slice(addressedBy.length).trim();
  return query;
}

function getDialogueCandidates(state, resident, query) {
  if (query) {
    const keywordMatches = resident.dialogue.filter((line) =>
      line.keywords?.some((keyword) =>
        query.toLowerCase().includes(keyword.toLowerCase()),
      ),
    );
    if (keywordMatches.length > 0) {
      const highestPriority = Math.max(
        ...keywordMatches.map((line) => line.priority ?? 0),
      );
      return keywordMatches.filter(
        (line) => (line.priority ?? 0) === highestPriority,
      );
    }
  }

  const contextTags = new Set(getResidentContextTags(state, resident.id));
  const contextMatches = resident.dialogue.filter(
    (line) =>
      (line.contexts?.length ?? 0) > 0 &&
      line.contexts.every((context) => contextTags.has(context)),
  );
  const getHighestPriorityLines = (lines) => {
    const highestPriority = Math.max(
      0,
      ...lines.map((line) => line.priority ?? 0),
    );
    return lines.filter(
      (line) => (line.priority ?? 0) === highestPriority,
    );
  };
  const highestPriorityLines = getHighestPriorityLines(contextMatches);
  const highestPriority = highestPriorityLines[0]?.priority ?? 0;
  if (highestPriority >= 100) return highestPriorityLines;

  const progress = normalizeResidentProgress(state.residentProgress);
  const lastLine = resident.dialogue.find(
    (line) => line.id === progress.lastDialogueId,
  );
  const lastContexts = new Set(lastLine?.contexts ?? []);
  const alternativeContexts = contextMatches.filter(
    (line) =>
      (line.contexts?.length ?? 0) > 0 &&
      line.contexts.every((context) => !lastContexts.has(context)),
  );
  return alternativeContexts.length > 0
    ? getHighestPriorityLines(alternativeContexts)
    : highestPriorityLines;
}

export function talkToResident(
  state,
  {
    residentId = null,
    argument = "",
    now = Date.now(),
  } = {},
) {
  const availableResidents = getAvailableResidents(state);
  const progress = normalizeResidentProgress(state.residentProgress);
  let query = String(argument ?? "").trim();
  let resolvedResidentId = residentId;
  if (!resolvedResidentId) {
    const addressedResident = RESIDENT_CATALOG.find((candidate) =>
      [...candidate.aliases]
        .sort((a, b) => b.length - a.length)
        .some(
          (alias) =>
            query.toLowerCase() === alias.toLowerCase() ||
            query.toLowerCase().startsWith(`${alias.toLowerCase()} `),
        ),
    );
    resolvedResidentId =
      addressedResident?.id ??
      (availableResidents.some(
        (candidate) => candidate.id === progress.selectedResidentId,
      )
        ? progress.selectedResidentId
        : RESIDENT_LILITH_ID);
  }
  const resident = availableResidents.find(
    (candidate) => candidate.id === resolvedResidentId,
  );
  if (!resident) {
    const unavailableResident = getResident(resolvedResidentId);
    if (unavailableResident) {
      throw new Error(`${unavailableResident.shortName ?? unavailableResident.name}尚未接入基地通讯`);
    }
    throw new Error("基地中没有这名驻留者");
  }

  query = normalizeResidentArgument(resident, query);
  let candidates = getDialogueCandidates(state, resident, query);
  if (candidates.length === 0) {
    candidates = resident.dialogue.filter((line) =>
      line.contexts?.includes("BASE_IDLE"),
    );
  }
  const nonRepeating = candidates.filter(
    (line) => line.id !== progress.lastDialogueId,
  );
  const pool = nonRepeating.length > 0 ? nonRepeating : candidates;
  const selected =
    pool[progress.interactionCount % Math.max(1, pool.length)] ?? {
      id: "LILITH_DEFAULT",
      text: resident.defaultLine,
    };
  const nextProgress = {
    ...progress,
    knownResidentIds: Array.from(
      new Set([...progress.knownResidentIds, resident.id]),
    ),
    selectedResidentId: resident.id,
    interactionCount: progress.interactionCount + 1,
    lastDialogueId: selected.id,
    seenDialogueIds: Array.from(
      new Set([...progress.seenDialogueIds, selected.id]),
    ),
    lastSpokenAt: now,
  };

  return {
    state: {
      ...state,
      residentProgress: nextProgress,
    },
    resident,
    dialogue: selected,
  };
}
