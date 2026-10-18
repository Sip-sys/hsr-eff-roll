(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RollBudgetCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATS = [
    { key: 'hpFlat', label: 'HP', unit: '', roll: 38.104, poolWeight: 10 },
    { key: 'atkFlat', label: 'ATK', unit: '', roll: 19.052, poolWeight: 10 },
    { key: 'defFlat', label: 'DEF', unit: '', roll: 19.052, poolWeight: 10 },
    { key: 'hpPct', label: 'HP%', unit: '%', roll: 3.888, poolWeight: 10 },
    { key: 'atkPct', label: 'ATK%', unit: '%', roll: 3.888, poolWeight: 10 },
    { key: 'defPct', label: 'DEF%', unit: '%', roll: 4.86, poolWeight: 10 },
    { key: 'spd', label: 'SPD', unit: '', roll: 2.3, poolWeight: 4 },
    { key: 'critRate', label: 'CRIT Rate', unit: '%', roll: 2.916, poolWeight: 6 },
    { key: 'critDmg', label: 'CRIT DMG', unit: '%', roll: 5.832, poolWeight: 6 },
    { key: 'ehr', label: 'Effect Hit Rate', unit: '%', roll: 3.888, poolWeight: 8 },
    { key: 'res', label: 'Effect RES', unit: '%', roll: 3.888, poolWeight: 8 },
    { key: 'breakEffect', label: 'Break Effect', unit: '%', roll: 5.832, poolWeight: 8 }
  ];

  const GOAL_STATS = STATS.filter(stat => ['critRate', 'critDmg', 'atkPct', 'spd', 'hpPct', 'defPct', 'breakEffect', 'ehr', 'res'].includes(stat.key));

  const ACHERON_EXAMPLE = {
    budget: 48,
    goals: [
      { key: 'critRate', target: 100, baseline: 25, rollValue: 2.916, statWeight: 1 },
      { key: 'critDmg', target: 150, baseline: 50, rollValue: 5.832, statWeight: 1 },
      { key: 'atkPct', target: 130, baseline: 10, rollValue: 3.888, statWeight: 0.75 }
    ],
    mainSlots: [
      { name: 'Head', mainKey: '', contribution: 0, chance: 100 },
      { name: 'Hands', mainKey: '', contribution: 0, chance: 100 },
      { name: 'Body', mainKey: 'critRate', contribution: 32.4, chance: 10 },
      { name: 'Feet', mainKey: 'atkPct', contribution: 43.2, chance: 30 },
      { name: 'Planar Sphere', mainKey: '', contribution: 0, chance: 9 },
      { name: 'Link Rope', mainKey: 'atkPct', contribution: 43.2, chance: 27 }
    ],
    subWeights: Object.fromEntries(STATS.map(stat => [stat.key, stat.poolWeight]))
  };

  function defaultState() {
    return JSON.parse(JSON.stringify(ACHERON_EXAMPLE));
  }

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function statByKey(key) {
    return STATS.find(stat => stat.key === key);
  }

  // Enumerate four sequential weighted, no-duplicate substat picks and return
  // the chance that `targetKey` appears on the finished relic.
  function lineInclusionProbability(targetKey, blockedKey, weights) {
    if (targetKey && targetKey === blockedKey) return 0;
    const pool = STATS
      .filter(stat => stat.key !== blockedKey && num(weights[stat.key], 0) > 0)
      .map(stat => ({ key: stat.key, weight: num(weights[stat.key], 0) }));
    if (!pool.some(item => item.key === targetKey) || pool.length < 4) return 0;

    let states = new Map([[0, 1]]);
    for (let draw = 0; draw < 4; draw += 1) {
      const next = new Map();
      for (const [mask, probability] of states) {
        let remainingWeight = 0;
        for (let i = 0; i < pool.length; i += 1) {
          if ((mask & (1 << i)) === 0) remainingWeight += pool[i].weight;
        }
        if (remainingWeight <= 0) continue;
        for (let i = 0; i < pool.length; i += 1) {
          if (mask & (1 << i)) continue;
          const newMask = mask | (1 << i);
          const chance = probability * pool[i].weight / remainingWeight;
          next.set(newMask, (next.get(newMask) || 0) + chance);
        }
      }
      states = next;
    }

    const targetIndex = pool.findIndex(item => item.key === targetKey);
    let included = 0;
    for (const [mask, probability] of states) {
      if (mask & (1 << targetIndex)) included += probability;
    }
    return included;
  }

  function calculate(state) {
    const budget = Math.max(0, num(state.budget, 0));
    const goals = Array.isArray(state.goals) ? state.goals : [];
    const slots = Array.isArray(state.mainSlots) ? state.mainSlots : [];
    const weights = state.subWeights || {};
    let totalRaw = 0;
    let totalEffective = 0;

    const rows = goals.map(goal => {
      const meta = statByKey(goal.key) || { key: goal.key, label: goal.key || 'Unknown', unit: '' };
      const mainContribution = slots
        .filter(slot => slot.mainKey === goal.key)
        .reduce((sum, slot) => sum + Math.max(0, num(slot.contribution, 0)), 0);
      const target = num(goal.target, 0);
      const baseline = num(goal.baseline, 0);
      const rollValue = Math.max(0, num(goal.rollValue, meta.roll || 0));
      const utilityWeight = Math.max(0, num(goal.statWeight, 1));
      const deficit = Math.max(0, target - baseline - mainContribution);
      const expectedRolls = rollValue > 0 ? deficit / rollValue : (deficit > 0 ? Infinity : 0);
      const wholeRolls = Number.isFinite(expectedRolls) ? Math.ceil(expectedRolls - 1e-10) : Infinity;
      const effectiveRolls = expectedRolls * utilityWeight;
      totalRaw += expectedRolls;
      totalEffective += effectiveRolls;

      const blocked = slots.filter(slot => slot.mainKey === goal.key).length;
      const eligibleSlots = slots.filter(slot => slot.mainKey !== goal.key);
      const expectedLinePieces = eligibleSlots.reduce((sum, slot) => {
        return sum + lineInclusionProbability(goal.key, slot.mainKey || '', weights);
      }, 0);
      const averageLineChance = eligibleSlots.length ? expectedLinePieces / eligibleSlots.length : 0;
      return {
        key: goal.key,
        label: meta.label,
        unit: meta.unit,
        target,
        baseline,
        mainContribution,
        deficit,
        rollValue,
        expectedRolls,
        wholeRolls,
        utilityWeight,
        effectiveRolls,
        blockedPieces: blocked,
        eligiblePieces: slots.length - blocked,
        expectedLinePieces,
        averageLineChance
      };
    });

    // Main-stat probability is the product of each slot's editable per-slot chance.
    // Only count it once, independent of how many target-stat rows are present.
    const exactMainChance = slots.reduce((chance, slot) => {
      return chance * Math.max(0, Math.min(100, num(slot.chance, 100))) / 100;
    }, 1);
    const percent = budget > 0 ? totalEffective / budget * 100 : (totalEffective > 0 ? Infinity : 0);
    return {
      rows,
      budget,
      totalRaw,
      totalEffective,
      percent,
      exactMainChance,
      overBudget: percent > 100,
      hasTargets: rows.some(row => row.target > row.baseline + row.mainContribution),
      // Keep a backward-compatible aggregate field while exposing exact chance separately.
      mainChance: exactMainChance,
      duplicateGoalKeys: goals.map(goal => goal.key).filter((key, index, all) => key && all.indexOf(key) !== index)
    };
  }

  return { STATS, GOAL_STATS, ACHERON_EXAMPLE, defaultState, lineInclusionProbability, calculate };
});
