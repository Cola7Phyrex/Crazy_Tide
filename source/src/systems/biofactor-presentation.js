import { ABILITIES } from "../data/prototype-data.js";

const STAT_LABELS = {
  power: "力量",
  defense: "防御",
  hp: "生命",
};

const STAT_FILTERS = {
  power: "POWER",
  defense: "DEFENSE",
  hp: "HP",
};

const FIELD_LABELS = {
  form: "形态",
  material: "材质",
  artifact: "神器",
  intelligent: "智力",
  canCommunicate: "语言",
  professionCompatible: "职业兼容",
  legendary: "传奇",
};

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatFieldValue(value) {
  if (value === true) return "有";
  if (value === false) return "无";
  return String(value);
}

export function isLegendaryBiofactor(content) {
  return Boolean(
    content?.legendary === true ||
      content?.fields?.legendary === true ||
      content?.fieldChanges?.legendary === true ||
      content?.tags?.some((tag) => tag === "传奇" || tag === "LEGENDARY"),
  );
}

export function getBiofactorEffectItems(content) {
  const items = [];
  for (const [stat, label] of Object.entries(STAT_LABELS)) {
    const value = Number(content?.stats?.[stat] ?? 0);
    if (value !== 0) {
      items.push({
        tag: STAT_FILTERS[stat],
        label: `${label}${formatSigned(value)}`,
      });
    }
  }
  for (const abilityId of content?.abilities ?? []) {
    const ability = ABILITIES[abilityId];
    const abilityName = ability?.name ?? "未知异能";
    items.push({
      tag: "ABILITY",
      label: `异能：${abilityName}`,
    });
  }
  for (const [field, value] of Object.entries(
    content?.fieldChanges ?? {},
  )) {
    items.push({
      tag: "FIELD",
      label: `${FIELD_LABELS[field] ?? field}→${formatFieldValue(value)}`,
    });
  }
  if (isLegendaryBiofactor(content)) {
    items.push({ tag: "LEGENDARY", label: "传奇" });
  }
  return items;
}

export function getBiofactorEffectTags(content) {
  return [...new Set(getBiofactorEffectItems(content).map((item) => item.tag))];
}

export function getBiofactorRequirementSummary(content) {
  const requirements = Object.entries(content?.requirements ?? {});
  if (!requirements.length) return "";
  return requirements
    .map(
      ([field, value]) =>
        `${FIELD_LABELS[field] ?? field}=${formatFieldValue(value)}`,
    )
    .join("、");
}

export function getBiofactorSearchText(content) {
  const abilityText = (content?.abilities ?? [])
    .flatMap((id) => [
      id,
      ABILITIES[id]?.name ?? "",
      ABILITIES[id]?.description ?? "",
    ])
    .join(" ");
  return [
    content?.id,
    content?.name,
    content?.englishName,
    content?.category,
    content?.subcategory,
    content?.description,
    getBiofactorRequirementSummary(content),
    getBiofactorEffectItems(content)
      .map((item) => item.label)
      .join(" "),
    ...(content?.tags ?? []),
    abilityText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

export function matchesBiofactorFilters(
  content,
  { query = "", type = "ALL", effect = "ALL" } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const typeMatches =
    type === "ALL" || content.biofactorType === type;
  const effectMatches =
    effect === "ALL" || getBiofactorEffectTags(content).includes(effect);
  const searchMatches =
    !normalizedQuery ||
    getBiofactorSearchText(content).includes(normalizedQuery);
  return typeMatches && effectMatches && searchMatches;
}
