# RutaApp — Manifesto v4
**Fecha:** Mayo 2026
**Versión:** 4.0 — Producción lista para lanzamiento

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
│       ├── components/     # EditarVisitaModal, ChatbotPanel, PieChart
│       └── config/
├── functions/
│   ├── index.js
│   ├── analisisIA-semanal.js
│   ├── resumenMensual.js
│   ├── chatbot-procesarConsulta.js
│   ├── sugerenciasRuta.js   # IA prioridades por cliente ✅
│   ├── crearConductor.js
│   └── desactivarConductor.js
├── firestore.rules
├── firestore.indexes.json   # índices compuestos ✅
├── storage.rules
└── firebase.json
```

---

## 4. Modelo de datos (Firestore)

### `empresas/{empresaId}`
```
nombre, nit?, telefono?, ciudad?,
logoUrl?,
contadorRemisiones: number,   # auto-incrementado con runTransaction por cada PDF
rutaDesdeEmpresa?: boolean,
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
deuda: number,               # siempre >= 0 (nunca negativo)
preciosCliente: { productoId: precio },
pedidoUsual: { productoId: qty },
notas?, notaConductor?,
fotoUrl?,
limiteDeuda?: number,
empresaId
```

### `productos/{id}`
```
nombre, emoji, empresaId,
precioBase?: number,
retornable: boolean
```

### `rutas/{id}`
```
fecha, conductorId, camionId, empresaId,
estado: 'activa' | 'completada',
paradas: [
  {
    id, orden, clienteId,
    estado: 'pendiente' | 'visitado' | 'cerrado',
    cantidades: { productoId: qty },
    totalVenta, totalCobrado, formaPago,
    deudaAnterior, deudaResultante,   # ambos >= 0
    recogidaInventario: { productoId: qty },
    fechaVisita?,
    numeroRemision?,
  }
],
inventarioInicial: { productoId: qty },
gastos: [{ id, tipo, valor, hora }],
devoluciones: [{ id, tipo, productoId, cantidad, fotoUri?, hora }],
ordenOptimizado?: boolean,
deleted?: boolean, deletedAt?, deletedBy?
```

### `transacciones/{id}`
```
empresaId, rutaId, conductorId, clienteId,
fecha, hora, cantidades,
totalVenta, totalCobrado, formaPago,
deudaAnterior, deudaResultante,     # ambos >= 0
comprobanteTransferencia?,
tipo?: 'ajuste',
cantidadesAnterior?, totalVentaAnterior?, totalCobradoAnterior?,
estado: 'completada'
```
*Inmutables. Correcciones crean doc nuevo `tipo: 'ajuste'` — original nunca se toca.*

### `historialCliente/{id}`
```
clienteId, empresaId, rutaId, fecha,
cantidades, totalVenta, totalCobrado,
formaPago, deudaAnterior, deudaResultante
```

### `analisisSemanal/{id}` / `resumenMensual/{empresaId_mesKey}`
Solo Cloud Functions escriben. Admins leen.

### `chatbotRateLimit/{userId_hourKey}`
Solo Admin SDK escribe. Rate limit: 20 consultas/hora.

---

## 5. App conductor (React Native)

### Autenticación
- Email + password Firebase Auth
- Recuperación de contraseña por email

### Flujo del día

**RutaDelDiaScreen**
- Si admin creó ruta → se muestra directamente
- Si no → "Iniciar mi día": conductor selecciona clientes (sugeridos de última ruta) + ingresa inventario inicial
- `SugerenciasIAPanel`: toggle activable, llama Cloud Function `sugerenciasRuta`, muestra cards de prioridad por cliente (rojo/amarillo/verde) con razón corta. Persiste toggle en AsyncStorage.
- Buscador de clientes al armar la ruta (filtra por nombre y dirección)
- FAB para agregar paradas urgentes (AgregarParadaModal con buscador + ya visitados en rojo)
- Permite agregar el mismo cliente dos veces (doble factura para correcciones)
- Botón "Ver ruta en mapa" → Google Maps nativo

**AgregarParadaModal**
- Buscador por nombre/dirección
- Clientes ya visitados aparecen en rojo con badge "Ya visitado" (pero se pueden agregar igual)
- Permite duplicados para flujo de corrección de facturas

**ClientePerfilScreen**
- Foto cliente, deuda actual, botón WhatsApp, notas conductor
- Historial últimas visitas (30 días) — requiere `empresaId` en query
- Si cliente ya fue visitado: botón verde "Reenviar comprobante" (regenera PDF y comparte)
- Si pendiente: botón normal "Cobrar"

**CobroScreen**
- Cantidades por producto, total en tiempo real
- Forma de pago: efectivo / transferencia / empresa
- Comprobante foto (transferencia) → Storage
- Sección "Recogida de inventario" para productos `retornable: true`
- Al cerrar: `runTransaction` incrementa `contadorRemisiones` en empresa, descarga logo como base64, genera PDF, cierra visita

**PerfilScreen**
- Iniciales del conductor en avatar (no emoji)
- Info del conductor en card (rol badge, correo, camión, teléfono)
- Sección DEV: limpiar cola sync + seed datos (solo en Expo Go, oculto en APK)

**CierreRutaModal**
- Cobrado, vendido, por cobrar, gastos, neto
- Por forma de pago
- **Despacho del día**: por producto — cargado / despachado / quedan (negativo en rojo si hay doble visita sin corregir)
- Inventario recogido (retornables)

### Offline sync
Cola FIFO en AsyncStorage. Operaciones: CERRAR_VISITA, MARCAR_CERRADO, AGREGAR_GASTO, AGREGAR_DEVOLUCION, AGREGAR_PARADA, OPTIMIZAR_RUTA. Sincroniza automáticamente al recuperar conexión. Hasta 5 reintentos.

### PDF — generarPDF.js
**Parámetros:** `empresaNombre, nit, telefonoEmpresa, ciudadEmpresa, logoUrl (base64), numeroRemision, cliente, productos, cantidades, totalVenta, totalCobrado, formaPago, deudaAnterior, deudaResultante, fecha`

**Diseño (Mayo 2026):**
- Fondo gris, tarjeta blanca con borde `#CBD5E1`
- Título "Remisión de Venta" 34px bold navy, sin banding
- N° consecutivo y fecha debajo del título
- Logo/empresa en caja bordeada esquina superior derecha
- Tabla con doble línea navy en header (sin fondo), filas alternadas
- Totales a la derecha (45% ancho): compra, deuda anterior, recibido + caja navy final
- Caja final: "DEUDA PENDIENTE $X" o "CUENTA EN CERO ✓"
- Sin "Saldo a favor" — conductor siempre da vueltas en efectivo
- Footer 2 columnas: datos empresa | Generado por RutaApp
- Disclaimer DIAN en italics

**Lógica deuda:**
- `deudaResultante = Math.max(0, deudaAnterior + totalVenta - totalCobrado)`
- Nunca negativo — clamped en RutaContext Y SyncService (dos lugares)

### Inventario
- `inventarioDisponible` calculado en RutaContext pero NO bloquea nada
- Puede mostrarse negativo si hay doble visita (factura corregida)
- CierreRutaModal avisa "Hay diferencia — admin debe ajustar"
- Workflow corrección: admin edita visita mala desde admin-web (pone cantidades={}, totalCobrado=0)

---

## 6. Panel admin web (React + PWA)

### PWA ✅ (Mayo 2026)
- `public/manifest.json`: name, short_name, theme_color #0D2433, display standalone
- `public/sw.js`: cache-first para shell, red-first para Firebase/googleapis
- `index.html`: meta tags PWA + SW registration inline
- Instalable en Android/iOS como app desde el navegador

### Páginas

**Dashboard** (`/admin`)
- KPIs del día, gráfica semanal, top 5 productos, mapa camiones

**Clientes** (`/admin/clientes`)
- Tabla + modal edición + precios por producto + límite crédito + semáforo riesgo

**Cuadre del día** (`/admin/cuadre`)
- Vista día/semana/mes por camión
- Lista paradas individuales + EditarVisitaModal (corrección con audit trail)
- Exportar CSV

**Zonas & Carga** (`/admin/zonas`)
- Gestión rutas semanales, soft-delete

**Gestión** (`/admin/gestion`)
- Crear/reasignar conductores, exportar CSV contabilidad

**Análisis IA** (`/admin/analisis`)
- 5 secciones + semáforos + umbrales editables + Chatbot flotante

**Perfil** (`/admin/perfil`)

**Onboarding** (`/onboarding`)
- 5 pasos: Bienvenida → Empresa → Admin → Producto+Conductor → Confirmación

---

## 7. Cloud Functions

| Función | Tipo | Modelo IA | Descripción |
|---|---|---|---|
| `analisisIASemanal` | scheduled lunes 6am | Claude Haiku 4.5 | Análisis + email HTML admins |
| `resumenMensual` | scheduled día 1 7am | Claude Haiku 4.5 | Resumen mes + email |
| `chatbotProcesarConsulta` | callable HTTPS | Claude Haiku 4.5 | Rate limit 20/hora Firestore runTransaction |
| `sugerenciasRuta` | callable HTTPS | Claude Haiku 4.5 | Prioridades por cliente (alta/media/baja + razón) |
| `crearConductor` | callable HTTPS | — | Admin SDK sin cerrar sesión admin |
| `desactivarConductor` | callable HTTPS | — | Auth disabled + revokeRefreshTokens |

Todos usan `secrets: ['ANTHROPIC_API_KEY', 'EMAIL_USER', 'EMAIL_PASS']` donde aplica.

---

## 8. Seguridad

### Firestore Rules
- Multi-tenant: `empresaId == myEmpresaId()` en toda operación
- `allow delete: if false` en todas las colecciones operativas
- Transacciones inmutables: `allow update, delete: if false`
- Empresa: conductor puede update SOLO si `affectedKeys().hasOnly(['contadorRemisiones'])`
- Rutas: conductor puede create y update (crea su propia ruta si admin no la creó)
- Índices compuestos: rutas(empresaId+fecha), historialCliente(empresaId+clienteId)

### Backup
- GCP Firestore Backup: daily, retención 30 días ✅ (activado por el usuario)

### Soft-delete
- Rutas: `updateDoc({ deleted: true, deletedAt, deletedBy })`
- Audit trail correcciones: transacción `tipo: 'ajuste'` con delta completo

---

## 9. Lógica de negocio clave

### Deuda
```
deudaResultante = Math.max(0, deudaAnterior + totalVenta - totalCobrado)
```
Siempre >= 0. Conductor siempre da vueltas. Sin "crédito a favor" ni "saldo a favor".

### Precios
Cada cliente tiene `preciosCliente: { productoId: precio }` — individual, no listas A/B/C.

### Inventario retornable
`retornable: true` en producto → aparece en "Recogida" del cobro → `recogidaInventario` en parada → sumado en CuadrePage.

### Consecutivo de remisiones
`contadorRemisiones` en empresa, incrementado con `runTransaction` desde CobroScreen. Formato: `N° 00001`.

### Corrección de facturas (workflow)
1. Conductor agrega cliente dos veces (AgregarParadaModal permite duplicados)
2. Hace factura correcta en segunda visita
3. Admin entra a CuadrePage → EditarVisitaModal → corrige cantidades y cobrado de la visita mala
4. Conductor ve diferencia en CierreRutaModal hasta que recarga la app

---

## 10. Deployment

### Admin-web (PWA + Firebase Hosting)
```bash
cd admin-web && npm run build
firebase deploy --only hosting
# → https://rutapp-cfa16.web.app
```

### Cloud Functions
```bash
firebase deploy --only functions:sugerenciasRuta
firebase deploy --only functions:chatbotProcesarConsulta
# Secrets ya configurados en Secret Manager
```

### Rules + Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Conductor app — EAS Build
```bash
# APK preview (distribuir directo):
cd conductor-app
npx eas-cli build --platform android --profile preview

# AAB producción (Play Store):
npx eas-cli build --platform android --profile production
```

---

## 11. Pendientes de operación

| Tarea | Estado | Cómo |
|-------|--------|------|
| GCP Backup Firestore | ✅ Activo | daily, 30 días |
| PWA admin-web | ✅ Implementado | manifest + sw + index.html |
| EAS Build APK | ⏳ Pendiente | `npx eas-cli build --platform android --profile preview` |
| SHA-1 Google Sign-In | ⏳ Al publicar | Extraer del keystore post-EAS Build → Firebase Console → Auth → Google |
| EditarVisitaModal "Anular venta" | ⏳ Pendiente | Botón que pone cantidades={}, totalCobrado=0 para corrección inventario |

---

## 12. Empresa piloto

**Distribuidora de Agua El Manantial**
- Productos: Garrafón 18.9L, Bolsa 6L, Paquete Bolsa 350ml×4, Garrafón 5L
- Todos los garrafones: `retornable: true`
- Seed: `runSeed(conductorUid, empresaId, onLog)` desde PerfilScreen en Expo Go

---

## 13. Histórico de implementación

| Sprint | Fecha | Alcance |
|--------|-------|---------|
| Base | Mar 2026 | Auth, pantallas conductor, Firestore, panel admin, Maps, ubicación cliente |
| Fase 7 | Abr 9-10 | Análisis IA backend + Cloud Functions |
| Fase 8 | Abr 13 | Chatbot, umbrales editables, Onboarding 5 pasos |
| Fase 9-10 | Abr 22 | Logos, Google Sign-In, WhatsApp+país, NIT, Firestore rules, Node 22 |
| Diseño | Abr 23 | Inter+Lucide+Ionicons, conductor-app 100% temado, limiteDeuda |
| Sprint bugs 1-2 | Abr 28-29 | 24 fixes (deuda, formas de pago, aislamiento multi-tenant, foto cliente, CSV, etc.) |
| Sprint 3 + Seguridad | Abr 30 | Conductor crea ruta, email semanal/mensual, delete rules, soft-delete, corrección visitas, rate limiter atómico |
| Sprint 4 | Abr 30 | Llamar cliente, notas, historial 30 días, pie chart, modal cierre ruta, emoji cleanup |
| Sprint 5 | May 2026 | SugerenciasIA, PDF profesional con consecutivo, selector país teléfono, buscador paradas, visitados en rojo, colores blancos, deuda >= 0, inventario CierreModal, PWA admin-web, Firestore rules conductor |

---

*RutaApp v4 — Sistema completo de distribución de rutas con IA, remisiones numeradas, PWA y seguridad multi-tenant.*
