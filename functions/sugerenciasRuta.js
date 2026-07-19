/**
 * sugerenciasRuta.js
 * Cloud Function: genera sugerencias de prioridad de visita con IA
 * Trigger: HTTPS callable desde conductor-app
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { default: Anthropic } = require('@anthropic-ai/sdk');

const db = getFirestore();

exports.sugerenciasRuta = onCall({ secrets: ['ANTHROPIC_API_KEY'] }, async (request) => {
  const { auth, data } = request;

  if (!auth) throw new HttpsError('unauthenticated', 'Debe estar autenticado');
  if (!data.rutaId || !data.empresaId) throw new HttpsError('invalid-argument', 'rutaId y empresaId requeridos');

  const { rutaId, empresaId } = data;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HttpsError('internal', 'API key no configurada');

  try {
    // Leer la ruta del día
    const rutaDoc = await db.collection('rutas').doc(rutaId).get();
    if (!rutaDoc.exists) throw new HttpsError('not-found', 'Ruta no encontrada');
    const ruta = rutaDoc.data();

    if (ruta.empresaId !== empresaId) throw new HttpsError('permission-denied', 'Sin acceso a esta ruta');

    const paradasPendientes = (ruta.paradas || []).filter(p => p.estado === 'pendiente');
    if (paradasPendientes.length === 0) {
      return { sugerencias: [] };
    }

    const clienteIds = [...new Set(paradasPendientes.map(p => p.clienteId).filter(Boolean))];

    // Leer clientes y transacciones en paralelo
    const hace30Str = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [clientesSnaps, txSnap] = await Promise.all([
      Promise.all(clienteIds.map(id => db.collection('clientes').doc(id).get())),
      db.collection('transacciones')
        .where('empresaId', '==', empresaId)
        .where('fecha', '>=', hace30Str)
        .get(),
    ]);

    const mapaClientes = {};
    clientesSnaps.forEach(snap => {
      if (snap.exists) mapaClientes[snap.id] = snap.data();
    });

    // Calcular historial por cliente
    const historialCliente = {};
    txSnap.docs.forEach(d => {
      const tx = d.data();
      if (!clienteIds.includes(tx.clienteId)) return;
      if (!historialCliente[tx.clienteId]) {
        historialCliente[tx.clienteId] = { totalVentas: 0, totalCobrado: 0, visitas: 0, ultimaVisita: null };
      }
      const h = historialCliente[tx.clienteId];
      h.totalVentas += tx.totalVenta || 0;
      h.totalCobrado += tx.totalCobrado || 0;
      h.visitas += 1;
      if (!h.ultimaVisita || tx.fecha > h.ultimaVisita) h.ultimaVisita = tx.fecha;
    });

    // Construir contexto para Claude
    const hoy = new Date().toISOString().split('T')[0];
    const clientesContexto = clienteIds.map(id => {
      const c = mapaClientes[id] || {};
      const h = historialCliente[id] || {};
      const diasSinVisita = h.ultimaVisita
        ? Math.floor((new Date(hoy) - new Date(h.ultimaVisita)) / 86400000)
        : null;
      const ratio = h.totalVentas > 0 ? Math.round((h.totalCobrado / h.totalVentas) * 100) : null;
      return [
        `Cliente: ${c.nombre || id}`,
        `  Deuda actual: $${(c.deuda || 0).toLocaleString('es-CO')} COP`,
        diasSinVisita !== null ? `  Última visita: hace ${diasSinVisita} días` : `  Sin visitas registradas`,
        ratio !== null ? `  Ratio de pago histórico: ${ratio}%` : '',
        c.notas ? `  Notas: ${c.notas}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const prompt = `Eres un asistente de rutas de distribución. Analiza estos clientes pendientes de visita hoy y genera sugerencias de prioridad.

CLIENTES PENDIENTES:
${clientesContexto}

Genera un JSON con este formato exacto, sin texto extra:
[
  {"clienteId": "id", "clienteNombre": "nombre", "prioridad": "alta|media|baja", "razon": "razón breve en máx 12 palabras"},
  ...
]

Criterios de prioridad:
- ALTA: deuda grande + días sin visitar + historial de pago bajo
- MEDIA: deuda moderada o algunos días sin visitar
- BAJA: al día, paga bien, puede esperar

Ordena de mayor a menor prioridad.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const texto = response.content?.[0]?.text || '[]';
    let sugerencias = [];
    try {
      // Extraer JSON si viene envuelto en texto
      const match = texto.match(/\[[\s\S]*\]/);
      sugerencias = match ? JSON.parse(match[0]) : [];
    } catch {
      sugerencias = [];
    }

    // Guardar en Firestore para análisis (no bloquea la respuesta)
    db.collection('sugerenciasRuta').add({
      rutaId, empresaId,
      fecha: hoy,
      totalClientes: clienteIds.length,
      generadoEn: Timestamp.now(),
    }).catch(() => {});

    return { sugerencias };

  } catch (error) {
    console.error('[sugerenciasRuta]', error.message);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});
