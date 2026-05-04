# PROMPT 2: UI de Análisis IA + Integración Chatbot Claude

## Contexto
Continuamos con la implementación de RutaApp. Fases 1-6 completadas (operación básica de rutas + cobro). Fase 7 en progreso: **Análisis IA + Chatbot**.

Este PROMPT especifica:
- UI React del panel de Análisis IA (admin-web)
- Integración del chatbot con Claude (Anthropic)
- Cloud Functions para cálculos pre-ejecutados
- Flujo de datos completo

**Stack:** React + Vite, Firebase Firestore, Claude API (Anthropic), Google Maps API

---

## 1. PANEL DE ANÁLISIS ÍA (UI React)

### 1.1 Estructura de carpetas

```
admin-web/src/
├── pages/
│   └── AnalisisPage.jsx          // Página principal del módulo
├── components/
│   ├── AnalisisHeader.jsx         // Encabezado con filtros
│   ├── SemaforoResumen.jsx        // Tarjetas con semáforos
│   ├── SeccionEficiencia.jsx      // Análisis de conductores
│   ├── SeccionRiesgo.jsx          // Riesgo de clientes
│   ├── SeccionOportunidades.jsx   // Oportunidades
│   ├── SeccionGastos.jsx          // Desglose de gastos
│   ├── SeccionAlertas.jsx         // Alertas ordenadas
│   ├── ChatbotPanel.jsx           // Panel del chat IA
│   ├── GestionUmbrales.jsx        // Configuración de umbrales
│   └── ExportButtons.jsx          // Botones para exportar
├── hooks/
│   ├── useAnalisisIA.js           // Hook principal (ya existe)
│   ├── useUmbrales.js             // Hook de umbrales (ya existe)
│   └── useChatbot.js              // Hook NUEVO para chatbot
├── utils/
│   ├── formulasAnalisis.js        // Funciones puras (ya existe)
│   ├── analisisIAHelpers.js       // Helpers (ya existe)
│   └── chatbotHelpers.js          // Funciones NUEVAS para chat
└── styles/
    └── analisis.css               // Estilos del módulo

functions/
├── analisisIA-semanal.js          // Cloud Function cron (ya existe)
├── chatbot-procesarConsulta.js    // Cloud Function NUEVA para chat
└── index.js                       // Exports
```

### 1.2 AnalisisPage.jsx

```jsx
import React, { useState, useEffect } from 'react';
import { useAnalisisIA } from '../hooks/useAnalisisIA';
import { useUmbrales } from '../hooks/useUmbrales';
import AnalisisHeader from '../components/AnalisisHeader';
import SemaforoResumen from '../components/SemaforoResumen';
import SeccionEficiencia from '../components/SeccionEficiencia';
import SeccionRiesgo from '../components/SeccionRiesgo';
import SeccionOportunidades from '../components/SeccionOportunidades';
import SeccionGastos from '../components/SeccionGastos';
import SeccionAlertas from '../components/SeccionAlertas';
import ChatbotPanel from '../components/ChatbotPanel';
import GestionUmbrales from '../components/GestionUmbrales';
import '../styles/analisis.css';

export default function AnalisisPage() {
  const { user } = useAuth(); // Asume auth context
  const [fechaInicio, setFechaInicio] = useState(new Date(Date.now() - 30*24*60*60*1000)); // 30 días atrás
  const [fechaFin, setFechaFin] = useState(new Date());
  const [conductorFiltro, setConductorFiltro] = useState(null);
  const [modoGestion, setModoGestion] = useState(false);

  const { eficiencia, riesgo, oportunidades, gastos, alertas, loading, error } = 
    useAnalisisIA(user.empresaId, fechaInicio, fechaFin, conductorFiltro);
  
  const { umbrales, guardarUmbrales } = useUmbrales(user.empresaId);

  return (
    <div className="analisis-container">
      {/* Header con filtros de período y conductor */}
      <AnalisisHeader 
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onFechaChange={(inicio, fin) => { setFechaInicio(inicio); setFechaFin(fin); }}
        conductorFiltro={conductorFiltro}
        onConductorChange={setConductorFiltro}
        onModoGestion={() => setModoGestion(!modoGestion)}
      />

      {loading && <div className="spinner">Cargando análisis...</div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && (
        <>
          {/* Tarjetas de resumen con semáforos */}
          <SemaforoResumen 
            eficiencia={eficiencia}
            riesgo={riesgo}
            umbrales={umbrales}
          />

          {/* Grid de 5 subsecciones */}
          <div className="analisis-grid">
            <SeccionEficiencia datos={eficiencia} exportable={true} />
            <SeccionRiesgo datos={riesgo} exportable={true} />
            <SeccionOportunidades datos={oportunidades} exportable={true} />
            <SeccionGastos datos={gastos} exportable={true} />
            <SeccionAlertas datos={alertas} />
          </div>

          {/* Panel de gestión (oculto por defecto) */}
          {modoGestion && (
            <GestionUmbrales 
              umbralesActuales={umbrales}
              onGuardar={guardarUmbrales}
              onCancel={() => setModoGestion(false)}
            />
          )}
        </>
      )}

      {/* Chatbot panel fijo en la esquina derecha */}
      <ChatbotPanel empresaId={user.empresaId} />
    </div>
  );
}
```

### 1.3 SemaforoResumen.jsx

Renderiza 4 tarjetas grandes (una por métrica clave) con semáforo y valor.

```jsx
import React from 'react';

export default function SemaforoResumen({ eficiencia, riesgo, umbrales }) {
  const calcularSemaforoEficiencia = (ratio) => {
    if (ratio >= 0.85) return { color: '#10B981', estado: 'Excelente' };
    if (ratio >= 0.70) return { color: '#F59E0B', estado: 'Advertencia' };
    return { color: '#EF4444', estado: 'Crítico' };
  };

  const calcularSemaforoDeuda = (deuda, limite) => {
    const porcentaje = (deuda / limite) * 100;
    if (porcentaje < 50) return { color: '#10B981', estado: 'Seguro' };
    if (porcentaje < 90) return { color: '#F59E0B', estado: 'Alerta' };
    return { color: '#EF4444', estado: 'Crítico' };
  };

  return (
    <div className="semaforo-resumen">
      {/* Tarjeta 1: Eficiencia Promedio */}
      <div className="tarjeta-semaforo">
        <h3>Eficiencia Conductores</h3>
        <div className="semaforo-grande">
          <div 
            className="circulo" 
            style={{ backgroundColor: calcularSemaforoEficiencia(eficiencia.promedioRatio).color }}
          />
          <span className="valor">{(eficiencia.promedioRatio * 100).toFixed(1)}%</span>
          <span className="estado">{calcularSemaforoEficiencia(eficiencia.promedioRatio).estado}</span>
        </div>
        <button className="btn-exportar">📊 Exportar</button>
      </div>

      {/* Tarjeta 2: Deuda Crítica */}
      <div className="tarjeta-semaforo">
        <h3>Clientes en Riesgo</h3>
        <div className="semaforo-grande">
          <span className="numero-grande">{riesgo.filter(c => c.status === 'crítico').length}</span>
          <span className="descripcion">de {riesgo.length} clientes</span>
        </div>
        <button className="btn-exportar">📊 Exportar</button>
      </div>

      {/* Tarjeta 3: Gastos */}
      <div className="tarjeta-semaforo">
        <h3>Gastos Totales</h3>
        <div className="semaforo-grande">
          <span className="numero-grande">
            ${(gastos.porCategoria.reduce((a, b) => a + b.total, 0) / 1000).toFixed(0)}k
          </span>
          <span className="descripcion">período analizado</span>
        </div>
        <button className="btn-exportar">📊 Exportar</button>
      </div>

      {/* Tarjeta 4: Alertas */}
      <div className="tarjeta-semaforo">
        <h3>Alertas Activas</h3>
        <div className="semaforo-grande">
          <span className="numero-grande">{alertas.length}</span>
          <span className="descripcion">requieren atención</span>
        </div>
        <button className="btn-exportar">📊 Ver todas</button>
      </div>
    </div>
  );
}
```

### 1.4 ChatbotPanel.jsx (COMPONENTE PRINCIPAL DEL CHAT)

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { useChatbot } from '../hooks/useChatbot';
import '../styles/chatbot.css';

export default function ChatbotPanel({ empresaId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de análisis. Puedo ayudarte a entender tus datos. ¿Qué quieres saber?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { enviarConsultaAlChatbot } = useChatbot(empresaId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleEnviar = async () => {
    if (!inputValue.trim()) return;

    // Agregar mensaje del usuario
    const userMessage = { role: 'user', content: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Llamar a Cloud Function que procesa con Claude
      const respuesta = await enviarConsultaAlChatbot(inputValue);
      
      // Agregar respuesta del bot
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: respuesta.textoRespuesta,
        analisis: respuesta.datos // Datos contextuales
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Hubo un error procesando tu pregunta. Intenta de nuevo.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-panel">
      {/* Botón flotante para abrir */}
      {!isOpen && (
        <button 
          className="chatbot-boton-flotante"
          onClick={() => setIsOpen(true)}
          title="Abrir asistente IA"
        >
          💬
        </button>
      )}

      {/* Ventana del chat */}
      {isOpen && (
        <div className="chatbot-ventana">
          <div className="chatbot-header">
            <h3>Análisis IA</h3>
            <button 
              className="btn-cerrar"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chatbot-mensajes">
            {messages.map((msg, idx) => (
              <div key={idx} className={`mensaje mensaje-${msg.role}`}>
                <div className="contenido">
                  {msg.content}
                </div>
                {msg.analisis && (
                  <div className="datos-contextuales">
                    {/* Mostrar datos relevantes si están presentes */}
                    {msg.analisis.topConductores && (
                      <div className="dato">
                        <strong>Top conductores:</strong> {msg.analisis.topConductores.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mensaje mensaje-assistant">
                <div className="contenido">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-entrada">
            <input
              type="text"
              placeholder="Pregunta sobre tus datos..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleEnviar()}
              disabled={loading}
            />
            <button 
              onClick={handleEnviar}
              disabled={loading}
              className="btn-enviar"
            >
              {loading ? '...' : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 2. HOOK DEL CHATBOT: useChatbot.js

```javascript
import { useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export function useChatbot(empresaId) {
  const enviarConsultaAlChatbot = useCallback(async (pregunta, historialMensajes = []) => {
    try {
      // Llamar a Cloud Function
      const procesarConsulta = httpsCallable(functions, 'chatbot-procesarConsulta');
      
      const resultado = await procesarConsulta({
        empresaId,
        pregunta,
        historialMensajes,
        // El contexto (datos de rutas, clientes, etc) se recopila en la Cloud Function
      });

      return {
        textoRespuesta: resultado.data.respuesta,
        datos: resultado.data.datosContextuales || null
      };
    } catch (error) {
      console.error('Error en chatbot:', error);
      throw error;
    }
  }, [empresaId]);

  return { enviarConsultaAlChatbot };
}
```

---

## 3. CLOUD FUNCTION: chatbot-procesarConsulta.js (NUEVA)

Esta es la función que conecta con la API de Claude.

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');

const db = admin.firestore();

exports.chatbotProcesarConsulta = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado');
  }

  const { empresaId, pregunta, historialMensajes } = data;
  const userId = context.auth.uid;

  try {
    // 1. Verificar que el usuario pertenece a la empresa
    const usuarioDoc = await db.collection('usuarios').doc(userId).get();
    if (usuarioDoc.data().empresaId !== empresaId) {
      throw new functions.https.HttpsError('permission-denied', 'No tiene acceso a esta empresa');
    }

    // 2. Obtener API Key de Claude desde la empresa (encriptada en Firestore)
    const empresaDoc = await db.collection('empresas').doc(empresaId).get();
    const apiKeyClaudeEncriptada = empresaDoc.data().anthropicApiKey;
    
    if (!apiKeyClaudeEncriptada) {
      throw new functions.https.HttpsError(
        'failed-precondition', 
        'API key de Claude no configurada. Contacte al administrador.'
      );
    }

    // IMPORTANTE: En producción, la API key debe estar encriptada con Cloud KMS
    // Por ahora, asume que se almacena segura. NUNCA la exponga en logs.
    const apiKeyClaudeDesencriptada = desencriptarApiKey(apiKeyClaudeEncriptada);

    // 3. Recopilar contexto: últimos 30 días de datos
    const hace30Dias = new Date(Date.now() - 30*24*60*60*1000);
    
    const rutasSnapshot = await db.collection('rutas')
      .where('empresaId', '==', empresaId)
      .where('fecha', '>=', hace30Dias)
      .get();

    const clientesSnapshot = await db.collection('clientes')
      .where('empresaId', '==', empresaId)
      .get();

    const conductoresSnapshot = await db.collection('usuarios')
      .where('empresaId', '==', empresaId)
      .where('rol', '==', 'conductor')
      .get();

    // Compilar resumen de datos
    const resumenDatos = {
      totalRutas: rutasSnapshot.size,
      totalClientes: clientesSnapshot.size,
      totalConductores: conductoresSnapshot.size,
      ventasUltimos30dias: rutasSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().paradas || []).reduce((s, p) => s + (p.totalVenta || 0), 0);
      }, 0),
      cobranzaUltimos30dias: rutasSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().paradas || []).reduce((s, p) => s + (p.pagoParcial || p.pagoTotal || 0), 0);
      }, 0),
      // ... más métricas
    };

    // 4. Construir prompt para Claude
    const promptSistema = `Eres un asistente de análisis empresarial para RutaApp, una plataforma de distribución de rutas.

El usuario es el dueño/gerente de la empresa ${empresaDoc.data().nombre}.

CONTEXTO DE LA EMPRESA (últimos 30 días):
- Total de rutas: ${resumenDatos.totalRutas}
- Total de clientes activos: ${resumenDatos.totalClientes}
- Total de conductores: ${resumenDatos.totalConductores}
- Ventas totales: $${resumenDatos.ventasUltimos30dias.toLocaleString('es-CO')} COP
- Cobranza total: $${resumenDatos.cobranzaUltimos30dias.toLocaleString('es-CO')} COP
- Ratio de cobranza: ${((resumenDatos.cobranzaUltimos30dias / resumenDatos.ventasUltimos30dias) * 100).toFixed(1)}%

Tu rol es:
1. Responder preguntas en lenguaje natural sobre los datos de la empresa
2. Identificar patrones, tendencias y anomalías
3. Hacer recomendaciones accionables para mejorar operaciones
4. Mantener un tono profesional pero conversacional
5. Si hay ambigüedad, pedir aclaración antes de responder

IMPORTANTE: Solo analiza datos de RutaApp. No hagas predicciones sobre economía nacional ni temas fuera del contexto empresarial del usuario.`;

    // 5. Llamar a Claude API
    const client = new Anthropic({ apiKey: apiKeyClaudeDesencriptada });
    
    // Construir historial de mensajes
    const mensajesParaClaude = [
      ...historialMensajes.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: pregunta }
    ];

    const respuesta = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Modelo recomendado para análisis
      max_tokens: 1024,
      system: promptSistema,
      messages: mensajesParaClaude
    });

    const textoRespuesta = respuesta.content[0].text;

    // 6. Extraer datos relevantes de la respuesta si es posible
    const datosContextuales = extraerDatosDelContexto(resumenDatos, pregunta);

    // 7. Registrar en audit log (opcional pero recomendado)
    await db.collection('auditLogs').add({
      empresaId,
      userId,
      timestamp: new Date(),
      tipo: 'chatbot_consulta',
      pregunta: pregunta.substring(0, 200), // Primeros 200 chars
      modeloUsado: 'claude-3-5-sonnet'
    });

    return {
      respuesta: textoRespuesta,
      datosContextuales: datosContextuales,
      tokenesUsados: respuesta.usage.input_tokens + respuesta.usage.output_tokens
    };

  } catch (error) {
    console.error('Error en chatbot:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Funciones auxiliares
function desencriptarApiKey(encriptada) {
  // TODO: Usar Cloud KMS para desencriptar
  // Por ahora, retorna la key tal cual (mejorar en producción)
  return encriptada;
}

function extraerDatosDelContexto(datos, pregunta) {
  // Heurística simple: si la pregunta menciona conductores, retorna info de conductores
  if (pregunta.toLowerCase().includes('conductor') || pregunta.toLowerCase().includes('eficiencia')) {
    return { tipoDato: 'conductores' };
  }
  if (pregunta.toLowerCase().includes('cliente') || pregunta.toLowerCase().includes('riesgo')) {
    return { tipoDato: 'clientes' };
  }
  if (pregunta.toLowerCase().includes('gasto') || pregunta.toLowerCase().includes('costo')) {
    return { tipoDato: 'gastos' };
  }
  return null;
}
```

---

## 4. CONFIGURACIÓN INICIAL (IMPORTANTE)

### 4.1 Variables de entorno (.env.local)

```env
# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...

# Claude/Anthropic
VITE_ANTHROPIC_API_KEY=...  # SOLO para desarrollo local
# En producción, la key se almacena encriptada en Firestore por empresa
```

### 4.2 Seguridad: Dónde guardar la API Key

**Opción A (Recomendada - Producción):**
- El usuario proporciona su API key de Claude en la sección de Gestión
- Se encripta con Cloud KMS y se almacena en Firestore.empresas.anthropicApiKey
- La Cloud Function desencripta y usa la key

**Opción B (Desarrollo):**
- Usar variable de entorno en Cloud Functions
- Llamadas locales usan VITE_ANTHROPIC_API_KEY
- NO exponer en frontend

### 4.3 Firestore Rules para seguridad

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/document {
    match /empresas/{empresaId} {
      // Nadie puede leer la API key directamente
      match /anthropicApiKey {
        allow read, write: if false;
      }
      // Solo admin puede escribirla (a través de Cloud Functions)
      allow read: if request.auth.uid in resource.data.adminIds;
    }
  }
}
```

---

## 5. FLUJO COMPLETO: Usuario hace pregunta → Respuesta

```
1. Usuario escribe "¿Por qué cayeron las ventas esta semana?" en ChatbotPanel.jsx
2. handleEnviar() → llama useChatbot.enviarConsultaAlChatbot(pregunta)
3. useChatbot.js → Llamada HTTPS a Cloud Function: chatbot-procesarConsulta
4. Cloud Function:
   a. Verifica autenticación y permisos
   b. Obtiene contexto: últimas rutas, clientes, conductores
   c. Construye prompt con contexto + historial de mensajes
   d. Llama a Claude API con la pregunta
   e. Claude retorna análisis en lenguaje natural
   f. Retorna respuesta + datos relevantes
5. ChatbotPanel recibe respuesta → renderiza en la ventana
6. Usuario puede hacer follow-up: "¿Qué conductor fue responsable?"
7. Historial se mantiene para multi-turn conversation
```

---

## 6. EJEMPLOS DE PREGUNTAS QUE ENTIENDE

```
"¿Por qué cayeron las ventas esta semana?"
→ Claude analiza: comparación con semana anterior, qué clientes compraron menos, qué conductores tuvieron menor cobranza, alertas relevantes.

"¿Qué cliente está más en riesgo?"
→ Claude retorna: análisis de deuda, historial de pago, antigüedad, límite de crédito recomendado, acciones sugeridas.

"¿Cuál es mi conductor más eficiente?"
→ Claude retorna: ranking de eficiencia por ratio cobrado/vendido, análisis de gastos, comparativa de paradas por día.

"¿Qué zona genera más ganancias?"
→ Claude analiza: ventas por zona geográfica, gastos por zona, margen neto, recomendaciones de enfoque.

"Mi gasto en combustible está arriba del promedio"
→ Claude retorna: causas posibles, comparativa con semanas anteriores, conductores con mayor consumo, recomendaciones de ruta.
```

---

## 7. COMPONENTES SECUNDARIOS (Resumido)

### 7.1 SeccionEficiencia.jsx

Tabla de conductores con columnas:
- Nombre
- Vendido ($)
- Cobrado ($)
- Ratio (%)
- Semáforo
- Gastos
- Tendencia (↑↓→)
- Botón Exportar

### 7.2 SeccionRiesgo.jsx

Tabla de clientes con columnas:
- Nombre
- Deuda actual ($)
- % del límite
- Pago histórico (%)
- Antigüedad
- Semáforo
- Acción recomendada
- Botón Exportar

### 7.3 SeccionAlertas.jsx

Lista ordenada por severidad:
```
🔴 CRÍTICO: Conductor X cobró 35% de lo que vendió
   → Ingresos perdidos: $2,450,000 esta semana
   → Acción: Contactar, revisar cliente por cliente

🟡 ADVERTENCIA: Cliente Y gastos 2.5x promedio
   → Costo anómalo en combustible
   → Acción: Revisar ruta optimización

🟢 OPORTUNIDAD: Cliente Z siempre paga 100%
   → Puede absorber 50% más crédito
   → Acción: Ofrecerle línea expandida
```

### 7.4 GestionUmbrales.jsx

Formulario con 4 inputs:
- Umbral de ineficiencia (%) ← default 70%
- Umbral de gastos anormales (multiplicador) ← default 2.0x
- Umbral cliente riesgo (meses bajada) ← default 3
- Umbral oportunidad (% pago) ← default 90%

Con botones: Guardar, Cancelar, "Restaurar defectos"

---

## 8. ESTILOS CSS (analisis.css)

```css
.analisis-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.semaforo-resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.tarjeta-semaforo {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.semaforo-grande {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 15px 0;
  gap: 10px;
}

.circulo {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.valor {
  font-size: 28px;
  font-weight: bold;
  color: #1f2937;
}

.estado {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
}

/* Chatbot */
.chatbot-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  z-index: 1000;
}

.chatbot-boton-flotante {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.3s;
}

.chatbot-boton-flotante:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.chatbot-ventana {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 380px;
  height: 500px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
}

.chatbot-header {
  background: #3b82f6;
  color: white;
  padding: 15px;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chatbot-mensajes {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mensaje {
  padding: 10px 12px;
  border-radius: 6px;
  max-width: 85%;
  line-height: 1.4;
  font-size: 14px;
}

.mensaje-user {
  align-self: flex-end;
  background: #e0e7ff;
  color: #1e1b4b;
}

.mensaje-assistant {
  align-self: flex-start;
  background: #f3f4f6;
  color: #374151;
}

.chatbot-entrada {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.chatbot-entrada input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
}

.btn-enviar {
  width: 36px;
  height: 36px;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.btn-enviar:hover:not(:disabled) {
  background: #2563eb;
}

.btn-enviar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Indicador de escritura */
.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: flex-end;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: bounce 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
```

---

## 9. TAREAS DE IMPLEMENTACIÓN (Orden recomendado)

### Fase 1: Backend + Cloud Functions
- [ ] Instalar @anthropic-ai/sdk en functions
- [ ] Crear chatbot-procesarConsulta.js
- [ ] Desplegar a Firebase
- [ ] Probar en Postman/Thunder Client

### Fase 2: Hooks React
- [ ] Crear useChatbot.js
- [ ] Crear ChatbotPanel.jsx
- [ ] Conectar con Cloud Function

### Fase 3: UI Principal del Análisis
- [ ] AnalisisPage.jsx
- [ ] AnalisisHeader.jsx (filtros)
- [ ] SemaforoResumen.jsx
- [ ] Secciones (Eficiencia, Riesgo, Oportunidades, Gastos, Alertas)

### Fase 4: Gestión de Umbrales
- [ ] GestionUmbrales.jsx
- [ ] useUmbrales.js (si no existe)
- [ ] Guardado a Firestore

### Fase 5: Estilos y Pulido
- [ ] CSS: analisis.css
- [ ] CSS: chatbot.css
- [ ] Testing en múltiples navegadores

### Fase 6: Deploy
- [ ] Vercel: admin-web
- [ ] Firebase: Cloud Functions

---

## 10. NOTAS IMPORTANTES

### Seguridad API Key Claude
**NUNCA** expongas la API key en el frontend. Siempre:
- Guarda encriptada en Firestore (Cloud KMS recomendado)
- Desencripta en Cloud Function solamente
- Usa la key en lado del servidor

### Rate Limiting
Implementar limites en Cloud Functions para evitar abuso:
```javascript
const rateLimit = new Map(); // userId → { count, timestamp }
if (rateLimit.get(userId)?.count > 100) {
  throw new HttpsError('resource-exhausted', 'Límite de preguntas excedido');
}
```

### Monitoring
Agregar logs de:
- Preguntas enviadas (sin incluir datos sensibles)
- Errores de API
- Tokens consumidos por empresa
- Latencias

### Costo de Claude API
- ~$3 por 1M tokens de input, ~$15 por 1M output
- Limitar a 100 preguntas/mes/usuario por suscripción estándar
- Para empresas grandes, ofrecer tier "Premium" con límite expandido

---

## 11. PRÓXIMOS PASOS DESPUÉS DE PROMPT 2

- **PROMPT 3**: Mobile App del Conductor (ui de rutas, registro de ventas, cobro)
- **PROMPT 4**: Offline Sync + Login SMS
- **PROMPT 5**: Deploy a Producción (Vercel + Play Store)
- **PROMPT 6**: Métricas + Analytics

---

**Este documento es tu guía completa para implementar PROMPT 2. Procede con confianza.**
