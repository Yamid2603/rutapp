import { useState, useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useGastosEmpresa } from '../hooks/useCollection';
import Modal from '../components/Modal';
import FormField, { Select, Btn } from '../components/FormField';
import styles from './DashboardPage.module.css';

// Enum cerrado — exactamente estas 11, sin "otro". Esa lógica de catch-all
// es propia de rutas.gastos[] (operativo de ruta); aquí no aplica.
// Nota de mapeo (Excel original): "Gastos de Representación" → Gastos Operativos.
export const CATEGORIAS_EMPRESA = [
  'Salarios', 'Seguridad Social', 'Transporte', 'Arreglo Vehículos', 'Impuestos',
  'Gastos Contables', 'Gastos Operativos', 'Gastos de Producción', 'Inventario',
  'Mantenimiento Planta', 'Servicios',
];

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

const EMPTY = { fecha: hoyISO(), categoria: CATEGORIAS_EMPRESA[0], proveedor: '', monto: '' };

export default function GastosEmpresaPage() {
  const { empresaId, user } = useAuth();
  const { docs: gastos, loading } = useGastosEmpresa(empresaId);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const totalMes = useMemo(() => {
    const mesActual = hoyISO().slice(0, 7);
    return gastos
      .filter(g => (g.fecha || '').startsWith(mesActual))
      .reduce((s, g) => s + (g.monto || 0), 0);
  }, [gastos]);

  const gastosVisibles = filtroCategoria
    ? gastos.filter(g => g.categoria === filtroCategoria)
    : gastos;

  async function handleRegistrar(e) {
    e.preventDefault();
    if (!form.proveedor.trim() || !Number(form.monto)) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID().slice(0, 10);
      await setDoc(doc(db, 'gastosEmpresa', id), {
        empresaId,
        fecha: form.fecha,
        categoria: form.categoria,
        proveedor: form.proveedor.trim(),
        monto: Number(form.monto),
        creadoPor: user?.uid ?? null,
        creadoEn: new Date().toISOString(),
      });
      // Solo se resetean proveedor y monto — fecha y categoría se mantienen,
      // porque en la práctica se registran varios gastos seguidos de la misma categoría/día.
      setForm(f => ({ ...f, proveedor: '', monto: '' }));
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardarEdicion() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'gastosEmpresa', editando.id), {
        fecha: editando.fecha,
        categoria: editando.categoria,
        proveedor: editando.proveedor.trim(),
        monto: Number(editando.monto),
      });
      setEditando(null);
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
          <h1 className={styles.pageTitle}>Gastos de empresa</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Salarios, impuestos, mantenimiento y demás gastos de la empresa — separado de los
            gastos de ruta del camión (gasolina, peajes), que siguen en Cuadre del día.
          </p>
        </div>
      </div>

      {/* Captura rápida — siempre visible, pensada para usarse desde el celular
          en el momento del gasto, no escondida en un modal. */}
      <form onSubmit={handleRegistrar} className={styles.card} style={{ marginBottom: 20 }}>
        <h3 className={styles.cardTitle} style={{ marginBottom: 14 }}>Registrar gasto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <FormField label="Fecha" type="date" value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <Select label="Categoría" value={form.categoria}
            onChange={v => setForm(f => ({ ...f, categoria: v }))}
            options={CATEGORIAS_EMPRESA.map(c => ({ value: c, label: c }))} />
          <FormField label="Proveedor / beneficiario" value={form.proveedor} placeholder="Ej: Juan Pérez"
            onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
          <FormField label="Monto ($)" type="number" placeholder="0" value={form.monto}
            onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn type="submit" disabled={saving || !form.proveedor.trim() || !Number(form.monto)}>
            {saving ? 'Guardando...' : 'Registrar gasto'}
          </Btn>
        </div>
      </form>

      <div className={styles.statsGrid} style={{ marginBottom: 20 }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total este mes</div>
          <div className={styles.statValue}>${totalMes.toLocaleString('es-CO')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Registros</div>
          <div className={styles.statValue}>{gastos.length}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Historial</h3>
          <Select value={filtroCategoria} onChange={setFiltroCategoria}
            options={[{ value: '', label: 'Todas las categorías' }, ...CATEGORIAS_EMPRESA.map(c => ({ value: c, label: c }))]} />
        </div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        ) : !gastosVisibles.length ? (
          <p className={styles.empty}>No hay gastos registrados{filtroCategoria ? ' en esta categoría' : ''}.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Proveedor</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosVisibles.map(g => (
                <tr key={g.id}>
                  <td>{g.fecha}</td>
                  <td><span className={styles.badge + ' ' + styles.badgeTeal}>{g.categoria}</span></td>
                  <td className={styles.bold}>{g.proveedor}</td>
                  <td className={styles.red}>${(g.monto || 0).toLocaleString('es-CO')}</td>
                  <td>
                    <button onClick={() => setEditando(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: 13 }}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar gasto">
        {editando && (
          <>
            <FormField label="Fecha" type="date" value={editando.fecha}
              onChange={e => setEditando(v => ({ ...v, fecha: e.target.value }))} />
            <Select label="Categoría" value={editando.categoria}
              onChange={v => setEditando(f => ({ ...f, categoria: v }))}
              options={CATEGORIAS_EMPRESA.map(c => ({ value: c, label: c }))} />
            <FormField label="Proveedor / beneficiario" value={editando.proveedor}
              onChange={e => setEditando(v => ({ ...v, proveedor: e.target.value }))} />
            <FormField label="Monto ($)" type="number" value={editando.monto}
              onChange={e => setEditando(v => ({ ...v, monto: e.target.value }))} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn onClick={handleGuardarEdicion} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
