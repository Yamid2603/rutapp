/**
 * formulasAnalisis.js
 * Fórmulas exactas para el módulo de Análisis IA.
 * Importar donde se necesite referencia o auditoría.
 */

// ── Eficiencia conductores ────────────────────────────────────────────────────

/**
 * Ratio de cobranza: cuánto cobró vs cuánto vendió.
 * @param {number} cobrado
 * @param {number} vendido
 * @returns {number} 0-100
 */
export function ratioCobranza(cobrado, vendido) {
  if (!vendido || vendido === 0) return 0;
  return (cobrado / vendido) * 100;
}

/**
 * Promedio de gastos por parada.
 * @param {number} totalGastos
 * @param {number} totalParadas
 */
export function gastoPorParada(totalGastos, totalParadas) {
  if (!totalParadas) return 0;
  return totalGastos / totalParadas;
}

/**
 * Semáforo de eficiencia de conductor.
 * GREEN  → ratio >= umbral AND gastos <= prom * multGastos
 * YELLOW → ratio >= umbral-5 OR gastos <= prom * (multGastos+1)
 * RED    → ratio < umbral OR gastos > prom * multGastos
 */
export function semaforoConductor(ratio, gastoTotal, gastoPromedio, umbrales) {
  const { conductorIneficiente, gastosAnormales } = umbrales;
  const gastoCritico = gastoPromedio * gastosAnormales;
  const gastoAmarillo = gastoPromedio * (gastosAnormales + 1);

  if (ratio >= conductorIneficiente && gastoTotal <= gastoCritico) return 'green';
  if (ratio >= conductorIneficiente - 5 || gastoTotal <= gastoAmarillo) return 'yellow';
  return 'red';
}

// ── Riesgo crediticio clientes ────────────────────────────────────────────────

/**
 * Porcentaje de pago histórico del cliente.
 * transaccionesPagadas: donde totalCobrado >= 95% totalVenta
 */
export function pctPagoHistorico(pagadas, total) {
  if (!total) return 0;
  return (pagadas / total) * 100;
}

/**
 * Factor de antigüedad para límite de crédito.
 * < 3 meses → 0.5
 * 3-6 meses → 0.75
 * 6-12 meses → 1.0
 * > 12 meses → 1.25
 */
export function factorAntiguedad(meses) {
  if (meses < 3) return 0.5;
  if (meses < 6) return 0.75;
  if (meses < 12) return 1.0;
  return 1.25;
}

/**
 * Límite de crédito recomendado.
 * base = compraPromedioMensual * (pctPago/100) * 2
 * final = base * factorAntiguedad
 */
export function limiteCredito(compraPromMensual, pctPago, meses) {
  const base = compraPromMensual * (pctPago / 100) * 2;
  const factor = factorAntiguedad(meses);
  return { base, factor, final: base * factor, formula: 'base × factorAntiguedad' };
}

/**
 * Semáforo de deuda vs límite.
 * green ≤ 60%, yellow 60-90%, red > 90%
 */
export function semaforoDeuda(deudaActual, limiteRecomendado) {
  if (!limiteRecomendado) return 'red';
  const pct = (deudaActual / limiteRecomendado) * 100;
  if (pct <= 60) return 'green';
  if (pct <= 90) return 'yellow';
  return 'red';
}

// ── Oportunidades ─────────────────────────────────────────────────────────────

/**
 * Potencial de venta estimado: 1.5× compra promedio.
 */
export function potencialVenta(compraPromedio) {
  return compraPromedio * 1.5;
}

// ── Cambio porcentual entre períodos ─────────────────────────────────────────

/**
 * Retorna cambio % entre valor actual y anterior.
 * Positivo = subió, negativo = bajó.
 */
export function cambioPct(actual, anterior) {
  if (!anterior) return 0;
  return ((actual - anterior) / anterior) * 100;
}

/**
 * Dirección de tendencia según delta.
 */
export function direccionTendencia(delta) {
  if (delta > 1) return '↑';
  if (delta < -1) return '↓';
  return '→';
}

// ── Utilidades fecha ─────────────────────────────────────────────────────────

/** Diferencia en meses entre dos fechas. */
export function mesesEntre(fechaA, fechaB) {
  const a = fechaA instanceof Date ? fechaA : new Date(fechaA);
  const b = fechaB instanceof Date ? fechaB : new Date(fechaB);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Diferencia en días entre dos fechas. */
export function diasEntre(fechaA, fechaB) {
  const a = fechaA instanceof Date ? fechaA : new Date(fechaA);
  const b = fechaB instanceof Date ? fechaB : new Date(fechaB);
  return Math.max(1, Math.ceil(Math.abs(b - a) / 86_400_000));
}

/** Fecha de hace N meses desde una fecha base. */
export function haceMeses(n, desde = new Date()) {
  const d = new Date(desde);
  d.setMonth(d.getMonth() - n);
  return d;
}

/** Convierte un Timestamp de Firestore (o Date/número) a Date. */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
  return new Date(v);
}
