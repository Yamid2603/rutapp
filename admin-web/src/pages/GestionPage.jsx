import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, storage, functions } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useCamiones, useUsuarios, useClientes, useRutas } from '../hooks/useCollection';
import { useUmbrales } from '../hooks/useAnalisisIA';
import { downloadCSV } from '../utils/csv';
import { money, validarTelefono } from '../utils/format';
import Modal from '../components/Modal';
import FormField, { Btn } from '../components/FormField';
import UbicacionPicker from '../components/UbicacionPicker';
import styles from './GestionPage.module.css';

export default function GestionPage() {
  const { empresaId } = useAuth();
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: usuarios } = useUsuarios(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const { docs: rutas } = useRutas(empresaId);
  const { umbrales, setUmbrales, guardarUmbrales, saving: savingU, loading: loadingU } = useUmbrales(empresaId);

  // ---- Camiones & Conductores ----
  const [addCamionOpen, setAddCamionOpen] = useState(false);
  const [editCamion, setEditCamion] = useState(null);
  const [reasignar, setReasignar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [camionForm, setCamionForm] = useState({
    nombre: '', placa: '', zona: '', email: '', password: '', telefono: '',
  });

  const [reasignarForm, setReasignarForm] = useState({
    motivo: '', nombre: '', email: '', password: '', telefono: '',
  });

  // ---- Empresa config ----
  const [empresaForm, setEmpresaForm] = useState({
    nombre: '', nit: '', direccion: '', telefono: '', lat: null, lng: null, rutaDesdeEmpresa: false,
  });
  const [empresaSaving, setEmpresaSaving] = useState(false);
  const [logoActual, setLogoActual] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    getDoc(doc(db, 'empresas', empresaId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setEmpresaForm({
          nombre: d.nombre || '',
          nit: d.nit || '',
          direccion: d.direccion || '',
          telefono: d.telefono || '',
          lat: d.lat || null,
          lng: d.lng || null,
          rutaDesdeEmpresa: d.rutaDesdeEmpresa ?? false,
        });
        setLogoActual(d.logoUrl || null);
      }
    });
  }, [empresaId]);

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    setLogoUploading(true);
    try {
      const logoRef = ref(storage, `logos/${empresaId}`);
      await uploadBytes(logoRef, logoFile);
      const url = await getDownloadURL(logoRef);
      await updateDoc(doc(db, 'empresas', empresaId), { logoUrl: url });
      setLogoActual(url);
      setLogoFile(null);
      setLogoPreview(null);
      alert('Logo actualizado');
    } catch (err) {
      alert('Error al subir logo: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  }

  function getConductor(camion) {
    return usuarios.find(u => u.id === camion.conductorId);
  }

  // Add camion + create conductor auth via Cloud Function
  async function handleAddCamion() {
    if (!camionForm.nombre.trim()) return;
    const telError = validarTelefono(camionForm.telefono);
    if (telError) { alert(telError); return; }
    setSaving(true);
    try {
      const camionId = crypto.randomUUID().slice(0, 8);
      let condUid = null;

      // 1. Crear conductor (si email+password) — Cloud Function ya guarda camionId
      if (camionForm.email.trim() && camionForm.password.trim()) {
        const fn = httpsCallable(functions, 'crearConductor');
        const result = await fn({
          email: camionForm.email.trim(),
          password: camionForm.password,
          nombre: camionForm.nombre.trim(),
          empresaId,
          camionId,
          telefono: camionForm.telefono.trim() || undefined,
        });
        condUid = result.data.uid;

        // Enviar email de reseteo desde el cliente (la Cloud Function NO lo envía)
        try {
          await sendPasswordResetEmail(auth, camionForm.email.trim());
        } catch {
          // No bloquear: el conductor puede entrar con la password temporal
        }
      }

      // 2. Crear camión apuntando al conductor
      await setDoc(doc(db, 'camiones', camionId), {
        empresaId,
        nombre: camionForm.nombre,
        placa: camionForm.placa,
        zona: camionForm.zona || null,
        conductorId: condUid,
      });

      setAddCamionOpen(false);
      setCamionForm({ nombre: '', placa: '', zona: '', email: '', password: '', telefono: '' });
    } catch (err) {
      const msg = err?.details?.message || err?.message || 'Error desconocido';
      alert('Error: ' + msg);
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
    setCamionForm({ nombre: c.nombre, placa: c.placa, zona: c.zona || '', email: '', password: '', telefono: '' });
    setEditCamion(c);
  }

  // Reasignar conductor
  async function handleReasignar() {
    const telError = validarTelefono(reasignarForm.telefono);
    if (telError) { alert(telError); return; }
    setSaving(true);
    try {
      const camionActual = camiones.find(c => c.id === reasignar.id);
      const oldUid = camionActual?.conductorId || null;

      // 1. Crear nuevo conductor
      const fnCrear = httpsCallable(functions, 'crearConductor');
      const result = await fnCrear({
        email: reasignarForm.email.trim(),
        password: reasignarForm.password,
        nombre: reasignarForm.nombre.trim(),
        empresaId,
        camionId: reasignar.id,
        telefono: reasignarForm.telefono.trim() || undefined,
      });
      const newUid = result.data.uid;

      try { await sendPasswordResetEmail(auth, reasignarForm.email.trim()); } catch {}

      // 2. Apuntar el camión al nuevo conductor
      await updateDoc(doc(db, 'camiones', reasignar.id), {
        conductorId: newUid,
        ultimoMotivoSalida: reasignarForm.motivo || null,
      });

      // 3. Desactivar al conductor anterior (deshabilitar Auth + revocar tokens)
      if (oldUid && oldUid !== newUid) {
        try {
          const fnDesact = httpsCallable(functions, 'desactivarConductor');
          await fnDesact({ uid: oldUid });
        } catch (e) {
          console.warn('No se pudo desactivar conductor anterior:', e?.message || e);
        }
      }

      setReasignar(null);
      setReasignarForm({ motivo: '', nombre: '', email: '', password: '', telefono: '' });
    } catch (err) {
      const msg = err?.details?.message || err?.message || 'Error desconocido';
      alert('Error: ' + msg);
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
        lat: empresaForm.lat,
        lng: empresaForm.lng,
        rutaDesdeEmpresa: empresaForm.rutaDesdeEmpresa,
      });
      alert('Configuración guardada');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEmpresaSaving(false);
    }
  }

  // ---- Exportar datos ----
  async function exportTransacciones() {
    try {
      const snap = await getDocs(query(collection(db, 'transacciones'), where('empresaId', '==', empresaId)));
      if (snap.empty) { alert('No hay transacciones registradas aún'); return; }
      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
      const conductorMap = Object.fromEntries(usuarios.map(u => [u.id, u]));
      const rows = snap.docs.map(d => {
        const t = d.data();
        const cli = clienteMap[t.clienteId];
        const cond = conductorMap[t.conductorId];
        return {
          Fecha: t.fecha || '',
          Hora: t.hora || '',
          Cliente: cli?.nombre || t.clienteId || '—',
          Dirección: cli?.direccion || '—',
          Conductor: cond?.nombre || '—',
          'Total vendido': t.totalVenta || 0,
          'Total cobrado': t.totalCobrado || 0,
          'Deuda anterior': t.deudaAnterior || 0,
          'Deuda resultante': t.deudaResultante || 0,
          'Forma de pago': t.formaPago || '—',
        };
      });
      downloadCSV(rows, `transacciones-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function exportCuentasPorCobrar() {
    try {
      const conDeuda = clientes.filter(c => (c.deuda || 0) > 0);
      if (!conDeuda.length) { alert('No hay cuentas por cobrar'); return; }
      const totalDeuda = conDeuda.reduce((s, c) => s + (c.deuda || 0), 0);
      const rows = [
        ...conDeuda.map(c => ({
          Cliente: c.nombre,
          Dirección: c.direccion || '—',
          WhatsApp: c.wap1 || '—',
          Deuda: c.deuda || 0,
        })),
        { Cliente: 'TOTAL', Dirección: '', WhatsApp: '', Deuda: totalDeuda },
      ];
      downloadCSV(rows, `cuentas-por-cobrar-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function exportRendimientoCamiones() {
    try {
      if (!camiones.length) { alert('No hay camiones registrados'); return; }
      const rows = camiones.map(cam => {
        const conductor = usuarios.find(u => u.id === cam.conductorId);
        const rutasCam = rutas.filter(r => r.camionId === cam.id);
        const totalVentas = rutasCam.reduce((s, r) => s + (r.paradas || []).reduce((ps, p) => ps + (p.totalVenta || 0), 0), 0);
        const totalCobrado = rutasCam.reduce((s, r) => s + (r.paradas || []).reduce((ps, p) => ps + (p.totalCobrado || 0), 0), 0);
        const totalGastos = rutasCam.reduce((s, r) => s + (r.gastos || []).reduce((g, x) => g + (x.monto || 0), 0), 0);
        const clientesAtendidos = new Set(
          rutasCam.flatMap(r => (r.paradas || []).filter(p => p.estado === 'completado').map(p => p.clienteId))
        ).size;
        return {
          Camión: cam.nombre,
          Placa: cam.placa,
          Conductor: conductor?.nombre || '—',
          'Rutas realizadas': rutasCam.length,
          'Clientes atendidos': clientesAtendidos,
          'Total vendido': totalVentas,
          'Total cobrado': totalCobrado,
          'Total gastos': totalGastos,
          Neto: totalCobrado - totalGastos,
          '% Cobranza': totalVentas > 0 ? Math.round((totalCobrado / totalVentas) * 100) + '%' : '—',
        };
      });
      downloadCSV(rows, `rendimiento-camiones-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function exportContabilidad() {
    try {
      const snap = await getDocs(query(collection(db, 'transacciones'), where('empresaId', '==', empresaId)));
      if (snap.empty) { alert('No hay transacciones registradas aún'); return; }
      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
      let saldoAcumulado = 0;
      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
        .flatMap(t => {
          const cli = clienteMap[t.clienteId];
          const nombreCliente = cli?.nombre || t.clienteId || '—';
          const cobrado = t.totalCobrado || 0;
          const venta = t.totalVenta || 0;
          const deudaResult = t.deudaResultante || 0;
          saldoAcumulado += cobrado;
          const entries = [{
            Fecha: t.fecha || '',
            Concepto: cobrado >= venta ? 'Cobro de venta' : cobrado > 0 ? 'Cobro parcial' : 'Venta a crédito',
            'Cliente/Tercero': nombreCliente,
            'Forma de pago': t.formaPago || '—',
            'Venta total': venta,
            Cobrado: cobrado,
            'Saldo acumulado': saldoAcumulado,
          }];
          if (deudaResult > 0) {
            entries.push({
              Fecha: t.fecha || '',
              Concepto: 'Pasivo — deuda pendiente',
              'Cliente/Tercero': nombreCliente,
              'Forma de pago': '—',
              'Venta total': 0,
              Cobrado: 0,
              'Saldo acumulado': saldoAcumulado,
              Pasivo: deudaResult,
            });
          }
          return entries;
        });
      downloadCSV(rows, `contabilidad-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Gestión</h1>

      {/* Section: Camiones & Conductores */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Camiones & Conductores</h3>
          <Btn onClick={() => { setCamionForm({ nombre: '', placa: '', zona: '', email: '', password: '', telefono: '' }); setAddCamionOpen(true); }}>
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
                    {cond?.telefono && (
                      <a
                        href={`https://wa.me/${cond.telefono.replace('+', '')}`}
                        target="_blank" rel="noreferrer"
                        className={styles.wapBtn}
                        title={cond.telefono}
                      ></a>
                    )}
                    <button className={styles.iconBtn} onClick={() => openEditCamion(c)} title="Editar">✏️</button>
                    <button className={styles.iconBtn} onClick={() => { setReasignar(c); setReasignarForm({ motivo: '', nombre: '', email: '', password: '', telefono: '' }); }} title="Reasignar conductor">🔄</button>
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
        <h3 className={styles.cardTitle}>Exportar datos</h3>
        <div className={styles.exportGrid}>
          <button className={styles.exportBtn} onClick={exportTransacciones}>
            Transacciones completas
          </button>
          <button className={styles.exportBtn} onClick={exportCuentasPorCobrar}>
            Cuentas por cobrar
          </button>
          <button className={styles.exportBtn} onClick={exportRendimientoCamiones}>
            Rendimiento por camión
          </button>
          <button className={styles.exportBtn} onClick={exportContabilidad}>
            🧾 Para contabilidad
          </button>
        </div>
      </div>

      {/* Section: Umbrales IA */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>🎯 Configurar Umbrales de Análisis IA</h3>
        {loadingU ? (
          <p className={styles.muted}>Cargando umbrales...</p>
        ) : (
          <>
            <div className={styles.configGrid}>
              <FormField
                label="Conductor ineficiente (%)"
                type="number"
                min={0} max={100}
                value={umbrales.conductorIneficiente}
                onChange={e => setUmbrales({ ...umbrales, conductorIneficiente: Number(e.target.value) })}
                placeholder="70"
              />
              <FormField
                label="Gastos anormales (× promedio)"
                type="number"
                min={1} max={10}
                step={0.1}
                value={umbrales.gastosAnormales}
                onChange={e => setUmbrales({ ...umbrales, gastosAnormales: Number(e.target.value) })}
                placeholder="2"
              />
              <FormField
                label="Cliente en riesgo (meses bajando)"
                type="number"
                min={1} max={12}
                value={umbrales.clienteRiesgoMeses}
                onChange={e => setUmbrales({ ...umbrales, clienteRiesgoMeses: Number(e.target.value) })}
                placeholder="3"
              />
              <FormField
                label="Cliente oportunidad (% pago mín)"
                type="number"
                min={0} max={100}
                value={umbrales.clienteOportunidadPago}
                onChange={e => setUmbrales({ ...umbrales, clienteOportunidadPago: Number(e.target.value) })}
                placeholder="90"
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <Btn
                onClick={async () => {
                  try {
                    await guardarUmbrales(umbrales);
                    alert('Umbrales guardados');
                  } catch {
                    alert('Error al guardar umbrales');
                  }
                }}
                disabled={savingU}
              >
                {savingU ? 'Guardando...' : 'Guardar Umbrales'}
              </Btn>
            </div>
          </>
        )}
      </div>

      {/* Section: Config empresa */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <h3 className={styles.cardTitle}>Configuración empresa</h3>
        <div className={styles.configGrid}>
          <FormField label="Nombre" value={empresaForm.nombre} onChange={e => setEmpresaForm({ ...empresaForm, nombre: e.target.value })} />
          <FormField label="NIT" value={empresaForm.nit} onChange={e => setEmpresaForm({ ...empresaForm, nit: e.target.value })} />
          <FormField label="Dirección" value={empresaForm.direccion} onChange={e => setEmpresaForm({ ...empresaForm, direccion: e.target.value })} />
          <div style={{ marginTop: 8, gridColumn: '1 / -1' }}>
            <UbicacionPicker
              lat={empresaForm.lat}
              lng={empresaForm.lng}
              onSelect={({ lat, lng, direccion }) =>
                setEmpresaForm(f => ({ ...f, lat, lng, direccion }))
              }
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: empresaForm.lat ? 'pointer' : 'not-allowed' }}>
              <input
                type="checkbox"
                checked={empresaForm.rutaDesdeEmpresa}
                disabled={!empresaForm.lat || !empresaForm.lng}
                onChange={e => setEmpresaForm(f => ({ ...f, rutaDesdeEmpresa: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#1693A5' }}
              />
              <span style={{ fontSize: 13, color: empresaForm.lat ? '#1a1a1a' : '#9CA3AF' }}>
                Iniciar y terminar rutas en la ubicación de la empresa
              </span>
            </label>
            {!empresaForm.lat && (
              <span style={{ fontSize: 11, color: '#C07B2A' }}>
                ⚠️ Configura la ubicación primero
              </span>
            )}
          </div>
          <FormField label="Teléfono" value={empresaForm.telefono} onChange={e => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} />
        </div>
        <div className={styles.logoSection}>
          <p className={styles.logoLabel}>LOGO DE LA EMPRESA</p>
          <div className={styles.logoRow}>
            {(logoPreview || logoActual) && (
              <img
                src={logoPreview || logoActual}
                alt="Logo empresa"
                className={styles.logoPreviewImg}
              />
            )}
            <label className={styles.logoUploadBtn}>
              {logoPreview ? 'Cambiar imagen' : logoActual ? 'Reemplazar logo' : 'Subir logo'}
              <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </label>
            {logoFile && (
              <Btn onClick={handleLogoUpload} disabled={logoUploading}>
                {logoUploading ? 'Subiendo...' : 'Guardar logo'}
              </Btn>
            )}
          </div>
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
        <FormField label="Teléfono conductor (opcional)" type="tel" placeholder="+573001234567" value={camionForm.telefono} onChange={e => setCamionForm({ ...camionForm, telefono: e.target.value })} />
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
        <FormField label="Teléfono (opcional)" type="tel" placeholder="+573001234567" value={reasignarForm.telefono} onChange={e => setReasignarForm({ ...reasignarForm, telefono: e.target.value })} />
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
