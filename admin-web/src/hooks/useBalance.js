/**
 * useBalance.js — lee Firestore y llama a calcularBalance (utils/balanceHelpers.js).
 * Mismo patrón que useAnalisisIA.js: fetch + cálculo puro separado.
 */
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calcularBalance } from '../utils/balanceHelpers';

export function useBalance(empresaId, periodoDesde, periodoHasta) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchYCalcular = useCallback(async () => {
    if (!empresaId || !periodoDesde || !periodoHasta) return;
    setLoading(true);
    setError(null);
    try {
      const [txSnap, gastosEmpresaSnap, rutasSnap, categoriasSnap] = await Promise.all([
        getDocs(query(collection(db, 'transacciones'), where('empresaId', '==', empresaId))),
        getDocs(query(collection(db, 'gastosEmpresa'), where('empresaId', '==', empresaId))),
        getDocs(query(collection(db, 'rutas'), where('empresaId', '==', empresaId))),
        getDocs(query(collection(db, 'categoriasGasto'), where('empresaId', '==', empresaId))),
      ]);

      const dentroDelRango = (fecha) => fecha && fecha >= periodoDesde && fecha <= periodoHasta;

      const transacciones = txSnap.docs.map(d => d.data()).filter(t => dentroDelRango(t.fecha));
      const gastosEmpresa = gastosEmpresaSnap.docs.map(d => d.data()).filter(g => dentroDelRango(g.fecha));
      const rutas = rutasSnap.docs.map(d => d.data()).filter(r => dentroDelRango(r.fecha));
      const categorias = categoriasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setBalance(calcularBalance({ transacciones, gastosEmpresa, rutas, categorias, periodoDesde, periodoHasta }));
    } catch (err) {
      console.error('[useBalance]', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [empresaId, periodoDesde, periodoHasta]);

  useEffect(() => { fetchYCalcular(); }, [fetchYCalcular]);

  return { balance, loading, error, refetch: fetchYCalcular };
}
