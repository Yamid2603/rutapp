import { useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, getDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, storage, functions } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useCamiones, useUsuarios, useClientes, useRutas, useCategoriasGasto, useBeneficiariosGasto, useGastosEmpresa } from '../hooks/useCollection';
import { useUmbrales } from '../hooks/useAnalisisIA';
import { downloadCSV } from '../utils/csv';
import { money, validarTelefono } from '../utils/format';
import { idCatalogo } from '../utils/slug';
import { calcularBalance } from '../utils/balanceHelpers';
import Modal from '../components/Modal';
import FormField, { Select, Btn } from '../components/FormField';
import UbicacionPicker from '../components/UbicacionPicker';
import styles from './GestionPage.module.css';

export default function GestionPage() {
  const { empresaId } = useAuth();
  const { docs: camiones } = useCamiones(empresaId);
  const { docs: usuarios } = useUsuarios(empresaId);
  const { docs: clientes } = useClientes(empresaId);
  const { docs: rutas } = useRutas(empresaId);
  const { docs: categoriasGasto } = useCategoriasGasto(empresaId);
  const { docs: beneficiariosGasto } = useBeneficiariosGasto(empresaId);
  const { docs: gastosEmpresaDocs } = useGastosEmpresa(empresaId);
  const { umbrales, setUmbrales, guardarUmbrales, saving: savingU, loading: loadingU } = useUmbrales(empresaId);

  // ---- Categorías de gasto ----
  const [catForm, setCatForm] = useState(null); // null=cerrado, {}=nueva, {id,nombre,...}=editar
  const [catSaving, setCatSaving] = useState(false);

  async function guardarCategoria() {
    if (!catForm.nombre?.trim()) return;
    setCatSaving(true);
    try {
      const id = catForm.id || idCatalogo(empresaId, catForm.nombre);
      await setDoc(doc(db, 'categoriasGasto', id), {
        empresaId, nombre: catForm.nombre.trim(),
        activa: catForm.activa ?? true,
        creadoEn: catForm.creadoEn || new Date().toISOString(),
      });
      setCatForm(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCatSaving(false);
    }
  }

  async function toggleCategoria(cat) {
    await updateDoc(doc(db, 'categoriasGasto', cat.id), { activa: !cat.activa });
  }

  // ---- Beneficiarios ----
  const [benForm, setBenForm] = useState(null);
  const [benSaving, setBenSaving] = useState(false);

  async function guardarBeneficiario() {
    if (!benForm.nombre?.trim() || !benForm.tipo) return;
    setBenSaving(true);
    try {
      const id = benForm.id || idCatalogo(empresaId, benForm.nombre);
      await setDoc(doc(db, 'beneficiariosGasto', id), {
        empresaId, nombre: benForm.nombre.trim(), tipo: benForm.tipo,
        nitCedula: benForm.nitCedula?.trim() || null,
        activo: benForm.activo ?? true,
        creadoEn: benForm.creadoEn || new Date().toISOString(),
      });
      setBenForm(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBenSaving(false);
    }
  }

  async function toggleBeneficiario(ben) {
    await updateDoc(doc(db, 'beneficiariosGasto', ben.id), { activo: !ben.activo });
  }

  // ---- Balance (mismo cálculo que la pantalla Balance, reutilizado) ----
  const [balDesde, setBalDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [balHasta, setBalHasta] = useState(new Date().toISOString().split('T')[0]);
  const [balGenerando, setBalGenerando] = useState(false);

  async function exportBalance() {
    setBalGenerando(true);
    try {
      const dentroDelRango = (fecha) => fecha && fecha >= balDesde && fecha <= balHasta;
      const txSnap = await getDocs(query(collection(db, 'transacciones'), where('empresaId', '==', empresaId)));
      const transacciones = txSnap.docs.map(d => d.data()).filter(t => dentroDelRango(t.fecha));
      const gastosEmpresaFiltrado = gastosEmpresaDocs.filter(g => dentroDelRango(g.fecha));
      const rutasFiltradas = rutas.filter(r => dentroDelRango(r.fecha));

      const balance = calcularBalance({
        transacciones, gastosEmpresa: gastosEmpresaFiltrado, rutas: rutasFiltradas,
        categorias: categoriasGasto, periodoDesde: balDesde, periodoHasta: balHasta,
      });

      const rows = balance.filas.map(f => ({
        Mes: f.mes,
        ...Object.fromEntries(balance.nombresCategoria.map(n => [n, f.porCategoria[n] || 0])),
        'Sin clasificar': f.sinClasificar,
        Ventas: f.ventas,
        Gastos: f.gastosTotal,
        Utilidad: f.utilidad,
      }));
      rows.push({
        Mes: 'TOTAL',
        ...Object.fromEntries(balance.nombresCategoria.map(n => [n, balance.resumenAnual.porCategoria[n]])),
        'Sin clasificar': balance.resumenAnual.sinClasificar,
        Ventas: balance.resumenAnual.ventas,
        Gastos: balance.resumenAnual.gastosTotal,
        Utilidad: balance.resumenAnual.utilidad,
      });
      downloadCSV(rows, `balance-${balDesde}-a-${balHasta}.csv`);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBalGenerando(false);
    }
  }

  // ---- Facturación por período (clientes tipo 'facturacion') ----
  function primerYUltimoDiaMesActual() {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
    return { primero, ultimo };
  }
  const [facDesde, setFacDesde] = useState(primerYUltimoDiaMesActual().primero);
  const [facHasta, setFacHasta] = useState(primerYUltimoDiaMesActual().ultimo);
  const [facGenerando, setFacGenerando] = useState(false);

  async function exportFacturacion() {
    setFacGenerando(true);
    try {
      const diaDesde = Number(facDesde.split('-')[2]);
      const diaHasta = Number(facHasta.split('-')[2]);
      const clientesFacturables = clientes.filter(c =>
        c.tipo === 'facturacion' && c.diaFacturacion >= diaDesde && c.diaFacturacion <= diaHasta
      );
      if (!clientesFacturables.length) {
        alert('No hay clientes tipo "Facturación electrónica" con día de facturación en ese rango.');
        return;
      }

      const rows = [];
      let granTotal = 0;
      let transaccionesSinDetalle = 0;

      for (const cliente of clientesFacturables) {
        // Transacciones ya incluidas en una factura anterior — no se repiten
        const facturasSnap = await getDocs(query(
          collection(db, 'facturasGeneradas'),
          where('empresaId', '==', empresaId),
          where('clienteId', '==', cliente.id),
        ));
        const yaFacturadas = new Set(facturasSnap.docs.flatMap(d => d.data().transaccionIds || []));

        const txSnap = await getDocs(query(
          collection(db, 'transacciones'),
          where('empresaId', '==', empresaId),
          where('clienteId', '==', cliente.id),
        ));

        const txPendientes = txSnap.docs.filter(d => !yaFacturadas.has(d.id));
        if (!txPendientes.length) continue;

        let totalCliente = 0;
        const transaccionIdsIncluidas = [];
        for (const txDoc of txPendientes) {
          const tx = txDoc.data();
          transaccionIdsIncluidas.push(txDoc.id);
          if (!tx.detalle || !tx.detalle.length) {
            // Venta previa a que existiera el detalle por producto — se incluye
            // igual (no se pierde de la factura) pero sin desglose de línea.
            transaccionesSinDetalle++;
            rows.push({
              Cliente: cliente.nombre, NIT: cliente.nit || '—', Fecha: tx.fecha,
              Producto: '(sin detalle — venta anterior)', Cantidad: '—', 'Precio unitario': '—',
              Subtotal: tx.totalVenta || 0,
            });
            totalCliente += tx.totalVenta || 0;
            continue;
          }
          for (const linea of tx.detalle) {
            rows.push({
              Cliente: cliente.nombre, NIT: cliente.nit || '—', Fecha: tx.fecha,
              Producto: linea.nombre || linea.productoId, Cantidad: linea.cantidad,
              'Precio unitario': linea.precioUnitario, Subtotal: linea.subtotal,
            });
            totalCliente += linea.subtotal;
          }
        }
        rows.push({ Cliente: `TOTAL ${cliente.nombre}`, NIT: '', Fecha: '', Producto: '', Cantidad: '', 'Precio unitario': '', Subtotal: totalCliente });
        granTotal += totalCliente;

        // Sellar estas transacciones como ya facturadas — sin tocar transacciones (inmutable)
        await addDoc(collection(db, 'facturasGeneradas'), {
          empresaId, clienteId: cliente.id,
          periodoDesde: facDesde, periodoHasta: facHasta,
          fechaGeneracion: new Date().toISOString(),
          transaccionIds: transaccionIdsIncluidas,
          total: totalCliente,
          generadoPor: auth.currentUser?.uid ?? null,
        });
      }

      if (!rows.length) {
        alert('No hay entregas pendientes de facturar para estos clientes en este período.');
        return;
      }
      rows.push({ Cliente: 'GRAN TOTAL', NIT: '', Fecha: '', Producto: '', Cantidad: '', 'Precio unitario': '', Subtotal: granTotal });

      downloadCSV(rows, `facturacion-${facDesde}-a-${facHasta}.csv`);
      if (transaccionesSinDetalle > 0) {
        alert(`Nota: ${transaccionesSinDetalle} venta(s) incluida(s) sin desglose por producto (registradas antes de esta función) — se muestran con el monto total, sin línea por producto.`);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setFacGenerando(false);
    }
  }

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
          Municipio: cli?.municipio || '—',
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
          Municipio: c.municipio || '—',
          WhatsApp: c.wap1 || '—',
          Deuda: c.deuda || 0,
        })),
        { Cliente: 'TOTAL', Dirección: '', Municipio: '', WhatsApp: '', Deuda: totalDeuda },
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
        const totalGastos = rutasCam.reduce((s, r) => s + (r.gastos || []).reduce((g, x) => g + (x.monto ?? x.valor ?? 0), 0), 0);
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

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--cream-border)' }}>
          <div className={styles.cardTitle} style={{ fontSize: 14, marginBottom: 8 }}>Balance (mes × categoría)</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
            Mismo cálculo que la pantalla Balance — Ventas menos gastos por categoría, con Sin clasificar aparte.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Desde" type="date" value={balDesde} onChange={e => setBalDesde(e.target.value)} />
            <FormField label="Hasta" type="date" value={balHasta} onChange={e => setBalHasta(e.target.value)} />
            <Btn onClick={exportBalance} disabled={balGenerando}>
              {balGenerando ? 'Generando...' : '⬇ Exportar balance'}
            </Btn>
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--cream-border)' }}>
          <div className={styles.cardTitle} style={{ fontSize: 14, marginBottom: 8 }}>Facturación por período</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
            Clientes tipo "Facturación electrónica" cuyo día de facturación cae en el rango — entregas
            no facturadas aún, con detalle por producto. Lo que hoy es el Registro de Facturas a mano.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <FormField label="Desde" type="date" value={facDesde} onChange={e => setFacDesde(e.target.value)} />
            <FormField label="Hasta" type="date" value={facHasta} onChange={e => setFacHasta(e.target.value)} />
            <Btn onClick={exportFacturacion} disabled={facGenerando}>
              {facGenerando ? 'Generando...' : '⬇ Exportar facturación'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Section: Categorías de gasto */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Categorías de gasto</h3>
          <Btn onClick={() => setCatForm({ nombre: '' })}>+ Añadir categoría</Btn>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Nombre</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {categoriasGasto.map(c => (
              <tr key={c.id}>
                <td className={styles.bold}>{c.nombre}</td>
                <td>{c.activa ? 'Activa' : <span className={styles.muted}>Desactivada</span>}</td>
                <td className={styles.actionCell}>
                  <button className={styles.iconBtn} onClick={() => setCatForm(c)} title="Editar">✏️</button>
                  <button className={styles.iconBtn} onClick={() => toggleCategoria(c)} title={c.activa ? 'Desactivar' : 'Activar'}>
                    {c.activa ? '⏸️' : '▶️'}
                  </button>
                </td>
              </tr>
            ))}
            {!categoriasGasto.length && (
              <tr><td colSpan={3} className={styles.empty}>No hay categorías todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section: Beneficiarios */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Beneficiarios / proveedores</h3>
          <Btn onClick={() => setBenForm({ nombre: '', tipo: 'natural', nitCedula: '' })}>+ Añadir beneficiario</Btn>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>NIT/Cédula</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {beneficiariosGasto.map(b => (
              <tr key={b.id}>
                <td className={styles.bold}>{b.nombre}</td>
                <td>{b.tipo === 'empresa' ? 'Empresa' : 'Persona natural'}</td>
                <td>{b.nitCedula || '—'}</td>
                <td>{b.activo ? 'Activo' : <span className={styles.muted}>Desactivado</span>}</td>
                <td className={styles.actionCell}>
                  <button className={styles.iconBtn} onClick={() => setBenForm(b)} title="Editar">✏️</button>
                  <button className={styles.iconBtn} onClick={() => toggleBeneficiario(b)} title={b.activo ? 'Desactivar' : 'Activar'}>
                    {b.activo ? '⏸️' : '▶️'}
                  </button>
                </td>
              </tr>
            ))}
            {!beneficiariosGasto.length && (
              <tr><td colSpan={5} className={styles.empty}>No hay beneficiarios todavía</td></tr>
            )}
          </tbody>
        </table>
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
                style={{ width: 16, height: 16, accentColor: 'var(--teal)' }}
              />
              <span style={{ fontSize: 13, color: empresaForm.lat ? '#1a1a1a' : '#9CA3AF' }}>
                Iniciar y terminar rutas en la ubicación de la empresa
              </span>
            </label>
            {!empresaForm.lat && (
              <span style={{ fontSize: 11, color: 'var(--warning)' }}>
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

      <Modal open={!!catForm} onClose={() => setCatForm(null)} title={catForm?.id ? 'Editar categoría' : 'Nueva categoría'}>
        {catForm && (
          <>
            <FormField label="Nombre" value={catForm.nombre} onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setCatForm(null)}>Cancelar</Btn>
              <Btn onClick={guardarCategoria} disabled={catSaving || !catForm.nombre?.trim()}>
                {catSaving ? 'Guardando...' : 'Guardar'}
              </Btn>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!benForm} onClose={() => setBenForm(null)} title={benForm?.id ? 'Editar beneficiario' : 'Nuevo beneficiario'}>
        {benForm && (
          <>
            <FormField label="Nombre" value={benForm.nombre} onChange={e => setBenForm(f => ({ ...f, nombre: e.target.value }))} />
            <Select label="Tipo" value={benForm.tipo}
              onChange={v => setBenForm(f => ({ ...f, tipo: v }))}
              options={[{ value: 'natural', label: 'Persona natural' }, { value: 'empresa', label: 'Empresa' }]} />
            <FormField label="NIT / Cédula (opcional)" value={benForm.nitCedula || ''} onChange={e => setBenForm(f => ({ ...f, nitCedula: e.target.value }))} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setBenForm(null)}>Cancelar</Btn>
              <Btn onClick={guardarBeneficiario} disabled={benSaving || !benForm.nombre?.trim()}>
                {benSaving ? 'Guardando...' : 'Guardar'}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
