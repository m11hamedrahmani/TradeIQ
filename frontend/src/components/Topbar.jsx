export default function Topbar({ title, sub, right }) {
  return (
    <div className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      <div className="topbar-right">{right}</div>
    </div>
  );
}
