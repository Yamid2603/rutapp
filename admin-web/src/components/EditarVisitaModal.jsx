import { useMemo, useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { money } from '../utils/format';
import Modal from './Modal';
import styles from './EditarVisitaModal.module.css';

const FORMAS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'empresa', label: 'Empresa' },
];

export default function EditarVisitaModal({ parada, ruta, cliente, productos, empresaId, onClose }) {
  const [cantidades, setCantidades] = useState({ ...parada.cantidades });
  const [totalCobrado, setTotalCobrado] = useState(String(parada.totalCobrado ?? 0));
  const [formaPago, setFormaPago] = useState(parada.formaPago || 'efectivo');
  const [saving, setSaving] = useState(false);
  const [confirmandoAnular, setConfirmandoAnular] = useState(false);

  const nuevaTotalVenta = useMemo(() =>
    productos.reduce((sum, p) => {
      const qty = cantidades[p.id] ?? 0;
      const precio = p.precios?.[cliente?.lista] ?? 0;
      return sum + qty * precio;
    }, 0)
  , [cantidades, productos, cliente]);

  async function handleAnular() {
    setSaving(true);
    try {
      const deudaAnteriorVisita = (parada.totalVenta ?? 0) - (parada.totalCobrado ?? 0);
      const nuevaDeuda = Math.max(0, (cliente?.deuda ?? 0) - deudaAnteriorVisita);

      const paradasActualizadas = ruta.paradas.map(p =>
        p.id === parada.id
          ? { ...p, cantidades: {}, totalVenta: 0, totalCobrado: 0, anulada: true }
          : p
      );
      await updateDoc(doc(db, 'rutas', ruta.id), { paradas: paradasActualizadas });

      await addDoc(collection(db, 'transacciones'), {
        tipo: 'anulacion',
        empresaId,
        rutaId: ruta.id,
        clienteId: cliente?.id,
        fecha: ruta.fecha,
        cantidadesAnuladas: parada.cantidades,
        totalVentaAnulada: parada.totalVenta ?? 0,
        totalCobradoAnulado: parada.totalCobrado ?? 0,
        deudaResultante: nuevaDeuda,
        anuladoEn: serverTimestamp(),
      });

      if (cliente?.id) {
        await updateDoc(doc(db, 'clientes', cliente.id), { deuda: nuevaDeuda });
      }

      onClose();
    } catch (e) {
      alert('Error al anular: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGuardar() {
    const cobrado = parseInt(totalCobrado, 10) || 0;
    setSaving(true);
    try {
      const deltaVenta = nuevaTotalVenta - (parada.totalVenta ?? 0);
      const deltaCobrado = cobrado - (parada.totalCobrado ?? 0);
      const nuevaDeuda = Math.max(0, (cliente?.deuda ?? 0) + deltaVenta - deltaCobrado);

      const paradasActualizadas = ruta.paradas.map(p =>
        p.id === parada.id
          ? { ...p, cantidades, totalVenta: nuevaTotalVenta, totalCobrado: cobrado, formaPago }
          : p
      );
      await updateDoc(doc(db, 'rutas', ruta.id), { paradas: paradasActualizadas });

      await addDoc(collection(db, 'transacciones'), {
        tipo: 'ajuste',
        empresaId,
        rutaId: ruta.id,
        clienteId: cliente?.id,
        fecha: ruta.fecha,
        cantidadesAnterior: parada.cantidades,
        cantidadesNuevo: cantidades,
        totalVentaAnterior: parada.totalVenta ?? 0,
        totalVentaNuevo: nuevaTotalVenta,
        totalCobradoAnterior: parada.totalCobrado ?? 0,
        totalCobradoNuevo: cobrado,
        formaPagoAnterior: parada.formaPago,
        formaPagoNuevo: formaPago,
        deltaVenta,
        deltaCobrado,
        deudaResultante: nuevaDeuda,
        editadoEn: serverTimestamp(),
      });

      if (cliente?.id) {
        await updateDoc(doc(db, 'clientes', cliente.id), { deuda: nuevaDeuda });
      }

      onClose();
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={`Corregir visita — ${cliente?.nombre || 'Cliente'}`} onClose={onClose} wide>
      <div className={styles.body}>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Cantidad</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(p => {
              const precio = p.precios?.[cliente?.lista] ?? 0;
              const qty = cantidades[p.id] ?? 0;
              return (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td className={styles.muted}>{money(precio)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className={styles.qtyInput}
                      value={qty}
                      onChange={e => setCantidades(prev => ({ ...prev, [p.id]: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </td>
                  <td className={styles.subtotal}>{money(qty * precio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={styles.totalRow}>
          <span>Total venta</span>
          <span className={styles.totalValue}>{money(nuevaTotalVenta)}</span>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Total cobrado</label>
          <input
            type="number"
            min="0"
            className={styles.input}
            value={totalCobrado}
            onChange={e => setTotalCobrado(e.target.value)}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Forma de pago</label>
          <select
            className={styles.input}
            value={formaPago}
            onChange={e => setFormaPago(e.target.value)}
          >
            {FORMAS_PAGO.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {nuevaTotalVenta !== (parada.totalVenta ?? 0) || parseInt(totalCobrado, 10) !== (parada.totalCobrado ?? 0) ? (
          <div className={styles.deltaBox}>
            <span>Deuda resultante nueva:</span>
            <span className={styles.deltaValue}>
              {money(Math.max(0, (cliente?.deuda ?? 0) + (nuevaTotalVenta - (parada.totalVenta ?? 0)) - ((parseInt(totalCobrado, 10) || 0) - (parada.totalCobrado ?? 0))))}
            </span>
          </div>
        ) : null}

        {confirmandoAnular ? (
          <div className={styles.anularBox}>
            <p className={styles.anularWarning}>
              Esto pondrá la venta en $0 y ajustará la deuda del cliente. No se puede deshacer.
            </p>
            <div className={styles.anularActions}>
              <button className={styles.btnSecondary} onClick={() => setConfirmandoAnular(false)} disabled={saving}>
                Cancelar
              </button>
              <button className={styles.btnAnularConfirm} onClick={handleAnular} disabled={saving}>
                {saving ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.btnAnular} onClick={() => setConfirmandoAnular(true)} disabled={saving}>
              Anular esta venta
            </button>
            <div className={styles.actionsRight}>
              <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar corrección'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
