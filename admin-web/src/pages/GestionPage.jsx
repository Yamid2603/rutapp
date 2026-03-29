import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useCamiones, useUsuarios } from '../hooks/useCollection';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import styles from './GestionPage.module.css';

export default function GestionPage() {
  const { empresaId } = useAuth();
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: usuarios } = useUsuarios(empresaId);

  // ---- Camiones & Conductores ----
  const [addCamionOpen, setAddCamionOpen] = useState(false);
  const [editCamion, setEditCamion] = useState(null);
  const [reasignar, setReasignar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [camionForm, setCamionForm] = useState({
    nombre: '', placa: '', zona: '', email: '', password: '',
  });

  const [reasignarForm, setReasignarForm] = useState({
    motivo: '', nombre: '', email: '', password: '',
  });

  // ---- Empresa config ----
  const [empresaForm, setEmpresaForm] = useState({
    nombre: '', nit: '', direccion: '', telefono: '',
  });
  const [empresaSaving, setEmpresaSaving] = useState(false);

  function getConductor(camion) {
    return usuarios.find(u => u.id === camion.conductorId);
  }

  // Add camion + create conductor auth
  async function handleAddCamion() {
    setSaving(true);
    try {
      // Note: Creating a user with createUserWithEmailAndPassword will sign in as that user.
      // In production, use Admin SDK. For now, we create the user doc directly.
      const camionId = crypto.randomUUID().slice(0, 8);
      await setDoc(doc(db, 'camiones', camionId), {
        empresaId,
        nombre: camionForm.nombre,
        placa: camionForm.placa,
        zona: camionForm.zona,
        conductorId: null, // Will be linked when conductor logs in
      });
      // Create usuario document placeholder
      const placeholderUid = 'pending_' + camionId;
      await setDoc(doc(db, 'usuarios', placeholderUid), {
        nombre: camionForm.email.split('@')[0],
        rol: 'conductor',
        empresaId,
        camionId,
        email: camionForm.email,
        pendiente: true,
      });
      setAddCamionOpen(false);
      setCamionForm({ nombre: '', placa: '', zona: '', email: '', password: '' });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Edit camion
  async function handleEditCamion() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'camiones', editCamion.id), {
        nombre: camionForm.nombre,
        placa: camionForm.placa,
        zona: camionForm.zona || null,
      });
      setEditCamion(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditCamion(c) {
    setCamionForm({ nombre: c.nombre, placa: c.placa, zona: c.zona || '', email: '', password: '' });
    setEditCamion(c);
  }

  // Reasignar conductor
  async function handleReasignar() {
    setSaving(true);
    try {
      // Mark old conductor with exit reason
      if (reasignar.conductorId) {
        await updateDoc(doc(db, 'usuarios', reasignar.conductorId), {
          motivoSalida: reasignarForm.motivo,
          activo: false,
        });
      }
      // Create new conductor placeholder
      const newUid = 'pending_' + reasignar.id + '_' + Date.now();
      await setDoc(doc(db, 'usuarios', newUid), {
        nombre: reasignarForm.nombre,
        rol: 'conductor',
        empresaId,
        camionId: reasignar.id,
        email: reasignarForm.email,
        pendiente: true,
      });
      await updateDoc(doc(db, 'camiones', reasignar.id), {
        conductorId: newUid,
      });
      setReasignar(null);
      setReasignarForm({ motivo: '', nombre: '', email: '', password: '' });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Save empresa config
  async function handleSaveEmpresa() {
    setEmpresaSaving(true);
    try {
      await updateDoc(doc(db, 'empresas', empresaId), {
        nombre: empresaForm.nombre || null,
        nit: empresaForm.nit || null,
        direccion: empresaForm.direccion || null,
        telefono: empresaForm.telefono || null,
      });
      alert('Configuración guardada');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEmpresaSaving(false);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Gestión</h1>

      {/* Section: Camiones & Conductores */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>🚛 Camiones & Conductores</h3>
          <Btn onClick={() => { setCamionForm({ nombre: '', placa: '', zona: '', email: '', password: '' }); setAddCamionOpen(true); }}>
            + Añadir camión
          </Btn>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Camión</th>
              <th>Placa</th>
              <th>Conductor</th>
              <th>Zona</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {camiones.map(c => {
              const cond = getConductor(c);
              return (
                <tr key={c.id}>
                  <td className={styles.bold}>{c.nombre}</td>
                  <td>{c.placa}</td>
                  <td>{cond?.nombre || <span className={styles.muted}>Sin asignar</span>}</td>
                  <td>{c.zona || '—'}</td>
                  <td className={styles.actionCell}>
                    <button className={styles.iconBtn} onClick={() => openEditCamion(c)} title="Editar">✏️</button>
                    <button className={styles.iconBtn} onClick={() => { setReasignar(c); setReasignarForm({ motivo: '', nombre: '', email: '', password: '' }); }} title="Reasignar conductor">🔄</button>
                  </td>
                </tr>
              );
            })}
            {!camiones.length && (
              <tr><td colSpan={5} className={styles.empty}>No hay camiones</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section: Exportar datos */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>📊 Exportar datos</h3>
        <div className={styles.exportGrid}>
          <button className={styles.exportBtn}>📋 Transacciones completas (Fase 6)</button>
          <button className={styles.exportBtn}>💳 Cuentas por cobrar (Fase 6)</button>
          <button className={styles.exportBtn}>🚛 Rendimiento por camión (Fase 6)</button>
          <button className={styles.exportBtn}>🧾 Exportar para contabilidad (Fase 6)</button>
        </div>
      </div>

      {/* Section: Config empresa */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>🏢 Configuración empresa</h3>
        <div className={styles.configGrid}>
          <FormField label="Nombre" value={empresaForm.nombre} onChange={e => setEmpresaForm({ ...empresaForm, nombre: e.target.value })} />
          <FormField label="NIT" value={empresaForm.nit} onChange={e => setEmpresaForm({ ...empresaForm, nit: e.target.value })} />
          <FormField label="Dirección" value={empresaForm.direccion} onChange={e => setEmpresaForm({ ...empresaForm, direccion: e.target.value })} />
          <FormField label="Teléfono" value={empresaForm.telefono} onChange={e => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} />
        </div>
        <div className={styles.logoStub}>
          <span>📷 Subir logo (Fase 6)</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn onClick={handleSaveEmpresa} disabled={empresaSaving}>
            {empresaSaving ? 'Guardando...' : 'Guardar configuración'}
          </Btn>
        </div>
      </div>

      {/* Modal: Add camion */}
      <Modal open={addCamionOpen} onClose={() => setAddCamionOpen(false)} title="Nuevo camión">
        <FormField label="Nombre del camión" value={camionForm.nombre} onChange={e => setCamionForm({ ...camionForm, nombre: e.target.value })} />
        <FormField label="Placa" value={camionForm.placa} onChange={e => setCamionForm({ ...camionForm, placa: e.target.value })} />
        <FormField label="Zona" value={camionForm.zona} onChange={e => setCamionForm({ ...camionForm, zona: e.target.value })} />
        <FormField label="Email conductor" type="email" value={camionForm.email} onChange={e => setCamionForm({ ...camionForm, email: e.target.value })} />
        <FormField label="Contraseña conductor" type="password" value={camionForm.password} onChange={e => setCamionForm({ ...camionForm, password: e.target.value })} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setAddCamionOpen(false)}>Cancelar</Btn>
          <Btn onClick={handleAddCamion} disabled={saving || !camionForm.nombre.trim()}>
            {saving ? 'Creando...' : 'Crear camión'}
          </Btn>
        </div>
      </Modal>

      {/* Modal: Edit camion */}
      <Modal open={!!editCamion} onClose={() => setEditCamion(null)} title="Editar camión">
        <FormField label="Nombre" value={camionForm.nombre} onChange={e => setCamionForm({ ...camionForm, nombre: e.target.value })} />
        <FormField label="Placa" value={camionForm.placa} onChange={e => setCamionForm({ ...camionForm, placa: e.target.value })} />
        <FormField label="Zona" value={camionForm.zona} onChange={e => setCamionForm({ ...camionForm, zona: e.target.value })} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setEditCamion(null)}>Cancelar</Btn>
          <Btn onClick={handleEditCamion} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </Modal>

      {/* Modal: Reasignar */}
      <Modal open={!!reasignar} onClose={() => setReasignar(null)} title="Reasignar conductor">
        <div className={styles.warning}>
          ⚠️ Los clientes e historial se mantienen en el camión.
        </div>
        <FormField label="Motivo de salida del conductor actual" value={reasignarForm.motivo} onChange={e => setReasignarForm({ ...reasignarForm, motivo: e.target.value })} />
        <FormField label="Nombre nuevo conductor" value={reasignarForm.nombre} onChange={e => setReasignarForm({ ...reasignarForm, nombre: e.target.value })} />
        <FormField label="Email" type="email" value={reasignarForm.email} onChange={e => setReasignarForm({ ...reasignarForm, email: e.target.value })} />
        <FormField label="Contraseña" type="password" value={reasignarForm.password} onChange={e => setReasignarForm({ ...reasignarForm, password: e.target.value })} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setReasignar(null)}>Cancelar</Btn>
          <Btn onClick={handleReasignar} disabled={saving || !reasignarForm.nombre.trim()}>
            {saving ? 'Guardando...' : 'Reasignar'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
