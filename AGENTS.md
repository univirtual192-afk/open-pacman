# AGENTS.md

## Project

Vanilla JS / HTML / CSS Pac-Man game. No build system, no package manager, no test
framework. Built for learning spec-driven development (see skills below).

## Run it

Serve `src/` from any static server. The repo lives under an XAMPP `htdocs` path, so
opening `http://localhost/curso_opencode/05-open-pacman/src/index.html` via Apache works.
`file://` also works (no fetch/XHR is used), but a static server is preferred.

There are no install, build, lint, typecheck, or test commands. Do not invent `npm run ...`.

## Architecture

Entry point is `src/index.html`, which loads four scripts **in order** via plain
`<script>` tags. Order matters — there are no ES modules; modules communicate through
`window` globals.

1. `js/maze.js` — defines `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` on `window`.
2. `js/game.js` — state + rules. Depends on maze globals. Exposes `createGame`, `update`, `DIRS`.
3. `js/render.js` — canvas drawing. Exposes `draw`. Reads `game.grid` (not `MAZE`) so
   eaten dots are reflected.
4. `js/main.js` — the loop, keyboard input, and overlay (start/win/lose). The real
   bootstrap: calls `loop()` at the bottom.

### Maze model

`MAZE` (`maze.js`) is a 28×31 grid parsed from ASCII strings in `MAZE_STR`. Tile codes:
`#`=1 wall, `.`=2 dot, `-`=3 pen door, ` `=0 walkable empty. It is **pristine and must
not be mutated** — `createGame()` copies it into `game.grid`, and gameplay mutates
`game.grid` only. Tunnels are row 14; entering/exiting the border there is allowed.

### Movement quirks

Positions are fractional (Pac-Man speed 1/8 cell/frame, ghosts 1/10). Turns only apply at
aligned cells; `nextDir` buffers an input until alignment. Ghosts: `hunter` chases via
Manhattan distance, `random` picks any non-reversing turn; a dead end allows a 180.

## Workflow: spec-driven development

This repo is built around the `spec` and `spec-impl` skills (locked in
`skills-lock.json`, vendored under `.agents/skills/`). For a new feature, use the `spec`
skill first to write/plan under `specs/`, then `spec-impl` to implement an approved spec
on its own branch. Existing specs, if any, live under `specs/`.

## Conventions

- Spanish is used in user-facing text (`index.html`, overlay messages, README) and in
  comments. Keep that when editing strings or comments near existing Spanish.
- Single quotes for string literals throughout `js/`. Match this.
- No inline dependencies or bundlers — keep everything plain browser globals.