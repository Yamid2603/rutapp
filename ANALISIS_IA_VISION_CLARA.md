# 📊 RUTAAPP - ANÁLISIS IA: VISIÓN CLARA

## 🎯 PARTE 1: ¿QUÉ QUEREMOS HACER?

RutaApp es una **plataforma de decisiones para distribuidoras**, no solo un "tracker de ventas".

```
ANTES (Lo que ya tenemos):
├─ Control de operaciones (app conductor)
├─ Rastreo en tiempo real (admin web)
├─ Sincronización offline
└─ Registro de transacciones

AHORA (Lo que añadimos):
└─ IA que interpreta datos y recomienda acciones
```

---

## 🧮 PARTE 2: CONTADOR vs ANÁLISIS IA

### **CONTADOR (Simple, determinista)**

**¿Qué hace?**
- Lee transacciones
- Suma/resta/cuenta
- Devuelve números

**Ejemplo:**
```
Input: 30 días de transacciones
↓
Cálculo: SUM(vendido) - SUM(gastos)
↓
Output: "Ganancia: $420,000"
```

**Dónde va:** Dashboard principal (Lo primero que ve el admin)

**Limitaciones:**
- No ve patrones
- No predice
- No recomienda
- Cualquier app puede hacerlo (commodity)

---

### **ANÁLISIS IA (Complejo, patrones + recomendaciones)**

**¿Qué hace?**
- Lee transacciones históricas
- Busca patrones multidimensionales
- Predice y recomienda

**Ejemplo:**
```
Input: 90 días de transacciones
↓
Análisis: 
  - Conductor X: eficiencia 40% menor que promedio
  - Zona Sur: 3x más rentable que Zona Norte
  - Cliente Y: deuda subiendo, riesgo alto
  - Cliente Z: puede comprar 50% más
↓
Output: 
  "RECOMENDACIÓN: Enfócate en Zona Sur. 
   Negocia con Conductor X. Ofrece crédito a Cliente Z."
```

**Dónde va:** Sección nueva "Análisis" (búsqueda específica)

**Ventajas:**
- Ve lo que no es obvio
- Predice tendencias
- Recomienda acciones
- Diferencial competitivo

---

## 🗺️ PARTE 3: ESTRUCTURA DE LA SOLUCIÓN

### **MVP FASE 1 (2-3 semanas): Eficiencia + Tendencias**

```
INPUT: Transacciones últimos 30 días

ANÁLISIS 1: EFICIENCIA DE CONDUCTOR
├─ Tiempo promedio por parada
├─ Gastos del día
├─ Ratio cobrado vs vendido
├─ Tendencia últimos 7/30 días
└─ ALERTA si anomalía

ANÁLISIS 2: DESGLOSE DE GASTOS
├─ Dónde se gasta más
├─ Por conductor
├─ Por día
└─ Comparar vs promedio

ANÁLISIS 3: TENDENCIAS (SIMPLE)
├─ Vendita subiendo/bajando
├─ Deuda subiendo/bajando
└─ Clientes nuevos vs perdidos
```

---

### **FASE 2 (Semana 4): Gestión de Riesgo**

```
INPUT: Histórico de clientes (últimos 90 días)

ANÁLISIS 4: RIESGO CREDITICIO
├─ Deuda total por cliente
├─ % cobrado históricamente
├─ LÍMITE RECOMENDADO (máximo a prestar)
├─ ALERTA si se acerca al límite
└─ RECOMENDACIÓN: "Cobrar antes de vender"
```

---

### **FASE 3 (Semana 5+): Patrones de Venta**

```
INPUT: Histórico de ventas + clientes

ANÁLISIS 5: OPORTUNIDADES DE VENTA
├─ Cliente X compra menos cada mes (RIESGO)
├─ Cliente Y puede comprar 50% más (OPORTUNIDAD)
├─ Producto Z tiene demanda creciente
└─ RECOMENDACIÓN: "Enfócate en clientes X, Y, Z"
```

---

## 🎨 PARTE 4: ¿DÓNDE VA CADA COSA EN EL ADMIN?

```
admin-web/
├─ Dashboard (Lo primero que ve)
│  ├─ CONTADOR: Ganancia neta del mes
│  ├─ CONTADOR: Total conductores activos
│  └─ CONTADOR: Deuda vigente
│
├─ Clientes
├─ Productos
├─ Cuadre
├─ Zonas
├─ Gestión
│
└─ ANÁLISIS ← NUEVO (Sección dedicada)
   ├─ Eficiencia de Conductores
   │  ├─ Tabla: Cada conductor
   │  │  ├─ Tiempo promedio por parada
   │  │  ├─ Gastos
   │  │  ├─ Ratio cobrado/vendido
   │  │  ├─ Gráfica: Tendencia 30 días
   │  │  └─ ALERTA si anomalía
   │  └─ Gráfica comparativa todos conductores
   │
   ├─ Desglose de Gastos
   │  ├─ Tabla: Por conductor
   │  ├─ Gráfica: Tendencia gastos
   │  └─ Categorías (combustible, comida, devoluciones)
   │
   ├─ Riesgo Crediticio
   │  ├─ Tabla: Clientes ordenados por riesgo
   │  │  ├─ Deuda actual
   │  │  ├─ % cobrado histórico
   │  │  ├─ Límite recomendado
   │  │  └─ ALERTA si se acerca
   │  └─ Gráfica: Deuda por cliente
   │
   └─ Oportunidades de Venta
      ├─ Tabla: Clientes riesgo (compran menos)
      ├─ Tabla: Clientes oportunidad (pueden comprar más)
      ├─ Gráfica: Tendencia de clientes
      └─ RECOMENDACIÓN por cliente
```

---

## 📥 PARTE 5: QUÉ ENTRA, QUÉ SALE

### **ENTRADA (Data que usamos):**

```
Colección: transacciones (creada en offline sync)
├─ empresaId
├─ conductorId
├─ clienteId
├─ fecha, hora
├─ cantidades (productos vendidos)
├─ totalVenta
├─ totalCobrado
├─ formaPago
├─ deuda (deudaAnterior + deudaResultante)
└─ createdAt

Colección: clientes
├─ id, empresaId
├─ nombre, zona
├─ preciosCliente
├─ deuda
├─ historialCompras (últimos N días)
└─ createdAt

Colección: rutas (ya existe)
└─ gastos (combustible, comida, devoluciones)
```

### **SALIDA (Qué calculamos):**

```
ANÁLISIS 1: EFICIENCIA
├─ Tiempo promedio por parada: 30 min (industria: 25 min)
├─ Gastos promedio: $25k (rango: $15k-$40k)
├─ Ratio cobrado/vendido: 80% (sano: 75-95%)
├─ Tendencia: ↑ subiendo últimos 7 días
└─ Status: ⚠️ REVISAR (gastos anormales)

ANÁLISIS 2: RIESGO CREDITICIO
├─ Cliente A: Deuda $50k, paga 90% histórico
│  └─ LÍMITE: Puedes prestar hasta $150k
├─ Cliente B: Deuda $30k, paga 40% histórico
│  └─ LÍMITE: Reduce a $40k (RIESGO ALTO)
└─ Cliente C: Deuda $0, paga 100%
   └─ LÍMITE: Puedes prestar hasta $200k

ANÁLISIS 3: OPORTUNIDAD VENTA
├─ Cliente X: Compraba $10k/mes, ahora $5k ↓
│  └─ ACCIÓN: Contacta, ofrecen descuento
├─ Cliente Y: Compraba $5k/mes, ahora $8k ↑
│  └─ ACCIÓN: Ofrecen mayor límite de crédito
└─ Producto Z: Demanda +30% últimos 30 días
   └─ ACCIÓN: Enfoque en Zona Sur
```

---

## 🔄 PARTE 6: FLUJO DE DATOS

```
1. Conductor vende en app
   ↓
2. Transacción se sincroniza a colección "transacciones"
   ↓
3. Cada noche: Script de análisis corre
   ├─ Lee transacciones últimos 30 días
   ├─ Lee datos de clientes
   ├─ Calcula métricas
   └─ Guarda en colección "analisis" (Firestore)
   ↓
4. Admin abre sección "Análisis"
   ↓
5. Admin ve:
   ├─ Tablas con métricas
   ├─ Gráficas con tendencias
   ├─ Alertas en rojo si hay anomalías
   └─ RECOMENDACIONES accionables
```

---

## ❓ PREGUNTAS PARA QUE PIENSES EN DETALLES

### **Sobre CONTADOR:**
- ¿Qué otros números son importantes en el dashboard?
- ¿Con qué frecuencia se actualiza? (tiempo real / diario / semanal)
- ¿Qué alertas deben aparecer automáticas?

### **Sobre ANÁLISIS:**
- ¿Quiénes acceden a la sección Análisis? (solo admin / admin + dueño)
- ¿Con qué frecuencia se actualiza? (nightly / weekly / monthly)
- ¿Qué significa "anomalía"? (define umbrales)
  - ¿Conductor ineficiente a qué punto? (50% slower? 100% slower?)
  - ¿Gastos anormales a partir de cuánto? (doble del promedio?)

### **Sobre RIESGO CREDITICIO:**
- ¿Cómo calculas el "límite recomendado"?
  - Opción A: % del promedio de clientes similares
  - Opción B: Basado en histórico de pago (si paga 80%, máximo = 5x deuda actual)
  - Opción C: Basado en antigüedad (clientes nuevos = límite bajo)

### **Sobre OPORTUNIDADES:**
- ¿Cómo defino "cliente riesgo" vs "cliente oportunidad"?
  - Riesgo: ↓ compra menos cada mes
  - Oportunidad: ↑ compra más cada mes O compra poco pero paga bien

### **Sobre UI/UX:**
- ¿Qué ves primero en "Análisis"? (resumen o detalles)
- ¿Puedes filtrar por: zona / conductor / período?
- ¿Descargar como PDF o Excel?

---

## 🎯 PRÓXIMO PASO

**Una vez que pienses en los detalles anteriores:**

1. Define cada métrica exactamente
2. Define umbrales para alertas
3. Define cálculos para "límite recomendado"
4. Define UI/UX de cada sección

**Luego:** Pasamos a Claude Code para implementar.

