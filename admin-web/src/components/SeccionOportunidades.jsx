import { exportarCSVOportunidades } from '../utils/analisisIAHelpers';
import styles from './Seccion.module.css';

export default function SeccionOportunidades({ datos, exportable }) {
  return (
    <div className={styles.seccion}>
      <div className={styles.header}>
        <h3>Oportunidades</h3>
        {exportable && (
          <button className={styles.btnExportar} onClick={() => exportarCSVOportunidades(datos)}>
            📥 CSV
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: '12px', margin: '8px 0 12px 0', textTransform: 'uppercase', color: '#666' }}>
          Riesgo de Churn
        </h4>
        <div className={styles.tabla}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Compra Anterior</th>
                <th>Ahora</th>
                <th>Caída</th>
              </tr>
            </thead>
            <tbody>
              {(datos.clientesRiesgo || []).map((o) => (
                <tr key={o.clienteId}>
                  <td className={styles.nombre}>{o.clienteNombre}</td>
                  <td>${(o.compraHace3Meses / 1000).toFixed(0)}k</td>
                  <td>${(o.compraAhora / 1000).toFixed(0)}k</td>
                  <td style={{ color: '#EF4444' }}>{o.cambioPercent.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '12px', margin: '8px 0 12px 0', textTransform: 'uppercase', color: '#666' }}>
          Potencial Crédito
        </h4>
        <div className={styles.tabla}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pago Histórico</th>
                <th>Promedio</th>
                <th>Potencial</th>
              </tr>
            </thead>
            <tbody>
              {(datos.clientesOportunidad || []).map((o) => (
                <tr key={o.clienteId}>
                  <td className={styles.nombre}>{o.clienteNombre}</td>
                  <td>{o.percentajePago.toFixed(0)}%</td>
                  <td>${(o.compraPromedio / 1000).toFixed(0)}k</td>
                  <td style={{ color: '#10B981' }}>${(o.potencial / 1000).toFixed(0)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
