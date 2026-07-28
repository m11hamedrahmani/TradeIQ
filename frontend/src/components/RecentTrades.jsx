import { Link } from 'react-router-dom';
import { gradeClass, money } from '../lib/format';

export default function RecentTrades({ trades }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Recent Trades</div>
          <div className="card-sub">graded against your setup</div>
        </div>
        <Link to="/trades" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
          View all →
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="empty-state">No trades logged in this period yet.</div>
      ) : (
        <table className="trades-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Dir</th>
              <th>Grade</th>
              <th>RR</th>
              <th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td><span className="trade-symbol">{t.symbol}</span></td>
                <td><span className={`trade-dir ${t.direction.toLowerCase()}`}>{t.direction}</span></td>
                <td><span className={`trade-grade ${gradeClass(t.grade === 'APLUS' ? 'A+' : t.grade)}`}>{t.grade === 'APLUS' ? 'A+' : t.grade}</span></td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t.rr !== null ? `${t.rr}R` : '—'}</td>
                <td><span className={`trade-pnl ${t.pnl >= 0 ? 'pos' : 'neg'}`}>{money(t.pnl)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
