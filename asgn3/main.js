// ─────────────────────────────────────────────────────────────────────────────
// main.js — The Backrooms: Entity Survival  (CSE 160 Assignment 3)
//
// Responsibilities:
//   • WebGL init + shader compile
//   • 4-texture batch world rendering with ceiling/floor
//   • 60-second countdown, win (door) / lose (caught or timeout)
//   • Entity AI + proximity audio + jumpscare flash
//   • Pointer-lock mouse look (sign corrected: no inversion)
//   • WASD movement, axis-split wall collision (A/D direction corrected)
// ─────────────────────────────────────────────────────────────────────────────

// ── WebGL globals ─────────────────────────────────────────────────────────
var canvas, gl;

// Attribute locations
var a_Position, a_TexCoord, a_Normal;

// uniform locations
var u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
var u_whichTexture, u_texColorWeight, u_baseColor;
var u_time;
var u_lightPosArr;
var u_numLights;
var u_flickerEnabled;
var u_emissive;             // bool flag for self-lit pieces (tv screen)
var u_fogNear, u_fogFar, u_fogColor;
var u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3;

// game state
var camera;
var g_keys     = {};
// length of a single round before the entity speeds up and the timer resets.
// (was 180 = 3 min; using 120 to match the user's "2 minutes" wording.)
const ROUND_SECONDS  = 120.0;
var g_timer    = ROUND_SECONDS;
var g_round    = 1;            // increments on every timer wrap
var g_gameOver = false;
var g_gameWon  = false;
var g_paused   = false;        // toggled by ESC

// global multiplier on the entity's base speed. resets to 1 each new game,
// grows by ENTITY_SPEEDUP_PER_ROUND every time the round timer reaches 0.
var g_entitySpeedMult = 1.0;
const ENTITY_SPEEDUP_PER_ROUND = 0.20;

// master volume slider (0..1). multiplied into every audio source so the
// pause-menu slider rebalances ambience + footsteps + chase + wail at once.
var g_masterVolume = 1.0;

// Sprint stamina — 1.0 = full, drains while Shift is held + moving, regens otherwise
var g_sprint        = 1.0;
const SPRINT_DRAIN  = 0.32;   // per second while sprinting
const SPRINT_REGEN  = 0.18;   // per second while not sprinting
const SPRINT_MIN    = 0.08;   // can't initiate sprint below this
const SPRINT_MULT   = 1.7;    // speed multiplier while sprinting
var  g_isSprinting  = false;
// Once stamina drops to 0 the bar locks out: it slowly recharges to 100%
// and only then can the player sprint again. The HUD bar flashes slowly
// while locked to communicate the cooldown.
var  g_sprintLocked = false;

// Game doesn't truly start — timer + entity AI — until the player clicks
// the canvas to enter pointer lock. Prevents the entity from killing them
// during the "Click to enter" prompt.
var g_started = false;
// Timing
var g_lastFrameMs = 0;
var g_lastFpsMs   = 0;
var g_frameCount  = 0;
var g_seconds     = 0;

// Audio
var g_audioCtx      = null;
var g_proximityGain = null;
var g_ambienceEl    = null;   // <audio> for backrooms ambience (loops while playing)
var g_chaseEl       = null;   // <audio> for chase loop
// Footstep WebAudio buffers (decoded once)
var g_smallFootBufs = [];     // small1..4.wav (player)
var g_bigFootBufs   = [];     // big1..5.wav (entity)
var g_wailBuf       = null;   // wail.wav
// Step timers
var g_playerStepCD  = 0;
var g_entityStepCD  = 0;
var g_lastEntityX   = 0;
var g_lastEntityZ   = 0;
var g_wailCD        = 0;      // cooldown so wail doesn't spam

// User settings (from title screen checkbox)
var g_flickerEnabled = true;

// Camera bob — modulates eye Y while player is walking
var g_walkPhase   = 0;        // accumulates while moving
const BOB_AMP     = 0.045;    // metres up/down at peak
const BOB_FREQ    = 8.4;      // rad/sec — steps/sec is BOB_FREQ/(2π)·2 ≈ 2.7
var  g_baseEyeY   = 1.62;

// Fog/background colour — sickly Backrooms yellow with a faint green bias.
// Pushing G slightly above R produces the unmistakable "old fluorescent" cast.
const FOG_R = 0.78, FOG_G = 0.78, FOG_B = 0.36;

// ─────────────────────────────────────────────────────────────────────────────
// Audio mix — tweak these to rebalance everything in one place.
// All values are 0–1 multiplied by the per-event base level.
// ─────────────────────────────────────────────────────────────────────────────
const VOL_AMBIENCE        = 1.2;   // looping room tone
const VOL_CHASE_MAX       = 0.45;   // chase loop volume when entity has LOS
const VOL_WAIL            = 0.32;   // one-shot wail when entity sees player
const VOL_FOOTSTEP_PLAYER = 0.32;   // small1–4 footsteps under the player
const VOL_FOOTSTEP_ENTITY = 0.55;   // big1–5 footsteps near entity (×distance falloff)
const FOOTSTEP_ENTITY_RANGE = 28;   // metres to fade entity footsteps to silence
const WAIL_RANGE            = 22;   // only wail when player is closer than this
const WAIL_COOLDOWN_SEC     = 7.0;  // min seconds between wails

// ─────────────────────────────────────────────────────────────────────────────
// furniture toggles — set any to false to disable that model completely.
// it won't load, won't spawn, and won't block the player.
// ─────────────────────────────────────────────────────────────────────────────
const ENABLE_chair  = true;
const ENABLE_chair1 = true;
const ENABLE_chair2 = true;
const ENABLE_chair3 = true;
const ENABLE_chair4 = true;

// ─────────────────────────────────────────────────────────────────────────────
// goop arrow settings
// ─────────────────────────────────────────────────────────────────────────────
const ARROW_COUNT        = 50;   // total goop arrows placed in the map
const ARROW_WRONG_CHANCE = 0.15; // fraction pointing in wrong direction

// ─────────────────────────────────────────────────────────────────────────────
// main — entry point
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  canvas = document.getElementById('webgl');
  if (!canvas) { console.error('No canvas'); return; }

  gl = canvas.getContext('webgl');
  if (!gl) { console.error('WebGL not supported'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.error('Shader compile failed'); return;
  }

  // ── Attributes ───────────────────────────────────────────────────────────
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
  a_Normal   = gl.getAttribLocation(gl.program, 'a_Normal');

  // ── Uniforms ──────────────────────────────────────────────────────────────
  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_whichTexture     = gl.getUniformLocation(gl.program, 'u_whichTexture');
  u_texColorWeight   = gl.getUniformLocation(gl.program, 'u_texColorWeight');
  u_baseColor        = gl.getUniformLocation(gl.program, 'u_baseColor');
  u_time             = gl.getUniformLocation(gl.program, 'u_time');
  u_lightPosArr      = gl.getUniformLocation(gl.program, 'u_lightPos[0]');
  u_numLights        = gl.getUniformLocation(gl.program, 'u_numLights');
  u_flickerEnabled   = gl.getUniformLocation(gl.program, 'u_flickerEnabled');
  u_emissive         = gl.getUniformLocation(gl.program, 'u_emissive');
  u_fogNear          = gl.getUniformLocation(gl.program, 'u_fogNear');
  u_fogFar           = gl.getUniformLocation(gl.program, 'u_fogFar');
  u_fogColor         = gl.getUniformLocation(gl.program, 'u_fogColor');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1         = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2         = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_Sampler3         = gl.getUniformLocation(gl.program, 'u_Sampler3');
  u_Sampler4         = gl.getUniformLocation(gl.program, 'u_Sampler4');

  // ── GL state ──────────────────────────────────────────────────────────────
  gl.clearColor(FOG_R, FOG_G, FOG_B, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // ── Persistent uniforms ───────────────────────────────────────────────────
  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1i(u_Sampler1, 1);
  gl.uniform1i(u_Sampler2, 2);
  gl.uniform1i(u_Sampler3, 3);
  gl.uniform1i(u_Sampler4, 4);

  // flicker enabled by default. title screen checkbox can flip it.
  gl.uniform1i(u_flickerEnabled, 1);
  gl.uniform1i(u_emissive, 0);

  // Loose, deep fog so the player can never see across the 96×96 grid but
  // can comfortably see ~25 units of corridor.  Far must stay below the
  // longest-possible open run (capped to 14 by world.js obstruction pass
  // → plenty of breathing room with far=28).
  gl.uniform1f(u_fogNear,  4.0);
  gl.uniform1f(u_fogFar,  28.0);
  gl.uniform3f(u_fogColor, FOG_R, FOG_G, FOG_B);

  // ── Textures — user-supplied PNGs (with procedural fallbacks) ─────────
  loadTexture(gl.TEXTURE0, 'textures/wall.png',          'wall');
  loadTexture(gl.TEXTURE1, 'textures/ceiling_floor.png', 'ceiling_floor');
  loadTexture(gl.TEXTURE2, 'textures/light.png',         'light');
  loadTexture(gl.TEXTURE3, 'textures/Oak_Door_(bottom_texture)_JE4_BE2.png', 'door');
  loadTexture(gl.TEXTURE4, 'textures/goop_arrow.png',    'goop');

  // ── World ─────────────────────────────────────────────────────────────────
  camera = new Camera(canvas);
  initWorldBuffers();
  initMap();
  buildWorldGeometry();
  initSingleCubeBuffer();

  // goop arrow decals — generate after map is ready
  initArrowQuadBuffer();
  generateArrowSlots();

  // push the world's chosen light positions into the glsl array uniform.
  uploadLightPositions();

  // entity model + animation
  initEntityModel();
  loadAnim('anim.json');

  // furniture (chairs, sofa, tv). loaded async; renders show up once ready.
  loadFurnitureMeshes();

  // input + audio
  setupInput();
  initAudio();  setupTitleScreen();
  setupFullscreen();
  setupPauseMenu();
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// tick — per-frame update
// ─────────────────────────────────────────────────────────────────────────────
function tick(timestamp) {
  if (g_gameOver || g_gameWon) return;

  const dt = Math.min((timestamp - g_lastFrameMs) / 1000, 0.05);
  g_lastFrameMs = timestamp;

  // when paused we still render the last frame and update fps, but skip
  // anything time-driven (timer, entity ai, audio cues).
  if (!g_paused) {
    g_seconds += dt;
    if (g_started) {
      g_timer -= dt;
      // round end: reset timer, bump entity speed, do not end game.
      if (g_timer <= 0) {
        g_round++;
        g_timer = ROUND_SECONDS;
        g_entitySpeedMult += ENTITY_SPEEDUP_PER_ROUND;
        flashRoundBanner();
      }
    }
  }

  gl.uniform1f(u_time, g_seconds);
  gl.uniform1i(u_flickerEnabled, g_flickerEnabled ? 1 : 0);

  if (!g_paused) {
    processInput(dt);
    if (g_started) {
      updateEntity(dt);
      updateEntityAudio(dt);
      if (getEntityDist() < 1.5) { triggerLose(); return; }
    }
  }

  renderScene();
  updateHUD();
  updateFps(timestamp);
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// renderScene
// ─────────────────────────────────────────────────────────────────────────────
function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(u_ViewMatrix,       false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  renderWorld();
  drawGoopArrows();
  drawFurniture();
  drawEntity(g_seconds);
}

// ─────────────────────────────────────────────────────────────────────────────
// triggerLose / triggerWin
// ─────────────────────────────────────────────────────────────────────────────
function triggerLose() {
  if (g_gameOver || g_gameWon) return;
  g_gameOver = true;
  const jso = document.getElementById('jumpscareOverlay');
  jso.classList.add('active', 'flash');
  if (g_audioCtx) {
    const osc  = g_audioCtx.createOscillator();
    const gain = g_audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.4, g_audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, g_audioCtx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(g_audioCtx.destination);
    osc.start();
    osc.stop(g_audioCtx.currentTime + 0.8);
  }
  setTimeout(() => {
    jso.classList.remove('flash');
    document.getElementById('loseScreen').classList.add('active');
  }, 700);
}

function triggerWin() {
  if (g_gameOver || g_gameWon) return;
  g_gameWon = true;
  document.getElementById('winScreen').classList.add('active');
}

// pause toggle. shows / hides #pauseScreen overlay and releases pointer
// lock so the cursor is usable for clicking buttons.
function togglePause() {
  g_paused = !g_paused;
  const ps = document.getElementById('pauseScreen');
  if (ps) ps.classList.toggle('active', g_paused);
  if (g_paused && document.pointerLockElement) {
    document.exitPointerLock();
  }
}

// brief on-screen banner when the round timer wraps and the entity gets
// faster. uses the lockMsg div if present; otherwise just logs.
function flashRoundBanner() {
  const el = document.getElementById('roundBanner');
  if (!el) {
    console.log('[round] reset, entity speed mult =', g_entitySpeedMult.toFixed(2));
    return;
  }
  el.textContent = 'THE WALLS SHIFT \u2014 IT MOVES FASTER';
  el.classList.add('show');
  clearTimeout(flashRoundBanner._t);
  flashRoundBanner._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadLightPositions — push g_LightPositions (set in world.initMap)
// into the GLSL `uniform vec3 u_lightPos[8]` array.  Pads unused slots
// with zero positions; u_numLights tells the shader how many to honour.
// ─────────────────────────────────────────────────────────────────────────────
function uploadLightPositions() {
  const MAX = 8;
  const flat = new Float32Array(MAX * 3);
  const n = Math.min(g_LightPositions.length, MAX);
  for (let i = 0; i < n; i++) {
    flat[i * 3 + 0] = g_LightPositions[i][0];
    flat[i * 3 + 1] = g_LightPositions[i][1];
    flat[i * 3 + 2] = g_LightPositions[i][2];
  }
  gl.uniform3fv(u_lightPosArr, flat);
  gl.uniform1i(u_numLights, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// furniture system. each entry in g_FurnitureSlots names a 'kind' that
// maps to a definition in FURNITURE_DEFS below: which OBJ file to load,
// what colour to draw it as, target world height in metres, and whether
// it is self-lit (the tv screen flickers).
// rendered with the same shader as everything else, but with a solid
// base colour (u_texColorWeight = 0). the OBJ vertex format already
// matches the engine's interleaved layout courtesy of objLoader.parseOBJ.
// ─────────────────────────────────────────────────────────────────────────────
const FURNITURE_DEFS = {
  // chairs (variety pack from soppy prisma + the alexdizz Chair model)
  chair:      { file: 'models/Chair.obj',     color: [0.30, 0.20, 0.12, 1.0], height: 1.10, emissive: false },
  chair1:     { file: 'models/chair1.obj',    color: [0.32, 0.22, 0.14, 1.0], height: 1.10, emissive: false },
  chair2:     { file: 'models/chair2.obj',    color: [0.28, 0.18, 0.10, 1.0], height: 1.10, emissive: false },
  chair3:     { file: 'models/chair3.obj',    color: [0.34, 0.24, 0.16, 1.0], height: 1.10, emissive: false },
  chair4:     { file: 'models/chair4.obj',    color: [0.30, 0.20, 0.12, 1.0], height: 1.10, emissive: false },
};

// per-kind GPU + scale info, populated asynchronously by loadFurnitureMeshes.
//   { buffer, vertCount, scale, offsetX, offsetY, offsetZ }
var g_furnitureMeshes = {};

// goop decal arrows
var g_ArrowSlots  = [];   // [{pos,arrowRight,normal}, ...]
var g_arrowQuadBuf = null; // shared WebGL buffer for the quad
var u_Sampler4 = null;    // uniform location for goop texture

function loadFurnitureMeshes() {
  for (const kind of Object.keys(FURNITURE_DEFS)) {
    // skip kinds whose toggle is false
    const flag = 'ENABLE_' + kind;
    if (typeof window[flag] !== 'undefined' && !window[flag]) continue;
    // also skip if top-level const says disabled (const not on window in strict mode,
    // so we eval it safely — the flag names are hard-coded so this is safe)
    try { if (eval(flag) === false) continue; } catch(_) {}
    const def = FURNITURE_DEFS[kind];
    fetch(def.file)
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(txt => {
        const verts = parseOBJ(txt);
        if (!verts) { console.warn('[furniture] parse failed:', kind); return; }

        // bounding box -> uniform scale to fit the requested world height,
        // and X/Z centring offset (Y left as min so the piece sits on the floor).
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < verts.length; i += 8) {
          const x = verts[i], y = verts[i+1], z = verts[i+2];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const objH = Math.max(0.0001, maxY - minY);
        const scale = def.height / objH;

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        g_furnitureMeshes[kind] = {
          buffer: buf,
          vertCount: verts.length / 8,
          scale: scale,
          offsetX: -(minX + maxX) * 0.5,
          offsetY: -minY,
          offsetZ: -(minZ + maxZ) * 0.5,
        };
        console.log('[furniture] loaded', kind, 'verts=', verts.length / 8, 'scale=', scale.toFixed(3));
      })
      .catch(err => console.warn('[furniture] fetch failed:', kind, err));
  }
}

function drawFurniture() {
  if (typeof g_FurnitureSlots === 'undefined' || g_FurnitureSlots.length === 0) return;
  const stride = 32;
  for (const slot of g_FurnitureSlots) {
    // skip if this kind was disabled
    try { if (eval('ENABLE_' + slot.kind) === false) continue; } catch(_) {}
    const mesh = g_furnitureMeshes[slot.kind];
    if (!mesh) continue;
    const def = FURNITURE_DEFS[slot.kind];

    const m = new Matrix4();
    m.translate(slot.x, 0.0, slot.z);
    m.rotate(slot.yaw * (180 / Math.PI), 0, 1, 0);
    m.scale(mesh.scale, mesh.scale, mesh.scale);
    m.translate(mesh.offsetX, mesh.offsetY, mesh.offsetZ);

    gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
    gl.uniform1f(u_texColorWeight, 0.0);
    gl.uniform4fv(u_baseColor, def.color);
    gl.uniform1i(u_emissive, def.emissive ? 1 : 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride,  0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(a_TexCoord);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(a_Normal);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertCount);
  }
  // clear emissive flag so subsequent draws (entity, world) aren't affected.
  gl.uniform1i(u_emissive, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// goop arrow decals — alpha-blended quads smeared on floors and walls,
// pointing roughly toward the exit door.  ~15% are deliberately wrong.
// ─────────────────────────────────────────────────────────────────────────────

function _v3norm(v) {
  const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
}
function _v3cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function initArrowQuadBuffer() {
  // canonical quad: lies in XZ plane, arrow points local +X.
  // 6 vertices (2 triangles), 8 floats each: x,y,z, u,v, nx,ny,nz
  const W = 0.70, H = 0.50; // half-width, half-depth (bigger so arrows read clearly)
  const verts = new Float32Array([
    -W, 0, -H,  0,0,  0,1,0,
     W, 0, -H,  1,0,  0,1,0,
     W, 0,  H,  1,1,  0,1,0,
    -W, 0, -H,  0,0,  0,1,0,
     W, 0,  H,  1,1,  0,1,0,
    -W, 0,  H,  0,1,  0,1,0,
  ]);
  g_arrowQuadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_arrowQuadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
}

function generateArrowSlots() {
  g_ArrowSlots = [];
  if (typeof DOOR_CELL_X === 'undefined' || !g_Map) return;

  // deterministic LCG independent from world.js
  let seed = 0xCAFEBABE;
  function ar() { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 8) / 16777215; }

  const doorX = DOOR_CELL_X + 0.5;
  const doorZ = DOOR_CELL_Z + 0.5;

  // wall-face descriptors: delta to neighbor + face normal pointing INTO room
  const FACES = [
    { dcx:  0, dcz: -1, nx: 0, nz:  1 },  // north wall -> face +Z
    { dcx:  0, dcz:  1, nx: 0, nz: -1 },  // south wall -> face -Z
    { dcx: -1, dcz:  0, nx: 1, nz:  0 },  // west  wall -> face +X
    { dcx:  1, dcz:  0, nx:-1, nz:  0 },  // east  wall -> face -X
  ];

  let placed = 0, tries = 0;
  while (placed < ARROW_COUNT && tries < 9000) {
    tries++;
    const cx = 2 + Math.floor(ar() * (MAP_SIZE - 4));
    const cz = 2 + Math.floor(ar() * (MAP_SIZE - 4));
    if (g_Map[cx][cz] !== 0) continue;  // must be open floor

    const wrong = ar() < ARROW_WRONG_CHANCE;

    if (ar() < 0.62) {
      // ── floor arrow ───────────────────────────────────────────────────
      let angle = Math.atan2(doorZ - (cz + 0.5), doorX - (cx + 0.5));
      if (wrong) angle += (0.6 + ar() * 0.8) * Math.PI * (ar() < 0.5 ? 1 : -1);
      const right  = [Math.cos(angle), 0, Math.sin(angle)];
      const normal = [0, 1, 0];
      g_ArrowSlots.push({ pos: [cx + 0.5, 0.02, cz + 0.5], arrowRight: right, normal });
      placed++;
    } else {
      // ── wall arrow ────────────────────────────────────────────────────
      // shuffle face order, pick first valid wall face
      const ord = FACES.slice().sort(() => ar() - 0.5);
      for (const f of ord) {
        const wx = cx + f.dcx, wz = cz + f.dcz;
        if (wx < 0 || wz < 0 || wx >= MAP_SIZE || wz >= MAP_SIZE) continue;
        if (g_Map[wx][wz] === 0) continue; // not a wall

        // position at wall face center, slightly proud of surface
        const ax = cx + 0.5 + f.nx * (0.5 + 0.03);
        const az = cz + 0.5 + f.nz * (0.5 + 0.03);
        const ay = 1.10 + ar() * 0.35;

        // horizontal direction toward door projected onto wall plane
        // Z-facing walls extend in X; X-facing walls extend in Z.
        let rawH;
        if (Math.abs(f.nz) > 0.5) {
          // wall tangent = ±X
          rawH = [doorX - ax >= 0 ? 1 : -1, 0, 0];
        } else {
          // wall tangent = ±Z
          rawH = [0, 0, doorZ - az >= 0 ? 1 : -1];
        }
        if (wrong) { rawH[0] = -rawH[0]; rawH[2] = -rawH[2]; }

        // slight upward tilt for the classic 'exit sign' look
        const tilt = 0.08 + ar() * 0.14;
        const arrowRight = _v3norm([rawH[0], tilt, rawH[2]]);

        g_ArrowSlots.push({
          pos: [ax, ay, az],
          arrowRight,
          normal: [f.nx, 0, f.nz],
        });
        placed++;
        break;
      }
    }
  }
}

function drawGoopArrows() {
  if (!g_arrowQuadBuf || g_ArrowSlots.length === 0) return;

  const stride = 32;
  gl.bindBuffer(gl.ARRAY_BUFFER, g_arrowQuadBuf);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride,  0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, stride, 20);
  gl.enableVertexAttribArray(a_Normal);

  gl.uniform1i(u_whichTexture, 4);
  gl.uniform1f(u_texColorWeight, 1.0);
  // bright lime-green goop so it pops against the dingy carpet/walls
  gl.uniform4f(u_baseColor, 0.55, 1.0, 0.30, 1.0);

  // alpha blend for transparent arrow background
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false); // don't write depth; decals stack cleanly

  for (const slot of g_ArrowSlots) {
    const right  = slot.arrowRight;
    const norm   = slot.normal;
    const fwd    = _v3cross(right, norm); // local +Z in world space

    // build model matrix directly from basis vectors (column-major)
    const m = new Matrix4();
    const e = m.elements;
    e[0]=right[0]; e[1]=right[1]; e[2]=right[2]; e[3]=0;
    e[4]=norm[0];  e[5]=norm[1];  e[6]=norm[2];  e[7]=0;
    e[8]=fwd[0];   e[9]=fwd[1];   e[10]=fwd[2];  e[11]=0;
    e[12]=slot.pos[0]; e[13]=slot.pos[1]; e[14]=slot.pos[2]; e[15]=1;

    gl.uniformMatrix4fv(u_ModelMatrix, false, e);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // restore state
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.uniform1i(u_whichTexture, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// initAudio — sine hum + sawtooth proximity tone (legacy WebAudio)
// Audio file playback (ambience / footsteps / wail / chase) is loaded
// separately in initAudioFiles() once the user has clicked the title-screen
// ENTER button (browsers require user gesture before AudioContext.resume).
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// initAudio — just sets up an AudioContext for the file-based one-shots.
// All previously-synthesised hum / proximity sawtooth has been removed; the
// recorded ambience track and footstep WAVs replace it entirely.
// ─────────────────────────────────────────────────────────────────────────────
function initAudio() {
  try {
    g_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { console.log('Audio unavailable:', e.message); }
}

function updateProximityAudio(_dist) { /* no-op — retained for HUD callsite */ }

// ─────────────────────────────────────────────────────────────────────────────
// initAudioFiles — load ambience + footstep WAVs once user gesture
// has unlocked AudioContext. Called from the title-screen ENTER button.
// ─────────────────────────────────────────────────────────────────────────────
function initAudioFiles() {
  // (1) Ambience — looping <audio> at a quiet level so it sits under everything.
  try {
    g_ambienceEl = new Audio('audio/626096__resaural__backrooms-ambience.wav');
    g_ambienceEl.loop   = true;
    g_ambienceEl.volume = VOL_AMBIENCE * g_masterVolume;
    const p = g_ambienceEl.play();
    if (p && p.catch) p.catch(err => console.log('ambience play blocked:', err.message));
  } catch (e) { console.log('ambience unavailable:', e.message); }

  // (2) Chase loop — starts paused, played when entity has LOS.
  try {
    g_chaseEl = new Audio('audio/chase.wav');
    g_chaseEl.loop   = true;
    g_chaseEl.volume = 0.0;   // fades in when LOS
  } catch (e) { console.log('chase audio unavailable:', e.message); }

  // (3) Footstep + wail buffers via WebAudio for low-latency one-shots.
  if (!g_audioCtx) return;
  function loadBuf(url) {
    return fetch(url).then(r => r.arrayBuffer())
      .then(buf => g_audioCtx.decodeAudioData(buf))
      .catch(err => { console.log('audio load failed:', url, err.message); return null; });
  }
  Promise.all([1,2,3,4].map(i => loadBuf('audio/small' + i + '.wav')))
    .then(bufs => { g_smallFootBufs = bufs.filter(b => b); });
  Promise.all([1,2,3,4,5].map(i => loadBuf('audio/big' + i + '.wav')))
    .then(bufs => { g_bigFootBufs = bufs.filter(b => b); });
  loadBuf('audio/wail.wav').then(b => { g_wailBuf = b; });
}

// Play a one-shot WebAudio buffer at a given gain.
function playBuf(buf, gainVal) {
  if (!buf || !g_audioCtx) return;
  const src = g_audioCtx.createBufferSource();
  const g   = g_audioCtx.createGain();
  src.buffer = buf;
  g.gain.value = gainVal;
  src.connect(g); g.connect(g_audioCtx.destination);
  src.start();
}

// Update entity-side audio: distance-scaled footsteps + wail/chase on LOS.
function updateEntityAudio(dt) {
  if (!g_audioCtx) return;
  const dist = getEntityDist();

  // Entity footsteps: only play while it's actually moving.  Cadence speeds
  // up when the entity is in chase mode (LOS).  Volume fades with distance.
  if (g_entity && (g_entity.vx !== 0 || g_entity.vz !== 0)) {
    g_entityStepCD -= dt;
    if (g_entityStepCD <= 0 && g_bigFootBufs.length > 0) {
      // chase cadence is much snappier so the player can hear it gaining.
      const stride = g_entity.inChase ? 0.30 : 0.62;
      g_entityStepCD = stride;
      const idx = Math.floor(Math.random() * g_bigFootBufs.length);
      const vol = VOL_FOOTSTEP_ENTITY * g_masterVolume * Math.max(0, 1 - dist / FOOTSTEP_ENTITY_RANGE);
      if (vol > 0.01) playBuf(g_bigFootBufs[idx], vol);
    }
  }

  // Wail — plays once per LOS "event" (cooldown WAIL_COOLDOWN_SEC)
  g_wailCD -= dt;
  if (g_entity && g_entity.hasLOS && g_wailCD <= 0 && dist < WAIL_RANGE) {
    g_wailCD = WAIL_COOLDOWN_SEC;
    playBuf(g_wailBuf, VOL_WAIL * g_masterVolume);
  }

  // chase loop volume crossfade based on LOS
  if (g_chaseEl) {
    const targetVol = (g_entity && g_entity.hasLOS) ? VOL_CHASE_MAX * g_masterVolume : 0.0;
    if (targetVol > 0.01 && g_chaseEl.paused) {
      g_chaseEl.play().catch(()=>{});
    }
    // Simple linear approach
    const cur = g_chaseEl.volume;
    const step = dt * 0.6;
    g_chaseEl.volume = Math.max(0, Math.min(1,
      cur + Math.sign(targetVol - cur) * Math.min(step, Math.abs(targetVol - cur))));
    if (g_chaseEl.volume <= 0.001 && !g_chaseEl.paused) {
      g_chaseEl.pause();
      g_chaseEl.currentTime = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Texture loading — applies procedural fallback immediately, replaces with
// the real image if/when it loads.
// ─────────────────────────────────────────────────────────────────────────────
function loadTexture(texUnitEnum, src, fallbackType) {
  const tex = gl.createTexture();
  gl.activeTexture(texUnitEnum);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // Upload fallback straight away so the scene is renderable immediately
  const fbCanvas = generateFallbackTexture(fallbackType);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);  // canvas already in correct orientation
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fbCanvas);
  applyTexParams();

  // Attempt to load the real image asynchronously
  const img = new Image();
  img.onload = () => {
    gl.activeTexture(texUnitEnum);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // PNGs need Y-flip for WebGL UV space
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    applyTexParams();
  };
  img.onerror = () => {
    console.log('Texture not found: ' + src + '  (using procedural fallback)');
  };
  img.src = src;
}

function applyTexParams() {
  // NEAREST filtering = sharp pixels, authentic Minecraft look.
  // CLAMP_TO_EDGE is required for NPOT textures (e.g. 850×553 goop_arrow.png) —
  // without it, WebGL 1 silently returns black for the whole texture.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.REPEAT);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFallbackTexture — procedural Backrooms-palette fallbacks (32×32).
// Drawn pixel-by-pixel with putImageData so they stay crisp under NEAREST.
// Real PNGs in textures/ replace these once they load.
// ─────────────────────────────────────────────────────────────────────────────
function generateFallbackTexture(type) {
  const S   = 32;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d   = img.data;

  let seed = 42;
  function rng() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
  function noise(s) { return Math.floor((rng() - 0.5) * s); }
  function setpx(x, y, r, g, b) {
    const i = (y * S + x) * 4;
    d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
  }

  switch (type) {
    // Plain mid-grey wall panel. The shader will mix this 60/40 with a
    // strong blue tint so the wall reads as washed-out, slightly cyan
    // concrete — matching the user-supplied wall.png aesthetic.
    case 'wall': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n    = noise(18);
        const seam = (x % 16 === 0 || y % 16 === 0) ? -22 : 0;
        const r = 178 + n + seam;
        const g = 178 + n + seam;
        const b = 175 + n + seam;
        setpx(x, y, Math.max(0,r), Math.max(0,g), Math.max(0,b));
      }
      break;
    }
    // Dirty brown carpet used for both floor AND ceiling (when no light
    // tile is present). Heavy noise, occasional darker stains.
    case 'ceiling_floor': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n     = noise(28);
        const stain = (rng() < 0.04) ? -36 : 0;
        const r = 118 + n + stain;
        const g =  88 + n + stain;
        const b =  52 + n + stain;
        setpx(x, y, Math.max(0,r), Math.max(0,g), Math.max(0,b));
      }
      break;
    }
    // Glowing fluorescent light tile — bright nearly-white centre with a
    // dark bezel. Shader treats this texture as emissive (it ignores
    // shadows + gets boosted by the flicker term).
    case 'light': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        // Bezel ring
        const onEdge = (x < 3 || x > 28 || y < 3 || y > 28);
        if (onEdge) { setpx(x, y, 60, 60, 64); continue; }
        // Bright core, slight warm cast, faint vertical "tube" hot-bands
        const tube = ((x % 8) === 3 || (x % 8) === 4) ? 8 : 0;
        const r = 250 + tube;
        const g = 250 + tube;
        const b = 232 + tube;
        setpx(x, y, Math.min(255,r), Math.min(255,g), Math.min(255,b));
      }
      break;
    }
    case 'door': {
      // 16-px wood-grain door, scaled to 32 by repeating
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n  = noise(12);
        const bx = (x === 0 || x === 15 || x === 16 || x === 31) ? -28 : 0;
        const by = (y % 16 === 0 || y % 16 === 15) ? -20 : 0;
        setpx(x, y, 110 + n + bx + by, 72 + n + bx + by, 38 + n + bx + by);
      }
      break;
    }
    // goop fallback: dark green-ish arrow shape on transparent bg
    // a simple right-pointing triangle so something is visible if goop_arrow.png is missing
    case 'goop': {
      const imgG = ctx.createImageData(S, S);
      const dG = imgG.data;
      for (let i = 0; i < dG.length; i++) dG[i] = 0; // transparent
      // draw a right-pointing arrow: shaft + head
      const setGpx = (x, y, r, g, b, a) => {
        if (x < 0 || x >= S || y < 0 || y >= S) return;
        const ii = (y * S + x) * 4;
        dG[ii]=r; dG[ii+1]=g; dG[ii+2]=b; dG[ii+3]=a;
      };
      const midY = Math.floor(S / 2);
      // shaft: left half
      for (let x = 4; x < 20; x++) for (let dy = -3; dy <= 3; dy++) setGpx(x, midY+dy, 0, 180, 60, 255);
      // arrowhead: right half, triangle
      for (let x = 20; x < 29; x++) {
        const spread = Math.floor((x - 20) * 0.85);
        for (let dy = -(8 - spread); dy <= (8 - spread); dy++) setGpx(x, midY+dy, 0, 180, 60, 255);
      }
      ctx.putImageData(imgG, 0, 0);
      return cvs;
    }
    default: {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) setpx(x, y, 128, 0, 128);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cvs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input — keyboard + mouse
// ─────────────────────────────────────────────────────────────────────────────
function setupInput() {
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    // ESC: pause toggle. handled here (not letting browser's default
    // pointer-lock release count as "intent to unpause") because the user
    // wants ESC to be the explicit pause button.
    if (e.key === 'Escape') {
      if (g_started && !g_gameOver && !g_gameWon) {
        togglePause();
        e.preventDefault();
      }
      return;
    }
    g_keys[k] = true;
    if (e.key === 'Shift') g_keys['shift'] = true;
    if (e.key === ' ') e.preventDefault();
  });
  document.addEventListener('keyup',   e => {
    const k = e.key.toLowerCase();
    g_keys[k] = false;
    if (e.key === 'Shift') g_keys['shift'] = false;
  });

  // ── Pointer-lock mouse look ───────────────────────────────────────────────
  // Pointer lock requested by canvas click — but the game itself only
  // "starts" (timer + entity AI + audio) once the user has clicked ENTER
  // on the title screen. That handler is wired in setupTitleScreen().
  canvas.addEventListener('click', () => {
    if (g_started) canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = (document.pointerLockElement === canvas);
    const lockMsg = document.getElementById('lockMsg');
    if (lockMsg) lockMsg.style.display = locked ? 'none' : 'block';
    if (locked) {
      document.addEventListener('mousemove', onMouseMove);
      // re-entering pointer lock from the pause menu = unpause.
      if (g_paused) togglePause();
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      // pressing ESC inside pointer-lock fires this event but NOT a keydown
      // (the browser eats it). so the cleanest "esc = pause" path is:
      // "any time we lose pointer-lock during gameplay, treat it as pause".
      if (g_started && !g_paused && !g_gameOver && !g_gameWon) {
        togglePause();
      }
    }
  });

  // ── Block interaction (mousedown, not click, to avoid pointer-lock click) ─
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function onMouseMove(e) {
  const sensitivity = 0.15;
  // panLeft(+movementX) = yaw increase = turns RIGHT on screen
  // (setLookAt convention: visual-right = cross(fwd,up) at negative-yaw side)
  if (e.movementX !== 0) camera.panLeft(e.movementX * sensitivity);
  if (e.movementY !== 0) camera.lookVertical(-e.movementY * sensitivity);
}

function onMouseDown(e) {
  if (document.pointerLockElement !== canvas) return;
  if (e.button !== 0) return;  // LMB only
  const fwd = camera.getFwd();
  const eye = camera.eye.elements;
  const [tx, tz] = getTargetCell(eye[0], eye[2], fwd[0], fwd[2]);
  if (isDoor(tx, tz)) triggerWin();
}

// ─────────────────────────────────────────────────────────────────────────────
// Collision detection
// ─────────────────────────────────────────────────────────────────────────────
const PLAYER_RADIUS = 0.3;

function isBlockedAt(x, z) {
  const r = PLAYER_RADIUS;
  const corners = [[x+r, z+r], [x+r, z-r], [x-r, z+r], [x-r, z-r]];
  for (const [cx, cz] of corners) {
    const bx = Math.floor(cx), bz = Math.floor(cz);
    if (bx < 0 || bx >= MAP_SIZE || bz < 0 || bz >= MAP_SIZE) return true;
    if (g_Map[bx][bz] > 0) return true;
  }
  // furniture acts as a solid circular obstacle. only check enabled kinds.
  if (typeof g_FurnitureSlots !== 'undefined') {
    for (const f of g_FurnitureSlots) {
      try { if (eval('ENABLE_' + f.kind) === false) continue; } catch(_) {}
      const dx = x - f.x, dz = z - f.z;
      if (dx * dx + dz * dz < (0.55 + r) * (0.55 + r)) return true;
    }
  }
  return false;
}

// Try to move dx, dz with axis-split wall sliding
function tryMove(dx, dz) {
  const e = camera.eye.elements;
  const nx = e[0] + dx, nz = e[2] + dz;
  if      (!isBlockedAt(nx, nz))   { e[0] = nx; e[2] = nz; }
  else if (!isBlockedAt(nx, e[2])) { e[0] = nx; }
  else if (!isBlockedAt(e[0], nz)) { e[2] = nz; }
  camera.updateViewMatrix();
}

// ─────────────────────────────────────────────────────────────────────────────
function processInput(dt) {
  // —— Sprint stamina bookkeeping (must precede speed calc) ———————————————
  // While locked out, sprinting is disabled regardless of input until the
  // bar regenerates fully back to 1.0.
  const wantSprint = (g_keys['shift'] === true) && !g_sprintLocked && g_sprint > 0.0;
  const moving     = (g_keys['w'] || g_keys['a'] || g_keys['s'] || g_keys['d']);
  // Edge case: can't START sprinting below SPRINT_MIN, but can keep going down to 0
  if (wantSprint && moving && (g_isSprinting || g_sprint > SPRINT_MIN)) {
    g_isSprinting = true;
    g_sprint = Math.max(0, g_sprint - SPRINT_DRAIN * dt);
    if (g_sprint <= 0) {
      g_isSprinting  = false;
      g_sprintLocked = true;            // engage cooldown
    }
  } else {
    g_isSprinting = false;
    g_sprint = Math.min(1, g_sprint + SPRINT_REGEN * dt);
    if (g_sprintLocked && g_sprint >= 1.0) g_sprintLocked = false;
  }

  const baseSpd = g_isSprinting ? 5.0 * SPRINT_MULT : 5.0;
  const spd     = baseSpd * dt;
  const rotSpd  = 60 * dt;
  const [fx, , fz] = camera._flatFwd();
  let dx = 0, dz = 0;
  if (g_keys['w']) { dx += fx * spd;  dz += fz * spd; }
  if (g_keys['s']) { dx -= fx * spd;  dz -= fz * spd; }
  // A = screen-left = -right = (+fz, 0, -fx)
  // D = screen-right = +right = (-fz, 0, +fx)
  if (g_keys['a']) { dx += fz * spd;  dz -= fx * spd; }
  if (g_keys['d']) { dx -= fz * spd;  dz += fx * spd; }
  if (dx !== 0 || dz !== 0) tryMove(dx, dz);
  if (g_keys['q']) camera.panLeft(rotSpd);
  if (g_keys['e']) camera.panRight(rotSpd);

  // ── Walk-bob + player footstep audio ────────────────────────────────
  // We modulate eye-Y by a small sine while moving (and lerp it back when
  // stopped) and emit a small footstep WAV every full bob period.
  const e = camera.eye.elements;
  if (dx !== 0 || dz !== 0) {
    g_walkPhase += BOB_FREQ * dt * (g_isSprinting ? 1.4 : 1.0);
    e[1] = g_baseEyeY + Math.sin(g_walkPhase) * BOB_AMP;
    g_playerStepCD -= dt;
    if (g_playerStepCD <= 0 && g_smallFootBufs.length > 0) {
      g_playerStepCD = g_isSprinting ? 0.32 : 0.46;
      const idx = Math.floor(Math.random() * g_smallFootBufs.length);
      playBuf(g_smallFootBufs[idx], VOL_FOOTSTEP_PLAYER * g_masterVolume);
    }
  } else {
    // Lerp eye Y back to base so the bob smoothly settles
    e[1] += (g_baseEyeY - e[1]) * Math.min(1, dt * 8);
    g_playerStepCD = 0;   // reset so first step plays immediately on next move
  }
  camera.updateViewMatrix();
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD helpers
// ─────────────────────────────────────────────────────────────────────────────
function updateHUD() {
  const secs = Math.max(0, g_timer);
  const mm   = Math.floor(secs / 60).toString().padStart(2, '0');
  const ss   = Math.floor(secs % 60).toString().padStart(2, '0');
  const timerEl = document.getElementById('timer');
  timerEl.textContent = mm + ':' + ss;
  timerEl.className   = secs < 10 ? 'danger' : '';

  const dist  = getEntityDist();
  const ratio = Math.max(0, Math.min(1, dist / 20));
  const fill  = document.getElementById('sanityFill');
  if (fill) {
    fill.style.width      = (ratio * 100) + '%';
    fill.style.background = ratio > 0.5 ? '#4aff60'
                          : ratio > 0.25 ? '#ffcc00'
                          : '#ff3030';
  }

  // Sprint gauge — cyan when full, fades to red as it depletes.
  // When locked out (depleted, recharging), the bar pulses slowly between
  // dim and bright red so the player sees they cannot sprint yet.
  const sprintFill = document.getElementById('sprintFill');
  if (sprintFill) {
    sprintFill.style.width = (g_sprint * 100) + '%';
    if (g_sprintLocked) {
      // Slow ~1.2 Hz pulse, opacity 0.35 ↔ 1.0
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0075));
      sprintFill.style.background = '#ff3030';
      sprintFill.style.opacity    = pulse.toFixed(3);
    } else {
      sprintFill.style.opacity    = '1';
      sprintFill.style.background = g_sprint > 0.4  ? '#5ec8ff'
                                  : g_sprint > 0.15 ? '#ffaa33'
                                  : '#ff5050';
    }
  }

  updateProximityAudio(dist);
}

function updateFps(timestamp) {
  g_frameCount++;
  if (timestamp - g_lastFpsMs >= 500) {
    const fps = (g_frameCount / ((timestamp - g_lastFpsMs) / 1000)).toFixed(0);
    document.getElementById('fps').textContent = 'FPS: ' + fps;
    g_frameCount  = 0;
    g_lastFpsMs   = timestamp;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// setupTitleScreen — wires the disclaimer/title overlay's ENTER button.
// Click handler:
//   - reads the "disable flickering" checkbox into g_flickerEnabled
//   - hides the overlay
//   - flips g_started so the timer + entity AI + canvas pointer-lock click
//     handler all begin operating
//   - kicks off ambience + footstep audio loading (requires user gesture)
//   - immediately requests pointer lock for a seamless transition
// ─────────────────────────────────────────────────────────────────────────────
function setupTitleScreen() {
  const overlay = document.getElementById('titleScreen');
  const startBtn = document.getElementById('startBtn');
  const flickerCb = document.getElementById('disableFlicker');
  if (!overlay || !startBtn) return;   // graceful fallback if HTML not added

  startBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    g_flickerEnabled = !(flickerCb && flickerCb.checked);
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    g_started = true;
    try { if (g_audioCtx && g_audioCtx.state === 'suspended') g_audioCtx.resume(); }
    catch (e) { console.log('audio resume failed:', e.message); }
    try { initAudioFiles(); } catch (e) { console.log('audio init failed:', e.message); }
    // Pointer lock can throw if the document isn't focused or if we're
    // mid-fullscreen-transition. Wrap so it can never block game start.
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(err => console.log('pointer lock blocked:', err.message));
    } catch (e) { console.log('pointer lock failed:', e.message); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setupFullscreen — wires the FULLSCREEN HUD button.
// Toggling fullscreen resizes the canvas backing-store to the viewport,
// re-runs gl.viewport, and refreshes the camera projection so the aspect
// ratio matches. Leaving fullscreen restores the original 800×600.
// ─────────────────────────────────────────────────────────────────────────────
var g_origCanvasW = 0, g_origCanvasH = 0;

function setupFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  const container = document.getElementById('container');
  if (!btn || !container) return;

  g_origCanvasW = canvas.width;
  g_origCanvasH = canvas.height;

  function applySize() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFs) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      btn.textContent = 'EXIT FS';
    } else {
      canvas.width  = g_origCanvasW;
      canvas.height = g_origCanvasH;
      btn.textContent = 'FULLSCREEN';
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (camera) camera.updateProjectionMatrix(canvas.width, canvas.height);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    // use documentElement so fullscreen works in live server and github pages
    const target = document.documentElement;
    if (!fsEl) {
      const req = target.requestFullscreen || target.webkitRequestFullscreen;
      if (req) {
        const r = req.call(target);
        if (r && r.catch) r.catch(err => console.log('fs blocked:', err.message));
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  });

  document.addEventListener('fullscreenchange', applySize);
  document.addEventListener('webkitfullscreenchange', applySize);
  window.addEventListener('resize', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) applySize();
  });
}

// pause-menu wiring. resume button, flicker checkbox, master volume slider,
// and a fullscreen toggle that mirrors the title-screen one.
function setupPauseMenu() {
  const resumeBtn = document.getElementById('pauseResumeBtn');
  const flickerCb = document.getElementById('pauseFlickerCb');
  const volSlider = document.getElementById('pauseVolume');
  const volLabel  = document.getElementById('pauseVolumeVal');
  const fsBtn     = document.getElementById('pauseFsBtn');

  if (resumeBtn) {
    resumeBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (g_paused) togglePause();
      // re-grab pointer lock so the player drops straight back into gameplay
      try { canvas.requestPointerLock(); } catch (_) {}
    });
  }

  if (flickerCb) {
    // sync the checkbox with the title-screen state on open
    flickerCb.checked = !g_flickerEnabled;
    flickerCb.addEventListener('change', () => {
      g_flickerEnabled = !flickerCb.checked;
    });
  }

  if (volSlider && volLabel) {
    volSlider.value = String(Math.round(g_masterVolume * 100));
    volLabel.textContent = volSlider.value + '%';
    const apply = () => {
      const v = (+volSlider.value) / 100;
      g_masterVolume = v;
      volLabel.textContent = volSlider.value + '%';
      // <audio> element volumes need updating live (webaudio one-shots
      // pick up the new value next time they fire).
      if (g_ambienceEl) g_ambienceEl.volume = VOL_AMBIENCE * v;
    };
    volSlider.addEventListener('input', apply);
  }

  if (fsBtn) {
    fsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      const target = document.documentElement;
      if (!fsEl) {
        const req = target.requestFullscreen || target.webkitRequestFullscreen;
        if (req) req.call(target);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    });
  }
}

// bootstrap. start everything once the DOM is ready.
window.addEventListener('load', main);
