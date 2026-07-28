const prisma = require('../config/db');

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

async function create(req, res, next) {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Rule title is required' });
    }
    const rule = await prisma.rule.create({
      data: { userId: req.userId, title: title.trim(), description: description || null },
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

    const { title, description, active } = req.body;
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Rule title cannot be empty' });
    }

    const rule = await prisma.rule.update({
      where: { id: existing.id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
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
