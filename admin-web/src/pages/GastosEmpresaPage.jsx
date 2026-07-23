import { useState, useMemo } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useGastosEmpresa, useCategoriasGasto, useBeneficiariosGasto } from '../hooks/useCollection';
import { idCatalogo } from '../utils/slug';
import Modal from '../components/Modal';
import FormField, { Select, Btn } from '../components/FormField';
import CreatableSelect from '../components/CreatableSelect';
import styles from './DashboardPage.module.css';

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

const EMPTY = { fecha: hoyISO(), categoriaId: '', beneficiarioId: '', monto: '' };

export default function GastosEmpresaPage() {
  const { empresaId, user } = useAuth();
  const { docs: gastos, loading } = useGastosEmpresa(empresaId);
  const { docs: categorias } = useCategoriasGasto(empresaId);
  const { docs: beneficiarios } = useBeneficiariosGasto(empresaId);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const categoriasActivas = categorias.filter(c => c.activa);
  const beneficiariosActivos = beneficiarios.filter(b => b.activo);
  const categoriasMap = Object.fromEntries(categorias.map(c => [c.id, c]));
  const beneficiariosMap = Object.fromEntries(beneficiarios.map(b => [b.id, b]));

  const totalMes = useMemo(() => {
    const mesActual = hoyISO().slice(0, 7);
    return gastos
      .filter(g => (g.fecha || '').startsWith(mesActual))
      .reduce((s, g) => s + (g.monto || 0), 0);
  }, [gastos]);

  const gastosVisibles = filtroCategoria
    ? gastos.filter(g => g.categoriaId === filtroCategoria)
    : gastos;

  async function crearCategoriaRapida(nombre) {
    const id = idCatalogo(empresaId, nombre);
    await setDoc(doc(db, 'categoriasGasto', id), {
      empresaId, nombre, activa: true, creadoEn: new Date().toISOString(),
    });
    return { id, nombre };
  }

  async function crearBeneficiarioRapido({ nombre, tipo }) {
    const id = idCatalogo(empresaId, nombre);
    await setDoc(doc(db, 'beneficiariosGasto', id), {
      empresaId, nombre, tipo, nitCedula: null, activo: true,
      creadoEn: new Date().toISOString(),
    });
    return { id, nombre };
  }

  async function handleRegistrar(e) {
    e.preventDefault();
    if (!form.categoriaId || !form.beneficiarioId || !Number(form.monto)) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID().slice(0, 10);
      await setDoc(doc(db, 'gastosEmpresa', id), {
        empresaId,
        fecha: form.fecha,
        categoriaId: form.categoriaId,
        beneficiarioId: form.beneficiarioId,
        monto: Number(form.monto),
        creadoPor: user?.uid ?? null,
        creadoEn: new Date().toISOString(),
      });
      // Solo se resetean beneficiario y monto — fecha y categoría se mantienen,
      // porque en la práctica se registran varios gastos seguidos de la misma categoría/día.
      setForm(f => ({ ...f, beneficiarioId: '', monto: '' }));
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
        categoriaId: editando.categoriaId,
        beneficiarioId: editando.beneficiarioId,
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
            Categorías y beneficiarios se administran también desde Gestión.
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
          <CreatableSelect label="Categoría" value={form.categoriaId}
            onChange={id => setForm(f => ({ ...f, categoriaId: id }))}
            options={categoriasActivas}
            onCrearSimple={async (nombre) => crearCategoriaRapida(nombre)} />
          <CreatableSelect label="Beneficiario" value={form.beneficiarioId}
            onChange={id => setForm(f => ({ ...f, beneficiarioId: id }))}
            options={beneficiariosActivos}
            renderCreacionPersonalizada={({ texto, onCreado, onCancelar }) => (
              <BeneficiarioRapido texto={texto} onCrear={crearBeneficiarioRapido} onCreado={onCreado} onCancelar={onCancelar} />
            )} />
          <FormField label="Monto ($)" type="number" placeholder="0" value={form.monto}
            onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn type="submit" disabled={saving || !form.categoriaId || !form.beneficiarioId || !Number(form.monto)}>
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
            options={[{ value: '', label: 'Todas las categorías' }, ...categorias.map(c => ({ value: c.id, label: c.nombre }))]} />
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
                <th>Beneficiario</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastosVisibles.map(g => (
                <tr key={g.id}>
                  <td>{g.fecha}</td>
                  <td><span className={styles.badge + ' ' + styles.badgeTeal}>{categoriasMap[g.categoriaId]?.nombre || g.categoria || '—'}</span></td>
                  <td className={styles.bold}>{beneficiariosMap[g.beneficiarioId]?.nombre || g.proveedor || '—'}</td>
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
            <CreatableSelect label="Categoría" value={editando.categoriaId}
              onChange={id => setEditando(f => ({ ...f, categoriaId: id }))}
              options={categoriasActivas}
              onCrearSimple={async (nombre) => crearCategoriaRapida(nombre)} />
            <CreatableSelect label="Beneficiario" value={editando.beneficiarioId}
              onChange={id => setEditando(f => ({ ...f, beneficiarioId: id }))}
              options={beneficiariosActivos}
              renderCreacionPersonalizada={({ texto, onCreado, onCancelar }) => (
                <BeneficiarioRapido texto={texto} onCrear={crearBeneficiarioRapido} onCreado={onCreado} onCancelar={onCancelar} />
              )} />
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

// Mini-formulario inline dentro del dropdown de CreatableSelect — tipo es
// obligatorio para un beneficiario, así que no se puede crear de un solo click
// como categoría (que solo necesita nombre).
function BeneficiarioRapido({ texto, onCrear, onCreado, onCancelar }) {
  const [nombre, setNombre] = useState(texto);
  const [tipo, setTipo] = useState('natural');
  const [guardando, setGuardando] = useState(false);

  async function handleCrear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const nuevo = await onCrear({ nombre: nombre.trim(), tipo });
      onCreado(nuevo);
    } catch (err) {
      alert('Error al crear: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
      <FormField label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
      <Select label="Tipo" value={tipo} onChange={setTipo}
        options={[{ value: 'natural', label: 'Persona natural' }, { value: 'empresa', label: 'Empresa' }]} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="secondary" onClick={onCancelar}>Cancelar</Btn>
        <Btn onClick={handleCrear} disabled={guardando || !nombre.trim()}>
          {guardando ? 'Creando...' : 'Crear'}
        </Btn>
      </div>
    </div>
  );
}
