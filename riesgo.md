# Riesgo: Sprint 4 — UI Limpieza + Gráficos + Features

**Estado:** ✅ COMPLETADO  
**Fecha:** 2026-04-30  
**Modelo:** Opus 4.7  

---

## ✅ TAREAS COMPLETADAS

### 1. Llamada directa al cliente (ClientePerfilScreen)
- Import de `Linking` agregado
- Botón "Llamar" en header derecho (solo si `cliente.wap1` existe)
- Acción: `Linking.openURL('tel:' + cliente.wap1)`
- Estilos `headerActions`, `btnLlamar`, `btnLlamarText` agregados

### 2. Notas rápidas por cliente (ClientePerfilScreen)
- Card "Nota del conductor" con:
  - Estado: lectura → muestra `cliente.notaConductor` o "Sin notas"
  - Estado: edición → TextInput multiline + botones Cancelar/Guardar
- Mutación: `updateDoc(doc(db, 'clientes', id), { notaConductor, notaConductorActualizada })`
- Sin sync queue (operación simple, requires conexión)
- Estilos: `notaCard`, `notaHeader`, `notaInput`, etc.

### 3. Historial cliente últimos 30 días
- **Nuevo hook:** `conductor-app/src/hooks/useHistorialCliente.js`
- Query: `historialCliente where clienteId == X`, filtra >= hoy-30 días
- Sort por fecha descendente
- UI en ClientePerfilScreen: card "Últimas visitas (30 días)"
- Muestra hasta 5 visitas: fecha, forma pago, total venta, deuda resultante (con colores)
- Estilos: `historialCard`, `historialRow`, `historialFecha`, etc.

### 4. Gráfico admin CuentasPage (DashboardPage)
- Ya existían LineChart y BarChart en el dashboard
- Verificado funcionamiento — period 'week' muestra ventas por día, 'month' por semana

### 5. Gráfico admin CuadrePage
- **Nuevo componente:** `admin-web/src/components/PieChart.jsx` (SVG nativo, sin recharts)
- Pie chart de "Distribución de pagos" con 3 segmentos:
  - Efectivo (#22C55E verde)
  - Transferencia (#1693A5 teal)
  - Empresa (#F59E0B ámbar)
- Suma totales por forma de pago en `useMemo`
- Renderizado al final de la página, después del "Resumen total"
- Empty state si total = 0

### 6. Historial fin de ruta (Cierre del día)
- **Nuevo modal:** `conductor-app/src/components/modals/CierreRutaModal.js`
- Botón "Resumen" en header de RutaDelDiaScreen — visible solo cuando `totalVisitadas === paradas.length`
- Muestra:
  - Cobrado, Vendido, Por cobrar, Gastos (cards grandes)
  - NETO (card destacada con color)
  - Paradas: visitadas/total + cerradas
  - Por forma de pago (efectivo, transferencia, empresa)
  - Inventario recogido (productos retornables)
  - Devoluciones registradas
- Estilos completos en el modal

### 7. Limpieza de emojis (UI)
**Conductor-app:**
- ClienteNuevoModal.js: ➕📍🗺️ → texto limpio
- ClientePerfilScreen.js: 💳🚫🏪📋📍📝 → quitados, kept solo en ProductBadge
- CobroScreen.js: 💵🏢📱✅📲 → quitados
- RutaDelDiaScreen.js: 📅⛽🗺️📍💳⚡➕📷🚚 → quitados; ✓ y ⊘ en getEstadoIcon
- PerfilScreen.js: 👤🗑️ → quitados
- LocationPickerSheet.js: ⏳📍 → quitados
- DevolverScreen.js: ✅📷 → quitados
- AgregarParadaModal.js: 📍💳➕ → texto limpio
- HistorialModal.js: ✅💵📱🏢 → quitados
- generarPDF.js: 📱 → quitado

**Admin-web (PowerShell sweep):**
- GestionPage.jsx: 🚛📊📋💳🏢📷 → quitados
- AnalisisPage.jsx: 📊 → quitado
- OnboardingPage.jsx: 🚛💰📊👥📷🏢 → quitados
- UbicacionPicker.jsx: 🗺️ → quitado
- ChatbotPanel.jsx: 📊 → quitado
- SeccionGastos.jsx: 💰 → quitado
- SeccionOportunidades.jsx: ✨ → quitado
- SeccionEficiencia.jsx: limpiado
- AdminDashboard.jsx: 🗺️📊 → quitados
- ZonasPage.jsx: limpiado
- CuadrePage.jsx: 🚛💵📱🏢⬇ → quitados

**MANTENIDOS (intencional):**
- ProductBadge: emojis simbólicos para productos ✅
- console.log/onLog en seedTestData.js, RutaContext.js — son logs internos
- Emojis menores no listados (🚫⏳🗂️✕)

---

## 📂 ARCHIVOS CREADOS

1. `conductor-app/src/hooks/useHistorialCliente.js` — hook lectura historial 30 días
2. `conductor-app/src/components/modals/CierreRutaModal.js` — modal resumen del día
3. `admin-web/src/components/PieChart.jsx` — pie chart SVG nativo

## 📝 ARCHIVOS MODIFICADOS

### Conductor-app:
- `src/screens/ClientePerfilScreen.js` — llamada + notas + historial visible
- `src/screens/RutaDelDiaScreen.js` — botón resumen + integración CierreRutaModal
- 8 archivos más con limpieza de emojis

### Admin-web:
- `src/pages/CuadrePage.jsx` — pie chart distribución pagos + emoji cleanup
- `src/pages/ProductosPage.jsx` — emoji "Aplicar precios"
- 11 archivos más con cleanup PowerShell

---

## ⚠️ RIESGOS / PENDIENTES POST-DEPLOY

| Riesgo | Mitigación |
|--------|-----------|
| Botón "Llamar" no funciona en iOS si formato número erróneo | Verificar con `Linking.canOpenURL()` antes |
| Notas: si offline, falla `updateDoc` | Funciona online, ok para fase 1 |
| Historial cliente: requiere read en `historialCliente` desde conductor | firestore.rules ya permite (SEC-01 ✅) |
| CierreRutaModal: cálculos pueden diferir del CuadrePage admin | Validar fórmulas son consistentes |
| Emojis menores (🚫⏳🗂️) restantes | Limpiar en próximo sprint si molestan |

---

## ✅ NO incluido (decisión del usuario)
- ❌ Foto de prueba al entregar

---

## 🚀 SIGUIENTE PASO

1. **Testing manual** en emulador (Android/iOS) de todas las features
2. **Build & deploy** admin-web (Vite) cuando se confirme funcionamiento
3. **Testing conductor-app** en device físico (Linking, Firestore writes)
4. **Deploy Firebase** rules ya aplicadas (SEC-01 ya online)
