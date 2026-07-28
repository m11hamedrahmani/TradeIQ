const prisma = require('../config/db');
const { validateRuleParams } = require('../services/rule-engine.service');

const VALID_TYPES = ['CUSTOM', 'MIN_RR', 'MAX_TRADES_PER_DAY', 'MAX_TRADES_PER_WEEK', 'NO_TRADES_AFTER_TIME', 'MAX_DAILY_LOSS', 'REQUIRE_CONFIRMATION'];
const VALID_WEIGHTS = ['LOW', 'MEDIUM', 'HIGH'];

async function list(req, res, next) {
  try {
    const rules = await prisma.rule.findMany({
      where: { userId: req.userId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}

function parseTypeAndParams(body) {
  const type = body.type && VALID_TYPES.includes(body.type) ? body.type : 'CUSTOM';
  const params = validateRuleParams(type, body.params);
  return { type, params: Object.keys(params).length ? params : null };
}

async function create(req, res, next) {
  try {
    const { title, description, weight } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Rule title is required' });
    }
    const { type, params } = parseTypeAndParams(req.body);
    const ruleWeight = VALID_WEIGHTS.includes(weight) ? weight : 'MEDIUM';

    const rule = await prisma.rule.create({
      data: { userId: req.userId, title: title.trim(), description: description || null, type, params, weight: ruleWeight },
    });
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.rule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const { title, description, active, weight } = req.body;
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Rule title cannot be empty' });
    }

    let typeUpdate;
    let paramsUpdate;
    if (req.body.type !== undefined || req.body.params !== undefined) {
      const merged = { type: req.body.type !== undefined ? req.body.type : existing.type, params: req.body.params !== undefined ? req.body.params : existing.params };
      const parsed = parseTypeAndParams(merged);
      typeUpdate = parsed.type;
      paramsUpdate = parsed.params;
    }

    const rule = await prisma.rule.update({
      where: { id: existing.id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
        weight: VALID_WEIGHTS.includes(weight) ? weight : undefined,
        type: typeUpdate,
        params: paramsUpdate,
      },
    });
    res.json({ rule });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.rule.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Rule not found' });
    await prisma.rule.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
