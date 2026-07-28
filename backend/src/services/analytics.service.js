const { gradeLabel, averageGradeLabel } = require('./grading.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const GRADES = ['APLUS', 'A', 'B', 'C', 'D'];
const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const SESSION_LABELS = { ASIAN: 'Asian', LONDON: 'London', NEWYORK: 'New York', OTHER: 'Other' };

function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

function pct(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function winRateOf(trades) {
  if (trades.length === 0) return 0;
  return pct(trades.filter((t) => t.pnl > 0).length, trades.length);
}

// Mon=0 ... Sun=6, converting from JS's getUTCDay() (Sun=0).
function weekdayIndex(date) {
  const d = date.getUTCDay();
  return d === 0 ? 6 : d - 1;
}

function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - weekdayIndex(d));
  return d;
}

// ---------- STATS ----------

function computeStats(trades) {
  const total = trades.length;
  const netPnl = sum(trades.map((t) => t.pnl));
  const winRate = winRateOf(trades);
  const rrTrades = trades.filter((t) => t.rr !== null && t.rr !== undefined);
  const avgRR = rrTrades.length ? sum(rrTrades.map((t) => t.rr)) / rrTrades.length : 0;
  const avgGrade = averageGradeLabel(trades);

  const ruleBreaks = trades.filter((t) => t.ruleBroken);
  const ruleBreakCost = sum(ruleBreaks.map((t) => Math.max(-t.pnl, 0)));

  return {
    total,
    netPnl: Math.round(netPnl),
    winRate: Number(winRate.toFixed(1)),
    avgRR: Number(avgRR.toFixed(2)),
    avgGrade,
    ruleBreaks: { count: ruleBreaks.length, cost: Math.round(ruleBreakCost) },
  };
}

function pctDelta(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function computeStatsWithDeltas(trades, prevTrades) {
  const current = computeStats(trades);
  const previous = computeStats(prevTrades);
  return {
    ...current,
    deltas: {
      netPnlPct: pctDelta(current.netPnl, previous.netPnl),
      winRatePct: pctDelta(current.winRate, previous.winRate),
      previousAvgGrade: previous.avgGrade,
    },
  };
}

// ---------- CUMULATIVE P&L SERIES ----------

function computeCumulativeSeries(trades, start, end) {
  if (trades.length === 0 && !start) return { labels: [], data: [] };

  const earliest = start || new Date(Math.min(...trades.map((t) => t.entryTime.getTime())));
  const dayStart = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), earliest.getUTCDate()));
  const dayEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  const pnlByDay = new Map();
  for (const t of trades) {
    const key = new Date(Date.UTC(t.entryTime.getUTCFullYear(), t.entryTime.getUTCMonth(), t.entryTime.getUTCDate())).getTime();
    pnlByDay.set(key, (pnlByDay.get(key) || 0) + t.pnl);
  }

  const labels = [];
  const data = [];
  let cumulative = 0;
  for (let d = dayStart.getTime(); d <= dayEnd.getTime(); d += DAY_MS) {
    cumulative += pnlByDay.get(d) || 0;
    const date = new Date(d);
    labels.push(`${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}`);
    data.push(Math.round(cumulative));
  }

  return { labels, data };
}

// ---------- GRADE BREAKDOWN ----------

function computeGradeBreakdown(trades) {
  const total = trades.length;
  return GRADES.map((grade) => {
    const gradeTrades = trades.filter((t) => t.grade === grade);
    return {
      grade,
      label: gradeLabel(grade),
      count: gradeTrades.length,
      pct: Number(pct(gradeTrades.length, total).toFixed(0)),
      winRate: Number(winRateOf(gradeTrades).toFixed(0)),
      totalPnl: Math.round(sum(gradeTrades.map((t) => t.pnl))),
    };
  });
}

// ---------- HEATMAP ----------

function emptyCell() {
  return { pnl: null, trades: 0, avgGrade: null };
}

function cellFrom(trades) {
  if (trades.length === 0) return emptyCell();
  return {
    pnl: Math.round(sum(trades.map((t) => t.pnl))),
    trades: trades.length,
    avgGrade: averageGradeLabel(trades),
  };
}

function weeksInRange(start, end) {
  const weeks = [];
  let cursor = mondayOf(start);
  const lastMonday = mondayOf(end);
  while (cursor.getTime() <= lastMonday.getTime()) {
    weeks.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 7 * DAY_MS);
  }
  return weeks;
}

function computeHeatmapByDay(trades, start, end) {
  const effectiveStart = start || (trades.length ? new Date(Math.min(...trades.map((t) => t.entryTime.getTime()))) : end);
  const weeks = weeksInRange(effectiveStart, end);

  const rows = weeks.map((weekStart, wIdx) => {
    const cells = WEEKDAY_LABELS.map((_, dIdx) => {
      const dayStart = new Date(weekStart.getTime() + dIdx * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const dayTrades = trades.filter((t) => t.entryTime >= dayStart && t.entryTime < dayEnd);
      return cellFrom(dayTrades);
    });
    return { label: `Week ${wIdx + 1}`, cells };
  });

  return { columns: WEEKDAY_LABELS, rows };
}

function computeHeatmapBySession(trades, start, end) {
  const sessions = ['ASIAN', 'LONDON', 'NEWYORK'];
  const rangeStart = start || (trades.length ? new Date(Math.min(...trades.map((t) => t.entryTime.getTime()))) : end);

  const rows = sessions.map((session) => {
    const cells = WEEKDAY_LABELS.slice(0, 5).map((_, dIdx) => {
      const dayTrades = trades.filter(
        (t) => t.session === session && weekdayIndex(t.entryTime) === dIdx && t.entryTime >= rangeStart && t.entryTime <= end
      );
      return cellFrom(dayTrades);
    });
    return { label: SESSION_LABELS[session], cells };
  });

  return { columns: WEEKDAY_LABELS.slice(0, 5), rows };
}

function computeHeatmapByWeek(trades, start, end) {
  const effectiveStart = start || (trades.length ? new Date(Math.min(...trades.map((t) => t.entryTime.getTime()))) : end);
  const weeks = weeksInRange(effectiveStart, end);

  return weeks.map((weekStart, idx) => {
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
    const weekTrades = trades.filter((t) => t.entryTime >= weekStart && t.entryTime < weekEnd);
    return { label: `Week ${idx + 1}`, ...cellFrom(weekTrades) };
  });
}

function computeHeatmapLegend(trades) {
  if (trades.length === 0) {
    return { bestDay: null, worstDay: null, bestSession: null };
  }

  const byWeekday = WEEKDAY_LABELS.map((label, idx) => ({
    label,
    pnl: sum(trades.filter((t) => weekdayIndex(t.entryTime) === idx).map((t) => t.pnl)),
  })).filter((d) => trades.some((t) => weekdayIndex(t.entryTime) === WEEKDAY_LABELS.indexOf(d.label)));

  const bestDay = byWeekday.reduce((a, b) => (b.pnl > a.pnl ? b : a), byWeekday[0]);
  const worstDay = byWeekday.reduce((a, b) => (b.pnl < a.pnl ? b : a), byWeekday[0]);

  const bySession = ['ASIAN', 'LONDON', 'NEWYORK', 'OTHER']
    .map((session) => ({
      session,
      label: SESSION_LABELS[session],
      pnl: sum(trades.filter((t) => t.session === session).map((t) => t.pnl)),
      count: trades.filter((t) => t.session === session).length,
    }))
    .filter((s) => s.count > 0);

  const bestSession = bySession.length ? bySession.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;

  return {
    bestDay: bestDay ? { label: bestDay.label, pnl: Math.round(bestDay.pnl) } : null,
    worstDay: worstDay ? { label: worstDay.label, pnl: Math.round(worstDay.pnl) } : null,
    bestSession: bestSession ? { label: bestSession.label, pnl: Math.round(bestSession.pnl) } : null,
  };
}

function computeHeatmap(trades, start, end) {
  return {
    byDay: computeHeatmapByDay(trades, start, end),
    bySession: computeHeatmapBySession(trades, start, end),
    byWeek: computeHeatmapByWeek(trades, start, end),
    legend: computeHeatmapLegend(trades),
  };
}

// ---------- RULE BREAKDOWN ----------

// Groups rule-broken trades by every specific rule they violated (a trade
// can break several at once, and contributes its full cost to each one it
// broke), falling back to an "unspecified" bucket for freeform breaks with
// no rule link, so the worst-offending rule surfaces by frequency and $ cost.
function computeRuleBreakdown(trades) {
  const broken = trades.filter((t) => t.ruleBroken);
  const map = new Map();

  const bump = (key, title, cost) => {
    if (!map.has(key)) map.set(key, { ruleId: key === 'unlinked' ? null : key, title, count: 0, cost: 0 });
    const entry = map.get(key);
    entry.count += 1;
    entry.cost += cost;
  };

  for (const t of broken) {
    const cost = Math.max(-t.pnl, 0);
    const links = t.ruleBreaks || [];
    if (links.length === 0) {
      bump('unlinked', 'Unspecified rule break', cost);
    } else {
      for (const link of links) {
        bump(link.ruleId, link.rule ? link.rule.title : 'Unspecified rule break', cost);
      }
    }
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, cost: Math.round(e.cost) }))
    .sort((a, b) => b.cost - a.cost || b.count - a.count);
}

// ---------- PATTERN DETECTION ----------

function detectBestSessionPattern(trades) {
  const sessions = ['ASIAN', 'LONDON', 'NEWYORK'];
  const candidates = sessions
    .map((session) => trades.filter((t) => t.session === session))
    .filter((group) => group.length >= 3)
    .map((group) => ({ session: group[0].session, group, winRate: winRateOf(group) }));

  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (b.winRate > a.winRate ? b : a));
  if (best.winRate < 60) return null;

  const totalWins = trades.filter((t) => t.pnl > 0).length;
  const winsInSession = best.group.filter((t) => t.pnl > 0).length;
  const shareOfWins = totalWins > 0 ? Math.round(pct(winsInSession, totalWins)) : 0;

  return {
    type: 'positive',
    emoji: '✅',
    title: `${SESSION_LABELS[best.session]} session is your edge`,
    body: `${shareOfWins}% of your profitable trades happen during the <strong>${SESSION_LABELS[best.session]}</strong> session, with a <strong>${Math.round(best.winRate)}% win rate</strong> across ${best.group.length} trades.`,
  };
}

function detectRevengeTradingPattern(trades) {
  const lateTrades = trades.filter((t) => t.entryTime.getUTCHours() >= 15);
  if (lateTrades.length < 3) return null;

  const overallCDRate = pct(trades.filter((t) => ['C', 'D'].includes(t.grade)).length, trades.length);

  const byWeekday = Array.from({ length: 7 }, (_, idx) => {
    const dayLate = lateTrades.filter((t) => weekdayIndex(t.entryTime) === idx);
    const cd = dayLate.filter((t) => ['C', 'D'].includes(t.grade));
    return { idx, label: WEEKDAY_LABELS[idx], dayLate, cd };
  }).filter((d) => d.cd.length >= 2);

  if (byWeekday.length === 0) return null;

  const worst = byWeekday.reduce((a, b) => (b.cd.length > a.cd.length ? b : a));
  const worstRate = pct(worst.cd.length, worst.dayLate.length);
  if (overallCDRate === 0 || worstRate < overallCDRate * 1.5) return null;

  const multiplier = Math.max(1, Math.round(worstRate / Math.max(overallCDRate, 1)));
  const cost = Math.round(sum(worst.cd.map((t) => Math.max(-t.pnl, 0))));
  const dayName = worst.label[0] + worst.label.slice(1).toLowerCase();

  return {
    type: 'warning',
    emoji: '⚠️',
    title: `${dayName} afternoon revenge trading`,
    body: `You take <strong>${multiplier}x more C/D trades</strong> on ${dayName}s after 3pm.${cost > 0 ? ` Estimated cost: <strong>$${cost}</strong>.` : ''}`,
  };
}

function detectEarlyEntryPattern(trades) {
  const lowGrade = [...trades]
    .filter((t) => ['B', 'C', 'D'].includes(t.grade))
    .sort((a, b) => b.entryTime - a.entryTime)
    .slice(0, 8);

  if (lowGrade.length < 4) return null;

  const unconfirmed = lowGrade.filter((t) => t.entryConfirmed === false);
  if (unconfirmed.length < 3 || unconfirmed.length / lowGrade.length < 0.5) return null;

  return {
    type: 'warning',
    emoji: '🔁',
    title: 'Early entry pattern',
    body: `Last <strong>${unconfirmed.length} B-grade-or-below trades</strong> were entered before confirmation. One recurring mistake.`,
  };
}

function detectPatterns(trades) {
  if (trades.length < 5) return [];
  return [detectBestSessionPattern(trades), detectRevengeTradingPattern(trades), detectEarlyEntryPattern(trades)].filter(Boolean);
}

// ---------- AI COACH BANNER ----------

function computeInsightBanner(trades) {
  if (trades.length < 5) {
    return 'Log at least 5 trades to unlock AI-powered coaching insights based on your real trading data.';
  }

  const aplus = trades.filter((t) => t.grade === 'APLUS');
  const aplusWinRate = Math.round(winRateOf(aplus));
  const aplusTakeRate = Math.round(pct(aplus.length, trades.length));

  const cd = trades.filter((t) => ['C', 'D'].includes(t.grade));
  const cdCost = Math.round(sum(cd.map((t) => Math.max(-t.pnl, 0))));

  const legend = computeHeatmapLegend(trades);
  const bestSessionLabel = legend.bestSession ? legend.bestSession.label : 'your best';

  if (aplus.length < 3) {
    return `You've logged ${trades.length} trades so far. Keep journaling grades and sessions consistently so TradeIQ can start surfacing patterns in your A+ setups.`;
  }

  return `Your <strong>A+ setups have a ${aplusWinRate}% win rate</strong> this period — but you're only taking them ${aplusTakeRate}% of the time. Your C/D grade trades are costing you an estimated <strong>$${cdCost}</strong>. Stick to your ${bestSessionLabel} session entries.`;
}

module.exports = {
  computeStats,
  computeStatsWithDeltas,
  computeCumulativeSeries,
  computeGradeBreakdown,
  computeHeatmap,
  computeRuleBreakdown,
  detectPatterns,
  computeInsightBanner,
};
