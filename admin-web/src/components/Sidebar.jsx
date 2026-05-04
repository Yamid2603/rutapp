import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wallet, CalendarDays, Settings, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/admin',           Icon: LayoutDashboard, label: 'Cuentas' },
  { to: '/admin/clientes',  Icon: Users,            label: 'Clientes' },
  { to: '/admin/cuadre',    Icon: Wallet,           label: 'Cuadre del día' },
  { to: '/admin/zonas',     Icon: CalendarDays,     label: 'Zonas & Carga' },
  { to: '/admin/gestion',   Icon: Settings,         label: 'Gestión' },
  { to: '/admin/analisis',  Icon: Sparkles,         label: 'Análisis IA' },
];

export default function Sidebar() {
  const { user, nombre, signOut } = useAuth();

  const initials = (nombre || user?.email || '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/logo-light.png" alt="RutaApp" className={styles.brandLogo} />
        <span className={styles.brandText}>RUTAAPP</span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className={styles.linkIcon}>
                  <Icon size={18} strokeWidth={isActive ? 2.6 : 2.2} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={styles.userSection}>
        <Link to="/admin/perfil" className={styles.userInfo} style={{ textDecoration: 'none' }}>
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userMeta}>
            <div className={styles.userName}>{nombre || user?.email}</div>
            <div className={styles.userRole}>Ver perfil →</div>
          </div>
        </Link>
        <button className={styles.logoutBtn} onClick={signOut}>Cerrar sesión</button>
      </div>
    </aside>
  );
}
