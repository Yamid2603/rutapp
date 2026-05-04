# RutaApp — Manifesto v3
**Fecha:** Abril 2026  
**Versión:** 3.0 — Producción lista para lanzamiento

---

## 1. Origen y visión

RutaApp nació de un problema concreto: los distribuidores de agua, alimentos y productos de consumo masivo en Colombia manejan sus rutas diarias con libretas, WhatsApp y hojas de Excel. Eso significa deudas sin seguimiento, cobros que no cuadran, conductores sin supervisión y cero visibilidad sobre la salud del negocio.

**La propuesta:** una app móvil para el conductor + un panel web para el dueño, conectados en tiempo real, con inteligencia artificial que analiza el negocio cada semana y lo resume por correo cada mes.

**A quién va dirigida:** distribuidoras pequeñas y medianas colombianas (5–50 clientes por ruta, 1–5 camiones). Sector típico: agua purificada, productos lácteos, abarrotes.

**Modelo de negocio:** SaaS por empresa (suscripción mensual). Un solo despliegue de Firebase sirve a múltiples empresas aisladas entre sí — arquitectura multi-tenant.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| App conductor | React Native + Expo ~54 |
| Panel admin | React 18 + Vite |
| Backend | Firebase (Firestore, Auth, Storage, Functions) |
| IA | Claude claude-haiku-4-5 (análisis semanal + mensual) |
| Maps | Google Maps SDK (conductor-app + admin-web) |
| Email | Nodemailer + Gmail SMTP (App Password) |
| Build móvil | EAS Build (Expo Application Services) |
| Hosting admin | Firebase Hosting → https://rutapp-cfa16.web.app |

**Tipografía admin-web:** Inter (cuerpo) + Barlow Condensed (títulos)  
**Paleta:**
- Fondo: `#F8F8F4` (neutro tech) / `#F0F0D8` (cream en conductor-app)
- Navy: `#0D2433` (headers, sidebar, tab bar)
- Teal: `#1693A5` (acento principal) / `#4DD4E4` (activo en nav)
- Texto: `#1a1a1a`
- Bordes: `#E8E8D0` / `rgba(13,36,51,0.08)`

---

## 3. Estructura del proyecto

```
rutaapp/
├── conductor-app/          # React Native (Expo)
│   ├── src/
│   │   ├── context/        # AuthContext, RutaContext
│   │   ├── screens/        # Todas las pantallas
│   │   ├── components/     # Modales, sheets, UI reutilizable
│   │   ├── services/       # SyncService (offline queue)
│   │   ├── hooks/          # useCollection, etc.
│   │   └── utils/          # generarPDF, seedFirestore
│   └── eas.json            # Perfiles EAS Build
├── admin-web/              # React + Vite
│   ├── src/
│   │   ├── pages/          # Todas las páginas del panel
│   │   ├── components/     # Modales, Sidebar, ChatbotPanel
│   │   ├── hooks/          # useCollection, useClientes, etc.
│   │   └── config/         # firebase.js
├── functions/              # Cloud Functions Node 22
│   ├── index.js
│   ├── analisisIA-semanal.js
│   ├── resumenMensual.js
│   ├── chatbot-procesarConsulta.js
│   ├── crearConductor.js
│   └── desactivarConductor.js
├── firestore.rules
├── storage.rules
└── firebase.json
```

---

## 4. Modelo de datos (Firestore)

### `empresas/{empresaId}`
```
nombre, nit?, telefono, logoUrl?,
templatePDF: { logo, colorPrimario, colorSecundario, mensajePie, mostrarDeuda },
rutaDesdeEmpresa?: boolean,   # ← ruta vuelve al depósito al final
lat?, lng?
```

### `usuarios/{uid}`
```
nombre, email, rol: 'admin' | 'conductor',
empresaId, camionId?,
activo: boolean, desactivadoEn?
```

### `clientes/{id}`
```
nombre, direccion, lat?, lng?,
wap1, wap2?,
deuda: number,               # actualizado en cada visita
preciosCliente: { productoId: precio },
pedidoUsual: { productoId: qty },
notas?,
fotoUrl?,
limiteDeuda?: number,        # 0 = automático por historial
empresaId
```

### `productos/{id}`
```
nombre, emoji, empresaId,
precioBase?: number,
retornable: boolean          # ← indica si se recoge en visita (ej. garrafones)
```

### `rutas/{id}`
```
fecha, conductorId, camionId, empresaId,
estado: 'activa' | 'completada',
paradas: [
  {
    clienteId, orden, estado: 'pendiente' | 'visitado' | 'saltado',
    cantidades: { productoId: qty },
    totalVenta, totalCobrado, formaPago,
    recogidaInventario: { productoId: qty },   # ← antes garrafonesVaciosRecogidos
    fechaVisita?,
  }
],
inventarioInicial: { productoId: qty },
gastos: [{ descripcion, monto, categoria }],
devoluciones: [{ productoId, qty, tipo: 'dañado' | 'devuelto' }],
ordenOptimizado?: boolean,
deleted?: boolean, deletedAt?, deletedBy?   # ← soft-delete
```

### `transacciones/{id}`
```
empresaId, rutaId, conductorId, clienteId,
fecha, cantidades,
totalVenta, totalCobrado, formaPago,
deudaAnterior, deudaResultante,
comprobanteUrl?,
tipo?: 'ajuste',                     # ← solo en correcciones
cantidadesAnterior?, cantidadesNuevo?,
totalVentaAnterior?, totalVentaNuevo?,
totalCobradoAnterior?, totalCobradoNuevo?,
deltaVenta?, deltaCobrado?,
editadoEn?
```
*(Las transacciones son inmutables. Las correcciones crean un doc nuevo con `tipo: 'ajuste'` — el original nunca se toca.)*

### `historialCliente/{id}`
```
clienteId, empresaId, fecha,
cantidades, totalVenta, totalCobrado,
deudaAnterior, deudaResultante
```

### `analisisSemanal/{id}`
```
empresaId, semanaKey, generadoEn,
eficienciaConductores, riesgoCrediticio,
oportunidades, alertas, analisisIA
```

### `resumenMensual/{empresaId_mesKey}`
```
empresaId, mesKey, mesLabel,
totalVentas, totalCobrado, totalDeuda,
clientesConDeuda, ratioCobranza,
totalTransacciones, topClientes,
analisisIA, generadoEn
```

### `chatbotRateLimit/{userId_hourKey}`
```
userId, hourKey, count, updatedAt
```
*(Solo Admin SDK escribe. Rate limit: 10 consultas/hora por usuario.)*

---

## 5. App conductor (React Native)

### Autenticación
- Email + password con Firebase Auth
- Rol verificado en Firestore antes de entrar
- Recuperación de contraseña por email (sendPasswordResetEmail)

### Flujo del día

**1. Ruta del día (`RutaDelDiaScreen`)**
- Si el admin creó ruta → se muestra directamente
- Si no hay ruta → botón "Iniciar mi día": el conductor selecciona clientes de la última ruta completada (sugeridos) + ingresa inventario inicial
- Lista de paradas ordenable manualmente o con optimización de ruta (Google Maps)
- Botón "Ver ruta en mapa" → Google Maps nativo con coordenadas reales del cliente
- FAB ➕ para agregar clientes no planificados en cualquier momento

**2. Perfil del cliente (`ClientePerfilScreen`)**
- Foto del cliente (sube a Firebase Storage y persiste)
- Deuda actual en tiempo real
- Botón WhatsApp directo (+57 u otro país)
- Pedido usual precargado
- Notas del conductor

**3. Cobro (`CobroScreen`)**
- Cantidades por producto (precargadas con pedido usual)
- Total venta calculado en tiempo real con precios del cliente
- Campo "Total cobrado" libre
- Forma de pago: efectivo / transferencia / empresa
- Si pago > deuda → muestra "Crédito a favor: $X" en verde
- Sección "Recogida de inventario" → solo productos con `retornable: true`
- Comprobante foto (transferencia) → sube a Storage
- Al cerrar visita → genera PDF y abre WhatsApp con PDF adjunto

**4. Inventario (`InventarioScreen`)**
- Stock actual por producto (inventario inicial menos ventas + devoluciones)
- Registro de devoluciones (dañado / devuelto)

**5. Perfil conductor (`PerfilScreen`)**
- Foto de perfil, nombre
- Botón "Ejecutar Seed" (solo en desarrollo) — usa empresaId real del usuario

### Offline sync
`SyncService.js` gestiona una cola FIFO. Cuando no hay conexión, las acciones se encolan. Al recuperar conexión, se procesan en orden: cerrar visita → crear transacción → actualizar deuda cliente → actualizar parada en ruta.

### PDF
`generarPDF.js` genera comprobante HTML→PDF con:
- Logo de la empresa (de Firestore `empresaData.logoUrl`)
- Colores del template PDF de la empresa
- Cantidades, precios, total, forma de pago, deuda resultante
- Mensaje pie de página personalizado

---

## 6. Panel admin web (React)

### Páginas

**Dashboard** (`/admin`)
- KPIs del día: ventas, cobrado, por cobrar, rutas activas
- Gráfica semanal de ventas vs cobrado
- Top 5 productos vendidos (por nombre, no por ID)
- Mapa de camiones en tiempo real (Google Maps)

**Clientes** (`/admin/clientes`)
- Tabla con deuda, límite de crédito, teléfono, dirección
- Modal de edición: todos los campos + precios por producto + límite de crédito manual
- Foto del cliente (preview + upload)
- Semáforo de riesgo crediticio por cliente

**Cuadre del día** (`/admin/cuadre`)
- Vista "día" y "semana" y "mes"
- Por camión: totales de ventas, cobrado, efectivo, transferencia, empresa, garrafones recogidos
- **Vista día:** lista de paradas individuales visitadas por camión
  - Botón "Corregir" por cada parada
  - `EditarVisitaModal`: edita cantidades, cobro y forma de pago
  - Crea transacción de ajuste con delta completo (audit trail)
  - Recalcula deuda del cliente automáticamente
- Exportar CSV: detalle por camión, totales consolidados

**Zonas & Carga** (`/admin/zonas`)
- Gestión de rutas semanales (días × camiones)
- Asignación de clientes por día/camión
- Eliminación de ruta → soft-delete (`deleted: true`) — nunca borra el documento

**Gestión** (`/admin/gestion`)
- Crear camión + conductor (Cloud Function Admin SDK, no cierra sesión admin)
- Reasignar conductor: crea nuevo → reasigna camión → desactiva anterior (Auth disabled + revokeRefreshTokens)
- Exportar CSV contabilidad (incluye ventas a crédito con $0 cobrado)

**Análisis IA** (`/admin/analisis`)
- 5 secciones: eficiencia conductores, riesgo crediticio, oportunidades, gastos, alertas
- Semáforos por conductor y por cliente
- Umbrales editables por el admin (deuda máxima, % cobranza mínimo, etc.)
- Período personalizable (última semana / último mes / rango custom)
- Chatbot "Asistente RutaApp" flotante — consultas en lenguaje natural sobre el negocio

**Perfil admin** (`/admin/perfil`)
- Editar nombre y WhatsApp
- Cambiar contraseña (si tiene provider email/password)
- Si usa Google Sign-In → muestra provider activo (sin campo password)

### Onboarding (`/onboarding`)
5 pasos para registrar empresa nueva:
1. Bienvenida
2. Datos de la empresa (nombre, NIT opcional, teléfono, logo)
3. Cuenta admin (email+password o Google Sign-In)
4. Primer producto + primer conductor
5. Confirmación y acceso al panel

---

## 7. Cloud Functions

### `analisisIASemanal` — Lunes 6:00 AM
- Lee todas las empresas activas
- Para cada empresa: consulta transacciones y rutas de la última semana
- Llama a Claude claude-haiku-4-5 para análisis textual
- Guarda resultado en `analisisSemanal/{id}`
- **Envía email HTML** a todos los admins de la empresa con:
  - KPIs de la semana (ventas, cobrado, por cobrar, transacciones)
  - Top 5 clientes
  - Análisis IA con recomendaciones
  - Botón "Ver panel completo" → Firebase Hosting

### `resumenMensual` — Día 1 de cada mes 7:00 AM
- Similar al semanal pero con datos del mes anterior completo
- Análisis IA más profundo: riesgo del mes, mayor oportunidad, acción concreta para el próximo mes
- Guarda en `resumenMensual/{empresaId_mesKey}` (evita duplicados con check previo)
- **Envía email HTML** mensual con:
  - 4 métricas card: ventas, cobrado, deuda total, ratio cobranza
  - Tabla top clientes
  - Análisis IA formateado
- Secrets requeridos: `ANTHROPIC_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`

### `chatbotProcesarConsulta` — Callable HTTPS
- Auth verificada + empresaId del caller
- Rate limit: 10 consultas/hora vía Firestore `runTransaction` (atómico, multi-instancia)
- Consulta datos de empresa (transacciones, clientes, rutas, gastos últimas 2 semanas)
- Llama Claude 3.5 Sonnet con contexto completo
- Retorna respuesta + resumen de datos usados
- Errores: `HttpsError` con códigos correctos (unauthenticated, resource-exhausted, permission-denied, internal)

### `crearConductor` — Callable HTTPS
- Crea usuario Auth con Admin SDK (sin cerrar sesión del admin)
- Crea doc `usuarios/{uid}` y actualiza `camiones/{id}.conductorId`
- Valida: caller es admin de la misma empresa, password ≥ 6 chars
- Envía email reset de contraseña al conductor nuevo (client-side, no Admin SDK)

### `desactivarConductor` — Callable HTTPS
- Verifica que caller es admin y target pertenece a su empresa
- `Auth.updateUser(uid, { disabled: true })` + `revokeRefreshTokens`
- Marca `usuarios/{uid}.activo = false`, limpia `camionId`

---

## 8. Seguridad

### Firestore Rules — principios
- **Multi-tenant**: toda lectura/escritura requiere `empresaId == myEmpresaId()` (función helper que lee `usuarios/{uid}`)
- **Delete bloqueado** en todas las colecciones operativas: `allow delete: if false`
  - clientes, productos, camiones, rutas, historialCliente, transacciones
  - Solo Admin SDK puede eliminar (funciones de desactivación/limpieza)
- **Transacciones inmutables**: `allow update, delete: if false`
- **Roles**: `isAdmin()` requerido para update de productos, camiones, historialCliente
- **Conductores**: pueden crear y actualizar en rutas, clientes, transacciones, historialCliente
- **Auto-update de usuarios**: permitido con guards (`rol`, `empresaId`, `email` no pueden cambiar)
- **Análisis y resúmenes**: solo lectura para admins, escritura bloqueada al cliente (Admin SDK solo)

### Soft-delete de rutas
`ZonasPage` al "eliminar" una ruta hace `updateDoc({ deleted: true, deletedAt, deletedBy })`. El documento queda en Firestore para auditoría. Las queries filtran `!r.deleted`.

### Audit trail de correcciones
Al corregir una visita desde `EditarVisitaModal`:
1. Se actualiza `rutas/{id}.paradas` con los nuevos valores
2. Se crea una nueva `transaccion` con `tipo: 'ajuste'` que registra antes/después y delta
3. La transacción original queda intacta — nunca se toca

### Storage Rules
- `logos/{empresaId}/**` — lectura pública, escritura solo autenticado
- `clientes/{clienteId}/**` — solo autenticados
- `transacciones/{transaccionId}/**` — solo autenticados (comprobantes)

---

## 9. Lógica de negocio clave

### Deuda del cliente
```
deudaResultante = deudaAnterior + totalVenta - totalCobrado
```
Sin `Math.max(0, ...)` — puede ser negativa (crédito a favor). La UI muestra "Crédito a favor: $X" en verde cuando `deudaAnterior < 0`.

### Precios por cliente
Cada cliente tiene `preciosCliente: { productoId: precio }` — precios individuales, no listas A/B/C. El admin los asigna por cliente. Botón "Aplicar precio base a todos" para normalizar desde `productos.precioBase`.

### Inventario retenible
Productos con `retornable: true` (ej. garrafones) aparecen en la sección "Recogida" del cobro. Se guarda en `recogidaInventario: { productoId: qty }` por parada. `CuadrePage` los suma al cuadre del día.

### Optimización de ruta
`optimizarRuta()` usa la API de Google Maps Directions. Si `empresa.rutaDesdeEmpresa === true`, la ruta termina en el depósito (lat/lng de la empresa). Retorna boolean — errores se muestran con Alert al conductor.

### Límite de crédito
Por defecto, el sistema calcula el límite por promedio mensual × historial de pago × antigüedad. Para clientes confiables, el admin puede sobreescribir con `limiteDeuda` manual (en pesos). `limiteDeuda: 0` = cálculo automático.

---

## 10. Deployment

### Firebase Hosting (admin-web)
```bash
cd admin-web && npm run build
firebase deploy --only hosting
# → https://rutapp-cfa16.web.app
```
`firebase.json` apunta a `admin-web/dist` con rewrite SPA a `/index.html`.

### Cloud Functions
```bash
firebase deploy --only functions:nombrFuncion
# Para secrets: ya configurados en Secret Manager:
#   firebase functions:secrets:set EMAIL_USER
#   firebase functions:secrets:set EMAIL_PASS
#   firebase functions:secrets:set ANTHROPIC_API_KEY
```
Todos los `onSchedule` y `onCall` que usan secrets los declaran explícitamente en el array `secrets: [...]` — requisito de Functions v2 para que `process.env` los reciba.

### Firestore Rules y Storage Rules
```bash
firebase deploy --only firestore:rules,storage
```

### Conductor app — EAS Build
```bash
# APK de prueba (distribuir directo):
npx eas-cli build --platform android --profile preview

# AAB para Play Store:
npx eas-cli build --platform android --profile production
```
`eas.json` define perfil `preview` (APK, buildType: apk) y `production` (AAB, Play Store).

---

## 11. Empresa piloto

**Distribuidora de Agua El Manantial**
- Productos: Garrafón 18.9L, Bolsa 6L, Paquete Bolsa 350ml×4, Garrafón 5L
- Todos los garrafones tienen `retornable: true`
- Datos seed disponibles en `seedFirestore.js` (con empresaId dinámico)

---

## 12. Pendientes de operación

| Tarea | Prioridad | Cómo |
|-------|-----------|------|
| Verificar email semanal | Alta | Cloud Scheduler → ejecutar `analisisIASemanal` → revisar logs Firebase Functions |
| GCP Backup Firestore | Alta | console.cloud.google.com → Firestore → Backups → Daily, retención 30 días |
| EAS Build APK | Media | `npx eas-cli build --platform android --profile preview` |
| PWA admin-web | Baja | manifest.json + service worker |
| SHA-1 Google Sign-In | Al publicar en Play Store | `keytool -list -v -keystore ...` → Firebase Console → Auth → Google → SHA-1 |

---

## 13. Histórico de implementación

| Sprint | Fecha | Alcance |
|--------|-------|---------|
| Base | Mar 2026 | Auth, pantallas conductor, Firestore, panel admin, Maps, ubicación cliente |
| Fase 7 | Abr 9-10 | Análisis IA backend + Cloud Functions |
| Fase 8 | Abr 13 | Chatbot deployado, umbrales editables, Onboarding 5 pasos |
| Fase 9-10 | Abr 22 | Logos, Google Sign-In, WhatsApp+país, NIT, Firestore rules v1, Node 22 |
| Diseño | Abr 23 | Inter + Lucide + Ionicons, conductor-app 100% temado, limiteDeuda por cliente |
| Sprint bugs-1 | Abr 28 | 7 bugs (camión/conductor/Google/foto/export/perfil/chatbot) + 11 bugs auditoría |
| Sprint bugs-2 | Abr 29 | 17 fixes (BUG-01/02, SEC-01, HUECO-01/02/03/04, ADMIN-01/02/03/05/06, UX-01/02/03) |
| Sprint 3 | Abr 30 | B1 (conductor crea su ruta), B2 (WhatsApp autofill), B3 (seed dinámico), F2 (crédito a favor), F3 (retornable dinámico), F4 (tab bar insets) |
| Seguridad + Email | Abr 30 | Delete rules, soft-delete, corrección visitas admin, SEC-02 rate limiter, emails semanales/mensuales, Firebase Hosting |

---

*RutaApp v3 — Sistema completo de distribución de rutas con IA, auditoría financiera y seguridad multi-tenant.*
