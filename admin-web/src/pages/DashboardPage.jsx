import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRutas, useClientes, useCamiones, useUsuarios, useProductos } from '../hooks/useCollection';
import { today, getWeekRange, getMonthRange, getPrevMonthRange, isInRange } from '../utils/dates';
import { money, pct } from '../utils/format';
import PeriodSelector from '../components/PeriodSelector';
import BarChart from '../components/BarChart';
import LineChart from '../components/LineChart';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { empresaId } = useAuth();
  const { docs: rutas } = useRutas(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: usuarios } = useUsuarios(empresaId);
  const { docs: productos } = useProductos(empresaId);
  const [period, setPeriod] = useState('day');

  const hoy = today();
  const week = getWeekRange();
  const month = getMonthRange();
  const prevMonth = getPrevMonthRange();

  function rutasInRange(start, end) {
    return rutas.filter(r => isInRange(r.fecha, start, end));
  }

  const stats = useMemo(() => {
    let filtered, prevFiltered;
    if (period === 'day') {
      filtered = rutas.filter(r => r.fecha === hoy);
      prevFiltered = [];
    } else if (period === 'week') {
      filtered = rutasInRange(week.start, week.end);
      prevFiltered = [];
    } else {
      filtered = rutasInRange(month.start, month.end);
      prevFiltered = rutasInRange(prevMonth.start, prevMonth.end);
    }

    const totalVentas = filtered.reduce((sum, r) => {
      return sum + (r.paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0);
    }, 0);

    const prevTotalVentas = prevFiltered.reduce((sum, r) => {
      return sum + (r.paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0);
    }, 0);

    const cuentasPorCobrar = clientes.reduce((sum, c) => sum + (c.deuda || 0), 0);

    // Contar camiones únicos con ruta hoy (dedup por camionId); excluir completadas
    const camionesActivos = new Set(
      filtered.filter(r => r.estado === 'activa' && !r.deleted).map(r => r.camionId)
    ).size;

    const totalParadas = filtered.reduce((s, r) => s + (r.paradas || []).length, 0);
    const paradasCompletadas = filtered.reduce((s, r) =>
      s + (r.paradas || []).filter(p => p.estado !== 'pendiente').length, 0);

    // Weekly bar chart data
    const weeklyData = week.days.map(day => {
      return rutas.filter(r => r.fecha === day).reduce((sum, r) =>
        sum + (r.paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0), 0);
    });

    // Monthly line chart data
    const monthlyData = month.weeks.map(w => {
      return rutasInRange(w.start, w.end).reduce((sum, r) =>
        sum + (r.paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0), 0);
    });

    // Top 3 clients
    const clientSales = {};
    filtered.forEach(r => {
      (r.paradas || []).forEach(p => {
        if (p.totalVenta) clientSales[p.clienteId] = (clientSales[p.clienteId] || 0) + p.totalVenta;
      });
    });
    const topClients = Object.entries(clientSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, total]) => ({
        nombre: clientes.find(c => c.id === id)?.nombre || id,
        total,
      }));

    // Top 3 products
    const prodSales = {};
    filtered.forEach(r => {
      (r.paradas || []).forEach(p => {
        Object.entries(p.cantidades || {}).forEach(([pid, qty]) => {
          prodSales[pid] = (prodSales[pid] || 0) + qty;
        });
      });
    });
    const topProducts = Object.entries(prodSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, qty]) => ({
        nombre: productos.find(p => p.id === id)?.nombre || id,
        qty,
      }));

    // Top conductor
    const conductorSales = {};
    filtered.forEach(r => {
      const total = (r.paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0);
      conductorSales[r.conductorId] = (conductorSales[r.conductorId] || 0) + total;
    });
    const topConductor = Object.entries(conductorSales).sort((a, b) => b[1] - a[1])[0];

    // Comparison
    const comparativo = prevTotalVentas > 0
      ? Math.round(((totalVentas - prevTotalVentas) / prevTotalVentas) * 100)
      : null;

    return {
      totalVentas, cuentasPorCobrar, camionesActivos,
      totalParadas, paradasCompletadas,
      weeklyData, monthlyData,
      topClients, topProducts, topConductor,
      comparativo,
    };
  }, [rutas, clientes, productos, period]);

  // Camiones activos: una fila por camión (dedupe) con estado correcto.
  // Regla: si la ruta está completada → "Terminada".
  //        si está activa con al menos 1 parada visitada → "Activa".
  //        si está activa sin paradas visitadas → "Por iniciar".
  // Cuando un camión tiene varias rutas hoy, priorizamos la 'activa'; si todas están
  // completadas, tomamos la que más paradas hechas tiene.
  const camionesHoy = useMemo(() => {
    const rutasHoy = rutas.filter(r => r.fecha === hoy && !r.deleted);
    const porCamion = new Map();
    for (const r of rutasHoy) {
      if (!r.camionId) continue;
      const list = porCamion.get(r.camionId) || [];
      list.push(r);
      porCamion.set(r.camionId, list);
    }

    return Array.from(porCamion.entries()).map(([camionId, ruteList]) => {
      // Elegir la ruta representativa: prefiero 'activa', si no, la de más paradas hechas
      const activa = ruteList.find(r => r.estado === 'activa');
      const r = activa || [...ruteList].sort((a, b) => {
        const doneA = (a.paradas || []).filter(p => p.estado !== 'pendiente').length;
        const doneB = (b.paradas || []).filter(p => p.estado !== 'pendiente').length;
        return doneB - doneA;
      })[0];

      const camion = camiones.find(c => c.id === camionId);
      const conductor = usuarios.find(u => u.id === r.conductorId);
      const total = r.paradas?.length || 0;
      const done = r.paradas?.filter(p => p.estado !== 'pendiente').length || 0;
      const ventas = r.paradas?.reduce((s, p) => s + (p.totalVenta || 0), 0) || 0;

      let estadoVisual;
      if (r.estado === 'completada') estadoVisual = 'Terminada';
      else if (done > 0) estadoVisual = 'Activa';
      else estadoVisual = 'Por iniciar';

      return {
        camion: camion?.nombre || camionId,
        conductor: conductor?.nombre || r.conductorId,
        progreso: `${done}/${total}`,
        ventas,
        estado: r.estado,
        estadoVisual,
      };
    });
  }, [rutas, camiones, usuarios, hoy]);

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Cuentas</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ventas</div>
          <div className={`${styles.statValue} ${styles.green}`}>{money(stats.totalVentas)}</div>
          {period === 'month' && stats.comparativo != null && (
            <div className={stats.comparativo >= 0 ? styles.tagGreen : styles.tagRed}>
              {stats.comparativo >= 0 ? '+' : ''}{stats.comparativo}% vs mes anterior
            </div>
          )}
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Cuentas por cobrar</div>
          <div className={`${styles.statValue} ${styles.red}`}>{money(stats.cuentasPorCobrar)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Camiones activos</div>
          <div className={`${styles.statValue} ${styles.accent}`}>{stats.camionesActivos}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Paradas completadas</div>
          <div className={styles.statValue}>
            {stats.paradasCompletadas}/{stats.totalParadas}{' '}
            <span className={styles.pct}>({pct(stats.paradasCompletadas, stats.totalParadas)})</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      {period === 'week' && (
        <div className={styles.chartSection}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Ventas por día</h3>
            <BarChart data={stats.weeklyData} labels={week.labels} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Top 3 clientes</h3>
            {stats.topClients.length ? stats.topClients.map((c, i) => (
              <div key={i} className={styles.topRow}>
                <span className={styles.topRank}>#{i + 1}</span>
                <span className={styles.topName}>{c.nombre}</span>
                <span className={styles.topVal}>{money(c.total)}</span>
              </div>
            )) : <p className={styles.empty}>Sin datos</p>}
            <h3 className={styles.cardTitle} style={{ marginTop: 16 }}>Top 3 productos</h3>
            {stats.topProducts.length ? stats.topProducts.map((p, i) => (
              <div key={i} className={styles.topRow}>
                <span className={styles.topRank}>#{i + 1}</span>
                <span className={styles.topName}>{p.nombre}</span>
                <span className={styles.topVal}>{p.qty} uds</span>
              </div>
            )) : <p className={styles.empty}>Sin datos</p>}
          </div>
        </div>
      )}

      {period === 'month' && (
        <div className={styles.chartSection}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Ventas por semana</h3>
            <LineChart data={stats.monthlyData} labels={month.weeks.map(w => w.label)} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Mayor deuda acumulada</h3>
            {[...clientes].sort((a, b) => (b.deuda || 0) - (a.deuda || 0)).slice(0, 3).map((c, i) => (
              <div key={i} className={styles.topRow}>
                <span className={styles.topRank}>#{i + 1}</span>
                <span className={styles.topName}>{c.nombre}</span>
                <span className={`${styles.topVal} ${styles.red}`}>{money(c.deuda)}</span>
              </div>
            ))}
            {stats.topConductor && (
              <>
                <h3 className={styles.cardTitle} style={{ marginTop: 16 }}>Conductor top</h3>
                <div className={styles.topRow}>
                  <span className={styles.topName}>
                    {usuarios.find(u => u.id === stats.topConductor[0])?.nombre || stats.topConductor[0]}
                  </span>
                  <span className={`${styles.topVal} ${styles.green}`}>{money(stats.topConductor[1])}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Camiones activos table */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>Camiones de hoy</h3>
        {camionesHoy.length === 0 ? (
          <p className={styles.empty}>No hay camiones en ruta hoy</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Camión</th>
                <th>Progreso</th>
                <th>Ventas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {camionesHoy.map((c, i) => {
                const badgeClass =
                  c.estadoVisual === 'Activa' ? styles.badgeGreen
                  : c.estadoVisual === 'Terminada' ? styles.badgeMuted
                  : styles.badgeTeal;
                return (
                  <tr key={i}>
                    <td>{c.conductor}</td>
                    <td>{c.camion}</td>
                    <td>{c.progreso}</td>
                    <td className={styles.green}>{money(c.ventas)}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass}`}>{c.estadoVisual}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
