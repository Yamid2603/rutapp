import { useAuth } from '../context/AuthContext';
import { useOperacionesFallidas, useClientes } from '../hooks/useCollection';
import styles from './DashboardPage.module.css';

const ETIQUETAS_TIPO = {
  CERRAR_VISITA: 'Pago / cierre de visita',
  AGREGAR_GASTO: 'Gasto de ruta',
  AGREGAR_DEVOLUCION: 'Devolución de producto',
  AGREGAR_PARADA: 'Parada agregada',
  MARCAR_CERRADO: 'Visita marcada como cerrada',
  OPTIMIZAR_RUTA: 'Optimización de ruta',
};

function resumenPayload(tipo, payload, clientesMap) {
  switch (tipo) {
    case 'CERRAR_VISITA': {
      const cliente = clientesMap[payload.clienteId]?.nombre || payload.clienteId || '—';
      return `${cliente} · vendió $${(payload.totalVenta ?? 0).toLocaleString('es-CO')} · cobró $${(payload.totalCobrado ?? 0).toLocaleString('es-CO')}`;
    }
    case 'AGREGAR_GASTO': {
      const g = payload.gasto || {};
      return `${g.tipo || '—'} · $${(g.valor ?? 0).toLocaleString('es-CO')}${payload.fotoUri ? ' · con foto' : ''}`;
    }
    case 'AGREGAR_DEVOLUCION': {
      const d = payload.devolucion || {};
      return `${d.tipo || '—'} · producto ${d.productoId || '—'} · ${d.cantidad ?? 0} uni`;
    }
    default:
      return payload.rutaId ? `Ruta ${payload.rutaId}` : 'Sin más detalle';
  }
}

function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function OperacionesFallidasPage() {
  const { empresaId } = useAuth();
  const { docs: operaciones, loading } = useOperacionesFallidas(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const clientesMap = Object.fromEntries(clientes.map(c => [c.id, c]));

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>;

  return (
    <div>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Operaciones sin sincronizar</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Pagos, gastos o cambios que el conductor registró pero que no lograron subir a la nube
            tras varios intentos — probablemente por falta de señal prolongada. Revisar y, si aplica,
            registrar manualmente.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        {!operaciones.length ? (
          <p className={styles.empty}>No hay operaciones pendientes — todo sincronizado correctamente.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Conductor</th>
                <th>Intentos</th>
                <th>Falló el</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.map(op => (
                <tr key={op.id}>
                  <td className={styles.bold}>{ETIQUETAS_TIPO[op.tipo] || op.tipo}</td>
                  <td>{resumenPayload(op.tipo, op.payload || {}, clientesMap)}</td>
                  <td>{op.conductorId || '—'}</td>
                  <td className={styles.red}>{op.intentos ?? '—'}</td>
                  <td>{formatFecha(op.fallidaEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
