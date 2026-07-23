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
          {(() => {
            const categorias = [
              { cat: 'Gasolina', val: porCategoria.gasolina, color: 'var(--warning)' },
              { cat: 'Peaje', val: porCategoria.peaje, color: '#8B5CF6' },
              { cat: 'Mecánica', val: porCategoria.mecanica, color: 'var(--success)' },
              { cat: 'Otro', val: porCategoria.otro, color: '#6B7280' },
            ];
            // Ancho relativo a la categoría más alta, no al total — así una sola
            // categoría con gasto se ve llena y las demás en $0 quedan vacías,
            // en vez de todas al 100% cuando el total es 0 (antes: NaN% → CSS
            // inválido → el navegador ignoraba el ancho y el div ocupaba todo).
            const maxVal = Math.max(0, ...categorias.map(c => c.val));
            return categorias.map((item) => (
              <div key={item.cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.cat}</span>
                  <span style={{ fontWeight: 'bold' }}>${(item.val / 1000).toFixed(0)}k</span>
                </div>
                <div style={{ width: '100%', height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${maxVal > 0 ? (item.val / maxVal) * 100 : 0}%`,
                      height: '100%',
                      background: item.color,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            ));
          })()}
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
