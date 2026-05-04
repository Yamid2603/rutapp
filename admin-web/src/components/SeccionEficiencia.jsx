import { exportarCSVEficiencia } from '../utils/analisisIAHelpers';
import styles from './Seccion.module.css';

export default function SeccionEficiencia({ datos, exportable }) {
  return (
    <div className={styles.seccion}>
      <div className={styles.header}>
        <h3>Eficiencia Conductores</h3>
        {exportable && (
          <button
            className={styles.btnExportar}
            onClick={() => exportarCSVEficiencia(datos)}
          >
            📥 CSV
          </button>
        )}
      </div>

      <div className={styles.tabla}>
        <table>
          <thead>
            <tr>
              <th>Conductor</th>
              <th>Vendido</th>
              <th>Cobrado</th>
              <th>Ratio</th>
              <th>Gastos</th>
              <th>Tend.</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.conductorId} className={styles[`row_${d.status.semaforo}`]}>
                <td className={styles.nombre}>{d.conductorNombre}</td>
                <td>${(d.totalVendido / 1000).toFixed(0)}k</td>
                <td>${(d.totalCobrado / 1000).toFixed(0)}k</td>
                <td>
                  <span className={styles.badge} style={{ background: getBadgeColor(d.ratioCobranza) }}>
                    {d.ratioCobranza.toFixed(0)}%
                  </span>
                </td>
                <td>${(d.gastos.total / 1000).toFixed(0)}k</td>
                <td>{d.tendencia.direccion}</td>
              </tr>
            ))}
            {!datos.length && (
              <tr>
                <td colSpan="6" className={styles.empty}>Sin datos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getBadgeColor(ratio) {
  if (ratio >= 85) return '#D1FAE5';
  if (ratio >= 70) return '#FEF3C7';
  return '#FEE2E2';
}
