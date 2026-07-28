import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MAIN_LINKS = [
  { to: '/', icon: '⬛', label: 'Dashboard' },
  { to: '/trades', icon: '📋', label: 'Trades' },
];

const DISABLED_MAIN = [
  { icon: '📊', label: 'Analytics' },
  { icon: '📝', label: 'Journal' },
  { icon: '📅', label: 'Weekly Report' },
];

const SETUP_LINKS = [{ icon: '🎯', label: 'My Strategy' }, { icon: '🏦', label: 'Prop Firm Prep' }];

const ACCOUNT_LINKS = [
  { icon: '🔗', label: 'Connections' },
  { icon: '⚙️', label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">T</div>
        <div className="logo-text">Trade<span>IQ</span></div>
      </div>

      <div className="nav-section">
        <div className="nav-label">Main</div>
        {MAIN_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{link.icon}</span> {link.label}
          </NavLink>
        ))}
        {DISABLED_MAIN.map((link) => (
          <div className="nav-item disabled" key={link.label} title="Coming soon">
            <span className="nav-icon">{link.icon}</span> {link.label}
          </div>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-label">Setup</div>
        <NavLink to="/rules" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📏</span> My Rules
        </NavLink>
        {SETUP_LINKS.map((link) => (
          <div className="nav-item disabled" key={link.label} title="Coming soon">
            <span className="nav-icon">{link.icon}</span> {link.label}
          </div>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-label">Account</div>
        {ACCOUNT_LINKS.map((link) => (
          <div className="nav-item disabled" key={link.label} title="Coming soon">
            <span className="nav-icon">{link.icon}</span> {link.label}
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        <button className="user-card" onClick={logout} title="Log out">
          <div className="user-avatar">{(user?.name || '?')[0].toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-plan">{user?.plan} PLAN</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
