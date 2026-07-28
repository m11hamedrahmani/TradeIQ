const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const SYMBOLS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'USDCAD', 'NAS100'];

const GRADE_PROFILE = {
  APLUS: { winProb: 0.85, rr: [2.5, 4.5] },
  A: { winProb: 0.75, rr: [1.8, 3.0] },
  B: { winProb: 0.55, rr: [0.8, 2.0] },
  C: { winProb: 0.35, rr: [0.3, 1.2] },
  D: { winProb: 0.15, rr: [0.1, 0.8] },
};

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

function weightedGrade(sessionBiasGood) {
  const roll = Math.random();
  const table = sessionBiasGood
    ? [['APLUS', 0.4], ['A', 0.3], ['B', 0.18], ['C', 0.08], ['D', 0.04]]
    : [['APLUS', 0.15], ['A', 0.15], ['B', 0.25], ['C', 0.25], ['D', 0.2]];
  let acc = 0;
  for (const [grade, weight] of table) {
    acc += weight;
    if (roll <= acc) return grade;
  }
  return 'B';
}

const RULE_DEFS = [
  { title: 'No trades after 3pm', description: 'Avoid new entries after 15:00 GMT — this is when revenge trading creeps in.' },
  { title: 'Wait for confirmation', description: "Don't enter until the displacement/confirmation candle closes." },
  { title: 'Max 1% risk per trade', description: 'Never size a position beyond 1% account risk.' },
  { title: 'No revenge trades', description: "Don't re-enter within 30 minutes of a stopped-out loss." },
  { title: 'Respect daily stop-loss', description: 'Stop trading for the day once the max daily loss is hit.' },
];

function ruleNoteFor(title) {
  return {
    'No trades after 3pm': 'Entered after the 3pm cutoff',
    'Wait for confirmation': 'Entered before confirmation',
    'Max 1% risk per trade': 'Oversized risk',
    'No revenge trades': 'Revenge trade after a loss',
    'Respect daily stop-loss': 'Ignored daily stop',
  }[title] || 'Rule violation';
}

function buildTrade({ userId, entryTime, grade, forceConfirmedFalse, forceRuleBroken, rulesByTitle, preferredRuleTitles }) {
  const profile = GRADE_PROFILE[grade];
  const win = Math.random() < profile.winProb;
  const rr = win ? randFloat(profile.rr[0], profile.rr[1]) : -randFloat(0.3, 1);
  const risk = randInt(80, 120);
  const pnl = Math.round(rr * risk);
  const durationMin = randInt(8, 220);
  const exitTime = new Date(entryTime.getTime() + durationMin * 60000);
  const entryConfirmed = forceConfirmedFalse
    ? false
    : ['C', 'D'].includes(grade)
      ? Math.random() > 0.3
      : true;
  const ruleBroken = forceRuleBroken || grade === 'D' || Math.random() < 0.04;

  let ruleId = null;
  let ruleNote = null;
  if (ruleBroken) {
    // ~25% of breaks stay unlinked to a specific rule, mirroring real journals
    // where not every slip gets attributed to a named rule.
    const attributeToRule = Math.random() < 0.75;
    if (attributeToRule) {
      const titlePool = preferredRuleTitles && preferredRuleTitles.length ? preferredRuleTitles : Object.keys(rulesByTitle);
      const title = pick(titlePool);
      ruleId = rulesByTitle[title];
      ruleNote = ruleNoteFor(title);
    } else {
      ruleNote = pick(['Entered before confirmation', 'Oversized risk', 'Revenge trade after loss', 'Ignored daily stop']);
    }
  }

  return {
    userId,
    symbol: pick(SYMBOLS),
    direction: Math.random() < 0.5 ? 'BUY' : 'SELL',
    entryTime,
    exitTime,
    pnl,
    rr: Number(rr.toFixed(2)),
    grade,
    session: sessionForHour(entryTime.getUTCHours()),
    entryConfirmed,
    ruleBroken,
    ruleId,
    ruleNote,
  };
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
    RULE_DEFS.map((r) => prisma.rule.create({ data: { userId: user.id, title: r.title, description: r.description } }))
  );
  const rulesByTitle = Object.fromEntries(rules.map((r) => [r.title, r.id]));

  const trades = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const day = new Date(today.getTime() - daysAgo * DAY_MS);
    const dow = day.getUTCDay(); // 0 Sun ... 6 Sat

    if (dow === 0 && Math.random() > 0.1) continue;
    if (dow === 6 && Math.random() > 0.15) continue;

    const count = dow >= 1 && dow <= 5 ? randInt(2, 5) : randInt(1, 2);

    for (let i = 0; i < count; i++) {
      const useLondon = Math.random() < 0.55;
      const useNY = !useLondon && Math.random() < 0.6;
      const hour = useLondon ? randInt(7, 11) : useNY ? randInt(12, 20) : randInt(0, 6);
      const entryTime = new Date(day.getTime() + hour * 3600000 + randInt(0, 59) * 60000);
      const grade = weightedGrade(useLondon);
      trades.push(buildTrade({ userId: user.id, entryTime, grade, rulesByTitle }));
    }

    // Friday-afternoon revenge trading pattern: extra low-grade trades after 15:00 UTC
    if (dow === 5 && Math.random() < 0.65) {
      const extra = randInt(1, 2);
      for (let i = 0; i < extra; i++) {
        const hour = randInt(15, 19);
        const entryTime = new Date(day.getTime() + hour * 3600000 + randInt(0, 59) * 60000);
        const grade = Math.random() < 0.5 ? 'D' : 'C';
        trades.push(
          buildTrade({
            userId: user.id,
            entryTime,
            grade,
            forceConfirmedFalse: Math.random() < 0.7,
            forceRuleBroken: true,
            rulesByTitle,
            preferredRuleTitles: ['No trades after 3pm', 'No revenge trades'],
          })
        );
      }
    }
  }

  await prisma.trade.createMany({ data: trades });

  console.log(`Seeded user ${email} / ${password} with ${trades.length} trades.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
