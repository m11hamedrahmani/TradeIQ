// Evaluates a trade against the preset, structurally-defined rule types.
// CUSTOM rules are never auto-evaluated here — they're judgment calls the
// user attaches to a trade manually in the UI.

function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

const PARAM_SPECS = {
  CUSTOM: [],
  MIN_RR: [{ key: 'minRR', label: 'Minimum R:R', min: 0.1, max: 20 }],
  MAX_TRADES_PER_DAY: [{ key: 'maxCount', label: 'Max trades per day', min: 1, max: 100, integer: true }],
  MAX_TRADES_PER_WEEK: [{ key: 'maxCount', label: 'Max trades per week', min: 1, max: 500, integer: true }],
  NO_TRADES_AFTER_TIME: [{ key: 'cutoffHour', label: 'Cutoff hour (UTC, 0-23)', min: 0, max: 23, integer: true }],
  MAX_DAILY_LOSS: [{ key: 'maxLoss', label: 'Max daily loss ($)', min: 1, max: 1000000 }],
  REQUIRE_CONFIRMATION: [],
};

// Validates and normalizes raw params for a rule type. Throws a 400-flagged
// error with a human-readable message on invalid input.
function validateRuleParams(type, rawParams) {
  const spec = PARAM_SPECS[type];
  if (!spec) {
    const err = new Error(`Unknown rule type: ${type}`);
    err.status = 400;
    throw err;
  }

  const params = {};
  for (const field of spec) {
    const raw = rawParams ? rawParams[field.key] : undefined;
    const num = Number(raw);
    if (raw === undefined || raw === null || raw === '' || Number.isNaN(num)) {
      const err = new Error(`${field.label} is required for this rule type`);
      err.status = 400;
      throw err;
    }
    if (num < field.min || num > field.max) {
      const err = new Error(`${field.label} must be between ${field.min} and ${field.max}`);
      err.status = 400;
      throw err;
    }
    params[field.key] = field.integer ? Math.round(num) : num;
  }
  return params;
}

function evaluateRule(rule, { candidate, sameDayTrades, sameWeekTrades }) {
  const params = rule.params || {};

  switch (rule.type) {
    case 'MIN_RR':
      return candidate.rr !== null && candidate.rr !== undefined && candidate.rr < params.minRR;

    case 'MAX_TRADES_PER_DAY':
      return sameDayTrades.length + 1 > params.maxCount;

    case 'MAX_TRADES_PER_WEEK':
      return sameWeekTrades.length + 1 > params.maxCount;

    case 'NO_TRADES_AFTER_TIME':
      return candidate.entryTime.getUTCHours() >= params.cutoffHour;

    case 'MAX_DAILY_LOSS': {
      const cumulative = sum(sameDayTrades.map((t) => t.pnl)) + candidate.pnl;
      return cumulative <= -params.maxLoss;
    }

    case 'REQUIRE_CONFIRMATION':
      return candidate.entryConfirmed === false;

    case 'CUSTOM':
    default:
      return false;
  }
}

// Returns the ids of active, structurally-evaluable rules violated by `candidate`.
// Used only to auto-suggest checkboxes in the UI — the confirmed set the user
// submits is what actually gets saved.
function evaluateActiveRules({ candidate, sameDayTrades, sameWeekTrades, rules }) {
  return rules
    .filter((r) => r.active && r.type !== 'CUSTOM')
    .filter((r) => evaluateRule(r, { candidate, sameDayTrades, sameWeekTrades }))
    .map((r) => r.id);
}

module.exports = { PARAM_SPECS, validateRuleParams, evaluateRule, evaluateActiveRules };
