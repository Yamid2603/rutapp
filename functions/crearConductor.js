/**
 * crearConductor.js
 * Cloud Function callable: crea cuenta Auth del conductor usando Admin SDK
 * sin cerrar la sesión del admin actual.
 *
 * Deploy:
 *   firebase deploy --only functions:crearConductor
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

exports.crearConductor = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
  }

  const { email, password, nombre, empresaId, camionId, telefono } = request.data;

  if (!email || !password || !nombre || !empresaId) {
    throw new HttpsError('invalid-argument', 'Faltan campos requeridos.');
  }

  if (telefono) {
    const tel = telefono.trim();
    if (!tel.startsWith('+')) {
      throw new HttpsError('invalid-argument', 'El teléfono debe comenzar con + (ej: +573001234567).');
    }
    const digits = tel.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new HttpsError('invalid-argument', 'El teléfono debe tener entre 8 y 15 dígitos.');
    }
  }

  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
  }

  // Verificar que quien llama es admin de esa empresa
  const callerDoc = await db.doc(`usuarios/${request.auth.uid}`).get();
  if (
    !callerDoc.exists ||
    callerDoc.data().rol !== 'admin' ||
    callerDoc.data().empresaId !== empresaId
  ) {
    throw new HttpsError('permission-denied', 'No autorizado para esta empresa.');
  }

  // Crear cuenta Auth sin afectar la sesión actual
  let userRecord;
  try {
    userRecord = await getAuth().createUser({ email: email.trim(), password });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'El email ya está registrado.');
    }
    if (err.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'Email inválido.');
    }
    if (err.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Contraseña inválida (mín. 6 caracteres).');
    }
    throw new HttpsError('internal', err.message);
  }

  // Crear doc en Firestore con el camionId definitivo
  await db.doc(`usuarios/${userRecord.uid}`).set({
    nombre: nombre.trim(),
    email: email.trim(),
    rol: 'conductor',
    empresaId,
    camionId: camionId || null,
    telefono: telefono?.trim() || null,
    pendiente: false,
    creadoEn: FieldValue.serverTimestamp(),
  });

  // Nota: el envío de email de reseteo lo hace el cliente con sendPasswordResetEmail()
  // tras recibir esta respuesta. El Admin SDK NO envía emails de reseteo.

  return { uid: userRecord.uid };
});
