// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frame: 0,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,   // 1/10 (no cambia entre fantasmas)
      kind: g.kind,
      color: g.color,
      releaseAt: i * 120,   // Blinky=0, Pinky=120, Inky=240, Clyde=360 frames
      released: i === 0,    // solo Blinky arranca libre
      exited: false,        // se pone a true al salir de la pen (y<=11 alineado)
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function isPenDoor( x, y ) {
  // Puerta de la pen (fila 12, cols 13-14) e interior de la pen (filas 13-15).
  return x >= 13 && x <= 14 && y >= 12 && y <= 15;
}

// Bloquea reingreso a la pen una vez el fantasma ha salido.
function isPenReentry( g, dir ) {
  if ( !g.exited ) return false;
  const d = DIRS[ dir ];
  return isPenDoor( g.x + d.x, g.y + d.y );
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  // Sin liberar: quieto en la pen hasta su turno.
  if ( !g.released ) return;

  // Liberado pero aun dentro: subir para salir por la puerta.
  if ( !g.exited ) {
    g.dir = 'up';
    return;
  }

  // Liberado y fuera: IA por kind (target al que reducir distancia Manhattan).
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  let tx = px;
  let ty = py;
  if ( g.kind === 'pinky' ) {
    const dp = DIRS[ p.dir ];
    tx = px + 4 * dp.x;
    ty = py + 4 * dp.y;
  } else if ( g.kind === 'inky' ) {
    const bp = game.ghosts.find( ( o ) => o.kind === 'blinky' );
    const bx = bp ? Math.round( bp.x ) : px;
    const by = bp ? Math.round( bp.y ) : py;
    const ax = px + 2 * DIRS[ p.dir ].x;
    const ay = py + 2 * DIRS[ p.dir ].y;
    tx = bx + 2 * ( ax - bx );
    ty = by + 2 * ( ay - by );
  } else if ( g.kind === 'clyde' ) {
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    if ( dist <= 8 ) {
      const c = GHOST_CORNERS.clyde;
      tx = c.x;
      ty = c.y;
    }
  }

  // Opciones validas (no reversa salvo callejon, no reingreso a la pen).
  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ]
      && canMove( grid, g.x, g.y, dir, 'ghost' )
      && !isPenReentry( g, dir )
  );
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Elegir la opcion con menor distancia Manhattan al target.
  // Orden de DIRS = left/right/up/down; si hay empate se queda choices[0].
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  if ( !g.released ) return; // sin liberar: quieto en la pen

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    // Marcar salida de la pen: al alinear por encima de la fila 12 (y<=11).
    if ( !g.exited && g.y <= 11 ) g.exited = true;
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frame = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = i === 0; // solo Blinky arranca libre
    g.exited = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  // Liberacion escalonada de la pen por contador de frames.
  game.frame++;
  for ( const g of game.ghosts ) {
    if ( !g.released && game.frame >= g.releaseAt ) g.released = true;
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
