import { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../hooks/useChatbot';
import styles from './ChatbotPanel.module.css';

export default function ChatbotPanel({ empresaId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente IA. Pregunta sobre tus datos, conductores, clientes o gastos.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { enviarConsultaAlChatbot } = useChatbot(empresaId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEnviar = async () => {
    const pregunta = inputValue.trim();
    if (!pregunta) return;

    setMessages(prev => [...prev, { role: 'user', content: pregunta }]);
    setInputValue('');
    setLoading(true);

    try {
      const respuesta = await enviarConsultaAlChatbot(
        pregunta,
        messages.map(m => ({ role: m.role, content: m.content }))
      );

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: respuesta.textoRespuesta,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message || 'Intenta de nuevo'}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.chatbotPanel}>
      {!isOpen && (
        <button
          className={styles.botonFlotante}
          onClick={() => setIsOpen(true)}
          title="Asistente IA"
        >
          💬
        </button>
      )}

      {isOpen && (
        <div className={styles.ventana}>
          <div className={styles.header}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>🤖 Asistente RutaApp</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Pregunta sobre conductores, clientes o gastos</div>
            </div>
            <button
              className={styles.btnCerrar}
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.mensajes}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`${styles.mensaje} ${styles[`msg_${msg.role}`]}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className={`${styles.mensaje} ${styles.msg_assistant}`}>
                <span className={styles.typing}>●●●</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.entrada}>
            <input
              type="text"
              placeholder="¿Qué quieres saber?"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleEnviar()}
              disabled={loading}
            />
            <button
              onClick={handleEnviar}
              disabled={loading}
              className={styles.btnEnviar}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
