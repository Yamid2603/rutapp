/**
 * analisisIA-semanal.js
 * Cloud Function: genera resumen semanal de análisis IA y lo guarda en Firestore.
 * Trigger: Pub/Sub cron "0 6 * * 1" (lunes 6:00 AM)
 *
 * Deploy:
 *   firebase deploy --only functions:analisisIASemanal
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

// initializeApp() se llama en index.js
const db = getFirestore();

function crearTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO') + ' COP';
}

async function enviarResumenEmail(empresaId, semana, alertas, conductores, clientes) {
  const transporter = crearTransporter();
  if (!transporter) {
    console.log('[email] EMAIL_USER/EMAIL_PASS no configurados — omitiendo email');
    return;
  }

  // Obtener emails de admins de la empresa
  const adminsSnap = await db.collection('usuarios')
    .where('empresaId', '==', empresaId)
    .where('rol', '==', 'admin')
    .get();

  const emails = adminsSnap.docs.map(d => d.data().email).filter(Boolean);
  if (!emails.length) return;

  const empresa = (await db.collection('empresas').doc(empresaId).get()).data();
  const nombreEmpresa = empresa?.nombre || empresaId;

  const alertasHtml = alertas.length
    ? alertas.map(a => `<li style="color:${a.severidad === 'red' ? '#B84B4B' : '#1693A5'}"><b>${a.titulo}</b> — ${a.descripcion}</li>`).join('')
    : '<li>Sin alertas esta semana.</li>';

  const conductoresHtml = conductores
    .sort((a, b) => b.totalVendido - a.totalVendido)
    .slice(0, 5)
    .map(c => `<tr><td>${c.conductorNombre}</td><td>${money(c.totalVendido)}</td><td>${money(c.totalCobrado)}</td><td>${c.ratioCobranza.toFixed(1)}%</td></tr>`)
    .join('');

  const deudoresHtml = clientes
    .filter(c => c.deudaActual > 0)
    .slice(0, 5)
    .map(c => `<tr><td>${c.clienteNombre}</td><td style="color:#B84B4B">${money(c.deudaActual)}</td></tr>`)
    .join('') || '<tr><td colspan="2">Sin deudas pendientes</td></tr>';

  const totalVendido = conductores.reduce((s, c) => s + c.totalVendido, 0);
  const totalCobrado = conductores.reduce((s, c) => s + c.totalCobrado, 0);

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#0D2433;padding:20px 28px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0;font-size:20px">Resumen semanal — ${nombreEmpresa}</h2>
    <p style="color:#4DD4E4;margin:6px 0 0;font-size:13px">Semana ${semana}</p>
  </div>
  <div style="background:#F8F8F4;padding:24px 28px;border:1px solid #E8E8D0">
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:11px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Total vendido</div>
        <div style="font-size:22px;font-weight:700;color:#2E7D6B;margin-top:4px">${money(totalVendido)}</div>
      </div>
      <div style="flex:1;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:11px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Total cobrado</div>
        <div style="font-size:22px;font-weight:700;color:#1693A5;margin-top:4px">${money(totalCobrado)}</div>
      </div>
    </div>

    <h3 style="font-size:13px;color:#8B949E;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px">Alertas</h3>
    <ul style="margin:0 0 20px;padding-left:18px;font-size:13px;line-height:1.6">${alertasHtml}</ul>

    <h3 style="font-size:13px;color:#8B949E;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px">Conductores</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="border-bottom:1px solid #E8E8D0">
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Conductor</th>
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Vendido</th>
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Cobrado</th>
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Ratio</th>
      </tr></thead>
      <tbody>${conductoresHtml}</tbody>
    </table>

    <h3 style="font-size:13px;color:#8B949E;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px">Deudas pendientes (top 5)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="border-bottom:1px solid #E8E8D0">
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Cliente</th>
        <th style="text-align:left;padding:6px 8px;color:#8B949E;font-weight:600">Deuda</th>
      </tr></thead>
      <tbody>${deudoresHtml}</tbody>
    </table>

    <div style="text-align:center;margin-top:8px">
      <a href="https://rutapp-cfa16.web.app" style="background:#1693A5;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Ver panel completo</a>
    </div>
  </div>
  <div style="background:#E8E8D0;padding:12px 28px;border-radius:0 0 12px 12px;font-size:11px;color:#8B949E;text-align:center">
    RutaApp — Reporte automático semanal
  </div>
</div>`;

  await transporter.sendMail({
    from: `"RutaApp" <${process.env.EMAIL_USER}>`,
    to: emails.join(', '),
    subject: `Resumen semanal ${nombreEmpresa} — ${semana}`,
    html,
  });

  console.log(`[email] Resumen semanal enviado a ${emails.join(', ')}`);
}

// ─── Umbrales por defecto ─────────────────────────────────────────────────────
const UMBRALES_DEFAULT = {
  conductorIneficiente: 70,
  gastosAnormales: 2,
  clienteRiesgoMeses: 3,
  clienteOportunidadPago: 90,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function ratioCobranza(cobrado, vendido) {
  if (!vendido) return 0;
  return (cobrado / vendido) * 100;
}

function semaforoRatio(ratio, umbral) {
  if (ratio >= umbral) return 'green';
  if (ratio >= umbral - 5) return 'yellow';
  return 'red';
}

function semanaISO(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const semana1 = new Date(d.getFullYear(), 0, 4);
  const numSemana = 1 + Math.round(((d - semana1) / 86400000 - 3 + ((semana1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(numSemana).padStart(2, '0')}`;
}

// ─── Función principal ────────────────────────────────────────────────────────

exports.analisisIASemanal = onSchedule({ schedule: '0 6 * * 1', secrets: ['ANTHROPIC_API_KEY', 'EMAIL_USER', 'EMAIL_PASS'] }, async () => {
  console.log('[analisisIASemanal] Iniciando ejecución semanal');

  const ahora = new Date();
  const hace30 = new Date(ahora);
  hace30.setDate(hace30.getDate() - 30);
  const semana = semanaISO(ahora);
  const proxima = new Date(ahora);
  proxima.setDate(proxima.getDate() + 7);

  try {
    // Obtener todas las empresas activas
    const empresasSnap = await db.collection('empresas').get();
    console.log(`[analisisIASemanal] Procesando ${empresasSnap.size} empresas`);

    for (const empresaDoc of empresasSnap.docs) {
      const empresaId = empresaDoc.id;
      const empresaData = empresaDoc.data();
      const umbrales = { ...UMBRALES_DEFAULT, ...(empresaData.umbrales ?? {}) };

      try {
        await procesarEmpresa(empresaId, umbrales, hace30, ahora, semana, proxima);
      } catch (err) {
        console.error(`[analisisIASemanal] Error en empresa ${empresaId}:`, err.message);
        // Continuar con la siguiente empresa
      }
    }

    console.log('[analisisIASemanal] Ejecución completada');
  } catch (err) {
    console.error('[analisisIASemanal] Error fatal:', err);
    throw err;
  }
});

async function procesarEmpresa(empresaId, umbrales, fechaInicio, fechaFin, semana, proxima) {
  console.log(`[analisisIASemanal] Procesando empresa: ${empresaId}`);

  // Verificar si ya existe resumen para esta semana
  const existente = await db
    .collection('analisisSemanal')
    .where('empresaId', '==', empresaId)
    .where('semana', '==', semana)
    .limit(1)
    .get();

  if (!existente.empty) {
    console.log(`[analisisIASemanal] Ya existe resumen para ${empresaId} semana ${semana}`);
    return;
  }

  // Cargar datos
  const [txSnap, rutasSnap, clientesSnap, usuariosSnap] = await Promise.all([
    db.collection('transacciones').where('empresaId', '==', empresaId).get(),
    db.collection('rutas').where('empresaId', '==', empresaId).get(),
    db.collection('clientes').where('empresaId', '==', empresaId).get(),
    db.collection('usuarios').where('empresaId', '==', empresaId).get(),
  ]);

  const transacciones = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const rutas = rutasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtrar por período
  const txPeriodo = transacciones.filter(t => {
    const d = toDate(t.fecha);
    return d && d >= fechaInicio && d <= fechaFin;
  });

  // Resumen conductores
  const conductores = calcularResumenConductores(txPeriodo, rutas, usuarios, umbrales, fechaInicio, fechaFin);

  // Resumen clientes (deuda y pago)
  const clientesResumen = calcularResumenClientes(txPeriodo, clientes, umbrales);

  // Top 10 alertas
  const alertas = generarAlertasResumen(conductores, clientesResumen).slice(0, 10);

  // Guardar en Firestore
  const docRef = db.collection('analisisSemanal').doc(`${empresaId}_${semana}`);
  await docRef.set({
    empresaId,
    semana,
    conductores,
    clientes: clientesResumen,
    alertas,
    generadoEn: Timestamp.fromDate(new Date()),
    proximaEjecucion: Timestamp.fromDate(proxima),
  });

  console.log(`[analisisIASemanal] Resumen guardado: ${empresaId} / ${semana} — ${alertas.length} alertas`);

  // Enviar email resumen al admin
  try {
    await enviarResumenEmail(empresaId, semana, alertas, conductores, clientesResumen);
  } catch (emailErr) {
    console.error(`[analisisIASemanal] Error enviando email para ${empresaId}:`, emailErr.message);
  }
}

function calcularResumenConductores(txPeriodo, rutas, usuarios, umbrales, fechaInicio, fechaFin) {
  const mapaUsuarios = Object.fromEntries(usuarios.map(u => [u.id, u]));
  const porConductor = {};

  for (const tx of txPeriodo) {
    if (!tx.conductorId) continue;
    if (!porConductor[tx.conductorId]) porConductor[tx.conductorId] = { vendido: 0, cobrado: 0 };
    porConductor[tx.conductorId].vendido += tx.totalVenta ?? 0;
    porConductor[tx.conductorId].cobrado += tx.totalCobrado ?? 0;
  }

  return Object.entries(porConductor).map(([cId, data]) => {
    const ratio = ratioCobranza(data.cobrado, data.vendido);
    return {
      conductorId: cId,
      conductorNombre: mapaUsuarios[cId]?.nombre ?? cId,
      totalVendido: data.vendido,
      totalCobrado: data.cobrado,
      ratioCobranza: ratio,
      semaforo: semaforoRatio(ratio, umbrales.conductorIneficiente),
    };
  });
}

function calcularResumenClientes(txPeriodo, clientes, umbrales) {
  const mapaClientes = Object.fromEntries(clientes.map(c => [c.id, c]));
  const porCliente = {};

  for (const tx of txPeriodo) {
    if (!tx.clienteId) continue;
    if (!porCliente[tx.clienteId]) porCliente[tx.clienteId] = { total: 0, cobrado: 0, txCount: 0 };
    porCliente[tx.clienteId].total += tx.totalVenta ?? 0;
    porCliente[tx.clienteId].cobrado += tx.totalCobrado ?? 0;
    porCliente[tx.clienteId].txCount += 1;
  }

  return Object.entries(porCliente).map(([cId, data]) => {
    const cliente = mapaClientes[cId] ?? {};
    const deuda = cliente.deuda ?? 0;
    const pctPago = data.total > 0 ? (data.cobrado / data.total) * 100 : 0;
    const semaforo = pctPago >= umbrales.clienteOportunidadPago ? 'green'
      : pctPago >= umbrales.clienteOportunidadPago - 20 ? 'yellow' : 'red';
    return {
      clienteId: cId,
      clienteNombre: cliente.nombre ?? cId,
      totalCompras: data.total,
      pctPago,
      deudaActual: deuda,
      semaforo,
    };
  }).sort((a, b) => b.deudaActual - a.deudaActual);
}

function generarAlertasResumen(conductores, clientes) {
  const alertas = [];
  const ahora = new Date();

  for (const c of conductores.filter(x => x.semaforo === 'red')) {
    alertas.push({
      tipo: 'EFICIENCIA_BAJA',
      severidad: 'red',
      titulo: `Eficiencia baja: ${c.conductorNombre}`,
      descripcion: `${c.conductorNombre} tiene ${c.ratioCobranza.toFixed(1)}% cobranza`,
      fechaGenerada: Timestamp.fromDate(ahora),
    });
  }

  const clientesRojo = clientes.filter(c => c.semaforo === 'red');
  if (clientesRojo.length > 0) {
    const totalDeuda = clientesRojo.reduce((s, c) => s + c.deudaActual, 0);
    alertas.push({
      tipo: 'DEUDA_CRITICA',
      severidad: 'red',
      titulo: `${clientesRojo.length} clientes con deuda crítica`,
      descripcion: `Deuda total en riesgo: $${totalDeuda.toLocaleString('es-CO')}`,
      fechaGenerada: Timestamp.fromDate(ahora),
    });
  }

  const orden = { red: 0, yellow: 1, green: 2 };
  return alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}
