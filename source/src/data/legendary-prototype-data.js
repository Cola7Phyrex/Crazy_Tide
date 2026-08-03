export const OLIVIA_BLUEPRINT_ID =
  "LEGENDARY_BLUEPRINT_OLIVIA_VOLDAREN";
export const OLIVIA_IDENTITY_ID =
  "LEGENDARY_IDENTITY_OLIVIA_VOLDAREN";

export const LEGENDARY_PROTOTYPE_CATALOG = Object.freeze([
  Object.freeze({
    id: OLIVIA_BLUEPRINT_ID,
    identityId: OLIVIA_IDENTITY_ID,
    name: "奥莉薇亚·沃达连",
    englishName: "Olivia Voldaren",
    raceId: "RACE_VAMPIRE",
    colors: ["B", "R"],
    designCost: Object.freeze({
      W: 0,
      U: 0,
      B: 3,
      R: 3,
      G: 0,
      C: 0,
    }),
    equivalentValue: 1200,
    stats: Object.freeze({ power: 4, defense: 4, hp: 5 }),
    lp: Object.freeze({
      base: 3,
      max: 6,
      restIntervalMs: 60000,
    }),
    activeAbilities: Object.freeze([
      Object.freeze({
        abilityId: "ABILITY_OLIVIA_BLOOD_FEAST",
        window: "COMBAT_ROUND_AFTER_HP_DAMAGE",
        lpCost: 2,
        target: "DAMAGED_LIVING_ENEMY",
        pauseForChoice: false,
      }),
    ]),
    abilities: Object.freeze([
      "ABILITY_VAMPIRE_BLOODTHIRST",
      "ABILITY_VAMPIRE_WHITE_DAMAGE_PLUS_1",
      "ABILITY_VAMPIRE_SCALE_LIMIT",
      "ABILITY_FLYING",
      "ABILITY_OLIVIA_BLOOD_FEAST",
      "ABILITY_OLIVIA_DRINK_THE_LAST",
    ]),
    commanderCost: Object.freeze({ B: 1, R: 1 }),
    commanderAbility: "ABILITY_OLIVIA_COMMANDER",
    commander: Object.freeze({
      cost: Object.freeze({ B: 1, R: 1 }),
      abilityId: "ABILITY_OLIVIA_COMMANDER",
      effect: "EXPEDITION_POWER_AFTER_HP_DAMAGE",
      power: 1,
      oncePerExpedition: true,
      contributesToFortitude: false,
    }),
    replicationPolicy: "FORBIDDEN",
    currentEntityCap: 1,
    legendary: true,
    legendaryOrigin: true,
    intrinsicPlacements: Object.freeze([]),
    grid: Object.freeze({
      width: 2,
      height: 2,
      equipmentZone: Object.freeze({
        id: "LEGENDARY_EQUIPMENT",
        width: 1,
        height: 1,
      }),
    }),
    growth: Object.freeze({
      directKills: 100,
      commanderTriggers: 100,
      expeditionsCompleted: 50,
      nodes: Object.freeze([
        Object.freeze({
          id: "OLIVIA_POWER_I",
          metric: "directKills",
          threshold: 100,
          effects: Object.freeze({ power: 1 }),
        }),
        Object.freeze({
          id: "OLIVIA_LP_I",
          metric: "commanderTriggers",
          threshold: 100,
          effects: Object.freeze({ baseLp: 1, maxLp: 1 }),
        }),
        Object.freeze({
          id: "OLIVIA_HP_I",
          metric: "expeditionsCompleted",
          threshold: 50,
          effects: Object.freeze({ hp: 1 }),
        }),
      ]),
    }),
    unlockTerritoryId: "TERRITORY_VOLDAREN_ESTATE",
  }),
]);

export function getLegendaryPrototypeDefinition(id) {
  return LEGENDARY_PROTOTYPE_CATALOG.find((item) => item.id === id);
}
