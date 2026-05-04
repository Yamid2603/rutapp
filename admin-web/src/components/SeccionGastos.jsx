import { exportarCSVGastos } from '../utils/analisisIAHelpers';
import styles from './Seccion.module.css';

export default function SeccionGastos({ datos, exportable }) {
  const porCategoria = datos?.porCategoria || { gasolina: 0, peaje: 0, mecanica: 0, otro: 0, total: 0 };

  return (
    <div className={styles.seccion}>
      <div className={styles.header}>
        <h3>Desglose de Gastos</h3>
        {exportable && (
          <button className={styles.btnExportar} onClick={() => exportarCSVGastos(datos)}>
            📥 CSV
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: '12px', margin: '8px 0 12px 0', color: '#666', textTransform: 'uppercase' }}>
          Por Categoría
        </h4>
        <div className={styles.barras}>
          {[
            { cat: 'Gasolina', val: porCategoria.gasolina, color: '#F59E0B' },
            { cat: 'Peaje', val: porCategoria.peaje, color: '#8B5CF6' },
            { cat: 'Mecánica', val: porCategoria.mecanica, color: '#10B981' },
            { cat: 'Otro', val: porCategoria.otro, color: '#6B7280' },
          ].map((item) => (
            <div key={item.cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.cat}</span>
                <span style={{ fontWeight: 'bold' }}>${(item.val / 1000).toFixed(0)}k</span>
              </div>
              <div style={{ width: '100%', height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(item.val / porCategoria.total) * 100}%`,
                    height: '100%',
                    background: item.color,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '12px', margin: '8px 0 12px 0', color: '#666', textTransform: 'uppercase' }}>
          Por Conductor
        </h4>
        <div className={styles.tabla}>
          <table>
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Total</th>
                <th>Gasolina</th>
                <th>Peaje</th>
              </tr>
            </thead>
            <tbody>
              {(datos?.porConductor || []).slice(0, 8).map((c) => (
                <tr key={c.conductorId}>
                  <td className={styles.nombre}>{c.conductorNombre}</td>
                  <td>${(c.total / 1000).toFixed(0)}k</td>
                  <td>${(c.categorias.gasolina / 1000).toFixed(0)}k</td>
                  <td>${(c.categorias.peaje / 1000).toFixed(0)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
