// Balance — cálculo puro, sin tocar Firestore (recibe datos ya leídos).
// Reutilizado igual por la pantalla "Balance" (useBalance) y por el export
// CSV en Gestión, para no duplicar la lógica en dos lugares.

// Mapeo fijo de categorías de gasto de RUTA (gasolina/peaje/mecanica/otro,
// las 4 categorías cerradas de rutas.gastos[]) hacia una categoría de
// EMPRESA por NOMBRE — ya que el catálogo de categorías de empresa es
// configurable por empresa (categoriasGasto), no un enum fijo. Si la
// empresa no tiene una categoría con ese nombre exacto en su catálogo,
// el gasto cae en "Sin clasificar" (nunca se pierde, nunca se inventa
// una categoría que no existe).
const MAPEO_RUTA_A_EMPRESA = {
  gasolina: 'transporte',
  peaje: 'transporte',
  mecanica: 'arreglo vehículos',
};

function mesDeFecha(fechaStr) {
  return (fechaStr || '').slice(0, 7); // 'YYYY-MM'
}

function mesesEnRango(desde, hasta) {
  const meses = [];
  const [ay, am] = desde.split('-').map(Number);
  const [by, bm] = hasta.split('-').map(Number);
  let y = ay, m = am;
  while (y < by || (y === by && m <= bm)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return meses;
}

/**
 * @param {Object[]} transacciones - todas dentro del rango (ya filtradas por empresaId)
 * @param {Object[]} gastosEmpresa - todos dentro del rango
 * @param {Object[]} rutas - rutas con su array .gastos[] embebido (para gasto de ruta)
 * @param {Object[]} categorias - catálogo categoriasGasto de la empresa (activas e inactivas)
 * @param {string} periodoDesde - 'YYYY-MM-DD'
 * @param {string} periodoHasta - 'YYYY-MM-DD'
 */
export function calcularBalance({ transacciones, gastosEmpresa, rutas, categorias, periodoDesde, periodoHasta }) {
  const meses = mesesEnRango(mesDeFecha(periodoDesde), mesDeFecha(periodoHasta));
  const nombresCategoria = categorias.map(c => c.nombre);
  const catPorId = Object.fromEntries(categorias.map(c => [c.id, c]));
  const catPorNombreLower = Object.fromEntries(categorias.map(c => [c.nombre.toLowerCase(), c.nombre]));

  const filas = Object.fromEntries(meses.map(mes => [mes, {
    mes,
    ventas: 0,
    porCategoria: Object.fromEntries(nombresCategoria.map(n => [n, 0])),
    sinClasificar: 0,
    gastosTotal: 0,
    utilidad: 0,
  }]));

  // Ventas = SOLO transacciones. facturasGeneradas es un sello sobre
  // transacciones ya existentes (ver GestionPage.exportFacturacion —
  // facturasGeneradas.total se calcula A PARTIR de transacciones incluidas
  // en transaccionIds), no una segunda fuente de ingreso. Sumarla aparte
  // duplicaría cada entrega facturada a un cliente tipo 'facturacion'.
  for (const tx of transacciones) {
    const mes = mesDeFecha(tx.fecha);
    if (filas[mes]) filas[mes].ventas += tx.totalVenta || 0;
  }

  // Gastos de empresa — por categoriaId directo
  for (const g of gastosEmpresa) {
    const mes = mesDeFecha(g.fecha);
    if (!filas[mes]) continue;
    const cat = catPorId[g.categoriaId];
    if (cat) {
      filas[mes].porCategoria[cat.nombre] = (filas[mes].porCategoria[cat.nombre] || 0) + (g.monto || 0);
    } else {
      // Categoría no encontrada (no debería pasar — nunca se elimina, solo
      // se desactiva) — no se pierde el gasto, cae en Sin clasificar.
      filas[mes].sinClasificar += g.monto || 0;
    }
  }

  // Gastos de ruta — mapeo fijo hacia nombre de categoría de empresa;
  // 'otro' siempre Sin clasificar (nunca se fuerza a una categoría real).
  for (const ruta of rutas) {
    const mes = mesDeFecha(ruta.fecha);
    if (!filas[mes]) continue;
    for (const g of ruta.gastos || []) {
      const monto = g.valor ?? g.monto ?? 0;
      const tipo = g.tipo ?? g.categoria;
      const nombreMapeado = MAPEO_RUTA_A_EMPRESA[tipo];
      const nombreReal = nombreMapeado ? catPorNombreLower[nombreMapeado] : null;
      if (nombreReal) {
        filas[mes].porCategoria[nombreReal] = (filas[mes].porCategoria[nombreReal] || 0) + monto;
      } else {
        // 'otro', o la empresa no tiene una categoría con ese nombre en su
        // catálogo — nunca se inventa ni se fuerza, va a Sin clasificar.
        filas[mes].sinClasificar += monto;
      }
    }
  }

  for (const mes of meses) {
    const fila = filas[mes];
    const gastosCategorias = Object.values(fila.porCategoria).reduce((s, v) => s + v, 0);
    fila.gastosTotal = gastosCategorias + fila.sinClasificar;
    fila.utilidad = fila.ventas - fila.gastosTotal;
  }

  const filasArray = meses.map(m => filas[m]);

  const resumenAnual = filasArray.reduce((acc, f) => {
    acc.ventas += f.ventas;
    acc.sinClasificar += f.sinClasificar;
    acc.gastosTotal += f.gastosTotal;
    acc.utilidad += f.utilidad;
    for (const n of nombresCategoria) {
      acc.porCategoria[n] = (acc.porCategoria[n] || 0) + (f.porCategoria[n] || 0);
    }
    return acc;
  }, { mes: 'TOTAL', ventas: 0, porCategoria: Object.fromEntries(nombresCategoria.map(n => [n, 0])), sinClasificar: 0, gastosTotal: 0, utilidad: 0 });

  return { filas: filasArray, resumenAnual, nombresCategoria };
}
