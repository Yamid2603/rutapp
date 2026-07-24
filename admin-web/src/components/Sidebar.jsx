import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Wallet, CalendarDays, Settings, Sparkles, AlertTriangle, Receipt, ChartNoAxesCombined, Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOperacionesFallidas } from '../hooks/useCollection';
import styles from './Sidebar.module.css';

const NAV = [
  { to: '/admin',           Icon: LayoutDashboard, label: 'Resumen' },
  { to: '/admin/clientes',  Icon: Users,            label: 'Clientes' },
  { to: '/admin/productos', Icon: Package,          label: 'Productos' },
  { to: '/admin/cuadre',    Icon: Wallet,           label: 'Cuadre del día' },
  { to: '/admin/gastos-empresa', Icon: Receipt,     label: 'Gastos de empresa', modulo: 'gastos' },
  { to: '/admin/balance',   Icon: ChartNoAxesCombined, label: 'Balance',         modulo: 'balance' },
  { to: '/admin/comodato',  Icon: Boxes,               label: 'Activos en Préstamo', modulo: 'comodato' },
  { to: '/admin/zonas',     Icon: CalendarDays,     label: 'Zonas & Carga' },
  { to: '/admin/gestion',   Icon: Settings,         label: 'Gestión' },
  { to: '/admin/analisis',  Icon: Sparkles,         label: 'Análisis IA' },
  { to: '/admin/pendientes', Icon: AlertTriangle,   label: 'Pendientes sin sincronizar' },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, nombre, empresaId, modulosHabilitados, signOut } = useAuth();
  const { docs: pendientes } = useOperacionesFallidas(empresaId);

  const nav = NAV.filter(({ modulo }) => !modulo || modulosHabilitados.includes(modulo));

  const initials = (nombre || user?.email || '?')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand}>
        <img src="/logo-light.png" alt="RutaApp" className={styles.brandLogo} />
        <span className={styles.brandText}>RUTAAPP</span>
      </div>

      <nav className={styles.nav}>
        {nav.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            onClick={onClose}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className={styles.linkIcon}>
                  <Icon size={18} strokeWidth={isActive ? 2.6 : 2.2} />
                </span>
                <span>{label}</span>
                {to === '/admin/pendientes' && pendientes.length > 0 && (
                  <span className={styles.navBadge}>{pendientes.length}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={styles.userSection}>
        <Link to="/admin/perfil" onClick={onClose} className={styles.userInfo} style={{ textDecoration: 'none' }}>
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
