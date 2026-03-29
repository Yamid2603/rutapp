import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useCamiones, useClientes, useRutas } from '../hooks/useCollection';
import { weekDaysFromDate, today } from '../utils/dates';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './ZonasPage.module.css';

export default function ZonasPage() {
  const { empresaId } = useAuth();
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const { docs: rutas } = useRutas(empresaId);

  const weekDays = weekDaysFromDate();
  const [editCell, setEditCell] = useState(null); // { camionId, date }
  const [zona, setZona] = useState('');

  // Build grid: camion × day → zona from ruta
  const grid = useMemo(() => {
    const map = {};
    rutas.forEach(r => {
      const key = `${r.camionId}_${r.fecha}`;
      map[key] = r.zona || '—';
    });
    return map;
  }, [rutas]);

  async function saveZona() {
    if (!editCell) return;
    // Find the ruta for that cell and update zona
    const ruta = rutas.find(r => r.camionId === editCell.camionId && r.fecha === editCell.date);
    if (ruta) {
      await updateDoc(doc(db, 'rutas', ruta.id), { zona });
    }
    setEditCell(null);
  }

  // Carga sugerida mañana
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const cargaSugerida = useMemo(() => {
    const tomorrowRutas = rutas.filter(r => r.fecha === tomorrow);
    return tomorrowRutas.map(r => {
      const camion = camiones.find(c => c.id === r.camionId);
      const carga = {};
      (r.paradas || []).forEach(p => {
        Object.entries(p.cantidades || {}).forEach(([pid, qty]) => {
          carga[pid] = (carga[pid] || 0) + qty;
        });
      });
      return { camion: camion?.nombre || r.camionId, carga };
    });
  }, [rutas, camiones, tomorrow]);

  // Aggregate usual orders per camion from assigned clients
  const cargaFromUsual = useMemo(() => {
    return camiones.map(cam => {
      const carga = {};
      clientes.forEach(c => {
        Object.entries(c.pedidoUsual || {}).forEach(([pid, qty]) => {
          carga[pid] = (carga[pid] || 0) + qty;
        });
      });
      return { camion: cam.nombre, carga };
    });
  }, [camiones, clientes]);

  const cargaDisplay = cargaSugerida.length ? cargaSugerida : cargaFromUsual;

  return (
    <div>
      <h1 className={styles.pageTitle}>Zonas & Carga</h1>

      {/* Weekly calendar grid */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Calendario semanal</h3>
        <div className={styles.gridWrap}>
          <table className={styles.calTable}>
            <thead>
              <tr>
                <th>Camión</th>
                {weekDays.map(d => (
                  <th key={d.date} className={d.date === today() ? styles.todayCol : ''}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {camiones.map(cam => (
                <tr key={cam.id}>
                  <td className={styles.camName}>{cam.nombre}</td>
                  {weekDays.map(d => {
                    const key = `${cam.id}_${d.date}`;
                    const val = grid[key] || '—';
                    return (
                      <td
                        key={d.date}
                        className={`${styles.cell} ${d.date === today() ? styles.todayCol : ''}`}
                        onClick={() => { setEditCell({ camionId: cam.id, date: d.date }); setZona(val === '—' ? '' : val); }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!camiones.length && (
                <tr><td colSpan={7} className={styles.empty}>No hay camiones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carga sugerida */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>Carga sugerida mañana</h3>
        {cargaDisplay.length === 0 ? (
          <p className={styles.noData}>No hay rutas programadas para mañana</p>
        ) : cargaDisplay.map((c, i) => (
          <div key={i} className={styles.cargaBlock}>
            <div className={styles.cargaTitle}>🚛 {c.camion}</div>
            <div className={styles.cargaGrid}>
              {Object.entries(c.carga).map(([pid, qty]) => (
                <div key={pid} className={styles.cargaItem}>
                  <span className={styles.cargaProd}>Producto {pid}</span>
                  <span className={styles.cargaQty}>{qty}</span>
                </div>
              ))}
              {!Object.keys(c.carga).length && <span className={styles.noData}>Sin carga</span>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editCell} onClose={() => setEditCell(null)} title="Asignar zona">
        <FormField label="Zona" value={zona} onChange={e => setZona(e.target.value)} placeholder="Ej: Norte, Centro..." />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setEditCell(null)}>Cancelar</Btn>
          <Btn onClick={saveZona}>Guardar</Btn>
        </div>
      </Modal>
    </div>
  );
}
