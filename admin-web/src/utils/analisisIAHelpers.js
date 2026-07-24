/**
 * analisisIAHelpers.js
 * Funciones puras de cálculo para el módulo de Análisis IA.
 * Sin dependencias de React ni Firebase — testeable en aislamiento.
 */

import { downloadCSV } from './csv';
import {
  ratioCobranza, gastoPorParada, semaforoConductor,
  pctPagoHistorico, factorAntiguedad, limiteCredito, semaforoDeuda,
  potencialVenta, cambioPct, direccionTendencia,
  mesesEntre, diasEntre, toDate,
} from './formulasAnalisis';

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATS = ['gasolina', 'peaje', 'mecanica', 'otro'];
const LIMITE_TRANSACCIONES = 100_000;

// ─── Helpers internos ────────────────────────────────────────────────────────

function esEnPeriodo(fecha, inicio, fin) {
  const d = toDate(fecha);
  if (!d) return false;
  return d >= inicio && d <= fin;
}

// El conductor guarda gastos como { tipo, valor }; se aceptan también { categoria, monto }
function gastoCategoria(g) {
  const c = g.categoria ?? g.tipo;
  return CATS.includes(c) ? c : 'otro';
}
function gastoMonto(g) {
  return g.monto ?? g.valor ?? 0;
}

function sumarCategorias(gastos = []) {
  const r = { gasolina: 0, peaje: 0, mecanica: 0, otro: 0, total: 0 };
  for (const g of gastos) {
    r[gastoCategoria(g)] += gastoMonto(g);
    r.total += gastoMonto(g);
  }
  return r;
}

// ─── VALIDACIONES ────────────────────────────────────────────────────────────

/**
 * Valida que el rango de fechas tenga al menos 1 semana.
 * @returns {string|null} mensaje de error o null si OK
 */
export function validarPeriodo(inicio, fin) {
  const dias = diasEntre(inicio, fin);
  if (dias < 7) return 'Necesitas al menos 1 semana de datos';
  return null;
}

/**
 * Valida que no haya demasiadas transacciones para procesar en frontend.
 */
export function validarVolumen(transacciones) {
  if (transacciones.length > LIMITE_TRANSACCIONES) {
    return `Demasiadas transacciones (${transacciones.length.toLocaleString()}). Filtra un rango menor.`;
  }
  return null;
}

// ─── PARTE 2: EFICIENCIA CONDUCTORES ─────────────────────────────────────────

/**
 * Calcula eficiencia por conductor en el período dado.
 *
 * @param {string} empresaId
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @param {Object} umbrales
 * @param {Object[]} transacciones - colección filtrada por empresaId
 * @param {Object[]} rutas         - colección filtrada por empresaId
 * @param {Object[]} usuarios      - colección filtrada por empresaId
 * @returns {Object[]}
 */
export function calcularEficienciaConductores(
  empresaId, fechaInicio, fechaFin, umbrales,
  transacciones, rutas, usuarios,
) {
  console.log(`[Eficiencia] Calculando para ${empresaId} del ${fechaInicio.toISOString()} al ${fechaFin.toISOString()}`);

  // Filtrar por período
  const txPeriodo = transacciones.filter(t => esEnPeriodo(t.fecha, fechaInicio, fechaFin));
  const rutasPeriodo = rutas.filter(r => esEnPeriodo(r.fecha, fechaInicio, fechaFin));

  // Mapa de usuarios para nombres — indexado por id del doc Y por uid (Firebase Auth)
  const mapaUsuarios = {};
  for (const u of usuarios) {
    mapaUsuarios[u.id] = u;
    if (u.uid) mapaUsuarios[u.uid] = u;
  }

  // Agrupar transacciones por conductor
  const porConductor = {};
  for (const tx of txPeriodo) {
    if (!tx.conductorId) continue;
    if (!porConductor[tx.conductorId]) {
      porConductor[tx.conductorId] = { vendido: 0, cobrado: 0, dias: new Set() };
    }
    porConductor[tx.conductorId].vendido += tx.totalVenta ?? 0;
    porConductor[tx.conductorId].cobrado += tx.totalCobrado ?? 0;
    const d = toDate(tx.fecha);
    if (d) porConductor[tx.conductorId].dias.add(d.toDateString());
  }

  // Agrupar rutas/gastos/paradas por conductor
  const gastosPorConductor = {};
  for (const ruta of rutasPeriodo) {
    const cId = ruta.conductorId;
    if (!cId) continue;
    if (!gastosPorConductor[cId]) {
      gastosPorConductor[cId] = { paradas: 0, gastos: [] };
    }
    gastosPorConductor[cId].paradas += (ruta.paradas?.length ?? 0);
    gastosPorConductor[cId].gastos.push(...(ruta.gastos ?? []));
  }

  // Promedio global de gastos (para semáforo)
  const todosGastados = Object.values(gastosPorConductor).map(g => {
    return g.gastos.reduce((s, x) => s + (x.monto ?? 0), 0);
  });
  const promedioGastoGlobal = todosGastados.length
    ? todosGastados.reduce((a, b) => a + b, 0) / todosGastados.length
    : 0;

  // Calcular período anterior (igual duración, mes anterior)
  const duracion = fechaFin - fechaInicio;
  const inicioAnterior = new Date(fechaInicio - duracion);
  const finAnterior = new Date(fechaInicio);
  const txAnterior = transacciones.filter(t => esEnPeriodo(t.fecha, inicioAnterior, finAnterior));

  const anteriorPorConductor = {};
  for (const tx of txAnterior) {
    if (!tx.conductorId) continue;
    if (!anteriorPorConductor[tx.conductorId]) {
      anteriorPorConductor[tx.conductorId] = { vendido: 0, cobrado: 0 };
    }
    anteriorPorConductor[tx.conductorId].vendido += tx.totalVenta ?? 0;
    anteriorPorConductor[tx.conductorId].cobrado += tx.totalCobrado ?? 0;
  }

  const anteriorGastosPorConductor = {};
  const rutasAnt = rutas.filter(r => esEnPeriodo(r.fecha, inicioAnterior, finAnterior));
  for (const ruta of rutasAnt) {
    const cId = ruta.conductorId;
    if (!cId) continue;
    if (!anteriorGastosPorConductor[cId]) anteriorGastosPorConductor[cId] = [];
    anteriorGastosPorConductor[cId].push(...(ruta.gastos ?? []));
  }

  // Construir resultado
  const resultado = [];
  const conductorIds = new Set([
    ...Object.keys(porConductor),
    ...Object.keys(gastosPorConductor),
  ]);

  for (const conductorId of conductorIds) {
    const tx = porConductor[conductorId] ?? { vendido: 0, cobrado: 0, dias: new Set() };
    const g = gastosPorConductor[conductorId] ?? { paradas: 0, gastos: [] };

    const totalVendido = tx.vendido;
    const totalCobrado = tx.cobrado;
    const ratio = ratioCobranza(totalCobrado, totalVendido);

    const cats = sumarCategorias(g.gastos);
    const diasActivo = tx.dias.size || 1;
    const promParadaDia = g.paradas / diasActivo;

    // Tendencia
    const ant = anteriorPorConductor[conductorId];
    const ratioAnt = ant ? ratioCobranza(ant.cobrado, ant.vendido) : 0;
    const gastosAntArr = anteriorGastosPorConductor[conductorId] ?? [];
    const gastosAntTotal = gastosAntArr.reduce((s, x) => s + (x.monto ?? 0), 0);
    const deltaRatio = cambioPct(ratio, ratioAnt);

    // Status
    const semaforo = semaforoConductor(ratio, cats.total, promedioGastoGlobal, umbrales);

    // Recomendación
    let recomendacion = '';
    if (semaforo === 'red') {
      if (ratio < umbrales.conductorIneficiente) recomendacion = `Cobranza baja (${ratio.toFixed(1)}%). Revisar con el conductor.`;
      if (cats.total > promedioGastoGlobal * umbrales.gastosAnormales) recomendacion += ' Gastos anormalmente altos.';
    }

    resultado.push({
      conductorId,
      conductorNombre: mapaUsuarios[conductorId]?.nombre ?? conductorId,
      totalVendido,
      totalCobrado,
      ratioCobranza: ratio,
      gastos: {
        total: cats.total,
        promedioPorParada: gastoPorParada(cats.total, g.paradas),
        categorias: { gasolina: cats.gasolina, peaje: cats.peaje, mecanica: cats.mecanica, otro: cats.otro },
      },
      paradas: {
        total: g.paradas,
        promedioPorDia: promParadaDia,
        duracionPromedio: null, // No disponible sin timestamps por parada
      },
      tendencia: {
        periodoAnterior: { ratioCobranza: ratioAnt, gastos: gastosAntTotal },
        direccion: direccionTendencia(deltaRatio),
        cambioPercent: deltaRatio,
      },
      status: {
        eficiencia: semaforo,
        gastosStatus: cats.total > promedioGastoGlobal * umbrales.gastosAnormales ? 'red'
          : cats.total > promedioGastoGlobal * (umbrales.gastosAnormales - 0.5) ? 'yellow' : 'green',
        semaforo,
      },
      recomendacion: recomendacion.trim(),
    });
  }

  console.log(`[Eficiencia] ${resultado.length} conductores calculados`);
  return resultado;
}

// ─── PARTE 3: RIESGO CREDITICIO ───────────────────────────────────────────────

/**
 * Calcula riesgo crediticio de clientes.
 *
 * @param {string} empresaId
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @param {Object} umbrales
 * @param {Object[]} transacciones
 * @param {Object[]} clientes
 * @param {Object[]} historialCliente - colección historialCliente
 * @returns {Object[]} ordenado por riesgo DESC
 */
export function calcularRiesgoClientes(
  empresaId, fechaInicio, fechaFin, umbrales,
  transacciones, clientes, historialCliente,
) {
  console.log(`[Riesgo] Calculando riesgo para ${empresaId}`);

  const mapaClientes = Object.fromEntries(clientes.map(c => [c.id, c]));
  const txPeriodo = transacciones.filter(t => esEnPeriodo(t.fecha, fechaInicio, fechaFin));

  // Agrupar por cliente
  const porCliente = {};
  for (const tx of txPeriodo) {
    if (!tx.clienteId) continue;
    if (!porCliente[tx.clienteId]) {
      porCliente[tx.clienteId] = { txs: [], fechas: [] };
    }
    porCliente[tx.clienteId].txs.push(tx);
    const d = toDate(tx.fecha);
    if (d) porCliente[tx.clienteId].fechas.push(d);
  }

  const ahora = new Date();
  const hace30 = new Date(ahora); hace30.setDate(hace30.getDate() - 30);

  // Historial de deuda por cliente (último doc y hace 30 días)
  const historialPorCliente = {};
  for (const h of historialCliente) {
    if (!h.clienteId) continue;
    if (!historialPorCliente[h.clienteId]) historialPorCliente[h.clienteId] = [];
    historialPorCliente[h.clienteId].push({ fecha: toDate(h.fecha), deuda: h.deudaResultante ?? 0 });
  }

  const resultado = [];
  const clienteIds = new Set([
    ...Object.keys(porCliente),
    ...clientes.map(c => c.id),
  ]);

  for (const clienteId of clienteIds) {
    const cliente = mapaClientes[clienteId];
    if (!cliente) continue;

    const grupo = porCliente[clienteId] ?? { txs: [], fechas: [] };
    const txs = grupo.txs;

    // Historial pago
    const totalTx = txs.length;
    const pagadas = txs.filter(t => (t.totalCobrado ?? 0) >= (t.totalVenta ?? 0) * 0.95).length;
    const pctPago = pctPagoHistorico(pagadas, totalTx);

    // Deuda actual (desde historialCliente o campo directo)
    const histDocs = (historialPorCliente[clienteId] ?? []).sort((a, b) => b.fecha - a.fecha);
    const deudaActual = histDocs[0]?.deuda ?? cliente.deuda ?? 0;
    const deudaHace30 = histDocs.find(h => h.fecha <= hace30)?.deuda ?? 0;
    const tendenciaDeuda = cambioPct(deudaActual, deudaHace30);

    // Antigüedad
    const fechasPago = grupo.fechas.sort((a, b) => a - b);
    const primerCompra = fechasPago[0] ?? null;
    const antiguedadMeses = primerCompra ? mesesEntre(primerCompra, ahora) : 0;

    // Compra promedio mensual
    const totalCompras = txs.reduce((s, t) => s + (t.totalVenta ?? 0), 0);
    const mesesDatos = Math.max(1, mesesEntre(fechaInicio, fechaFin));
    const compraPromMensual = totalCompras / mesesDatos;

    // Límite recomendado (manual override por cliente si está configurado)
    const limiteCalculado = limiteCredito(compraPromMensual, pctPago, antiguedadMeses);
    const limiteManual = cliente.limiteDeuda && cliente.limiteDeuda > 0 ? cliente.limiteDeuda : null;
    const limite = limiteManual
      ? { ...limiteCalculado, final: limiteManual, formula: 'manual' }
      : limiteCalculado;

    // Semáforo
    const pctDelLimite = limite.final > 0 ? (deudaActual / limite.final) * 100 : (deudaActual > 0 ? 100 : 0);
    const semaforo = semaforoDeuda(deudaActual, limite.final);

    // Días en mora (aproximado: si hay deuda > 0, tomar última transacción sin pago)
    const noPagedTxs = txs.filter(t => (t.totalCobrado ?? 0) < (t.totalVenta ?? 0) * 0.95);
    const diasEnMora = noPagedTxs.length > 0
      ? diasEntre(toDate(noPagedTxs[noPagedTxs.length - 1].fecha) ?? ahora, ahora)
      : 0;

    const recomendacion = semaforo === 'red' ? 'Cobrar antes de vender'
      : semaforo === 'yellow' ? 'Monitorear'
      : '';

    resultado.push({
      clienteId,
      clienteNombre: cliente.nombre ?? clienteId,
      deuda: {
        actual: deudaActual,
        anterior: deudaHace30,
        tendencia: tendenciaDeuda,
      },
      historialPago: {
        totalTransacciones: totalTx,
        transaccionesPagadas: pagadas,
        percentajePago: pctPago,
        diasEnMora,
        pagosAtrasados: noPagedTxs.length,
      },
      antiguedad: { meses: antiguedadMeses, primerCompra },
      limiteRecomendado: limite,
      status: { porcentajeDelLimite: pctDelLimite, semaforo },
      recomendacion,
    });
  }

  // Ordenar: red primero, luego yellow, luego green; sin-limite (deuda real
  // sin poder evaluarse) antes que sin-datos (nada que revisar); dentro de
  // cada grupo por deuda DESC
  const orden = { red: 0, yellow: 1, green: 2, 'sin-limite': 3, 'sin-datos': 4 };
  resultado.sort((a, b) => {
    const diff = orden[a.status.semaforo] - orden[b.status.semaforo];
    return diff !== 0 ? diff : b.deuda.actual - a.deuda.actual;
  });

  console.log(`[Riesgo] ${resultado.length} clientes calculados`);
  return resultado;
}

// ─── PARTE 4: OPORTUNIDADES DE VENTA ─────────────────────────────────────────

/**
 * Calcula clientes en riesgo de churn y clientes con oportunidad de crédito.
 *
 * @param {string} empresaId
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @param {Object} umbrales
 * @param {Object[]} transacciones
 * @param {Object[]} clientes
 * @returns {{ clientesRiesgo: Object[], clientesOportunidad: Object[] }}
 */
export function calcularOportunidades(
  empresaId, fechaInicio, fechaFin, umbrales,
  transacciones, clientes,
) {
  console.log(`[Oportunidades] Calculando para ${empresaId}`);

  const mapaClientes = Object.fromEntries(clientes.map(c => [c.id, c]));
  const duracion = fechaFin - fechaInicio;
  const mitad = new Date(fechaInicio.getTime() + duracion / 2);

  // Dividir período en 2 mitades para comparar tendencia
  const txPrimera = transacciones.filter(t => esEnPeriodo(t.fecha, fechaInicio, mitad));
  const txSegunda = transacciones.filter(t => esEnPeriodo(t.fecha, mitad, fechaFin));

  // Totales por cliente en cada mitad
  function agruparPorCliente(txs) {
    const mapa = {};
    for (const t of txs) {
      if (!t.clienteId) continue;
      mapa[t.clienteId] = (mapa[t.clienteId] ?? 0) + (t.totalVenta ?? 0);
    }
    return mapa;
  }

  const totalPrimera = agruparPorCliente(txPrimera);
  const totalSegunda = agruparPorCliente(txSegunda);

  const clienteIds = new Set([...Object.keys(totalPrimera), ...Object.keys(totalSegunda)]);

  // Para oportunidades: calcular pctPago y promedio global
  const txTodo = transacciones.filter(t => esEnPeriodo(t.fecha, fechaInicio, fechaFin));
  const pctPagoPorCliente = {};
  const promPorCliente = {};
  const txPorCliente = {};
  for (const t of txTodo) {
    if (!t.clienteId) continue;
    if (!txPorCliente[t.clienteId]) txPorCliente[t.clienteId] = [];
    txPorCliente[t.clienteId].push(t);
  }
  for (const [cId, txs] of Object.entries(txPorCliente)) {
    const pagadas = txs.filter(t => (t.totalCobrado ?? 0) >= (t.totalVenta ?? 0) * 0.95).length;
    pctPagoPorCliente[cId] = pctPagoHistorico(pagadas, txs.length);
    promPorCliente[cId] = txs.reduce((s, t) => s + (t.totalVenta ?? 0), 0) / txs.length;
  }

  const clientesRiesgo = [];
  const clientesOportunidad = [];

  for (const cId of clienteIds) {
    const cliente = mapaClientes[cId];
    if (!cliente) continue;

    const compra1 = totalPrimera[cId] ?? 0;
    const compra2 = totalSegunda[cId] ?? 0;
    const pctPago = pctPagoPorCliente[cId] ?? 0;
    const prom = promPorCliente[cId] ?? 0;

    // Riesgo: segunda mitad < primera mitad (bajando compras)
    if (compra2 < compra1 && compra1 > 0) {
      const cambio = cambioPct(compra2, compra1);
      clientesRiesgo.push({
        clienteId: cId,
        clienteNombre: cliente.nombre ?? cId,
        compraHace3Meses: compra1,
        compraAhora: compra2,
        tendencia: '↓',
        cambioPercent: cambio,
        accion: 'Contacta, ofrece descuento',
      });
    }

    // Oportunidad: paga bien y tiene compra activa
    if (pctPago >= umbrales.clienteOportunidadPago && prom > 0) {
      clientesOportunidad.push({
        clienteId: cId,
        clienteNombre: cliente.nombre ?? cId,
        percentajePago: pctPago,
        compraPromedio: prom,
        potencial: potencialVenta(prom),
        accion: 'Ofrece mayor límite de crédito',
      });
    }
  }

  // Ordenar riesgo por mayor caída
  clientesRiesgo.sort((a, b) => a.cambioPercent - b.cambioPercent);
  // Ordenar oportunidad por mayor potencial
  clientesOportunidad.sort((a, b) => b.potencial - a.potencial);

  console.log(`[Oportunidades] Riesgo: ${clientesRiesgo.length}, Oportunidad: ${clientesOportunidad.length}`);
  return { clientesRiesgo, clientesOportunidad };
}

// ─── PARTE 5: DESGLOSE DE GASTOS ─────────────────────────────────────────────

/**
 * Calcula desglose de gastos por conductor y categoría.
 *
 * @param {string} empresaId
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @param {Object[]} rutas
 * @param {Object[]} usuarios
 * @returns {Object}
 */
export function calcularGastos(empresaId, fechaInicio, fechaFin, rutas, usuarios) {
  console.log(`[Gastos] Calculando para ${empresaId}`);

  const rutasPeriodo = rutas.filter(r => esEnPeriodo(r.fecha, fechaInicio, fechaFin));
  const mapaUsuarios = {};
  for (const u of usuarios) {
    mapaUsuarios[u.id] = u;
    if (u.uid) mapaUsuarios[u.uid] = u;
  }

  const porConductorMap = {};
  const globalCats = { gasolina: 0, peaje: 0, mecanica: 0, otro: 0, total: 0 };
  const diasMap = {}; // fecha → { monto, categoria }[]

  for (const ruta of rutasPeriodo) {
    const cId = ruta.conductorId;
    if (!cId) continue;
    if (!porConductorMap[cId]) porConductorMap[cId] = { gastos: [], fechas: new Set() };
    porConductorMap[cId].gastos.push(...(ruta.gastos ?? []));
    const d = toDate(ruta.fecha);
    if (d) {
      porConductorMap[cId].fechas.add(d.toDateString());
      const key = d.toISOString().slice(0, 10);
      if (!diasMap[key]) diasMap[key] = [];
      for (const g of ruta.gastos ?? []) {
        diasMap[key].push({ fecha: key, monto: gastoMonto(g), categoria: gastoCategoria(g) });
        globalCats[gastoCategoria(g)] += gastoMonto(g);
        globalCats.total += gastoMonto(g);
      }
    }
  }

  const porConductor = Object.entries(porConductorMap).map(([cId, data]) => {
    const cats = sumarCategorias(data.gastos);
    const dias = data.fechas.size || 1;
    return {
      conductorId: cId,
      conductorNombre: mapaUsuarios[cId]?.nombre ?? cId,
      total: cats.total,
      categorias: { gasolina: cats.gasolina, peaje: cats.peaje, mecanica: cats.mecanica, otro: cats.otro },
      promedioDiario: cats.total / dias,
    };
  });

  porConductor.sort((a, b) => b.total - a.total);

  const tendenciaDias = Object.entries(diasMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, items]) => items);

  console.log(`[Gastos] ${porConductor.length} conductores, total $${globalCats.total.toLocaleString()}`);
  return {
    porConductor,
    porCategoria: globalCats,
    tendencia: { dias: tendenciaDias },
  };
}

// ─── PARTE 6: ALERTAS INTELIGENTES ───────────────────────────────────────────

let _alertaCounter = 0;
function alertaId() { return `alerta_${Date.now()}_${++_alertaCounter}`; }

/**
 * Genera alertas ordenadas por severidad a partir de los cálculos.
 *
 * @param {Object[]} eficiencia  - resultado de calcularEficienciaConductores
 * @param {Object[]} riesgo      - resultado de calcularRiesgoClientes
 * @param {Object}   oportunidades - resultado de calcularOportunidades
 * @returns {Object[]}
 */
export function generarAlertas(eficiencia, riesgo, oportunidades) {
  console.log('[Alertas] Generando alertas');
  const alertas = [];
  const ahora = new Date();

  // Alertas de conductores
  for (const c of eficiencia) {
    if (c.status.semaforo === 'red') {
      alertas.push({
        id: alertaId(),
        tipo: 'EFICIENCIA_BAJA',
        severidad: 'red',
        titulo: `Eficiencia baja: ${c.conductorNombre}`,
        descripcion: `${c.conductorNombre} tiene ${c.ratioCobranza.toFixed(1)}% cobranza. ${c.recomendacion}`.slice(0, 200),
        accion: 'Revisar ruta y conversar con el conductor',
        conductorId: c.conductorId,
        clienteId: null,
        fechaGenerada: ahora,
      });
    } else if (c.status.semaforo === 'yellow') {
      alertas.push({
        id: alertaId(),
        tipo: 'EFICIENCIA_BAJA',
        severidad: 'yellow',
        titulo: `Monitorear conductor: ${c.conductorNombre}`,
        descripcion: `${c.conductorNombre} tiene ${c.ratioCobranza.toFixed(1)}% cobranza. Tendencia ${c.tendencia.direccion}${c.tendencia.cambioPercent.toFixed(1)}%.`.slice(0, 200),
        accion: 'Hacer seguimiento esta semana',
        conductorId: c.conductorId,
        clienteId: null,
        fechaGenerada: ahora,
      });
    }
  }

  // Alertas de clientes con deuda crítica — semaforo==='red' Y deuda>0
  // explícitamente (no solo semaforo): defensa extra para que un cliente
  // sin datos suficientes nunca aparezca aquí, aunque cambie la lógica de
  // semaforoDeuda() en el futuro.
  const clientesRojo = riesgo.filter(r => r.status.semaforo === 'red' && r.deuda.actual > 0);
  const deudaTotalCritica = clientesRojo.reduce((s, r) => s + r.deuda.actual, 0);
  if (clientesRojo.length > 0) {
    alertas.push({
      id: alertaId(),
      tipo: 'DEUDA_CRITICA',
      severidad: 'red',
      titulo: `${clientesRojo.length} cliente(s) en deuda crítica`,
      descripcion: `Si no cobras esta semana a ${clientesRojo.length} clientes, perderías $${deudaTotalCritica.toLocaleString('es-CO')}.`.slice(0, 200),
      accion: 'Cobrar de inmediato antes de vender más',
      conductorId: null,
      clienteId: null,
      fechaGenerada: ahora,
    });
  }

  // Alertas individuales de riesgo alto — misma defensa: semaforo Y deuda>0
  for (const r of riesgo.filter(x => x.status.semaforo === 'red' && x.deuda.actual > 0).slice(0, 5)) {
    alertas.push({
      id: alertaId(),
      tipo: 'RIESGO_ALTO',
      severidad: 'red',
      titulo: `Deuda alta: ${r.clienteNombre}`,
      descripcion: `${r.clienteNombre} deuda está en ${r.status.porcentajeDelLimite.toFixed(0)}% del límite. ${r.recomendacion}`.slice(0, 200),
      accion: 'Cobrar antes de vender más',
      conductorId: null,
      clienteId: r.clienteId,
      fechaGenerada: ahora,
    });
  }

  // Alertas amarillas de riesgo
  for (const r of riesgo.filter(x => x.status.semaforo === 'yellow').slice(0, 3)) {
    alertas.push({
      id: alertaId(),
      tipo: 'RIESGO_ALTO',
      severidad: 'yellow',
      titulo: `Monitorear: ${r.clienteNombre}`,
      descripcion: `Deuda en ${r.status.porcentajeDelLimite.toFixed(0)}% del límite recomendado.`.slice(0, 200),
      accion: 'Monitorear de cerca esta semana',
      conductorId: null,
      clienteId: r.clienteId,
      fechaGenerada: ahora,
    });
  }

  // Oportunidades
  for (const o of (oportunidades?.clientesOportunidad ?? []).slice(0, 3)) {
    alertas.push({
      id: alertaId(),
      tipo: 'OPORTUNIDAD',
      severidad: 'green',
      titulo: `Oportunidad: ${o.clienteNombre}`,
      descripcion: `${o.clienteNombre} paga ${o.percentajePago.toFixed(0)}%. Potencial estimado $${o.potencial.toLocaleString('es-CO')}.`.slice(0, 200),
      accion: 'Ofrecer mayor límite de crédito',
      conductorId: null,
      clienteId: o.clienteId,
      fechaGenerada: ahora,
    });
  }

  // Ordenar: red → yellow → green
  const orden = { red: 0, yellow: 1, green: 2 };
  alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad]);

  console.log(`[Alertas] ${alertas.length} alertas generadas (${clientesRojo.length} críticas)`);
  return alertas;
}

// ─── PARTE 10: EXPORTAR CSV ───────────────────────────────────────────────────

/**
 * Exporta eficiencia de conductores a CSV.
 */
export function exportarCSVEficiencia(eficiencia) {
  const rows = eficiencia.map(c => ({
    conductor: c.conductorNombre,
    totalVendido: c.totalVendido,
    totalCobrado: c.totalCobrado,
    ratioCobranza_pct: c.ratioCobranza.toFixed(2),
    gastoTotal: c.gastos.total,
    gastoPorParada: c.gastos.promedioPorParada.toFixed(2),
    totalParadas: c.paradas.total,
    semaforo: c.status.semaforo,
    tendencia: c.tendencia.direccion,
    recomendacion: c.recomendacion,
  }));
  downloadCSV(rows, `eficiencia_conductores_${hoyStr()}.csv`);
}

/**
 * Exporta riesgo de clientes a CSV.
 */
export function exportarCSVRiesgo(riesgo) {
  const rows = riesgo.map(r => ({
    cliente: r.clienteNombre,
    deudaActual: r.deuda.actual,
    semaforo: r.status.semaforo,
    pctDelLimite: r.status.porcentajeDelLimite.toFixed(1),
    limiteRecomendado: r.limiteRecomendado.final.toFixed(0),
    pctPago: r.historialPago.percentajePago.toFixed(1),
    diasEnMora: r.historialPago.diasEnMora,
    antiguedadMeses: r.antiguedad.meses,
    recomendacion: r.recomendacion,
  }));
  downloadCSV(rows, `riesgo_clientes_${hoyStr()}.csv`);
}

/**
 * Exporta oportunidades a CSV.
 */
export function exportarCSVOportunidades(oportunidades) {
  const rowsRiesgo = (oportunidades?.clientesRiesgo ?? []).map(o => ({
    tipo: 'riesgo_churn',
    cliente: o.clienteNombre,
    compraAnterior: o.compraHace3Meses,
    compraActual: o.compraAhora,
    caida_pct: o.cambioPercent.toFixed(1),
    accion: o.accion,
  }));
  const rowsOport = (oportunidades?.clientesOportunidad ?? []).map(o => ({
    tipo: 'oportunidad_credito',
    cliente: o.clienteNombre,
    pctPago: o.percentajePago.toFixed(1),
    compraPromedio: o.compraPromedio.toFixed(0),
    potencial: o.potencial.toFixed(0),
    accion: o.accion,
  }));
  downloadCSV([...rowsRiesgo, ...rowsOport], `oportunidades_${hoyStr()}.csv`);
}

/**
 * Exporta gastos a CSV.
 */
export function exportarCSVGastos(gastos) {
  const rows = (gastos?.porConductor ?? []).map(g => ({
    conductor: g.conductorNombre,
    totalGastos: g.total,
    gasolina: g.categorias.gasolina,
    peaje: g.categorias.peaje,
    mecanica: g.categorias.mecanica,
    otro: g.categorias.otro,
    promedioDiario: g.promedioDiario.toFixed(0),
  }));
  downloadCSV(rows, `gastos_${hoyStr()}.csv`);
}

function hoyStr() {
  return new Date().toISOString().slice(0, 10);
}
