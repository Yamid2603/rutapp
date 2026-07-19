# RutaApp — Manifesto v5
**Fecha:** Mayo 2026 (actualizado 2026-05-21)
**Versión:** 5.0 — En producción + envío automático de comprobantes WhatsApp

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
| Panel admin | React 18 + Vite + PWA |
| Backend | Firebase (Firestore, Auth, Storage, Functions v2) |
| IA | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Maps | Google Maps SDK (conductor-app + admin-web) |
| Email | Nodemailer + Gmail SMTP (App Password) |
| Build móvil | EAS Build (Expo Application Services) |
| Hosting admin | Firebase Hosting → https://rutapp-cfa16.web.app |
| Backup datos | GCP Firestore Backup — daily, retención 30 días ✅ |
| **Envío WhatsApp** | **`react-native-share` v12 (intent nativo Android)** |

**Tipografía admin-web:** Inter (cuerpo) + Barlow Condensed (títulos)

**Paleta activa (Mayo 2026):**
- Fondo conductor-app: `#FFFFFF` (blanco — arena #F0F0D8 eliminado globalmente)
- Navy: `#0D2433` (headers, sidebar, tab bar, PDF)
- Teal: `#1693A5` (acento principal) / `#4DD4E4` (activo en nav)
- Texto: `#1a1a1a`
- Bordes: `#D8D8C0` o `#E8ECF0`
- Muted: `#5a5a5a` o `#8B949E`

---

## 3. Estructura del proyecto

```
rutaapp/
├── conductor-app/
│   ├── src/
│   │   ├── context/        # AuthContext, RutaContext, SyncQueueContext
│   │   ├── screens/        # RutaDelDia, CobroScreen, ClientePerfil, Perfil
│   │   ├── components/     # Modales, SugerenciasIAPanel
│   │   ├── services/       # SyncService (offline queue FIFO)
│   │   ├── hooks/          # useHistorialCliente (requiere clienteId + empresaId)
│   │   └── utils/          # generarPDF, seedFirestore
│   └── eas.json
├── admin-web/
│   ├── public/
│   │   ├── manifest.json   # PWA ✅
│   │   ├── sw.js           # Service worker ✅
│   │   ├── logo-dark.png
│   │   └── logo-light.png
│   ├── index.html          # PWA meta tags + SW registration ✅
│   └── src/
│       ├── pages/
│       ├── components/     # EditarVisitaModal (con Anular venta), ChatbotPanel, PieChart, Sidebar
│       └── config/
├── functions/
│   ├── index.js
│   ├── analisisIA-semanal.js
│   ├── resumenMensual.js
│   ├── chatbot-procesarConsulta.js
│   ├── sugerenciasRuta.js
│   ├── crearConductor.js
│   └── desactivarConductor.js
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

---

## 4. Modelo de datos (Firestore)

Sin cambios respecto a v4. Ver v4 sección 4 para schema completo.

Resumen colecciones: `empresas`, `usuarios`, `clientes`, `productos`, `rutas`, `transacciones` (inmutables), `historialCliente`, `analisisSemanal`, `resumenMensual`, `chatbotRateLimit`.

**Clave deuda:** `deudaResultante = Math.max(0, deudaAnterior + totalVenta - totalCobrado)` — siempre ≥ 0.

---

## 5. App conductor — cambios v5

### 5.1 Envío automático de PDF por WhatsApp 🆕 ⭐
**Problema v4:** después de cobrar, el conductor tenía que abrir WhatsApp manualmente, buscar al cliente y compartir el PDF — flujo de 3-4 pasos con margen de error.

**Solución v5:**
- Librería `react-native-share` v12 instalada en conductor-app
- En `CobroScreen.js`, los bloques wap1/wap2 reemplazados por un único `Share.shareSingle({ social: WHATSAPP, whatsAppNumber, url, type: 'application/pdf', message, filename, failOnCancel:false })`
- 1 tap → abre WhatsApp directo en el chat del cliente con el PDF adjunto + mensaje del total → conductor solo confirma "Enviar"
- Fallback automático: si WhatsApp no está instalado o el intent falla (no si el usuario cancela), cae al share genérico (`Sharing.shareAsync` con `mimeType: 'application/pdf'`)
- Distingue cancelación de error real para no duplicar diálogos

### 5.2 Fix crash HistorialModal
`HistorialModal.js` crasheaba con `TypeError: Cannot convert undefined value to object` al abrir perfil de cliente en APK. Root cause: accedía a `p.precios[cliente.lista]` y `paradaHoy.cantidades[p.id]` directos, pero el modelo real usa `cliente.preciosCliente[String(productoId)]` + fallback `producto.precioBase`. Reescrito con optional chaining + helper `precioDe(p)`.

### 5.3 Fix doble código de país en WhatsApp
En `CobroScreen.js` el código limpiaba el teléfono (`replace(/\D/g, '')`) y luego siempre prepondía `57`. Como `cliente.wap1` ya guarda `+573...`, el resultado era `5757...`. Ahora: si los dígitos ya empiezan con `57`, no prepende.

### Lo demás de la app conductor sigue como v4.
Ver v4 secciones 5 completas para flujo del día, offline sync, PDF, inventario.

---

## 6. Panel admin web — cambios v5

### 6.1 EditarVisitaModal: botón "Anular venta" 🆕
Implementado en `admin-web/src/components/EditarVisitaModal.jsx` (+ `.module.css`):
- Botón "Anular esta venta" con flujo de confirmación en 2 pasos (state `confirmandoAnular`)
- `handleAnular()`: pone `cantidades:{}, totalVenta:0, totalCobrado:0, anulada:true` en la parada
- Crea transacción `tipo:'anulacion'` (audit trail inmutable)
- Recalcula `deuda` del cliente con `Math.max(0, ...)`
- CSS: `.btnAnular`, `.btnAnularConfirm`, `.anularBox`, `.anularWarning`, `.anularActions`, `.actionsRight`

### 6.2 Sidebar: link a Productos 🆕
La página `/admin/productos` existía pero el `Sidebar.jsx` no la enlazaba. Agregada entrada `{ to: '/admin/productos', Icon: Package, label: 'Productos' }`.

### 6.3 PWA admin-web ✅ confirmada en producción
- `public/manifest.json`: name, short_name, theme_color #0D2433, display standalone, icons
- `public/sw.js`: cache-first para shell estático, network-first para Firebase/googleapis
- `index.html`: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, registro inline del SW
- Instalable en Android/iOS como app desde el navegador

### Páginas (sin cambios estructurales)
Dashboard, Clientes, Cuadre del día, Zonas & Carga, Gestión, Análisis IA, Perfil, Onboarding (5 pasos).

---

## 7. Cloud Functions

Sin cambios respecto a v4.

| Función | Tipo | Modelo IA | Descripción |
|---|---|---|---|
| `analisisIASemanal` | scheduled lunes 6am | Claude Haiku 4.5 | Análisis + email HTML admins |
| `resumenMensual` | scheduled día 1 7am | Claude Haiku 4.5 | Resumen mes + email |
| `chatbotProcesarConsulta` | callable HTTPS | Claude Haiku 4.5 | Rate limit 20/hora |
| `sugerenciasRuta` | callable HTTPS | Claude Haiku 4.5 | Prioridades por cliente |
| `crearConductor` | callable HTTPS | — | Admin SDK |
| `desactivarConductor` | callable HTTPS | — | Auth disabled + revoke |

---

## 8. Seguridad

Sin cambios respecto a v4. Multi-tenant por `empresaId`, transacciones inmutables, soft-delete rutas, audit trail correcciones, backup GCP daily 30 días.

---

## 9. Bugs pendientes operativos

| Bug | Severidad | Notas |
|-----|-----------|-------|
| ~~Admin-web NO es responsive~~ | ✅ Resuelto 2026-05-21 | Sprint responsive completo: sidebar hamburguesa, tablas con scroll horizontal o cards, KPIs en 2 col, modales bottom-sheet, PWA auto-update con toast. Ver [[sesion-2026-05-21-pdf-whatsapp-responsive-pwa]]. |
| **ClientesPage admin-web sin map picker** | Media | Al crear clientes desde admin-web solo se guarda texto, no `lat/lng`. Conductor-app YA tiene mapa obligatorio. Aplicar misma lógica al modal admin-web cuando se reactive el mapa de camiones. |
| Mapa de camiones removido del Dashboard | Baja | Quitado mientras Google Maps API no está conectada bien. Reabordar cuando se quiera reactivar (requiere Maps key web + dominios autorizados). |
| Recargar créditos Anthropic | Baja | Pospuesto. Chatbot caído hasta que se recargue. |

---

## 13. Hoja de ruta UX móvil

**Contexto:** muchas distribuidoras pequeñas en Colombia no tienen PC en oficina — el dueño solo tiene celular. Admin-web actualmente NO es responsive y se ve mal en móvil.

### Paso 1 — Opción A: Sprint responsive admin-web ⭐ próximo
Hacer admin-web mobile-first respetando funcionalidad desktop.

**Referencia visual:** https://ampro-hub.vercel.app (10AMPRO BRIEFING) — dashboard denso, dark theme, todo apilado vertical, datos críticos arriba, scroll natural.

**Tareas estimadas (6-8h trabajo concentrado):**
1. CSS global con breakpoints (`@media (max-width: 768px)`)
2. Sidebar fijo → hamburguesa con overlay en móvil
3. Dashboard: KPIs 4-col → 2-col, gráficas full-width, mapa altura razonable
4. Clientes/Cuadre/Gestión: tablas → cards apiladas en móvil
5. AnálisisIA + Chatbot: ajustes menores (ya bastante responsive)
6. PWA polish: splash screen, status bar color, ícono

**Riesgo:** bajo-medio. Solo CSS, NO se toca lógica de negocio, Firebase, queries.

### Paso 2 (futuro) — Opción C: WebView admin dentro del APK
Una vez admin-web sea responsive, embeber en un WebView del APK conductor. Resultado: una sola app instalable que detecta rol (admin → WebView admin-web, conductor → pantallas nativas). 
- **Pro:** Una sola descarga para el cliente, UX unificada
- **Contra:** Sigue dependiendo de que admin-web esté online
- **Tiempo:** ~1 día tras Opción A completada

### Opción B descartada (admin nativo en React Native)
Replicar admin completo en React Native (1-2 semanas). Descartada porque duplica código y los dueños con PC pierden funcionalidad de pantalla grande.

---

---

## 10. Deployment

### Admin-web (PWA + Firebase Hosting)
```bash
cd admin-web && npm run build
firebase deploy --only hosting
# → https://rutapp-cfa16.web.app
```

### Conductor app — EAS Build (Android)
```bash
cd conductor-app
npm install                                           # ← si cambió package.json
npx eas-cli build --platform android --profile preview   # APK preview
npx eas-cli build --platform android --profile production # AAB Play Store
```

⚠️ **Tras cualquier build EAS:**
1. Descargá UN solo `.apk` del dashboard de EAS — borrá los anteriores del celular para evitar confusión de versiones
2. Desinstalá la app vieja, instalá la nueva
3. Verificá SHA-1 del keystore registrado en Firebase Console → Auth → Google Sign-In

### Cloud Functions
```bash
firebase deploy --only functions:sugerenciasRuta
firebase deploy --only functions:chatbotProcesarConsulta
```

### Rules + Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 11. Empresa piloto

**Distribuidora de Agua El Manantial**
- Productos: Garrafón 18.9L, Bolsa 6L, Paquete Bolsa 350ml×4, Garrafón 5L
- Todos los garrafones: `retornable: true`
- Seed: `runSeed(conductorUid, empresaId, onLog)` desde PerfilScreen en Expo Go

---

## 12. Histórico de implementación (extendido)

| Sprint | Fecha | Alcance |
|--------|-------|---------|
| Base | Mar 2026 | Auth, pantallas conductor, Firestore, panel admin, Maps |
| Fase 7 | Abr 9-10 | Análisis IA + Cloud Functions |
| Fase 8 | Abr 13 | Chatbot, umbrales editables, Onboarding 5 pasos |
| Fase 9-10 | Abr 22 | Logos, Google Sign-In, WhatsApp+país, NIT, Rules, Node 22 |
| Diseño | Abr 23 | Inter+Lucide+Ionicons, conductor-app temado, limiteDeuda |
| Sprint bugs 1-2 | Abr 28-29 | 24 fixes |
| Sprint 3 + Seguridad | Abr 30 | Conductor crea ruta, email semanal/mensual, soft-delete, rate limiter atómico |
| Sprint 4 | Abr 30 | Llamar cliente, notas, historial 30 días, pie chart, cierre ruta, emoji cleanup |
| Sprint 5 | May 2026 | SugerenciasIA, PDF profesional con consecutivo, selector país, deuda ≥ 0, PWA admin-web |
| **v5 — 2026-05-20/21** | **May 2026** | **APK piloto en celular real, fix HistorialModal crash, EditarVisitaModal "Anular venta", Sidebar Productos, fix doble +57, envío PDF automático WhatsApp con `react-native-share`** |

---

*RutaApp v5 — Distribución completa de rutas con IA, remisiones numeradas, PWA, envío automático de comprobantes WhatsApp y seguridad multi-tenant.*
