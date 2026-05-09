// ─────────────────────────────────────────────────────────────────────────────
// cube.js — Single-cube VBO + per-face vertex data helpers
//
// Provides two things:
//   1. A reusable interleaved WebGL buffer for a unit cube centred at the
//      origin (used by skybox, animal body parts, etc.).
//   2. pushFace() — appends one face (6 vertices × 8 floats) to a plain JS
//      array; used by world.js during batch geometry construction.
//
// Vertex layout (stride = 32 bytes):
//   offset  0 : position  (3 × float)
//   offset 12 : texCoord  (2 × float)
//   offset 20 : normal    (3 × float)
// ─────────────────────────────────────────────────────────────────────────────

// ── Face indices ──────────────────────────────────────────────────────────────
const FACE_FRONT  = 0;  // +Z
const FACE_BACK   = 1;  // -Z
const FACE_LEFT   = 2;  // -X
const FACE_RIGHT  = 3;  // +X
const FACE_TOP    = 4;  // +Y
const FACE_BOTTOM = 5;  // -Y

// Per-face outward normals [nx, ny, nz]
const FACE_NORMALS = [
  [ 0,  0,  1],  // FRONT
  [ 0,  0, -1],  // BACK
  [-1,  0,  0],  // LEFT
  [ 1,  0,  0],  // RIGHT
  [ 0,  1,  0],  // TOP
  [ 0, -1,  0],  // BOTTOM
];

// Per-face vertex offsets for a (0,0,0)→(1,1,1) cube.
// Each entry is [dx, dy, dz, u, v].  Six vertices per face (2 triangles).
// UV: u along local-X of the face, v along local-Y (up).
const FACE_VERTS = [
  // FRONT (+Z)  — face plane at z+1
  [[0,0,1, 0,0],[1,0,1, 1,0],[1,1,1, 1,1],[0,0,1, 0,0],[1,1,1, 1,1],[0,1,1, 0,1]],
  // BACK (-Z)   — face plane at z
  [[1,0,0, 0,0],[0,0,0, 1,0],[0,1,0, 1,1],[1,0,0, 0,0],[0,1,0, 1,1],[1,1,0, 0,1]],
  // LEFT (-X)   — face plane at x
  [[0,0,0, 0,0],[0,0,1, 1,0],[0,1,1, 1,1],[0,0,0, 0,0],[0,1,1, 1,1],[0,1,0, 0,1]],
  // RIGHT (+X)  — face plane at x+1
  [[1,0,1, 0,0],[1,0,0, 1,0],[1,1,0, 1,1],[1,0,1, 0,0],[1,1,0, 1,1],[1,1,1, 0,1]],
  // TOP (+Y)    — face plane at y+1
  [[0,1,0, 0,0],[1,1,0, 1,0],[1,1,1, 1,1],[0,1,0, 0,0],[1,1,1, 1,1],[0,1,1, 0,1]],
  // BOTTOM (-Y) — face plane at y
  [[0,0,1, 0,0],[1,0,1, 1,0],[1,0,0, 1,1],[0,0,1, 0,0],[1,0,0, 1,1],[0,0,0, 0,1]],
];

// ─────────────────────────────────────────────────────────────────────────────
// pushFace — append one cube face (6 verts × 8 floats) to a JS array.
//   arr  : target plain JS array (push-style)
//   bx, by, bz : integer block origin in world space
//   face : FACE_* constant
// ─────────────────────────────────────────────────────────────────────────────
function pushFace(arr, bx, by, bz, face) {
  const n  = FACE_NORMALS[face];
  const vs = FACE_VERTS[face];
  for (let i = 0; i < 6; i++) {
    const v = vs[i];
    arr.push(
      bx + v[0], by + v[1], bz + v[2],  // position
      v[3], v[4],                        // UV
      n[0], n[1], n[2]                   // normal
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-cube VBO — unit cube centred at origin, all 6 faces with UVs/normals.
// Used for per-object draws: skybox, animal body parts.
// ─────────────────────────────────────────────────────────────────────────────

// 36 vertices × 8 floats = 288 values  (pre-computed, never changes)
const SINGLE_CUBE_DATA = new Float32Array([
  // ── FRONT (+Z) ──
  -0.5,-0.5, 0.5,  0,0,  0, 0, 1,
   0.5,-0.5, 0.5,  1,0,  0, 0, 1,
   0.5, 0.5, 0.5,  1,1,  0, 0, 1,
  -0.5,-0.5, 0.5,  0,0,  0, 0, 1,
   0.5, 0.5, 0.5,  1,1,  0, 0, 1,
  -0.5, 0.5, 0.5,  0,1,  0, 0, 1,
  // ── BACK (-Z) ──
   0.5,-0.5,-0.5,  0,0,  0, 0,-1,
  -0.5,-0.5,-0.5,  1,0,  0, 0,-1,
  -0.5, 0.5,-0.5,  1,1,  0, 0,-1,
   0.5,-0.5,-0.5,  0,0,  0, 0,-1,
  -0.5, 0.5,-0.5,  1,1,  0, 0,-1,
   0.5, 0.5,-0.5,  0,1,  0, 0,-1,
  // ── LEFT (-X) ──
  -0.5,-0.5,-0.5,  0,0, -1, 0, 0,
  -0.5,-0.5, 0.5,  1,0, -1, 0, 0,
  -0.5, 0.5, 0.5,  1,1, -1, 0, 0,
  -0.5,-0.5,-0.5,  0,0, -1, 0, 0,
  -0.5, 0.5, 0.5,  1,1, -1, 0, 0,
  -0.5, 0.5,-0.5,  0,1, -1, 0, 0,
  // ── RIGHT (+X) ──
   0.5,-0.5, 0.5,  0,0,  1, 0, 0,
   0.5,-0.5,-0.5,  1,0,  1, 0, 0,
   0.5, 0.5,-0.5,  1,1,  1, 0, 0,
   0.5,-0.5, 0.5,  0,0,  1, 0, 0,
   0.5, 0.5,-0.5,  1,1,  1, 0, 0,
   0.5, 0.5, 0.5,  0,1,  1, 0, 0,
  // ── TOP (+Y) ──
  -0.5, 0.5,-0.5,  0,0,  0, 1, 0,
   0.5, 0.5,-0.5,  1,0,  0, 1, 0,
   0.5, 0.5, 0.5,  1,1,  0, 1, 0,
  -0.5, 0.5,-0.5,  0,0,  0, 1, 0,
   0.5, 0.5, 0.5,  1,1,  0, 1, 0,
  -0.5, 0.5, 0.5,  0,1,  0, 1, 0,
  // ── BOTTOM (-Y) ──
  -0.5,-0.5, 0.5,  0,0,  0,-1, 0,
   0.5,-0.5, 0.5,  1,0,  0,-1, 0,
   0.5,-0.5,-0.5,  1,1,  0,-1, 0,
  -0.5,-0.5, 0.5,  0,0,  0,-1, 0,
   0.5,-0.5,-0.5,  1,1,  0,-1, 0,
  -0.5,-0.5,-0.5,  0,1,  0,-1, 0,
]);

var g_singleCubeBuffer = null;

function initSingleCubeBuffer() {
  g_singleCubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_singleCubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, SINGLE_CUBE_DATA, gl.STATIC_DRAW);
}

// Bind the single-cube buffer and set all three vertex attribute pointers.
// Call this once before any sequence of single-cube draws.
function bindSingleCubeBuffer() {
  const STRIDE = 32; // 8 floats × 4 bytes
  gl.bindBuffer(gl.ARRAY_BUFFER, g_singleCubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE,  0);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, STRIDE, 12);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 20);
  gl.enableVertexAttribArray(a_Position);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.enableVertexAttribArray(a_Normal);
}
