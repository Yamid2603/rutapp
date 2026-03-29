import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRutas, useProductos, useCamiones, useUsuarios } from '../hooks/useCollection';
import { today, getWeekRange, getMonthRange, isInRange } from '../utils/dates';
import { money } from '../utils/format';
import PeriodSelector from '../components/PeriodSelector';
import styles from './CuadrePage.module.css';

export default function CuadrePage() {
  const { empresaId } = useAuth();
  const { docs: rutas } = useRutas(empresaId);
  const { docs: productos } = useProductos(empresaId);
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: usuarios } = useUsuarios(empresaId);
  const [period, setPeriod] = useState('day');
  const [fecha, setFecha] = useState(today());

  const week = getWeekRange();
  const month = getMonthRange();

  const filtered = useMemo(() => {
    if (period === 'day') return rutas.filter(r => r.fecha === fecha);
    if (period === 'week') return rutas.filter(r => isInRange(r.fecha, week.start, week.end));
    return rutas.filter(r => isInRange(r.fecha, month.start, month.end));
  }, [rutas, period, fecha]);

  // Group by camion
  const byCamion = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.camionId]) map[r.camionId] = [];
      map[r.camionId].push(r);
    });
    return Object.entries(map).map(([camionId, rutasList]) => {
      const camion = camiones.find(c => c.id === camionId);
      const conductor = usuarios.find(u => u.id === rutasList[0]?.conductorId);

      let totalVentas = 0, totalCobrado = 0, totalGastos = 0, totalVacios = 0;
      const inventarioSalida = {};
      const inventarioVendido = {};
      const inventarioDevuelto = {};
      const cobros = { efectivo: 0, nequi: 0, pago_directo: 0, por_cobrar: 0 };
      const gastosList = [];

      rutasList.forEach(r => {
        // Inventario inicial
        Object.entries(r.inventarioInicial || {}).forEach(([pid, qty]) => {
          inventarioSalida[pid] = (inventarioSalida[pid] || 0) + qty;
        });

        (r.paradas || []).forEach(p => {
          totalVentas += p.totalVenta || 0;
          totalCobrado += p.totalCobrado || 0;
          totalVacios += p.garrafonesVaciosRecogidos || 0;

          // Vendido
          Object.entries(p.cantidades || {}).forEach(([pid, qty]) => {
            if (p.estado !== 'pendiente') {
              inventarioVendido[pid] = (inventarioVendido[pid] || 0) + qty;
            }
          });

          // Cobros por forma
          const fp = p.formaPago || 'efectivo';
          if (p.totalCobrado) cobros[fp] = (cobros[fp] || 0) + p.totalCobrado;
        });

        (r.devoluciones || []).forEach(d => {
          const pid = d.productoId || d.id;
          inventarioDevuelto[pid] = (inventarioDevuelto[pid] || 0) + (d.cantidad || 0);
        });

        (r.gastos || []).forEach(g => {
          totalGastos += g.monto || 0;
          gastosList.push(g);
        });
      });

      const porCobrar = totalVentas - totalCobrado;

      return {
        camionId, camion, conductor, rutasList,
        totalVentas, totalCobrado, totalGastos, totalVacios,
        inventarioSalida, inventarioVendido, inventarioDevuelto,
        cobros, gastosList, porCobrar,
        neto: totalCobrado - totalGastos,
      };
    });
  }, [filtered, camiones, usuarios]);

  const totals = useMemo(() => {
    return byCamion.reduce((acc, c) => ({
      ventas: acc.ventas + c.totalVentas,
      cobrado: acc.cobrado + c.totalCobrado,
      porCobrar: acc.porCobrar + c.porCobrar,
      gastos: acc.gastos + c.totalGastos,
      neto: acc.neto + c.neto,
    }), { ventas: 0, cobrado: 0, porCobrar: 0, gastos: 0, neto: 0 });
  }, [byCamion]);

  function prodName(pid) {
    return productos.find(p => p.id === pid)?.nombre || `#${pid}`;
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Cuadre del día</h1>
        <div className={styles.controls}>
          {period === 'day' && (
            <input
              type="date"
              className={styles.dateInput}
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          )}
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {byCamion.length === 0 && (
        <div className={styles.empty}>No hay rutas para este período</div>
      )}

      {byCamion.map(c => (
        <div key={c.camionId} className={styles.camionCard}>
          <div className={styles.camionHeader}>
            <span className={styles.camionName}>🚛 {c.camion?.nombre || c.camionId}</span>
            <span className={styles.camionConductor}>{c.conductor?.nombre || '—'}</span>
          </div>

          {period === 'day' ? (
            <>
              {/* Inventario */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Inventario</h4>
                <table className={styles.miniTable}>
                  <thead>
                    <tr>
                      <th>Producto</th><th>Salió</th><th>Vendido</th><th>Devuelto</th><th>En camión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(c.inventarioSalida).map(pid => {
                      const salio = c.inventarioSalida[pid] || 0;
                      const vendido = c.inventarioVendido[pid] || 0;
                      const devuelto = c.inventarioDevuelto[pid] || 0;
                      return (
                        <tr key={pid}>
                          <td>{prodName(pid)}</td>
                          <td>{salio}</td>
                          <td className={styles.green}>{vendido}</td>
                          <td className={styles.amber}>{devuelto}</td>
                          <td>{salio - vendido - devuelto}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cobros */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Cobros</h4>
                <div className={styles.cobroGrid}>
                  <div><span className={styles.cobroLabel}>Efectivo</span><span className={styles.green}>{money(c.cobros.efectivo)}</span></div>
                  <div><span className={styles.cobroLabel}>Nequi</span><span className={styles.green}>{money(c.cobros.nequi)}</span></div>
                  <div><span className={styles.cobroLabel}>Pago directo</span><span className={styles.green}>{money(c.cobros.pago_directo)}</span></div>
                  <div><span className={styles.cobroLabel}>Por cobrar</span><span className={styles.red}>{money(c.porCobrar)}</span></div>
                </div>
              </div>

              {/* Gastos */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Gastos</h4>
                {c.gastosList.length ? c.gastosList.map((g, i) => (
                  <div key={i} className={styles.gastoRow}>
                    <span>{g.descripcion || 'Gasto'}</span>
                    <span className={styles.red}>{money(g.monto)}</span>
                  </div>
                )) : <p className={styles.noData}>Sin gastos</p>}
              </div>

              {/* Garrafones */}
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Garrafones vacíos recogidos</h4>
                <span className={styles.bigNumber}>{c.totalVacios}</span>
              </div>
            </>
          ) : (
            /* Weekly / Monthly summary */
            <div className={styles.summaryGrid}>
              <div><span className={styles.cobroLabel}>Total vendido</span><span className={styles.green}>{money(c.totalVentas)}</span></div>
              <div><span className={styles.cobroLabel}>Total cobrado</span><span className={styles.green}>{money(c.totalCobrado)}</span></div>
              <div><span className={styles.cobroLabel}>Total gastos</span><span className={styles.red}>{money(c.totalGastos)}</span></div>
              <div><span className={styles.cobroLabel}>Neto</span><span className={c.neto >= 0 ? styles.green : styles.red}>{money(c.neto)}</span></div>
            </div>
          )}

          {/* Neto parcial */}
          <div className={styles.netoBar}>
            <span>Neto parcial</span>
            <span className={c.neto >= 0 ? styles.green : styles.red}>{money(c.neto)}</span>
          </div>
        </div>
      ))}

      {/* Totals */}
      {byCamion.length > 0 && (
        <div className={styles.totalCard}>
          <h3 className={styles.totalTitle}>Resumen total</h3>
          <div className={styles.totalGrid}>
            <div><span>Total ventas</span><span className={styles.green}>{money(totals.ventas)}</span></div>
            <div><span>Total cobrado</span><span className={styles.green}>{money(totals.cobrado)}</span></div>
            <div><span>Cuentas × cobrar</span><span className={styles.red}>{money(totals.porCobrar)}</span></div>
            <div><span>Gastos</span><span className={styles.red}>{money(totals.gastos)}</span></div>
            <div className={styles.netoTotal}><span>NETO</span><span className={totals.neto >= 0 ? styles.green : styles.red}>{money(totals.neto)}</span></div>
          </div>
          <div className={styles.exportBtns}>
            <button className={styles.stubBtn}>⬇ Excel (Fase 6)</button>
            <button className={styles.stubBtn}>📄 PDF (Fase 6)</button>
          </div>
        </div>
      )}
    </div>
  );
}
