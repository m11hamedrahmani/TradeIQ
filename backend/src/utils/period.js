const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS = { '1W': 7, '1M': 30, '3M': 90 };

function getPeriodRange(period) {
  const end = new Date();
  if (!period || period === 'ALL' || !PERIOD_DAYS[period]) {
    return { start: null, end };
  }
  const start = new Date(end.getTime() - PERIOD_DAYS[period] * DAY_MS);
  return { start, end };
}

function getPreviousPeriodRange(period) {
  const { start, end } = getPeriodRange(period);
  if (!start) return { start: null, end: null };
  const span = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - span), end: new Date(start.getTime()) };
}

module.exports = { getPeriodRange, getPreviousPeriodRange, PERIOD_DAYS };
