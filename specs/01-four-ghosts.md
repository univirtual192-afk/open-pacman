# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Approved
> **Depende de:** —
> **Fecha:** 2026-08-05
> **Objetivo:** Expandir el reparto a cuatro fantasmas con IA de persecución distintas (estilo clásico Blinky/Pinky/Inky/Clyde), todos iniciando dentro de la pen con liberación escalonada.

## 1 — Por qué existe esta spec

El MVP actual tiene solo 2 fantasmas (`hunter`, `random`) y se ven idénticos. El juego no transmite la sensación de ser acorralado por personalidades diferentes. Esta spec introduce los 4 arquetipos clásicos sin añadir modos scatter global ni pellets de poder (eso queda para specs futuras).

## 2 — Alcance

**Dentro:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas dentro de la pen, con reparto fijo de posiciones.
- Renombrar `kind` a los nombres clásicos: `blinky`, `pinky`, `inky`, `clyde`.
- Implementar 4 IA de persecución (chase puro, sin scatter global ni asustado).
- Liberación escalonada de la pen por temporizador de frames.
- Asignar esquinas de respaldo por fantasma (uso interno de su IA, no hay modo scatter global).
- `render.js` dibuja cada fantasma con su color (rojo, rosa, cian, naranja).
- Restablecer posiciones y temporizadores al perder una vida.

**Fuera de alcance:**

- Modo scatter global / temporizador alternar chase–scatter.
- Power pellets, modo asustado, comer fantasmas.
- Sistema de niveles / subida de dificultad.
- Cambios de velocidad entre fantasmas.
- Reingreso de fantasmas a la pen (fuera no vuelven a entrar).
- Render distinto por personaje: solo cambia el color.

## 3 — Modelo de datos

Cambios en `maze.js`:

```js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', color: '#ff0000' }, // rojo
  { x: 14, y: 14, kind: 'pinky',  color: '#ffb8de' }, // rosa
  { x: 13, y: 15, kind: 'inky',   color: '#00ffff' }, // cian
  { x: 14, y: 15, kind: 'clyde',  color: '#ffb852' }, // naranja
];

// Esquinas de respaldo (target cuando la IA principal no decide, y para Clyde cercano).
const GHOST_CORNERS = {
  blinky: { x: 26, y: 1 },
  pinky:  { x: 1,  y: 1 },
  inky:   { x: 26, y: 29 },
  clyde:  { x: 1,  y: 29 },
};
```

Cambios en `game.js` — estado del fantasma ampliado:

```js
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  x: g.x,
  y: g.y,
  dir: 'up',
  speed: GHOST_SPEED,   // 1/10 (no cambia entre fantasmas)
  kind: g.kind,
  color: g.color,
  releaseAt: i * 120,   // Blinky=0, Pinky=120, Inky=240, Clyde=360 frames
  released: i === 0,    // solo Blinky arranca libre
} ) ),
```

Se añade un contador `frame` global en `game` para liberar (ver plan). No se añaden estructuras nuevas fuera de `ghosts`.

## 4 — Plan de implementación

1. **maze.js**: ampliar `GHOST_STARTS` a 4 entradas con `kind` y `color`; añadir `GHOST_CORNERS`; exponer ambos en `window`. Verifica: cargar la página, en consola `GHOST_STARTS.length === 4` y `GHOST_CORNERS.blinky` existe.
2. **game.js — `createGame`**: generar 4 fantasmas con `releaseAt`/`released` y un `game.frame = 0`. Comprobar que `MAZE` se copia y que `ghosts.length === 4`.
3. **game.js — liberación de la pen**: al inicio de cada frame, incrementar `game.frame`; los fantasmas con `released === false && frame >= releaseAt` quedan `released = true`. Mientras `released === false`, `decideGhost` fuerza `dir = 'up'` (intentan salir por la puerta `-`); al alinearse por encima de la fila 12 se consideran fuera. Verifica: tras arrancar, Blinky sale inmóvil-a-instante y los demás esperan.
   - Implementar cláusula "no reingreso": si un fantasma liberado intenta moverse hacia una celda con `grid === 3` (puerta) bajando desde fuera (y >= 13 hacia y < 13), se bloquea. Solo cruzar la puerta es válido al salir.
4. **game.js — IA cada fantasma** (solo aplican si `released === true`). Reescribir `decideGhost` como dispatcher por `kind`:
   - **blinky**: target = celda de Pac-Man (round). Elige la opción con menor distancia Manhattan al target. (Equivalente al `hunter` actual.)
   - **pinky**: target = celda de Pac-Man + 4·`DIRS[pacman.dir]`. Mismo critero de Manhattan.
   - **inky**: `ahead = pacman + 2·DIRS[pacman.dir]`; `target = blinky.pos + 2·(ahead − blinky.pos)`, donde `blinky` se obtiene de `game.ghosts.find(g => g.kind==='blinky')`. Manhattan al target.
   - **clyde**: si `dist(g, pacman) <= 8` Manhattan → target = `GHOST_CORNERS.clyde`; si no → target = Pac-Man. Manhattan al target.
   - En todos: las `choices` se calculan igual que hoy (no reversa salvo callejón). Si hay empate de distancia, se queda la primera `choices[0]` del orden de `DIRS` (left/right/up/down). Si las `choices` están vacías (callejón), reversa. Sin más.
   - Verifica jugando: Blinky acosa recto, rosa se adelanta, cian flanquea, naranja se va a su esquina cuando te acercas.
5. **game.js — `resetPositions`**: reiniciar `x,y,dir,released` a los valores iniciales (`released = i === 0`) y `game.frame = 0` al perder una vida. Verifica: morir vuelve a 2 fantasmas como al inicio.
6. **render.js**: usar `g.color` para el cuerpo de cada fantasma. Sin cambios de forma. Verifica: los 4 fantasmas tienen colores distintos en pantalla.

Cada paso deja el juego ejecutable: corre tras cada uno sin errores.

## 5 — Criterios de aceptación

- [ ] `GHOST_STARTS.length === 4` tras cargar la página.
- [ ] `GHOST_CORNERS.blinky/pinky/inky/clyde` existen con sus coordenadas de esquina.
- [ ] A los 0 s sale Blinky (rojo); a los ~2 s Pinky (rosa); ~4 s Inky (cian); ~6 s Clyde (naranja).
- [ ] Blinky reduce constantemente la distancia Manhattan hacia la celda de Pac-Man.
- [ ] Pinky se dirige hacia 4 celdas por delante de la dirección actual de Pac-Man (comprobable girando a Pac-Man y observando hacia dónde va el rosa).
- [ ] Inky flanquea derivando su target con Blinky como referencia (visible cuando Pac-Man baja por un lateral: cian corta por el centro).
- [ ] Clyde se aleja hacia su esquina inferior-izquierda cuando su distancia a Pac-Man es ≤ 8 celdas Manhattan; persigue cuando supera 8.
- [ ] Ningún fantasma liberado vuelve a entrar en la pen (no atraviesa la puerta `-` desde fuera).
- [ ] Perder una vida reinicia posiciones, `released` y `game.frame` a los valores iniciales.
- [ ] Los 4 fantasmas se mueven a 1/10 celda/frame (misma velocidad; no se separa `speed` por kind).
- [ ] No aparecen errores en la consola del navegador durante la partida.

## 6 — Decisiones

- **Sí:** nombres clásicos `blinky/pinky/inky/clyde`. Mapeo directo a comportamiento conocido y deja puerta abierta a scatter/frightened futuros sin renombrar.
- **Sí:** los 4 arrancan en la pen y salen escalonados (0/120/240/360 frames). Evita acorralamiento inmediato y reutiliza la puerta existente.
- **Sí:** las 4 IA son `chase` puro (no scatter global, no asustado). El hito de IA clásica ya es suficiente para esta spec; el resto va en specs aparte.
- **Sí:** esquinas de respaldo fijas por fantasma. Necesarias para Clyde cercano y como tie-target si la IA principal no resuelve; además prepara el terreno para scatter real.
- **Sí:** todos a la misma velocidad (1/10). La diferenciación viene por comportamiento, no por velocidad.
- **Sí:** verificación manual/visual. No hay framework de tests y el comportamiento es observable.
- **No:** Inky que mira hacia atrás (algunas versiones lo invierten). Mantenemos la versión vectorial original.
- **No:** debug logging permanente. La inspección visual basta; un módulo de debug, si llega, va en otra spec.
- **No:** reingreso a la pen. Semántica de puerta simplificada a "solo salida"; cuadra con que no necesitamos ghosts comidos porque no hay modo asustado.

## 7 — Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los fantasmas se atascan dentro de la pen forzando `dir='up'` en celdas no alineadas con la puerta | Forzar solo la decisión al estar alineado; mientras tanto, dejar avanzar con la dirección que tengan hasta alinear de nuevo. |
| Inky rompe si `blinky` no existe en `game.ghosts` | Asumir contrato: Blinky siempre está presente (definido en `GHOST_STARTS`); si `.find` retorna undefined, fallback al target de Blinky = celda de Pac-Man. |
| Reingreso accidental por la puerta durante persecución | Bloquear explícitamente el movimiento del fantasma hacia `grid===3` cuando ya está `released` y `y < 13`. |

## Qué **no** está en esta spec

- Modo scatter global / temporizador chase–scatter.
- Power pellets + modo asustado + comer fantasmas.
- Niveles o aumento de velocidad.
- Reingreso de fantasmas a la pen.
- Formas de render distintas por personaje (solo color).