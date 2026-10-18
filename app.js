(function () {
  'use strict';

  const calculator = window.RollBudgetCalculator;
  const STORAGE_KEY = 'hsr-effective-roll-budget-v2';
  const statMap = new Map(calculator.STATS.map(stat => [stat.key, stat]));
  const els = {
    budget: document.getElementById('rollBudget'),
    allocationPercent: document.getElementById('allocationPercent'),
    allocationRange: document.getElementById('allocationRange'),
    allocationRaw: document.getElementById('allocationRaw'),
    allocationEffective: document.getElementById('allocationEffective'),
    allocationWhole: document.getElementById('allocationWhole'),
    allocationCap: document.getElementById('allocationCap'),
    goals: document.getElementById('goalsBody'),
    slots: document.getElementById('mainSlots'),
    mainWeights: document.getElementById('mainWeights'),
    subWeights: document.getElementById('subWeights'),
    breakdown: document.getElementById('breakdownBody'),
    resultPct: document.getElementById('resultPct'),
    effective: document.getElementById('effectiveNeeded'),
    raw: document.getElementById('rawNeeded'),
    mainChance: document.getElementById('mainChance'),
    meter: document.getElementById('meterFill'),
    status: document.getElementById('statusPill'),
    note: document.getElementById('resultNote'),
    blocked: document.getElementById('blockedSummary'),
    distribution: document.getElementById('distributionBody')
  };

  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
  function fmt(value, digits = 2) {
    if (!Number.isFinite(value)) return '∞';
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function pct(value, digits = 1) { return `${fmt(value * 100, digits)}%`; }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.goals) && Array.isArray(saved.mainSlots)) return saved;
    } catch (_) { /* Ignore malformed local state and use the example. */ }
    return calculator.defaultState();
  }

  let state = loadState();

  function statOptions(selected, includeOther) {
    const other = includeOther ? '<option value="">Other / no tracked stat</option>' : '';
    return other + calculator.STATS.map(stat => `<option value="${stat.key}" ${stat.key === selected ? 'selected' : ''}>${escapeHtml(stat.label)}</option>`).join('');
  }

  function renderGoals() {
    els.goals.innerHTML = state.goals.map((goal, index) => {
      const meta = statMap.get(goal.key) || calculator.STATS[0];
      return `<tr data-goal-index="${index}">
        <td><select class="goal-stat-select" data-field="key" aria-label="Target stat">${statOptions(goal.key, false)}</select></td>
        <td><input data-field="target" type="number" step="any" value="${escapeHtml(goal.target)}" aria-label="${escapeHtml(meta.label)} target"></td>
        <td><input data-field="baseline" type="number" step="any" value="${escapeHtml(goal.baseline)}" aria-label="${escapeHtml(meta.label)} starting effective stat"></td>
        <td><input data-field="rollValue" type="number" min="0" step="any" value="${escapeHtml(goal.rollValue)}" aria-label="${escapeHtml(meta.label)} value per roll"></td>
        <td><input data-field="statWeight" type="number" min="0" max="3" step="0.05" value="${escapeHtml(goal.statWeight)}" aria-label="${escapeHtml(meta.label)} effective weight"></td>
        <td class="computed-cell" data-computed="need">—</td>
        <td class="computed-cell" data-computed="effective">—</td>
        <td><button class="remove-row" type="button" data-action="remove-goal" aria-label="Remove ${escapeHtml(meta.label)}">×</button></td>
      </tr>`;
    }).join('');
  }

  function renderSlots() {
    els.slots.innerHTML = state.mainSlots.map((slot, index) => {
      const selectedStat = slot.mainKey ? statMap.get(slot.mainKey) : null;
      const valueLabel = selectedStat ? `${selectedStat.label} main value` : 'Tracked main value';
      return `<article class="main-slot" data-slot-index="${index}">
        <div class="main-slot-head"><strong>${escapeHtml(slot.name)}</strong><span class="slot-index">SLOT ${String(index + 1).padStart(2, '0')}</span></div>
        <div class="main-slot-fields">
          <label class="full">Main stat<select data-field="mainKey" aria-label="${escapeHtml(slot.name)} main stat">${statOptions(slot.mainKey, true)}</select></label>
          <label>${escapeHtml(valueLabel)}<input data-field="contribution" type="number" min="0" step="any" value="${escapeHtml(slot.contribution)}" aria-label="${escapeHtml(slot.name)} main stat value already included in starting stats"></label>
          <label>Main drop chance %<input data-field="chance" type="number" min="0" max="100" step="any" value="${escapeHtml(slot.chance)}" aria-label="${escapeHtml(slot.name)} main stat drop chance"></label>
        </div>
      </article>`;
    }).join('');
  }

  function renderWeights() {
    els.mainWeights.innerHTML = state.mainSlots.map((slot, index) => {
      const statName = slot.mainKey ? statMap.get(slot.mainKey)?.label || 'Selected stat' : 'Other / fixed';
      return `<div class="weight-row" data-slot-index="${index}"><label>${escapeHtml(slot.name)} · ${escapeHtml(statName)}</label><input data-field="chance" type="number" min="0" max="100" step="any" value="${escapeHtml(slot.chance)}" aria-label="${escapeHtml(slot.name)} main-stat chance"></div>`;
    }).join('');
    els.subWeights.innerHTML = calculator.STATS.map(stat => {
      return `<div class="weight-row"><label>${escapeHtml(stat.label)}</label><input data-sub-weight="${stat.key}" type="number" min="0" step="any" value="${escapeHtml(state.subWeights?.[stat.key] ?? stat.poolWeight)}" aria-label="${escapeHtml(stat.label)} substat selection weight"></div>`;
    }).join('');
  }

  function readState() {
    const goals = Array.from(els.goals.querySelectorAll('tr')).map(row => {
      const value = field => row.querySelector(`[data-field="${field}"]`)?.value;
      return {
        key: value('key'),
        target: Number(value('target')) || 0,
        baseline: Number(value('baseline')) || 0,
        rollValue: Number(value('rollValue')) || 0,
        statWeight: Number(value('statWeight')) || 0
      };
    });
    const mainSlots = Array.from(els.slots.querySelectorAll('.main-slot')).map((element, index) => {
      const value = field => element.querySelector(`[data-field="${field}"]`)?.value;
      return {
        name: state.mainSlots[index]?.name || `Slot ${index + 1}`,
        mainKey: value('mainKey') || '',
        contribution: Number(value('contribution')) || 0,
        chance: Number(value('chance'))
      };
    });
    const subWeights = {};
    for (const input of els.subWeights.querySelectorAll('[data-sub-weight]')) {
      subWeights[input.dataset.subWeight] = Number(input.value) || 0;
    }
    return {
      budget: Number(els.budget.value) || 0,
      allocationPercent: Number(els.allocationPercent.value),
      goals,
      mainSlots,
      subWeights
    };
  }

  function syncAllocationControls() {
    const value = Math.max(0, Math.min(100, Number(state.allocationPercent ?? 100) || 0));
    els.allocationPercent.value = value;
    els.allocationRange.value = value;
  }

  function renderResults() {
    state = readState();
    const result = calculator.calculate(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncAllocationControls();

    const percent = result.percent;
    els.resultPct.textContent = Number.isFinite(percent) ? `${fmt(percent, 1)}%` : '∞';
    els.effective.textContent = `${fmt(result.totalEffective, 2)} / ${fmt(result.budget, 1)}`;
    els.raw.textContent = fmt(result.totalRaw, 1);
    els.mainChance.textContent = pct(result.exactMainChance, 2);
    els.meter.style.width = `${Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 100))}%`;
    els.status.className = `status-pill ${result.overBudget ? 'over' : (result.hasTargets ? 'good' : '')}`;
    els.status.textContent = result.overBudget ? 'Over budget' : (result.hasTargets ? 'Fits budget' : 'Add targets');
    if (result.duplicateGoalKeys.length) {
      els.note.textContent = 'A stat appears more than once. Keep one row per stat so its roll requirement is counted once.';
    } else if (result.overBudget) {
      els.note.textContent = `The target needs ${fmt(percent - 100, 1)}% more effective rolls than the selected budget. Raise a starting stat, lower a target, or increase the comparison budget.`;
    } else if (result.hasTargets) {
      els.note.textContent = 'This is the weighted roll budget only. The main-stat chance excludes set and relic-piece drops, and does not include substat-roll RNG.';
    } else {
      els.note.textContent = 'Add a target above its current sources to calculate the roll budget.';
    }

    Array.from(els.goals.querySelectorAll('tr')).forEach((tr, index) => {
      const row = result.rows[index];
      if (!row) return;
      const need = tr.querySelector('[data-computed="need"]');
      const effective = tr.querySelector('[data-computed="effective"]');
      need.textContent = `${fmt(row.deficit, 2)}${row.unit}`;
      effective.textContent = `${fmt(row.effectiveRolls, 2)} / ${fmt(row.expectedRolls, 2)} rolls`;
      need.classList.toggle('muted', row.deficit <= 0);
      effective.classList.toggle('muted', row.expectedRolls <= 0);
    });

    els.breakdown.innerHTML = result.rows.map(row => {
      const unit = row.unit;
      return `<tr>
        <td><strong>${escapeHtml(row.label)}</strong></td>
        <td>${fmt(row.mainContribution, 2)}${unit}</td>
        <td>${fmt(row.expectedRolls, 2)}</td>
        <td>${fmt(row.wholeRolls, 0)}</td>
        <td>${row.eligiblePieces} / ${state.mainSlots.length}</td>
        <td>${fmt(row.expectedLinePieces, 2)} pieces <span class="line-percent">(${fmt(row.averageLineChance * 100, 1)}% each)</span></td>
      </tr>`;
    }).join('');

    els.allocationRaw.textContent = `${fmt(result.allocatedRawRolls, 2)} / ${fmt(result.totalRaw, 2)}`;
    els.allocationEffective.textContent = `${fmt(result.allocatedEffectiveRolls, 2)} / ${fmt(result.totalEffective, 2)}`;
    els.allocationWhole.textContent = fmt(result.allocatedWholeRolls, 0);
    els.allocationCap.textContent = pct(result.totalRaw / result.theoreticalMaxRawRolls, 1);
    els.distribution.innerHTML = result.rows.map(row => {
      return `<tr>
        <td><strong>${escapeHtml(row.label)}</strong></td>
        <td>${fmt(row.deficit, 2)}${row.unit}</td>
        <td>${fmt(row.rollShare * 100, 1)}%</td>
        <td>${fmt(row.allocatedRolls, 2)}</td>
        <td>${fmt(row.allocatedWholeRolls, 0)}</td>
        <td>${fmt(row.allocatedEffectiveRolls, 2)}</td>
        <td>${fmt(row.projectedStat, 2)}${row.unit}</td>
      </tr>`;
    }).join('');

    const blockedParts = result.rows.map(row => `${row.label}: ${row.blockedPieces} blocked`).join(' · ');
    els.blocked.textContent = result.rows.length ? `Main-stat values shown above are assumed included in your starting stats. ${blockedParts}.` : 'Add target stats to check which pieces block their matching substats.';

  }

  function updateGoalFromRow(row) {
    const key = row.querySelector('[data-field="key"]').value;
    const meta = statMap.get(key);
    const goal = state.goals[Number(row.dataset.goalIndex)];
    if (!meta || !goal) return;
    goal.key = key;
    goal.rollValue = meta.roll;
    renderGoals();
    renderSlots();
    renderWeights();
    renderResults();
  }

  function addGoal() {
    const used = new Set(state.goals.map(goal => goal.key));
    const next = calculator.GOAL_STATS.find(stat => !used.has(stat.key)) || calculator.GOAL_STATS[0];
    state.goals.push({ key: next.key, target: 0, baseline: 0, rollValue: next.roll, statWeight: 1 });
    renderGoals();
    renderSlots();
    renderWeights();
    renderResults();
  }

  els.budget.addEventListener('input', renderResults);
  els.allocationPercent.addEventListener('input', event => {
    const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
    els.allocationRange.value = value;
    renderResults();
  });
  els.allocationRange.addEventListener('input', event => {
    els.allocationPercent.value = event.target.value;
    renderResults();
  });
  els.goals.addEventListener('input', event => {
    if (event.target.matches('[data-field]')) renderResults();
  });
  els.goals.addEventListener('change', event => {
    if (event.target.matches('[data-field="key"]')) updateGoalFromRow(event.target.closest('tr'));
  });
  els.goals.addEventListener('click', event => {
    const button = event.target.closest('[data-action="remove-goal"]');
    if (!button) return;
    const index = Number(button.closest('tr').dataset.goalIndex);
    state = readState();
    state.goals.splice(index, 1);
    renderGoals(); renderSlots(); renderWeights(); renderResults();
  });
  els.slots.addEventListener('input', renderResults);
  els.slots.addEventListener('change', event => {
    if (event.target.matches('[data-field="mainKey"]')) {
      state = readState();
      const element = event.target.closest('.main-slot');
      const index = Number(element.dataset.slotIndex);
      const selected = event.target.value;
      const meta = statMap.get(selected);
      // Set a helpful default for tracked main stats while leaving custom values editable.
      if (meta && Number(state.mainSlots[index].contribution) === 0) {
        const defaults = { critRate: 32.4, critDmg: 64.8, atkPct: 43.2, spd: 25.0 };
        state.mainSlots[index].contribution = defaults[selected] || 0;
      }
      state.mainSlots[index].mainKey = selected;
      renderSlots();
      renderWeights();
      renderResults();
    }
  });
  els.mainWeights.addEventListener('input', event => {
    const index = Number(event.target.closest('[data-slot-index]')?.dataset.slotIndex);
    if (Number.isInteger(index) && state.mainSlots[index]) {
      state.mainSlots[index].chance = Number(event.target.value) || 0;
      const slot = els.slots.querySelector(`[data-slot-index="${index}"] [data-field="chance"]`);
      if (slot) slot.value = event.target.value;
      renderResults();
    }
  });
  els.subWeights.addEventListener('input', renderResults);

  document.getElementById('addStatButton').addEventListener('click', addGoal);
  document.getElementById('acheronPreset').addEventListener('click', () => {
    state = deepCopy(calculator.ACHERON_EXAMPLE);
    syncAllocationControls();
    renderGoals(); renderSlots(); renderWeights(); renderResults();
  });
  document.getElementById('resetButton').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    state = calculator.defaultState();
    syncAllocationControls();
    renderGoals(); renderSlots(); renderWeights(); renderResults();
  });

  // Main-stat odds are mirrored in the advanced panel; keep both controls synchronized.
  els.slots.addEventListener('input', event => {
    if (!event.target.matches('[data-field="chance"]')) return;
    const index = Number(event.target.closest('[data-slot-index]')?.dataset.slotIndex);
    const input = els.mainWeights.querySelector(`[data-slot-index="${index}"] [data-field="chance"]`);
    if (input) input.value = event.target.value;
  });
  syncAllocationControls();
  renderGoals();
  renderSlots();
  renderWeights();
  renderResults();
})();
