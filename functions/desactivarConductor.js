/**
 * desactivarConductor.js
 * Cloud Function callable: deshabilita la cuenta Auth de un conductor,
 * revoca sus tokens activos y marca el doc como inactivo.
 *
 * Llamada típicamente cuando se reasigna un camión a un conductor nuevo.
 *
 * Deploy:
 *   firebase deploy --only functions:desactivarConductor
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();

exports.desactivarConductor = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
  }

  const { uid: targetUid } = request.data || {};
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Falta uid.');
  }

  // Validar que caller es admin de la misma empresa que target
  const callerDoc = await db.doc(`usuarios/${request.auth.uid}`).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo admin puede desactivar conductores.');
  }

  const targetDoc = await db.doc(`usuarios/${targetUid}`).get();
  if (!targetDoc.exists) {
    throw new HttpsError('not-found', 'Conductor no encontrado.');
  }
  if (targetDoc.data().empresaId !== callerDoc.data().empresaId) {
    throw new HttpsError('permission-denied', 'El conductor no pertenece a tu empresa.');
  }

  try {
    // Deshabilitar cuenta + revocar tokens activos
    await getAuth().updateUser(targetUid, { disabled: true });
    await getAuth().revokeRefreshTokens(targetUid);

    // Marcar doc como inactivo y desligar del camión
    await db.doc(`usuarios/${targetUid}`).update({
      activo: false,
      camionId: null,
      desactivadoEn: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  } catch (err) {
    throw new HttpsError('internal', err.message);
  }
});
