import { useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export function useChatbot(empresaId) {
  const enviarConsultaAlChatbot = useCallback(async (pregunta, historialMensajes = []) => {
    if (!empresaId) throw new Error('empresaId requerido');

    try {
      const procesarConsulta = httpsCallable(functions, 'chatbotProcesarConsulta');
      const resultado = await procesarConsulta({
        empresaId,
        pregunta,
        historialMensajes,
      });

      return {
        textoRespuesta: resultado.data.respuesta,
        datosContextuales: resultado.data.datosContextuales,
        tokens: resultado.data.tokens,
      };
    } catch (error) {
      console.error('[useChatbot]', error);
      throw error;
    }
  }, [empresaId]);

  return { enviarConsultaAlChatbot };
}
