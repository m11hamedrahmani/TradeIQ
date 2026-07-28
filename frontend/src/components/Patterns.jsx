export default function Patterns({ patterns }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">AI Patterns Detected</div>
          <div className="card-sub">computed from your logged trades</div>
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="empty-state">Log more trades to start surfacing patterns.</div>
      ) : (
        <div className="pattern-list">
          {patterns.map((p, idx) => (
            <div className={`pattern-item ${p.type}`} key={idx}>
              <div className="pattern-top">
                <div className="pattern-emoji">{p.emoji}</div>
                <div className="pattern-title">{p.title}</div>
              </div>
              <div className="pattern-body" dangerouslySetInnerHTML={{ __html: p.body }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
