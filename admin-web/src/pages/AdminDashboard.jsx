import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}></span>
          <span className={styles.headerTitle}>RutaApp Admin</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userEmail}>{user?.email}</span>
          <button className={styles.logoutBtn} onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeIcon}></div>
          <h1 className={styles.welcomeTitle}>Panel Admin</h1>
          <p className={styles.welcomeSub}>
            Desde aquí supervisarás camiones, clientes y el cuadre del día.
            <br />
            (Fase 2 en construcción)
          </p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Ventas hoy</div>
            <div className={`${styles.statValue} ${styles.green}`}>—</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Camiones activos</div>
            <div className={`${styles.statValue} ${styles.amber}`}>—</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Cuentas x cobrar</div>
            <div className={`${styles.statValue} ${styles.red}`}>—</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Paradas hoy</div>
            <div className={styles.statValue}>—</div>
          </div>
        </div>
      </main>
    </div>
  );
}
