export default function InsightBanner({ text }) {
  return (
    <div className="insight-banner">
      <div style={{ fontSize: 20, flexShrink: 0 }}>🤖</div>
      <div className="insight-text" dangerouslySetInnerHTML={{ __html: text }} />
      <div className="insight-badge">AI Coach</div>
    </div>
  );
}
