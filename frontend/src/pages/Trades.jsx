import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import TradeForm from '../components/TradeForm';
import CsvImportModal from '../components/CsvImportModal';
import { api } from '../api/client';
import { gradeClass, money } from '../lib/format';

const SESSION_LABELS = { ASIAN: 'Asian', LONDON: 'London', NEWYORK: 'New York', OTHER: 'Other' };

export default function Trades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ grade: '', session: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [showImport, setShowImport] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    const params = {};
    if (filters.grade) params.grade = filters.grade;
    if (filters.session) params.session = filters.session;
    api
      .listTrades(params)
      .then((res) => setTrades(res.trades))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters.grade, filters.session]);

  async function handleDelete(trade) {
    if (!confirm(`Delete ${trade.symbol} trade from ${new Date(trade.entryTime).toLocaleDateString()}?`)) return;
    try {
      await api.deleteTrade(trade.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function closeForm(refresh) {
    setShowForm(false);
    setEditingTrade(null);
    if (refresh) load();
  }

  return (
    <>
      <Topbar title="Trades" sub={`${trades.length} trades`} />
      <div className="content">
        <div className="trades-toolbar">
          <div className="trades-filters">
            <select value={filters.grade} onChange={(e) => setFilters((f) => ({ ...f, grade: e.target.value }))}>
              <option value="">All grades</option>
              <option value="APLUS">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            <select value={filters.session} onChange={(e) => setFilters((f) => ({ ...f, session: e.target.value }))}>
              <option value="">All sessions</option>
              <option value="ASIAN">Asian</option>
              <option value="LONDON">London</option>
              <option value="NEWYORK">New York</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="trades-actions">
            <button className="btn-upload" onClick={() => setShowImport(true)}>⬆ Import Trades</button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Trade</button>
          </div>
        </div>

        {loading && <div className="loading-state">Loading trades…</div>}
        {error && <div className="error-state">{error}</div>}

        {!loading && !error && (
          <div className="card">
            {trades.length === 0 ? (
              <div className="empty-state">No trades match these filters yet.</div>
            ) : (
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pair</th>
                    <th>Dir</th>
                    <th>Grade</th>
                    <th>Session</th>
                    <th>RR</th>
                    <th>P&L</th>
                    <th>Rule</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                        {new Date(t.entryTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td><span className="trade-symbol">{t.symbol}</span></td>
                      <td><span className={`trade-dir ${t.direction.toLowerCase()}`}>{t.direction}</span></td>
                      <td><span className={`trade-grade ${gradeClass(t.grade === 'APLUS' ? 'A+' : t.grade)}`}>{t.grade === 'APLUS' ? 'A+' : t.grade}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{SESSION_LABELS[t.session]}</td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t.rr !== null ? `${t.rr}R` : '—'}</td>
                      <td><span className={`trade-pnl ${t.pnl >= 0 ? 'pos' : 'neg'}`}>{money(t.pnl)}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {t.ruleBroken ? (
                          <span title={t.ruleNote || ''}>⚠️ {t.rule ? t.rule.title : t.ruleNote ? 'Other' : ''}</span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="link-btn" onClick={() => setEditingTrade(t)}>Edit</button>
                          <button className="link-btn danger" onClick={() => handleDelete(t)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {(showForm || editingTrade) && (
        <TradeForm trade={editingTrade} onClose={() => closeForm(false)} onSaved={() => closeForm(true)} />
      )}
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} onImported={load} />}
    </>
  );
}
