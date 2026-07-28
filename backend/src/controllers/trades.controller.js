const prisma = require('../config/db');
const { getPeriodRange } = require('../utils/period');
const { dayBounds, weekBounds } = require('../utils/dateBuckets');
const { parseTradesCsv } = require('../services/csv.service');
const { parseGradeLabel, inferSessionFromDate } = require('../services/grading.service');
const { evaluateActiveRules } = require('../services/rule-engine.service');
const { computeAutoGrade } = require('../services/grading-engine.service');

const RULE_BREAKS_INCLUDE = {
  ruleBreaks: { include: { rule: { select: { id: true, title: true, weight: true, type: true } } } },
};

function toDateRangeWhere(userId, period, from, to) {
  const where = { userId };
  if (from || to) {
    where.entryTime = {};
    if (from) where.entryTime.gte = new Date(from);
    if (to) where.entryTime.lte = new Date(to);
  } else if (period) {
    const { start, end } = getPeriodRange(period);
    where.entryTime = { lte: end };
    if (start) where.entryTime.gte = start;
  }
  return where;
}

async function list(req, res, next) {
  try {
    const { period, from, to, symbol, grade, session } = req.query;
    const where = toDateRangeWhere(req.userId, period, from, to);
    if (symbol) where.symbol = symbol.toUpperCase();
    if (grade) where.grade = grade;
    if (session) where.session = session;

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { entryTime: 'desc' },
      include: RULE_BREAKS_INCLUDE,
    });
    res.json({ trades });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: RULE_BREAKS_INCLUDE,
    });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

function buildTradeData(body) {
  const entryTime = body.entryTime ? new Date(body.entryTime) : null;
  if (!entryTime || Number.isNaN(entryTime.getTime())) {
    const err = new Error('entryTime is required and must be a valid date');
    err.status = 400;
    throw err;
  }
  if (!body.symbol) {
    const err = new Error('symbol is required');
    err.status = 400;
    throw err;
  }
  if (!['BUY', 'SELL'].includes(body.direction)) {
    const err = new Error('direction must be BUY or SELL');
    err.status = 400;
    throw err;
  }
  if (body.pnl === undefined || body.pnl === null || Number.isNaN(Number(body.pnl))) {
    const err = new Error('pnl is required and must be a number');
    err.status = 400;
    throw err;
  }

  const rr = body.rr !== undefined && body.rr !== null && body.rr !== '' ? Number(body.rr) : null;
  const session = ['ASIAN', 'LONDON', 'NEWYORK', 'OTHER'].includes(body.session)
    ? body.session
    : inferSessionFromDate(entryTime);

  return {
    symbol: body.symbol.toUpperCase(),
    direction: body.direction,
    entryPrice: body.entryPrice !== undefined && body.entryPrice !== null && body.entryPrice !== '' ? Number(body.entryPrice) : null,
    exitPrice: body.exitPrice !== undefined && body.exitPrice !== null && body.exitPrice !== '' ? Number(body.exitPrice) : null,
    size: body.size !== undefined && body.size !== null && body.size !== '' ? Number(body.size) : null,
    entryTime,
    exitTime: body.exitTime ? new Date(body.exitTime) : null,
    pnl: Number(body.pnl),
    rr,
    session,
    entryConfirmed: body.entryConfirmed !== undefined ? Boolean(body.entryConfirmed) : true,
    ruleNote: body.ruleNote || null,
    notes: body.notes || null,
  };
}

// Resolves the confirmed rule-break set + grade for a trade being saved.
// `body.ruleIds` is the final, user-confirmed list of rules this trade broke
// (pre-populated in the UI by the auto-evaluate preview, but editable) — the
// server trusts ownership-validated ids and computes grade from their weights.
async function resolveRulesAndGrade(userId, body) {
  const ruleIds = Array.isArray(body.ruleIds) ? [...new Set(body.ruleIds.filter(Boolean))] : [];

  let rules = [];
  if (ruleIds.length) {
    rules = await prisma.rule.findMany({ where: { id: { in: ruleIds }, userId } });
    if (rules.length !== ruleIds.length) {
      const err = new Error('One or more selected rules are invalid');
      err.status = 400;
      throw err;
    }
  }

  const { grade: autoGrade } = computeAutoGrade(rules.map((r) => r.weight));
  const overrideLabel = body.gradeOverride ? parseGradeLabel(body.gradeOverride) : null;
  const grade = overrideLabel || autoGrade;
  const gradeOverridden = Boolean(overrideLabel);
  const ruleBroken = ruleIds.length > 0 || Boolean(body.ruleBroken);

  return { ruleIds, autoGrade, grade, gradeOverridden, ruleBroken };
}

async function create(req, res, next) {
  try {
    const data = buildTradeData(req.body);
    const { ruleIds, autoGrade, grade, gradeOverridden, ruleBroken } = await resolveRulesAndGrade(req.userId, req.body);

    const trade = await prisma.$transaction(async (tx) => {
      const created = await tx.trade.create({
        data: { ...data, userId: req.userId, grade, autoGrade, gradeOverridden, ruleBroken },
      });
      if (ruleIds.length) {
        await tx.tradeRuleBreak.createMany({ data: ruleIds.map((ruleId) => ({ tradeId: created.id, ruleId })) });
      }
      return tx.trade.findUnique({ where: { id: created.id }, include: RULE_BREAKS_INCLUDE });
    });

    res.status(201).json({ trade });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.trade.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Trade not found' });

    const merged = { ...existing, ...req.body };
    const data = buildTradeData(merged);
    const { ruleIds, autoGrade, grade, gradeOverridden, ruleBroken } = await resolveRulesAndGrade(req.userId, req.body);

    const trade = await prisma.$transaction(async (tx) => {
      await tx.tradeRuleBreak.deleteMany({ where: { tradeId: existing.id } });
      await tx.trade.update({
        where: { id: existing.id },
        data: { ...data, grade, autoGrade, gradeOverridden, ruleBroken },
      });
      if (ruleIds.length) {
        await tx.tradeRuleBreak.createMany({ data: ruleIds.map((ruleId) => ({ tradeId: existing.id, ruleId })) });
      }
      return tx.trade.findUnique({ where: { id: existing.id }, include: RULE_BREAKS_INCLUDE });
    });

    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.trade.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Trade not found' });
    await prisma.trade.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Preview endpoint: given a draft trade's key fields, returns which active
// structured rules it would violate, so the UI can pre-check the rule
// checklist before the user confirms and saves. Not authoritative — the
// confirmed ruleIds[] sent on create/update is what actually gets stored.
async function evaluate(req, res, next) {
  try {
    const { entryTime, pnl, rr, entryConfirmed, excludeTradeId } = req.body;
    const time = entryTime ? new Date(entryTime) : null;
    if (!time || Number.isNaN(time.getTime())) {
      return res.status(400).json({ error: 'entryTime is required' });
    }

    const candidate = {
      entryTime: time,
      pnl: pnl !== undefined && pnl !== null && pnl !== '' ? Number(pnl) : 0,
      rr: rr !== undefined && rr !== null && rr !== '' ? Number(rr) : null,
      entryConfirmed: entryConfirmed !== undefined ? Boolean(entryConfirmed) : true,
    };

    const { start: dayStart, end: dayEnd } = dayBounds(time);
    const { start: weekStart, end: weekEnd } = weekBounds(time);
    const excludeClause = excludeTradeId ? { id: { not: excludeTradeId } } : {};

    const [rules, sameDayTrades, sameWeekTrades] = await Promise.all([
      prisma.rule.findMany({ where: { userId: req.userId, active: true } }),
      prisma.trade.findMany({
        where: { userId: req.userId, entryTime: { gte: dayStart, lt: dayEnd }, ...excludeClause },
        select: { pnl: true },
      }),
      prisma.trade.findMany({
        where: { userId: req.userId, entryTime: { gte: weekStart, lt: weekEnd }, ...excludeClause },
        select: { pnl: true },
      }),
    ]);

    const violatedRuleIds = evaluateActiveRules({ candidate, sameDayTrades, sameWeekTrades, rules });
    res.json({ violatedRuleIds });
  } catch (err) {
    next(err);
  }
}

async function importCsv(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Attach a CSV as "file".' });
    }

    const { trades, errors } = parseTradesCsv(req.file.buffer);

    if (trades.length > 0) {
      await prisma.trade.createMany({
        data: trades.map((t) => ({ ...t, userId: req.userId, autoGrade: t.grade })),
      });
    }

    res.json({
      imported: trades.length,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, importCsv, evaluate };
