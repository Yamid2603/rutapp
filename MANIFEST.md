# RutaApp — Estado del Proyecto
**Última actualización:** 2026-05-04 (Email configuration completado ✅)

---

## 🟢 ESTADO OPERATIVO ACTUAL

| Componente | Estado |
|-----------|--------|
| Flujo de venta completo (donalirio) | ✅ Funcionando |
| Precios por cliente | ✅ Asignados |
| Exports CSV (4 tipos) | ✅ Funcionando |
| PDF comprobante + envío WhatsApp | ✅ Funcionando |
| Asignación rutas admin → conductor | ✅ Funcionando |
| Análisis IA + semáforo | ✅ Funcionando |
| Límite crédito manual por cliente | ✅ Implementado |
| Google Sign-In nombre "RutaApp" | ✅ Configurado |
| Diseño admin-web completo | ✅ Swapped |
| Diseño conductor-app completo | ✅ Todos los screens |
| Crear camión + conductor (Cloud Function) | ✅ Funcionando |
| Foto del cliente | ✅ Funcionando |
| Exportar CSV CuadrePage | ✅ Funcionando |
| Perfil admin (cambiar nombre/wap/password) | ✅ Funcionando |
| Teléfono conductor + botón WhatsApp | ✅ Implementado |
| Chatbot costos (fix fecha string) | ✅ Corregido |
| Chatbot errores serialización + validaciones | ✅ Corregido |
| Deuda cliente actualiza en Firestore | ✅ Corregido |
| Formas de pago cuadre inconsistente | ✅ Corregido |
| Foto cliente persiste | ✅ Corregido |
| Garrafones vacíos (input UI) | ✅ Corregido |
| Conductor desactivado al reasignar | ✅ Corregido |
| Aislamiento multi-tenant (SEC) | ✅ Corregido |
| **Email semanal + mensual** | **✅ FUNCIONANDO** |
| **Cloud Scheduler semanal/mensual** | **✅ ACTIVO** |
| **Secrets Firebase (EMAIL_USER, EMAIL_PASS)** | **✅ CONFIGURADOS** |
| PDF logo empresa | ❌ Pendiente conectar |
| Ruta retorno a depósito | ❌ Bug conocido |

---

## 🎨 DISEÑO — REFERENCIA

### Paleta
- **Navy** `#0D2433` — header/sidebar en AMBAS apps (identidad unificada)
- **Teal** `#1693A5` — acento primario, botones CTA
- **Teal light** `#4DD4E4` — contraste sobre fondos navy
- **Cream** `#F8F8F4` — fondo interior conductor-app
- **Cream admin** `#F0F0D8` — fondo interior admin-web
- **Success** `#2E7D6B` · **Danger** `#B84B4B` · **Warning** `#C07B2A` (todos muted)

### Tipografía
- **Admin-web**: Inter (body) + Barlow Condensed 800 (títulos 34px)
- **Conductor-app**: system font + Barlow si disponible

### Cards (patrón estándar)
- `background: #FFFFFF`
- `border: 1px solid rgba(13,36,51,0.06-0.08)`
- `box-shadow: 0 2px 8px rgba(13,36,51,0.08), 0 8px 24px rgba(13,36,51,0.05)`
- `border-radius: 14-16px`

### Iconos
- **Admin-web**: lucide-react — strokeWidth 2.2 (inactivo) / 2.6 (activo)
- **Conductor-app**: @expo/vector-icons Ionicons — size 24, inactivo `rgba(255,255,255,0.68)`

---

## 🟡 BUGS CONOCIDOS

### 1. Ruta no cierra en el origen
`optimizarRuta()` en RutaContext no incluye la empresa como destino final.
El camión sale del primer cliente pero el algoritmo no considera el retorno → orden subóptimo.
**Fix**: incluir dirección empresa como `destination` fijo en la llamada a Google Maps Directions API.
**No bloqueante para operación.**

### 2. PDF — logo empresa no conectado
El flujo de cobro genera y envía PDF ✅ pero `empresaData.logoUrl` no se inyecta en el HTML todavía.
**Fix**: leer `logoUrl` en CobroScreen y pasar `templateEmpresa: { logo: logoUrl }` a `generarPDF()`.

### 3. Chatbot — empresa nueva
No probado con empresa sin datos históricos de transacciones.
**Decisión**: no se aborda en este sprint.

---

## 🟡 CONFIGURACIÓN PENDIENTE

### Google Sign-In: Android
SHA-1 fingerprint requerido en Google Cloud Console para Play Store.
Para Expo Go funciona sin esto.

### API Google Maps
No funciona en localhost (restricción de dominio).
Se activa automáticamente en Vercel.

### Borrado automático de datos
Firestore no tiene TTL nativo. Requeriría Cloud Function cron. Fuera de roadmap actual.

---

## 🟢 FUTURO (NO IMPLEMENTAR AÚN)

- [ ] Vercel deploy (admin-web) — después de PWA
- [ ] PWA (manifest.json + service worker + íconos)
- [ ] Design: OnboardingPage — estilo más tech/corporate, misma paleta
- [ ] Factor de confianza clientes 1–5 (multiplicador del valor)
- [ ] IA para optimización de clientes (orden óptimo)
- [ ] SMS recovery — descartado por costo, revisar si hay demanda real
- [ ] Patrón semanal de rutas + sugerencia "Repetir semana anterior"
- [ ] Fix retorno a depósito en optimizarRuta()
- [ ] Mejora diseño PDF + logo empresa en factura (logoUrl ya existe en Storage)
- [ ] Cloud Function de limpieza de datos (TTL)
- [ ] Rate limiting chatbot con Firestore (hoy usa Map in-memory, escala mal)

---

## 📋 COMPLETADO — HISTÓRICO

### Sesión 2026-04-29
**Fixes prioridad media/baja (sprint 2)**
- ✅ HUECO-03: Ruta se marca 'completada' automáticamente al cerrar última parada (SyncService)
- ✅ ADMIN-01: precioBase por producto + botón "Aplicar a todos los clientes" (ProductosPage)
- ✅ ADMIN-02: Dashboard muestra nombres de productos (lookup correcto, DashboardPage)
- ✅ ADMIN-03: ZonasPage botón "Eliminar ruta" + confirmación ⚠️ roja
- ✅ ADMIN-05: AnalisisPage botón "Personalizado" con date pickers inicio/fin
- ✅ BUG-03: Inventario descuenta también devoluciones tipo 'devuelto' (RutaContext)
- ✅ UX-01: CobroScreen muestra "Total en cuenta" cuando pago es $0
- ✅ UX-02: handleOptimizar muestra Alert de éxito o fallo (RutaDelDiaScreen)
- ✅ UX-03: "Ver ruta completa" usa lat/lng cuando disponible, no texto (RutaDelDiaScreen)
- ✅ HUECO-05: exportContabilidad incluye ventas a crédito ($0 cobrado) y pasivos (GestionPage)

**Auditoría crítica: 7 bugs fixes + 1 security hardening**
- ✅ BUG-01: Deuda del cliente actualiza en Firestore post-visita (SyncService)
- ✅ BUG-02: Formas de pago cuadre — alinear efectivo/transferencia/empresa (CuadrePage)
- ✅ HUECO-01: Garrafones vacíos — input UI en CobroScreen + propagación RutaContext
- ✅ HUECO-02: Foto cliente — Firebase Storage upload + Firestore persist (ClientePerfilScreen)
- ✅ HUECO-04: Chatbot — HttpsError serialización correcta + validaciones respuesta (Cloud Function)
- ✅ ADMIN-06: Desactivar conductor — new Cloud Function `desactivarConductor` + reasignación (GestionPage + Auth)
- ✅ SEC-01: Multi-tenant isolation — empresaId filters en Firestore rules (6 colecciones) + RutaContext query
- ✅ Deploy: `functions:chatbotProcesarConsulta`, `functions:desactivarConductor`, `firestore:rules` ✓

**Antes:**
- ✅ Teléfono conductor — campo opcional en Onboarding paso 4 + GestionPage (crear/reasignar)
- ✅ Botón WhatsApp 📱 en tabla GestionPage → `wa.me/{telefono}`
- ✅ Conductor ve su teléfono en PerfilScreen (read-only)
- ✅ Deploy `crearConductor` actualizado con soporte `telefono`

### Sesión 2026-04-28
- ✅ Cloud Function `crearConductor` — Admin SDK (no cierra sesión admin)
- ✅ Onboarding: Google Sign-In paso 3, conductor primero en paso 4
- ✅ Foto del cliente — upload Firebase Storage, preview en modal
- ✅ Exportar CSV CuadrePage — detalle por camión + totales
- ✅ Chatbot fix fecha — comparación string `fecha >= "YYYY-MM-DD"` + desglose gastos
- ✅ Perfil admin — `/admin/perfil`, edita nombre/wap, cambia password, detecta provider correcto
- ✅ firestore.rules — self-update `usuarios` con guards anti-escalación (deployado)
- ✅ storage.rules — `clientes/{id}/foto.jpg` accesible (deployado)

### Infraestructura
- ✅ Node 22 — migración y deploy
- ✅ Firestore rules — read abierto a authed() para todas las colecciones operativas
- ✅ Storage rules — logos, transferencias y comprobantes de transacciones
- ✅ Chatbot Claude — Admin SDK v12, deployado en Cloud Functions

### Auth & Onboarding
- ✅ Onboarding — NIT opcional, WhatsApp selector 21 LATAM, toggle contraseña, adminUid
- ✅ LoginPage admin — toggle, recuperar contraseña, Google Sign-In
- ✅ LoginScreen conductor — toggle, recuperar contraseña
- ✅ Google Sign-In nombre cambiado a "RutaApp"

### Features operativos
- ✅ Logos — upload desde GestionPage, visible en login/sidebar/onboarding (ambas apps)
- ✅ Asignación de clientes a rutas — modal ZonasPage con checkboxes + inventario inicial
- ✅ Flujo conductor sin ruta — RutaDelDiaScreen mensaje "Sin ruta asignada"
- ✅ Exportar datos (4 CSV) — transacciones, cuentas por cobrar, rendimiento, contabilidad
- ✅ PDF comprobante — generación y envío WhatsApp desde CobroScreen
- ✅ Firebase PDF permissions fix — firestore.rules + storage.rules

### Análisis IA
- ✅ AnalisisPage + GestionPage — umbrales configurables, semáforo conductores y clientes
- ✅ Límite de crédito por cliente — campo `limiteDeuda` en ClientesPage; override manual del semáforo

### Diseño
- ✅ Admin-web: 22 CSS swapped — sidebar navy, login navy, Inter, Barlow 34px/800
- ✅ Conductor-app: theme.js central + LoginScreen navy
- ✅ Conductor-app: todos los screens (RutaDelDia, Inventario, ClientePerfil, Devolver, Perfil, Cobro) — headers navy, fondo #F8F8F4, cards con shadow, CTAs teal
- ✅ Iconos admin-web: lucide-react (strokeWidth 2.2/2.6)
- ✅ Tab bar conductor: Ionicons navy + teal, size 24, inactivo 68% opacidad
- ✅ Visual weight: sombra doble, border rgba suave, padding 28px, radius 16px

---

## 📧 EMAIL CONFIGURATION — Guía de setup (2026-05-04)

### Estado actual
- ✅ `analisisIASemanal` — lunes 6:00 AM UTC, envía resumen semanal
- ✅ `resumenMensual` — día 1 cada mes 7:00 AM UTC, envía resumen mensual
- ✅ Cloud Scheduler activo y ejecutando
- ✅ Secrets configurados: `EMAIL_USER`, `EMAIL_PASS`, `ANTHROPIC_API_KEY`

### Proceso de configuración (si necesitas replicar)

**Paso 1: Crear cuenta Gmail para envíos**
```
Email: soporte.rutaapp@gmail.com (o tu email)
```

**Paso 2: Configurar App Password en Google Account**
1. Entra: https://myaccount.google.com/apppasswords
2. Selecciona: Mail / Windows Computer
3. Google genera 16 caracteres (ej: `abcd efgh ijkl mnop`)
4. **IMPORTANTE:** Copiar SIN espacios: `abcdefghijklmnop`

**Paso 3: Crear secrets en Firebase Cloud Secret Manager**
```bash
firebase functions:secrets:set EMAIL_USER
# Ingresa: soporte.rutaapp@gmail.com

firebase functions:secrets:set EMAIL_PASS
# Ingresa: abcdefghijklmnop (sin espacios)

firebase functions:secrets:set ANTHROPIC_API_KEY
# Ingresa: tu API key de Anthropic
```

**Paso 4: Deploy de Cloud Functions con secrets**
```bash
firebase deploy --only functions:analisisIASemanal,functions:resumenMensual
```

Cloud Scheduler se crea automáticamente:
- `firebase-schedule-analisisIASemanal-us-central1` (cron: `0 6 * * 1`)
- `firebase-schedule-resumenMensual-us-central1` (cron: `0 7 1 * *`)

### Troubleshooting

**Problema: "Invalid login: 535-5.7.8 Username and Password not accepted"**
- ✗ Significa credenciales incorrectas
- ✓ Solución: Generar nuevo App Password en https://myaccount.google.com/apppasswords
- ✓ Actualizar secret: `firebase functions:secrets:set EMAIL_PASS`

**Problema: Email no se envía pero función ejecuta ok**
- ✓ Revisa Cloud Functions logs: busca `[email]` 
- ✓ Si ve `EMAIL_USER/EMAIL_PASS no configurados` → secrets no existen
- ✓ Si ejecuta pero no ve `[email] Resumen enviado` → check si existe resumen para esa semana (anti-duplicados)

**Limpiar resúmenes duplicados** (si quieres re-procesar una semana)
```
Firestore → analisisSemanal → borrar doc con `{empresaId}_{semanaISO}`
Luego: Force Run el Cloud Scheduler job
```

### Emails que se envían

1. **analisisIASemanal (semanal)**
   - A: todos los admins de cada empresa
   - Asunto: `Resumen semanal {nombreEmpresa} — 2026-W19`
   - Contenido: KPIs, conductores, deudas, alertas, análisis IA
   - Trigger: lunes 6:00 AM UTC (configurable en onSchedule)

2. **resumenMensual (mensual)**
   - A: todos los admins de cada empresa
   - Asunto: `Resumen mensual {nombreEmpresa} — {mesLabel}`
   - Contenido: métricas card, top clientes, análisis IA profundo
   - Trigger: día 1 cada mes 7:00 AM UTC

### Logs y monitoreo

- **Cloud Scheduler logs**: Google Cloud Console → Cloud Scheduler → click job → ver execution history
- **Cloud Functions logs**: Google Cloud Console → Cloud Functions → click función → LOGS
- **Búsquedas útiles en logs**:
  - `[analisisIASemanal]` — líneas de ejecución semanal
  - `[email]` — intentos de envío (✅ enviado o ❌ error)
  - `Ya existe resumen` — significa que ya procesó esa semana (anti-duplicados)

---

---

## 📝 SESIÓN 2026-05-04: Email setup — Resumen de aprendizaje

**Problema encontrado:**
- Cloud Functions `analisisIASemanal` y `resumenMensual` estaban deployadas pero NO enviaban emails
- Logs mostraban: "Ya existe resumen para semana 2026-W19" (anti-duplicados activados)
- Al intentar enviar: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Diagnóstico:**
1. Secrets `EMAIL_USER` y `EMAIL_PASS` EXISTÍAN pero credenciales eran incorrectas
2. App Password tenía caracteres/espacios malformados
3. Función tenía lógica anti-duplicados: si ya procesó una semana, NO vuelve a procesar (así evita duplicados)

**Solución aplicada:**
1. Creamos función de prueba `testEmailHttp` para verificar credenciales
2. Regeneramos App Password en Google Account (sin espacios)
3. Actualizamos secret `EMAIL_PASS` con Firebase CLI
4. Firebase re-deployó automáticamente las 4 funciones que usan ese secret
5. Probamos que email funciona con `testEmailHttp` ✅
6. Borramos documentos `analisisSemanal_{empresaId}_2026-W19` (6 docs) de Firestore
7. Ejecutamos `analisisIASemanal` nuevamente y emails llegaron ✅

**Lecciones aprendidas:**
- App Passwords de Gmail deben copiarse SIN espacios (Google los genera con espacios por legibilidad)
- Firebase v2 Cloud Functions requieren declarar `secrets: [...]` en el `onSchedule` para que `process.env` los reciba
- Lógica anti-duplicados es buena (evita spam) pero requiere limpiar docs viejos para re-procesar
- Función de prueba (testEmailHttp) fue crítica para diagnosticar credenciales vs lógica

**Funciones limpias:**
- Eliminadas: `testEmail` y `testEmailHttp` (eran solo para debug)
- Mantienen: `analisisIASemanal`, `resumenMensual`, `chatbotProcesarConsulta`, `crearConductor`, `desactivarConductor`

---

## 🔑 REFERENCIA RÁPIDA

```bash
# Correr admin-web
cd admin-web && npm run dev      # → http://localhost:5173

# Deploy rules Firebase
firebase deploy --only firestore:rules,storage

# Deploy completo
firebase deploy

# Deploy solo funciones (útil si cambias secrets)
firebase deploy --only functions:analisisIASemanal,functions:resumenMensual

# Ver logs de una función
firebase functions:log --region us-central1 --limit 100
```

### limiteDeuda = 0
Significa "sin límite manual". El sistema calcula automáticamente basándose en:
promedio compra mensual × % histórico de pagos × factor antigüedad.
Clientes nuevos o sin historial → límite bajo → semáforo rojo aunque deuda sea pequeña.
Para clientes de confianza: poner valor manual (ej. $500.000) → semáforo correcto.
