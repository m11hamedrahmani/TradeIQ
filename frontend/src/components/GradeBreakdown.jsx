import { useEffect, useState } from 'react';
import { gradeClass, money } from '../lib/format';

export default function GradeBreakdown({ breakdown, total }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [breakdown]);

  const winRateColor = (wr) => (wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--yellow)' : 'var(--red)');

  const aPlusA = breakdown.filter((g) => ['APLUS', 'A'].includes(g.grade));
  const cd = breakdown.filter((g) => ['C', 'D'].includes(g.grade));
  const aPlusAPnl = aPlusA.reduce((s, g) => s + g.totalPnl, 0);
  const cdPnl = cd.reduce((s, g) => s + g.totalPnl, 0);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Setup Grade Breakdown</div>
          <div className="card-sub">vs your A+ criteria</div>
        </div>
        <div className="card-badge yellow">{total} trades</div>
      </div>

      {total === 0 ? (
        <div className="empty-state">No graded trades yet.</div>
      ) : (
        <>
          <div className="grade-list">
            {breakdown.map((g) => (
              <div className="grade-item" key={g.grade}>
                <div className={`grade-label ${gradeClass(g.label)}`}>{g.label}</div>
                <div className="grade-bar-wrap">
                  <div
                    className={`grade-bar ${gradeClass(g.label)}`}
                    style={{ width: animated ? `${g.pct}%` : '0%' }}
                  />
                </div>
                <div className="grade-count">{g.count}</div>
                <div className="grade-winrate" style={{ color: winRateColor(g.winRate) }}>
                  {g.count > 0 ? `${g.winRate}%` : '—'}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            A/A+ trades: <span style={{ color: 'var(--green)', fontWeight: 700 }}>{money(aPlusAPnl)}</span>
            &nbsp;·&nbsp; C/D trades: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{money(cdPnl)}</span>
          </div>
        </>
      )}
    </div>
  );
}
