const MAX_ROUNDS = 20;
const NO_HP_CHANGE_LIMIT = 3;

function hasAbility(unit, abilityId) {
  return unit.abilities?.includes(abilityId);
}

function hasFlight(unit) {
  return (
    hasAbility(unit, "ABILITY_FLYING") ||
    hasAbility(unit, "ABILITY_COMBAT_FLIGHT")
  );
}

export function createCombatant({
  id,
  name,
  power,
  defense,
  hp,
  colors = [],
  abilities = [],
  originalAbilities = abilities,
  scaleHp = 0,
  temporaryScaleHp = 0,
  legendaryTemporaryHp = 0,
  bloodthirstStacks = 0,
}) {
  return {
    id,
    name,
    colors: [...colors],
    abilities: [...abilities],
    originalAbilities: [...originalAbilities],
    basePower: power,
    currentPower: power,
    maxDefense: defense,
    currentDefense: defense,
    maxHp: hp,
    currentHp: hp,
    scaleHp,
    temporaryScaleHp,
    legendaryTemporaryHp,
    bloodthirstStacks,
    bloodthirstTriggered: false,
    enrageStacks: 0,
    soldierFormation: false,
    soldierReinforced: false,
    defenseStatus: "NORMAL",
    oddRemainderPending: false,
    isExposedRound: false,
  };
}

function applyCombatOpening(unit, opponent) {
  let power = unit.basePower + unit.bloodthirstStacks;
  let maxDefense = unit.maxDefense;
  let maxHp = unit.maxHp;
  let currentHp = unit.currentHp;
  let scaleHp = unit.scaleHp;
  let temporaryScaleHp = unit.temporaryScaleHp;
  const openingScaleHp = scaleHp;
  const soldierFormation =
    hasAbility(unit, "ABILITY_SOLDIER_FORM_RANKS") && openingScaleHp >= 5;
  const soldierReinforced =
    hasAbility(unit, "ABILITY_SOLDIER_REINFORCE") && openingScaleHp < 5;
  if (soldierFormation) {
    power += 2;
    maxDefense += 1;
  } else if (soldierReinforced) {
    maxHp += 1;
    currentHp += 1;
    scaleHp += 1;
    temporaryScaleHp += 1;
  }
  if (hasAbility(unit, "ABILITY_REACH") && hasFlight(opponent)) {
    power += 1;
  }
  if (
    hasFlight(unit) &&
    !hasFlight(opponent) &&
    !hasAbility(opponent, "ABILITY_REACH")
  ) {
    maxDefense += 1;
  }
  return {
    ...unit,
    currentPower: power,
    maxDefense,
    currentDefense: maxDefense,
    maxHp,
    currentHp,
    scaleHp,
    temporaryScaleHp,
    soldierFormation,
    soldierReinforced,
  };
}

export function createCombat(attackerInput, defenderInput, context = {}) {
  const attackerBase = createCombatant(attackerInput);
  const defenderBase = createCombatant(defenderInput);
  return {
    round: 0,
    attacker: applyCombatOpening(attackerBase, defenderBase),
    defender: applyCombatOpening(defenderBase, attackerBase),
    noHpChangeStreak: 0,
    status: "ACTIVE",
    winner: null,
    reason: null,
    context,
    rounds: [],
  };
}

function prepareDefense(unit) {
  if (unit.maxDefense <= 0) {
    return { ...unit, currentDefense: 0, isExposedRound: false };
  }
  if (unit.defenseStatus === "EXPOSED") {
    return {
      ...unit,
      currentDefense: 0,
      defenseStatus: "RECOVER",
      isExposedRound: true,
    };
  }
  if (unit.defenseStatus === "RECOVER") {
    const shieldBonus = hasAbility(unit, "ABILITY_002") ? 1 : 0;
    const recovered = Math.min(
      unit.maxDefense,
      Math.max(1, Math.floor(unit.maxDefense / 2)) + shieldBonus,
    );
    return {
      ...unit,
      currentDefense: recovered,
      defenseStatus: "NORMAL",
      oddRemainderPending:
        unit.maxDefense % 2 === 1 && recovered < unit.maxDefense,
      isExposedRound: false,
    };
  }
  if (unit.oddRemainderPending) {
    return {
      ...unit,
      currentDefense: Math.min(unit.maxDefense, unit.currentDefense + 1),
      oddRemainderPending: false,
      isExposedRound: false,
    };
  }
  return { ...unit, isExposedRound: false };
}

function calculateAttack(attacker, defender) {
  const whiteDamageBonus =
    attacker.currentPower > 0 &&
    attacker.colors.includes("W") &&
    hasAbility(defender, "ABILITY_VAMPIRE_WHITE_DAMAGE_PLUS_1")
      ? 1
      : 0;
  const power = attacker.currentPower + whiteDamageBonus;
  const defenseBefore = defender.currentDefense;
  if (power <= 0) {
    return {
      hpDamage: 0,
      defenseDamage: 0,
      defenseAfter: defenseBefore,
      brokeDefense: false,
      greatswordBonus: 0,
      whiteDamageBonus,
    };
  }
  if (power < defenseBefore) {
    return {
      hpDamage: 0,
      defenseDamage: power,
      defenseAfter: defenseBefore - power,
      brokeDefense: false,
      greatswordBonus: 0,
      whiteDamageBonus,
    };
  }

  const brokeDefense = defenseBefore > 0;
  const greatswordCount = attacker.abilities.filter(
    (ability) => ability === "ABILITY_003",
  ).length;
  const greatswordBonus =
    brokeDefense || defender.isExposedRound ? greatswordCount : 0;
  return {
    hpDamage: power - defenseBefore + 1 + greatswordBonus,
    defenseDamage: defenseBefore,
    defenseAfter: 0,
    brokeDefense,
    greatswordBonus,
    whiteDamageBonus,
  };
}

function applyIncoming(unit, attack) {
  let defenseStatus = unit.defenseStatus;
  let oddRemainderPending = unit.oddRemainderPending;
  if (attack.brokeDefense && unit.maxDefense > 0) {
    defenseStatus = "EXPOSED";
    oddRemainderPending = false;
  }
  return {
    ...unit,
    currentDefense: attack.defenseAfter,
    currentHp: Math.max(0, unit.currentHp - attack.hpDamage),
    scaleHp: Math.max(0, unit.scaleHp - attack.hpDamage),
    legendaryTemporaryHp: Math.max(
      0,
      unit.legendaryTemporaryHp - attack.hpDamage,
    ),
    defenseStatus,
    oddRemainderPending,
  };
}

export function resolveCombatRound(combat) {
  if (combat.status !== "ACTIVE") return combat;
  const attackerPrepared = prepareDefense(combat.attacker);
  const defenderPrepared = prepareDefense(combat.defender);
  const attackerHpStart = attackerPrepared.currentHp;
  const defenderHpStart = defenderPrepared.currentHp;
  const attackOnDefender = calculateAttack(attackerPrepared, defenderPrepared);
  const attackOnAttacker = calculateAttack(defenderPrepared, attackerPrepared);
  let attacker = applyIncoming(attackerPrepared, attackOnAttacker);
  let defender = applyIncoming(defenderPrepared, attackOnDefender);
  const attackerLostHp = attacker.currentHp < attackerHpStart;
  const defenderLostHp = defender.currentHp < defenderHpStart;
  if (
    attackerLostHp &&
    hasAbility(attacker, "ABILITY_WEREWOLF_ENRAGE")
  ) {
    attacker = {
      ...attacker,
      currentPower: attacker.currentPower + 1,
      enrageStacks: attacker.enrageStacks + 1,
    };
  }
  if (
    defenderLostHp &&
    hasAbility(defender, "ABILITY_WEREWOLF_ENRAGE")
  ) {
    defender = {
      ...defender,
      currentPower: defender.currentPower + 1,
      enrageStacks: defender.enrageStacks + 1,
    };
  }
  const attackerBloodthirst =
    attackOnDefender.hpDamage > 0 &&
    hasAbility(attacker, "ABILITY_VAMPIRE_BLOODTHIRST") &&
    !attacker.bloodthirstTriggered &&
    attacker.bloodthirstStacks < 2;
  const defenderBloodthirst =
    attackOnAttacker.hpDamage > 0 &&
    hasAbility(defender, "ABILITY_VAMPIRE_BLOODTHIRST") &&
    !defender.bloodthirstTriggered &&
    defender.bloodthirstStacks < 2;
  if (attackerBloodthirst) {
    attacker = {
      ...attacker,
      currentPower: attacker.currentPower + 1,
      bloodthirstStacks: attacker.bloodthirstStacks + 1,
      bloodthirstTriggered: true,
    };
  }
  if (defenderBloodthirst) {
    defender = {
      ...defender,
      currentPower: defender.currentPower + 1,
      bloodthirstStacks: defender.bloodthirstStacks + 1,
      bloodthirstTriggered: true,
    };
  }
  const round = combat.round + 1;
  const noHpChange =
    attacker.currentHp === attackerHpStart &&
    defender.currentHp === defenderHpStart;
  const noHpChangeStreak = noHpChange
    ? combat.noHpChangeStreak + 1
    : 0;

  let status = "ACTIVE";
  let winner = null;
  let reason = null;
  if (attacker.currentHp <= 0 || defender.currentHp <= 0) {
    status = "COMPLETE";
    if (attacker.currentHp <= 0 && defender.currentHp <= 0) {
      winner = "BOTH_DEAD";
      reason = "MUTUAL_DESTRUCTION";
    } else if (defender.currentHp <= 0) {
      winner = "ATTACKER";
      reason = "DEFENDER_DESTROYED";
    } else {
      winner = "DEFENDER";
      reason = "ATTACKER_DESTROYED";
    }
  } else if (noHpChangeStreak >= NO_HP_CHANGE_LIMIT) {
    status = "COMPLETE";
    winner = "DEFENDER";
    reason = "STALEMATE";
  } else if (round >= MAX_ROUNDS) {
    status = "COMPLETE";
    winner = "DEFENDER";
    reason = "ROUND_LIMIT";
  }

  const record = {
    round,
    attackerHpStart,
    defenderHpStart,
    attackerHpEnd: attacker.currentHp,
    defenderHpEnd: defender.currentHp,
    attackOnDefender,
    attackOnAttacker,
    attackerDefense: attacker.currentDefense,
    defenderDefense: defender.currentDefense,
    attackerEnraged: attackerLostHp && attacker.enrageStacks > attackerPrepared.enrageStacks,
    defenderEnraged: defenderLostHp && defender.enrageStacks > defenderPrepared.enrageStacks,
    attackerBloodthirst,
    defenderBloodthirst,
  };
  return {
    ...combat,
    round,
    attacker,
    defender,
    noHpChangeStreak,
    status,
    winner,
    reason,
    rounds: [...combat.rounds, record],
  };
}

export function simulateCombat(attacker, defender, context = {}) {
  let combat = createCombat(attacker, defender, context);
  while (combat.status === "ACTIVE") combat = resolveCombatRound(combat);
  return combat;
}
