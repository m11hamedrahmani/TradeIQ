const DAY_MS = 24 * 60 * 60 * 1000;

function dayBounds(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

// Monday 00:00 UTC through the following Monday.
function weekBounds(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDow = start.getUTCDay() === 0 ? 6 : start.getUTCDay() - 1; // Mon=0 ... Sun=6
  start.setUTCDate(start.getUTCDate() - isoDow);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { start, end };
}

module.exports = { dayBounds, weekBounds };
