import { useState, useMemo } from 'react';
import { doc, addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useComodatoMovimientos, useTiposActivoComodato, useCamiones, useClientes } from '../hooks/useCollection';
import FormField, { Select, Btn } from '../components/FormField';
import styles from './DashboardPage.module.css';

const ESTADOS = ['bueno', 'dañado', 'perdido'];

function calcularSaldos(movimientos) {
  // { ubicacionId: { tipoActivoId: {bueno,dañado,perdido} } }
  const acc = {};
  const sumar = (ubicacionId, tipoActivoId, estado, delta) => {
    if (!ubicacionId) return;
    if (!acc[ubicacionId]) acc[ubicacionId] = {};
    if (!acc[ubicacionId][tipoActivoId]) acc[ubicacionId][tipoActivoId] = { bueno: 0, 'dañado': 0, perdido: 0 };
    acc[ubicacionId][tipoActivoId][estado] = (acc[ubicacionId][tipoActivoId][estado] ?? 0) + delta;
  };
  for (const m of movimientos) {
    sumar(m.destino?.ubicacionId, m.tipoActivoId, m.destino?.estado, m.cantidad);
    sumar(m.origen?.ubicacionId, m.tipoActivoId, m.origen?.estado, -m.cantidad);
  }
  return acc;
}

export default function ComodatoPage() {
  const { empresaId } = useAuth();
  const { docs: movimientos, loading } = useComodatoMovimientos(empresaId);
  const { docs: tiposActivo } = useTiposActivoComodato(empresaId);
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: clientes } = useClientes(empresaId);

  const [form, setForm] = useState({ origenTipo: 'externo', origenId: '', destinoTipo: 'planta', destinoId: '', tipoActivoId: '', estado: 'bueno', cantidad: '1' });
  const [saving, setSaving] = useState(false);

  const saldos = useMemo(() => calcularSaldos(movimientos), [movimientos]);
  const nombresCliente = Object.fromEntries(clientes.map(c => [c.id, c.nombre]));
  const nombresCamion = Object.fromEntries(camiones.map(c => [c.id, c.nombre]));

  // Ubicaciones con actividad: planta (id fijo = empresaId) + camiones con saldo + clientes con saldo
  const ubicaciones = useMemo(() => {
    const ids = new Set(Object.keys(saldos));
    ids.add(empresaId); // planta siempre visible aunque esté en cero
    return [...ids].map(id => {
      let tipo = 'planta', nombre = 'Planta';
      if (id !== empresaId) {
        if (nombresCamion[id]) { tipo = 'camion'; nombre = nombresCamion[id]; }
        else if (nombresCliente[id]) { tipo = 'cliente'; nombre = nombresCliente[id]; }
        else { tipo = '?'; nombre = id; }
      }
      return { id, tipo, nombre };
    });
  }, [saldos, empresaId, nombresCamion, nombresCliente]);

  async function registrarMovimiento(e) {
    e.preventDefault();
    const cantidad = Number(form.cantidad);
    if (!form.tipoActivoId || !cantidad || cantidad <= 0) return;
    if (form.destinoTipo !== 'planta' && !form.destinoId) return;
    if (form.origenTipo !== 'externo' && form.origenTipo !== 'planta' && !form.origenId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'comodatoMovimientos'), {
        empresaId,
        tipoActivoId: form.tipoActivoId,
        origen: {
          ubicacionTipo: form.origenTipo,
          ubicacionId: form.origenTipo === 'externo' ? null : form.origenTipo === 'planta' ? empresaId : form.origenId,
          estado: 'bueno',
        },
        destino: {
          ubicacionTipo: form.destinoTipo,
          ubicacionId: form.destinoTipo === 'planta' ? empresaId : form.destinoId,
          estado: form.estado,
        },
        cantidad,
        fecha: new Date().toISOString().split('T')[0],
        registradoPor: null,
        creadoEn: new Date().toISOString(),
      });
      setForm(f => ({ ...f, cantidad: '1' }));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>Comodato</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Exhibidores, garrafones y demás activos en préstamo — planta, camiones y clientes.
            El conductor registra movimientos cliente/camión desde su celular; aquí se registran
            altas nuevas y traslados planta↔camión.
          </p>
        </div>
      </div>

      <form onSubmit={registrarMovimiento} className={styles.card} style={{ marginBottom: 20 }}>
        <h3 className={styles.cardTitle} style={{ marginBottom: 14 }}>Registrar movimiento</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <Select label="Tipo de activo" value={form.tipoActivoId}
            onChange={v => setForm(f => ({ ...f, tipoActivoId: v }))}
            options={[{ value: '', label: 'Selecciona...' }, ...tiposActivo.filter(t => t.activo).map(t => ({ value: t.id, label: t.nombre }))]} />
          <Select label="Origen" value={form.origenTipo}
            onChange={v => setForm(f => ({ ...f, origenTipo: v, origenId: '' }))}
            options={[{ value: 'externo', label: 'Externo (compra nueva)' }, { value: 'planta', label: 'Planta' }, { value: 'camion', label: 'Camión' }]} />
          {form.origenTipo === 'camion' && (
            <Select label="Camión origen" value={form.origenId} onChange={v => setForm(f => ({ ...f, origenId: v }))}
              options={[{ value: '', label: 'Selecciona...' }, ...camiones.map(c => ({ value: c.id, label: c.nombre }))]} />
          )}
          <Select label="Destino" value={form.destinoTipo}
            onChange={v => setForm(f => ({ ...f, destinoTipo: v, destinoId: '' }))}
            options={[{ value: 'planta', label: 'Planta' }, { value: 'camion', label: 'Camión' }]} />
          {form.destinoTipo === 'camion' && (
            <Select label="Camión destino" value={form.destinoId} onChange={v => setForm(f => ({ ...f, destinoId: v }))}
              options={[{ value: '', label: 'Selecciona...' }, ...camiones.map(c => ({ value: c.id, label: c.nombre }))]} />
          )}
          <Select label="Estado destino" value={form.estado} onChange={v => setForm(f => ({ ...f, estado: v }))}
            options={ESTADOS.map(e => ({ value: e, label: e }))} />
          <FormField label="Cantidad" type="number" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn type="submit" disabled={saving || !form.tipoActivoId}>{saving ? 'Guardando...' : 'Registrar'}</Btn>
        </div>
      </form>

      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ marginBottom: 10 }}>Estado por ubicación</h3>
        {loading ? <p style={{ color: 'var(--text-muted)' }}>Cargando...</p> : (
          <table className={styles.table}>
            <thead><tr><th>Ubicación</th><th>Tipo</th><th>Activo</th><th>Bueno</th><th>Dañado</th><th>Perdido</th></tr></thead>
            <tbody>
              {ubicaciones.flatMap(u => {
                const tiposConSaldo = Object.keys(saldos[u.id] || {});
                if (!tiposConSaldo.length) {
                  return u.tipo === 'planta' ? [
                    <tr key={u.id}><td className={styles.bold}>{u.nombre}</td><td className={styles.muted}>{u.tipo}</td>
                      <td colSpan={4} className={styles.muted}>Sin movimientos todavía</td></tr>
                  ] : [];
                }
                return tiposConSaldo.map(tipoActivoId => {
                  const s = saldos[u.id][tipoActivoId];
                  const nombreTipo = tiposActivo.find(t => t.id === tipoActivoId)?.nombre || tipoActivoId;
                  return (
                    <tr key={u.id + tipoActivoId}>
                      <td className={styles.bold}>{u.nombre}</td>
                      <td className={styles.muted}>{u.tipo}</td>
                      <td>{nombreTipo}</td>
                      <td>{s.bueno}</td>
                      <td className={s['dañado'] > 0 ? styles.red : undefined}>{s['dañado']}</td>
                      <td className={s.perdido > 0 ? styles.red : undefined}>{s.perdido}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
