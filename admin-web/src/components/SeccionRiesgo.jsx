import { exportarCSVRiesgo } from '../utils/analisisIAHelpers';
import styles from './Seccion.module.css';

export default function SeccionRiesgo({ datos, exportable }) {
  return (
    <div className={styles.seccion}>
      <div className={styles.header}>
        <h3>⚠️ Riesgo Crediticio</h3>
        {exportable && (
          <button className={styles.btnExportar} onClick={() => exportarCSVRiesgo(datos)}>
            📥 CSV
          </button>
        )}
      </div>

      <div className={styles.tabla}>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Deuda</th>
              <th>% Límite</th>
              <th>Pago Histórico</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.clienteId} className={styles[`row_${d.status.semaforo}`]}>
                <td className={styles.nombre}>{d.clienteNombre}</td>
                <td>${(d.deuda.actual / 1000).toFixed(0)}k</td>
                <td>{d.status.porcentajeDelLimite.toFixed(0)}%</td>
                <td>{d.historialPago.percentajePago.toFixed(0)}%</td>
                <td>
                  <span className={styles.status}>
                    {d.status.semaforo === 'red' && '🔴'}
                    {d.status.semaforo === 'yellow' && '🟡'}
                    {d.status.semaforo === 'green' && '🟢'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
