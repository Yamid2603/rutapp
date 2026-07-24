import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBalance } from '../hooks/useBalance';
import styles from './DashboardPage.module.css';

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}
function primerDiaMes(fecha) {
  return `${fecha.slice(0, 7)}-01`;
}

const PERIODOS = [
  { key: 'mes', label: 'Este mes' },
  { key: '6meses', label: 'Últimos 6 meses' },
  { key: 'anio', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
];

export default function BalancePage() {
  const { empresaId } = useAuth();
  const [periodo, setPeriodo] = useState('mes');
  const [customDesde, setCustomDesde] = useState(primerDiaMes(hoyISO()));
  const [customHasta, setCustomHasta] = useState(hoyISO());

  const { periodoDesde, periodoHasta } = useMemo(() => {
    const hoy = hoyISO();
    if (periodo === 'mes') return { periodoDesde: primerDiaMes(hoy), periodoHasta: hoy };
    if (periodo === '6meses') {
      const d = new Date();
      d.setMonth(d.getMonth() - 5);
      return { periodoDesde: primerDiaMes(d.toISOString().split('T')[0]), periodoHasta: hoy };
    }
    if (periodo === 'anio') return { periodoDesde: `${hoy.slice(0, 4)}-01-01`, periodoHasta: hoy };
    return { periodoDesde: customDesde, periodoHasta: customHasta };
  }, [periodo, customDesde, customHasta]);

  const { balance, loading, error } = useBalance(empresaId, periodoDesde, periodoHasta);

  function money(n) {
    return '$' + Math.round(n || 0).toLocaleString('es-CO');
  }

  return (
    <div>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Balance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Ventas menos gastos por categoría, mes a mes — calculado en tiempo real contra Firestore.
            Ventas = todas las transacciones del período (caja diaria y clientes de facturación por igual,
            sin contar dos veces).
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: periodo === p.key ? '2px solid var(--teal)' : '1px solid var(--cream-border)',
              background: periodo === p.key ? 'var(--teal)' : 'white',
              color: periodo === p.key ? 'white' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            {p.label}
          </button>
        ))}
        {periodo === 'custom' && (
          <>
            <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--cream-border)', fontSize: 13 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
            <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--cream-border)', fontSize: 13 }} />
          </>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Calculando...</p>
      ) : error ? (
        <p className={styles.red}>{error}</p>
      ) : !balance ? null : (
        <div className={styles.card} style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mes</th>
                {balance.nombresCategoria.map(n => <th key={n}>{n}</th>)}
                <th>Sin clasificar</th>
                <th>Ventas</th>
                <th>Gastos</th>
                <th>Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {balance.filas.map(f => (
                <tr key={f.mes}>
                  <td className={styles.bold}>{f.mes}</td>
                  {balance.nombresCategoria.map(n => (
                    <td key={n}>{f.porCategoria[n] ? money(f.porCategoria[n]) : '—'}</td>
                  ))}
                  <td className={f.sinClasificar > 0 ? styles.red : undefined}>
                    {f.sinClasificar > 0 ? money(f.sinClasificar) : '—'}
                  </td>
                  <td>{money(f.ventas)}</td>
                  <td>{money(f.gastosTotal)}</td>
                  <td className={f.utilidad >= 0 ? styles.green : styles.red}>{money(f.utilidad)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--cream-border)' }}>
                <td className={styles.bold}>TOTAL</td>
                {balance.nombresCategoria.map(n => (
                  <td key={n}>{money(balance.resumenAnual.porCategoria[n])}</td>
                ))}
                <td className={balance.resumenAnual.sinClasificar > 0 ? styles.red : undefined}>
                  {money(balance.resumenAnual.sinClasificar)}
                </td>
                <td>{money(balance.resumenAnual.ventas)}</td>
                <td>{money(balance.resumenAnual.gastosTotal)}</td>
                <td className={balance.resumenAnual.utilidad >= 0 ? styles.green : styles.red}>
                  {money(balance.resumenAnual.utilidad)}
                </td>
              </tr>
            </tbody>
          </table>
          {!balance.nombresCategoria.length && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
              Esta empresa todavía no tiene categorías de gasto configuradas (Gestión → Categorías de gasto) —
              todo gasto de ruta cae en "Sin clasificar" hasta que existan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
