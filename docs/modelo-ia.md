# Modelo de IA: riesgo de atraso de una OT

## Qué predice

Para una orden de transporte todavía abierta: **¿qué probabilidad hay de que llegue después de su fecha comprometida?** Sirve para que el despachador vea cuáles OT vigilar primero, y para probar "¿y si…?" antes de prometer una fecha.

> **Los datos son simulados.** El sistema aún no tiene historial real suficiente, así que el modelo se entrena con 5.000 OT inventadas con reglas plausibles (más distancia, más peso y menos plazo, más atraso). Sus cifras de precisión miden qué tan bien aprendió esas reglas inventadas, **no** qué tan bien predeciría en la vida real. Cuando haya historial real basta con cambiar `simulate()` por una consulta a `transport_order` (atrasada = `delivered_at > due_date`) y volver a entrenar.

## Cómo funciona

- **Modelo:** regresión logística, escrita en JavaScript puro (`backend/ml/model.js`). Con 6 variables no hace falta una librería.
- **Variables** (todas se conocen al crear la OT):

  | Variable | Cómo se obtiene |
  |---|---|
  | `distanceKm` | Distancia en línea recta (haversine) desde el depósito simulado en Concón hasta el punto de entrega del cliente. Si el cliente no tiene punto en el mapa se usa la distancia promedio |
  | `weightKg` | Peso de la OT |
  | `leadDays` | Días entre la creación y la fecha comprometida |
  | `itemCount` | Productos distintos en la OT |
  | `createdHour` | Hora del día en que se creó |
  | `dueOnMonday` | 1 si la entrega se promete para un lunes |

- **Entrenamiento** (`npm run train`, desde `backend`): genera los datos con una semilla fija (siempre salen los mismos), entrena con el 80 % y mide con el 20 % restante, que el modelo no vio. Escribe `backend/ml/model.json` con los pesos, el promedio y la desviación de cada variable y las métricas. Ese archivo se versiona en Git, así que no hace falta entrenar para usar el sistema.
- **Métricas** (en las OT que no vio): *aciertos* con el corte en 50 % y *AUC* (probabilidad de que una OT atrasada reciba más riesgo que una a tiempo; 0,5 es azar, 1 es perfecto). Con la semilla actual salen cerca de 90 % y 0,96.
- **Niveles:** riesgo bajo (menos de 40 %), medio (40 a 70 %) y alto (70 % o más).

## Dónde se ve

| Qué | Dónde |
|---|---|
| Tarjeta del modelo (aciertos, AUC y qué pesa más) | Pantalla **Predicciones** |
| Simulador "¿y si…?" | Pantalla **Predicciones** |
| OT abiertas ordenadas por riesgo | Pantalla **Predicciones** |
| `GET /api/predictions/model` | Métricas y peso de cada variable |
| `GET /api/predictions/open-orders` | Riesgo de cada OT abierta con fecha comprometida, de mayor a menor |
| `POST /api/predictions/late-risk` | Riesgo de una OT descrita a mano (las 6 variables) |

Pueden verlo el despachador, el supervisor y el administrador.

## Límites que conviene tener presentes

- Con datos simulados es una demostración de la técnica, no una herramienta para decidir.
- La distancia es en línea recta, no por camino.
- No conoce el tráfico, el clima ni el conductor; solo las 6 variables.
- Una regresión logística no capta interacciones entre variables (por ejemplo, que el peso importe solo en distancias largas). Si el historial real lo pidiera, el siguiente paso sería un árbol de decisión o un bosque aleatorio.
