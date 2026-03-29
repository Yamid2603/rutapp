import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/admin',            icon: '📊', label: 'Cuentas' },
  { to: '/admin/clientes',   icon: '👥', label: 'Clientes' },
  { to: '/admin/cuadre',     icon: '💰', label: 'Cuadre del día' },
  { to: '/admin/zonas',      icon: '🗓️', label: 'Zonas & Carga' },
  { to: '/admin/gestion',    icon: '⚙️', label: 'Gestión' },
];

export default function Sidebar() {
  const { user, nombre, signOut } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🗺️</span>
        <span className={styles.brandText}>RUTAAPP</span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.linkIcon}>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.userSection}>
        <div className={styles.userName}>{nombre || user?.email}</div>
        <div className={styles.userRole}>Administrador</div>
        <button className={styles.logoutBtn} onClick={signOut}>Cerrar sesión</button>
      </div>
    </aside>
  );
}
