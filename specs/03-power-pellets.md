# SPEC 03 — Power pellets y modo asustado

> **Estado:** Approved
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-05
> **Objetivo:** Añadir 4 power pellets en las esquinas del laberinto que, al comerse, ponen a los fantasmas en modo asustado, permitiendo a Pac-Man comerlos y enviar sus ojos de vuelta a la pen.

## 1 — Por qué existe esta spec

SPEC 01 dejó explícitamente fuera "Power pellets, modo asustado, comer fantasmas" porque su bloqueo del reingreso a la pen dependía de que no existiera ese modo. SPEC 02 mantiene ese bloqueo. Ahora sha es el momento de introducir el bucle clásico: comer pellet → asustar → comer fantasma → ojos vuelven → reespaño. Esto requiere romper, de forma acotada, la regla de "no reingreso" de SPEC 01.

## 2 — Alcance

**Dentro:**

- Nuevo tile `o`=4 (power pellet) en el parser de `maze.js`.
- 4 power pellets fijos en las esquinas transitables: `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`.
- Comer un power pellet suma 10 puntos, baja `dotsRemaining` en 1, e inicia el modo asustado.
- Estado de asustado global en `game`: `game.fright` (frames restantes, contador descendente).
- IA de huida: cada fantasma persigue su `GHOST_CORNERS[kind]` en vez de a Pac-Man mientras `game.fright > 0` y `!g.eaten`.
- Parpadeo visual en los últimos 120 frames del modo asustado (aviso final).
- Comer fantasma asustado: añade campos `eaten`/`eatenAt` y `frightChain`; puntua 200/400/800/1600 según cadena (resetea al acabar el fright).
- Reespaño: el fantasma comido viaja como "ojos" (rápido) a su celda de inicio en la pen; al alinear con `GHOST_STARTS[i]` reinicia `eaten=false`, `released=true`, `exited=false` y vuelve a salir por la puerta.
- Romper la regla de no-reingreso de SPEC 01 solo para fantasmas con `eaten === true` (atraviesan la puerta `-` y vuelven a entrar a la pen).
- Velocidad: asustados más lentos (0.05), ojos más rápidos (0.25). Los demás casos mantienen `GHOST_SPEED`.
- Render: power pellet como círculo grande; fantasma asustado en azul `#2121ff` (parpadea a blanco en los últimos 120 frames) salvo si está comido; fantasma comido dibujado solo como ojos (sin cuerpo).
- Al perder una vida o reiniciar partida, `game.fright`, `frightChain`, y `eaten`/`eatenAt` de cada fantasma se reinician.

**Fuera de alcance (para futuras specs):**

- Modo scatter global / temporizador chase–scatter (SPEC 01 lo excluye; sigue fuera).
- Aumento de velocidad por nivel o sistema de niveles.
- Frutas / bonus.
- Persistencia de high-score.
- Efectos de sonido.
- Penalización de tiempo creciente entre power pellets sucesivos ( progressiveshortening en el arcade original).

## 3 — Modelo de datos

### `maze.js`

Nuevo tile en `parseTile`:

```js
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === 'o' ) return 4; // power pellet
  if ( ch === '-' ) return 3;
  return 0;
}
```

Las cuatro esquinas de `MAZE_STR` cambian de `.` a `o`:

- Fila 3 (índice 3): cols 1 y 26 → `o`.
- Fila 23 (índice 23): cols 1 y 26 → `o`.

Constante nueva:

```js
const POWER_PELLETS = [
  { x: 1,  y: 3  },
  { x: 26, y: 3  },
  { x: 1,  y: 23 },
  { x: 26, y: 23 },
];
window.POWER_PELLETS = POWER_PELLETS;
```

### `game.js`

Constantes nuevas:

```js
const FRIGHT_FRAMES = 420;   // ~7 s @ 60 FPS
const FRIGHT_BLINK = 120;    // ultimos 120 frames: parpadeo
const GHOST_SPEED_FRIGHT = 0.05;  // 1/20 celda/frame
const GHOST_SPEED_EYES  = 0.25;  // 1/4 celda/frame
const FRIGHT_SCORES = [ 200, 400, 800, 1600 ];
```

`createGame` amplía el objeto devuelto:

```js
return {
  ...,
  fright: 0,        // frames restantes de modo asustado
  frightChain: 0,   // 0..3: indice en FRIGHT_SCORES de la cadena actual
  ghosts: GHOST_STARTS.map( ( g, i ) => ( {
    ...,
    eaten: false,   // true mientras sus ojos vuelven a la pen
    eatenAt: 0,     // game.frame en el que fue comido
  } ) ),
};
```

`resetPositions` reinicia:

```js
game.fright = 0;
game.frightChain = 0;
game.ghosts.forEach( ( g, i ) => {
  ...
  g.eaten = false;
  g.eatenAt = 0;
} );
```

### `render.js`

`drawDots` añade un pase para tile `=== 4` (radio grande, p.ej. 6 px). `drawGhost` recibe `game` (en lugar de `color`) y decide color según `game.fright` y `g.eaten`:

- `g.eaten` → no dibuja cuerpo; solo ojos.
- `game.fright > 0 && !g.eaten` → color azul `#2121ff`, alternando a blanco `#fff` en frames dentro de los últimos `FRIGHT_BLINK` (parpadeo de ~8 frames).
- Caso normal → `g.color`.

## 4 — Plan de implementación

1. **`maze.js` — tile y power pellets.** Añadir `o`=4 a `parseTile`; reemplazar las 4 esquinas (`.` → `o`) en `MAZE_STR`; exponer `POWER_PELLETS` en `window`. Verifica: cargar la página; en consola `MAZE[3][1] === 4` y `MAZE[23][26] === 4`; `POWER_PELLETS.length === 4`.
2. **`render.js` — render del power pellet.** En `drawDots`, si `grid[y][x] === 4`, dibuja círculo de radio 6 px (en vez de 2.5 px). Verifica: los 4 power pellets se ven como círculos grandes en las esquinas.
3. **`game.js` — estado de asustado.** Añadir constantes y extender `createGame`/`resetPositions` con `fright`, `frightChain`, `eaten`, `eatenAt`. Verifica: la página carga sin errores; `createGame().fright === 0`.
4. **`game.js` — comer power pellet.** En `movePacman`, donde hoy se come el dot (`grid===2`), distinguir: si `grid===4` además de `score += 10` y `dotsRemaining--`, poner `game.fright = FRIGHT_FRAMES` y `game.frightChain = 0`. Setear celda a `0`. Verifica: al pasar Pac-Man por una esquina, el power pellet desaparece y el contador `dotsRemaining` baja.
5. **`game.js` — tick del fright.** Al inicio de `update`, después de incrementar `game.frame`, si `game.fright > 0`: `game.fright--`; si llega a 0, `game.frightChain = 0` y poner `eaten=false` a cualquier fantasma que todavía estuviera en vuelo (caso de borde: nunca pasa porque un fantasma comido siempre llega antes a la pen, pero defensive). Verifica: tras comer un pellet, `game.fright` baja en 1 cada frame durante 420 frames.
6. **`game.js` — velocidad según estado.** En `moveGhost`, al elegir `d` para avanzar, usar `g.eaten ? GHOST_SPEED_EYES : ( game.fright > 0 && g.exited && !g.eaten ? GHOST_SPEED_FRIGHT : g.speed )`. Verifica: un fantasma asustado avanza lento; sus ojos tras ser comido, rápido.
7. **`game.js` — IA de huida y de ojos.** En `decideGhost`, antes del dispatcher por `kind`, ramificar:
   - Si `g.eaten`: target = celda de `GHOST_STARTS[i]` de ese fantasma (su celda de inicio en la pen); puede atravesar la puerta `-`. Usa Manhattan igual. Al alinear con `Math.round(g.x)===startX && Math.round(g.y)===startY`, reiniciar `eaten=false`, `released=true`, `exited=false`.
   - Si `!g.eaten && game.fright > 0 && g.exited`: target = `GHOST_CORNERS[g.kind]` (huye hacia su esquina). Manhattan igual; mantiene la regla de no-reversa salvo callejón.
   - Resto: lógica existente de SPEC 01.
   Verifica jugando: tras comer un pellet, los 4 fantasmas se van a sus esquinas; al tocarlos desaparecen y sus ojos regresan a la pen.
8. **`game.js` — reingreso permitido solo para comidos.** Modificar `isPenReentry` para devolver `false` cuando `g.eaten === true` (puede entrar). Sigue bloqueando a los demás. Verifica: los ojos entran a la pen; ningún fantasma vivo entra.
9. **`game.js` — comer fantasma.** En el bucle de colisiones de `update`, antes de `game.lives--`: si `g.eaten` → skip (no muere Pac-Man, ya son ojos inofensivos). Si `!g.eaten && game.fright > 0`: `g.eaten = true; g.eatenAt = game.frame; game.score += FRIGHT_SCORES[ game.frightChain ]; game.frightChain = min( game.frightChain + 1, FRIGHT_SCORES.length - 1 )`; `continue` sin restar vida. Si `!g.eaten && game.fright === 0` (caso actual): pierde una vida como antes. Verifica: tocar un fantasma azul suma 200, 400, 800, 1600 en cadena; tocar uno normal mata.
10. **`render.js` — dibujo asustado.** Cambiar la firma de `drawGhost` para recibir `game` y elegir color: azul durante fright (parpadea a blanco cuando `game.fright <= FRIGHT_BLINK` y `Math.floor(frame / 8) % 2 === 0`); ojos transparentes de cuerpo cuando `g.eaten`; caso normal usa `g.color`. Actualizar la llamada en `draw`. Verifica: los fantasmas se ven azules tras comer un pellet y parpadean al final; los ojos se ven sin cuerpo.
11. **`game.js` — reset al perder vida.** Confirmar que `resetPositions` ya reinicia `fright`, `frightChain`, `eaten`, `eatenAt` (añadido en el paso 3). Verifica: morir limpia el modo asustado pendiente.

Cada paso deja el juego ejecutable: corre tras cada uno sin errores.

## 5 — Criterios de aceptación

- [ ] `MAZE[3][1]`, `MAZE[3][26]`, `MAZE[23][1]`, `MAZE[23][26]` valen `4`; el resto de dots siguen siendo `2`.
- [ ] `POWER_PELLETS.length === 4` y sus coordenadas coinciden con las esquinas anteriores.
- [ ] Los 4 power pellets se renderizan como círculos visiblemente más grandes que los dots normales.
- [ ] Comer un power pellet suma 10 al score, decrementa `dotsRemaining` en 1 y fija `game.fright = 420`.
- [ ] `game.fright` decrece en 1 cada frame; al llegar a 0, `frightChain` se reinicia a 0.
- [ ] Mientras `game.fright > 0`, los fantasmas liberados y no comidos usan velocidad `GHOST_SPEED_FRIGHT` (0.05) y su IA targeting es `GHOST_CORNERS[kind]`.
- [ ] Mientras `game.fright > 0`, el render del fantasma es azul `#2121ff` y parpadea a blanco en los últimos 120 frames.
- [ ] Tocar un fantasma asustado (no comido) no resta vida; suma 200 la primera vez, 400 la segunda, 800 la tercera y 1600 la cuarta dentro del mismo fright; a partir de la cuarta sigue sumando 1600.
- [ ] Tocar un fantasma comido (`eaten === true`) no afecta: no resta vida ni suma puntos.
- [ ] Tras ser comido, el fantasma viaja como ojos con velocidad `GHOST_SPEED_EYES` (0.25) hacia su celda de inicio en la pen, atravesando la puerta `-`.
- [ ] Un fantasma comido puede cruzar la puerta `-` (su `isPenReentry` no le bloquea); un fantasma vivo no.
- [ ] Al alinearse un fantasma comido con su celda de inicio (`GHOST_STARTS[i]`), `eaten` pasa a `false`, `released` a `true`, `exited` a `false`; y sube por la puerta igual que al inicio de partida.
- [ ] Tocar un fantasma normal (`!eaten && game.fright === 0`) resta vida y reinicia posiciones y todos los campos nuevos (`fright`, `frightChain`, `eaten`, `eatenAt`).
- [ ] Comer los 4 power pellets y los todos los dots lleva a `state === 'won'` sin errores.
- [ ] No aparecen errores en la consola del navegador durante una partida completa con power pellets.

## 6 — Decisiones

- **Sí:** nuevo tile `o`=4. Mantiene el parser legible y no rompe `dotsRemaining` (los 4 power pellets cuentan como dots para cerrar el nivel).
- **Sí:** 4 power pellets en esquinas clásicas (`(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`). Geometría fiel al arcade y ya eran dots en `MAZE_STR`, solo cambia el carácter.
- **Sí:** modo asustado con contador descendente `game.fright` (420 frames, ~7 s). Modelo simple y reutilizable para futuras specs de niveles (acortar duración).
- **Sí:** IA de huida apuntando a `GHOST_CORNERS[kind]` en vez de a un random no-reversa. Determinista, reutiliza el dispatcher de SPEC 01 y mantiene la regla de no-reversa salvo callejón.
- **Sí:** romper la regla de no-reingreso de SPEC 01 solo para `eaten === true`. Fallback acotado: los ojos son inofensivos y es la única excepción.
- **Sí:** cadena de puntuación 200/400/800/1600 con `frightChain`. Clásico y fácil de seguir. Resetea al apagarse el fright.
- **Sí:** reespaño automático por alineación con `GHOST_STARTS[i]`. No requiere lógica extra de "camino de ojos" camino-buscado; el Manhattan basta por la topología del laberinto y reutiliza la salida por la puerta de SPEC 01.
- **Sí:** velocidades distintas (asustado 0.05, ojos 0.25). Es parte de la experiencia clásica y justifica el campo de velocidad por estado. Rompe parcialmente "todos a la misma velocidad" de SPEC 01 pero la base (`g.speed` por kind) se conserva; solo se sobrescribe según estado.
- **Sí:** parpadeo en los últimos 120 frames. Feedback visual claro de que el fright se acaba (clásico).
- **No:** random no-reversa para la huida. Menos determinista; las esquinas ya transmiten la sensación de "huye".
- **No:** acortamiento progresivo de la duración entre power pellets sucesivos (arcade original). Aumenta la complejidad; queda para una spec de niveles si llega.
- **No:** persistencia, sonido o frutas. Quedan para specs aparte.

## 7 — Riesgos

| Riesgo | Mitigación |
| --- | --- | 
| Un fantasma comido se atasca fuera de la pen porque su IA Manhattan no encuentra ruta por la puerta | `isPenReentry` libera el paso cuando `eaten === true`; el target es la celda interior de la pen (`GHOST_STARTS[i]`, dentro de la jaula), que está justo debajo de la puerta, así que el Manhattan natural lo empuja a entrar por ella. |
| `frightChain` no resetea al reiniciar entre pellets distintos | `frightChain` solo se resetea en dos sitios: al iniciar un nuevo fright (paso 4) y al apagarse el fright (paso 5). Ambos cubren el caso. |
| Múltiples fantasmas comidos en el mismo frame compiten por `frightChain` | El bucle de colisiones recorre los fantasmas en orden; cada uno incrementa `frightChain` por separado, así que la cadena suma 200, 400, 800, 1600 según el orden de colisión. Cubierto por el `min` en el índice. |
| Velocidad de ojos (0.25) no alinea con `aligned()` (tol 1e-3) porque 0.25 no divide 1 | `0.25` alinea cada 4 frames (alineación exacta en enteros porque `0.25 * 4 = 1`); `aligned()` ya tolera 1e-3 y los pasos son 0.25, 0.5, 0.75, 1.0. Confirmado. |
| SPEC 02 (bobing) y el reingreso de ojos confunden la lógica de la pen | El bobing solo aplica cuando `!released`; un fantasma comido está `released === true` durante el vuelo, así que no bobea. Al llegar al inicio, `released` pasa a `true` y `exited` a `false`, forzando `dir='up'` para salir (no bobea). El flujo es coherente. |

## Qué **no** está en esta spec

- Modo scatter global / temporizador chase–scatter.
- Sistema de niveles o aumento de velocidad por nivel.
- Acortamiento progresivo de la duración del fright entre power pellets sucesivos.
- Frutas / bonus.
- Persistencia de high-score.
- Efectos de sonido.
- Render avanzado de "ojos" (animación): ojos simples sobre la dir actual, sin cuerpo.