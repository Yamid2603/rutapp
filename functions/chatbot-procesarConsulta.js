/**
 * chatbot-procesarConsulta.js
 * Cloud Function: procesa consulta con Claude + contexto de datos
 * Trigger: HTTPS callable desde frontend
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { default: Anthropic } = require('@anthropic-ai/sdk');

const db = getFirestore();

const MAX_REQUESTS_PER_HOUR = 20;

exports.chatbotProcesarConsulta = onCall({ secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  const { auth, data } = request;

  // Autenticación
  if (!auth) throw new HttpsError('unauthenticated', 'Debe estar autenticado');
  if (!data.empresaId || !data.pregunta) throw new HttpsError('invalid-argument', 'Faltan parámetros');

  const { empresaId, pregunta, historialMensajes = [] } = data;
  const userId = auth.uid;

  try {
    // Rate limiting atómico en Firestore (funciona con múltiples instancias)
    const hourKey = Math.floor(Date.now() / 3600000);
    const limitRef = db.collection('chatbotRateLimit').doc(`${userId}_${hourKey}`);
    await db.runTransaction(async tx => {
      const snap = await tx.get(limitRef);
      const count = snap.exists ? (snap.data().count || 0) + 1 : 1;
      if (count > MAX_REQUESTS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', `Límite de ${MAX_REQUESTS_PER_HOUR} preguntas/hora excedido`);
      }
      tx.set(limitRef, { count, hourKey, userId, updatedAt: Timestamp.now() });
    });

    // Verificar permisos
    const usuarioDoc = await db.collection('usuarios').doc(userId).get();
    if (!usuarioDoc.exists || usuarioDoc.data().empresaId !== empresaId) {
      throw new HttpsError('permission-denied', 'No tiene acceso a esta empresa');
    }

    // Obtener API key desde variable de entorno (más seguro que Firestore)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'API key de Claude no configurada en Cloud Functions. Contacte al administrador.');
    }

    // Recopilar contexto: últimos 30 días
    // fecha se guarda como string "YYYY-MM-DD" en rutas/transacciones
    const hace30Str = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [txSnap, rutasSnap, clientesSnap, conductoresSnap] = await Promise.all([
      db.collection('transacciones').where('empresaId', '==', empresaId).where('fecha', '>=', hace30Str).get(),
      db.collection('rutas').where('empresaId', '==', empresaId).where('fecha', '>=', hace30Str).get(),
      db.collection('clientes').where('empresaId', '==', empresaId).get(),
      db.collection('usuarios').where('empresaId', '==', empresaId).where('rol', '==', 'conductor').get(),
    ]);

    // Compilar métricas
    const totalVentas = txSnap.docs.reduce((s, d) => s + (d.data().totalVenta || 0), 0);
    const totalCobrado = txSnap.docs.reduce((s, d) => s + (d.data().totalCobrado || 0), 0);
    const ratioCobranza = totalVentas > 0 ? (totalCobrado / totalVentas) * 100 : 0;

    // Gastos: acumular total y detalle por descripción
    const gastosPorCategoria = {};
    let totalGastos = 0;
    rutasSnap.docs.forEach(d => {
      (d.data().gastos || []).forEach(g => {
        const monto = g.monto || 0;
        totalGastos += monto;
        const cat = (g.descripcion || 'Sin descripción').trim();
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + monto;
      });
    });
    const gastosDetalle = Object.entries(gastosPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([desc, monto]) => `  • ${desc}: $${monto.toLocaleString('es-CO')} COP`)
      .join('\n');

    const clientesEnRiesgo = clientesSnap.docs.filter(c => (c.data().deuda || 0) > 0).length;
    const deudaTotal = clientesSnap.docs.reduce((s, c) => s + (c.data().deuda || 0), 0);

    const resumenDatos = {
      periodo: `últimos 30 días`,
      totalTransacciones: txSnap.size,
      totalVentas,
      totalCobrado,
      ratioCobranza: ratioCobranza.toFixed(1),
      totalGastos,
      totalRutas: rutasSnap.size,
      totalClientes: clientesSnap.size,
      clientesEnRiesgo,
      deudaTotal,
      totalConductores: conductoresSnap.size,
    };

    // Prompt de sistema
    const promptSistema = `Eres un asistente de análisis empresarial para RutaApp, plataforma de distribución de rutas.

CONTEXTO EMPRESA (${resumenDatos.periodo}):
- Ventas totales: $${resumenDatos.totalVentas.toLocaleString('es-CO')} COP
- Cobrado: $${resumenDatos.totalCobrado.toLocaleString('es-CO')} COP (${resumenDatos.ratioCobranza}% de cobranza)
- Gastos totales: $${resumenDatos.totalGastos.toLocaleString('es-CO')} COP
${gastosDetalle ? 'Desglose de gastos:\n' + gastosDetalle : '  (sin gastos registrados)'}
- Neto: $${(resumenDatos.totalCobrado - resumenDatos.totalGastos).toLocaleString('es-CO')} COP
- Transacciones: ${resumenDatos.totalTransacciones} en ${resumenDatos.totalRutas} rutas
- Clientes con deuda: ${resumenDatos.clientesEnRiesgo} de ${resumenDatos.totalClientes} (deuda acumulada: $${resumenDatos.deudaTotal.toLocaleString('es-CO')} COP)
- Conductores activos: ${resumenDatos.totalConductores}

Tu objetivo: responder preguntas sobre los datos, identificar tendencias, sugerir mejoras.
Sé conciso (máx 150 palabras). Si hay ambigüedad, pide aclaración.
Usa formato: análisis corto + recomendación accionable.`;

    // Llamar a Claude
    const client = new Anthropic({ apiKey });

    const mensajesClaude = [
      ...historialMensajes.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: pregunta }
    ];

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: promptSistema,
      messages: mensajesClaude,
    });

    const block = response.content?.[0];
    if (!block || block.type !== 'text') {
      throw new HttpsError('internal', 'Respuesta vacía del modelo');
    }
    const respuesta = block.text;

    // Audit log
    await db.collection('auditLogs').add({
      empresaId,
      userId,
      timestamp: Timestamp.now(),
      tipo: 'chatbot_consulta',
      pregunta: pregunta.substring(0, 100),
      modelo: 'claude-3-5-sonnet',
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    return {
      respuesta,
      datosContextuales: resumenDatos,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    };

  } catch (error) {
    console.error('[chatbot]', error.message);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});
