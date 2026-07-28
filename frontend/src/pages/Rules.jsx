import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import RuleForm from '../components/RuleForm';
import { api } from '../api/client';
import { money } from '../lib/format';

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.listRules(), api.dashboard('ALL')])
      .then(([rulesRes, dashboardRes]) => {
        setRules(rulesRes.rules);
        setBreakdown(dashboardRes.ruleBreakdown);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(rule) {
    try {
      await api.updateRule(rule.id, { active: !rule.active });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(rule) {
    if (!confirm(`Delete rule "${rule.title}"? Trades already linked to it will keep their rule-break flag but lose the link.`)) return;
    try {
      await api.deleteRule(rule.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function closeForm(refresh) {
    setShowForm(false);
    setEditingRule(null);
    if (refresh) load();
  }

  function statsFor(ruleId) {
    return breakdown.find((b) => b.ruleId === ruleId);
  }

  function describeType(rule) {
    const p = rule.params || {};
    switch (rule.type) {
      case 'MIN_RR': return `Min 1:${p.minRR} R:R`;
      case 'MAX_TRADES_PER_DAY': return `Max ${p.maxCount}/day`;
      case 'MAX_TRADES_PER_WEEK': return `Max ${p.maxCount}/week`;
      case 'NO_TRADES_AFTER_TIME': return `Cutoff ${String(p.cutoffHour).padStart(2, '0')}:00 UTC`;
      case 'MAX_DAILY_LOSS': return `Max daily loss $${p.maxLoss}`;
      case 'REQUIRE_CONFIRMATION': return 'Requires confirmation';
      default: return 'Custom';
    }
  }

  return (
    <>
      <Topbar title="My Rules" sub={`${rules.length} rules defined`} />
      <div className="content">
        <div className="trades-toolbar">
          <div />
          <div className="trades-actions">
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Rule</button>
          </div>
        </div>

        {loading && <div className="loading-state">Loading rules…</div>}
        {error && <div className="error-state">{error}</div>}

        {!loading && !error && (
          <div className="card">
            {rules.length === 0 ? (
              <div className="empty-state">
                No rules yet. Define the ones you break most often so TradeIQ can track them per trade.
              </div>
            ) : (
              <div className="pattern-list">
                {rules.map((rule) => {
                  const stats = statsFor(rule.id);
                  return (
                    <div className={`pattern-item rule-item ${rule.active ? '' : 'archived'}`} key={rule.id}>
                      <div className="pattern-top">
                        <div className="pattern-emoji">{rule.active ? '📏' : '🗄️'}</div>
                        <div className="pattern-title">{rule.title}</div>
                        <span className={`rule-weight ${rule.weight.toLowerCase()}`}>{rule.weight}</span>
                        {!rule.active && <span className="card-badge yellow">Archived</span>}
                      </div>
                      <div className="rule-type-badge" style={{ paddingLeft: 25, marginBottom: 4 }}>{describeType(rule)}</div>
                      {rule.description && <div className="pattern-body">{rule.description}</div>}
                      <div className="rule-footer">
                        <div className="rule-footer-stats">
                          {stats
                            ? `${stats.count} break${stats.count === 1 ? '' : 's'} · ${money(-stats.cost)} cost (all time)`
                            : 'No breaks logged yet'}
                        </div>
                        <div className="row-actions">
                          <button className="link-btn" onClick={() => setEditingRule(rule)}>Edit</button>
                          <button className="link-btn" onClick={() => toggleActive(rule)}>
                            {rule.active ? 'Archive' : 'Reactivate'}
                          </button>
                          <button className="link-btn danger" onClick={() => handleDelete(rule)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {(showForm || editingRule) && (
        <RuleForm rule={editingRule} onClose={() => closeForm(false)} onSaved={() => closeForm(true)} />
      )}
    </>
  );
}
