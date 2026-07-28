const { parseGradeLabel, inferGradeFromRR, inferSessionFromDate } = require('./grading.service');

const REQUIRED_COLUMNS = ['symbol', 'direction', 'entry_time', 'pnl'];
const SESSION_VALUES = new Set(['ASIAN', 'LONDON', 'NEWYORK', 'OTHER']);

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// Hand-rolled CSV parser: supports quoted fields, escaped quotes ("") and commas inside quotes.
function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function parseBool(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const val = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(val)) return true;
  if (['false', '0', 'no', 'n'].includes(val)) return false;
  return fallback;
}

function parseNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(/[$,]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Parses a raw CSV buffer into { trades, errors }. `trades` are objects ready
// to attach userId and pass to prisma.trade.create; `errors` lists 1-indexed
// row numbers (header excluded) with a human-readable reason for rows that
// couldn't be imported.
function parseTradesCsv(buffer) {
  const text = buffer.toString('utf8');
  const rows = parseCsvText(text);
  if (rows.length === 0) return { trades: [], errors: [] };

  const headers = rows[0].map(normalizeHeader);
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingRequired.length > 0) {
    const err = new Error(`CSV is missing required column(s): ${missingRequired.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const trades = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i; // header excluded, 1-indexed data rows
    const cells = rows[i];
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] !== undefined ? cells[idx].trim() : '';
    });

    try {
      const symbol = record.symbol;
      const direction = record.direction ? record.direction.trim().toUpperCase() : '';
      const entryTime = parseDate(record.entry_time);
      const pnl = parseNumber(record.pnl);

      if (!symbol) throw new Error('missing symbol');
      if (!['BUY', 'SELL'].includes(direction)) throw new Error('direction must be BUY or SELL');
      if (!entryTime) throw new Error('invalid or missing entry_time');
      if (pnl === null) throw new Error('invalid or missing pnl');

      const rr = parseNumber(record.rr);
      const explicitGrade = parseGradeLabel(record.grade);
      const grade = explicitGrade || inferGradeFromRR(rr) || (pnl >= 0 ? 'B' : 'C');

      const sessionRaw = record.session ? record.session.trim().toUpperCase() : '';
      const session = SESSION_VALUES.has(sessionRaw) ? sessionRaw : inferSessionFromDate(entryTime);

      trades.push({
        symbol: symbol.toUpperCase(),
        direction,
        entryPrice: parseNumber(record.entry_price),
        exitPrice: parseNumber(record.exit_price),
        size: parseNumber(record.size),
        entryTime,
        exitTime: parseDate(record.exit_time),
        pnl,
        rr,
        grade,
        session,
        entryConfirmed: parseBool(record.entry_confirmed, true),
        ruleBroken: parseBool(record.rule_broken, false),
        ruleNote: record.rule_note || null,
        notes: record.notes || null,
      });
    } catch (rowErr) {
      errors.push({ row: rowNumber, message: rowErr.message });
    }
  }

  return { trades, errors };
}

module.exports = { parseTradesCsv, REQUIRED_COLUMNS };
