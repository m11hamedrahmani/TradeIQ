import { useEffect, useState } from 'react';
import { api } from '../api/client';

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const GRADE_OPTIONS = ['', 'A+', 'A', 'B', 'C', 'D'];
const SESSION_OPTIONS = [
  ['', 'Auto (from entry time)'],
  ['ASIAN', 'Asian'],
  ['LONDON', 'London'],
  ['NEWYORK', 'New York'],
  ['OTHER', 'Other'],
];

export default function TradeForm({ trade, onClose, onSaved }) {
  const isEdit = Boolean(trade);
  const [form, setForm] = useState({
    symbol: trade?.symbol || '',
    direction: trade?.direction || 'BUY',
    entryTime: toLocalInputValue(trade?.entryTime) || toLocalInputValue(new Date().toISOString()),
    exitTime: toLocalInputValue(trade?.exitTime) || '',
    entryPrice: trade?.entryPrice ?? '',
    exitPrice: trade?.exitPrice ?? '',
    size: trade?.size ?? '',
    pnl: trade?.pnl ?? '',
    rr: trade?.rr ?? '',
    grade: trade?.grade === 'APLUS' ? 'A+' : trade?.grade || '',
    session: trade?.session || '',
    entryConfirmed: trade?.entryConfirmed ?? true,
    ruleBroken: trade?.ruleBroken ?? false,
    ruleId: trade?.ruleId || trade?.rule?.id || '',
    ruleNote: trade?.ruleNote || '',
    notes: trade?.notes || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    api
      .listRules()
      .then((res) => setRules(res.rules))
      .catch(() => setRules([]));
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entryTime: new Date(form.entryTime).toISOString(),
        exitTime: form.exitTime ? new Date(form.exitTime).toISOString() : null,
        entryPrice: form.entryPrice === '' ? null : Number(form.entryPrice),
        exitPrice: form.exitPrice === '' ? null : Number(form.exitPrice),
        size: form.size === '' ? null : Number(form.size),
        pnl: Number(form.pnl),
        rr: form.rr === '' ? null : Number(form.rr),
        grade: form.grade || undefined,
        session: form.session || undefined,
        entryConfirmed: form.entryConfirmed,
        ruleBroken: form.ruleBroken,
        ruleId: form.ruleBroken ? form.ruleId || null : null,
        ruleNote: form.ruleBroken ? form.ruleNote || null : null,
        notes: form.notes || null,
      };

      if (isEdit) {
        await api.updateTrade(trade.id, payload);
      } else {
        await api.createTrade(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Trade' : 'Add Trade'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Symbol</label>
              <input value={form.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="EURUSD" required />
            </div>
            <div className="field">
              <label>Direction</label>
              <select value={form.direction} onChange={(e) => set('direction', e.target.value)}>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>

            <div className="field">
              <label>Entry Time</label>
              <input type="datetime-local" value={form.entryTime} onChange={(e) => set('entryTime', e.target.value)} required />
            </div>
            <div className="field">
              <label>Exit Time</label>
              <input type="datetime-local" value={form.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
            </div>

            <div className="field">
              <label>Entry Price</label>
              <input type="number" step="any" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Exit Price</label>
              <input type="number" step="any" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
            </div>

            <div className="field">
              <label>Size</label>
              <input type="number" step="any" value={form.size} onChange={(e) => set('size', e.target.value)} />
            </div>
            <div className="field">
              <label>RR</label>
              <input type="number" step="any" value={form.rr} onChange={(e) => set('rr', e.target.value)} />
            </div>

            <div className="field">
              <label>P&L ($)</label>
              <input type="number" step="any" value={form.pnl} onChange={(e) => set('pnl', e.target.value)} required />
            </div>
            <div className="field">
              <label>Grade</label>
              <select value={form.grade} onChange={(e) => set('grade', e.target.value)}>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g === '' ? 'Auto (from RR)' : g}</option>
                ))}
              </select>
            </div>

            <div className="field full">
              <label>Session</label>
              <select value={form.session} onChange={(e) => set('session', e.target.value)}>
                {SESSION_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="field full checkbox-field">
              <input
                type="checkbox"
                id="entryConfirmed"
                checked={form.entryConfirmed}
                onChange={(e) => set('entryConfirmed', e.target.checked)}
              />
              <label htmlFor="entryConfirmed">Entered after confirmation (not early)</label>
            </div>

            <div className="field full checkbox-field">
              <input
                type="checkbox"
                id="ruleBroken"
                checked={form.ruleBroken}
                onChange={(e) => set('ruleBroken', e.target.checked)}
              />
              <label htmlFor="ruleBroken">This trade broke one of my rules</label>
            </div>

            {form.ruleBroken && (
              <>
                <div className="field full">
                  <label>Which Rule?</label>
                  <select value={form.ruleId} onChange={(e) => set('ruleId', e.target.value)}>
                    <option value="">Unspecified / other</option>
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}{!r.active ? ' (archived)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field full">
                  <label>Rule Note</label>
                  <input value={form.ruleNote} onChange={(e) => set('ruleNote', e.target.value)} placeholder="extra context, optional" />
                </div>
              </>
            )}

            <div className="field full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
