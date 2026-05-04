import { useState } from 'react';
import { doc, setDoc, updateDoc, getDocs, collection, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useProductos } from '../hooks/useCollection';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './ProductosPage.module.css';

const EMOJIS = ['💧', '🧴', '📦', '🪣', '🥤'];
const EMPTY = { nombre: '', precioBase: '', retornable: false };

export default function ProductosPage() {
  const { empresaId } = useAuth();
  const { docs: productos, loading } = useProductos(empresaId);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  function openAdd() {
    setForm({ ...EMPTY });
    setModal('add');
  }

  function openEdit(p) {
    setForm({ nombre: p.nombre, precioBase: p.precioBase ?? '', retornable: p.retornable ?? false });
    setModal(p);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const precioBase = Number(form.precioBase) || 0;
      const retornable = form.retornable ?? false;
      if (modal === 'add') {
        const id = crypto.randomUUID().slice(0, 8);
        await setDoc(doc(db, 'productos', id), { nombre: form.nombre, precioBase, retornable, empresaId });
      } else {
        await updateDoc(doc(db, 'productos', modal.id), { nombre: form.nombre, precioBase, retornable });
      }
      setModal(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAplicarPrecios() {
    if (!window.confirm('¿Aplicar precios base a TODOS los clientes? Se sobreescribirán los precios existentes.')) return;
    setApplying(true);
    try {
      const clientesSnap = await getDocs(query(collection(db, 'clientes'), where('empresaId', '==', empresaId)));
      const batch = writeBatch(db);
      clientesSnap.docs.forEach(clienteDoc => {
        const updates = {};
        productos.forEach(p => {
          if (p.precioBase > 0) updates[`preciosCliente.${p.id}`] = p.precioBase;
        });
        if (Object.keys(updates).length) batch.update(clienteDoc.ref, updates);
      });
      await batch.commit();
      alert(`Precios aplicados a ${clientesSnap.size} clientes.`);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <p style={{ color: '#8B949E' }}>Cargando...</p>;

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Productos</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={handleAplicarPrecios} disabled={applying}>
            {applying ? 'Aplicando...' : 'Aplicar precios base a clientes'}
          </Btn>
          <Btn onClick={openAdd}>+ Añadir producto</Btn>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Producto</th>
              <th>Precio base</th>
              <th>Retornable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr key={p.id}>
                <td className={styles.emoji}>{EMOJIS[i % EMOJIS.length]}</td>
                <td className={styles.bold}>{p.nombre}</td>
                <td style={{ color: p.precioBase > 0 ? '#1693A5' : '#8B949E', fontSize: 13 }}>
                  {p.precioBase > 0 ? `$${Number(p.precioBase).toLocaleString('es-CO')}` : '—'}
                </td>
                <td style={{ textAlign: 'center', fontSize: 13, color: p.retornable ? '#2E7D6B' : '#8B949E' }}>
                  {p.retornable ? '♻️ Sí' : '—'}
                </td>
                <td>
                  <button className={styles.editBtn} onClick={() => openEdit(p)}>✏️</button>
                </td>
              </tr>
            ))}
            {!productos.length && (
              <tr><td colSpan={4} className={styles.empty}>No hay productos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Nuevo producto' : 'Editar producto'}
      >
        <FormField label="Nombre del producto" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        <FormField label="Precio base ($)" value={form.precioBase} onChange={e => setForm(f => ({ ...f, precioBase: e.target.value }))} type="number" placeholder="0" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, color: '#1a1a1a', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.retornable} onChange={e => setForm(f => ({ ...f, retornable: e.target.checked }))} />
          ♻️ Producto retornable (el conductor recoge envases vacíos)
        </label>
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
