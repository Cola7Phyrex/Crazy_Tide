import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state/initial-state.js";
import {
  createBlueprintDraft,
  createBlueprintDraftFromBlueprint,
  deriveBlueprint,
  findFirstPlacement,
  inspectGrid,
  movePlacement,
} from "../src/systems/blueprints.js";
import {
  deleteBlueprint,
  destroyPrototype,
  disbandLegion,
  instantiatePrototype,
  markPrototypeDead,
  rebuildPrototype,
  saveNewBlueprint,
  updateExistingBlueprint,
} from "../src/systems/prototypes.js";

function whiteState() {
  return createInitialState({
    originId: "ORIGIN_W",
    landId: "LAND_PLAINS",
    now: 1000,
    gameId: "CT-TEST-BLUEPRINT",
  });
}

test("人类、战士和青铜剑得到文档规定的成本、属性与价值", () => {
  const state = whiteState();
  const draft = createBlueprintDraft("W");
  draft.jobId = "JOB_WARRIOR";
  const position = findFirstPlacement(draft, "EQUIPMENT_BRONZE_SWORD");
  draft.name = "边境战士";
  draft.placements.push({
    instanceId: "PLACEMENT_SWORD",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    ...position,
  });

  const result = deriveBlueprint(draft, state);
  assert.equal(result.valid, true);
  assert.deepEqual(result.stats, { power: 2, defense: 2, hp: 6 });
  assert.equal(result.designCost.W, 1);
  assert.equal(result.designCost.C, 200);
  assert.equal(result.equivalentValue, 400);
  assert.equal(result.scaleHpCost, 200);
  assert.deepEqual(result.colors, ["W"]);
});

test("拓展格拒绝越界与重叠部件", () => {
  const state = whiteState();
  const draft = createBlueprintDraft("W");
  draft.placements = [
    {
      instanceId: "ONE",
      contentId: "EQUIPMENT_GREATSWORD",
      x: 0,
      y: 0,
      rotation: 0,
    },
    {
      instanceId: "TWO",
      contentId: "EQUIPMENT_BRONZE_SWORD",
      x: 0,
      y: 1,
      rotation: 0,
    },
  ];
  const result = deriveBlueprint(draft, state);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" / "), /重叠/);
});

test("精怪可以把巨剑旋转为2×1后合法安装", () => {
  const state = whiteState();
  const draft = createBlueprintDraft("W");
  draft.raceId = "RACE_SPIRIT";
  draft.raceColor = "W";
  draft.jobId = "JOB_WARRIOR";
    const position =
      findFirstPlacement(draft, "EQUIPMENT_GREATSWORD", 0) ??
      findFirstPlacement(draft, "EQUIPMENT_GREATSWORD", 90);

  assert.deepEqual(position, {
    zoneId: "BASE",
    x: 0,
    y: 0,
    rotation: 90,
  });
  draft.placements.push({
    instanceId: "SPIRIT_GREATSWORD",
    contentId: "EQUIPMENT_GREATSWORD",
    ...position,
  });

  const result = deriveBlueprint(draft, state);
  assert.equal(result.grid.width, 2);
  assert.equal(result.grid.height, 1);
  assert.equal(result.valid, true);
  assert.equal(
    result.issues.some((issue) => issue.includes("形态")),
    false,
  );
  assert.equal(result.designCost.C, 250);
  assert.equal(result.equivalentValue, 450);
  assert.equal(result.scaleHpCost, 225);
});

test("已有智力的原体可以安装大脑但不会获得额外效果", () => {
  const state = whiteState();
  state.unlockedBiofactors.push("MODIFICATION_BRAIN");
  const draft = createBlueprintDraft("W");
  const original = deriveBlueprint(draft, state);
  draft.placements.push({
    instanceId: "HUMAN_BRAIN",
    contentId: "MODIFICATION_BRAIN",
    x: 0,
    y: 0,
    rotation: 0,
  });

  const componentResult = deriveBlueprint(draft, state);
  assert.equal(componentResult.valid, true);
  assert.equal(componentResult.fields.intelligent, true);
  assert.deepEqual(componentResult.stats, original.stats);
  assert.deepEqual(componentResult.abilities, original.abilities);
});

test("字段要求错误会说明要求值和当前值", () => {
  const draft = createBlueprintDraft("W");
  draft.raceId = "RACE_BEAST";
  draft.raceColor = "G";
  draft.jobId = "JOB_WARRIOR";
  const jobResult = deriveBlueprint(draft);
  assert.match(
    jobResult.issues.join(" / "),
    /战士要求职业兼容性为有（当前为无）/,
  );
});

test("妖精的Forestwalk在界面中显示为树林行者", () => {
  const draft = createBlueprintDraft("G");
  draft.raceId = "RACE_ELF";
  draft.raceColor = "G";

  const result = deriveBlueprint(draft);
  assert.equal(result.valid, true);
  assert.equal(
    result.abilityDetails.find(
      (ability) => ability.id === "ABILITY_FORESTWALK",
    )?.name,
    "树林行者",
  );
});

test("吸血鬼、狼人和神器种族使用各自的固定费用与规模规则", () => {
  const vampire = createBlueprintDraft("B");
  vampire.raceId = "RACE_VAMPIRE";
  vampire.raceColor = "B";
  const vampireResult = deriveBlueprint(vampire);
  assert.deepEqual(vampireResult.stats, { power: 1, defense: 0, hp: 5 });
  assert.equal(vampireResult.designCost.B, 1);
  assert.equal(vampireResult.scaleHpCap, 5);
  assert.equal(vampireResult.replicasPerScaleHp, 2);

  const werewolf = createBlueprintDraft("R");
  werewolf.raceId = "RACE_WEREWOLF";
  werewolf.raceColor = "R";
  const werewolfResult = deriveBlueprint(werewolf);
  assert.equal(werewolfResult.designCost.R, 1);
  assert.equal(werewolfResult.designCost.G, 1);
  assert.deepEqual(werewolfResult.colors, ["R", "G"]);

  const gargoyle = createBlueprintDraft("C");
  gargoyle.raceId = "RACE_GARGOYLE";
  gargoyle.raceColor = "C";
  const gargoyleResult = deriveBlueprint(gargoyle);
  assert.equal(gargoyleResult.designCost.C, 400);
  assert.equal(gargoyleResult.fields.artifact, true);
  assert.equal(gargoyleResult.fields.professionCompatible, false);
});

test("吸血鬼改造不占格、允许无意义重复但拒绝安装到其他种族", () => {
  const draft = createBlueprintDraft("B");
  draft.raceId = "RACE_VAMPIRE";
  draft.raceColor = "B";
  const placement = findFirstPlacement(
    draft,
    "MODIFICATION_VAMPIRE_REVELER",
  );
  assert.deepEqual(placement, {
    zoneId: "SLOTLESS",
    x: 0,
    y: 0,
    rotation: 0,
  });
  draft.placements.push({
    instanceId: "REVELER_ONE",
    contentId: "MODIFICATION_VAMPIRE_REVELER",
    ...placement,
  });
  draft.placements.push({
    instanceId: "REVELER_TWO",
    contentId: "MODIFICATION_VAMPIRE_REVELER",
    ...placement,
  });
  assert.equal(inspectGrid(draft).cells.filter(Boolean).length, 0);
  assert.equal(deriveBlueprint(draft).valid, true);

  const human = createBlueprintDraft("W");
  human.placements.push({
    instanceId: "INVALID_REVELER",
    contentId: "MODIFICATION_VAMPIRE_REVELER",
    ...placement,
  });
  assert.match(deriveBlueprint(human).issues.join(" / "), /不能安装在人类原体/);
});

test("尸嵌化占满灵俑两个基础区并提供不可递归的3×2通用区", () => {
  const draft = createBlueprintDraft("B");
  draft.raceId = "RACE_ZOMBIE";
  draft.raceColor = "B";
  const position = findFirstPlacement(
    draft,
    "MODIFICATION_SKAABIFICATION",
  );
  draft.placements.push({
    instanceId: "SKAAB_ONE",
    contentId: "MODIFICATION_SKAABIFICATION",
    ...position,
  });
  const grid = inspectGrid(draft);
  assert.equal(grid.valid, true);
  assert.deepEqual(
    grid.zones.map(({ kind, width, height }) => ({ kind, width, height })),
    [
      { kind: "BASE", width: 2, height: 1 },
      { kind: "BASE", width: 1, height: 1 },
      { kind: "AUX_GENERAL", width: 3, height: 2 },
    ],
  );
  assert.equal(
    grid.zones
      .filter((zone) => zone.kind === "BASE")
      .every((zone) => zone.cells.every((cell) => cell === "SKAAB_ONE")),
    true,
  );
  assert.equal(
    findFirstPlacement(draft, "EQUIPMENT_BRONZE_SWORD").zoneId,
    "AUX_SKAAB_ONE",
  );
  assert.equal(findFirstPlacement(draft, "MODIFICATION_ARM"), null);

  const result = deriveBlueprint(draft);
  assert.deepEqual(result.stats, { power: 0, defense: 1, hp: 12 });
  assert.equal(result.designCost.B, 1);
  assert.equal(result.designCost.U, 2);
});

test("安装胳膊后立即生成独立1×2装备拓展格", () => {
  const state = whiteState();
  state.unlockedBiofactors.push("MODIFICATION_ARM");
  const draft = createBlueprintDraft("W");
  const armPosition = findFirstPlacement(draft, "MODIFICATION_ARM");
  draft.placements.push({
    instanceId: "ARM_ONE",
    contentId: "MODIFICATION_ARM",
    ...armPosition,
  });

  const grid = inspectGrid(draft);
  assert.equal(grid.valid, true);
  assert.equal(grid.zones.length, 2);
  assert.deepEqual(
    {
      id: grid.zones[1].id,
      kind: grid.zones[1].kind,
      width: grid.zones[1].width,
      height: grid.zones[1].height,
    },
    {
      id: "AUX_ARM_ONE",
      kind: "AUX_EQUIPMENT",
      width: 1,
      height: 2,
    },
  );

  const swordPosition = findFirstPlacement(draft, "EQUIPMENT_BRONZE_SWORD");
  assert.equal(swordPosition.zoneId, "AUX_ARM_ONE");
  draft.placements.push({
    instanceId: "SWORD_AUX",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    ...swordPosition,
  });
  assert.equal(deriveBlueprint(draft, state).valid, true);
});

test("附加装备区拒绝非装备，胳膊无效时也不会生成拓展格", () => {
  const state = whiteState();
  state.unlockedBiofactors.push("MODIFICATION_ARM");
  const invalidDraft = createBlueprintDraft("W");
  invalidDraft.placements = [
    {
      instanceId: "SWORD_BASE",
      contentId: "EQUIPMENT_BRONZE_SWORD",
      zoneId: "BASE",
      x: 0,
      y: 0,
      rotation: 0,
    },
    {
      instanceId: "ARM_OVERLAP",
      contentId: "MODIFICATION_ARM",
      zoneId: "BASE",
      x: 0,
      y: 0,
      rotation: 0,
    },
  ];
  assert.equal(inspectGrid(invalidDraft).zones.length, 1);

  const draft = createBlueprintDraft("W");
  draft.placements = [
    {
      instanceId: "ARM_ONE",
      contentId: "MODIFICATION_ARM",
      zoneId: "BASE",
      x: 0,
      y: 0,
      rotation: 0,
    },
    {
      instanceId: "ARM_TWO",
      contentId: "MODIFICATION_ARM",
      zoneId: "AUX_ARM_ONE",
      x: 0,
      y: 0,
      rotation: 0,
    },
  ];
  const result = deriveBlueprint(draft, state);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" / "), /不能安装在附加装备区/);
});

test("已安装生物因子可以手动移动到另一个合法格位", () => {
  const draft = createBlueprintDraft("W");
  draft.placements = [
    {
      instanceId: "SWORD",
      contentId: "EQUIPMENT_BRONZE_SWORD",
      zoneId: "BASE",
      x: 0,
      y: 0,
      rotation: 0,
    },
  ];

  const moved = movePlacement(draft, "SWORD", {
    zoneId: "BASE",
    x: 1,
    y: 1,
  });
  assert.equal(moved.placements[0].x, 1);
  assert.equal(moved.placements[0].y, 1);
  assert.equal(draft.placements[0].x, 0);
});

test("手动移动会拒绝越界或与其他生物因子重叠", () => {
  const draft = createBlueprintDraft("W");
  draft.placements = [
    {
      instanceId: "SWORD",
      contentId: "EQUIPMENT_BRONZE_SWORD",
      zoneId: "BASE",
      x: 0,
      y: 0,
      rotation: 0,
    },
    {
      instanceId: "SHIELD",
      contentId: "EQUIPMENT_STOUT_SHIELD",
      zoneId: "BASE",
      x: 1,
      y: 1,
      rotation: 0,
    },
  ];

  assert.throws(
    () =>
      movePlacement(draft, "SWORD", {
        zoneId: "BASE",
        x: 1,
        y: 1,
      }),
    /重叠/,
  );
});

test("青铜剑与圆盾各最多安装2个，其余普通因子不增加数量上限", () => {
  const swordDraft = createBlueprintDraft("W");
  swordDraft.placements = [
    [0, 0],
    [1, 0],
    [0, 1],
  ].map(([x, y], index) => ({
    instanceId: `SWORD_${index}`,
    contentId: "EQUIPMENT_BRONZE_SWORD",
    zoneId: "BASE",
    x,
    y,
    rotation: 0,
  }));
  assert.match(deriveBlueprint(swordDraft).issues.join("；"), /最多安装2个/);

  const brainDraft = createBlueprintDraft("W");
  brainDraft.placements = [
    [0, 0],
    [1, 0],
  ].map(([x, y], index) => ({
    instanceId: `BRAIN_${index}`,
    contentId: "MODIFICATION_BRAIN",
    zoneId: "BASE",
    x,
    y,
    rotation: 0,
  }));
  assert.equal(deriveBlueprint(brainDraft).valid, true);

  const earsDraft = createBlueprintDraft("W");
  earsDraft.placements = [0, 1].map((y, index) => ({
    instanceId: `EARS_${index}`,
    contentId: "MODIFICATION_ELVEN_EARS",
    zoneId: "BASE",
    x: 0,
    y,
    rotation: 0,
  }));
  const ears = deriveBlueprint(earsDraft);
  assert.equal(ears.valid, true);
  assert.equal(
    ears.abilities.filter((id) => id === "ABILITY_KEEN_HEARING").length,
    1,
  );
});

test("新蓝图扣除设计成本并只发放一次免费原体", () => {
  const state = whiteState();
  const draft = createBlueprintDraft("W");
  draft.jobId = "JOB_WARRIOR";
  draft.placements.push({
    instanceId: "SWORD",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    x: 0,
    y: 0,
    rotation: 0,
  });
  const result = saveNewBlueprint(state, draft, 2000);

  assert.equal(result.state.resources.amounts.W, 5);
  assert.equal(result.state.resources.amounts.C, 17800);
  assert.equal(result.state.blueprints.length, 1);
  assert.equal(result.state.prototypes.length, 1);
  assert.equal(result.blueprint.hasGrantedFreePrototype, true);
});

test("已保存蓝图可支付完整设计成本二次编辑且不再发放原体", () => {
  const initialDraft = createBlueprintDraft("W");
  initialDraft.jobId = "JOB_WARRIOR";
  const initial = saveNewBlueprint(
    whiteState(),
    initialDraft,
    2000,
  );
  const draft = createBlueprintDraftFromBlueprint(initial.blueprint);
  draft.name = "二次调整";
  const position = findFirstPlacement(draft, "EQUIPMENT_BRONZE_SWORD");
  draft.placements.push({
    instanceId: "EDIT_SWORD",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    ...position,
  });
  const derived = deriveBlueprint(draft, initial.state);
  const before = structuredClone(initial.state.resources.amounts);
  const updated = updateExistingBlueprint(
    initial.state,
    initial.blueprint.id,
    draft,
    3000,
  );

  assert.equal(updated.state.blueprints.length, 1);
  assert.equal(updated.state.prototypes.length, 1);
  assert.equal(updated.blueprint.id, initial.blueprint.id);
  assert.equal(updated.prototype.id, initial.prototype.id);
  assert.equal(updated.blueprint.name, "二次调整");
  assert.equal(updated.blueprint.stats.power, 2);
  assert.equal(
    updated.state.resources.amounts.C,
    before.C - derived.designCost.C,
  );
  assert.equal(
    updated.state.resources.amounts.W,
    before.W - derived.designCost.W,
  );
});

test("远征归来的0复制体军团壳不阻止二次编辑并同步新属性", () => {
  const initialDraft = createBlueprintDraft("W");
  const initial = saveNewBlueprint(whiteState(), initialDraft, 2000);
  initial.state.legions = [
    {
      id: "LEGION_STANDBY",
      prototypeId: initial.prototype.id,
      blueprintId: initial.blueprint.id,
      name: "旧名称军团",
      purchasedScaleHp: 0,
      replicaCount: 0,
      currentHp: initial.blueprint.stats.hp,
      maxHp: initial.blueprint.stats.hp,
      currentPower: initial.blueprint.stats.power,
      currentDefense: initial.blueprint.stats.defense,
      maxDefense: initial.blueprint.stats.defense,
      abilities: [...initial.blueprint.abilities],
    },
  ];

  const draft = createBlueprintDraftFromBlueprint(initial.blueprint);
  draft.name = "归来后改造";
  draft.jobId = "JOB_WARRIOR";
  const updated = updateExistingBlueprint(
    initial.state,
    initial.blueprint.id,
    draft,
    3000,
  );

  assert.equal(updated.state.legions.length, 1);
  assert.equal(updated.state.legions[0].purchasedScaleHp, 0);
  assert.equal(updated.state.legions[0].replicaCount, 0);
  assert.equal(updated.state.legions[0].name, "归来后改造军团");
  assert.equal(
    updated.state.legions[0].currentPower,
    updated.blueprint.stats.power,
  );
  assert.equal(
    updated.state.legions[0].currentHp,
    updated.blueprint.stats.hp,
  );
});

test("死亡原体按蓝图价值支付无色法术力重构", () => {
  const draft = createBlueprintDraft("W");
  draft.jobId = "JOB_WARRIOR";
  draft.placements.push({
    instanceId: "SWORD",
    contentId: "EQUIPMENT_BRONZE_SWORD",
    x: 0,
    y: 0,
    rotation: 0,
  });
  const saved = saveNewBlueprint(whiteState(), draft, 2000);
  const dead = markPrototypeDead(saved.state, saved.prototype.id);
  const rebuilt = rebuildPrototype(dead, saved.prototype.id, 3000);

  assert.equal(rebuilt.prototypes[0].status, "READY");
  assert.equal(rebuilt.resources.amounts.C, 17400);
  assert.equal(rebuilt.prototypes[0].rebuildCount, 1);
});

test("军团、原体与蓝图必须按依赖顺序删除且不返还资源", () => {
  const saved = saveNewBlueprint(
    whiteState(),
    createBlueprintDraft("W"),
    2000,
  );
  const beforeResources = structuredClone(saved.state.resources);
  const legion = {
    id: "LEGION_TO_DISBAND",
    prototypeId: saved.prototype.id,
    blueprintId: saved.blueprint.id,
    name: "待解散军团",
    purchasedScaleHp: 3,
    replicaCount: 18,
  };
  const withLegion = {
    ...saved.state,
    legions: [legion],
  };

  assert.throws(
    () => destroyPrototype(withLegion, saved.prototype.id),
    /先解散/,
  );
  assert.throws(
    () => deleteBlueprint(withLegion, saved.blueprint.id),
    /先解散/,
  );

  const disbanded = disbandLegion(withLegion, legion.id);
  assert.equal(disbanded.state.legions.length, 0);
  assert.deepEqual(disbanded.state.resources, beforeResources);
  assert.throws(
    () => deleteBlueprint(disbanded.state, saved.blueprint.id),
    /先销毁/,
  );

  const destroyed = destroyPrototype(
    disbanded.state,
    saved.prototype.id,
  );
  assert.equal(destroyed.state.prototypes.length, 0);
  assert.equal(destroyed.state.blueprints.length, 1);
  assert.deepEqual(destroyed.state.resources, beforeResources);

  const deleted = deleteBlueprint(
    destroyed.state,
    saved.blueprint.id,
  );
  assert.equal(deleted.state.blueprints.length, 0);
  assert.deepEqual(deleted.state.resources, beforeResources);
});

test("销毁原体后可按蓝图价值重新实体化且不会刷新免费资格", () => {
  const saved = saveNewBlueprint(
    whiteState(),
    createBlueprintDraft("W"),
    2000,
  );
  const destroyed = destroyPrototype(
    saved.state,
    saved.prototype.id,
  );
  const beforeColorless = destroyed.state.resources.amounts.C;
  const instantiated = instantiatePrototype(
    destroyed.state,
    saved.blueprint.id,
    3000,
  );

  assert.equal(instantiated.state.prototypes.length, 1);
  assert.notEqual(instantiated.prototype.id, saved.prototype.id);
  assert.equal(instantiated.prototype.status, "READY");
  assert.equal(
    instantiated.state.resources.amounts.C,
    beforeColorless - saved.blueprint.equivalentValue,
  );
  assert.equal(
    instantiated.state.blueprints[0].hasGrantedFreePrototype,
    true,
  );
  assert.throws(
    () =>
      instantiatePrototype(
        instantiated.state,
        saved.blueprint.id,
        4000,
      ),
    /已经拥有/,
  );
});

test("销毁原体释放实体槽且仅存蓝图仍可二次编辑", () => {
  let state = whiteState();
  state.base.prototypeCap = 1;
  const first = saveNewBlueprint(
    state,
    createBlueprintDraft("W"),
    2000,
  );
  assert.throws(
    () =>
      saveNewBlueprint(
        first.state,
        createBlueprintDraft("W"),
        3000,
      ),
    /原体槽已满/,
  );

  const destroyed = destroyPrototype(
    first.state,
    first.prototype.id,
  );
  const editedDraft = createBlueprintDraftFromBlueprint(
    first.blueprint,
  );
  editedDraft.name = "仅存蓝图的新名称";
  const edited = updateExistingBlueprint(
    destroyed.state,
    first.blueprint.id,
    editedDraft,
    3500,
  );
  assert.equal(edited.prototype, null);
  assert.equal(edited.blueprint.name, "仅存蓝图的新名称");

  const second = saveNewBlueprint(
    edited.state,
    createBlueprintDraft("W"),
    4000,
  );
  assert.equal(second.state.prototypes.length, 1);
  assert.equal(second.state.blueprints.length, 2);
});

test("远征中或生产中的对象不能解散销毁或删除", () => {
  const saved = saveNewBlueprint(
    whiteState(),
    createBlueprintDraft("W"),
    2000,
  );
  const legion = {
    id: "LEGION_BUSY",
    prototypeId: saved.prototype.id,
    blueprintId: saved.blueprint.id,
    name: "忙碌军团",
    purchasedScaleHp: 2,
    replicaCount: 12,
  };
  const deployed = {
    ...saved.state,
    legions: [legion],
    prototypes: saved.state.prototypes.map((item) => ({
      ...item,
      status: "DEPLOYED",
    })),
    activeExpedition: {
      legionId: legion.id,
      prototypeId: saved.prototype.id,
      blueprintId: saved.blueprint.id,
    },
  };
  assert.throws(
    () => disbandLegion(deployed, legion.id),
    /远征中/,
  );
  assert.throws(
    () => destroyPrototype(deployed, saved.prototype.id),
    /远征中/,
  );
  assert.throws(
    () => deleteBlueprint(deployed, saved.blueprint.id),
    /远征正在使用/,
  );

  const producing = {
    ...saved.state,
    productionQueue: [
      {
        id: "PRODUCTION_BUSY",
        type: "LEGION",
        mode: "CREATE",
        prototypeId: saved.prototype.id,
        blueprintId: saved.blueprint.id,
      },
    ],
  };
  assert.throws(
    () => destroyPrototype(producing, saved.prototype.id),
    /正在生产/,
  );
  assert.throws(
    () => deleteBlueprint(producing, saved.blueprint.id),
    /正在生产/,
  );
});
