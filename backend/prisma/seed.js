require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { evaluateActiveRules } = require('../src/services/rule-engine.service');
const { computeAutoGrade } = require('../src/services/grading-engine.service');
const { dayBounds, weekBounds } = require('../src/utils/dateBuckets');

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const SYMBOLS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'USDCAD', 'NAS100'];

// "Quality tiers" drive realistic P&L/RR simulation only — they are NOT the
// trade's final grade. Grade is computed purely from which rules the trade
// broke, same as the real app, so a good-outcome trade can still grade low if
// it was undisciplined (and vice versa).
const QUALITY_PROFILE = {
  GREAT: { winProb: 0.85, rr: [2.5, 4.5] },
  GOOD: { winProb: 0.75, rr: [1.8, 3.0] },
  OK: { winProb: 0.55, rr: [0.8, 2.0] },
  WEAK: { winProb: 0.35, rr: [0.3, 1.2] },
  POOR: { winProb: 0.15, rr: [0.1, 0.8] },
};

const RULE_DEFS = [
  {
    title: 'Min 1:2 Risk-Reward',
    type: 'MIN_RR',
    params: { minRR: 2 },
    weight: 'MEDIUM',
    description: 'Every trade should target at least a 1:2 reward-to-risk ratio.',
  },
  {
    title: 'Max 3 trades per day',
    type: 'MAX_TRADES_PER_DAY',
    params: { maxCount: 3 },
    weight: 'MEDIUM',
    description: "Don't overtrade — cap it at 3 setups a day.",
  },
  {
    title: 'Max 12 trades per week',
    type: 'MAX_TRADES_PER_WEEK',
    params: { maxCount: 12 },
    weight: 'LOW',
    description: 'Keep weekly trade count in check to avoid overtrading.',
  },
  {
    title: 'No trades after 3pm',
    type: 'NO_TRADES_AFTER_TIME',
    params: { cutoffHour: 15 },
    weight: 'HIGH',
    description: 'Avoid new entries after 15:00 GMT — this is when revenge trading creeps in.',
  },
  {
    title: 'Max daily loss $300',
    type: 'MAX_DAILY_LOSS',
    params: { maxLoss: 300 },
    weight: 'HIGH',
    description: 'Stop trading for the day once down $300.',
  },
  {
    title: 'Wait for confirmation',
    type: 'REQUIRE_CONFIRMATION',
    params: null,
    weight: 'MEDIUM',
    description: "Don't enter until the displacement/confirmation candle closes.",
  },
  {
    title: 'No revenge trades',
    type: 'CUSTOM',
    params: null,
    weight: 'HIGH',
    description: "Don't re-enter within 30 minutes of a stopped-out loss.",
  },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function sessionForHour(hour) {
  if (hour >= 0 && hour < 7) return 'ASIAN';
  if (hour >= 7 && hour < 12) return 'LONDON';
  if (hour >= 12 && hour < 21) return 'NEWYORK';
  return 'OTHER';
}

function weightedTier(sessionBiasGood) {
  const roll = Math.random();
  const table = sessionBiasGood
    ? [['GREAT', 0.4], ['GOOD', 0.3], ['OK', 0.18], ['WEAK', 0.08], ['POOR', 0.04]]
    : [['GREAT', 0.15], ['GOOD', 0.15], ['OK', 0.25], ['WEAK', 0.25], ['POOR', 0.2]];
  let acc = 0;
  for (const [tier, weight] of table) {
    acc += weight;
    if (roll <= acc) return tier;
  }
  return 'OK';
}

async function main() {
  const email = 'demo@tradeiq.app';
  const password = 'demo1234';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Mohamed', plan: 'PRO' },
  });

  await prisma.trade.deleteMany({ where: { userId: user.id } });
  await prisma.rule.deleteMany({ where: { userId: user.id } });

  const rules = await Promise.all(
    RULE_DEFS.map((r) =>
      prisma.rule.create({ data: { userId: user.id, title: r.title, description: r.description, type: r.type, params: r.params, weight: r.weight } })
    )
  );
  const customRevengeRule = rules.find((r) => r.type === 'CUSTOM');

  const allTrades = []; // in-memory, chronological, used to evaluate sibling-dependent rules as we go
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const day = new Date(today.getTime() - daysAgo * DAY_MS);
    const dow = day.getUTCDay(); // 0 Sun ... 6 Sat

    if (dow === 0 && Math.random() > 0.1) continue;
    if (dow === 6 && Math.random() > 0.15) continue;

    const count = dow >= 1 && dow <= 5 ? randInt(2, 5) : randInt(1, 2);
    const isFriday = dow === 5;

    for (let i = 0; i < count; i++) {
      // Fridays skew later in the day (feeds the "no trades after 3pm" /
      // revenge-trading pattern), other weekdays skew toward London/NY.
      const runsLate = isFriday && Math.random() < 0.5;
      const useLondon = !runsLate && Math.random() < 0.55;
      const useNY = !runsLate && !useLondon && Math.random() < 0.6;
      const hour = runsLate ? randInt(15, 20) : useLondon ? randInt(7, 11) : useNY ? randInt(12, 20) : randInt(0, 6);
      const entryTime = new Date(day.getTime() + hour * 3600000 + randInt(0, 59) * 60000);

      const tier = runsLate ? weightedTier(false) : weightedTier(useLondon);
      const profile = QUALITY_PROFILE[tier];
      const win = Math.random() < profile.winProb;
      const rr = win ? randFloat(profile.rr[0], profile.rr[1]) : -randFloat(0.3, 1);
      const risk = randInt(80, 120);
      const pnl = Math.round(rr * risk);
      const durationMin = randInt(8, 220);
      const exitTime = new Date(entryTime.getTime() + durationMin * 60000);
      const entryConfirmed = runsLate ? Math.random() > 0.55 : ['WEAK', 'POOR'].includes(tier) ? Math.random() > 0.3 : true;

      const candidate = { entryTime, pnl, rr, entryConfirmed };
      const { start: dayStart, end: dayEnd } = dayBounds(entryTime);
      const { start: weekStart, end: weekEnd } = weekBounds(entryTime);
      const sameDayTrades = allTrades.filter((t) => t.entryTime >= dayStart && t.entryTime < dayEnd);
      const sameWeekTrades = allTrades.filter((t) => t.entryTime >= weekStart && t.entryTime < weekEnd);

      const structuredRuleIds = evaluateActiveRules({ candidate, sameDayTrades, sameWeekTrades, rules });

      // Custom "no revenge trades" rule can't be auto-evaluated — flag it
      // manually when this trade follows closely after a same-day loss.
      const ruleIds = [...structuredRuleIds];
      const prev = allTrades[allTrades.length - 1];
      if (customRevengeRule && prev && prev.pnl < 0 && sameDayTrades.includes(prev)) {
        const gapMin = (entryTime.getTime() - prev.entryTime.getTime()) / 60000;
        if (gapMin >= 0 && gapMin <= 45 && Math.random() < 0.6) ruleIds.push(customRevengeRule.id);
      }

      const brokenWeights = rules.filter((r) => ruleIds.includes(r.id)).map((r) => r.weight);
      const { grade } = computeAutoGrade(brokenWeights);

      allTrades.push({
        symbol: pick(SYMBOLS),
        direction: Math.random() < 0.5 ? 'BUY' : 'SELL',
        entryTime,
        exitTime,
        pnl,
        rr: Number(rr.toFixed(2)),
        grade,
        autoGrade: grade,
        gradeOverridden: false,
        session: sessionForHour(entryTime.getUTCHours()),
        entryConfirmed,
        ruleBroken: ruleIds.length > 0,
        ruleIds,
      });
    }
  }

  for (const t of allTrades) {
    const { ruleIds, ...tradeData } = t;
    const created = await prisma.trade.create({ data: { ...tradeData, userId: user.id } });
    if (ruleIds.length) {
      await prisma.tradeRuleBreak.createMany({ data: ruleIds.map((ruleId) => ({ tradeId: created.id, ruleId })) });
    }
  }

  console.log(`Seeded user ${email} / ${password} with ${allTrades.length} trades and ${rules.length} rules.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
