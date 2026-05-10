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
var u_isBackrooms;
var u_emissive;             // bool flag for self-lit pieces (tv screen)
var u_fogNear, u_fogFar, u_fogColor;
var u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3, u_Sampler5;

// game state
var camera;
var g_keys     = {};
var g_ignoreNextMouseMove = false;
const MOUSE_EVENT_DELTA_CAP = 20;
const MOUSE_FRAME_DELTA_CAP = 28;
const MOUSE_PENDING_DELTA_CAP = 56;
var g_pendingMouseX = 0, g_pendingMouseY = 0;
// length of a single round before the entity speeds up and the timer resets.
// (was 180 = 3 min; using 120 to match the user's "2 minutes" wording.)
const ROUND_SECONDS  = 120.0;
var g_timer    = ROUND_SECONDS;
var g_round    = 1;            // increments on every timer wrap
var g_gameOver = false;
var g_gameWon  = false;
var g_paused   = false;        // toggled by ESC
var g_speedrunTime = 0;
var g_speedrunFinished = false;
var g_dimTimer = 0;            // seconds left in post-round lights-off effect
var g_performanceMode = false;
const PERFORMANCE_RENDER_SCALE = 0.40;
const SUBURB_FOG_NEAR = 4.0;
const SUBURB_FOG_FAR = 16.0;
const SUBURB_PERF_FOG_NEAR = 2.5;
const SUBURB_PERF_FOG_FAR = 10.0;
const BACKROOMS_FOG_NEAR = 1.8;
const BACKROOMS_FOG_FAR = 14.0;
const BACKROOMS_PERF_FOG_NEAR = 1.0;
const BACKROOMS_PERF_FOG_FAR = 8.5;
var g_SuburbTexObjs = {};      // dynamic sampler5 textures for Level 1
var g_LevelModelMeshes = {};   // OBJ meshes for Level 1 models (fence)
var g_suppressPointerPause = false; // narrative overlays can release pointer lock

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
var g_frameMsSmoothed = 16.7;
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

// Fog/background colour — warm tan instead of green-yellow.
const FOG_R = 0.72, FOG_G = 0.56, FOG_B = 0.34;

// ─────────────────────────────────────────────────────────────────────────────
// Audio mix — tweak these to rebalance everything in one place.
// All values are 0–1 multiplied by the per-event base level.
// ─────────────────────────────────────────────────────────────────────────────
const VOL_AMBIENCE        = 1.0;   // looping room tone
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
const FURNITURE_ENABLED = {
  chair: ENABLE_chair,
  chair1: ENABLE_chair1,
  chair2: ENABLE_chair2,
  chair3: ENABLE_chair3,
  chair4: ENABLE_chair4,
};

function isFurnitureKindEnabled(kind) {
  return FURNITURE_ENABLED[kind] !== false;
}

// ─────────────────────────────────────────────────────────────────────────────
// goop tile settings
// ─────────────────────────────────────────────────────────────────────────────
const GOOP_FLOOR_CHANCE = 0.008; // ~0.8% of open floor cells get a goop decal
const GOOP_WALL_CHANCE  = 0.006; // ~0.6% of eligible wall faces get a goop marking
const GOOP_WRONG_CHANCE = 0.0;   // Exit guidance should be readable, not misleading

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
  u_isBackrooms      = gl.getUniformLocation(gl.program, 'u_isBackrooms');
  u_emissive         = gl.getUniformLocation(gl.program, 'u_emissive');
  u_fogNear          = gl.getUniformLocation(gl.program, 'u_fogNear');
  u_fogFar           = gl.getUniformLocation(gl.program, 'u_fogFar');
  u_fogColor         = gl.getUniformLocation(gl.program, 'u_fogColor');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1         = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2         = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_Sampler3         = gl.getUniformLocation(gl.program, 'u_Sampler3');
  u_Sampler4         = gl.getUniformLocation(gl.program, 'u_Sampler4');
  u_Sampler5         = gl.getUniformLocation(gl.program, 'u_Sampler5');

  // ── GL state ──────────────────────────────────────────────────────────────
  gl.clearColor(FOG_R, FOG_G, FOG_B, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // ── Persistent uniforms ───────────────────────────────────────────────────
  gl.uniform1i(u_Sampler0, 0);
  gl.uniform1i(u_Sampler1, 1);
  gl.uniform1i(u_Sampler2, 2);
  gl.uniform1i(u_Sampler3, 3);
  gl.uniform1i(u_Sampler4, 4);
  gl.uniform1i(u_Sampler5, 5);

  // flicker enabled by default. title screen checkbox can flip it.
  gl.uniform1i(u_flickerEnabled, 1);
  gl.uniform1i(u_isBackrooms, 0);
  gl.uniform1i(u_emissive, 0);

  // Loose, deep fog so the player can never see across the 96×96 grid but
  // can comfortably see ~25 units of corridor.  Far must stay below the
  // longest-possible open run (capped to 14 by world.js obstruction pass
  // → plenty of breathing room with far=28).
  gl.uniform1f(u_fogNear,  2.5);
  gl.uniform1f(u_fogFar,  20.0);
  gl.uniform3f(u_fogColor, FOG_R, FOG_G, FOG_B);

  // ── Textures — user-supplied PNGs (with procedural fallbacks) ─────────
  loadTexture(gl.TEXTURE0, 'textures/wall.png',          'wall');
  loadTexture(gl.TEXTURE1, 'textures/ceiling_floor.png', 'ceiling_floor');
  loadTexture(gl.TEXTURE2, 'textures/light.png',         'light');
  loadBackroomsDoorTexture(gl.TEXTURE3);
  loadGoopTextures();
  loadSuburbTextures();

  // ── World ─────────────────────────────────────────────────────────────────
  camera = new Camera(canvas);
  initWorldBuffers();
  initSingleCubeBuffer();
  loadLevel(1);

  // entity model + animation
  initEntityModel();
  loadAnim('anim.json');

  // furniture (chairs, sofa, tv). loaded async; renders show up once ready.
  loadFurnitureMeshes();
  loadLevelModelMeshes();

  // input + audio
  setupInput();
  initAudio();
  if (typeof setupGameStateUI === 'function') setupGameStateUI();
  setupTitleScreen();
  setupFullscreen();
  setupPauseMenu();
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// tick — per-frame update
// ─────────────────────────────────────────────────────────────────────────────
function tick(timestamp) {
  if (g_gameOver || g_gameWon) return;

  const frameMs = g_lastFrameMs > 0 ? (timestamp - g_lastFrameMs) : 0;
  const dt = Math.min(frameMs / 1000, 1 / 30);
  g_lastFrameMs = timestamp;

  // when paused we still render the last frame and update fps, but skip
  // anything time-driven (timer, entity ai, audio cues).
  if (!g_paused) {
    g_seconds += dt;
    if (g_started && !g_speedrunFinished) g_speedrunTime += dt;
    if (g_dimTimer > 0) g_dimTimer = Math.max(0, g_dimTimer - dt);
    if (typeof updateGameState === 'function') updateGameState(dt);
    const chaseActive = (typeof isBackroomsChaseActive === 'function') ? isBackroomsChaseActive() : g_started;
    if (g_started && chaseActive) {
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
    const chaseActive = (typeof isBackroomsChaseActive === 'function') ? isBackroomsChaseActive() : g_started;
    if (g_started && chaseActive && g_entityActive) {
      updateEntity(dt);
      updateEntityAudio(dt);
      if (getEntityDist() < 1.5) { triggerLose(); return; }
    }
  }

  renderScene();
  updateHUD();
  updateFps(timestamp, frameMs);
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────────────────────────────
// renderScene
// ─────────────────────────────────────────────────────────────────────────────
function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(u_ViewMatrix,       false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  // Brief lights-off during the round-transition banner ("HE WATCHES YOU")
  gl.uniform1i(u_numLights, g_dimTimer > 0 ? 0 : Math.min(g_LightPositions.length, 8));
  if (g_currentLevel === LEVEL_SUBURBS) drawSkybox();
  renderWorld();
  drawLevelModels();
  drawGardenHighlight();
  drawLevelItems();
  drawGoopWorld();
  drawExitDoorMarker();
  drawFurniture();
  if (g_entityActive) drawEntity(g_seconds);
}

function drawSkybox() {
  if (!g_singleCubeBuffer) return;
  const e = camera.eye.elements;
  if (!drawSkybox._matrix) drawSkybox._matrix = new Matrix4();
  const m = drawSkybox._matrix.setIdentity();
  m.translate(e[0], e[1], e[2]);
  m.scale(220, 220, 220);
  gl.depthMask(false);
  gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform4fv(u_baseColor, g_skyColor || [0.53, 0.81, 0.98, 1.0]);
  gl.uniform1i(u_emissive, 1);
  bindSingleCubeBuffer();
  gl.drawArrays(gl.TRIANGLES, 0, 36);
  gl.uniform1i(u_emissive, 0);
  gl.depthMask(true);
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
  g_speedrunFinished = true;
  const finalTime = formatSpeedrunTime(g_speedrunTime);
  const finalEl = document.getElementById('finalRunTime');
  if (finalEl) finalEl.textContent = 'Your time was ' + finalTime + '.';
  const speedrunEl = document.getElementById('speedrunTimer');
  if (speedrunEl) {
    speedrunEl.textContent = 'TIME ' + finalTime;
    speedrunEl.classList.add('show');
  }
  document.getElementById('winScreen').classList.add('active');
}

// pause toggle. shows / hides #pauseScreen overlay and releases pointer
// lock so the cursor is usable for clicking buttons.
function togglePause() {
  g_paused = !g_paused;
  const ps = document.getElementById('pauseScreen');
  if (ps) ps.classList.toggle('active', g_paused);
  if (g_paused) {
    syncPerformanceCheckboxes();
    const flickerCb = document.getElementById('pauseFlickerCb');
    if (flickerCb) flickerCb.checked = !g_flickerEnabled;
  }
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
  el.textContent = 'HE IS GETTING FASTER';
  el.classList.add('show');
  g_dimTimer = 1.25;
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

function isDrawPointVisible(x, z, radius) {
  if (typeof g_currentLevel === 'undefined' || typeof LEVEL_BACKROOMS === 'undefined' || g_currentLevel !== LEVEL_BACKROOMS) return true;
  if (typeof isWorldChunkVisible === 'function') {
    return isWorldChunkVisible({ centerX: x, centerZ: z, radius: radius || 1.0 });
  }
  if (!camera) return true;
  const e = camera.eye.elements;
  const dx = x - e[0], dz = z - e[2];
  const limit = 18.0 + (radius || 1.0);
  return dx * dx + dz * dz <= limit * limit;
}

// goop tile decals
var g_goopFloorCells = new Map(); // "x,z" -> texName
var g_goopWallFaces  = new Map(); // "wx,wz,face,y" -> texName
var g_goopBatches    = [];        // [{texName, buffer, vertCount}]
var g_goopChunks     = [];        // [{centerX, centerZ, radius, batches}]
var u_Sampler4 = null;    // uniform location for goop texture
var g_GoopTexObjs = {};   // filename -> WebGL texture object

// floor-only goop textures (all goop_ that are NOT goop_wall_)
const GOOP_FLOOR_TEXTURES = [
  'goop_arrow.png', 'goop_arrow_down.png', 'goop_arrow_left.png',
  'goop_arrow_left_down.png', 'goop_arrow_left_up.png',
  'goop_arrow_right.png', 'goop_arrow_right_down.png', 'goop_arrow_right_up.png',
  'goop_arrow_up.png',
  'goop_cross_1.png', 'goop_cross_2.png', 'goop_cross_3.png',
  'goop_splatter.png', 'goop_splatter_1.png', 'goop_splatter_2.png',
  'goop_splatter_3.png', 'goop_splatter_4.png', 'goop_splatter_5.png',
  'goop_splatter_6.png', 'goop_stroke.png', 'goop_x.png',
];
const GOOP_WALL_LEFT_TEXTURES  = ['goop_wall_left_1.png',  'goop_wall_left_2.png',  'goop_wall_left_3.png'];
const GOOP_WALL_RIGHT_TEXTURES = ['goop_wall_right_1.png', 'goop_wall_right_2.png', 'goop_wall_right_3.png'];
// Non-directional wall decorations (brushes, crosses, splatters).
const GOOP_WALL_DECOR_TEXTURES = [
  'goop_wall_brush_1.png',    'goop_wall_brush_2.png',    'goop_wall_brush_3.png',
  'goop_wall_cross_1.png',    'goop_wall_cross_2.png',    'goop_wall_cross_3.png',    'goop_wall_cross_4.png',
  'goop_wall_splatter_1.png', 'goop_wall_splatter_2.png', 'goop_wall_splatter_3.png',
  'goop_wall_splatter_4.png', 'goop_wall_splatter_5.png',
];
// Non-arrow floor decals — used for the ~45 % of floor goop that isn’t an arrow.
const GOOP_FLOOR_DECORS = [
  'goop_cross_1.png', 'goop_cross_2.png', 'goop_cross_3.png',
  'goop_splatter.png', 'goop_splatter_1.png', 'goop_splatter_2.png',
  'goop_splatter_3.png', 'goop_splatter_4.png', 'goop_splatter_5.png',
  'goop_splatter_6.png', 'goop_stroke.png', 'goop_x.png',
];

function loadFurnitureMeshes() {
  for (const kind of Object.keys(FURNITURE_DEFS)) {
    // skip kinds whose toggle is false
    if (!isFurnitureKindEnabled(kind)) continue;
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
  if (!drawFurniture._matrix) drawFurniture._matrix = new Matrix4();
  const m = drawFurniture._matrix;
  for (const slot of g_FurnitureSlots) {
    // skip if this kind was disabled
    if (!isFurnitureKindEnabled(slot.kind)) continue;
    if (!isDrawPointVisible(slot.x, slot.z, 1.2)) continue;
    const mesh = g_furnitureMeshes[slot.kind];
    if (!mesh) continue;
    const def = FURNITURE_DEFS[slot.kind];

    m.setIdentity();
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
// Level model system — currently used for the custom fence OBJ in the suburb.
// The OBJ is converted from its original Z-up coordinate system into the
// engine's Y-up convention, then drawn as batched VBO instances.
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL_MODEL_DEFS = {
  fence: { file: 'models/fence.obj', color: [0.62, 0.40, 0.22, 1.0] },
  weeds: { file: 'models/weeds.obj', color: [0.28, 0.70, 0.22, 1.0], convertZUp: false },
  sign:  { file: 'models/sign_merged.obj', texName: 'Sofa1_diff.png', color: [1.0, 1.0, 1.0, 1.0], convertZUp: false },
};

function _convertObjZUpToYUp(verts) {
  const out = new Float32Array(verts.length);
  for (let i = 0; i < verts.length; i += 8) {
    const x = verts[i], y = verts[i+1], z = verts[i+2];
    const nx = verts[i+5], ny = verts[i+6], nz = verts[i+7];
    out[i]   = x;
    out[i+1] = z;
    out[i+2] = -y;
    out[i+3] = verts[i+3];
    out[i+4] = verts[i+4];
    out[i+5] = nx;
    out[i+6] = nz;
    out[i+7] = -ny;
  }
  return out;
}

function loadLevelModelMeshes() {
  for (const kind of Object.keys(LEVEL_MODEL_DEFS)) {
    const def = LEVEL_MODEL_DEFS[kind];
    fetch(def.file)
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(txt => {
        const parsed = parseOBJ(txt);
        if (!parsed) { console.warn('[level-model] parse failed:', kind); return; }
        const verts = def.convertZUp === false ? parsed : _convertObjZUpToYUp(parsed);
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < verts.length; i += 8) {
          const x = verts[i], y = verts[i+1], z = verts[i+2];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        g_LevelModelMeshes[kind] = {
          buffer: buf,
          vertCount: verts.length / 8,
          width: Math.max(0.001, maxX - minX),
          height: Math.max(0.001, maxY - minY),
          length: Math.max(0.001, maxZ - minZ),
          offsetX: -(minX + maxX) * 0.5,
          offsetY: -minY,
          offsetZ: -(minZ + maxZ) * 0.5,
        };
        console.log('[level-model] loaded', kind, 'verts=', verts.length / 8);
      })
      .catch(err => console.warn('[level-model] fetch failed:', kind, err));
  }
}

function drawLevelModels() {
  if (!g_LevelModelSlots || g_LevelModelSlots.length === 0) return;
  const stride = 32;
  if (!drawLevelModels._matrix) drawLevelModels._matrix = new Matrix4();
  const m = drawLevelModels._matrix;
  for (const slot of g_LevelModelSlots) {
    const mesh = g_LevelModelMeshes[slot.kind];
    if (!mesh) continue;
    const sx = (slot.width || 0.18) / mesh.width;
    const sy = (slot.height || 1.4) / mesh.height;
    const sz = (slot.length || 8.0) / mesh.length;
    m.setIdentity();
    m.translate(slot.x, 0.0, slot.z);
    m.rotate(slot.yaw || 0, 0, 1, 0);
    m.scale(sx, sy, sz);
    m.translate(mesh.offsetX, mesh.offsetY, mesh.offsetZ);

    gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
    gl.uniform1i(u_emissive, 0);
    const _def = LEVEL_MODEL_DEFS[slot.kind];
    const _texName = slot.texName || _def.texName;
    const _tex = _texName ? g_SuburbTexObjs[_texName] : null;
    if (_tex) {
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, _tex);
      gl.uniform1i(u_whichTexture, 5);
      gl.uniform1f(u_texColorWeight, 1.0);
      gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
    } else {
      gl.uniform1f(u_texColorWeight, 0.0);
      gl.uniform4fv(u_baseColor, slot.color || _def.color || [0.8, 0.7, 0.5, 1.0]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride,  0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(a_TexCoord);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(a_Normal);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertCount);
  }
}

function drawGardenHighlight() {
  if (g_currentLevel !== LEVEL_SUBURBS || !g_singleCubeBuffer) return;
  if (typeof g_InteractiveMap === 'undefined' || !g_InteractiveMap.length) return;

  let active = false;
  let minX = 22, maxX = 24, minZ = 7, maxZ = 8;
  if (typeof g_gs !== 'undefined' && g_gs.phase === GAME_PHASE.TUTORIAL_GRASS_ROW) {
    active = true;
    minX = 8; maxX = 8; minZ = 7; maxZ = 9;
  } else {
    for (let x = 22; x <= 24 && !active; x++) {
      for (let z = 7; z <= 8; z++) {
        const code = g_InteractiveMap[x] ? g_InteractiveMap[x][z] : INTERACT_NONE;
        if (code === INTERACT_WEED || code === INTERACT_GARDEN_PLOT) {
          active = true;
          break;
        }
      }
    }
  }
  if (!active) return;

  bindSingleCubeBuffer();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform1i(u_whichTexture, 5);
  gl.uniform4f(u_baseColor, 0.35, 1.0, 0.38, 0.55);
  gl.uniform1i(u_emissive, 0);

  const cx = (minX + maxX + 1) * 0.5;
  const cz = (minZ + maxZ + 1) * 0.5;
  const width = (maxX - minX + 1) + 0.04;
  const length = (maxZ - minZ + 1) + 0.04;
  const strips = [
    { x: cx, y: 0.035, z: minZ + 0.02, sx: width, sy: 0.035, sz: 0.055 },
    { x: cx, y: 0.035, z: maxZ + 0.98, sx: width, sy: 0.035, sz: 0.055 },
    { x: minX + 0.02, y: 0.035, z: cz, sx: 0.055, sy: 0.035, sz: length },
    { x: maxX + 0.98, y: 0.035, z: cz, sx: 0.055, sy: 0.035, sz: length },
  ];
  if (!drawGardenHighlight._matrix) drawGardenHighlight._matrix = new Matrix4();
  const m = drawGardenHighlight._matrix;
  for (const strip of strips) {
    m.setIdentity();
    m.translate(strip.x, strip.y, strip.z);
    m.scale(strip.sx, strip.sy, strip.sz);
    gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }

  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
}

function drawLevelItems() {
  if (g_currentLevel === LEVEL_SUBURBS) return;
  if (!g_LevelItemSlots || g_LevelItemSlots.length === 0 || !g_singleCubeBuffer) return;

  bindSingleCubeBuffer();
  gl.uniform1i(u_whichTexture, 5);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
  gl.uniform1i(u_emissive, 0);

  if (!drawLevelItems._matrix) drawLevelItems._matrix = new Matrix4();
  const m = drawLevelItems._matrix;
  for (const slot of g_LevelItemSlots) {
    if (!isDrawPointVisible(slot.x + 0.5, slot.z + 0.5, 1.0)) continue;
    const tex = g_SuburbTexObjs[slot.texName || 'woodendeck.png'];
    if (tex) {
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    } else {
      gl.uniform1f(u_texColorWeight, 0.0);
      gl.uniform4fv(u_baseColor, slot.color || [0.72, 0.58, 0.35, 1.0]);
    }

    const h = slot.height || 1.0;
    m.setIdentity();
    if (slot.type === 'sign') {
      m.translate(slot.x + 0.15, h * 0.5, slot.z + 0.5);
      m.scale(0.14, h, 0.70);
    } else {
      m.translate(slot.x + 0.5, h * 0.5, slot.z + 0.5);
      m.scale(0.55, h, 0.55);
    }
    gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 36);

    if (!tex) {
      gl.uniform1f(u_texColorWeight, 1.0);
      gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// goop tile decals — goop textures placed on floor and wall tiles,
// rendered with the same lighting/fog as normal geometry.
// Transparent PNG areas let the underlying floor/wall show through.
// ─────────────────────────────────────────────────────────────────────────────

// Maps open-cell neighbour direction → the face enum on the WALL CELL
// that is visible from the open cell (matches buildWorldGeometry face push logic).
const GOOP_WALL_NEIGHBORS = [
  { dcx:  0, dcz: -1, wallFace: FACE_FRONT },  // wall to -Z, its +Z face shows
  { dcx:  0, dcz: +1, wallFace: FACE_BACK  },  // wall to +Z, its -Z face shows
  { dcx: -1, dcz:  0, wallFace: FACE_RIGHT },  // wall to -X, its +X face shows
  { dcx: +1, dcz:  0, wallFace: FACE_LEFT  },  // wall to +X, its -X face shows
];

// ─────────────────────────────────────────────────────────────────────────────
// getFloorArrowTex — pick the floor arrow texture that points from (fx, fz)
// toward the exit door.  Floor UV mapping: U = +X, V = +Z (after FLIP_Y),
// so image-up = world +Z (south) and image-right = world +X (east).
// ─────────────────────────────────────────────────────────────────────────────
function getFloorArrowTex(fx, fz, wrong) {
  let dx = DOOR_CELL_X + 0.5 - fx;
  let dz = DOOR_CELL_Z + 0.5 - fz;
  if (wrong) { dx = -dx; dz = -dz; }          // wrong: point away from door
  return getFloorArrowTexForDelta(dx, dz);
}

function getFloorArrowTexForDelta(dx, dz) {
  const angle  = Math.atan2(dz, dx);           // 0=E, π/2=S, ±π=W, -π/2=N
  const sector = Math.round(angle / (Math.PI / 4));
  const dirs   = ['e','se','s','sw','w','nw','n','ne'];
  const dir    = dirs[((sector % 8) + 8) % 8];
  const tmap   = {
    e:  'goop_arrow_right.png',       // → +X
    se: 'goop_arrow_right_up.png',    // → +X, +Z
    s:  'goop_arrow_up.png',          // → +Z
    sw: 'goop_arrow_left_up.png',     // → −X, +Z
    w:  'goop_arrow_left.png',        // → −X
    nw: 'goop_arrow_left_down.png',   // → −X, −Z
    n:  'goop_arrow_down.png',        // → −Z
    ne: 'goop_arrow_right_down.png',  // → +X, −Z
  };
  return tmap[dir];
}

function addExitBreadcrumbs() {
  const tx = DOOR_CELL_X - 1;
  const tz = DOOR_CELL_Z;
  if (!g_Map || !g_Map.length || !g_Map[tx] || g_Map[tx][tz] !== 0) return;

  for (let x = tx - 1; x <= tx + 1; x++) {
    for (let z = tz - 1; z <= tz + 1; z++) {
      if (!g_Map[x] || g_Map[x][z] !== 0) continue;
      const texName = (x === tx && z === tz)
        ? 'goop_arrow_right.png'
        : getFloorArrowTexForDelta(tx - x, tz - z);
      g_goopFloorCells.set(x + ',' + z, texName);
    }
  }
}

function assignGoopTiles() {
  g_goopFloorCells.clear();
  g_goopWallFaces.clear();
  if (!g_Map) return;

  let seed = 0xF00DCAFE;
  function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 8) / 16777215; }

  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      if (g_Map[x][z] !== 0) continue;

      // floor goop — 55% directional arrow pointing toward exit, 45% decorative
      if (rng() < GOOP_FLOOR_CHANCE) {
        let texName;
        if (rng() < 0.55) {
          texName = getFloorArrowTex(x + 0.5, z + 0.5, rng() < GOOP_WRONG_CHANCE);
        } else {
          texName = GOOP_FLOOR_DECORS[Math.floor(rng() * GOOP_FLOOR_DECORS.length)];
        }
        g_goopFloorCells.set(x + ',' + z, texName);
      }

      // wall face goop
      for (const nb of GOOP_WALL_NEIGHBORS) {
        const wx = x + nb.dcx, wz = z + nb.dcz;
        if (wx < 0 || wz < 0 || wx >= MAP_SIZE || wz >= MAP_SIZE) continue;
        if (g_Map[wx][wz] === 0) continue;
        if (rng() > GOOP_WALL_CHANCE) continue;

        let tex;
        if (rng() < 0.45) {
          // Non-directional decoration (brush stroke, cross, splatter)
          tex = GOOP_WALL_DECOR_TEXTURES[Math.floor(rng() * GOOP_WALL_DECOR_TEXTURES.length)];
        } else {
          // Directional arrow: left or right based on tangent toward exit
          const tangX = (nb.dcz !== 0) ? 1 : 0;
          const tangZ = (nb.dcx !== 0) ? 1 : 0;
          const dot   = (DOOR_CELL_X + 0.5 - (x + 0.5)) * tangX
                      + (DOOR_CELL_Z + 0.5 - (z + 0.5)) * tangZ;
          const wrong = rng() < GOOP_WRONG_CHANCE;
          const pool  = (dot >= 0) !== wrong ? GOOP_WALL_RIGHT_TEXTURES : GOOP_WALL_LEFT_TEXTURES;
          tex = pool[Math.floor(rng() * pool.length)];
        }
        g_goopWallFaces.set(wx + ',' + wz + ',' + nb.wallFace + ',1', tex);
      }
    }
  }
  addExitBreadcrumbs();
}

function buildGoopGeometry() {
  for (const chunk of g_goopChunks) {
    for (const b of chunk.batches) gl.deleteBuffer(b.buffer);
  }
  g_goopBatches = [];
  g_goopChunks = [];

  const chunkVerts = new Map();
  function chunkKey(x, z) {
    const size = (typeof WORLD_CHUNK_SIZE !== 'undefined') ? WORLD_CHUNK_SIZE : 8;
    return Math.floor(x / size) + ',' + Math.floor(z / size);
  }
  function ensureArr(key, name) {
    let texVerts = chunkVerts.get(key);
    if (!texVerts) { texVerts = {}; chunkVerts.set(key, texVerts); }
    if (!texVerts[name]) texVerts[name] = [];
    return texVerts[name];
  }

  for (const [key, texName] of g_goopFloorCells) {
    const [x, z] = key.split(',').map(Number);
    pushFace(ensureArr(chunkKey(x, z), texName), x, -1, z, FACE_TOP);
  }

  for (const [key, texName] of g_goopWallFaces) {
    const [wx, wz, face, y] = key.split(',').map(Number);
    pushFace(ensureArr(chunkKey(wx, wz), texName), wx, y, wz, face);
  }

  const size = (typeof WORLD_CHUNK_SIZE !== 'undefined') ? WORLD_CHUNK_SIZE : 8;
  for (const [key, texVerts] of chunkVerts) {
    const [chunkX, chunkZ] = key.split(',').map(Number);
    const batches = [];
    for (const [texName, verts] of Object.entries(texVerts)) {
      const data = new Float32Array(verts);
      const buf  = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const batch = { texName, buffer: buf, vertCount: data.length / 8 };
      batches.push(batch);
      g_goopBatches.push(batch);
    }
    if (batches.length > 0) {
      g_goopChunks.push({
        centerX: chunkX * size + size * 0.5,
        centerZ: chunkZ * size + size * 0.5,
        radius: Math.SQRT2 * size * 0.5,
        batches,
      });
    }
  }
}

function drawGoopWorld() {
  if (g_goopBatches.length === 0) return;

  const STRIDE   = 32;
  if (!drawGoopWorld._identity) drawGoopWorld._identity = new Matrix4();
  const identity = drawGoopWorld._identity.setIdentity();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identity.elements);
  gl.uniform1i(u_whichTexture, 4);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  // push goop fragments slightly toward the camera so they win the depth
  // test against co-planar floor/wall geometry (prevents z-fighting)
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(-1.0, -1.0);

  const chunks = g_goopChunks.length > 0 ? g_goopChunks : [{ batches: g_goopBatches }];
  for (const chunk of chunks) {
    if (chunk.centerX !== undefined && typeof isWorldChunkVisible === 'function' && !isWorldChunkVisible(chunk)) continue;
    for (const batch of chunk.batches) {
      const tex = g_GoopTexObjs[batch.texName];
      if (!tex) continue;
      gl.activeTexture(gl.TEXTURE4);
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

  gl.depthMask(true);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.disable(gl.BLEND);
  gl.uniform1i(u_whichTexture, 0);
}

function drawExitDoorMarker() {
  if (g_currentLevel !== LEVEL_BACKROOMS || !g_singleCubeBuffer) return;
  if (typeof DOOR_CELL_X === 'undefined' || DOOR_CELL_X < 0) return;
  if (!isDrawPointVisible(DOOR_CELL_X + 0.5, DOOR_CELL_Z + 0.5, 1.5)) return;

  bindSingleCubeBuffer();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);

  const doorX = DOOR_CELL_X - 0.035;
  const doorZ = DOOR_CELL_Z + 0.5;

  gl.uniform1i(u_whichTexture, 3);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
  gl.uniform1i(u_emissive, 0);
  if (!drawExitDoorMarker._doorPanel) drawExitDoorMarker._doorPanel = new Matrix4();
  const doorPanel = drawExitDoorMarker._doorPanel.setIdentity();
  doorPanel.translate(doorX, 1.08, doorZ);
  doorPanel.scale(0.06, 2.16, 1.08);
  gl.uniformMatrix4fv(u_ModelMatrix, false, doorPanel.elements);
  gl.drawArrays(gl.TRIANGLES, 0, 36);

  gl.uniform1f(u_texColorWeight, 0.0);
  gl.uniform1i(u_whichTexture, 5);
  gl.uniform1i(u_emissive, 1);
  gl.uniform4f(u_baseColor, 1.0, 0.82, 0.16, 0.92);
  const framePieces = [
    { y: 1.10, z: doorZ - 0.62, sy: 2.26, sz: 0.09 },
    { y: 1.10, z: doorZ + 0.62, sy: 2.26, sz: 0.09 },
    { y: 2.25, z: doorZ,        sy: 0.11, sz: 1.34 },
    { y: 0.03, z: doorZ,        sy: 0.06, sz: 1.34 },
  ];
  if (!drawExitDoorMarker._frameMatrix) drawExitDoorMarker._frameMatrix = new Matrix4();
  const frameMatrix = drawExitDoorMarker._frameMatrix;
  for (const piece of framePieces) {
    frameMatrix.setIdentity();
    frameMatrix.translate(doorX - 0.045, piece.y, piece.z);
    frameMatrix.scale(0.07, piece.sy, piece.sz);
    gl.uniformMatrix4fv(u_ModelMatrix, false, frameMatrix.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }

  gl.uniform1i(u_emissive, 0);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.uniform1f(u_texColorWeight, 1.0);
  gl.uniform4f(u_baseColor, 1.0, 1.0, 1.0, 1.0);
}

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

function clampAudioVolume(value) {
  return Math.max(0, Math.min(1, value || 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// initAudioFiles — load ambience + footstep WAVs once user gesture
// has unlocked AudioContext. Called from the title-screen ENTER button.
// ─────────────────────────────────────────────────────────────────────────────
function initAudioFiles() {
  // (1) Ambience — looping <audio> at a quiet level so it sits under everything.
  try {
    g_ambienceEl = new Audio('audio/626096__resaural__backrooms-ambience.wav');
    g_ambienceEl.loop   = true;
    g_ambienceEl.volume = (g_currentLevel === LEVEL_BACKROOMS) ? clampAudioVolume(VOL_AMBIENCE * g_masterVolume) : 0.0;
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
  applyTexParams(fbCanvas.width, fbCanvas.height);

  // Attempt to load the real image asynchronously
  const img = new Image();
  img.onload = () => {
    gl.activeTexture(texUnitEnum);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // PNGs need Y-flip for WebGL UV space
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    applyTexParams(img.width, img.height);
  };
  img.onerror = () => {
    console.log('Texture not found: ' + src + '  (using procedural fallback)');
  };
  img.src = src;
}

function loadBackroomsDoorTexture(texUnitEnum) {
  const tex = gl.createTexture();
  gl.activeTexture(texUnitEnum);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  const fbCanvas = generateFallbackTexture('door');
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fbCanvas);
  applyTexParams(fbCanvas.width, fbCanvas.height);

  const topImg = new Image();
  const bottomImg = new Image();
  let topReady = false;
  let bottomReady = false;

  function uploadIfReady() {
    if (!topReady || !bottomReady) return;
    const width = Math.max(topImg.width, bottomImg.width);
    const halfHeight = Math.max(topImg.height, bottomImg.height);
    const cvs = document.createElement('canvas');
    cvs.width = width;
    cvs.height = halfHeight * 2;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(topImg, 0, 0, width, halfHeight);
    ctx.drawImage(bottomImg, 0, halfHeight, width, halfHeight);

    gl.activeTexture(texUnitEnum);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
    applyTexParams(cvs.width, cvs.height);
  }

  topImg.onload = () => { topReady = true; uploadIfReady(); };
  bottomImg.onload = () => { bottomReady = true; uploadIfReady(); };
  topImg.onerror = () => console.log('Texture not found: textures/Oak_Door_(top_texture)_JE5_BE3.png  (using procedural fallback)');
  bottomImg.onerror = () => console.log('Texture not found: textures/Oak_Door_(bottom_texture)_JE4_BE2.png  (using procedural fallback)');
  topImg.src = 'textures/Oak_Door_(top_texture)_JE5_BE3.png';
  bottomImg.src = 'textures/Oak_Door_(bottom_texture)_JE4_BE2.png';
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function applyTexParams(width, height) {
  const pot = isPowerOfTwo(width || 0) && isPowerOfTwo(height || 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, pot ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, pot ? gl.REPEAT : gl.CLAMP_TO_EDGE);
}

// CLAMP_TO_EDGE params required for NPOT textures (all goop PNGs).
function _goopTexParams() {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
}

// Load every goop PNG into its own WebGL texture object (keyed by filename).
// We only ever bind them to unit 4 at draw time, so no unit conflict.
function loadGoopTextures() {
  const allNames = [
    ...GOOP_FLOOR_TEXTURES,
    ...GOOP_WALL_LEFT_TEXTURES,
    ...GOOP_WALL_RIGHT_TEXTURES,
    ...GOOP_WALL_DECOR_TEXTURES,
  ];
  for (const name of allNames) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // transparent 1×1 fallback: discarded by shader until real PNG loads
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 0, 0]));
    _goopTexParams();
    g_GoopTexObjs[name] = tex;
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      _goopTexParams();
    };
    img.onerror = () => console.log('goop texture missing: textures/' + name);
    img.src = 'textures/' + name;
  }
}

const SUBURB_TEXTURES = [
  'road.png', 'sidewalk.png', 'grass.png', 'housewall.png', 'woodendeck.png',
  'weed.png', 'dirt_unwatered.png', 'dirt_watered.png', 'fence.png',
  'Grass_Block_(top_texture)_JE2.png', 'Oak_Door_(bottom_texture)_JE4_BE2.png',
  'Oak_Door_(top_texture)_JE5_BE3.png', 'Sofa1_diff.png'
];

function getSuburbTextureUploadSource(name, img) {
  if (name !== 'grass.png') return img;
  const cvs = document.createElement('canvas');
  cvs.width = img.height;
  cvs.height = img.width;
  const ctx = cvs.getContext('2d');
  ctx.translate(cvs.width * 0.5, cvs.height * 0.5);
  ctx.rotate(-Math.PI * 0.5);
  ctx.drawImage(img, -img.width * 0.5, -img.height * 0.5);
  return cvs;
}

function loadSuburbTextures() {
  for (const name of SUBURB_TEXTURES) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const fb = generateFallbackTexture(name.replace('.png', ''));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fb);
    applyTexParams(fb.width, fb.height);
    g_SuburbTexObjs[name] = tex;
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const src = getSuburbTextureUploadSource(name, img);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      applyTexParams(src.width, src.height);
    };
    img.onerror = () => console.log('suburb texture missing: textures/' + name + ' (using fallback)');
    img.src = 'textures/' + name;
  }
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
    case 'road': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const stripe = (Math.abs(x - 15) < 2 && y % 16 < 8) ? 55 : 0;
        const n = noise(14);
        setpx(x, y, 42+n+stripe, 42+n+stripe, 45+n+stripe);
      }
      break;
    }
    case 'sidewalk': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const seam = (x % 16 === 0 || y % 16 === 0) ? -22 : 0;
        const n = noise(12);
        setpx(x, y, 150+n+seam, 150+n+seam, 145+n+seam);
      }
      break;
    }
    case 'grass': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = noise(32);
        setpx(x, y, 44+n, 118+n, 42+n);
      }
      break;
    }
    case 'housewall': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const seam = (y % 8 === 0) ? -20 : 0;
        const n = noise(16);
        setpx(x, y, 178+n+seam, 164+n+seam, 136+n+seam);
      }
      break;
    }
    case 'woodendeck':
    case 'fence': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const plank = (x % 8 === 0) ? -25 : 0;
        const n = noise(14);
        setpx(x, y, 120+n+plank, 78+n+plank, 38+n+plank);
      }
      break;
    }
    case 'weed': {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const blade = (x + y * 3) % 7 < 2 ? 35 : 0;
        const n = noise(22);
        setpx(x, y, 30+n, 120+n+blade, 30+n);
      }
      break;
    }
    case 'dirt_unwatered':
    case 'dirt_watered': {
      const wet = type === 'dirt_watered';
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = noise(26);
        setpx(x, y, (wet ? 74 : 110)+n, (wet ? 58 : 76)+n, (wet ? 42 : 48)+n);
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
    if ((k === 'e' || k === 'enter') && typeof g_gs !== 'undefined' && (g_gs.vnOpen || g_gs.signOpen)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      g_keys[k] = false;
      if (g_gs.vnOpen && typeof hideVN === 'function') hideVN();
      else if (g_gs.signOpen && typeof closeBackroomsSign === 'function') closeBackroomsSign();
      return;
    }
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
    if (g_started) requestGamePointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = (document.pointerLockElement === canvas);
    const lockMsg = document.getElementById('lockMsg');
    const suppressPause = g_suppressPointerPause;
    if (lockMsg) lockMsg.style.display = (locked || suppressPause) ? 'none' : 'block';
    resetMouseDeltas();
    if (locked) {
      g_ignoreNextMouseMove = true;
      document.addEventListener('mousemove', onMouseMove);
      // re-entering pointer lock from the pause menu = unpause.
      if (g_paused) togglePause();
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      if (suppressPause) {
        g_suppressPointerPause = false;
        return;
      }
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
  window.addEventListener('blur', resetMouseDeltas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetMouseDeltas();
  });
}

function resetMouseDeltas() {
  g_pendingMouseX = 0;
  g_pendingMouseY = 0;
  g_ignoreNextMouseMove = true;
}

function requestGamePointerLock() {
  if (!canvas) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(err => console.log('pointer lock blocked:', err.message));
  } catch (e) {
    console.log('pointer lock failed:', e.message);
  }
}

function onMouseMove(e) {
  if (g_ignoreNextMouseMove) {
    g_ignoreNextMouseMove = false;
    return;
  }
  const mx = Math.max(-MOUSE_EVENT_DELTA_CAP, Math.min(MOUSE_EVENT_DELTA_CAP, e.movementX || 0));
  const my = Math.max(-MOUSE_EVENT_DELTA_CAP, Math.min(MOUSE_EVENT_DELTA_CAP, e.movementY || 0));
  // Accumulate deltas — applied once per frame in processInput to avoid
  // sub-frame jitter from high-frequency mouse polling.
  g_pendingMouseX = Math.max(-MOUSE_PENDING_DELTA_CAP, Math.min(MOUSE_PENDING_DELTA_CAP, g_pendingMouseX + mx));
  g_pendingMouseY = Math.max(-MOUSE_PENDING_DELTA_CAP, Math.min(MOUSE_PENDING_DELTA_CAP, g_pendingMouseY + my));
}

function onMouseDown(e) {
  if (document.pointerLockElement !== canvas) return;
  if (e.button !== 0 && e.button !== 2) return;
  if (typeof g_gs !== 'undefined' && g_gs.signOpen && typeof closeBackroomsSign === 'function') {
    if (e.button === 0) closeBackroomsSign();
    return;
  }
  if (typeof g_gs !== 'undefined' && g_gs.vnOpen && typeof hideVN === 'function') {
    hideVN();
    return;
  }
  const [tx, tz] = getInteractionTargetCell();
  if (typeof handleNarrativeInteract === 'function' && handleNarrativeInteract(tx, tz, e.button)) return;
  if (e.button === 0 && isDoor(tx, tz)) triggerWin();
}

function getViewRayDir() {
  const yRad = camera.yaw * Math.PI / 180;
  const pRad = camera.pitch * Math.PI / 180;
  const cosp = Math.cos(pRad);
  return [cosp * Math.cos(yRad), Math.sin(pRad), cosp * Math.sin(yRad)];
}

function isInteractionTargetRelevant(code) {
  if (code === INTERACT_NONE) return false;
  if (typeof g_gs === 'undefined') return true;
  if (g_currentLevel !== LEVEL_SUBURBS) return code === INTERACT_SIGN;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_MOVE) return code === INTERACT_WEED;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_WEEDS) return code === INTERACT_WEED;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_SOIL_PICKUP) return code === INTERACT_SOIL_BAG;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_SOIL_PLACE) return code === INTERACT_GARDEN_PLOT;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_WATER_PICKUP) return code === INTERACT_WATER_CAN;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_WATER_PLACE) return code === INTERACT_GARDEN_PLOT;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_RETURN_CAN) return code === INTERACT_CAN_RETURN;
  if (g_gs.phase === GAME_PHASE.TUTORIAL_GRASS_ROW) return code === INTERACT_GRASS_ROW;
  if (g_gs.phase === GAME_PHASE.BACKROOMS_TRAPPED) return code === INTERACT_SIGN;
  return false;
}

function rayAabbDistance(origin, dir, minX, minY, minZ, maxX, maxY, maxZ, maxReach) {
  let tMin = 0;
  let tMax = maxReach;
  const mins = [minX, minY, minZ];
  const maxs = [maxX, maxY, maxZ];
  for (let axis = 0; axis < 3; axis++) {
    const o = origin[axis];
    const d = dir[axis];
    if (Math.abs(d) < 0.00001) {
      if (o < mins[axis] || o > maxs[axis]) return null;
      continue;
    }
    let t1 = (mins[axis] - o) / d;
    let t2 = (maxs[axis] - o) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMax < tMin) return null;
  }
  return tMin <= maxReach ? tMin : null;
}

function getObjectInteractionTarget(eye, dir, maxReach) {
  let best = null;
  function consider(tx, tz, minX, minY, minZ, maxX, maxY, maxZ) {
    if (typeof getInteractiveAt === 'function' && !isInteractionTargetRelevant(getInteractiveAt(tx, tz))) return;
    const t = rayAabbDistance(eye, dir, minX, minY, minZ, maxX, maxY, maxZ, maxReach);
    if (t === null) return;
    if (!best || t < best.t) best = { t, tx, tz };
  }

  if (typeof g_LevelModelSlots !== 'undefined') {
    for (const slot of g_LevelModelSlots) {
      const tx = Math.floor(slot.x);
      const tz = Math.floor(slot.z);
      const width = Math.max(0.25, slot.width || 0.7) + 0.22;
      const length = Math.max(0.25, slot.length || 0.7) + 0.22;
      const height = Math.max(0.25, slot.height || 1.0) + 0.18;
      consider(tx, tz,
        slot.x - width * 0.5, -0.06, slot.z - length * 0.5,
        slot.x + width * 0.5, height, slot.z + length * 0.5);
    }
  }

  if (typeof g_LevelItemSlots !== 'undefined') {
    for (const slot of g_LevelItemSlots) {
      const tx = Math.floor(slot.x);
      const tz = Math.floor(slot.z);
      const cx = tx + 0.5;
      const cz = tz + 0.5;
      const h = Math.max(0.35, slot.height || 0.55) + 0.16;
      consider(tx, tz, cx - 0.42, -0.06, cz - 0.42, cx + 0.42, h, cz + 0.42);
    }
  }

  if (typeof g_InteractiveMap !== 'undefined') {
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let z = 0; z < MAP_SIZE; z++) {
        const code = getInteractiveAt(x, z);
        if (!isInteractionTargetRelevant(code) || (code !== INTERACT_GRASS_ROW && code !== INTERACT_CAN_RETURN)) continue;
        const height = code === INTERACT_GRASS_ROW ? Math.max(0.18, g_Map[x][z]) : 0.35;
        consider(x, z, x - 0.05, -0.06, z - 0.05, x + 1.05, height + 0.12, z + 1.05);
      }
    }
  }

  return best ? [best.tx, best.tz] : null;
}

function getInteractionTargetCell() {
  const eye = camera.eye.elements;
  const dir = getViewRayDir();
  const objectHit = getObjectInteractionTarget(eye, dir, 4.6);
  if (objectHit) return objectHit;

  if (dir[1] < -0.05) {
    const tFloor = eye[1] / -dir[1];
    if (tFloor > 0.15 && tFloor <= 5.5) {
      const floorCell = [Math.floor(eye[0] + dir[0] * tFloor), Math.floor(eye[2] + dir[2] * tFloor)];
      if (typeof getInteractiveAt === 'function' && isInteractionTargetRelevant(getInteractiveAt(floorCell[0], floorCell[1]))) return floorCell;
    }
  }

  const interactiveCells = [];
  for (let t = 0.25; t <= 4.2; t += 0.12) {
    const x = Math.floor(eye[0] + dir[0] * t);
    const z = Math.floor(eye[2] + dir[2] * t);
    if (interactiveCells.length && interactiveCells[interactiveCells.length - 1][0] === x && interactiveCells[interactiveCells.length - 1][1] === z) continue;
    interactiveCells.push([x, z]);
    if (typeof getInteractiveAt === 'function' && isInteractionTargetRelevant(getInteractiveAt(x, z))) return [x, z];
  }
  if (dir[1] < -0.05) {
    const tFloor = eye[1] / -dir[1];
    if (tFloor > 0.15 && tFloor <= 5.5) {
      return [Math.floor(eye[0] + dir[0] * tFloor), Math.floor(eye[2] + dir[2] * tFloor)];
    }
  }
  const fwd = camera.getFwd();
  return getTargetCell(eye[0], eye[2], fwd[0], fwd[2]);
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
    if (typeof isWorldBlockedCell === 'function') {
      if (isWorldBlockedCell(bx, bz)) return true;
    } else if (g_Map[bx][bz] > 0) return true;
  }
  // furniture acts as a solid circular obstacle. only check enabled kinds.
  if (typeof g_FurnitureSlots !== 'undefined') {
    for (const f of g_FurnitureSlots) {
      if (!isFurnitureKindEnabled(f.kind)) continue;
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
  const canFull = (typeof canMoveToNarrative !== 'function') || canMoveToNarrative(nx, nz);
  if      (canFull && !isBlockedAt(nx, nz))   { e[0] = nx; e[2] = nz; }
  else if (((typeof canMoveToNarrative !== 'function') || canMoveToNarrative(nx, e[2])) && !isBlockedAt(nx, e[2])) { e[0] = nx; }
  else if (((typeof canMoveToNarrative !== 'function') || canMoveToNarrative(e[0], nz)) && !isBlockedAt(e[0], nz)) { e[2] = nz; }
  camera.updateViewMatrix();
}

// ─────────────────────────────────────────────────────────────────────────────
function processInput(dt) {
  // Apply accumulated mouse deltas once per frame (prevents sub-frame jitter
  // from high-polling-rate mice applying many small increments between renders).
  const sensitivity = 0.12;
  const mx = Math.max(-MOUSE_FRAME_DELTA_CAP, Math.min(MOUSE_FRAME_DELTA_CAP, g_pendingMouseX));
  const my = Math.max(-MOUSE_FRAME_DELTA_CAP, Math.min(MOUSE_FRAME_DELTA_CAP, g_pendingMouseY));
  g_pendingMouseX -= mx;
  g_pendingMouseY -= my;
  if (Math.abs(g_pendingMouseX) < 0.001) g_pendingMouseX = 0;
  if (Math.abs(g_pendingMouseY) < 0.001) g_pendingMouseY = 0;
  if (mx !== 0) camera.panLeft(mx * sensitivity);
  if (my !== 0) camera.lookVertical(-my * sensitivity);

  if (typeof isNarrativeMovementLocked === 'function' && isNarrativeMovementLocked()) {
    g_isSprinting = false;
    g_sprint = Math.min(1, g_sprint + SPRINT_REGEN * dt);
    camera.updateViewMatrix();
    return;
  }

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
  if (dx !== 0 || dz !== 0) {
    tryMove(dx, dz);
    if (typeof narrativeRecordMovement === 'function') narrativeRecordMovement();
  }
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
function formatSpeedrunTime(seconds) {
  const totalCentis = Math.max(0, Math.floor(seconds * 100));
  const centis = totalCentis % 100;
  const totalSecs = Math.floor(totalCentis / 100);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hours = Math.floor(totalSecs / 3600);
  const main = hours > 0
    ? hours + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
    : String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  return main + '.' + String(centis).padStart(2, '0');
}

var g_lastTimerText = '';
var g_lastTimerDanger = false;
var g_lastSpeedrunText = '';
var g_lastSpeedrunShown = false;
var g_lastSanityWidth = '';
var g_lastSanityBg = '';
var g_lastSprintWidth = '';
var g_lastSprintBg = '';
var g_lastSprintOpacity = '';
var g_hudEls = null;

function getHudEls() {
  if (!g_hudEls) {
    g_hudEls = {
      timer: document.getElementById('timer'),
      speedrun: document.getElementById('speedrunTimer'),
      sanityFill: document.getElementById('sanityFill'),
      sprintFill: document.getElementById('sprintFill'),
    };
  }
  return g_hudEls;
}

function updateHUD() {
  const hud = getHudEls();
  const secs = Math.max(0, g_timer);
  const mm   = Math.floor(secs / 60).toString().padStart(2, '0');
  const ss   = Math.floor(secs % 60).toString().padStart(2, '0');
  const timerEl = hud.timer;
  const timerText = mm + ':' + ss;
  const timerDanger = secs < 10;
  if (timerEl && timerText !== g_lastTimerText) {
    timerEl.textContent = timerText;
    g_lastTimerText = timerText;
  }
  if (timerEl && timerDanger !== g_lastTimerDanger) {
    timerEl.className = timerDanger ? 'danger' : '';
    g_lastTimerDanger = timerDanger;
  }

  const speedrunEl = hud.speedrun;
  if (speedrunEl) {
    if (g_speedrunFinished || g_lastSpeedrunShown) {
      const speedrunText = 'TIME ' + formatSpeedrunTime(g_speedrunTime);
      if (speedrunText !== g_lastSpeedrunText) {
        speedrunEl.textContent = speedrunText;
        g_lastSpeedrunText = speedrunText;
      }
    }
    if (g_speedrunFinished !== g_lastSpeedrunShown) {
      speedrunEl.classList.toggle('show', g_speedrunFinished);
      g_lastSpeedrunShown = g_speedrunFinished;
    }
  }

  const dist  = g_entityActive ? getEntityDist() : 999;
  const ratio = Math.max(0, Math.min(1, dist / 20));
  const fill  = hud.sanityFill;
  if (fill) {
    const sanityWidth = Math.round(ratio * 100) + '%';
    const sanityBg = ratio > 0.5 ? '#4aff60'
                   : ratio > 0.25 ? '#ffcc00'
                   : '#ff3030';
    if (sanityWidth !== g_lastSanityWidth) {
      fill.style.width = sanityWidth;
      g_lastSanityWidth = sanityWidth;
    }
    if (sanityBg !== g_lastSanityBg) {
      fill.style.background = sanityBg;
      g_lastSanityBg = sanityBg;
    }
  }

  // Sprint gauge — cyan when full, fades to red as it depletes.
  // When locked out (depleted, recharging), the bar pulses slowly between
  // dim and bright red so the player sees they cannot sprint yet.
  const sprintFill = hud.sprintFill;
  if (sprintFill) {
    const sprintWidth = Math.round(g_sprint * 100) + '%';
    if (sprintWidth !== g_lastSprintWidth) {
      sprintFill.style.width = sprintWidth;
      g_lastSprintWidth = sprintWidth;
    }
    let sprintBg;
    let sprintOpacity;
    if (g_sprintLocked) {
      // Slow ~1.2 Hz pulse, opacity 0.35 ↔ 1.0
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0075));
      sprintBg = '#ff3030';
      sprintOpacity = pulse.toFixed(3);
    } else {
      sprintOpacity = '1';
      sprintBg = g_sprint > 0.4  ? '#5ec8ff'
               : g_sprint > 0.15 ? '#ffaa33'
               : '#ff5050';
    }
    if (sprintBg !== g_lastSprintBg) {
      sprintFill.style.background = sprintBg;
      g_lastSprintBg = sprintBg;
    }
    if (sprintOpacity !== g_lastSprintOpacity) {
      sprintFill.style.opacity = sprintOpacity;
      g_lastSprintOpacity = sprintOpacity;
    }
  }

  updateProximityAudio(dist);
}

function updateFps(timestamp, frameMs) {
  if (frameMs > 0) {
    const alpha = frameMs > g_frameMsSmoothed ? 0.25 : 0.08;
    g_frameMsSmoothed += (frameMs - g_frameMsSmoothed) * alpha;
  }
  if (timestamp - g_lastFpsMs >= 250) {
    const fps = g_frameMsSmoothed > 0 ? (1000 / g_frameMsSmoothed) : 0;
    const fpsEl = document.getElementById('fps');
    if (fpsEl) fpsEl.textContent = 'FPS: ' + fps.toFixed(0) + ' (' + g_frameMsSmoothed.toFixed(1) + 'ms)' + getPerformanceHudSuffix();
    g_lastFpsMs = timestamp;
  }
}

function getPerformanceHudSuffix() {
  if (!g_performanceMode || !canvas) return '';
  return ' | PERF ' + canvas.width + 'x' + canvas.height;
}

function refreshFpsModeLabel() {
  const fpsEl = document.getElementById('fps');
  if (!fpsEl) return;
  const base = (fpsEl.textContent || 'FPS: --').split(' | ')[0] || 'FPS: --';
  fpsEl.textContent = base + getPerformanceHudSuffix();
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
  const perfCb = document.getElementById('performanceMode');
  if (!overlay || !startBtn) return;   // graceful fallback if HTML not added

  if (perfCb) {
    perfCb.addEventListener('change', () => setPerformanceMode(perfCb.checked));
  }

  startBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    g_flickerEnabled = !(flickerCb && flickerCb.checked);
    setPerformanceMode(!!(perfCb && perfCb.checked));
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    g_speedrunTime = 0;
    g_speedrunFinished = false;
    const speedrunEl = document.getElementById('speedrunTimer');
    if (speedrunEl) speedrunEl.classList.remove('show');
    g_started = true;
    if (typeof startNarrativeSequence === 'function') startNarrativeSequence();
    try { if (g_audioCtx && g_audioCtx.state === 'suspended') g_audioCtx.resume(); }
    catch (e) { console.log('audio resume failed:', e.message); }
    try { initAudioFiles(); } catch (e) { console.log('audio init failed:', e.message); }
    // Pointer lock can throw if the document isn't focused. Wrap so it can
    // never block game start.
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(err => console.log('pointer lock blocked:', err.message));
    } catch (e) { console.log('pointer lock failed:', e.message); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// setupFullscreen — wires the FULLSCREEN HUD button.
// This is intentionally tab fullscreen instead of browser-native fullscreen:
// browsers reserve Escape to leave native fullscreen, which conflicts with the
// game's Escape-to-pause flow. We fill the current viewport with CSS instead.
// ─────────────────────────────────────────────────────────────────────────────
var g_origCanvasW = 0, g_origCanvasH = 0;
var g_gameFullscreen = false;

function syncFullscreenButtons() {
  const label = g_gameFullscreen ? 'EXIT FS' : 'FULLSCREEN';
  const titleBtn = document.getElementById('fullscreenBtn');
  const pauseBtn = document.getElementById('pauseFsBtn');
  if (titleBtn) titleBtn.textContent = label;
  if (pauseBtn) pauseBtn.textContent = label;
}

function applyCurrentCanvasSize() {
  const useFullscreenSize = g_gameFullscreen;
  document.body.classList.toggle('game-fullscreen', useFullscreenSize);
  if (useFullscreenSize) {
    applyCanvasRenderSize(window.innerWidth, window.innerHeight);
  } else {
    applyCanvasRenderSize(g_origCanvasW || 800, g_origCanvasH || 600);
  }
  syncFullscreenButtons();
}

function setGameFullscreen(enabled) {
  g_gameFullscreen = !!enabled;
  applyCurrentCanvasSize();
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
  }
}

function applyCanvasRenderSize(cssW, cssH) {
  if (!canvas || !gl) return;
  const viewport = document.getElementById('gameViewport');
  const scale = g_performanceMode ? PERFORMANCE_RENDER_SCALE : 1.0;
  const displayW = Math.max(1, Math.floor(cssW));
  const displayH = Math.max(1, Math.floor(cssH));
  const renderW = Math.max(320, Math.floor(displayW * scale));
  const renderH = Math.max(240, Math.floor(displayH * scale));
  if (viewport) {
    viewport.style.width = displayW + 'px';
    viewport.style.height = displayH + 'px';
  }
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  if (canvas.width !== renderW) canvas.width = renderW;
  if (canvas.height !== renderH) canvas.height = renderH;
  canvas.style.imageRendering = g_performanceMode ? 'pixelated' : '';
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (camera) camera.updateProjectionMatrix(canvas.width, canvas.height);
  refreshFpsModeLabel();
}

function syncPerformanceCheckboxes() {
  const titlePerf = document.getElementById('performanceMode');
  const pausePerf = document.getElementById('pausePerformanceCb');
  if (titlePerf) titlePerf.checked = g_performanceMode;
  if (pausePerf) pausePerf.checked = g_performanceMode;
}

function setPerformanceMode(enabled) {
  g_performanceMode = !!enabled;
  syncPerformanceCheckboxes();
  applyCurrentCanvasSize();
  applyLevelFogSettings();
}

function applyLevelFogSettings() {
  if (!gl) return;
  if (typeof g_currentLevel !== 'undefined' && typeof LEVEL_SUBURBS !== 'undefined' && g_currentLevel === LEVEL_SUBURBS) {
    const near = g_performanceMode ? SUBURB_PERF_FOG_NEAR : SUBURB_FOG_NEAR;
    const far  = g_performanceMode ? SUBURB_PERF_FOG_FAR  : SUBURB_FOG_FAR;
    if (u_fogNear) gl.uniform1f(u_fogNear, near);
    if (u_fogFar)  gl.uniform1f(u_fogFar,  far);
    if (u_fogColor && typeof g_skyColor !== 'undefined') gl.uniform3f(u_fogColor, g_skyColor[0], g_skyColor[1], g_skyColor[2]);
    return;
  }
  const near = g_performanceMode ? BACKROOMS_PERF_FOG_NEAR : BACKROOMS_FOG_NEAR;
  const far  = g_performanceMode ? BACKROOMS_PERF_FOG_FAR  : BACKROOMS_FOG_FAR;
  if (u_fogNear) gl.uniform1f(u_fogNear, near);
  if (u_fogFar)  gl.uniform1f(u_fogFar, far);
  if (u_fogColor) gl.uniform3f(u_fogColor, FOG_R, FOG_G, FOG_B);
}

function setupFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  const container = document.getElementById('container');
  if (!btn || !container) return;

  g_origCanvasW = canvas.width;
  g_origCanvasH = canvas.height;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setGameFullscreen(!g_gameFullscreen);
  });

  document.addEventListener('fullscreenchange', applyCurrentCanvasSize);
  document.addEventListener('webkitfullscreenchange', applyCurrentCanvasSize);
  window.addEventListener('resize', () => {
    if (g_gameFullscreen) applyCurrentCanvasSize();
  });
  applyCurrentCanvasSize();
}

// pause-menu wiring. resume button, flicker checkbox, master volume slider,
// and a fullscreen toggle that mirrors the title-screen one.
function setupPauseMenu() {
  const resumeBtn = document.getElementById('pauseResumeBtn');
  const flickerCb = document.getElementById('pauseFlickerCb');
  const perfCb    = document.getElementById('pausePerformanceCb');
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

  if (perfCb) {
    perfCb.checked = g_performanceMode;
    perfCb.addEventListener('change', () => {
      setPerformanceMode(perfCb.checked);
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
      if (g_ambienceEl) {
        const inBackrooms = (typeof g_currentLevel !== 'undefined' && g_currentLevel === LEVEL_BACKROOMS);
        g_ambienceEl.volume = inBackrooms ? clampAudioVolume(VOL_AMBIENCE * v) : 0.0;
      }
      if (g_chaseEl) g_chaseEl.volume = Math.min(g_chaseEl.volume, clampAudioVolume(VOL_CHASE_MAX * v));
    };
    volSlider.addEventListener('input', apply);
  }

  if (fsBtn) {
    fsBtn.addEventListener('click', e => {
      e.stopPropagation();
      setGameFullscreen(!g_gameFullscreen);
    });
  }
}

// bootstrap. start everything once the DOM is ready.
window.addEventListener('load', main);
