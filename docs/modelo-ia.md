# Modelo de IA: riesgo de incumplir el OTIF

Documentado con las seis fases de **CRISP-DM**, el proceso estándar de un proyecto de datos.

> **Los datos son simulados.** El sistema aún no tiene historial real suficiente, así que el modelo se entrena con 5.000 OT inventadas con reglas plausibles. Las métricas miden qué tan bien aprendió esas reglas, **no** cuánto acertaría en la vida real. Cuando haya historial real basta con cambiar `simulate()` por una consulta a `transport_order` y volver a entrenar (`npm run train`).

## 1. Comprensión del negocio

- **Dolor:** el indicador clave de la empresa es el **OTIF** (entregas a tiempo *y* completas). Hoy se ve **después** de que la OT falló: sirve para informar, no para evitar.
- **Pregunta:** *al crear o programar una OT, ¿qué probabilidad hay de que termine incumpliendo el OTIF?*
- **Decisión que habilita:** el despachador revisa primero las OT de mayor riesgo (asigna un camión más holgado, adelanta la salida, avisa al cliente) y prueba un plazo distinto antes de prometerlo.
- **Éxito:** detectar la mayoría de los incumplimientos revisando pocas OT, y hacerlo mejor que la respuesta ingenua de «todas cumplen».

### Por qué este objetivo y no otro

| Opción de objetivo | Veredicto |
|---|---|
| **Atraso** (versión anterior) | Se queda a medias: una OT puede llegar a tiempo pero incompleta y también cuenta como falla. No coincide con el KPI que mide la empresa |
| **Incumplir el OTIF (atrasada o incompleta)** ✅ | Es exactamente el KPI. Se puede calcular con datos que el sistema ya guarda (`due_date`, `delivered_at`, `in_full`), así que **se reentrena con datos reales sin cambiar el esquema** |
| Días de estadía de un contenedor (regresión) | Útil, pero el cobro y la alerta ya lo resuelven con una fórmula; la predicción aportaría poco |
| Duración de la ruta | Necesita datos de recorrido que a propósito no se guardan (solo la última posición) |

## 2. Comprensión de los datos

Todo lo que se usa se conoce **al crear la OT** (nada que se sepa recién al entregar, para no "hacer trampa"):

| Variable | Origen |
|---|---|
| `distanceKm` | Distancia en línea recta (haversine) desde el depósito simulado en Concón al punto de entrega del cliente. Sin punto en el mapa se usa la distancia promedio |
| `weightKg` | Peso de la OT |
| `leadDays` | Días entre la creación y la fecha comprometida |
| `itemCount` | Productos distintos en la OT |
| `createdHour` | Hora del día en que se creó |
| `dueOnMonday` | 1 si se promete para un lunes |

**Objetivo (`miss`)**: la OT no fue entregada hasta su fecha comprometida **o** no fue completa. Una OT fallida cuenta como incumplida (igual que en el OTIF).

**Datos simulados** (`backend/ml/train.js`, semilla fija): el atraso crece con la distancia, el peso, la hora tardía y los lunes, y baja con más plazo; la entrega incompleta crece con más productos y más peso. Ambos llevan ruido aleatorio para que el resultado nunca sea perfectamente predecible. Resultan ~27 % de OT incumplidas: un problema **desbalanceado**, por eso no basta mirar la exactitud.

## 3. Preparación de los datos

- Las variables se **estandarizan** (promedio 0, desviación 1) para que sus pesos sean comparables y para que el entrenamiento converja.
- **80 % entrena, 20 % evalúa** (1.000 OT que el modelo nunca vio).
- En producción, las OT sin punto de entrega usan la distancia promedio; el plazo y la cantidad de productos se acotan a mínimos válidos.

## 4. Modelado

**Regresión logística** en JavaScript puro (`backend/ml/model.js`), entrenada por descenso de gradiente. Se eligió porque:

- con 6 variables no hace falta nada más potente, y no agrega dependencias;
- es **explicable**: cada peso dice cuánto sube o baja el riesgo, y eso se muestra en pantalla;
- es liviano: el modelo entrenado es un JSON (`model.json`) que se versiona en Git y se evalúa en microsegundos.

Alternativas descartadas por ahora: árbol o bosque aleatorio (mejor con interacciones, pero necesita historial real que justifique la complejidad), redes neuronales (excesivo).

## 5. Evaluación

Con la semilla actual, en las 1.000 OT no vistas:

| Métrica | Valor | Cómo leerla |
|---|---|---|
| Exactitud | ~80 % | La respuesta ingenua «todas cumplen» acierta ~73 %: **por sí sola engaña** |
| Cobertura (*recall*) | ~67 % | De cada 3 incumplimientos, detecta 2 |
| Precisión | ~61 % | De las OT que marca, 6 de cada 10 realmente fallan |
| Captura en el 20 % de mayor riesgo | ~49 % | Revisando solo 1 de cada 5 OT se atrapa casi la mitad de las fallas |
| AUC | ~0,85 | 0,5 es azar y 1 es perfecto |

**Umbral de 40 %:** se marca una OT desde 40 % de riesgo (y «alto» desde 70 %). Es menor que el 50 % habitual a propósito: dejar pasar una falla cuesta más que revisar una OT que estaba bien. Subirlo da más precisión y menos cobertura, y bajarlo al revés.

## 6. Despliegue

| Qué | Dónde |
|---|---|
| Tarjeta del modelo, simulador «¿y si…?» y OT abiertas por riesgo | Pantalla **Predicciones** (despachador, supervisor y administrador) |
| `GET /api/predictions/model` | Métricas, umbral y peso de cada variable |
| `GET /api/predictions/open-orders` | Riesgo de cada OT abierta con fecha comprometida, de mayor a menor |
| `POST /api/predictions/otif-risk` | Riesgo de una OT descrita a mano (las 6 variables) |

Reentrenar: `npm run train` en `backend` (reescribe `model.json`; reinicia la API para que lo cargue).

### Límites y siguientes pasos

- Con datos simulados es una demostración de la técnica, no una herramienta para decidir.
- La distancia es en línea recta; no conoce tráfico, clima ni conductor.
- Una regresión logística no capta interacciones (p. ej., que el peso importe solo en distancias largas).
- **Cuando haya ≥ 300–500 OT reales:** entrenar con ellas, separar por fecha (entrenar con lo antiguo, evaluar con lo reciente), comparar contra un árbol de decisión y monitorear si la cobertura cae con el tiempo.
