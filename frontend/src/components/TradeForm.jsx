import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Mirrors backend/src/services/grading-engine.service.js so the form can show
// an instant grade preview without a round trip on every checkbox toggle.
const WEIGHT_POINTS = { LOW: 10, MEDIUM: 20, HIGH: 35 };
function previewGrade(weights) {
  const deduction = weights.reduce((s, w) => s + (WEIGHT_POINTS[w] || 0), 0);
  const score = Math.max(0, 100 - deduction);
  if (score >= 100) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

const GRADE_OPTIONS = ['A+', 'A', 'B', 'C', 'D'];
const SESSION_OPTIONS = [
  ['', 'Auto (from entry time)'],
  ['ASIAN', 'Asian'],
  ['LONDON', 'London'],
  ['NEWYORK', 'New York'],
  ['OTHER', 'Other'],
];

export default function TradeForm({ trade, onClose, onSaved }) {
  const isEdit = Boolean(trade);
  const existingRuleIds = trade?.ruleBreaks?.map((b) => b.ruleId) || [];

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
    session: trade?.session || '',
    entryConfirmed: trade?.entryConfirmed ?? true,
    ruleIds: existingRuleIds,
    otherRuleBroken: trade ? trade.ruleBroken && existingRuleIds.length === 0 : false,
    ruleNote: trade?.ruleNote || '',
    notes: trade?.notes || '',
    overrideGrade: trade?.gradeOverridden ?? false,
    gradeChoice: trade?.grade === 'APLUS' ? 'A+' : trade?.grade || 'A+',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rules, setRules] = useState([]);
  const [suggestedRuleIds, setSuggestedRuleIds] = useState([]);

  useEffect(() => {
    api
      .listRules()
      .then((res) => setRules(res.rules))
      .catch(() => setRules([]));
  }, []);

  // Auto-suggest which structured rules this trade likely broke, based on
  // sibling trades already in the DB. Purely additive — never unchecks a box
  // the user has control over, and never overrides a manual override grade.
  useEffect(() => {
    if (!form.entryTime) return;
    const timer = setTimeout(() => {
      api
        .evaluateTrade({
          entryTime: new Date(form.entryTime).toISOString(),
          pnl: form.pnl === '' ? 0 : Number(form.pnl),
          rr: form.rr === '' ? null : Number(form.rr),
          entryConfirmed: form.entryConfirmed,
          excludeTradeId: trade?.id,
        })
        .then((res) => {
          setSuggestedRuleIds(res.violatedRuleIds);
          setForm((f) => ({ ...f, ruleIds: Array.from(new Set([...f.ruleIds, ...res.violatedRuleIds])) }));
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.entryTime, form.pnl, form.rr, form.entryConfirmed]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleRule(ruleId) {
    setForm((f) => ({
      ...f,
      ruleIds: f.ruleIds.includes(ruleId) ? f.ruleIds.filter((id) => id !== ruleId) : [...f.ruleIds, ruleId],
    }));
  }

  const autoGrade = useMemo(() => {
    const weights = rules.filter((r) => form.ruleIds.includes(r.id)).map((r) => r.weight);
    return previewGrade(weights);
  }, [rules, form.ruleIds]);

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
        session: form.session || undefined,
        entryConfirmed: form.entryConfirmed,
        ruleIds: form.ruleIds,
        ruleBroken: form.otherRuleBroken,
        ruleNote: form.otherRuleBroken || form.ruleIds.length ? form.ruleNote || null : null,
        gradeOverride: form.overrideGrade ? form.gradeChoice : null,
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

            <div className="field full">
              <label>Rules broken (check all that apply)</label>
              <div className="rule-checklist">
                {rules.length === 0 && <div className="empty-state" style={{ padding: '4px 0' }}>No rules defined yet.</div>}
                {rules.map((r) => (
                  <div className={`rule-check-row${suggestedRuleIds.includes(r.id) ? ' suggested' : ''}`} key={r.id}>
                    <input
                      type="checkbox"
                      id={`rule-${r.id}`}
                      checked={form.ruleIds.includes(r.id)}
                      onChange={() => toggleRule(r.id)}
                    />
                    <label htmlFor={`rule-${r.id}`}>
                      {r.title}{!r.active ? ' (archived)' : ''}
                    </label>
                    {suggestedRuleIds.includes(r.id) && <span className="rule-suggested-tag">auto</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="field full checkbox-field">
              <input
                type="checkbox"
                id="otherRuleBroken"
                checked={form.otherRuleBroken}
                onChange={(e) => set('otherRuleBroken', e.target.checked)}
              />
              <label htmlFor="otherRuleBroken">Broke something else (not listed above)</label>
            </div>

            {(form.ruleIds.length > 0 || form.otherRuleBroken) && (
              <div className="field full">
                <label>Rule-break note (optional)</label>
                <input value={form.ruleNote} onChange={(e) => set('ruleNote', e.target.value)} placeholder="extra context" />
              </div>
            )}

            <div className="field full">
              <div className="grade-preview">
                <span className="grade-preview-label">{form.overrideGrade ? 'Your grade' : 'Auto grade'}</span>
                <span className="grade-preview-value">{form.overrideGrade ? form.gradeChoice : autoGrade}</span>
                {!form.overrideGrade && <span className="field-hint" style={{ margin: 0 }}>computed from rules broken above</span>}
              </div>
              <div className="checkbox-field" style={{ marginBottom: form.overrideGrade ? 10 : 0 }}>
                <input
                  type="checkbox"
                  id="overrideGrade"
                  checked={form.overrideGrade}
                  onChange={(e) => set('overrideGrade', e.target.checked)}
                />
                <label htmlFor="overrideGrade">Override with my own grade</label>
              </div>
              {form.overrideGrade && (
                <select value={form.gradeChoice} onChange={(e) => set('gradeChoice', e.target.value)}>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
            </div>

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
