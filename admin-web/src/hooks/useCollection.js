import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useEmpresaCollection(colName, empresaId, extraConstraints = []) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    const q = query(
      collection(db, colName),
      where('empresaId', '==', empresaId),
      ...extraConstraints,
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [colName, empresaId, JSON.stringify(extraConstraints)]);

  return { docs, loading };
}

export function useRutas(empresaId) {
  return useEmpresaCollection('rutas', empresaId);
}

export function useClientes(empresaId) {
  return useEmpresaCollection('clientes', empresaId);
}

export function useProductos(empresaId) {
  return useEmpresaCollection('productos', empresaId);
}

export function useCamiones(empresaId) {
  return useEmpresaCollection('camiones', empresaId);
}

export function useUsuarios(empresaId) {
  return useEmpresaCollection('usuarios', empresaId);
}

export function useOperacionesFallidas(empresaId) {
  return useEmpresaCollection('operacionesFallidas', empresaId, [orderBy('fallidaEn', 'desc')]);
}

export function useGastosEmpresa(empresaId) {
  return useEmpresaCollection('gastosEmpresa', empresaId, [orderBy('fecha', 'desc')]);
}

export function useTiposActivoComodato(empresaId) {
  return useEmpresaCollection('tiposActivoComodato', empresaId, [orderBy('nombre')]);
}

export function useComodatoMovimientos(empresaId) {
  return useEmpresaCollection('comodatoMovimientos', empresaId, [orderBy('creadoEn', 'desc')]);
}

export function useCategoriasGasto(empresaId) {
  return useEmpresaCollection('categoriasGasto', empresaId, [orderBy('nombre')]);
}

export function useBeneficiariosGasto(empresaId) {
  return useEmpresaCollection('beneficiariosGasto', empresaId, [orderBy('nombre')]);
}
