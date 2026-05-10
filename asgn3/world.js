

const LEVEL1_MAP_SIZE = 32;
const LEVEL2_MAP_SIZE = 96;
var MAP_SIZE   = LEVEL2_MAP_SIZE;
const WALL_H     = 4;
const DOOR_TYPE  = 3;
const DOOR_HEIGHT = 2;
const LIGHT_TYPE = 2;

const LEVEL_SUBURBS = 1;
const LEVEL_BACKROOMS = 2;

const INTERACT_NONE = 0;
const INTERACT_WEED = 1;
const INTERACT_SOIL_BAG = 2;
const INTERACT_WATER_CAN = 3;
const INTERACT_CAN_RETURN = 6;
const INTERACT_SIGN = 7;
const INTERACT_GARDEN_PLOT = 8;
const INTERACT_GRASS_ROW = 9;

const SUBURB_GRASS_FLOOR_TEX = 'grass.png';
const SUBURB_DOOR_BOTTOM_TEX = 'Oak_Door_(bottom_texture)_JE4_BE2.png';
const SUBURB_DOOR_TOP_TEX = 'Oak_Door_(top_texture)_JE5_BE3.png';

var SPAWN_X     = 5.5;
var SPAWN_Z     = 5.5;
var ENTITY_SPAWN_X = 48.5;
var ENTITY_SPAWN_Z = 48.5;
var DOOR_CELL_X    = 94;
var DOOR_CELL_Z    = 88;
var DOOR_APPROACH_X = 92.5;
var DOOR_APPROACH_Z = 88.5;

var g_currentLevel = LEVEL_SUBURBS;

var g_LightPositions = [];

var g_FurnitureSlots = [];

var g_Map     = [];
var g_MapType = [];
var g_CeilType = [];
var g_CollisionMap = [];
var g_InteractiveMap = [];
var g_SuburbFloorTex = [];
var g_SuburbWallTex  = [];
var g_LevelItemSlots = [];
var g_LevelModelSlots = [];
var g_levelSpawnYaw = 90;
var g_skyColor = [0.53, 0.81, 0.98, 1.0];

var g_suburbBatches = [];

var g_worldBuffers    = [null, null, null, null];
var g_worldVertCounts = [0, 0, 0, 0];
const WORLD_CHUNK_SIZE = 8;
var g_worldChunks = [];
var g_worldIdentityMatrix = null;

function _worldIdentity() {
  if (!g_worldIdentityMatrix) g_worldIdentityMatrix = new Matrix4();
  return g_worldIdentityMatrix.setIdentity();
}

const map_suburbs = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,0,0],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]
];

function _blankLayer(size, fill) {
  const layer = [];
  for (let x = 0; x < size; x++) layer[x] = new Array(size).fill(fill);
  return layer;
}

function _copyRowsToXZ(rows) {
  const size = rows.length;
  const out = _blankLayer(size, 0);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++)
      out[x][z] = rows[z][x];
  return out;
}

function initWorldBuffers() {
  for (let i = 0; i < 4; i++) {
    g_worldBuffers[i] = gl.createBuffer();
  }
}

function initLevel2Map() {
  MAP_SIZE = LEVEL2_MAP_SIZE;
  g_currentLevel = LEVEL_BACKROOMS;
  g_Map = [];
  g_MapType = [];
  g_CeilType = [];
  g_CollisionMap = _blankLayer(MAP_SIZE, 0);
  g_InteractiveMap = _blankLayer(MAP_SIZE, INTERACT_NONE);
  g_SuburbFloorTex = [];
  g_SuburbWallTex = [];
  g_LevelItemSlots = [];
  g_LevelModelSlots = [];
  g_suburbBatches = [];

  let _seed = ((Date.now() | 0) ^ 0x9E3779B1) ^ ((Math.random() * 0x7fffffff) | 0) | 1;
  function rng() {
    _seed = (_seed * 1664525 + 1013904223) | 0;
    return ((_seed >>> 0) / 0x100000000);
  }
  function rint(lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

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

  const anchors = [
    { cx:  6, cz:  6, w: 6, h: 6 },
    { cx: 90, cz: 88, w: 6, h: 6 },
    { cx: 48, cz: 48, w: 7, h: 7 },
    { cx: 88, cz:  8, w: 6, h: 6 },
    { cx:  8, cz: 88, w: 6, h: 6 },
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

  for (let k = 0; k < 20; k++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a !== b) carveCorridor(a, b);
  }

  for (let i = 0; i < rooms.length; i++) {
    const ra = rooms[i];
    const byDist = rooms
      .map((rb, j) => ({ j, d2: (ra.cx - rb.cx) * (ra.cx - rb.cx)
                                  + (ra.cz - rb.cz) * (ra.cz - rb.cz) }))
      .filter(e => e.j !== i)
      .sort((a, b) => a.d2 - b.d2);
    for (let k = 0; k < Math.min(2, byDist.length); k++) {
      carveCorridor(ra, rooms[byDist[k].j]);
    }
  }

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

    if (ri === 0 || ri === 1) continue;

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

    if (rng() < 0.10) {
      const w = room.x1 - room.x0, h = room.z1 - room.z0;
      if (w >= 4 && h >= 4) {
        if (rng() < 0.5) {

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

  DOOR_CELL_X = 94; DOOR_CELL_Z = 88;
  g_Map[DOOR_CELL_X][DOOR_CELL_Z]     = WALL_H;
  g_MapType[DOOR_CELL_X][DOOR_CELL_Z] = DOOR_TYPE;

  for (let x = 90; x <= 93; x++) {
    for (let z = 87; z <= 89; z++) g_Map[x][z] = 0;
  }
  const doorReachX = DOOR_CELL_X - 1;
  const doorReachZ = DOOR_CELL_Z;

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

    const spawnDx = bx - spawnCellX, spawnDz = bz - spawnCellZ;
    const doorDx = bx - doorReachX, doorDz = bz - doorReachZ;
    if (spawnDx * spawnDx + spawnDz * spawnDz <= 4) return false;
    if (doorDx * doorDx + doorDz * doorDz <= 4) return false;
    g_Map[bx][bz] = WALL_H;
    if (!bfsReach(spawnCellX, spawnCellZ, doorReachX, doorReachZ)) {
      g_Map[bx][bz] = 0;
      return false;
    }
    return true;
  }

  function regionStep(coord) {
    const h = ((coord * 73856093) ^ ((coord >> 3) * 19349663)) >>> 0;
    const r = (h % 1000) / 1000;
    if (r < 0.12) return 13 + Math.floor(rng() * 3);
    if (r < 0.48) return 9 + Math.floor(rng() * 3);
    return 6 + Math.floor(rng() * 3);
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

  for (let dePass = 0; dePass < 3; dePass++) {
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      for (let z = 1; z < MAP_SIZE - 1; z++) {
        if (g_Map[x][z] !== 0) continue;
        const d4 = [[1,0],[-1,0],[0,1],[0,-1]];
        let openCnt = 0;
        for (const [dx, dz] of d4) if (g_Map[x+dx][z+dz] === 0) openCnt++;
        if (openCnt > 1) continue;

        d4.sort(() => rng() - 0.5);
        for (const [dx, dz] of d4) {
          const nx = x + dx, nz = z + dz;
          if (nx < 1 || nx > MAP_SIZE-2 || nz < 1 || nz > MAP_SIZE-2) continue;
          if (g_Map[nx][nz] === 0) continue;
          g_Map[nx][nz] = 0;
          if (!bfsReach(spawnCellX, spawnCellZ, doorReachX, doorReachZ)) {
            g_Map[nx][nz] = WALL_H;
          } else {
            break;
          }
        }
      }
    }
  }

  g_Map[doorReachX][doorReachZ] = 0;
  g_Map[doorReachX][doorReachZ - 1] = WALL_H;
  g_Map[doorReachX][doorReachZ + 1] = WALL_H;
  g_MapType[doorReachX][doorReachZ - 1] = 0;
  g_MapType[doorReachX][doorReachZ + 1] = 0;

  g_LightPositions = [];
  for (let x = 4; x < MAP_SIZE - 4; x += 5) {
    for (let z = 4; z < MAP_SIZE - 4; z += 5) {
      if (g_Map[x][z] !== 0) continue;

      if (rng() < 0.35) continue;
      g_CeilType[x][z] = LIGHT_TYPE;
    }
  }

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

  if (g_CeilType[anchors[0].cx][anchors[0].cz] !== LIGHT_TYPE) {
    g_CeilType[anchors[0].cx][anchors[0].cz] = LIGHT_TYPE;
  }
  g_CeilType[doorReachX][doorReachZ] = LIGHT_TYPE;
  g_CeilType[doorReachX - 1][doorReachZ] = LIGHT_TYPE;
  g_LightPositions = g_LightPositions.filter(p => Math.abs(p[0] - (anchors[0].cx + 0.5)) > 0.01 || Math.abs(p[2] - (anchors[0].cz + 0.5)) > 0.01);
  g_LightPositions = g_LightPositions.filter(p => Math.abs(p[0] - (doorReachX + 0.5)) > 0.01 || Math.abs(p[2] - (doorReachZ + 0.5)) > 0.01);
  g_LightPositions.unshift([anchors[0].cx + 0.5, 3.8, anchors[0].cz + 0.5]);
  g_LightPositions.unshift([doorReachX + 0.5, 3.8, doorReachZ + 0.5]);
  if (g_LightPositions.length > 8) g_LightPositions.length = 8;
  console.log('[world] light positions:', g_LightPositions.length);

  SPAWN_X = anchors[0].cx + 0.5; SPAWN_Z = anchors[0].cz + 0.5;
  ENTITY_SPAWN_X = anchors[2].cx + 0.5; ENTITY_SPAWN_Z = anchors[2].cz + 0.5;
  DOOR_APPROACH_X = 92.5; DOOR_APPROACH_Z = 88.5;
  g_levelSpawnYaw = 0;
  g_skyColor = [0.92, 0.85, 0.22, 1.0];

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

  for (let extra = 0; extra < 10; extra++) {
    const ri = 2 + Math.floor(rng() * (rooms.length - 2));
    const room = rooms[ri];
    const cx = room.cx + 0.5, cz = room.cz + 0.5;
    const kind = pickKind(kindIdx++);

    let tooClose = false;
    for (const f of g_FurnitureSlots) {
      if (Math.abs(f.x - cx) < 3 && Math.abs(f.z - cz) < 3) { tooClose = true; break; }
    }
    if (tooClose) continue;
    g_FurnitureSlots.push({ kind, x: cx, z: cz, yaw: rng() * Math.PI * 2 });
  }
  console.log('[world] furniture pieces:', g_FurnitureSlots.length);
}

function initLevel1Map() {
  MAP_SIZE = LEVEL1_MAP_SIZE;
  g_currentLevel = LEVEL_SUBURBS;
  g_Map = _copyRowsToXZ(map_suburbs);
  g_MapType = _blankLayer(MAP_SIZE, 0);
  g_CeilType = _blankLayer(MAP_SIZE, 0);
  g_CollisionMap = _blankLayer(MAP_SIZE, 0);
  g_InteractiveMap = _blankLayer(MAP_SIZE, INTERACT_NONE);
  g_SuburbFloorTex = _blankLayer(MAP_SIZE, SUBURB_GRASS_FLOOR_TEX);
  g_SuburbWallTex = _blankLayer(MAP_SIZE, 'housewall.png');
  g_LevelItemSlots = [];
  g_LevelModelSlots = [];
  g_FurnitureSlots = [];
  g_suburbBatches = [];

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      if (z <= 1) g_SuburbFloorTex[x][z] = 'road.png';
      else if (z === 2) g_SuburbFloorTex[x][z] = 'sidewalk.png';
      else if (z >= 15 && z <= 16 && x >= 13 && x <= 18) g_SuburbFloorTex[x][z] = 'woodendeck.png';
      else if (z >= 17 && z <= 30 && x >= 7 && x <= 24) g_SuburbFloorTex[x][z] = 'woodendeck.png';
      else g_SuburbFloorTex[x][z] = SUBURB_GRASS_FLOOR_TEX;
      if (g_Map[x][z] > 0) g_SuburbWallTex[x][z] = 'housewall.png';
      if (x === 8 && z >= 7 && z <= 9) g_SuburbWallTex[x][z] = 'grass.png';
    }
  }

  function block(x, z) {
    if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) g_CollisionMap[x][z] = 1;
  }
  function interact(x, z, code) {
    if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) g_InteractiveMap[x][z] = code;
  }

  for (let x = 5; x <= 13; x++) { block(x, 3); block(x, 14); }
  for (let x = 18; x <= 26; x++) { block(x, 3); block(x, 14); }
  for (let z = 4; z <= 13; z++) { block(5, z); block(26, z); }
  for (let z = 3; z < MAP_SIZE; z++) { block(0, z); block(31, z); }

  g_LevelModelSlots.push({ kind: 'fence', x: 9.5,  z: 3.35,  yaw: 90, length: 9.0,  height: 1.45, color: [0.62,0.40,0.22,1] });
  g_LevelModelSlots.push({ kind: 'fence', x: 22.5, z: 3.35,  yaw: 90, length: 9.0,  height: 1.45, color: [0.62,0.40,0.22,1] });
  g_LevelModelSlots.push({ kind: 'fence', x: 9.5,  z: 14.45, yaw: 90, length: 9.0,  height: 1.45, color: [0.62,0.40,0.22,1] });
  g_LevelModelSlots.push({ kind: 'fence', x: 22.5, z: 14.45, yaw: 90, length: 9.0,  height: 1.45, color: [0.62,0.40,0.22,1] });
  g_LevelModelSlots.push({ kind: 'fence', x: 5.35,  z: 8.8,  yaw: 0,  length: 10.5, height: 1.45, color: [0.62,0.40,0.22,1] });
  g_LevelModelSlots.push({ kind: 'fence', x: 26.65, z: 8.8,  yaw: 0,  length: 10.5, height: 1.45, color: [0.62,0.40,0.22,1] });

  for (let gx = 22; gx <= 24; gx++) {
    for (let gz = 7; gz <= 8; gz++) {
      g_Map[gx][gz] = 0;
      g_SuburbFloorTex[gx][gz] = SUBURB_GRASS_FLOOR_TEX;
      g_LevelModelSlots.push({ kind: 'weeds', x: gx + 0.5, z: gz + 0.5, yaw: 0, width: 0.85, length: 0.85, height: 0.42, color: [0.28,0.70,0.22,1] });
      interact(gx, gz, INTERACT_WEED);
    }
  }

  interact(21, 6, INTERACT_SOIL_BAG);
  interact(21, 9, INTERACT_WATER_CAN);
  for (let gz = 7; gz <= 9; gz++) interact(8, gz, INTERACT_GRASS_ROW);
  g_LevelItemSlots.push({ type: 'soil_bag', x: 21, z: 6, texName: 'dirt_unwatered.png', height: 0.55, color: [0.42,0.25,0.10,1] });
  g_LevelItemSlots.push({ type: 'watering_can', x: 21, z: 9, texName: 'woodendeck.png', height: 0.45, color: [0.45,0.66,0.75,1] });

  g_LightPositions = [
    [8.0, 8.0, 8.0], [24.0, 8.0, 8.0], [16.0, 8.0, 20.0], [16.0, 8.0, 2.0]
  ];
  SPAWN_X = 15.5; SPAWN_Z = 1.5;
  ENTITY_SPAWN_X = 48.5; ENTITY_SPAWN_Z = 48.5;
  DOOR_CELL_X = -1; DOOR_CELL_Z = -1;
  DOOR_APPROACH_X = 15.5; DOOR_APPROACH_Z = 16.0;
  g_levelSpawnYaw = 90;
  g_skyColor = [0.53, 0.81, 0.98, 1.0];
}

function initLevel3Map() {
  console.warn('[world] Level 3 not yet implemented - falling back to Level 2.');
  initLevel2Map();
}

function setupBackroomsIntroSign() {
  const sx = Math.min(MAP_SIZE - 2, Math.floor(SPAWN_X + 2.0));
  const sz = Math.floor(SPAWN_Z);
  if (sx >= 0 && sx < MAP_SIZE && sz >= 0 && sz < MAP_SIZE) {
    g_Map[sx][sz] = 0;
    g_CollisionMap[sx][sz] = 1;
    g_InteractiveMap[sx][sz] = INTERACT_SIGN;
    g_LevelModelSlots.push({ kind: 'sign', x: sx + 0.5, z: sz + 0.5, yaw: 0, width: 0.22, length: 1.35, height: 1.65, texName: 'Sofa1_diff.png', color: [1,1,1,1] });
  }
}

function initMap() {
  if (g_currentLevel === LEVEL_SUBURBS) initLevel1Map();
  else if (g_currentLevel === 3) initLevel3Map();
  else initLevel2Map();
}

function loadLevel(levelID) {
  if (levelID === LEVEL_SUBURBS) {
    initLevel1Map();
  } else {
    initLevel2Map();
    setupBackroomsIntroSign();
  }

  if (camera) {
    const safeX = (levelID === LEVEL_BACKROOMS) ? 6.5 : SPAWN_X;
    const safeZ = (levelID === LEVEL_BACKROOMS) ? 6.5 : SPAWN_Z;
    camera.eye.elements[0] = safeX;
    camera.eye.elements[1] = (typeof EYE_HEIGHT !== 'undefined') ? EYE_HEIGHT : 1.62;
    camera.eye.elements[2] = safeZ;
    camera.yaw = g_levelSpawnYaw;
    camera.pitch = 0;
    if (typeof camera.updateProjectionMatrix === 'function' && typeof canvas !== 'undefined' && canvas) {
      camera.updateProjectionMatrix(canvas.width, canvas.height);
    }
    camera.updateViewMatrix();
  }

  if (typeof g_timer !== 'undefined') g_timer = ROUND_SECONDS;
  if (typeof g_entitySpeedMult !== 'undefined' && levelID === LEVEL_BACKROOMS) g_entitySpeedMult = 1.0;
  if (typeof resetEntityPath === 'function') resetEntityPath();

  buildWorldGeometry();
  if (levelID === LEVEL_BACKROOMS) {
    assignGoopTiles();
    buildGoopGeometry();
  } else {
    if (typeof g_goopFloorCells !== 'undefined') g_goopFloorCells.clear();
    if (typeof g_goopWallFaces !== 'undefined') g_goopWallFaces.clear();
    if (typeof buildGoopGeometry === 'function') buildGoopGeometry();
  }
  if (typeof uploadLightPositions === 'function') uploadLightPositions();

  if (gl) {
    if (typeof u_isBackrooms !== 'undefined') gl.uniform1i(u_isBackrooms, levelID === LEVEL_BACKROOMS ? 1 : 0);
    if (levelID === LEVEL_SUBURBS) {
      gl.clearColor(g_skyColor[0], g_skyColor[1], g_skyColor[2], 1.0);
      if (typeof applyLevelFogSettings === 'function') {
        applyLevelFogSettings();
      } else {
        if (u_fogNear) gl.uniform1f(u_fogNear, 4.0);
        if (u_fogFar)  gl.uniform1f(u_fogFar,  16.0);
        if (u_fogColor) gl.uniform3f(u_fogColor, g_skyColor[0], g_skyColor[1], g_skyColor[2]);
      }
      document.body.classList.add('level-suburbs');
      document.body.classList.remove('level-backrooms', 'level-backrooms-trapped');
      if (typeof g_ambienceEl !== 'undefined' && g_ambienceEl) g_ambienceEl.volume = 0.0;
    } else {
      gl.clearColor(FOG_R, FOG_G, FOG_B, 1.0);
      if (typeof applyLevelFogSettings === 'function') {
        applyLevelFogSettings();
      } else {
        if (u_fogNear) gl.uniform1f(u_fogNear, 1.8);
        if (u_fogFar)  gl.uniform1f(u_fogFar,  14.0);
        if (u_fogColor) gl.uniform3f(u_fogColor, FOG_R, FOG_G, FOG_B);
      }
      document.body.classList.remove('level-suburbs');
      document.body.classList.add('level-backrooms-trapped');
      if (typeof g_ambienceEl !== 'undefined' && g_ambienceEl) {
        const vol = (typeof clampAudioVolume === 'function') ? clampAudioVolume(VOL_AMBIENCE * g_masterVolume) : Math.max(0, Math.min(1, VOL_AMBIENCE * g_masterVolume));
        g_ambienceEl.volume = vol;
      }
    }
  }
}

function getInteractiveAt(x, z) {
  if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return INTERACT_NONE;
  return g_InteractiveMap[x] ? g_InteractiveMap[x][z] : INTERACT_NONE;
}

function removeInteractiveItem(x, z) {
  const code = getInteractiveAt(x, z);
  g_InteractiveMap[x][z] = code === INTERACT_WATER_CAN ? INTERACT_CAN_RETURN : INTERACT_NONE;
  g_LevelItemSlots = g_LevelItemSlots.filter(s => !(s.x === x && s.z === z && (s.type === 'soil_bag' || s.type === 'watering_can')));
  buildWorldGeometry();
}

function destroyGardenWeed(x, z) {
  if (getInteractiveAt(x, z) !== INTERACT_WEED) return false;
  g_Map[x][z] = 0;
  g_SuburbFloorTex[x][z] = SUBURB_GRASS_FLOOR_TEX;
  g_LevelModelSlots = g_LevelModelSlots.filter(s => !(s.kind === 'weeds' && Math.floor(s.x) === x && Math.floor(s.z) === z));
  g_InteractiveMap[x][z] = INTERACT_GARDEN_PLOT;
  buildWorldGeometry();
  return true;
}

function placeGardenSoil(x, z) {
  if (getInteractiveAt(x, z) !== INTERACT_GARDEN_PLOT) return false;
  g_Map[x][z] = 0;
  g_SuburbFloorTex[x][z] = 'dirt_unwatered.png';
  buildWorldGeometry();
  return true;
}

function waterGardenPlot(x, z) {
  if (getInteractiveAt(x, z) !== INTERACT_GARDEN_PLOT) return false;
  g_SuburbFloorTex[x][z] = 'dirt_watered.png';
  buildWorldGeometry();
  return true;
}

function isHedgeTaskCell(x, z) {
  return x === 8 && z >= 7 && z <= 9;
}

function breakHedgeBlock(x, z) {
  if (!isHedgeTaskCell(x, z)) return false;
  if (x === 8 && z === 8 && g_Map[x][z] > 1) g_Map[x][z] -= 1;
  else return false;
  g_SuburbWallTex[x][z] = 'grass.png';
  g_InteractiveMap[x][z] = INTERACT_GRASS_ROW;
  buildWorldGeometry();
  return true;
}

function placeHedgeBlock(x, z) {
  if (x !== 8 || (z !== 7 && z !== 9) || g_Map[x][z] >= 1) return false;
  g_Map[x][z] = 1;
  g_SuburbWallTex[x][z] = 'grass.png';
  g_InteractiveMap[x][z] = INTERACT_GRASS_ROW;
  buildWorldGeometry();
  return true;
}

function isHedgeRowComplete() {
  return g_Map[8][7] === 1 && g_Map[8][8] === 1 && g_Map[8][9] === 1;
}

function fixGrassRow() {
  for (let z = 7; z <= 9; z++) {
    g_Map[8][z] = 1;
    g_SuburbWallTex[8][z] = 'grass.png';
    g_InteractiveMap[8][z] = INTERACT_NONE;
  }
  buildWorldGeometry();
  return true;
}

function returnWateringCan(x, z) {
  g_InteractiveMap[x][z] = INTERACT_NONE;
  g_LevelItemSlots.push({ type: 'watering_can', x, z, texName: 'woodendeck.png', height: 0.45, color: [0.45,0.66,0.75,1] });
  buildWorldGeometry();
}

function isWorldBlockedCell(x, z) {
  if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return true;
  return (g_Map[x][z] > 0) || (g_CollisionMap[x] && g_CollisionMap[x][z] > 0);
}

function isDoor(x, z) {
  if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) return false;
  return g_MapType[x][z] === DOOR_TYPE;
}

function _pushCuboid(arr, x0, y0, z0, x1, y1, z1) {
  function v(x, y, z, u, vv, nx, ny, nz) { arr.push(x, y, z, u, vv, nx, ny, nz); }

  v(x0,y0,z1,0,0,0,0,1); v(x1,y0,z1,1,0,0,0,1); v(x1,y1,z1,1,1,0,0,1);
  v(x0,y0,z1,0,0,0,0,1); v(x1,y1,z1,1,1,0,0,1); v(x0,y1,z1,0,1,0,0,1);

  v(x1,y0,z0,0,0,0,0,-1); v(x0,y0,z0,1,0,0,0,-1); v(x0,y1,z0,1,1,0,0,-1);
  v(x1,y0,z0,0,0,0,0,-1); v(x0,y1,z0,1,1,0,0,-1); v(x1,y1,z0,0,1,0,0,-1);

  v(x0,y0,z0,0,0,-1,0,0); v(x0,y0,z1,1,0,-1,0,0); v(x0,y1,z1,1,1,-1,0,0);
  v(x0,y0,z0,0,0,-1,0,0); v(x0,y1,z1,1,1,-1,0,0); v(x0,y1,z0,0,1,-1,0,0);

  v(x1,y0,z1,0,0,1,0,0); v(x1,y0,z0,1,0,1,0,0); v(x1,y1,z0,1,1,1,0,0);
  v(x1,y0,z1,0,0,1,0,0); v(x1,y1,z0,1,1,1,0,0); v(x1,y1,z1,0,1,1,0,0);

  v(x0,y1,z0,0,0,0,1,0); v(x1,y1,z0,1,0,0,1,0); v(x1,y1,z1,1,1,0,1,0);
  v(x0,y1,z0,0,0,0,1,0); v(x1,y1,z1,1,1,0,1,0); v(x0,y1,z1,0,1,0,1,0);

  v(x0,y0,z1,0,0,0,-1,0); v(x1,y0,z1,1,0,0,-1,0); v(x1,y0,z0,1,1,0,-1,0);
  v(x0,y0,z1,0,0,0,-1,0); v(x1,y0,z0,1,1,0,-1,0); v(x0,y0,z0,0,1,0,-1,0);
}

function buildSuburbGeometry() {
  for (const b of g_suburbBatches) if (b.buffer) gl.deleteBuffer(b.buffer);
  g_suburbBatches = [];
  const texVerts = {};
  function arr(tex) { if (!texVerts[tex]) texVerts[tex] = []; return texVerts[tex]; }

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      pushFace(arr(g_SuburbFloorTex[x][z] || 'grass.png'), x, -1, z, FACE_TOP);
      const h = g_Map[x][z];
      if (h <= 0) continue;
      const tex = g_SuburbWallTex[x][z] || 'housewall.png';
      const hN = (z + 1 < MAP_SIZE) ? g_Map[x][z + 1] : WALL_H;
      const hS = (z - 1 >= 0)       ? g_Map[x][z - 1] : WALL_H;
      const hE = (x + 1 < MAP_SIZE) ? g_Map[x + 1][z] : WALL_H;
      const hW = (x - 1 >= 0)       ? g_Map[x - 1][z] : WALL_H;
      for (let y = 0; y < h; y++) {
        if (hN <= y) pushFace(arr(tex), x, y, z, FACE_FRONT);
        if (hS <= y) pushFace(arr(tex), x, y, z, FACE_BACK);
        if (hE <= y) pushFace(arr(tex), x, y, z, FACE_RIGHT);
        if (hW <= y) pushFace(arr(tex), x, y, z, FACE_LEFT);
        if (y === h - 1) pushFace(arr(tex), x, y, z, FACE_TOP);
      }
    }
  }

  for (let layer = 0; layer < 3; layer++) {
    const inset = layer + 1;
    _pushCuboid(arr('housewall.png'), 6 + inset, 4 + layer, 17 + inset, 26 - inset, 5 + layer, 31 - inset);
  }

  const doorZ0 = 16.92;
  const doorZ1 = 17.06;
  const doorWall = arr('housewall.png');
  _pushCuboid(doorWall, 14.00, 0.0, doorZ0, 15.00, 4.0, doorZ1);
  _pushCuboid(doorWall, 17.00, 0.0, doorZ0, 18.00, 4.0, doorZ1);
  _pushCuboid(doorWall, 15.00, 2.0, doorZ0, 17.00, 4.0, doorZ1);
  const doorBottom = arr(SUBURB_DOOR_BOTTOM_TEX);
  const doorTop = arr(SUBURB_DOOR_TOP_TEX);
  _pushCuboid(doorBottom, 15.00, 0.0, doorZ0, 15.95, 1.0, doorZ1);
  _pushCuboid(doorTop,    15.00, 1.0, doorZ0, 15.95, 2.0, doorZ1);
  _pushCuboid(doorBottom, 16.05, 0.0, doorZ0, 17.00, 1.0, doorZ1);
  _pushCuboid(doorTop,    16.05, 1.0, doorZ0, 17.00, 2.0, doorZ1);

  for (const slot of g_LevelItemSlots) {
    const tex = slot.texName || 'woodendeck.png';
    const a = arr(tex);
    if (slot.type === 'sign') {
      _pushCuboid(a, slot.x + 0.08, 0.0, slot.z + 0.15, slot.x + 0.22, slot.height, slot.z + 0.85);
    } else {
      const s = 0.55;
      const h = slot.height || 0.55;
      _pushCuboid(a, slot.x + 0.5 - s/2, 0.0, slot.z + 0.5 - s/2, slot.x + 0.5 + s/2, h, slot.z + 0.5 + s/2);
    }
  }

  for (const [texName, verts] of Object.entries(texVerts)) {
    const data = new Float32Array(verts);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    g_suburbBatches.push({ texName, buffer: buf, vertCount: data.length / 8 });
  }
}

function renderSuburbWorld() {
  const STRIDE = 32;
  const identity = _worldIdentity();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identity.elements);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform1i(u_whichTexture, 5);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);

  for (const batch of g_suburbBatches) {
    const tex = (typeof g_SuburbTexObjs !== 'undefined') ? g_SuburbTexObjs[batch.texName] : null;
    if (!tex) continue;
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE,  0);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 20);
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_TexCoord);
    gl.enableVertexAttribArray(a_Normal);
    gl.drawArrays(gl.TRIANGLES, 0, batch.vertCount);
  }
}

function clearWorldChunks() {
  if (!gl || !g_worldChunks) return;
  for (const chunk of g_worldChunks) {
    for (const buffer of chunk.buffers) if (buffer) gl.deleteBuffer(buffer);
  }
  g_worldChunks = [];
}

function appendBackroomsCellGeometry(groups, x, z) {
  const h = g_Map[x][z];
  const type = g_MapType[x][z];

  pushFace(groups[1], x, -1, z, FACE_TOP);

  if (h === 0) {
    const ceilGrp = (g_CeilType[x][z] === LIGHT_TYPE) ? 2 : 1;
    pushFace(groups[ceilGrp], x, 4, z, FACE_BOTTOM);
    return;
  }

  const grp = (type === DOOR_TYPE) ? 3 : 0;
  const hN = (z + 1 < MAP_SIZE) ? g_Map[x][z + 1] : WALL_H;
  const hS = (z - 1 >= 0)       ? g_Map[x][z - 1] : WALL_H;
  const hE = (x + 1 < MAP_SIZE) ? g_Map[x + 1][z] : WALL_H;
  const hW = (x - 1 >= 0)       ? g_Map[x - 1][z] : WALL_H;

  for (let y = 0; y < h; y++) {
    const useGrp = (type === DOOR_TYPE && y >= DOOR_HEIGHT) ? 0 : grp;
    if (hN <= y) pushFace(groups[useGrp], x, y, z, FACE_FRONT);
    if (hS <= y) pushFace(groups[useGrp], x, y, z, FACE_BACK);
    if (hE <= y) pushFace(groups[useGrp], x, y, z, FACE_RIGHT);
    if (hW <= y) pushFace(groups[useGrp], x, y, z, FACE_LEFT);
  }
}

function buildWorldGeometry() {
  clearWorldChunks();
  if (g_currentLevel === LEVEL_SUBURBS) {
    buildSuburbGeometry();
    for (let i = 0; i < 4; i++) g_worldVertCounts[i] = 0;
    return;
  }

  for (let i = 0; i < 4; i++) g_worldVertCounts[i] = 0;

  for (let cx = 0; cx < MAP_SIZE; cx += WORLD_CHUNK_SIZE) {
    for (let cz = 0; cz < MAP_SIZE; cz += WORLD_CHUNK_SIZE) {
      const xEnd = Math.min(MAP_SIZE, cx + WORLD_CHUNK_SIZE);
      const zEnd = Math.min(MAP_SIZE, cz + WORLD_CHUNK_SIZE);
      const groups = [[], [], [], []];
      for (let x = cx; x < xEnd; x++) {
        for (let z = cz; z < zEnd; z++) appendBackroomsCellGeometry(groups, x, z);
      }

      const buffers = [null, null, null, null];
      const counts = [0, 0, 0, 0];
      let total = 0;
      for (let i = 0; i < 4; i++) {
        if (groups[i].length === 0) continue;
        const data = new Float32Array(groups[i]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        buffers[i] = buffer;
        counts[i] = data.length / 8;
        g_worldVertCounts[i] += counts[i];
        total += counts[i];
      }
      if (total > 0) {
        const centerX = (cx + xEnd) * 0.5;
        const centerZ = (cz + zEnd) * 0.5;
        g_worldChunks.push({
          x0: cx,
          z0: cz,
          x1: xEnd,
          z1: zEnd,
          centerX,
          centerZ,
          radius: Math.SQRT2 * WORLD_CHUNK_SIZE * 0.5,
          buffers,
          counts,
        });
      }
    }
  }
}

function renderWorld() {
  if (g_currentLevel === LEVEL_SUBURBS) {
    renderSuburbWorld();
    return;
  }

  if (g_worldChunks && g_worldChunks.length > 0) {
    renderWorldChunks();
    return;
  }

  const STRIDE   = 32;
  const identity = _worldIdentity();
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

function isWorldChunkVisible(chunk) {
  if (typeof camera === 'undefined' || !camera) return true;
  const e = camera.eye.elements;
  const dx = chunk.centerX - e[0];
  const dz = chunk.centerZ - e[2];
  const maxDist = 17.0;
  const distLimit = maxDist + chunk.radius;
  if (dx * dx + dz * dz > distLimit * distLimit) return false;

  const fwd = (typeof camera._flatFwd === 'function') ? camera._flatFwd() : [1, 0, 0];
  const forward = dx * fwd[0] + dz * fwd[2];
  if (forward < -chunk.radius - 2.0) return false;

  const side = Math.abs(dx * fwd[2] - dz * fwd[0]);
  const sideLimit = Math.max(5.5, forward * 0.74 + chunk.radius + 3.0);
  return side <= sideLimit;
}

function renderWorldChunks() {
  const STRIDE = 32;
  const identity = _worldIdentity();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identity.elements);
  gl.uniform1f(u_texColorWeight, 1.0);

  for (const chunk of g_worldChunks) {
    if (!isWorldChunkVisible(chunk)) continue;
    for (let i = 0; i < 4; i++) {
      if (!chunk.counts[i]) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffers[i]);
      gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE,  0);
      gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, STRIDE, 12);
      gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 20);
      gl.enableVertexAttribArray(a_Position);
      gl.enableVertexAttribArray(a_TexCoord);
      gl.enableVertexAttribArray(a_Normal);

      gl.uniform1i(u_whichTexture, i);
      gl.drawArrays(gl.TRIANGLES, 0, chunk.counts[i]);
    }
  }
}

function getTargetCell(eyeX, eyeZ, fwdX, fwdZ) {
  const reach = 1.7;
  const tx = Math.floor(eyeX + fwdX * reach);
  const tz = Math.floor(eyeZ + fwdZ * reach);
  return [tx, tz];
}
