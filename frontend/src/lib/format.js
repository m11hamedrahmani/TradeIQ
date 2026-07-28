export function money(n) {
  if (n === null || n === undefined) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export function gradeClass(label) {
  const key = (label || '').replace('+', 'plus').replace('-', '').toLowerCase();
  if (key.startsWith('aplus')) return 'aplus';
  if (key.startsWith('a')) return 'a';
  if (key.startsWith('b')) return 'b';
  if (key.startsWith('c')) return 'c';
  return 'd';
}

export function heatLevel(pnl, maxAbs) {
  if (pnl === null || pnl === undefined) return 'h-empty';
  if (maxAbs === 0) return pnl >= 0 ? 'h-p1' : 'h-n1';
  const ratio = Math.abs(pnl) / maxAbs;
  const bucket = Math.min(5, Math.max(1, Math.ceil(ratio * 5)));
  return pnl >= 0 ? `h-p${bucket}` : `h-n${Math.min(3, bucket)}`;
}

export function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
