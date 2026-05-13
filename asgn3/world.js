

const LEVEL1_MAP_SIZE = 32;
const LEVEL2_MAP_SIZE = 96;
// WARNING: 128x128 map - larger than the older 96x96 Level 188 prototype.
// The eight stacked hotel floors are rendered as custom platform geometry.
const LEVEL188_MAP_SIZE = 128;
var MAP_SIZE   = LEVEL2_MAP_SIZE;
const WALL_H     = 4;
const DOOR_TYPE  = 3;
const DOOR_HEIGHT = 2;
const LIGHT_TYPE = 2;

const LEVEL_SUBURBS = 1;
const LEVEL_BACKROOMS = 2;
const LEVEL_188 = 188;

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
const LEVEL188_TURF_TEX = 'grass.png';
const LEVEL188_WALL_TEX = 'level188_wall.png';

var SPAWN_X     = 5.5;
var SPAWN_Z     = 5.5;
var ENTITY_SPAWN_X = 48.5;
var ENTITY_SPAWN_Z = 48.5;
var DOOR_CELL_X    = 94;
var DOOR_CELL_Z    = 88;
var DOOR_REACH_X   = 93; // cell coords of the approach/reach cell (random per level)
var DOOR_REACH_Z   = 88;
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
var g_Level188Platforms = [];
var g_Level188Blockers = [];
var g_Level188GroundMask = [];
var g_Level188Props = [];

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

const map_level188 = (() => {
  return Array.from({ length: LEVEL188_MAP_SIZE }, () => Array(LEVEL188_MAP_SIZE).fill(0));
})();

const LEVEL188_STORY_COUNT = 8;
const LEVEL188_STORY_H = 4.0;
const LEVEL188_STAIR_STEPS = 16;
const LEVEL188_NORTH_ROOM_DOORS = [[46.4, 49.0], [57.4, 60.0], [68.4, 71.0], [79.4, 82.0]];
const LEVEL188_EAST_ROOM_DOORS  = [[46.4, 49.0], [57.4, 60.0], [68.4, 71.0], [79.4, 82.0]];
const LEVEL188_WEST_ROOM_DOORS  = [[46.4, 49.0], [57.4, 60.0], [68.4, 71.0], [79.4, 82.0]];
const LEVEL188_LOBBY_DOOR = [[56.0, 72.0]];

function _level188AddPlatform(x0, z0, x1, z1, y, texName) {
  g_Level188Platforms.push({ x0, z0, x1, z1, y, texName: texName || 'level188_hall_floor.png' });
}

function _level188AddBlocker(x0, z0, x1, z1, y0, y1) {
  g_Level188Blockers.push({ x0, z0, x1, z1, y0, y1 });
}

function _level188AddBlockerSegment(startX, startZ, endX, endZ, y0, y1, thickness) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  if (length <= 0.001) return;
  const steps = Math.max(1, Math.ceil(length / 0.45));
  const half = (thickness || 0.45) * 0.5;
  for (let step = 0; step <= steps; step++) {
    const mix = step / steps;
    const x = startX + deltaX * mix;
    const z = startZ + deltaZ * mix;
    _level188AddBlocker(x - half, z - half, x + half, z + half, y0, y1);
  }
}

function _level188AddBlockerSegmentWithGap(startX, startZ, endX, endZ, y0, y1, thickness, gapStart, gapEnd) {
  const gap0 = Math.max(0, Math.min(1, gapStart));
  const gap1 = Math.max(gap0, Math.min(1, gapEnd));
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  if (gap0 > 0) {
    _level188AddBlockerSegment(startX, startZ, startX + deltaX * gap0, startZ + deltaZ * gap0, y0, y1, thickness);
  }
  if (gap1 < 1) {
    _level188AddBlockerSegment(startX + deltaX * gap1, startZ + deltaZ * gap1, endX, endZ, y0, y1, thickness);
  }
}

function _level188AddZBlockerWithGaps(x0, z0, x1, z1, y0, y1, gaps) {
  let cursor = x0;
  for (const [gap0, gap1] of gaps) {
    const a = Math.max(x0, gap0);
    const b = Math.min(x1, gap1);
    if (a > cursor) _level188AddBlocker(cursor, z0, a, z1, y0, y1);
    if (b > cursor) cursor = b;
  }
  if (cursor < x1) _level188AddBlocker(cursor, z0, x1, z1, y0, y1);
}

function _level188AddXBlockerWithGaps(x0, z0, x1, z1, y0, y1, gaps) {
  let cursor = z0;
  for (const [gap0, gap1] of gaps) {
    const a = Math.max(z0, gap0);
    const b = Math.min(z1, gap1);
    if (a > cursor) _level188AddBlocker(x0, cursor, x1, a, y0, y1);
    if (b > cursor) cursor = b;
  }
  if (cursor < z1) _level188AddBlocker(x0, cursor, x1, z1, y0, y1);
}

function _level188AddProp(texName, x0, z0, x1, z1, y0, y1, solid) {
  g_Level188Props.push({ texName, x0, z0, x1, z1, y0, y1 });
  if (solid) _level188AddBlocker(x0, z0, x1, z1, y0, y1);
}

function _level188SetGroundRect(x0, z0, x1, z1) {
  for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(LEVEL188_MAP_SIZE - 1, Math.ceil(x1)); x++) {
    for (let z = Math.max(0, Math.floor(z0)); z <= Math.min(LEVEL188_MAP_SIZE - 1, Math.ceil(z1)); z++) {
      g_Level188GroundMask[x][z] = true;
    }
  }
}

function _level188AddFacadeBlockers(y, side) {
  const y0 = y + 0.05;
  const y1 = y + 2.45; // only block to door-lintel height so players can walk through
  // Door arches at each room bay centre (same positions as corridor-wall doors)
  const dg = [[45.2, 46.8], [53.2, 54.8], [61.2, 62.8], [69.2, 70.8], [77.2, 78.8]];
  // Header above doorway (lintel to ceiling)
  const h0 = y + 2.45, h1 = y + 3.45;
  if (side === 'north') {
    _level188AddZBlockerWithGaps(42, 33.82, 86, 34.18, y0, y1, dg);
    _level188AddBlocker(42, 33.82, 86, 34.18, h0, h1); // solid header band
  } else if (side === 'east') {
    _level188AddXBlockerWithGaps(93.82, 42, 94.18, 86, y0, y1, dg);
    _level188AddBlocker(93.82, 42, 94.18, 86, h0, h1);
  } else if (side === 'south') {
    if (y < 0.1) {
      _level188AddZBlockerWithGaps(42, 93.82, 54, 94.18, y0, y1, dg);
      _level188AddZBlockerWithGaps(74, 93.82, 86, 94.18, y0, y1, dg);
      _level188AddBlocker(42, 93.82, 54, 94.18, h0, h1);
      _level188AddBlocker(74, 93.82, 86, 94.18, h0, h1);
    } else {
      _level188AddZBlockerWithGaps(42, 93.82, 86, 94.18, y0, y1, dg);
      _level188AddBlocker(42, 93.82, 86, 94.18, h0, h1);
    }
  } else if (side === 'west') {
    _level188AddXBlockerWithGaps(33.82, 42, 34.18, 86, y0, y1, dg);
    _level188AddBlocker(33.82, 42, 34.18, 86, h0, h1);
  }
}

function _level188BuildLayoutData() {
  g_Level188Platforms = [];
  g_Level188Blockers = [];
  g_Level188GroundMask = _blankLayer(LEVEL188_MAP_SIZE, false);

  const floorRects = [
    [42, 26, 86, 34], [94, 42, 102, 86], [42, 94, 86, 102], [26, 42, 34, 86],
    [34, 34, 48, 42], [80, 34, 94, 42], [80, 86, 94, 94], [34, 86, 48, 94]
  ];
  const storyBridges = [
    null,
    [45, 40.5, 93, 42.5],
    [85.5, 35, 87.5, 93],
    [45, 85.5, 93, 87.5],
    [40.5, 42.5, 42.5, 93],
    [45, 46.5, 93, 48.5],
    [79.5, 35, 81.5, 93],
    [45, 79.5, 93, 81.5],
  ];

  for (let story = 0; story < LEVEL188_STORY_COUNT; story++) {
    const y = story * LEVEL188_STORY_H;
    for (const r of floorRects) {
      if (story > 0 && r[0] === 34 && r[1] === 34) {
        _level188AddPlatform(45, 34, 48, 42, y, 'level188_floor_path.png');
        continue;
      }
      _level188AddPlatform(r[0], r[1], r[2], r[3], y, 'level188_floor_path.png');
      if (story === 0) _level188SetGroundRect(r[0], r[1], r[2], r[3]);
    }
    if (story > 0) {
      const b = storyBridges[story];
      _level188AddPlatform(b[0], b[1], b[2], b[3], y, 'level188_floor_path.png');
    }

    const y0 = y;
    const y1 = y + 3.1;
    _level188AddBlocker(42, 25.75, 86, 26.15, y0, y1);      // outer north wall
    _level188AddBlocker(101.85, 42, 102.25, 86, y0, y1);    // outer east wall
    if (story === 0) {
      _level188AddBlocker(42, 101.85, 54, 102.25, y0, y1);  // outer south wall, left of lobby
      _level188AddBlocker(74, 101.85, 86, 102.25, y0, y1);  // outer south wall, right of lobby
    } else {
      _level188AddBlocker(42, 101.85, 86, 102.25, y0, y1);
    }
    _level188AddBlocker(25.75, 42, 26.15, 86, y0, y1);      // outer west wall
    // Corner face blockers: NW/NE at z≈34, SW/SE at z≈94 (leave door gap where room 1 falls)
    _level188AddZBlockerWithGaps(34, 33.75, 48, 34.15, y0, y1, [[45.2, 46.8]]);  // NW north
    _level188AddBlocker(80, 33.75, 94, 34.15, y0, y1);      // NE north (no room door here)
    _level188AddBlocker(80, 93.85, 94, 94.25, y0, y1);      // SE south
    _level188AddZBlockerWithGaps(34, 93.85, 48, 94.25, y0, y1, [[45.2, 46.8]]);  // SW south
    _level188AddFacadeBlockers(y, 'north');
    _level188AddFacadeBlockers(y, 'east');
    _level188AddFacadeBlockers(y, 'south');
    _level188AddFacadeBlockers(y, 'west');
    // Corner closing walls: plug the gap between each wing pair
    _level188AddBlocker(41.85, 25.85, 42.15, 34.15, y0, y1); // NW end of north wing
    _level188AddBlocker(85.85, 25.85, 86.15, 34.15, y0, y1); // NE end of north wing
    _level188AddBlocker(93.82, 33.85, 94.18, 42.15, y0, y1); // NE corner east face
    _level188AddBlocker(93.82, 85.85, 94.18, 94.15, y0, y1); // SE corner east face
    _level188AddBlocker(85.85, 93.85, 86.15, 102.15, y0, y1);// SE end of south wing
    _level188AddBlocker(41.85, 93.85, 42.15, 102.15, y0, y1);// SW end of south wing
    _level188AddBlocker(33.82, 85.85, 34.18, 94.15, y0, y1); // SW corner west face
    _level188AddBlocker(33.82, 33.85, 34.18, 42.15, y0, y1); // NW corner west face

    // True diagonal octagon edges for the courtyard and the outer facade.
    _level188AddBlockerSegmentWithGap(52, 34, 34, 52, y0, y1, 0.55, 0.38, 0.54); // NW stair access gap
    _level188AddBlockerSegment(76, 34, 94, 52, y0, y1, 0.55);
    _level188AddBlockerSegment(94, 76, 76, 94, y0, y1, 0.55);
    _level188AddBlockerSegment(52, 94, 34, 76, y0, y1, 0.55);
    _level188AddBlockerSegment(42, 26, 26, 42, y0, y1, 0.55);
    _level188AddBlockerSegment(86, 26, 102, 42, y0, y1, 0.55);
    _level188AddBlockerSegment(102, 86, 86, 102, y0, y1, 0.55);
    _level188AddBlockerSegment(42, 102, 26, 86, y0, y1, 0.55);
  }

  // Room interiors: corridor wall + partition walls for all four wings, every story
  {
    const RMST  = [42, 50, 58, 66, 74]; // room left edges (8-unit bays)
    const DOORS = RMST.map(r => [r + 3.2, r + 4.8]); // door gap centred in each bay
    const WT = 0.2, PT = 0.1;
    for (let story = 0; story < LEVEL188_STORY_COUNT; story++) {
      const y0 = story * LEVEL188_STORY_H;
      const y1 = y0 + 3.1;
      // NORTH wing  (outer wall z=26, inner courtyard wall z=34)
      //   rooms z=26..31,  corridor z=31.2..34,  corridor wall z=31..31.2
      _level188AddZBlockerWithGaps(42, 31.0, 86, 31.0 + WT, y0, y1, DOORS);
      for (const px of [50, 58, 66, 74]) _level188AddBlocker(px - PT, 26.15, px + PT, 31.0, y0, y1);
      _level188AddBlocker(42.0, 26.15, 42.0 + WT, 31.0, y0, y1);
      _level188AddBlocker(82.0 - WT, 26.15, 82.0, 31.0, y0, y1);
      // SOUTH wing  (outer wall z=102, inner courtyard wall z=94)
      //   rooms z=97..102, corridor z=94..96.8, corridor wall z=96.8..97
      _level188AddZBlockerWithGaps(42, 97.0 - WT, 86, 97.0, y0, y1, DOORS);
      for (const px of [50, 58, 66, 74]) _level188AddBlocker(px - PT, 97.0, px + PT, 101.85, y0, y1);
      _level188AddBlocker(42.0, 97.0, 42.0 + WT, 101.85, y0, y1);
      _level188AddBlocker(82.0 - WT, 97.0, 82.0, 101.85, y0, y1);
      // EAST wing   (outer wall x=102, inner courtyard wall x=94)
      //   rooms x=97..102, corridor x=94..96.8, corridor wall x=96.8..97
      _level188AddXBlockerWithGaps(97.0 - WT, 42, 97.0, 86, y0, y1, DOORS);
      for (const pz of [50, 58, 66, 74]) _level188AddBlocker(97.0, pz - PT, 101.85, pz + PT, y0, y1);
      _level188AddBlocker(97.0, 42.0, 101.85, 42.0 + WT, y0, y1);
      _level188AddBlocker(97.0, 82.0 - WT, 101.85, 82.0, y0, y1);
      // WEST wing   (outer wall x=26, inner courtyard wall x=34)
      //   rooms x=26..31, corridor x=31.2..34, corridor wall x=31..31.2
      _level188AddXBlockerWithGaps(31.0, 42, 31.0 + WT, 86, y0, y1, DOORS);
      for (const pz of [50, 58, 66, 74]) _level188AddBlocker(26.15, pz - PT, 31.0, pz + PT, y0, y1);
      _level188AddBlocker(26.15, 42.0, 31.0, 42.0 + WT, y0, y1);
      _level188AddBlocker(26.15, 82.0 - WT, 31.0, 82.0, y0, y1);
    }
  }

  // Courtyard, lobby entrance, and compact NW stairwell are the only ground areas.
  for (let x = 28; x <= 100; x++) {
    for (let z = 28; z <= 108; z++) {
      const dx = x - 64;
      const dz = z - 64;
      // Proper regular octagon: axis-extent 30, diagonal clip at 42 (≈30*√2)
      const courtyard = Math.max(Math.abs(dx), Math.abs(dz)) <= 30 && Math.abs(dx) + Math.abs(dz) <= 42;
      if (courtyard) g_Level188GroundMask[x][z] = true;
    }
  }
  _level188SetGroundRect(54, 88, 74, 110);   // lobby from south entrance into courtyard
  _level188SetGroundRect(58, 102, 70, 118);  // short exterior threshold/entry mat
  _level188SetGroundRect(35, 35, 46, 42);    // NW stairwell core

  _level188AddBlocker(52.0, 94.0, 54.0, 112.0, 0.0, 8.0);
  _level188AddBlocker(74.0, 94.0, 76.0, 112.0, 0.0, 8.0);
  _level188AddBlocker(54.0, 110.0, 58.0, 110.35, 0.0, 8.0);
  _level188AddBlocker(70.0, 110.0, 74.0, 110.35, 0.0, 8.0);

  for (let story = 0; story < LEVEL188_STORY_COUNT; story++) {
    const y = story * LEVEL188_STORY_H;
    _level188AddBlocker(35.75, 35.75, 45.25, 35.95, y + 0.1, y + 3.35);
    _level188AddBlocker(35.75, 41.05, 39.25, 41.25, y + 0.1, y + 3.35);
    _level188AddBlocker(42.25, 41.05, 45.25, 41.25, y + 0.1, y + 3.35);
    _level188AddBlocker(35.75, 35.75, 35.95, 41.25, y + 0.1, y + 3.35);
  }

  for (let story = 0; story < LEVEL188_STORY_COUNT - 1; story++) {
    const baseY = story * LEVEL188_STORY_H;
    for (let step = 1; step <= LEVEL188_STAIR_STEPS; step++) {
      const y = baseY + step * (LEVEL188_STORY_H / LEVEL188_STAIR_STEPS);
      const x0 = 36 + (step - 1) * (9.0 / LEVEL188_STAIR_STEPS);
      const x1 = 36 + step * (9.0 / LEVEL188_STAIR_STEPS) + 0.05;
      _level188AddPlatform(x0, 36, x1, 41, y, 'level188_floor_path.png');
    }
  }
}

function level188HasGroundAt(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  return !!(g_Level188GroundMask[ix] && g_Level188GroundMask[ix][iz]);
}

function level188FloorHeightAt(x, z, eyeY) {
  if (g_currentLevel !== LEVEL_188) return 0;
  let best = 0;
  const footY = (typeof eyeY === 'number') ? eyeY - ((typeof PLAYER_EYE_HEIGHT !== 'undefined') ? PLAYER_EYE_HEIGHT : 1.62) : 999;
  const probeY = (typeof eyeY === 'number') ? footY + 0.85 : 999;
  for (const p of g_Level188Platforms) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    if (p.y <= probeY && p.y > best) best = p.y;
  }
  return best;
}

function level188HasBlockerAt(x, z, footY, bodyHeight) {
  if (g_currentLevel !== LEVEL_188) return false;
  const bodyTop = footY + bodyHeight;
  for (const b of g_Level188Blockers) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (bodyTop > b.y0 + 0.05 && footY < b.y1 - 0.05) return true;
  }
  return false;
}

function initWorldBuffers() {
  for (let i = 0; i < 4; i++) {
    g_worldBuffers[i] = gl.createBuffer();
  }
}

function initLevel2Map() {
  MAP_SIZE = LEVEL2_MAP_SIZE;
  g_currentLevel = LEVEL_BACKROOMS;
  const unlimited = (typeof g_unlimitedMode !== 'undefined' && g_unlimitedMode);
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

  const TARGET_ROOMS = unlimited ? 62 : 55;
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

  const BIG_ROOMS = unlimited ? 8 : 6;
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
    const width = (rng() < (unlimited ? 0.28 : 0.15)) ? 3 : 2;
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

  for (let k = 0; k < (unlimited ? 30 : 20); k++) {
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

    const want = unlimited ? (rng() < 0.32 ? 1 : 0) : rint(0, 1);
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

    if (rng() < (unlimited ? 0.06 : 0.10)) {
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

  // ── Randomize door: pick a room far from spawn, put the door on one of its walls ──
  {
    const spawnDX = anchors[0].cx, spawnDZ = anchors[0].cz;
    const cands = [];
    for (let ri = 1; ri < rooms.length; ri++) {
      const room = rooms[ri];
      const sdx = room.cx - spawnDX, sdz = room.cz - spawnDZ;
      if (sdx * sdx + sdz * sdz < 2200) continue; // at least ~47 cells from spawn
      // All 4 sides: wall cell is 1 step outside room edge, reach cell is room edge
      const sides = [
        { wX: room.x1 + 1, wZ: room.cz,    rX: room.x1, rZ: room.cz    },
        { wX: room.x0 - 1, wZ: room.cz,    rX: room.x0, rZ: room.cz    },
        { wX: room.cx,    wZ: room.z1 + 1, rX: room.cx, rZ: room.z1    },
        { wX: room.cx,    wZ: room.z0 - 1, rX: room.cx, rZ: room.z0    },
      ];
      for (const s of sides) {
        if (s.wX < 1 || s.wX >= MAP_SIZE - 1 || s.wZ < 1 || s.wZ >= MAP_SIZE - 1) continue;
        cands.push(s);
      }
    }
    const chosen = cands.length > 0
      ? cands[Math.floor(rng() * cands.length)]
      : { wX: 94, wZ: 88, rX: 93, rZ: 88 };
    DOOR_CELL_X = chosen.wX; DOOR_CELL_Z = chosen.wZ;
    DOOR_REACH_X = chosen.rX; DOOR_REACH_Z = chosen.rZ;
    DOOR_APPROACH_X = DOOR_REACH_X + 0.5;
    DOOR_APPROACH_Z = DOOR_REACH_Z + 0.5;
  }
  g_Map[DOOR_CELL_X][DOOR_CELL_Z]     = WALL_H;
  g_MapType[DOOR_CELL_X][DOOR_CELL_Z] = DOOR_TYPE;
  const doorReachX = DOOR_REACH_X;
  const doorReachZ = DOOR_REACH_Z;

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
    const bonus = unlimited ? 2 : 0;
    if (r < 0.12) return 13 + Math.floor(rng() * 3) + bonus;
    if (r < 0.48) return 9 + Math.floor(rng() * 3) + bonus;
    return 6 + Math.floor(rng() * 3) + bonus;
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

  for (let dePass = 0; dePass < (unlimited ? 4 : 3); dePass++) {
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

  g_Map[doorReachX][doorReachZ] = 0; // ensure approach cell is always open

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
  DOOR_APPROACH_X = DOOR_REACH_X + 0.5; DOOR_APPROACH_Z = DOOR_REACH_Z + 0.5;
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

function initLevel188Map() {
  MAP_SIZE = LEVEL188_MAP_SIZE;
  g_currentLevel = LEVEL_188;
  g_Map = _copyRowsToXZ(map_level188);
  g_MapType = _blankLayer(MAP_SIZE, 0);
  g_CeilType = _blankLayer(MAP_SIZE, 0);
  g_CollisionMap = _blankLayer(MAP_SIZE, 0);
  g_InteractiveMap = _blankLayer(MAP_SIZE, INTERACT_NONE);
  g_LevelItemSlots = [];
  g_LevelModelSlots = [];
  g_suburbBatches = [];
  g_FurnitureSlots = [];
  _level188BuildLayoutData();

  g_SuburbFloorTex = _blankLayer(MAP_SIZE, null);
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      if (!level188HasGroundAt(x + 0.5, z + 0.5)) continue;
      const dx = x - 64;
      const dz = z - 64;
      const courtyard = Math.max(Math.abs(dx), Math.abs(dz)) <= 30 && Math.abs(dx) + Math.abs(dz) <= 42;
      if (courtyard) {
        const path = Math.abs(dx) < 2 || Math.abs(dz) < 2 || Math.abs(Math.abs(dx) - Math.abs(dz)) < 1.5;
        if (dx * dx + dz * dz < 28) g_SuburbFloorTex[x][z] = 'level188_floor_center.png';
        else g_SuburbFloorTex[x][z] = path ? 'level188_floor_path.png' : 'level188_floor_turf.png';
      } else if (x >= 54 && x <= 74 && z >= 88 && z <= 110) {
        g_SuburbFloorTex[x][z] = 'level188_floor_path.png';
      } else if (x >= 58 && x <= 70 && z >= 102 && z <= 118) {
        g_SuburbFloorTex[x][z] = 'level188_floor_center.png';
      } else if (x >= 35 && x <= 46 && z >= 35 && z <= 42) {
        g_SuburbFloorTex[x][z] = 'level188_floor_path.png';
      } else {
        g_SuburbFloorTex[x][z] = 'level188_floor_path.png';
      }
      for (const p of g_Level188Platforms) {
        if (p.y !== 0) continue;
        if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) g_SuburbFloorTex[x][z] = p.texName;
      }
    }
  }

  g_SuburbWallTex = _blankLayer(MAP_SIZE, 'level188_hall_wall.png');

  g_LightPositions = [
    [64.0, 28.0, 42.0], [86.0, 20.0, 64.0], [64.0, 12.0, 86.0], [42.0, 20.0, 64.0],
    [64.0,  4.0, 64.0], [55.0, 16.0, 55.0], [73.0, 16.0, 73.0], [64.0, 6.0, 103.0],
  ];

  SPAWN_X = 64.0; SPAWN_Z = 84.0;
  ENTITY_SPAWN_X = 30.5; ENTITY_SPAWN_Z = 64.0;
  DOOR_CELL_X = -1; DOOR_CELL_Z = -1;
  DOOR_APPROACH_X = -1; DOOR_APPROACH_Z = -1;
  g_levelSpawnYaw = 90;
  g_skyColor = [0.25, 0.24, 0.22, 1.0];
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

function _backroomsSpawnCellClear(cellX, cellZ) {
  if (cellX < 1 || cellX >= MAP_SIZE - 1 || cellZ < 1 || cellZ >= MAP_SIZE - 1) return false;
  if (!g_Map[cellX] || g_Map[cellX][cellZ] !== 0) return false;
  if (g_CollisionMap[cellX] && g_CollisionMap[cellX][cellZ] > 0) return false;
  const worldX = cellX + 0.5;
  const worldZ = cellZ + 0.5;
  if (typeof g_FurnitureSlots !== 'undefined') {
    for (const slot of g_FurnitureSlots) {
      const deltaX = worldX - slot.x;
      const deltaZ = worldZ - slot.z;
      if (deltaX * deltaX + deltaZ * deltaZ < 2.25) return false;
    }
  }
  if (typeof g_LevelItemSlots !== 'undefined') {
    for (const slot of g_LevelItemSlots) {
      const deltaX = worldX - (slot.x + 0.5);
      const deltaZ = worldZ - (slot.z + 0.5);
      if (deltaX * deltaX + deltaZ * deltaZ < 2.25) return false;
    }
  }
  if (typeof g_LevelModelSlots !== 'undefined') {
    for (const slot of g_LevelModelSlots) {
      const deltaX = worldX - slot.x;
      const deltaZ = worldZ - slot.z;
      if (deltaX * deltaX + deltaZ * deltaZ < 2.25) return false;
    }
  }
  return true;
}

function _findBackroomsSafeSpawn(preferredX, preferredZ) {
  const baseX = Math.floor(preferredX);
  const baseZ = Math.floor(preferredZ);
  for (let radius = 0; radius <= 8; radius++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const cellX = baseX + offsetX;
        const cellZ = baseZ + offsetZ;
        if (_backroomsSpawnCellClear(cellX, cellZ)) return { x: cellX + 0.5, z: cellZ + 0.5 };
      }
    }
  }
  return { x: preferredX, z: preferredZ };
}

function _backroomsOpenCardinalNeighbors(cellX, cellZ, blockedX, blockedZ) {
  let count = 0;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = cellX + dx;
    const nz = cellZ + dz;
    if (nx === blockedX && nz === blockedZ) continue;
    if (nx < 1 || nx >= MAP_SIZE - 1 || nz < 1 || nz >= MAP_SIZE - 1) continue;
    if (g_Map[nx] && g_Map[nx][nz] === 0 && (!g_CollisionMap[nx] || g_CollisionMap[nx][nz] === 0)) count++;
  }
  return count;
}

function _backroomsWallCardinalNeighbors(cellX, cellZ) {
  let count = 0;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = cellX + dx;
    const nz = cellZ + dz;
    if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) { count++; continue; }
    if (!g_Map[nx] || g_Map[nx][nz] !== 0) count++;
  }
  return count;
}

function _backroomsHasPerpendicularWallCorner(cellX, cellZ) {
  const westWall = !g_Map[cellX - 1] || g_Map[cellX - 1][cellZ] !== 0;
  const eastWall = !g_Map[cellX + 1] || g_Map[cellX + 1][cellZ] !== 0;
  const northWall = !g_Map[cellX] || g_Map[cellX][cellZ - 1] !== 0;
  const southWall = !g_Map[cellX] || g_Map[cellX][cellZ + 1] !== 0;
  return (westWall || eastWall) && (northWall || southWall);
}

function _backroomsPathSurvivesBlockedCell(blockX, blockZ) {
  const startX = Math.floor(SPAWN_X);
  const startZ = Math.floor(SPAWN_Z);
  const targetX = (typeof DOOR_REACH_X !== 'undefined' && DOOR_REACH_X >= 0) ? DOOR_REACH_X : DOOR_CELL_X;
  const targetZ = (typeof DOOR_REACH_Z !== 'undefined' && DOOR_REACH_Z >= 0) ? DOOR_REACH_Z : DOOR_CELL_Z;
  if (startX === blockX && startZ === blockZ) return false;
  if (targetX === blockX && targetZ === blockZ) return false;
  const seen = _blankLayer(MAP_SIZE, false);
  const q = [[startX, startZ]];
  seen[startX][startZ] = true;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, z] = q[qi];
    if (x === targetX && z === targetZ) return true;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 1 || nx >= MAP_SIZE - 1 || nz < 1 || nz >= MAP_SIZE - 1) continue;
      if (seen[nx][nz]) continue;
      if (nx === blockX && nz === blockZ) continue;
      if (!g_Map[nx] || g_Map[nx][nz] !== 0) continue;
      if (g_CollisionMap[nx] && g_CollisionMap[nx][nz] > 0) continue;
      seen[nx][nz] = true;
      q.push([nx, nz]);
    }
  }
  return false;
}

function _backroomsIntroSignYaw(cellX, cellZ) {
  const westWall = !g_Map[cellX - 1] || g_Map[cellX - 1][cellZ] !== 0;
  const eastWall = !g_Map[cellX + 1] || g_Map[cellX + 1][cellZ] !== 0;
  const northWall = !g_Map[cellX] || g_Map[cellX][cellZ - 1] !== 0;
  const southWall = !g_Map[cellX] || g_Map[cellX][cellZ + 1] !== 0;
  if ((northWall || southWall) && !(westWall || eastWall)) return 90;
  return 0;
}

function _backroomsSignWallMount(cellX, cellZ) {
  const walls = [];
  if (!g_Map[cellX - 1] || g_Map[cellX - 1][cellZ] !== 0) walls.push({ x: cellX + 0.08, z: cellZ + 0.5, yaw: 0 });
  if (!g_Map[cellX + 1] || g_Map[cellX + 1][cellZ] !== 0) walls.push({ x: cellX + 0.92, z: cellZ + 0.5, yaw: 0 });
  if (!g_Map[cellX] || g_Map[cellX][cellZ - 1] !== 0) walls.push({ x: cellX + 0.5, z: cellZ + 0.08, yaw: 90 });
  if (!g_Map[cellX] || g_Map[cellX][cellZ + 1] !== 0) walls.push({ x: cellX + 0.5, z: cellZ + 0.92, yaw: 90 });
  return walls.length === 1 ? walls[0] : null;
}

function _findBackroomsIntroSignCell() {
  const spawnCellX = Math.floor(SPAWN_X);
  const spawnCellZ = Math.floor(SPAWN_Z);
  const candidates = [
    { x: spawnCellX + 1, z: spawnCellZ, modelX: SPAWN_X + 1.15, modelZ: SPAWN_Z, yaw: 0 },
    { x: spawnCellX + 1, z: spawnCellZ + 1, modelX: SPAWN_X + 1.15, modelZ: SPAWN_Z + 0.85, yaw: 0 },
    { x: spawnCellX + 1, z: spawnCellZ - 1, modelX: SPAWN_X + 1.15, modelZ: SPAWN_Z - 0.85, yaw: 0 },
    { x: spawnCellX, z: spawnCellZ + 1, modelX: SPAWN_X, modelZ: SPAWN_Z + 1.15, yaw: 90 },
    { x: spawnCellX, z: spawnCellZ - 1, modelX: SPAWN_X, modelZ: SPAWN_Z - 1.15, yaw: 90 },
  ];
  for (const cell of candidates) {
    if (cell.x < 1 || cell.x >= MAP_SIZE - 1 || cell.z < 1 || cell.z >= MAP_SIZE - 1) continue;
    if (!g_Map[cell.x] || g_Map[cell.x][cell.z] !== 0) continue;
    if (g_CollisionMap[cell.x] && g_CollisionMap[cell.x][cell.z] > 0) continue;
    return cell;
  }
  return null;
}

function setupBackroomsIntroSign() {
  const cell = _findBackroomsIntroSignCell();
  if (!cell) return;
  g_InteractiveMap[cell.x][cell.z] = INTERACT_SIGN;
  g_LevelModelSlots.push({ kind: 'sign', x: cell.modelX, z: cell.modelZ, yaw: cell.yaw, width: 0.12, length: 1.65, height: 1.45, texName: 'Sofa1_diff.png', color: [1,1,1,1] });
}

function initMap() {
  if (g_currentLevel === LEVEL_SUBURBS) initLevel1Map();
  else if (g_currentLevel === LEVEL_188) initLevel188Map();
  else if (g_currentLevel === 3) initLevel3Map();
  else initLevel2Map();
}

function loadLevel(levelID) {
  if (levelID === LEVEL_SUBURBS) {
    initLevel1Map();
  } else if (levelID === LEVEL_188) {
    initLevel188Map();
  } else {
    initLevel2Map();
    if (!(typeof g_unlimitedMode !== 'undefined' && g_unlimitedMode)) setupBackroomsIntroSign();
  }

  if (camera) {
    const safeSpawn = (levelID === LEVEL_BACKROOMS) ? _findBackroomsSafeSpawn(SPAWN_X, SPAWN_Z) : { x: SPAWN_X, z: SPAWN_Z };
    const safeX = safeSpawn.x;
    const safeZ = safeSpawn.z;
    const spawnCellX = Math.floor(safeX);
    const spawnCellZ = Math.floor(safeZ);
    const spawnFloor = (g_Map[spawnCellX] && typeof g_Map[spawnCellX][spawnCellZ] === 'number') ? Math.max(0, g_Map[spawnCellX][spawnCellZ]) : 0;
    camera.eye.elements[0] = safeX;
    camera.eye.elements[1] = spawnFloor + ((typeof EYE_HEIGHT !== 'undefined') ? EYE_HEIGHT : 1.62);
    camera.eye.elements[2] = safeZ;
    camera.yaw = g_levelSpawnYaw;
    camera.pitch = 0;
    camera.yVelocity = 0;
    camera.isGrounded = true;
    if (typeof g_baseEyeY !== 'undefined') g_baseEyeY = camera.eye.elements[1];
    if (typeof camera.updateProjectionMatrix === 'function' && typeof canvas !== 'undefined' && canvas) {
      camera.updateProjectionMatrix(canvas.width, canvas.height);
    }
    camera.updateViewMatrix();
  }

  if (typeof g_timer !== 'undefined') g_timer = ROUND_SECONDS;
  if (typeof g_entitySpeedMult !== 'undefined' && levelID === LEVEL_BACKROOMS && !(typeof g_unlimitedMode !== 'undefined' && g_unlimitedMode)) g_entitySpeedMult = 1.0;
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
    } else if (levelID === LEVEL_188) {
      gl.clearColor(g_skyColor[0], g_skyColor[1], g_skyColor[2], 1.0);
      if (typeof applyLevelFogSettings === 'function') {
        applyLevelFogSettings();
      } else {
        if (u_fogNear) gl.uniform1f(u_fogNear, 8.0);
        if (u_fogFar)  gl.uniform1f(u_fogFar,  120.0);
        if (u_fogColor) gl.uniform3f(u_fogColor, g_skyColor[0], g_skyColor[1], g_skyColor[2]);
      }
      document.body.classList.remove('level-suburbs', 'level-backrooms-trapped');
      document.body.classList.add('level-backrooms');
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

function _pushWallSegment(arr, startX, startZ, endX, endZ, bottomY, topY, thickness) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
  if (length <= 0.001) return;
  const normalX = -deltaZ / length;
  const normalZ = deltaX / length;
  const half = (thickness || 0.36) * 0.5;
  const p0x = startX + normalX * half, p0z = startZ + normalZ * half;
  const p1x = endX + normalX * half,   p1z = endZ + normalZ * half;
  const p2x = endX - normalX * half,   p2z = endZ - normalZ * half;
  const p3x = startX - normalX * half, p3z = startZ - normalZ * half;
  const dirX = deltaX / length;
  const dirZ = deltaZ / length;

  function vertex(x, y, z, u, vv, nx, ny, nz) { arr.push(x, y, z, u, vv, nx, ny, nz); }
  function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz) {
    vertex(ax, ay, az, 0, 0, nx, ny, nz); vertex(bx, by, bz, 1, 0, nx, ny, nz); vertex(cx, cy, cz, 1, 1, nx, ny, nz);
    vertex(ax, ay, az, 0, 0, nx, ny, nz); vertex(cx, cy, cz, 1, 1, nx, ny, nz); vertex(dx, dy, dz, 0, 1, nx, ny, nz);
  }

  quad(p0x, bottomY, p0z, p1x, bottomY, p1z, p1x, topY, p1z, p0x, topY, p0z, normalX, 0, normalZ);
  quad(p2x, bottomY, p2z, p3x, bottomY, p3z, p3x, topY, p3z, p2x, topY, p2z, -normalX, 0, -normalZ);
  quad(p1x, bottomY, p1z, p2x, bottomY, p2z, p2x, topY, p2z, p1x, topY, p1z, dirX, 0, dirZ);
  quad(p3x, bottomY, p3z, p0x, bottomY, p0z, p0x, topY, p0z, p3x, topY, p3z, -dirX, 0, -dirZ);
  quad(p0x, topY, p0z, p1x, topY, p1z, p2x, topY, p2z, p3x, topY, p3z, 0, 1, 0);
  quad(p3x, bottomY, p3z, p2x, bottomY, p2z, p1x, bottomY, p1z, p0x, bottomY, p0z, 0, -1, 0);
}

function buildSuburbGeometry() {
  for (const b of g_suburbBatches) if (b.buffer) gl.deleteBuffer(b.buffer);
  g_suburbBatches = [];
  const texVerts = {};
  function arr(tex) { if (!texVerts[tex]) texVerts[tex] = []; return texVerts[tex]; }

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      const h = g_Map[x][z];
      const floorTex = g_SuburbFloorTex[x] ? g_SuburbFloorTex[x][z] : null;
      if (g_currentLevel !== LEVEL_188) {
        pushFace(arr(floorTex || 'grass.png'), x, -1, z, FACE_TOP);
      } else if (h === 0 && floorTex) {
        pushFace(arr(floorTex), x, -1, z, FACE_TOP);
      }
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

  if (g_currentLevel === LEVEL_SUBURBS) {
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
    _pushCuboid(doorBottom, 15.00, 0.0, doorZ0, 16.00, 1.0, doorZ1);
    _pushCuboid(doorTop,    15.00, 1.0, doorZ0, 16.00, 2.0, doorZ1);
    _pushCuboid(doorBottom, 16.00, 0.0, doorZ0, 17.00, 1.0, doorZ1);
    _pushCuboid(doorTop,    16.00, 1.0, doorZ0, 17.00, 2.0, doorZ1);
  }

  if (g_currentLevel === LEVEL_188) {
    for (const p of g_Level188Platforms) {
      if (p.y <= 0.01) continue;
      _pushCuboid(arr(p.texName), p.x0, p.y - 0.08, p.z0, p.x1, p.y, p.z1);
    }

    function addWall(tex, x0, z0, x1, z1, y0, y1) {
      _pushCuboid(arr(tex), x0, y0, z0, x1, y1, z1);
    }

    function addWallSegment(tex, startX, startZ, endX, endZ, y0, y1, thickness) {
      _pushWallSegment(arr(tex), startX, startZ, endX, endZ, y0, y1, thickness || 0.36);
    }

    function addWallSegmentWithGap(tex, startX, startZ, endX, endZ, y0, y1, thickness, gapStart, gapEnd) {
      const gap0 = Math.max(0, Math.min(1, gapStart));
      const gap1 = Math.max(gap0, Math.min(1, gapEnd));
      const deltaX = endX - startX;
      const deltaZ = endZ - startZ;
      if (gap0 > 0) addWallSegment(tex, startX, startZ, startX + deltaX * gap0, startZ + deltaZ * gap0, y0, y1, thickness);
      if (gap1 < 1) addWallSegment(tex, startX + deltaX * gap1, startZ + deltaZ * gap1, endX, endZ, y0, y1, thickness);
    }

    // Inner courtyard-facing facade walls: per-story with door arches
    {
      const ifw = arr('level188_hall_wall.png');
      const dh = 2.45; // door opening height per storey
      const wh = 3.1;  // full wall height per storey
      const dg = [[45.2, 46.8], [53.2, 54.8], [61.2, 62.8], [69.2, 70.8], [77.2, 78.8]];
      for (let s = 0; s < LEVEL188_STORY_COUNT; s++) {
        const sy = s * LEVEL188_STORY_H;
        // helper: push X-span slab with x-gaps below dh and solid header above
        function ifX(x0, z0, x1, z1) {
          let cur = x0;
          for (const [g0, g1] of dg) {
            if (g1 <= x0 || g0 >= x1) continue;
            const a = Math.max(x0, g0), b = Math.min(x1, g1);
            if (a > cur) _pushCuboid(ifw, cur, sy, z0, a, sy + dh, z1);
            cur = Math.max(cur, b);
          }
          if (cur < x1) _pushCuboid(ifw, cur, sy, z0, x1, sy + dh, z1);
          _pushCuboid(ifw, x0, sy + dh, z0, x1, sy + wh, z1); // header
        }
        // helper: push Z-span slab with z-gaps below dh and solid header above
        function ifZ(x0, z0, x1, z1) {
          let cur = z0;
          for (const [g0, g1] of dg) {
            if (g1 <= z0 || g0 >= z1) continue;
            const a = Math.max(z0, g0), b = Math.min(z1, g1);
            if (a > cur) _pushCuboid(ifw, x0, sy, cur, x1, sy + dh, a);
            cur = Math.max(cur, b);
          }
          if (cur < z1) _pushCuboid(ifw, x0, sy, cur, x1, sy + dh, z1);
          _pushCuboid(ifw, x0, sy + dh, z0, x1, sy + wh, z1); // header
        }
        ifX(42, 33.86, 86, 34.04);             // N inner
        ifZ(93.96, 42, 94.14, 86);             // E inner
        if (s === 0) {
          ifX(42, 93.96, 54, 94.14);           // S inner left  (lobby gap 54..74)
          ifX(74, 93.96, 86, 94.14);           // S inner right
        } else {
          ifX(42, 93.96, 86, 94.14);           // S inner full
        }
        ifZ(33.86, 42, 34.04, 86);             // W inner
      }
      // Above-lobby centre panel (story 1 and up, x=56..72)
      for (let s = 1; s < LEVEL188_STORY_COUNT; s++) {
        // already covered by full south inner render above
      }
    }
    // NW/NE/SE/SW corner north/south faces (no door cutouts needed - these face the diagonal)
    {
      const cf = arr('level188_hall_wall.png');
      _pushCuboid(cf, 34, 0.0, 34, 48, 31.85, 34.16);
      _pushCuboid(cf, 80, 0.0, 34, 94, 31.85, 34.16);
      _pushCuboid(cf, 80, 0.0, 93.84, 94, 31.85, 94.0);
      _pushCuboid(cf, 34, 0.0, 93.84, 48, 31.85, 94.0);
    }

    const lobbyWall = arr('level188_hall_wall.png');
    _pushCuboid(lobbyWall, 52.0, 0.0, 94.0, 54.0, 8.0, 112.0);
    _pushCuboid(lobbyWall, 74.0, 0.0, 94.0, 76.0, 8.0, 112.0);
    _pushCuboid(lobbyWall, 54.0, 0.0, 110.0, 58.0, 8.0, 110.35);
    _pushCuboid(lobbyWall, 70.0, 0.0, 110.0, 74.0, 8.0, 110.35);
    _pushCuboid(lobbyWall, 54.0, 7.15, 110.0, 74.0, 8.05, 110.35);
    _pushCuboid(arr('level188_win_warm.png'), 54.2, 0.9, 110.37, 57.7, 4.9, 110.47);
    _pushCuboid(arr('level188_win_warm.png'), 70.3, 0.9, 110.37, 73.8, 4.9, 110.47);
    _pushCuboid(arr('level188_floor_path.png'), 54.0, 8.0, 94.0, 76.0, 8.2, 110.0);
    _pushCuboid(arr('level188_win_warm.png'), 38.9, 2.35, 41.28, 42.6, 3.0, 41.38);

    function windowTex(story, index) {
      if ((story * 7 + index * 3) % 11 === 0) return 'level188_win_warm.png';
      if ((story * 5 + index * 2) % 13 === 0) return 'level188_win_cold.png';
      return 'level188_win_dark.png';
    }

    for (let story = 0; story < LEVEL188_STORY_COUNT; story++) {
      const y = story * LEVEL188_STORY_H;
      const y0 = y;
      const y1 = y + 3.1;
      const wallTex = (story % 2 === 0) ? 'level188_wall_a.png' : 'level188_wall_b.png';

      addWall(wallTex, 42, 25.75, 86, 26.15, y0, y1);
      addWall(wallTex, 101.85, 42, 102.25, 86, y0, y1);
      if (story === 0) {
        addWall(wallTex, 42, 101.85, 54, 102.25, y0, y1);
        addWall(wallTex, 74, 101.85, 86, 102.25, y0, y1);
      } else {
        addWall(wallTex, 42, 101.85, 86, 102.25, y0, y1);
      }
      addWall(wallTex, 25.75, 42, 26.15, 86, y0, y1);
      addWall(wallTex, 34, 33.75, 48, 34.15, y0, y1);
      addWall(wallTex, 80, 33.75, 94, 34.15, y0, y1);
      addWall(wallTex, 80, 93.85, 94, 94.25, y0, y1);
      addWall(wallTex, 34, 93.85, 48, 94.25, y0, y1);

      addWallSegmentWithGap('level188_hall_wall.png', 52, 34, 34, 52, y0, y1, 0.36, 0.38, 0.54);
      addWallSegment('level188_hall_wall.png', 76, 34, 94, 52, y0, y1, 0.36);
      addWallSegment('level188_hall_wall.png', 94, 76, 76, 94, y0, y1, 0.36);
      addWallSegment('level188_hall_wall.png', 52, 94, 34, 76, y0, y1, 0.36);
      addWallSegment(wallTex, 42, 26, 26, 42, y0, y1, 0.40);
      addWallSegment(wallTex, 86, 26, 102, 42, y0, y1, 0.40);
      addWallSegment(wallTex, 102, 86, 86, 102, y0, y1, 0.40);
      addWallSegment(wallTex, 42, 102, 26, 86, y0, y1, 0.40);

      // Compact stairwell shell in the northwest corner, where a hotel stair core belongs.
      addWall('level188_hall_wall.png', 35.75, 35.75, 45.25, 35.95, y + 0.1, y + 3.35);
      addWall('level188_hall_wall.png', 35.75, 41.05, 39.25, 41.25, y + 0.1, y + 3.35);
      addWall('level188_hall_wall.png', 42.25, 41.05, 45.25, 41.25, y + 0.1, y + 3.35);
      addWall('level188_hall_wall.png', 35.75, 35.75, 35.95, 41.25, y + 0.1, y + 3.35);

      const wy = y + 1.25;
      let wi = 0;
      // Outer-face windows only – one per room bay, on every exterior facade
      for (const x of [44.4, 52.4, 60.4, 68.4, 76.4]) {
        _pushCuboid(arr(windowTex(story, wi++)), x, wy, 25.86, x + 2.8, wy + 1.1, 26.08); // N outer
        _pushCuboid(arr(windowTex(story, wi++)), x, wy, 101.82, x + 2.8, wy + 1.1, 102.08);// S outer
      }
      for (const z of [44.4, 52.4, 60.4, 68.4, 76.4]) {
        _pushCuboid(arr(windowTex(story, wi++)), 25.86, wy, z, 26.08, wy + 1.1, z + 2.8); // W outer
        _pushCuboid(arr(windowTex(story, wi++)), 101.82, wy, z, 102.08, wy + 1.1, z + 2.8);// E outer
      }

    }

    const stairRail = arr('level188_railing.png');
    for (let story = 0; story < LEVEL188_STORY_COUNT - 1; story++) {
      const y = story * LEVEL188_STORY_H;
      _pushCuboid(stairRail, 36, y + 1.0, 35.92, 45.5, y + 1.12, 36.08);
      _pushCuboid(stairRail, 36, y + 1.6, 40.92, 45.5, y + 1.72, 41.08);
    }

    // ── Corner-closing visual walls (seal octagon at each wing junction) ──
    const cfac = arr('level188_hall_wall.png');
    const totalH = LEVEL188_STORY_COUNT * LEVEL188_STORY_H;
    _pushCuboid(cfac, 41.86, 0, 25.86, 42.14, totalH, 34.14); // NW end of N wing
    _pushCuboid(cfac, 85.86, 0, 25.86, 86.14, totalH, 34.14); // NE end of N wing
    _pushCuboid(cfac, 93.82, 0, 33.86, 94.18, totalH, 42.14); // NE corner E face
    _pushCuboid(cfac, 93.82, 0, 85.86, 94.18, totalH, 94.14); // SE corner E face
    _pushCuboid(cfac, 85.86, 0, 93.86, 86.14, totalH, 102.14);// SE end of S wing
    _pushCuboid(cfac, 41.86, 0, 93.86, 42.14, totalH, 102.14);// SW end of S wing
    _pushCuboid(cfac, 33.82, 0, 85.86, 34.18, totalH, 94.14); // SW corner W face
    _pushCuboid(cfac, 33.82, 0, 33.86, 34.18, totalH, 42.14); // NW corner W face

    // ── Room interiors: corridor walls + partition walls per story/wing ──
    {
      const corrTex = arr('level188_hall_wall.png');
      const partTex = arr('level188_hall_wall.png');
      const RMST  = [42, 50, 58, 66, 74];
      const WT = 0.2, PT = 0.1;

      function pushCorrWallX(x0, z0, x1, z1, y0, y1, doors) {
        let cur = x0;
        for (const [g0, g1] of doors) {
          if (g0 > cur) _pushCuboid(corrTex, cur, y0, z0, g0, y1, z1);
          cur = Math.max(cur, g1);
        }
        if (cur < x1) _pushCuboid(corrTex, cur, y0, z0, x1, y1, z1);
      }
      function pushCorrWallZ(x0, z0, x1, z1, y0, y1, doors) {
        let cur = z0;
        for (const [g0, g1] of doors) {
          if (g0 > cur) _pushCuboid(corrTex, x0, y0, cur, x1, y1, g0);
          cur = Math.max(cur, g1);
        }
        if (cur < z1) _pushCuboid(corrTex, x0, y0, cur, x1, y1, z1);
      }

      for (let story = 0; story < LEVEL188_STORY_COUNT; story++) {
        const y0 = story * LEVEL188_STORY_H;
        const y1 = y0 + 3.1;
        const doors = RMST.map(r => [r + 3.2, r + 4.8]);

        // NORTH wing: corridor wall z=31..31.2, partitions at x=[50,58,66,74]
        pushCorrWallX(42, 31.0, 86, 31.0 + WT, y0, y1, doors);
        for (const px of [50, 58, 66, 74]) _pushCuboid(partTex, px - PT, y0, 26.15, px + PT, y1, 31.0);
        _pushCuboid(partTex, 42.0, y0, 26.15, 42.0 + WT, y1, 31.0);
        _pushCuboid(partTex, 82.0 - WT, y0, 26.15, 82.0, y1, 31.0);

        // SOUTH wing: corridor wall z=96.8..97, partitions at x=[50,58,66,74]
        pushCorrWallX(42, 97.0 - WT, 86, 97.0, y0, y1, doors);
        for (const px of [50, 58, 66, 74]) _pushCuboid(partTex, px - PT, y0, 97.0, px + PT, y1, 101.85);
        _pushCuboid(partTex, 42.0, y0, 97.0, 42.0 + WT, y1, 101.85);
        _pushCuboid(partTex, 82.0 - WT, y0, 97.0, 82.0, y1, 101.85);

        // EAST wing: corridor wall x=96.8..97, partitions at z=[50,58,66,74]
        pushCorrWallZ(97.0 - WT, 42, 97.0, 86, y0, y1, doors);
        for (const pz of [50, 58, 66, 74]) _pushCuboid(partTex, 97.0, y0, pz - PT, 101.85, y1, pz + PT);
        _pushCuboid(partTex, 97.0, y0, 42.0, 101.85, y1, 42.0 + WT);
        _pushCuboid(partTex, 97.0, y0, 82.0 - WT, 101.85, y1, 82.0);

        // WEST wing: corridor wall x=31..31.2, partitions at z=[50,58,66,74]
        pushCorrWallZ(31.0, 42, 31.0 + WT, 86, y0, y1, doors);
        for (const pz of [50, 58, 66, 74]) _pushCuboid(partTex, 26.15, y0, pz - PT, 31.0, y1, pz + PT);
        _pushCuboid(partTex, 26.15, y0, 42.0, 31.0, y1, 42.0 + WT);
        _pushCuboid(partTex, 26.15, y0, 82.0 - WT, 31.0, y1, 82.0);
      }
    }

    const roofY = LEVEL188_STORY_COUNT * LEVEL188_STORY_H;
    const roof = arr('level188_lid.png');
    for (const r of [[42,26,86,34], [94,42,102,86], [42,94,86,102], [26,42,34,86], [34,34,48,42], [80,34,94,42], [80,86,94,94], [34,86,48,94]]) {
      _pushCuboid(roof, r[0], roofY, r[1], r[2], roofY + 0.25, r[3]);
    }
  }

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
  gl.uniform1i(u_emissive, 0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);

  for (const batch of g_suburbBatches) {
    const tex = (typeof g_SuburbTexObjs !== 'undefined') ? g_SuburbTexObjs[batch.texName] : null;
    if (!tex) continue;
    // Per-batch emissive: window panes + lid are self-lit; floors/walls use point lights
    if (g_currentLevel === LEVEL_188) {
      const em = /win_warm|win_cold|level188_lid/.test(batch.texName) ? 1 : 0;
      gl.uniform1i(u_emissive, em);
    }
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
  gl.uniform1i(u_emissive, 0);
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
  if (g_currentLevel === LEVEL_SUBURBS || g_currentLevel === LEVEL_188) {
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
  if (g_currentLevel === LEVEL_SUBURBS || g_currentLevel === LEVEL_188) {
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
