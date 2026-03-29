import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useProductos } from '../hooks/useCollection';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './ProductosPage.module.css';

const EMOJIS = ['💧', '🧴', '📦', '🪣', '🥤'];
const EMPTY = { nombre: '' };

export default function ProductosPage() {
  const { empresaId } = useAuth();
  const { docs: productos, loading } = useProductos(empresaId);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setForm({ ...EMPTY });
    setModal('add');
  }

  function openEdit(p) {
    setForm({ nombre: p.nombre });
    setModal(p);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (modal === 'add') {
        const id = crypto.randomUUID().slice(0, 8);
        await setDoc(doc(db, 'productos', id), { nombre: form.nombre, empresaId });
      } else {
        await updateDoc(doc(db, 'productos', modal.id), { nombre: form.nombre });
      }
      setModal(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: '#8B949E' }}>Cargando...</p>;

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Productos</h1>
        <Btn onClick={openAdd}>+ Añadir producto</Btn>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Producto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr key={p.id}>
                <td className={styles.emoji}>{EMOJIS[i % EMOJIS.length]}</td>
                <td className={styles.bold}>{p.nombre}</td>
                <td>
                  <button className={styles.editBtn} onClick={() => openEdit(p)}>✏️</button>
                </td>
              </tr>
            ))}
            {!productos.length && (
              <tr><td colSpan={3} className={styles.empty}>No hay productos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Nuevo producto' : 'Editar producto'}
      >
        <FormField label="Nombre del producto" value={form.nombre} onChange={e => setForm({ nombre: e.target.value })} />
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
