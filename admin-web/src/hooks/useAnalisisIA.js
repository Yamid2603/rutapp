/**
 * useAnalisisIA.js
 * Hook principal del módulo de Análisis IA.
 * Lee datos de Firestore, calcula todo con useMemo y expone resultados.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  calcularEficienciaConductores,
  calcularRiesgoClientes,
  calcularOportunidades,
  calcularGastos,
  generarAlertas,
  validarPeriodo,
  validarVolumen,
} from '../utils/analisisIAHelpers';

// Umbrales por defecto si el documento de empresa no tiene el campo
const UMBRALES_DEFAULT = {
  conductorIneficiente: 70,   // % mínimo cobranza
  gastosAnormales: 2,          // multiplicador vs promedio
  clienteRiesgoMeses: 3,       // meses bajando consecutivos
  clienteOportunidadPago: 90,  // % pago mínimo histórico
};

/**
 * Hook principal de Análisis IA.
 *
 * @param {string} empresaId
 * @param {Date|null} fechaInicio
 * @param {Date|null} fechaFin
 * @returns {{
 *   eficiencia: Object[],
 *   riesgo: Object[],
 *   oportunidades: Object,
 *   gastos: Object,
 *   alertas: Object[],
 *   umbrales: Object,
 *   loading: boolean,
 *   error: string|null,
 *   lastUpdated: Date|null,
 *   refetch: Function,
 * }}
 */
export function useAnalisisIA(empresaId, fechaInicio, fechaFin) {
  const [rawData, setRawData] = useState({
    transacciones: [],
    rutas: [],
    clientes: [],
    usuarios: [],
    historialCliente: [],
    umbrales: UMBRALES_DEFAULT,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch de datos crudos ─────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!empresaId || !fechaInicio || !fechaFin) return;

    // Validar período mínimo antes de ir a Firestore
    const errPeriodo = validarPeriodo(fechaInicio, fechaFin);
    if (errPeriodo) {
      setError(errPeriodo);
      return;
    }

    setLoading(true);
    setError(null);
    console.log(`[useAnalisisIA] Fetching datos para ${empresaId}`);

    try {
      // Leer colecciones en paralelo
      const [txSnap, rutasSnap, clientesSnap, usuariosSnap, histSnap, empresaDoc] =
        await Promise.all([
          getDocs(query(
            collection(db, 'transacciones'),
            where('empresaId', '==', empresaId),
          )),
          getDocs(query(
            collection(db, 'rutas'),
            where('empresaId', '==', empresaId),
          )),
          getDocs(query(
            collection(db, 'clientes'),
            where('empresaId', '==', empresaId),
          )),
          getDocs(query(
            collection(db, 'usuarios'),
            where('empresaId', '==', empresaId),
          )),
          getDocs(query(
            collection(db, 'historialCliente'),
            where('empresaId', '==', empresaId),
          )),
          getDoc(doc(db, 'empresas', empresaId)),
        ]);

      const transacciones = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Validar volumen
      const errVol = validarVolumen(transacciones);
      if (errVol) {
        setError(errVol);
        setLoading(false);
        return;
      }

      const empresaData = empresaDoc.exists() ? empresaDoc.data() : {};
      const umbrales = { ...UMBRALES_DEFAULT, ...(empresaData.umbrales ?? {}) };

      setRawData({
        transacciones,
        rutas: rutasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        clientes: clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        usuarios: usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        historialCliente: histSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        umbrales,
      });

      setLastUpdated(new Date());
      console.log(`[useAnalisisIA] Datos cargados — ${transacciones.length} transacciones`);
    } catch (err) {
      console.error('[useAnalisisIA] Error cargando datos:', err);
      setError('Error al cargar datos. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, fechaInicio?.getTime(), fechaFin?.getTime()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Cálculos con useMemo ──────────────────────────────────────────────────

  const eficiencia = useMemo(() => {
    if (!fechaInicio || !fechaFin || !rawData.transacciones.length) return [];
    try {
      return calcularEficienciaConductores(
        empresaId, fechaInicio, fechaFin, rawData.umbrales,
        rawData.transacciones, rawData.rutas, rawData.usuarios,
      );
    } catch (err) {
      console.error('[useAnalisisIA] Error en eficiencia:', err);
      return [];
    }
  }, [empresaId, fechaInicio, fechaFin, rawData]);

  const riesgo = useMemo(() => {
    if (!fechaInicio || !fechaFin) return [];
    try {
      return calcularRiesgoClientes(
        empresaId, fechaInicio, fechaFin, rawData.umbrales,
        rawData.transacciones, rawData.clientes, rawData.historialCliente,
      );
    } catch (err) {
      console.error('[useAnalisisIA] Error en riesgo:', err);
      return [];
    }
  }, [empresaId, fechaInicio, fechaFin, rawData]);

  const oportunidades = useMemo(() => {
    if (!fechaInicio || !fechaFin) return { clientesRiesgo: [], clientesOportunidad: [] };
    try {
      return calcularOportunidades(
        empresaId, fechaInicio, fechaFin, rawData.umbrales,
        rawData.transacciones, rawData.clientes,
      );
    } catch (err) {
      console.error('[useAnalisisIA] Error en oportunidades:', err);
      return { clientesRiesgo: [], clientesOportunidad: [] };
    }
  }, [empresaId, fechaInicio, fechaFin, rawData]);

  const gastos = useMemo(() => {
    if (!fechaInicio || !fechaFin || !rawData.rutas.length) {
      return { porConductor: [], porCategoria: { gasolina: 0, peaje: 0, mecanica: 0, otro: 0, total: 0 }, tendencia: { dias: [] } };
    }
    try {
      return calcularGastos(
        empresaId, fechaInicio, fechaFin,
        rawData.rutas, rawData.usuarios,
      );
    } catch (err) {
      console.error('[useAnalisisIA] Error en gastos:', err);
      return { porConductor: [], porCategoria: {}, tendencia: { dias: [] } };
    }
  }, [empresaId, fechaInicio, fechaFin, rawData]);

  const alertas = useMemo(() => {
    if (!eficiencia.length && !riesgo.length) return [];
    try {
      return generarAlertas(eficiencia, riesgo, oportunidades);
    } catch (err) {
      console.error('[useAnalisisIA] Error en alertas:', err);
      return [];
    }
  }, [eficiencia, riesgo, oportunidades]);

  return {
    eficiencia,
    riesgo,
    oportunidades,
    gastos,
    alertas,
    umbrales: rawData.umbrales,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}

// ─── Hook de umbrales (lectura/escritura) ────────────────────────────────────

/**
 * Hook auxiliar para leer y guardar umbrales de la empresa.
 */
export function useUmbrales(empresaId) {
  const [umbrales, setUmbrales] = useState(UMBRALES_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loadingU, setLoadingU] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    getDoc(doc(db, 'empresas', empresaId)).then(snap => {
      if (snap.exists() && snap.data().umbrales) {
        setUmbrales({ ...UMBRALES_DEFAULT, ...snap.data().umbrales });
      }
      setLoadingU(false);
    }).catch(() => setLoadingU(false));
  }, [empresaId]);

  async function guardarUmbrales(nuevosUmbrales) {
    setSaving(true);
    try {
      const { updateDoc, doc: fDoc } = await import('firebase/firestore');
      await updateDoc(fDoc(db, 'empresas', empresaId), { umbrales: nuevosUmbrales });
      setUmbrales(nuevosUmbrales);
      console.log(`[Umbrales] Guardados para empresaId: ${empresaId}`);
      return { success: true };
    } catch (err) {
      console.error('[Umbrales] Error guardando:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return { umbrales, setUmbrales, guardarUmbrales, saving, loading: loadingU };
}
