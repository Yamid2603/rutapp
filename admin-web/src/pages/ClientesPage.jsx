import { useState } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useClientes, useProductos } from '../hooks/useCollection';
import { money } from '../utils/format';
import { downloadCSV } from '../utils/csv';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './ClientesPage.module.css';

const EMPTY = {
  nombre: '', direccion: '', wap1: '', wap2: '', notas: '',
  deuda: 0, fotoUrl: null, pedidoUsual: {}, preciosCliente: {},
};

export default function ClientesPage() {
  const { empresaId } = useAuth();
  const { docs: clientes, loading } = useClientes(empresaId);
  const { docs: productos } = useProductos(empresaId);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  function openAdd() {
    const preciosCliente = {};
    productos.forEach(p => { preciosCliente[p.id] = 0; });
    setForm({ ...EMPTY, preciosCliente });
    setModal('add');
  }

  function openEdit(c) {
    const preciosCliente = { ...c.preciosCliente };
    productos.forEach(p => {
      if (preciosCliente[p.id] === undefined) preciosCliente[p.id] = 0;
    });
    setForm({ ...c, preciosCliente });
    setModal(c);
  }

  function setPrice(productoId, val) {
    setForm(f => ({ ...f, preciosCliente: { ...f.preciosCliente, [productoId]: Number(val) || 0 } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'add') {
        const ref = doc(db, 'clientes', crypto.randomUUID());
        await setDoc(ref, { ...form, empresaId, deuda: Number(form.deuda) || 0, creadoEn: serverTimestamp() });
      } else {
        const ref = doc(db, 'clientes', modal.id);
        const updates = { ...form };
        delete updates.id;
        updates.deuda = Number(form.deuda) || 0;
        await updateDoc(ref, updates);
      }
      setModal(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const rows = clientes.map(c => ({
      Nombre: c.nombre, Dirección: c.direccion, WhatsApp: c.wap1,
      Deuda: c.deuda || 0, Notas: c.notas,
    }));
    downloadCSV(rows, 'clientes.csv');
  }

  const filtered = clientes.filter(c =>
    !search || c.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ color: '#8B949E' }}>Cargando...</p>;

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Clientes</h1>
        <div className={styles.actions}>
          <input
            className={styles.search}
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Btn onClick={openAdd}>+ Añadir cliente</Btn>
          <Btn variant="secondary" onClick={exportCSV}>⬇ Exportar CSV</Btn>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Saldo</th>
              <th>WhatsApp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td className={styles.bold}>{c.nombre}</td>
                <td>{c.direccion}</td>
                <td className={c.deuda > 0 ? styles.red : styles.green}>
                  {money(c.deuda || 0)}
                </td>
                <td className={styles.muted}>{c.wap1}</td>
                <td>
                  <button className={styles.editBtn} onClick={() => openEdit(c)}>✏️</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} className={styles.empty}>No hay clientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Nuevo cliente' : 'Editar cliente'}
        wide
      >
        <FormField label="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
        <FormField label="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
        <FormField label="WhatsApp 1" value={form.wap1} onChange={e => setForm({ ...form, wap1: e.target.value })} />
        <FormField label="WhatsApp 2" value={form.wap2 || ''} onChange={e => setForm({ ...form, wap2: e.target.value })} />
        <FormField label="Notas" value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} />
        {productos.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8B949E', margin: '12px 0 8px' }}>
              Precios del cliente
            </div>
            <div className={styles.priceGrid}>
              {productos.map(p => (
                <FormField
                  key={p.id}
                  label={p.nombre}
                  type="number"
                  value={form.preciosCliente?.[p.id] ?? 0}
                  onChange={e => setPrice(p.id, e.target.value)}
                />
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving || !form.nombre.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
