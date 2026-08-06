# SPEC 02 — Fantoches bobeando dentro de la pen

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-05
> **Objetivo:** Hacer que los fantasmas no liberados oscilen verticalmente dentro de la pen (bobbing) en vez de quedar helados, manteniendo la salida escalonada por la puerta de SPEC 01.

## 1 — Por qué existe esta spec

SPEC 01 liberó los fantasmas escalonadamente por `releaseAt`, pero mientras esperan su turno quedan **totalmente inmóviles** dentro de la jaula (`moveGhost` retorna en cuanto `!released`). Visualmente parecen atascados. El arcade clásico los hace oscilar arriba/abajo para que se vean "vivos" antes de salir. Esta spec corrige solo eso; la IA de persecución y la salida por la puerta ya funcionan y no se tocan.

## 2 — Alcance

**Dentro:**

- Reemplazar el estado "quieto" de los fantasmas no liberados por un **bobbing vertical** dentro de la pen (filas 13 a 15, cols 11–16), rebotando al llegar a los extremos.
- Mantener la liberación escalonada 0 / 120 / 240 / 360 frames de SPEC 01.
- Al pasar a `released`, el fantasma retoma sin cambios la lógica existente (`dir = 'up'` forzado hasta `exited`).
- Garantizar que **un fantasma no liberado nunca cruza la puerta `'-'` (grid===3)**.

**Fuera de alcance:**

- Cambios en la IA de persecución fuera de la pen (SPEC 01).
- Power pellets, modo asustado, comer fantasmas, reingreso a la pen.
- Cambios de velocidad, modo scatter global o niveles.
- Cambios en `maze.js` (`MAZE`, `GHOST_STARTS`, `GHOST_CORNERS`).
- Render distinto por fantasma (solo color), o un render específico de "bobbing": el `drawGhost` actual ya refleja `x/y/dir`, así que no se toca `render.js`.

## 3 — Modelo de datos

Esta feature **no introduce estructuras nuevas**. Reutiliza el modelo de fantasmas de SPEC 01:

```js
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  x, y, dir: 'up', speed: GHOST_SPEED,
  kind, color,
  releaseAt: i * 120,
  released: i === 0,
  exited: false,
} ) )
```

El bobbing se implementa **reusando `dir` y `speed`**: mientras `released === false`, `decideGhost` alterna `dir` entre `'up'` y `'down'` al rebotar en `y <= 13` y `y >= 15`. No se añade ningún campo nuevo (ni fase de bobbing, ni bobSpeed).

## 4 — Plan de implementación

1. **`game.js` — `moveGhost`**: quitar el retorno `if ( !g.released ) return;` para que el bucle de movimiento aplique también a los fantasmas en bobing. Verifica: la página carga sin errores; al arrancar, Pinky/Inky/Clyde ya no están congelados (sigue el paso 2).
2. **`game.js` — `decideGhost`**: reemplazar `if ( !g.released ) return;` por lógica de rebote:
   - Si `!released` y alineado:
     - si `dir === 'up'` y `g.y <= 13` → `dir = 'down'` (no cruzar la puerta).
     - si `dir === 'down'` y `g.y >= 15` → `dir = 'up'` (no cruzar el fondo de la pen).
   - En caso contrario dejar `dir` como está (sigue su trayecto).
   Verifica: los tres fantasmas no liberados oscilan entre filas 13 y 15; Blinky (liberado) no bobea y sale igual que antes.
3. **`game.js` — evitar fuga por la puerta**: confirmar que con el rebote en `y <= 13` un fantasma no liberado nunca pide `canMove` hacia `(x, 12)` (puerta). Verifica en consola: tras 200 frames con Pinky/Inky/Clyde esperando, ninguno tiene `y < 13` ni `grid[12][13..14]` pisado.
4. **`game.js` — `resetPositions`**: ya reinicia `released/exited/frame` (SPEC 01). Confirmar que tras perder una vida el bobbing vuelve a funcionar sin cambios extra. Verifica: morir reinicia el bobbing de los no liberados.
5. Verificación final manual: cargar `src/index.html`, observar que Blinky sale en ~1 s y que Pinky/Inky/Clyde **bobean** dentro de la jaula hasta ~2/4/6 s y entonces salen por la puerta; sin errores en consola; la persecución fuera de la pen sigue igual.

Cada paso deja el juego ejecutable.

## 5 — Criterios de aceptación

- [ ] Mientras un fantasma tiene `released === false`, su `y` oscila entre 13 y 15 (no permanece constante más de 10 frames).
- [ ] Blinky (releaseAt = 0) sale de la pen en <= 60 frames y `exited` pasa a `true`; no bobea.
- [ ] Pinky/Inky/Clyde bobean dentro de la pen antes de su `releaseAt`.
- [ ] Al llegar `game.frame >= releaseAt`, un fantasma deja de bobear, sube por la puerta y `exited` se pone a `true` al alinear `y <= 11`.
- [ ] Ningún fantasma no liberado alcanza `y <= 12` (no cruza la puerta `'-'`).
- [ ] Perder una vida reinicia posiciones, `released`, `exited` y `game.frame`; el bobing reaparece igual que al inicio.
- [ ] No aparecen errores en la consola del navegador durante una partida.
- [ ] El comportamiento de persecución fuera de la pen (`blinky/pinky/inky/clyde`) es idéntico al de SPEC 01.

## 6 — Decisiones

- **Sí:** bobing vertical entre filas 13 y 15. Es el comportamiento arcade y resuelve el "parecen atascados".
- **Sí:** reusar `dir` y `speed` para el bob, sin añadir campos al fantasma. Conserva intacto el modelo de SPEC 01.
- **Sí:** Blinky (releaseAt 0) no bobea; sale como en SPEC 01.
- **Sí:** al liberar a mitad de un bob, el fantasma completa su inercia y al siguiente alineo fuerza `'up'`. Demora admitida (< 10 frames).
- **No:** bobing horizontal. La pen es estrecha; el vertical es el clásico.
- **No:** velocidad de bobing distinta a `GHOST_SPEED`. No es objetivo diferenciar visualmente el ritmo de espera.
- **No:** reasignar columnas para evitar superposición de Pinky (col 14) y Clyde (col 14). No afecta jugabilidad; queda fuera de alcance.
- **No:** tocar `maze.js` o `render.js`. No hace falta.

## 7 — Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un fantasma no liberado se cuela por la puerta durante el bobing | `decideGhost` rebota `dir` a `'down'` cuando `y <= 13` alineado, antes de pedir `canMove` hacia la puerta. |
| Al liberar yendo hacia abajo, el fantasma da un paso fuera de ritmo | El siguiente alineo aplica `dir = 'up'` (lógica existente de SPEC 01); demora `< 10 frames` aceptable. |
| Pinky y Clyde (ambos col 14) se superponen al bobear | Aceptado: no afecta jugabilidad. Reasignar columnas requeriría tocar `maze.js` (fuera de alcance). |

## Qué **no** está en esta spec

- Cambios en la IA de persecución (SPEC 01).
- Power pellets, modo asustado, comer fantasmas, reingreso a la pen.
- Cambios de velocidad, scatter global o niveles.
- Modificaciones en `maze.js` ni en `render.js`.
- Render distinto por personaje (solo color).