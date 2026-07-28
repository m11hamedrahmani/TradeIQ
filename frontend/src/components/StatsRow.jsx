import { money } from '../lib/format';

function DeltaLine({ value, suffix, invert }) {
  if (value === null || value === undefined) return <div className="stat-delta">—</div>;
  const isUp = invert ? value < 0 : value > 0;
  const isDown = invert ? value > 0 : value < 0;
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
  const cls = isUp ? 'up' : isDown ? 'down' : '';
  return (
    <div className={`stat-delta ${cls}`}>
      {arrow} {value > 0 ? '+' : ''}
      {value}
      {suffix} vs last period
    </div>
  );
}

export default function StatsRow({ stats }) {
  const netPnlClass = stats.netPnl > 0 ? 'green' : stats.netPnl < 0 ? 'red' : '';

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Net P&L</div>
        <div className={`stat-value ${netPnlClass}`}>{money(stats.netPnl)}</div>
        <DeltaLine value={stats.deltas.netPnlPct} suffix="%" />
      </div>
      <div className="stat-card">
        <div className="stat-label">Win Rate</div>
        <div className="stat-value">{stats.winRate}%</div>
        <DeltaLine value={stats.deltas.winRatePct} suffix="%" />
      </div>
      <div className="stat-card">
        <div className="stat-label">Avg RR</div>
        <div className="stat-value">
          {stats.avgRR}
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>R</span>
        </div>
        <div className="stat-delta">Target: 2.0R</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Avg Grade</div>
        <div className="stat-value yellow">{stats.avgGrade}</div>
        <div className="stat-delta">Prev: {stats.deltas.previousAvgGrade}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Rule Breaks</div>
        <div className="stat-value red">{stats.ruleBreaks.count}</div>
        <div className="stat-delta down">Cost: {money(-stats.ruleBreaks.cost)}</div>
      </div>
    </div>
  );
}
