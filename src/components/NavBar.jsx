import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { signOut } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">📦</span>
        <span className="navbar-title">Stock Ledger</span>
      </div>
      <ul className="navbar-links">
        <li><NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink></li>
        <li><NavLink to="/warehouses" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Warehouses</NavLink></li>
        <li><NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Products</NavLink></li>
        <li><NavLink to="/products/new" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>+ New product</NavLink></li>
        <li><NavLink to="/stock-in" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Stock In</NavLink></li>
        <li><NavLink to="/stock-out" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Stock Out</NavLink></li>
        <li><NavLink to="/transfer" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Transfer</NavLink></li>
        <li><NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>History</NavLink></li>
        <li><NavLink to="/summary" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Monthly</NavLink></li>
      </ul>
      <button id="sign-out-btn" className="btn btn-ghost btn-sm" onClick={signOut}>
        Sign Out
      </button>
    </nav>
  );
}
