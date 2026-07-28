import { useMemo, useState } from 'react';
import { money, heatLevel } from '../lib/format';

function collectMaxAbs(rows, cellsKey) {
  let max = 0;
  rows.forEach((row) => {
    const cells = cellsKey ? row[cellsKey] : [row];
    cells.forEach((c) => {
      if (c.pnl !== null && c.pnl !== undefined) max = Math.max(max, Math.abs(c.pnl));
    });
  });
  return max;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="hmap-tooltip visible" style={{ left: tip.x + 14, top: tip.y - 10 }}>
      <div className="tt-day">{tip.day}</div>
      <div className={`tt-pnl ${tip.pnl < 0 ? 'neg' : 'pos'}`}>{tip.pnl === null ? '—' : money(tip.pnl)}</div>
      <div className="tt-trades">{tip.trades} trade{tip.trades === 1 ? '' : 's'}</div>
      <div className="tt-grade">Grade: <span>{tip.grade || '—'}</span></div>
    </div>
  );
}

export default function Heatmap({ heatmap }) {
  const [view, setView] = useState('day');
  const [tip, setTip] = useState(null);

  const maxAbsDay = useMemo(() => collectMaxAbs(heatmap.byDay.rows, 'cells'), [heatmap]);
  const maxAbsSession = useMemo(() => collectMaxAbs(heatmap.bySession.rows, 'cells'), [heatmap]);
  const maxAbsWeek = useMemo(() => collectMaxAbs(heatmap.byWeek), [heatmap]);

  function showTip(e, label, cell) {
    setTip({ x: e.clientX, y: e.clientY, day: label, pnl: cell.pnl, trades: cell.trades, grade: cell.avgGrade });
  }
  function moveTip(e) {
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }

  const { legend } = heatmap;

  return (
    <div className="heatmap-hero">
      <div className="heatmap-hero-header">
        <div>
          <div className="heatmap-hero-title">P&L Performance Map</div>
          <div className="heatmap-hero-sub">hover any cell for details · green = profitable · red = losing</div>
        </div>
        <div className="heatmap-view-tabs">
          {['day', 'session', 'week'].map((v) => (
            <div key={v} className={`heatmap-view-tab${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              By {v[0].toUpperCase() + v.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {view === 'day' && (
        <div className="heatmap-grid by-day">
          <div className="hmap-col-header"></div>
          {heatmap.byDay.columns.map((c) => (
            <div className="hmap-col-header" key={c}>{c}</div>
          ))}
          {heatmap.byDay.rows.map((row) => (
            <RowCells
              key={row.label}
              row={row}
              columns={heatmap.byDay.columns}
              maxAbs={maxAbsDay}
              onEnter={showTip}
              onMove={moveTip}
              onLeave={() => setTip(null)}
            />
          ))}
        </div>
      )}

      {view === 'session' && (
        <div className="heatmap-grid by-session">
          <div className="hmap-col-header"></div>
          {heatmap.bySession.columns.map((c) => (
            <div className="hmap-col-header" key={c}>{c}</div>
          ))}
          {heatmap.bySession.rows.map((row) => (
            <RowCells
              key={row.label}
              row={row}
              columns={heatmap.bySession.columns}
              maxAbs={maxAbsSession}
              onEnter={showTip}
              onMove={moveTip}
              onLeave={() => setTip(null)}
            />
          ))}
        </div>
      )}

      {view === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
          {heatmap.byWeek.map((cell) => (
            <div
              key={cell.label}
              className={`hmap-cell ${heatLevel(cell.pnl, maxAbsWeek)}`}
              style={{ height: 70, borderRadius: 10, flexDirection: 'column', display: 'flex' }}
              onMouseEnter={(e) => showTip(e, cell.label, cell)}
              onMouseMove={moveTip}
              onMouseLeave={() => setTip(null)}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                {cell.label}
              </div>
              <div className="cell-pnl" style={{ fontSize: 20 }}>{cell.pnl === null ? '—' : money(cell.pnl)}</div>
              <div className="cell-trades">{cell.trades} trades{cell.avgGrade ? ` · Avg ${cell.avgGrade}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      <div className="heatmap-legend">
        <div className="legend-scale">
          <span>Loss</span>
          <div className="legend-block" style={{ background: 'rgba(255,77,106,0.35)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(255,77,106,0.2)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(255,77,106,0.08)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(255,255,255,0.02)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(143,186,122,0.07)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(143,186,122,0.14)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(143,186,122,0.24)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(143,186,122,0.38)' }}></div>
          <div className="legend-block" style={{ background: 'rgba(143,186,122,0.55)' }}></div>
          <span>Best</span>
        </div>
        <div className="legend-summary">
          <div className="legend-stat">
            <div className="legend-stat-label">Best day</div>
            <div className="legend-stat-val" style={{ color: 'var(--green)' }}>
              {legend.bestDay ? `${legend.bestDay.label} · ${money(legend.bestDay.pnl)}` : '—'}
            </div>
          </div>
          <div className="legend-stat">
            <div className="legend-stat-label">Worst day</div>
            <div className="legend-stat-val" style={{ color: 'var(--red)' }}>
              {legend.worstDay ? `${legend.worstDay.label} · ${money(legend.worstDay.pnl)}` : '—'}
            </div>
          </div>
          <div className="legend-stat">
            <div className="legend-stat-label">Best session</div>
            <div className="legend-stat-val" style={{ color: 'var(--green)' }}>
              {legend.bestSession ? legend.bestSession.label : '—'}
            </div>
          </div>
        </div>
      </div>

      <Tooltip tip={tip} />
    </div>
  );
}

function RowCells({ row, columns, maxAbs, onEnter, onMove, onLeave }) {
  return (
    <>
      <div className="hmap-row-label">{row.label}</div>
      {row.cells.map((cell, idx) => (
        <div
          key={idx}
          className={`hmap-cell ${heatLevel(cell.pnl, maxAbs)}`}
          onMouseEnter={(e) => onEnter(e, `${columns[idx]} · ${row.label}`, cell)}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <div className="cell-pnl">{cell.pnl === null ? '—' : money(cell.pnl)}</div>
          {cell.trades > 0 && <div className="cell-trades">{cell.trades} trades</div>}
        </div>
      ))}
    </>
  );
}
