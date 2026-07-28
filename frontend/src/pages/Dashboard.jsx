import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import InsightBanner from '../components/InsightBanner';
import StatsRow from '../components/StatsRow';
import Heatmap from '../components/Heatmap';
import PnlChart from '../components/PnlChart';
import GradeBreakdown from '../components/GradeBreakdown';
import RuleBreakdown from '../components/RuleBreakdown';
import RecentTrades from '../components/RecentTrades';
import Patterns from '../components/Patterns';
import { api } from '../api/client';
import { money } from '../lib/format';

const PERIODS = ['1W', '1M', '3M', 'ALL'];

export default function Dashboard() {
  const [period, setPeriod] = useState('1M');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .dashboard(period)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <>
      <Topbar
        title="Dashboard"
        sub={data ? `${data.tradeCount} trades logged` : ''}
        right={
          <div className="period-tabs">
            {PERIODS.map((p) => (
              <button key={p} className={`period-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                {p === 'ALL' ? 'All' : p}
              </button>
            ))}
          </div>
        }
      />
      <div className="content">
        {loading && <div className="loading-state">Loading dashboard…</div>}
        {error && <div className="error-state">{error}</div>}

        {data && !loading && (
          <>
            <InsightBanner text={data.insightBanner} />
            <StatsRow stats={data.stats} />
            <Heatmap heatmap={data.heatmap} />

            <div className="main-grid">
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Cumulative P&L</div>
                    <div className="card-sub">{period === 'ALL' ? 'all time' : period} · daily</div>
                  </div>
                  <div className={`card-badge ${data.stats.netPnl >= 0 ? 'green' : ''}`}>{money(data.stats.netPnl)}</div>
                </div>
                <PnlChart series={data.cumulativePnl} />
              </div>

              <GradeBreakdown breakdown={data.gradeBreakdown} total={data.tradeCount} />
            </div>

            <RuleBreakdown breakdown={data.ruleBreakdown} />

            <div className="bottom-grid">
              <RecentTrades trades={data.recentTrades} />
              <Patterns patterns={data.patterns} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
