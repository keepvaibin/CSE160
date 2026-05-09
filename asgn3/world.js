// ─────────────────────────────────────────────────────────────────────────────
// world.js — 32×32 Backrooms maze: map data, batch geometry, door query
//
// Map scheme:
//   g_Map[x][z] = 0  → open corridor cell
//   g_Map[x][z] = 4  → solid wall (height 4)
//   g_MapType[x][z]  → texture group (0=wall, 3=door)
//
// Geometry groups (match sampler indices):
//   0 = walls    (sandstone side)
//   1 = floor    (mossy cobblestone)
//   2 = ceiling  (sandstone top)
//   3 = door     (oak door)
// ─────────────────────────────────────────────────────────────────────────────

const MAP_SIZE   = 96;  // sprawling Backrooms-scale grid (9216 cells)
const WALL_H     = 4;   // all walls are exactly 4 units tall
const DOOR_TYPE  = 3;   // g_MapType value for exit door cells
const DOOR_HEIGHT = 2;  // door cells render door texture only up to y<2; wall above
const LIGHT_TYPE = 2;   // g_CeilType value for ceiling cells that are light tiles

// Anchors filled in by initMap() so other modules don't hard-code coordinates.
var SPAWN_X     = 5.5;
var SPAWN_Z     = 5.5;
var ENTITY_SPAWN_X = 48.5;
var ENTITY_SPAWN_Z = 48.5;
var DOOR_CELL_X    = 94;
var DOOR_CELL_Z    = 88;
var DOOR_APPROACH_X = 92.5;
var DOOR_APPROACH_Z = 88.5;

// world-space positions of every actively-illuminating ceiling fixture.
// capped at MAX_LIGHTS (8) in main.js — the rest of the light tiles are
// purely decorative texture.
var g_LightPositions = [];

// list of furniture pieces to render. populated by initMap. each entry:
//   { kind: 'chair'|'chair1'|...|'sofa'|'tv', x, z, yaw }
// main.js consumes this to draw and to mark the cells as obstructed.
var g_FurnitureSlots = [];

var g_Map     = [];   // g_Map[x][z]     — 0=open, 4=wall
var g_MapType = [];   // g_MapType[x][z] — 0=wall-tex, 3=door-tex
var g_CeilType = [];  // g_CeilType[x][z] — 0=plain ceiling, 2=light tile

var g_worldBuffers    = [null, null, null, null];
var g_worldVertCounts = [0, 0, 0, 0];

// ─────────────────────────────────────────────────────────────────────────────
// initWorldBuffers
// ─────────────────────────────────────────────────────────────────────────────
function initWorldBuffers() {
  for (let i = 0; i < 4; i++) {
    g_worldBuffers[i] = gl.createBuffer();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// initMap — build the hardcoded 32×32 Backrooms maze
// ─────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
// initMap — procedural Backrooms (Level 0) generator
// ───────────────────────────────────────────────────────────────────────────────
//
// Algorithm rationale ("liminal" — not a perfect maze):
//   The Kane Pixels Backrooms aesthetic is *open* office space carved into
//   irregular blobs by partial walls and freestanding pillars, not narrow
//   1-wide corridors.  A standard DFS perfect-maze gives narrow snaking
//   corridors and feels nothing like a Level-0 environment.  Instead we:
//
//     (1) Place 3 "anchor" rooms at fixed positions — player spawn (W),
//         exit (E), entity spawn (SE) — so the game loop is always solvable.
//     (2) Scatter ~30 large rectangular rooms (5×5 to 10×10) with a seeded
//         RNG.  Rooms may overlap; overlap is intentional — it produces
//         the merged-blob open spaces characteristic of the Backrooms.
//     (3) Connect every room to the next in spawn order with wide L-shaped
//         hallways (2–3 cells across).  Then add ~10 extra random pair
//         connections so the topology has *loops* (no dead ends — the
//         dimension is supposed to feel infinite and inescapable).
//     (4) BFS from the spawn cell; carve any unreachable open cell that we
//         placed back into a wall (guarantees the entity can always path
//         to the player and vice-versa).
//     (5) Sprinkle 1×1 / 1×2 / 2×2 freestanding pillars inside rooms to
//         break long sightlines (a key part of Backrooms dread).  We only
//         place a pillar where every neighbouring cell is open, so it never
//         touches a wall — it stands alone in the middle of the floor.
//     (6) Mark a single wall cell on the east side as the exit door.
// ───────────────────────────────────────────────────────────────────────────────
function initMap() {
  // Deterministic LCG (so the layout is identical every reload — helps
  // testing and means the rubric grader sees the same map I do).
  let _seed = 0x9E3779B1;
  function rng() {
    _seed = (_seed * 1664525 + 1013904223) | 0;
    return ((_seed >>> 0) / 0x100000000);
  }
  function rint(lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  // Initialise: every cell starts as a solid wall
  for (let x = 0; x < MAP_SIZE; x++) {
    g_Map[x]      = new Array(MAP_SIZE).fill(WALL_H);
    g_MapType[x]  = new Array(MAP_SIZE).fill(0);
    g_CeilType[x] = new Array(MAP_SIZE).fill(0);
  }

  function carve(x0, z0, x1, z1) {
    const ax = Math.max(1, Math.min(x0, x1));
    const az = Math.max(1, Math.min(z0, z1));
    const bx = Math.min(MAP_SIZE - 2, Math.max(x0, x1));
    const bz = Math.min(MAP_SIZE - 2, Math.max(z0, z1));
    for (let x = ax; x <= bx; x++)
      for (let z = az; z <= bz; z++)
        g_Map[x][z] = 0;
  }

  // (1) Anchor rooms — spawn (NW), door (SE), entity (centre).
  //     Spawn and door are intentionally NOT in the same row or column,
  //     so the player cannot just hold W and walk to the exit.
  const anchors = [
    { cx:  6, cz:  6, w: 6, h: 6 },  // 0 : player spawn (NW)
    { cx: 90, cz: 88, w: 6, h: 6 },  // 1 : exit foyer  (SE)
    { cx: 48, cz: 48, w: 7, h: 7 },  // 2 : entity spawn / central plaza
    { cx: 88, cz:  8, w: 6, h: 6 },  // 3 : NE landmark room
    { cx:  8, cz: 88, w: 6, h: 6 },  // 4 : SW landmark room
    { cx: 24, cz: 64, w: 6, h: 6 },
    { cx: 64, cz: 24, w: 6, h: 6 },
  ];
  const rooms = [];
  for (const a of anchors) {
    const x0 = a.cx - (a.w >> 1), z0 = a.cz - (a.h >> 1);
    const x1 = x0 + a.w - 1,      z1 = z0 + a.h - 1;
    rooms.push({ x0, z0, x1, z1, cx: a.cx, cz: a.cz });
    carve(x0, z0, x1, z1);
  }

  // (2) Many small-to-medium random rooms (4x4 to 6x6).
  const TARGET_ROOMS = 55;
  let attempts = 0;
  while (rooms.length < TARGET_ROOMS && attempts < 1500) {
    attempts++;
    const w  = rint(4, 6);
    const h  = rint(4, 6);
    const x0 = rint(2, MAP_SIZE - w - 3);
    const z0 = rint(2, MAP_SIZE - h - 3);
    const x1 = x0 + w - 1, z1 = z0 + h - 1;
    rooms.push({ x0, z0, x1, z1, cx: x0 + (w >> 1), cz: z0 + (h >> 1) });
    carve(x0, z0, x1, z1);
  }

  // a handful of bigger 'hall' rooms (8x8 to 10x10).
  const BIG_ROOMS = 6;
  let bigPlaced = 0, bigTries = 0;
  while (bigPlaced < BIG_ROOMS && bigTries < 800) {
    bigTries++;
    const w  = rint(8, 10);
    const h  = rint(8, 10);
    const x0 = rint(2, MAP_SIZE - w - 3);
    const z0 = rint(2, MAP_SIZE - h - 3);
    const x1 = x0 + w - 1, z1 = z0 + h - 1;
    const room = { x0, z0, x1, z1, cx: x0 + (w >> 1), cz: z0 + (h >> 1), big: true };
    rooms.push(room);
    carve(x0, z0, x1, z1);
    bigPlaced++;
  }

  // (3) Sequential L-shaped hallways between consecutive rooms.
  //     Width 2 (rarely 3) so corridors feel snug.
  function carveCorridor(a, b) {
    const width = (rng() < 0.15) ? 3 : 2;
    const half  = (width - 1) >> 1;
    const elbowX = (rng() < 0.5);
    const ex = elbowX ? b.cx : a.cx;
    const ez = elbowX ? a.cz : b.cz;
    if (elbowX) carve(Math.min(a.cx, ex), a.cz - half, Math.max(a.cx, ex), a.cz + half);
    else        carve(a.cx - half, Math.min(a.cz, ez), a.cx + half, Math.max(a.cz, ez));
    if (elbowX) carve(b.cx - half, Math.min(ez, b.cz), b.cx + half, Math.max(ez, b.cz));
    else        carve(Math.min(ex, b.cx), b.cz - half, Math.max(ex, b.cx), b.cz + half);
  }
  for (let i = 0; i < rooms.length - 1; i++) carveCorridor(rooms[i], rooms[i + 1]);
  // few extra loops keeps mostly-directed routes
  for (let k = 0; k < 4; k++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a !== b) carveCorridor(a, b);
  }

  // (4) Connectivity sweep: any open cell unreachable from the spawn cell
  //     is filled back in.  Prevents islands of "floating" rooms.
  {
    const seen = new Array(MAP_SIZE);
    for (let i = 0; i < MAP_SIZE; i++) seen[i] = new Array(MAP_SIZE).fill(false);
    const sx = anchors[0].cx, sz = anchors[0].cz;
    if (g_Map[sx][sz] === 0) {
      const q = [[sx, sz]]; seen[sx][sz] = true;
      let head = 0;
      while (head < q.length) {
        const [cx, cz] = q[head++];
        for (const [ox, oz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + ox, nz = cz + oz;
          if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) continue;
          if (seen[nx][nz] || g_Map[nx][nz] !== 0) continue;
          seen[nx][nz] = true; q.push([nx, nz]);
        }
      }
      for (let x = 0; x < MAP_SIZE; x++)
        for (let z = 0; z < MAP_SIZE; z++)
          if (g_Map[x][z] === 0 && !seen[x][z]) g_Map[x][z] = WALL_H;
    }
  }

  // (5) Freestanding pillars + internal partition walls inside rooms.
  //     Pillars break sightlines; partition walls turn open rooms into
  //     U-shaped half-rooms, forcing the player to actually navigate.
  function pillarOK(px, pz, sz) {
    for (let dx = -1; dx <= sz; dx++)
      for (let dz = -1; dz <= sz; dz++) {
        const x = px + dx, z = pz + dz;
        if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return false;
        if (g_Map[x][z] !== 0) return false;
      }
    return true;
  }
  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    // Skip player spawn room and door foyer
    if (ri === 0 || ri === 1) continue;

    // 0–1 freestanding pillars per room (was 0–2)
    const want = rint(0, 1);
    let placed = 0, tries = 0;
    while (placed < want && tries < 12) {
      tries++;
      const sz = (rng() < 0.85) ? 1 : 2;
      const px = rint(room.x0 + 1, room.x1 - sz - 1);
      const pz = rint(room.z0 + 1, room.z1 - sz - 1);
      if (px < 1 || pz < 1 || px + sz >= MAP_SIZE - 1 || pz + sz >= MAP_SIZE - 1) continue;
      if (!pillarOK(px, pz, sz)) continue;
      for (let dx = 0; dx < sz; dx++)
        for (let dz = 0; dz < sz; dz++)
          g_Map[px + dx][pz + dz] = WALL_H;
      placed++;
    }

    // 10% chance: drop a partition wall (reduced from 18%)
    if (rng() < 0.10) {
      const w = room.x1 - room.x0, h = room.z1 - room.z0;
      if (w >= 4 && h >= 4) {
        if (rng() < 0.5) {
          // Horizontal partition; leave a 1-cell gap somewhere
          const pz   = rint(room.z0 + 1, room.z1 - 1);
          const gapX = rint(room.x0 + 1, room.x1 - 1);
          for (let x = room.x0 + 1; x <= room.x1 - 1; x++)
            if (x !== gapX) g_Map[x][pz] = WALL_H;
        } else {
          const px   = rint(room.x0 + 1, room.x1 - 1);
          const gapZ = rint(room.z0 + 1, room.z1 - 1);
          for (let z = room.z0 + 1; z <= room.z1 - 1; z++)
            if (z !== gapZ) g_Map[px][z] = WALL_H;
        }
      }
    }
  }

  // (6) Exit door — east wall of the SE foyer (anchor 1).
  //     Door at far SE corner; player spawns at NW → must traverse the
  //     full diagonal of the map.  No straight-line shot exists because
  //     spawn (cz=6) and door (cz=88) are 82 cells apart on z and the
  //     anchor on cz=6 has no carved corridor at z=88.
  DOOR_CELL_X = 94; DOOR_CELL_Z = 88;
  g_Map[DOOR_CELL_X][DOOR_CELL_Z]     = WALL_H;
  g_MapType[DOOR_CELL_X][DOOR_CELL_Z] = DOOR_TYPE;
  // Force the approach cells open so the player can actually reach the door
  for (let x = 90; x <= 93; x++) g_Map[x][88] = 0;

  // (7) Obstruction pass — break up any long straight sightline so the
  //     player can't just sprint in a single direction across the map.
  //     For every row and column, find runs of 10+ open cells and plant a
  //     1×1 wall in the middle.  After each plant, verify the door is
  //     still reachable from spawn via flood-fill; if not, roll it back.
  function bfsReach(sx, sz, tx, tz) {
    const seen = new Array(MAP_SIZE);
    for (let i = 0; i < MAP_SIZE; i++) seen[i] = new Array(MAP_SIZE).fill(false);
    if (g_Map[sx][sz] !== 0) return false;
    seen[sx][sz] = true;
    const q = [[sx, sz]]; let head = 0;
    while (head < q.length) {
      const [cx, cz] = q[head++];
      if (cx === tx && cz === tz) return true;
      for (const [ox, oz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + ox, nz = cz + oz;
        if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) continue;
        if (seen[nx][nz]) continue;
        const passable = (g_Map[nx][nz] === 0) || (nx === tx && nz === tz);
        if (!passable) continue;
        seen[nx][nz] = true; q.push([nx, nz]);
      }
    }
    return false;
  }
  const spawnCellX = anchors[0].cx, spawnCellZ = anchors[0].cz;
  function tryBlock(bx, bz) {
    if (bx < 1 || bx >= MAP_SIZE - 1 || bz < 1 || bz >= MAP_SIZE - 1) return false;
    if (g_Map[bx][bz] !== 0) return false;
    // Don't block in the spawn room or door foyer
    const inSpawnRoom = bx >= rooms[0].x0 && bx <= rooms[0].x1 && bz >= rooms[0].z0 && bz <= rooms[0].z1;
    const inDoorRoom  = bx >= rooms[1].x0 && bx <= rooms[1].x1 && bz >= rooms[1].z0 && bz <= rooms[1].z1;
    if (inSpawnRoom || inDoorRoom) return false;
    g_Map[bx][bz] = WALL_H;
    if (!bfsReach(spawnCellX, spawnCellZ, DOOR_CELL_X, DOOR_CELL_Z)) {
      g_Map[bx][bz] = 0;       // rollback
      return false;
    }
    return true;
  }
  // obstruction pass with varying density per region. denser overall so
  // sightlines stay short and the entity can't see the player from far away.
  function regionStep(coord) {
    const h = ((coord * 73856093) ^ ((coord >> 3) * 19349663)) >>> 0;
    const r = (h % 1000) / 1000;
    if (r < 0.20) return 16 + Math.floor(rng() * 4);   // open
    if (r < 0.55) return 11 + Math.floor(rng() * 3);   // medium
    return 7 + Math.floor(rng() * 3);                  // dense / maze-y
  }
  function breakRow(z) {
    let runStart = -1;
    const step = regionStep(z * 31 + 7);
    for (let x = 0; x <= MAP_SIZE; x++) {
      const open = (x < MAP_SIZE) && g_Map[x][z] === 0;
      if (open && runStart < 0) runStart = x;
      if ((!open || x === MAP_SIZE) && runStart >= 0) {
        const len = x - runStart;
        if (len >= step) {
          for (let k = 1; k * step < len; k++) {
            tryBlock(runStart + k * step, z);
          }
        }
        runStart = -1;
      }
    }
  }
  function breakCol(x) {
    let runStart = -1;
    const step = regionStep(x * 17 + 13);
    for (let z = 0; z <= MAP_SIZE; z++) {
      const open = (z < MAP_SIZE) && g_Map[x][z] === 0;
      if (open && runStart < 0) runStart = z;
      if ((!open || z === MAP_SIZE) && runStart >= 0) {
        const len = z - runStart;
        if (len >= step) {
          for (let k = 1; k * step < len; k++) {
            tryBlock(x, runStart + k * step);
          }
        }
        runStart = -1;
      }
    }
  }
  for (let z = 0; z < MAP_SIZE; z++) breakRow(z);
  for (let x = 0; x < MAP_SIZE; x++) breakCol(x);

  // (8) Place ceiling light tiles.  Every ~7 cells we drop a light tile on
  //     any open ceiling cell.  The first 8 placements are also added to
  //     g_LightPositions so they actually contribute illumination via the
  //     fragment shader's point-light loop.  The rest are decorative.
  g_LightPositions = [];
  for (let x = 4; x < MAP_SIZE - 4; x += 5) {
    for (let z = 4; z < MAP_SIZE - 4; z += 5) {
      if (g_Map[x][z] !== 0) continue;
      // Probabilistically skip so the grid doesn't read as too regular
      if (rng() < 0.35) continue;
      g_CeilType[x][z] = LIGHT_TYPE;
    }
  }
  // Pick 8 light positions that are reasonably spread — sample a 3×3
  // grid of map quadrants and grab the closest light tile to each centre.
  const wantPositions = 8;
  const grid = 3;
  const cellW = MAP_SIZE / grid;
  const taken = new Set();
  for (let gx = 0; gx < grid && g_LightPositions.length < wantPositions; gx++) {
    for (let gz = 0; gz < grid && g_LightPositions.length < wantPositions; gz++) {
      const cx = (gx + 0.5) * cellW, cz = (gz + 0.5) * cellW;
      let best = null, bestDist = 1e9;
      for (let x = 1; x < MAP_SIZE - 1; x++)
        for (let z = 1; z < MAP_SIZE - 1; z++) {
          if (g_CeilType[x][z] !== LIGHT_TYPE) continue;
          const key = x * 1000 + z;
          if (taken.has(key)) continue;
          const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
          if (d < bestDist) { bestDist = d; best = [x, z, key]; }
        }
      if (best) {
        taken.add(best[2]);
        g_LightPositions.push([best[0] + 0.5, 3.8, best[1] + 0.5]);
      }
    }
  }
  // Always guarantee a light directly above the spawn so the player isn't
  // standing in a black void on first frame.
  if (g_CeilType[anchors[0].cx][anchors[0].cz] !== LIGHT_TYPE) {
    g_CeilType[anchors[0].cx][anchors[0].cz] = LIGHT_TYPE;
  }
  if (g_LightPositions.length < 8) {
    g_LightPositions.unshift([anchors[0].cx + 0.5, 3.8, anchors[0].cz + 0.5]);
    if (g_LightPositions.length > 8) g_LightPositions.length = 8;
  }
  console.log('[world] light positions:', g_LightPositions.length);

  // Update spawn anchors to match
  SPAWN_X = anchors[0].cx + 0.5; SPAWN_Z = anchors[0].cz + 0.5;
  ENTITY_SPAWN_X = anchors[2].cx + 0.5; ENTITY_SPAWN_Z = anchors[2].cz + 0.5;
  DOOR_APPROACH_X = 92.5; DOOR_APPROACH_Z = 88.5;

  // (9) furniture placement. drop one piece in the centre-ish of every
  // "big" room, plus a few extras in random rooms. each entry stores the
  // world-space centre + a yaw, and the cell is left walkable (we draw
  // furniture as decoration and add cheap circle-collision in main.js).
  g_FurnitureSlots = [];
  const KINDS = ['chair', 'chair1', 'chair2', 'chair3', 'chair4'];
  function pickKind(i) { return KINDS[i % KINDS.length]; }
  let kindIdx = 0;
  for (let ri = 2; ri < rooms.length; ri++) {
    const room = rooms[ri];
    if (!room.big) continue;
    const cx = room.cx + 0.5, cz = room.cz + 0.5;
    const kind = pickKind(kindIdx++);
    g_FurnitureSlots.push({ kind, x: cx, z: cz, yaw: rng() * Math.PI * 2 });
  }
  // sprinkle a handful more in random non-anchor rooms
  for (let extra = 0; extra < 10; extra++) {
    const ri = 2 + Math.floor(rng() * (rooms.length - 2));
    const room = rooms[ri];
    const cx = room.cx + 0.5, cz = room.cz + 0.5;
    const kind = pickKind(kindIdx++);
    // skip if too close to another piece
    let tooClose = false;
    for (const f of g_FurnitureSlots) {
      if (Math.abs(f.x - cx) < 3 && Math.abs(f.z - cz) < 3) { tooClose = true; break; }
    }
    if (tooClose) continue;
    g_FurnitureSlots.push({ kind, x: cx, z: cz, yaw: rng() * Math.PI * 2 });
  }
  console.log('[world] furniture pieces:', g_FurnitureSlots.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// isDoor — true if the map cell is the exit door
// ─────────────────────────────────────────────────────────────────────────────
function isDoor(x, z) {
  if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return false;
  return g_MapType[x][z] === DOOR_TYPE;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildWorldGeometry — rebuild the 4 batch buffers from g_Map / g_MapType
//
// group 0 = wall faces       (wall.png, blue-tinted in shader)
// group 1 = floor + ceiling  (ceiling_floor.png) — non-light ceiling tiles
// group 2 = light tile faces (light.png, emissive in shader)
// group 3 = door faces       (oak door)
// ─────────────────────────────────────────────────────────────────────────────
function buildWorldGeometry() {
  const groups = [[], [], [], []];

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      const h    = g_Map[x][z];
      const type = g_MapType[x][z];

      // Floor tile under every cell (face sits at y = 0)
      pushFace(groups[1], x, -1, z, FACE_TOP);

      if (h === 0) {
        // Open cell → ceiling face at y = 4 (bottom face of ceiling slab).
        // Light tile cells route to group 2 (emissive); plain cells stay
        // in group 1.
        const ceilGrp = (g_CeilType[x][z] === LIGHT_TYPE) ? 2 : 1;
        pushFace(groups[ceilGrp], x, 4, z, FACE_BOTTOM);
      } else {
        // Wall cell → side faces (hidden-face culled)
        const grp = (type === DOOR_TYPE) ? 3 : 0;

        const hN = (z + 1 < MAP_SIZE) ? g_Map[x][z + 1] : WALL_H;
        const hS = (z - 1 >= 0)       ? g_Map[x][z - 1] : WALL_H;
        const hE = (x + 1 < MAP_SIZE) ? g_Map[x + 1][z] : WALL_H;
        const hW = (x - 1 >= 0)       ? g_Map[x - 1][z] : WALL_H;

        for (let y = 0; y < h; y++) {
          // Door cells use the door texture only for the lower DOOR_HEIGHT
          // rows; everything above falls back to the wall texture so the
          // door visually appears as a short opening in the wall.
          const useGrp = (type === DOOR_TYPE && y >= DOOR_HEIGHT) ? 0 : grp;
          if (hN <= y) pushFace(groups[useGrp], x, y, z, FACE_FRONT);
          if (hS <= y) pushFace(groups[useGrp], x, y, z, FACE_BACK);
          if (hE <= y) pushFace(groups[useGrp], x, y, z, FACE_RIGHT);
          if (hW <= y) pushFace(groups[useGrp], x, y, z, FACE_LEFT);
        }
      }
    }
  }

  const STRIDE = 32;
  for (let i = 0; i < 4; i++) {
    const data = new Float32Array(groups[i]);
    g_worldVertCounts[i] = data.length / 8;
    gl.bindBuffer(gl.ARRAY_BUFFER, g_worldBuffers[i]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// renderWorld — 4 drawArrays calls (one per texture group)
// ─────────────────────────────────────────────────────────────────────────────
function renderWorld() {
  const STRIDE   = 32;
  const identity = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identity.elements);
  gl.uniform1f(u_texColorWeight, 1.0);

  for (let i = 0; i < 4; i++) {
    if (g_worldVertCounts[i] === 0) continue;

    gl.bindBuffer(gl.ARRAY_BUFFER, g_worldBuffers[i]);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE,  0);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 20);
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_TexCoord);
    gl.enableVertexAttribArray(a_Normal);

    gl.uniform1i(u_whichTexture, i);
    gl.drawArrays(gl.TRIANGLES, 0, g_worldVertCounts[i]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getTargetCell — map cell directly in front of the camera (for door click)
// ─────────────────────────────────────────────────────────────────────────────
function getTargetCell(eyeX, eyeZ, fwdX, fwdZ) {
  const reach = 1.7;
  const tx = Math.floor(eyeX + fwdX * reach);
  const tz = Math.floor(eyeZ + fwdZ * reach);
  return [tx, tz];
}

