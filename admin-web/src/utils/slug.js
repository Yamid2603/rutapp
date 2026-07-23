// Genera el slug determinístico usado como parte del ID de documento en
// categoriasGasto/beneficiariosGasto ({empresaId}_{slug}) — las Firestore
// rules de gastosEmpresa validan con get() sobre esta misma ruta exacta,
// así que el slug debe ser reproducible y estable para el mismo nombre.
export function slugify(nombre) {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function idCatalogo(empresaId, nombre) {
  return `${empresaId}_${slugify(nombre)}`;
}
