/**
 * resumenMensual.js
 * Cloud Function: resumen mensual detallado con análisis IA + email al admin.
 * Trigger: día 1 de cada mes a las 7:00 AM
 *
 * Deploy:
 *   firebase deploy --only functions:resumenMensual
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { default: Anthropic } = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const db = getFirestore();

function money(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO') + ' COP';
}

function crearTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

exports.resumenMensual = onSchedule(
  { schedule: '0 7 1 * *', secrets: ['ANTHROPIC_API_KEY', 'EMAIL_USER', 'EMAIL_PASS'] },
  async () => {
    console.log('[resumenMensual] Iniciando ejecución mensual');

    const ahora = new Date();
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
    const mesLabel = mesAnterior.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const mesKey = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;

    const mesInicioStr = mesAnterior.toISOString().split('T')[0];
    const mesFinStr = finMes.toISOString().split('T')[0];

    try {
      const empresasSnap = await db.collection('empresas').get();
      for (const empresaDoc of empresasSnap.docs) {
        try {
          await procesarEmpresaMensual(empresaDoc.id, empresaDoc.data(), mesInicioStr, mesFinStr, mesLabel, mesKey);
        } catch (err) {
          console.error(`[resumenMensual] Error empresa ${empresaDoc.id}:`, err.message);
        }
      }
      console.log('[resumenMensual] Completado');
    } catch (err) {
      console.error('[resumenMensual] Error fatal:', err);
      throw err;
    }
  }
);

async function procesarEmpresaMensual(empresaId, empresaData, mesInicio, mesFin, mesLabel, mesKey) {
  // Evitar duplicados
  const existe = await db.collection('resumenMensual')
    .where('empresaId', '==', empresaId)
    .where('mesKey', '==', mesKey)
    .limit(1).get();
  if (!existe.empty) return;

  const [txSnap, clientesSnap, usuariosSnap] = await Promise.all([
    db.collection('transacciones').where('empresaId', '==', empresaId)
      .where('fecha', '>=', mesInicio).where('fecha', '<=', mesFin).get(),
    db.collection('clientes').where('empresaId', '==', empresaId).get(),
    db.collection('usuarios').where('empresaId', '==', empresaId).get(),
  ]);

  const transacciones = txSnap.docs.map(d => d.data());
  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const admins = usuarios.filter(u => u.rol === 'admin');

  const totalVentas = transacciones.reduce((s, t) => s + (t.totalVenta || 0), 0);
  const totalCobrado = transacciones.reduce((s, t) => s + (t.totalCobrado || 0), 0);
  const totalDeuda = clientes.reduce((s, c) => s + (c.deuda || 0), 0);
  const clientesConDeuda = clientes.filter(c => c.deuda > 0).length;
  const ratioCobranza = totalVentas > 0 ? ((totalCobrado / totalVentas) * 100).toFixed(1) : '0';

  // Top clientes por compra
  const porCliente = {};
  for (const tx of transacciones) {
    if (!tx.clienteId) continue;
    porCliente[tx.clienteId] = (porCliente[tx.clienteId] || 0) + (tx.totalVenta || 0);
  }
  const topClientes = Object.entries(porCliente)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => ({ nombre: clientes.find(c => c.id === id)?.nombre || id, total }));

  // Análisis IA con Claude
  let analisisIA = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const prompt = `Eres un consultor de negocios para distribuidoras. Analiza estos datos del mes de ${mesLabel} para la empresa "${empresaData?.nombre || empresaId}" y da recomendaciones concretas (máx 200 palabras):

- Ventas totales: ${money(totalVentas)}
- Cobrado: ${money(totalCobrado)} (${ratioCobranza}% cobranza)
- Deuda acumulada: ${money(totalDeuda)} en ${clientesConDeuda} clientes
- Transacciones: ${transacciones.length}
- Top clientes: ${topClientes.map(c => `${c.nombre} (${money(c.total)})`).join(', ')}

Identifica: 1) El mayor riesgo del mes, 2) La mayor oportunidad, 3) Una acción concreta para el próximo mes.`;

      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      analisisIA = resp.content?.[0]?.text || null;
    } catch (err) {
      console.error('[resumenMensual] Error IA:', err.message);
    }
  }

  // Guardar en Firestore
  await db.collection('resumenMensual').doc(`${empresaId}_${mesKey}`).set({
    empresaId, mesKey, mesLabel,
    totalVentas, totalCobrado, totalDeuda,
    clientesConDeuda, ratioCobranza: parseFloat(ratioCobranza),
    totalTransacciones: transacciones.length,
    topClientes,
    analisisIA,
    generadoEn: Timestamp.now(),
  });

  // Enviar email
  await enviarEmailMensual(empresaId, empresaData, admins, mesLabel, {
    totalVentas, totalCobrado, totalDeuda, clientesConDeuda,
    ratioCobranza, totalTransacciones: transacciones.length,
    topClientes, analisisIA,
  });
}

async function enviarEmailMensual(empresaId, empresaData, admins, mesLabel, datos) {
  const transporter = crearTransporter();
  if (!transporter) return;

  const emails = admins.map(a => a.email).filter(Boolean);
  if (!emails.length) return;

  const nombreEmpresa = empresaData?.nombre || empresaId;

  const topClientesHtml = datos.topClientes
    .map(c => `<tr><td style="padding:6px 8px">${c.nombre}</td><td style="padding:6px 8px;font-weight:600;color:#2E7D6B">${money(c.total)}</td></tr>`)
    .join('');

  const iaHtml = datos.analisisIA
    ? `<div style="background:#F0F8FF;border-left:4px solid #1693A5;padding:14px 18px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap">${datos.analisisIA}</div>`
    : '<p style="color:#8B949E;font-size:13px">Análisis IA no disponible este mes.</p>';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a">
  <div style="background:#0D2433;padding:22px 28px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0;font-size:22px">Informe mensual — ${nombreEmpresa}</h2>
    <p style="color:#4DD4E4;margin:6px 0 0;font-size:13px">${mesLabel}</p>
  </div>
  <div style="background:#F8F8F4;padding:24px 28px;border:1px solid #E8E8D0;border-top:none">

    <div style="display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap">
      <div style="flex:1;min-width:130px;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:10px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Ventas</div>
        <div style="font-size:19px;font-weight:700;color:#2E7D6B;margin-top:4px">${money(datos.totalVentas)}</div>
      </div>
      <div style="flex:1;min-width:130px;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:10px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Cobrado</div>
        <div style="font-size:19px;font-weight:700;color:#1693A5;margin-top:4px">${money(datos.totalCobrado)}</div>
      </div>
      <div style="flex:1;min-width:130px;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:10px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Deuda total</div>
        <div style="font-size:19px;font-weight:700;color:#B84B4B;margin-top:4px">${money(datos.totalDeuda)}</div>
      </div>
      <div style="flex:1;min-width:130px;background:#fff;border-radius:8px;padding:14px;border:1px solid #E8E8D0;text-align:center">
        <div style="font-size:10px;color:#8B949E;text-transform:uppercase;letter-spacing:0.6px">Cobranza</div>
        <div style="font-size:19px;font-weight:700;color:#1a1a1a;margin-top:4px">${datos.ratioCobranza}%</div>
      </div>
    </div>

    <h3 style="font-size:12px;color:#8B949E;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px">Top clientes del mes</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #E8E8D0">
      <thead><tr style="border-bottom:1px solid #E8E8D0;background:#F0F0D8">
        <th style="text-align:left;padding:8px;color:#8B949E;font-weight:600;font-size:11px">Cliente</th>
        <th style="text-align:left;padding:8px;color:#8B949E;font-weight:600;font-size:11px">Total compras</th>
      </tr></thead>
      <tbody>${topClientesHtml}</tbody>
    </table>

    <h3 style="font-size:12px;color:#8B949E;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px">Analisis IA — Recomendaciones</h3>
    ${iaHtml}

    <div style="text-align:center;margin-top:22px">
      <a href="https://rutapp-cfa16.web.app" style="background:#1693A5;color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Ver panel completo</a>
    </div>
  </div>
  <div style="background:#E8E8D0;padding:12px 28px;border-radius:0 0 12px 12px;font-size:11px;color:#8B949E;text-align:center">
    RutaApp — Informe automático mensual · ${datos.totalTransacciones} transacciones registradas
  </div>
</div>`;

  await transporter.sendMail({
    from: `"RutaApp" <${process.env.EMAIL_USER}>`,
    to: emails.join(', '),
    subject: `Informe mensual ${nombreEmpresa} — ${mesLabel}`,
    html,
  });

  console.log(`[resumenMensual] Email enviado a ${emails.join(', ')}`);
}
