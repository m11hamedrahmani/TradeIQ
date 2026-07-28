import { useState } from 'react';
import { api } from '../api/client';

const RULE_TYPES = [
  { value: 'CUSTOM', label: 'Custom (manual judgment call)', hint: 'Not auto-detected — you tick it on a trade yourself.', params: [] },
  {
    value: 'MIN_RR',
    label: 'Minimum Risk:Reward',
    hint: 'Flags any trade whose realized R:R falls below the minimum.',
    params: [{ key: 'minRR', label: 'Minimum R:R (e.g. 2 = 1:2)', placeholder: '2', step: '0.1' }],
  },
  {
    value: 'MAX_TRADES_PER_DAY',
    label: 'Max trades per day',
    hint: 'Flags every trade beyond the daily cap.',
    params: [{ key: 'maxCount', label: 'Max trades per day', placeholder: '3', step: '1' }],
  },
  {
    value: 'MAX_TRADES_PER_WEEK',
    label: 'Max trades per week',
    hint: 'Flags every trade beyond the weekly cap.',
    params: [{ key: 'maxCount', label: 'Max trades per week', placeholder: '12', step: '1' }],
  },
  {
    value: 'NO_TRADES_AFTER_TIME',
    label: 'No trades after a set time',
    hint: 'Flags trades entered at or after the cutoff hour (UTC).',
    params: [{ key: 'cutoffHour', label: 'Cutoff hour, UTC (0-23)', placeholder: '15', step: '1' }],
  },
  {
    value: 'MAX_DAILY_LOSS',
    label: 'Max daily loss',
    hint: "Flags trades on any day where cumulative loss breaches the limit.",
    params: [{ key: 'maxLoss', label: 'Max daily loss ($)', placeholder: '300', step: '1' }],
  },
  {
    value: 'REQUIRE_CONFIRMATION',
    label: 'Require entry confirmation',
    hint: 'Flags trades marked as entered before confirmation.',
    params: [],
  },
];

const WEIGHT_OPTIONS = [
  ['LOW', 'Low — minor slip'],
  ['MEDIUM', 'Medium — meaningful'],
  ['HIGH', 'High — critical'],
];

function typeDef(type) {
  return RULE_TYPES.find((t) => t.value === type) || RULE_TYPES[0];
}

export default function RuleForm({ rule, onClose, onSaved }) {
  const isEdit = Boolean(rule);
  const [title, setTitle] = useState(rule?.title || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [type, setType] = useState(rule?.type || 'CUSTOM');
  const [weight, setWeight] = useState(rule?.weight || 'MEDIUM');
  const [params, setParams] = useState(rule?.params || {});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleTypeChange(newType) {
    setType(newType);
    setParams({});
  }

  function setParam(key, value) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), description: description.trim() || null, type, weight, params };
      if (isEdit) {
        await api.updateRule(rule.id, payload);
      } else {
        await api.createRule(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const activeType = typeDef(type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Rule' : 'New Rule'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. No trades after 3pm" required />
          </div>

          <div className="field">
            <label>Rule type</label>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
              {RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {activeType.hint && <div className="field-hint">{activeType.hint}</div>}
          </div>

          {activeType.params.map((p) => (
            <div className="field" key={p.key}>
              <label>{p.label}</label>
              <input
                type="number"
                step={p.step}
                value={params[p.key] ?? ''}
                onChange={(e) => setParam(p.key, e.target.value)}
                placeholder={p.placeholder}
                required
              />
            </div>
          ))}

          <div className="field">
            <label>Weight</label>
            <select value={weight} onChange={(e) => setWeight(e.target.value)}>
              {WEIGHT_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this rule exists" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
