import { useMemo, useState } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useCamiones, useClientes, useRutas, useProductos } from '../hooks/useCollection';
import { weekDaysFromDate, today } from '../utils/dates';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './ZonasPage.module.css';

export default function ZonasPage() {
  const { empresaId } = useAuth();
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const { docs: rutas } = useRutas(empresaId);
  const { docs: productos } = useProductos(empresaId);

  const weekDays = weekDaysFromDate();

  // ── Estado del modal ───────────────────────────────────────────────────────
  const [cell, setCell] = useState(null); // { camion, date, ruta|null }
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [inventario, setInventario] = useState({});
  const [zona, setZona] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Grid camión × día ─────────────────────────────────────────────────────
  const rutaMap = useMemo(() => {
    const map = {};
    rutas.filter(r => !r.deleted).forEach(r => { map[`${r.camionId}_${r.fecha}`] = r; });
    return map;
  }, [rutas]);

  async function handleEliminar() {
    if (!cell?.ruta) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, 'rutas', cell.ruta.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: empresaId,
      });
      setCell(null);
      setConfirmarEliminar(false);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openCell(camion, date) {
    const ruta = rutaMap[`${camion.id}_${date}`] || null;

    let preIds;
    if (ruta) {
      preIds = new Set((ruta.paradas || []).map(p => p.clienteId));
    } else {
      // Sugerir clientes de la última ruta completada de este camión
      const ultimaCompletada = rutas
        .filter(r => r.camionId === camion.id && r.estado === 'completada')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      preIds = new Set((ultimaCompletada?.paradas || []).map(p => p.clienteId));
    }

    const preInv = {};
    productos.forEach(p => {
      preInv[p.id] = ruta?.inventarioInicial?.[p.id] ?? 0;
    });
    setCell({ camion, date, ruta });
    setSelectedIds(preIds);
    setInventario(preInv);
    setZona(ruta?.zona || '');
    setSearch('');
    setConfirmarEliminar(false);
  }

  function toggleCliente(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setInv(prodId, val) {
    setInventario(prev => ({ ...prev, [prodId]: Number(val) || 0 }));
  }

  // Paradas ya visitadas que no se deben tocar
  const paradasVisitadas = useMemo(() => {
    if (!cell?.ruta) return [];
    return (cell.ruta.paradas || []).filter(p => p.estado !== 'pendiente');
  }, [cell]);

  async function handleSave() {
    if (!cell) return;
    setSaving(true);
    try {
      const clientesSeleccionados = clientes.filter(c => selectedIds.has(c.id));

      // Paradas nuevas solo para clientes sin visita previa
      const visitadosIds = new Set(paradasVisitadas.map(p => p.clienteId));
      let orden = paradasVisitadas.length;

      const paradasNuevas = clientesSeleccionados
        .filter(c => !visitadosIds.has(c.id))
        .map(c => {
          orden += 1;
          // cantidades: todos los productos habilitados (pedidoUsual o 0)
          const cantidades = {};
          productos.forEach(p => {
            cantidades[p.id] = c.pedidoUsual?.[p.id] ?? 0;
          });
          return {
            id: orden,
            orden,
            clienteId: c.id,
            estado: 'pendiente',
            cantidades,
            totalVenta: null,
            totalCobrado: null,
            formaPago: null,
            motivoCierre: null,
            notaCierre: null,
            garrafonesVaciosRecogidos: 0,
          };
        });

      const paradas = [...paradasVisitadas, ...paradasNuevas];

      if (cell.ruta) {
        await updateDoc(doc(db, 'rutas', cell.ruta.id), {
          paradas,
          inventarioInicial: inventario,
          zona,
        });
      } else {
        const rutaId = `${cell.camion.id}_${cell.date}_${Date.now()}`;
        await setDoc(doc(db, 'rutas', rutaId), {
          empresaId,
          camionId: cell.camion.id,
          conductorId: cell.camion.conductorId || null,
          fecha: cell.date,
          estado: 'activa',
          zona,
          paradas,
          inventarioInicial: inventario,
          gastos: [],
          devoluciones: [],
        });
      }
      setCell(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Carga sugerida mañana ─────────────────────────────────────────────────
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const cargaSugerida = useMemo(() => {
    return rutas
      .filter(r => r.fecha === tomorrow)
      .map(r => {
        const camion = camiones.find(c => c.id === r.camionId);
        const carga = { ...r.inventarioInicial };
        return { camion: camion?.nombre || r.camionId, carga };
      });
  }, [rutas, camiones, tomorrow]);

  const clientesFiltrados = clientes.filter(c =>
    !search || c.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className={styles.pageTitle}>Zonas & Carga</h1>

      {/* Calendario semanal */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Programar rutas — semana actual</h3>
        <p className={styles.hint}>Haz click en una celda para asignar clientes y carga a esa ruta.</p>
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
                    const ruta = rutaMap[`${cam.id}_${d.date}`];
                    const count = ruta?.paradas?.length ?? 0;
                    return (
                      <td
                        key={d.date}
                        className={`${styles.cell} ${d.date === today() ? styles.todayCol : ''} ${ruta ? styles.cellActive : ''}`}
                        onClick={() => openCell(cam, d.date)}
                      >
                        {ruta
                          ? <span className={styles.cellBadge}>{count} cliente{count !== 1 ? 's' : ''}</span>
                          : <span className={styles.cellEmpty}>+</span>
                        }
                        {ruta?.zona && <div className={styles.cellZona}>{ruta.zona}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!camiones.length && (
                <tr><td colSpan={8} className={styles.empty}>No hay camiones registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Carga sugerida mañana */}
      {cargaSugerida.length > 0 && (
        <div className={styles.card} style={{ marginTop: 20 }}>
          <h3 className={styles.cardTitle}>Carga sugerida mañana</h3>
          {cargaSugerida.map((c, i) => (
            <div key={i} className={styles.cargaBlock}>
              <div className={styles.cargaTitle}>{c.camion}</div>
              <div className={styles.cargaGrid}>
                {Object.entries(c.carga).map(([pid, qty]) => {
                  const prod = productos.find(p => p.id === pid);
                  return (
                    <div key={pid} className={styles.cargaItem}>
                      <span className={styles.cargaProd}>{prod?.nombre || pid}</span>
                      <span className={styles.cargaQty}>{qty}</span>
                    </div>
                  );
                })}
                {!Object.keys(c.carga).length && <span className={styles.noData}>Sin inventario definido</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal programar ruta */}
      <Modal
        open={!!cell}
        onClose={() => setCell(null)}
        title={cell ? `${cell.camion.nombre} — ${cell.date}` : ''}
        wide
      >
        {paradasVisitadas.length > 0 && (
          <div className={styles.warningBanner}>
            Esta ruta tiene {paradasVisitadas.length} parada(s) ya visitada(s) — no se modificarán.
          </div>
        )}

        <div className={styles.modalGrid}>
          {/* Clientes */}
          <div className={styles.modalCol}>
            <div className={styles.colLabel}>Clientes en ruta</div>
            <input
              className={styles.searchInput}
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className={styles.clienteList}>
              {clientesFiltrados.map(c => {
                const visitado = paradasVisitadas.some(p => p.clienteId === c.id);
                return (
                  <label key={c.id} className={`${styles.clienteRow} ${visitado ? styles.clienteVisitado : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      disabled={visitado}
                      onChange={() => toggleCliente(c.id)}
                    />
                    <span className={styles.clienteNombre}>{c.nombre}</span>
                    <span className={styles.clienteDir}>{c.direccion}</span>
                    {visitado && <span className={styles.visitadoBadge}>visitado</span>}
                  </label>
                );
              })}
              {!clientesFiltrados.length && (
                <p className={styles.noData}>No hay clientes</p>
              )}
            </div>
            <div className={styles.selCount}>{selectedIds.size} cliente(s) seleccionado(s)</div>
          </div>

          {/* Inventario + zona */}
          <div className={styles.modalCol}>
            <div className={styles.colLabel}>Inventario inicial</div>
            {productos.map(p => (
              <div key={p.id} className={styles.invRow}>
                <span className={styles.invNombre}>{p.nombre}</span>
                <input
                  type="number"
                  min="0"
                  className={styles.invInput}
                  value={inventario[p.id] ?? 0}
                  onChange={e => setInv(p.id, e.target.value)}
                />
              </div>
            ))}
            {!productos.length && <p className={styles.noData}>Sin productos registrados</p>}

            <div className={styles.colLabel} style={{ marginTop: 16 }}>Zona</div>
            <FormField
              value={zona}
              onChange={e => setZona(e.target.value)}
              placeholder="Ej: Norte, Centro..."
            />
          </div>
        </div>

        {confirmarEliminar && (
          <div style={{ background: '#FEE2E2', border: '1px solid #B84B4B', borderRadius: 8, padding: 12, marginTop: 16 }}>
            <div style={{ color: '#B84B4B', fontWeight: 700, marginBottom: 4 }}>⚠️ ¿Eliminar esta ruta?</div>
            <div style={{ color: '#B84B4B', fontSize: 13, marginBottom: 12 }}>
              Se eliminará la asignación. Las transacciones ya registradas no se afectan.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setConfirmarEliminar(false)}>Cancelar</Btn>
              <button
                onClick={handleEliminar}
                disabled={deleting}
                style={{ background: '#B84B4B', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                {deleting ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div>
            {cell?.ruta && paradasVisitadas.length === 0 && !confirmarEliminar && (
              <button
                onClick={() => setConfirmarEliminar(true)}
                style={{ background: 'none', border: '1px solid #B84B4B', color: '#B84B4B', borderRadius: 6, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                🗑 Eliminar ruta
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setCell(null)}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={saving || selectedIds.size === 0}>
              {saving ? 'Guardando...' : cell?.ruta ? 'Actualizar ruta' : 'Crear ruta'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
