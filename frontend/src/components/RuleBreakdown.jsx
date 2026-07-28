import { Link } from 'react-router-dom';
import { money } from '../lib/format';

export default function RuleBreakdown({ breakdown }) {
  const maxCost = Math.max(1, ...breakdown.map((b) => b.cost));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Rule Breaks by Rule</div>
          <div className="card-sub">which rule costs you the most</div>
        </div>
        <Link to="/rules" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
          Manage rules →
        </Link>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty-state">No rule breaks in this period. Clean journal, or log more trades to see this fill in.</div>
      ) : (
        <div className="grade-list">
          {breakdown.map((b) => (
            <div className="grade-item" key={b.ruleId || 'unlinked'}>
              <div
                className="grade-label d"
                style={{ width: 'auto', minWidth: 28, padding: '0 8px', fontSize: 10 }}
                title={b.title}
              >
                {b.count}×
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.title}
              </div>
              <div className="grade-bar-wrap" style={{ maxWidth: 90 }}>
                <div className="grade-bar d" style={{ width: `${(b.cost / maxCost) * 100}%` }} />
              </div>
              <div className="grade-winrate" style={{ color: 'var(--red)', width: 56 }}>{money(-b.cost)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
