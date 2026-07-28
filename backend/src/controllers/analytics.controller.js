const prisma = require('../config/db');
const { getPeriodRange, getPreviousPeriodRange } = require('../utils/period');
const {
  computeStatsWithDeltas,
  computeCumulativeSeries,
  computeGradeBreakdown,
  computeHeatmap,
  computeRuleBreakdown,
  detectPatterns,
  computeInsightBanner,
} = require('../services/analytics.service');

async function fetchTrades(userId, start, end) {
  const where = { userId };
  if (start || end) {
    where.entryTime = {};
    if (start) where.entryTime.gte = start;
    if (end) where.entryTime.lte = end;
  }
  return prisma.trade.findMany({
    where,
    orderBy: { entryTime: 'asc' },
    include: { rule: { select: { id: true, title: true } } },
  });
}

async function dashboard(req, res, next) {
  try {
    const period = req.query.period || '1M';
    const { start, end } = getPeriodRange(period);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(period);

    const trades = await fetchTrades(req.userId, start, end);
    const prevTrades = prevStart ? await fetchTrades(req.userId, prevStart, prevEnd) : [];

    const recentTrades = [...trades].sort((a, b) => b.entryTime - a.entryTime).slice(0, 8);

    res.json({
      period,
      range: { start, end },
      stats: computeStatsWithDeltas(trades, prevTrades),
      insightBanner: computeInsightBanner(trades),
      cumulativePnl: computeCumulativeSeries(trades, start, end),
      gradeBreakdown: computeGradeBreakdown(trades),
      heatmap: computeHeatmap(trades, start, end),
      ruleBreakdown: computeRuleBreakdown(trades),
      patterns: detectPatterns(trades),
      recentTrades,
      tradeCount: trades.length,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard };
