// entity.js — Backrooms bacteria entity
//
// Pipeline:
//   • initEntityModel()          — uploads a VBO per body part (head, body,
//                                   arm_left, arm_right, leg_left, leg_right)
//                                   plus a fallback VBO for the merged mesh.
//   • updateEntity(dt)           — BFS-based maze pathfinding (recomputed once
//                                   per second), with smooth per-frame steering
//                                   toward the next path cell. Walls collide.
//   • drawEntity(seconds)        — hierarchical render using a matrix stack;
//                                   body is the root, the other 4 parts are
//                                   children animated by animSystem.js.
//   • getEntityDist()            — XZ distance to the player.
// ─────────────────────────────────────────────────────────────────────────────

const ENTITY_SPEED       = 2.4;     // base units/sec (player walk = 5.0)
const ENTITY_BURST_MULT  = 1.20;    // speed bump when player is in line of sight
const ENTITY_BURST_RANGE = 9.0;     // sightline distance for burst trigger
const ENTITY_RADIUS  = 0.28;
// Spawn anchors are filled in by initMap(); fall back to far-corner defaults.
function _entitySpawnX() { return (typeof ENTITY_SPAWN_X !== 'undefined') ? ENTITY_SPAWN_X : 60.5; }
function _entitySpawnZ() { return (typeof ENTITY_SPAWN_Z !== 'undefined') ? ENTITY_SPAWN_Z : 60.5; }

// ── OBJ-space placement constants (from entity_model.js or fallback) ──────
const E_OBJ_CX = (typeof ENTITY_OBJ_CX !== 'undefined') ? ENTITY_OBJ_CX : -0.124;
const E_OBJ_CY = (typeof ENTITY_OBJ_CY !== 'undefined') ? ENTITY_OBJ_CY : -0.060;
const E_OBJ_CZ = (typeof ENTITY_OBJ_CZ !== 'undefined') ? ENTITY_OBJ_CZ : -0.302;
const E_OBJ_H  = (typeof ENTITY_OBJ_H  !== 'undefined') ? ENTITY_OBJ_H  : 19.789;
// Scale model height to a noticeably tall figure (~2.4 game units —
// taller than the player's eye height of 1.62 so it looms over you).
const E_SCALE  = 2.4 / E_OBJ_H;

// ── Per-part GPU state ────────────────────────────────────────────────────
//   Each entry: { buffer: WebGLBuffer, vertCount: int }
var g_entityParts = {};            // populated by initEntityModel
var g_entityFallbackBuffer = null; // single-mesh fallback
var g_entityFallbackCount  = 0;
var g_entityLoaded         = false;

// ── Runtime state ─────────────────────────────────────────────────────────
var g_entity = {
  x: 60.5,
  z: 60.5,
  yaw: 0,            // facing angle (radians); 0 = +Z
  walkPhase: 0,      // accumulates while moving — drives anim cycle
  pathRecalcTimer: 0,
  pathDir: null,     // grid: BFS next-step lookup g_pathDir[ix][iz] = [dx,dz]
  // Per-frame state read by main.js for audio + chase logic
  vx: 0, vz: 0,      // last frame's actual displacement (for footstep gating)
  hasLOS: false,     // true when entity has unobstructed sight to player
  inChase: false,    // true while burst-speed (LOS within range)
};

var g_pathMapSize = 0;
var g_pathStepX = null;
var g_pathStepZ = null;
var g_pathSeen = null;
var g_pathQueueX = null;
var g_pathQueueZ = null;
var g_pathStamp = 1;
var g_pathTargetX = -999;
var g_pathTargetZ = -999;

function _pathIndex(x, z) {
  return x * MAP_SIZE + z;
}

function _ensurePathBuffers() {
  const total = MAP_SIZE * MAP_SIZE;
  if (g_pathMapSize === MAP_SIZE && g_pathStepX && g_pathStepX.length === total) return;
  g_pathMapSize = MAP_SIZE;
  g_pathStepX = new Int8Array(total);
  g_pathStepZ = new Int8Array(total);
  g_pathSeen = new Uint32Array(total);
  g_pathQueueX = new Int16Array(total);
  g_pathQueueZ = new Int16Array(total);
  g_pathStamp = 1;
  g_pathTargetX = -999;
  g_pathTargetZ = -999;
}

function resetEntityPath() {
  g_entity.pathDir = null;
  g_entity.pathRecalcTimer = 0;
  g_pathTargetX = -999;
  g_pathTargetZ = -999;
}

// ─────────────────────────────────────────────────────────────────────────────
// initEntityModel — upload all baked geometry to the GPU
// ─────────────────────────────────────────────────────────────────────────────
function initEntityModel() {
  // Pull the spawn coords assigned by initMap (in world.js).
  g_entity.x = _entitySpawnX();
  g_entity.z = _entitySpawnZ();

  function upload(verts, count) {
    if (!verts) return null;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    return { buffer: buf, vertCount: count };
  }

  // Per-part VBOs (only created if entity_model.js declared them).
  // NOTE: top-level `const` is NOT added to window, so we test the names
  // directly via `typeof` and reference the binding by name (not via window).
  const partSources = [
    ['body',      typeof BODY_VERTS      !== 'undefined' ? BODY_VERTS      : null, typeof BODY_VERT_COUNT      !== 'undefined' ? BODY_VERT_COUNT      : 0],
    ['head',      typeof HEAD_VERTS      !== 'undefined' ? HEAD_VERTS      : null, typeof HEAD_VERT_COUNT      !== 'undefined' ? HEAD_VERT_COUNT      : 0],
    ['arm_left',  typeof ARM_LEFT_VERTS  !== 'undefined' ? ARM_LEFT_VERTS  : null, typeof ARM_LEFT_VERT_COUNT  !== 'undefined' ? ARM_LEFT_VERT_COUNT  : 0],
    ['arm_right', typeof ARM_RIGHT_VERTS !== 'undefined' ? ARM_RIGHT_VERTS : null, typeof ARM_RIGHT_VERT_COUNT !== 'undefined' ? ARM_RIGHT_VERT_COUNT : 0],
    ['leg_left',  typeof LEG_LEFT_VERTS  !== 'undefined' ? LEG_LEFT_VERTS  : null, typeof LEG_LEFT_VERT_COUNT  !== 'undefined' ? LEG_LEFT_VERT_COUNT  : 0],
    ['leg_right', typeof LEG_RIGHT_VERTS !== 'undefined' ? LEG_RIGHT_VERTS : null, typeof LEG_RIGHT_VERT_COUNT !== 'undefined' ? LEG_RIGHT_VERT_COUNT : 0],
  ];
  for (const [name, verts, count] of partSources) {
    if (verts) g_entityParts[name] = upload(verts, count);
  }

  // Fallback merged mesh
  if (typeof ENTITY_VERTS !== 'undefined') {
    const fb = upload(ENTITY_VERTS, ENTITY_VERT_COUNT);
    if (fb) { g_entityFallbackBuffer = fb.buffer; g_entityFallbackCount = fb.vertCount; }
  }

  g_entityLoaded = (Object.keys(g_entityParts).length === 6) || (g_entityFallbackCount > 0);
  console.log('[entity] Loaded parts:', Object.keys(g_entityParts).join(', '),
              '| fallback verts:', g_entityFallbackCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wall collision
// ─────────────────────────────────────────────────────────────────────────────
function _entityBlockedAt(x, z) {
  const r = ENTITY_RADIUS;
  for (const [cx, cz] of [[x+r,z+r],[x+r,z-r],[x-r,z+r],[x-r,z-r]]) {
    const bx = Math.floor(cx), bz = Math.floor(cz);
    if (bx < 0 || bx >= MAP_SIZE || bz < 0 || bz >= MAP_SIZE) return true;
    if (g_Map[bx][bz] > 0) return true;
  }
  // furniture is also solid for the entity. only check enabled kinds.
  if (typeof g_FurnitureSlots !== 'undefined') {
    for (const f of g_FurnitureSlots) {
      if (typeof isFurnitureKindEnabled === 'function' && !isFurnitureKindEnabled(f.kind)) continue;
      const dx = x - f.x, dz = z - f.z;
      if (dx * dx + dz * dz < (0.55 + r) * (0.55 + r)) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// BFS pathfinding (simple flow-field)
// ─────────────────────────────────────────────────────────────────────────────
//   Run BFS from the player's grid cell across all reachable open cells.
//   For every visited cell store the (dx,dz) pointing toward the cell we came
//   from — i.e., the next step toward the player.  The entity then queries
//   this lookup at its current cell to choose its movement direction.
//   Cost: O(MAP_SIZE^2), but the arrays are reused so the chase does not
//   allocate thousands of tiny arrays during play.
// ─────────────────────────────────────────────────────────────────────────────
function _recomputePath() {
  _ensurePathBuffers();
  const eye = camera.eye.elements;
  const sx  = Math.floor(eye[0]);
  const sz  = Math.floor(eye[2]);
  if (sx < 0 || sx >= MAP_SIZE || sz < 0 || sz >= MAP_SIZE) return false;
  if (g_Map[sx][sz] > 0) return false;

  g_pathStamp++;
  if (g_pathStamp >= 0xFFFFFFFE) {
    g_pathSeen.fill(0);
    g_pathStamp = 1;
  }

  let head = 0, tail = 0;
  const startIdx = _pathIndex(sx, sz);
  g_pathSeen[startIdx] = g_pathStamp;
  g_pathStepX[startIdx] = 0;
  g_pathStepZ[startIdx] = 0;
  g_pathQueueX[tail] = sx;
  g_pathQueueZ[tail] = sz;
  tail++;

  while (head < tail) {
    const cx = g_pathQueueX[head];
    const cz = g_pathQueueZ[head];
    head++;

    for (let i = 0; i < 4; i++) {
      const ox = i === 0 ? 1 : i === 1 ? -1 : 0;
      const oz = i === 2 ? 1 : i === 3 ? -1 : 0;
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) continue;
      const idx = _pathIndex(nx, nz);
      if (g_pathSeen[idx] === g_pathStamp || g_Map[nx][nz] > 0) continue;
      g_pathSeen[idx] = g_pathStamp;
      g_pathStepX[idx] = cx - nx;
      g_pathStepZ[idx] = cz - nz;
      g_pathQueueX[tail] = nx;
      g_pathQueueZ[tail] = nz;
      tail++;
    }

    for (let i = 0; i < 4; i++) {
      const ox = i < 2 ? 1 : -1;
      const oz = (i & 1) ? -1 : 1;
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nx >= MAP_SIZE || nz < 0 || nz >= MAP_SIZE) continue;
      const idx = _pathIndex(nx, nz);
      if (g_pathSeen[idx] === g_pathStamp || g_Map[nx][nz] > 0) continue;
      if (g_Map[cx + ox][cz] > 0 || g_Map[cx][cz + oz] > 0) continue;
      g_pathSeen[idx] = g_pathStamp;
      g_pathStepX[idx] = cx - nx;
      g_pathStepZ[idx] = cz - nz;
      g_pathQueueX[tail] = nx;
      g_pathQueueZ[tail] = nz;
      tail++;
    }
  }
  g_pathTargetX = sx;
  g_pathTargetZ = sz;
  g_entity.pathDir = g_pathSeen;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateEntity — BFS-driven smooth chase
// ─────────────────────────────────────────────────────────────────────────────
function updateEntity(dt) {
  _ensurePathBuffers();
  const eye = camera.eye.elements;
  const playerCellX = Math.floor(eye[0]);
  const playerCellZ = Math.floor(eye[2]);
  g_entity.pathRecalcTimer -= dt;
  if (g_entity.pathRecalcTimer <= 0 || !g_entity.pathDir || playerCellX !== g_pathTargetX || playerCellZ !== g_pathTargetZ) {
    _recomputePath();
    g_entity.pathRecalcTimer = 0.35;
  }

  const los = _hasLineOfSightToPlayer();
  g_entity.hasLOS = los;

  let tgtX, tgtZ;
  if (los) {
    // Steer directly at player when we can see them — no grid snapping.
    tgtX = eye[0];
    tgtZ = eye[2];
  } else {
    const ix = Math.floor(g_entity.x), iz = Math.floor(g_entity.z);
    const inBounds = (ix >= 0 && ix < MAP_SIZE && iz >= 0 && iz < MAP_SIZE);
    const idx = inBounds ? _pathIndex(ix, iz) : -1;
    const hasStep = idx >= 0 && g_pathSeen[idx] === g_pathStamp;
    const stepX = hasStep ? g_pathStepX[idx] : 0;
    const stepZ = hasStep ? g_pathStepZ[idx] : 0;
    if (stepX !== 0 || stepZ !== 0) {
      tgtX = ix + stepX + 0.5;
      tgtZ = iz + stepZ + 0.5;
    } else {
      tgtX = eye[0];
      tgtZ = eye[2];
    }
  }

  const dx   = tgtX - g_entity.x;
  const dz   = tgtZ - g_entity.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist < 0.01) return;

  const ndx = dx / dist;
  const ndz = dz / dist;

  // The OBJ rest pose faces +X (its arm/leg pivots are spread along Z).
  // We want the model to face the movement direction, so we use
  // -atan2(ndz, ndx).  Walking +X → yaw 0 → model already facing +X.
  // Walking +Z → yaw -90° → m.rotate rolls OBJ-X round to world +Z.
  const targetYaw = -Math.atan2(ndz, ndx);
  let dyaw = targetYaw - g_entity.yaw;
  while (dyaw >  Math.PI) dyaw -= 2 * Math.PI;
  while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
  g_entity.yaw += Math.sign(dyaw) * Math.min(Math.abs(dyaw), 4.0 * dt);

  // burst when the player is close AND in line of sight (no walls between)
  let speed = ENTITY_SPEED;
  const distToPlayer = getEntityDist();
  g_entity.inChase = (distToPlayer < ENTITY_BURST_RANGE && los);
  if (g_entity.inChase) {
    speed *= ENTITY_BURST_MULT;
  }
  // round-based speed-up: every time the timer wraps in main.js,
  // g_entitySpeedMult grows by 20%. entity gets relentlessly faster.
  if (typeof g_entitySpeedMult !== 'undefined') {
    speed *= g_entitySpeedMult;
  }

  const spd = speed * dt;
  const nx  = g_entity.x + ndx * spd;
  const nz  = g_entity.z + ndz * spd;
  let moved = false;
  const prevX = g_entity.x, prevZ = g_entity.z;
  if      (!_entityBlockedAt(nx, nz))         { g_entity.x = nx; g_entity.z = nz; moved = true; }
  else if (!_entityBlockedAt(nx, g_entity.z)) { g_entity.x = nx;                  moved = true; }
  else if (!_entityBlockedAt(g_entity.x, nz)) {                  g_entity.z = nz; moved = true; }
  g_entity.vx = g_entity.x - prevX;
  g_entity.vz = g_entity.z - prevZ;
  if (!moved) g_entity.pathRecalcTimer = 0;

  if (moved) g_entity.walkPhase += dt;
}

// ─────────────────────────────────────────────────────────────────────────────// _hasLineOfSightToPlayer — cheap grid raycast (DDA) from entity to camera
// ───────────────────────────────────────────────────────────────────────────────
function _hasLineOfSightToPlayer() {
  const eye = camera.eye.elements;
  const x0 = g_entity.x,     z0 = g_entity.z;
  const x1 = eye[0],          z1 = eye[2];
  const dx = x1 - x0,         dz = z1 - z0;
  const distSq = dx * dx + dz * dz;
  if (distSq > 24 * 24) return false;
  const dist = Math.sqrt(distSq);
  const steps = Math.ceil(dist / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = Math.floor(x0 + dx * t);
    const sz = Math.floor(z0 + dz * t);
    if (sx < 0 || sx >= MAP_SIZE || sz < 0 || sz >= MAP_SIZE) return false;
    if (g_Map[sx][sz] > 0) return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────// getEntityDist — Euclidean XZ distance to camera
// ─────────────────────────────────────────────────────────────────────────────
function getEntityDist() {
  const eye = camera.eye.elements;
  const dx  = eye[0] - g_entity.x;
  const dz  = eye[2] - g_entity.z;
  return Math.sqrt(dx*dx + dz*dz);
}

// ─────────────────────────────────────────────────────────────────────────────
// drawEntity — hierarchical rendering with a manual matrix stack
// ─────────────────────────────────────────────────────────────────────────────
//   Hierarchy:           body (root)
//                       /  |  |  |  \
//                    head arm arm leg leg
//
//   Pipeline per frame:
//     1. Build the world transform M_world that places the entity in the
//        scene (yaw, scale, OBJ centering).
//     2. Get body's animated local matrix from animSystem → M_body.
//     3. Push M_world; multiply by M_body; draw body geometry.
//     4. For each child: push, multiply parent by child's animated matrix,
//        draw child geometry, pop.
//     5. Pop the body matrix.
// ─────────────────────────────────────────────────────────────────────────────

const E_MESH_COLOR = [0.06, 0.22, 0.04, 1.0];   // dark fleshy green
var g_entityWorldMatrix = new Matrix4();
var g_entityBodyLocalMatrix = new Matrix4();
var g_entityBodyMatrix = new Matrix4();
var g_entityChildLocalMatrix = new Matrix4();
var g_entityChildMatrix = new Matrix4();
var g_entityFallbackMatrix = new Matrix4();
const ENTITY_CHILDREN = ['head', 'arm_left', 'arm_right', 'leg_left', 'leg_right'];

function _bindPart(part) {
  const p = g_entityParts[part];
  if (!p) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
  const stride = 32;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride,  0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, stride, 20);
  gl.enableVertexAttribArray(a_Normal);
  return p;
}
function _drawMesh(part) {
  const p = _bindPart(part);
  if (p) gl.drawArrays(gl.TRIANGLES, 0, p.vertCount);
}

// World-placement matrix (entity position, yaw, scale, centering).
// Vertices in the OBJ are Y-up, feet at Y=0 (height ≈ 19.79 OBJ units).
function _entityWorldMatrix() {
  const yawDeg = g_entity.yaw * (180 / Math.PI);
  const m = g_entityWorldMatrix.setIdentity();
  m.translate(g_entity.x, 0.0, g_entity.z);
  m.rotate(yawDeg, 0, 1, 0);
  m.scale(E_SCALE, E_SCALE, E_SCALE);
  // Centre X/Z so the model stands at (g_entity.x, g_entity.z); leave feet at 0.
  m.translate(-E_OBJ_CX, -E_OBJ_CY, -E_OBJ_CZ);
  return m;
}

function _drawEntityHierarchical(seconds) {
  // `seconds` keeps head/body twitching even when stationary (creepier);
  // walkPhase would freeze the loop while idle.
  const t = seconds;

  const M_world = _entityWorldMatrix();

  // Set shader state shared by all parts
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform4fv(u_baseColor, E_MESH_COLOR);

  // ── BODY (root) ─────────────────────────────────────────────────────────
  const M_body_local = getInterpolatedTransformInto('body', t, g_entityBodyLocalMatrix);
  const M_body = g_entityBodyMatrix.set(M_world).multiply(M_body_local);
  gl.uniformMatrix4fv(u_ModelMatrix, false, M_body.elements);
  _drawMesh('body');

  // ── Children of body ────────────────────────────────────────────────────
  for (const child of ENTITY_CHILDREN) {
    const M_child_local = getInterpolatedTransformInto(child, t, g_entityChildLocalMatrix);
    const M_child = g_entityChildMatrix.set(M_body).multiply(M_child_local);
    gl.uniformMatrix4fv(u_ModelMatrix, false, M_child.elements);
    _drawMesh(child);
  }
}

// Single-mesh fallback (used until all 6 part VBOs + anim.json are loaded)
function _drawEntityFallback() {
  if (!g_entityFallbackBuffer) return;
  const yawDeg = g_entity.yaw * (180 / Math.PI);
  const m = g_entityFallbackMatrix.setIdentity();
  m.translate(g_entity.x, 0.0, g_entity.z);
  m.rotate(yawDeg, 0, 1, 0);
  m.scale(E_SCALE, E_SCALE, E_SCALE);
  m.translate(-E_OBJ_CX, -E_OBJ_CY, -E_OBJ_CZ);

  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform4fv(u_baseColor, E_MESH_COLOR);
  gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, g_entityFallbackBuffer);
  const stride = 32;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride,  0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, stride, 20);
  gl.enableVertexAttribArray(a_Normal);
  gl.drawArrays(gl.TRIANGLES, 0, g_entityFallbackCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// drawEntity — public entry point
// ─────────────────────────────────────────────────────────────────────────────
function drawEntity(seconds) {
  const haveAllParts = ['body','head','arm_left','arm_right','leg_left','leg_right']
                         .every(p => g_entityParts[p]);
  if (haveAllParts && g_animLoaded) {
    _drawEntityHierarchical(seconds);
  } else {
    _drawEntityFallback();
  }
}
