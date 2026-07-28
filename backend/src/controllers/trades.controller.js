const prisma = require('../config/db');
const { getPeriodRange } = require('../utils/period');
const { parseTradesCsv } = require('../services/csv.service');
const { parseGradeLabel, inferGradeFromRR, inferSessionFromDate } = require('../services/grading.service');

const RULE_INCLUDE = { rule: { select: { id: true, title: true } } };

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
      include: RULE_INCLUDE,
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
      include: RULE_INCLUDE,
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
  const grade = parseGradeLabel(body.grade) || inferGradeFromRR(rr) || (Number(body.pnl) >= 0 ? 'B' : 'C');
  const session = ['ASIAN', 'LONDON', 'NEWYORK', 'OTHER'].includes(body.session)
    ? body.session
    : inferSessionFromDate(entryTime);

  // Linking a specific rule always implies the trade broke a rule, even if
  // the ruleBroken checkbox wasn't explicitly ticked by the caller.
  const ruleId = body.ruleId !== undefined && body.ruleId !== null && body.ruleId !== '' ? body.ruleId : null;
  const ruleBroken = ruleId ? true : body.ruleBroken !== undefined ? Boolean(body.ruleBroken) : false;

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
    grade,
    session,
    entryConfirmed: body.entryConfirmed !== undefined ? Boolean(body.entryConfirmed) : true,
    ruleBroken,
    ruleId,
    ruleNote: body.ruleNote || null,
    notes: body.notes || null,
  };
}

async function assertRuleOwnership(userId, ruleId) {
  if (!ruleId) return;
  const rule = await prisma.rule.findFirst({ where: { id: ruleId, userId } });
  if (!rule) {
    const err = new Error('Invalid rule selected');
    err.status = 400;
    throw err;
  }
}

async function create(req, res, next) {
  try {
    const data = buildTradeData(req.body);
    await assertRuleOwnership(req.userId, data.ruleId);
    const trade = await prisma.trade.create({ data: { ...data, userId: req.userId }, include: RULE_INCLUDE });
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
    await assertRuleOwnership(req.userId, data.ruleId);
    const trade = await prisma.trade.update({ where: { id: existing.id }, data, include: RULE_INCLUDE });
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

async function importCsv(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Attach a CSV as "file".' });
    }

    const { trades, errors } = parseTradesCsv(req.file.buffer);

    if (trades.length > 0) {
      await prisma.trade.createMany({
        data: trades.map((t) => ({ ...t, userId: req.userId })),
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

module.exports = { list, getOne, create, update, remove, importCsv };
