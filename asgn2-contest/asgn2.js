// global variables
var canvas;
var gl;
var a_Position;
var a_Normal;
var u_ModelMatrix;
var u_GlobalRotation;
var u_NormalMatrix;
var u_FragColor;
var u_UseSpots;
var u_SpotScale;
var u_SpotThreshold;
var u_GradientStrength;
var u_UseLighting;
var u_LightDirection;
var u_AmbientLight;
var u_Time;
var u_GrassWave;
var u_GrassStepStrength;
var gIsDrawingShadow = false;

// runtime state & timing
var gAnimalGlobalRotation = 0;
var gLastFrameTimestamp = 0;
var currentFrameTimeMs = 16.7;
var gSeconds = 0;
var gWalkPhase = 0;

// fps unlock
var UNCAPPED_FPS = false;
var fpsChannel = new MessageChannel(); 

// tracks the last time fps was updated to avoid glitching
var gLastFpsUpdateTime = 0;
var gFrameCount = 0;

// mouse controls
var gCameraXAngle = 0;
var gCameraYAngle = 0;
var g_mouseDown = false;
var g_lastX = -1;
var g_lastY = -1;

// animation toggles & states
var gFrontAnimationEnabled = false;
var gBackAnimationEnabled = false;
var gTailAnimationEnabled = false;
var gPokeAnimationActive = false;
var gPokeStartTime = 0;
var gEatingAnimationActive = false;
var gEatStartTime = 0;
var EAT_ANIMATION_DURATION = 4.2;
var gBiteHasTriggered = false;

// animation scales
var gFrontStrideScale = 1.0;
var gBackStrideScale = 1.0;
var gTailSwayScale = 12.0;
var gTailBaseAngle = 35.0;
var gTailCurlOffset = 0.0;

// preset tail animation profile (base/curl remain fixed while animating)
var TAIL_PRESET_BASE_ANGLE = 35.0;
var TAIL_PRESET_CURL_OFFSET = 0.0;

// ui-driven joint angles
var gFrontRightHipAngle = 8, gFrontRightKneeAngle = 12, gFrontRightAnkleAngle = -6;
var gFrontLeftHipAngle = -8, gFrontLeftKneeAngle = 10, gFrontLeftAnkleAngle = -6;
var gBackRightHipAngle = -6, gBackRightKneeAngle = 14, gBackRightAnkleAngle = -5;
var gBackLeftHipAngle = 6, gBackLeftKneeAngle = 11, gBackLeftAnkleAngle = -7;

// control panel target selection
var gSelectedControlTargets = {
  frontRight: true,
  frontLeft: false,
  backRight: false,
  backLeft: false,
  tail: false
};

var LEG_TARGET_KEYS = ['frontRight', 'frontLeft', 'backRight', 'backLeft'];
var TARGET_LABELS = {
  frontRight: 'Front Right',
  frontLeft: 'Front Left',
  backRight: 'Back Right',
  backLeft: 'Back Left',
  tail: 'Tail'
};

var TARGET_BUTTON_IDS = {
  frontRight: 'targetFrontRight',
  frontLeft: 'targetFrontLeft',
  backRight: 'targetBackRight',
  backLeft: 'targetBackLeft',
  tail: 'targetTail'
};

// environment constants
var GROUND_Y = -0.85;
var SHADOW_COLOR = [0.13, 0.15, 0.12, 1.0];
var GROUND_COLOR = [0.20, 0.37, 0.18, 1.0];
var MEADOW_HALF_WIDTH = 1.68;
var MEADOW_REPEAT_WIDTH = MEADOW_HALF_WIDTH * 2.0;
var GRASS_SCROLL_SPEED = 0.58;
var BODY_COLOR = [0.97, 0.97, 0.96, 1.0];
var HEAD_COLOR = [0.032, 0.030, 0.028, 1.0];
var NOSE_COLOR = [0.72, 0.43, 0.43, 1.0];
var LEG_COLOR = [0.92, 0.89, 0.82, 1.0];
var HOOF_COLOR = [0.10, 0.09, 0.08, 1.0];
var EAR_COLOR = [0.035, 0.032, 0.030, 1.0];
var HORN_COLOR = [0.74, 0.72, 0.62, 1.0];
var TAIL_COLOR = [0.88, 0.84, 0.75, 1.0];
var TAIL_TUFT_COLOR = [0.06, 0.055, 0.05, 1.0];
var EYE_WHITE_COLOR = [0.95, 0.95, 0.95, 1.0];
var PUPIL_COLOR = [0.08, 0.08, 0.08, 1.0];
var BLACK_PATCH_COLOR = [0.025, 0.022, 0.02, 1.0];
var UDDER_COLOR = [0.78, 0.52, 0.54, 1.0];

// shader constants
var FUR_SPOT_SCALE = 2.0, FUR_SPOT_THRESHOLD = 0.50, FUR_GRADIENT_STRENGTH = 0.06;

// animation kinematics
var WALK_CYCLE_HZ = 0.7;
var FRONT_HIP_SWING_GAIN = 1.45, HIND_HIP_SWING_GAIN = 0.62;
var TAIL_ROOT_PHASE_DELAY = 1.0, TAIL_SEGMENT_LAG = 0.6;
var FULL_ANIM_BODY_BOB_AMPLITUDE = 0.032;
var FULL_ANIM_LEG_JOINT_BOB_AMPLITUDE = 0.005;
var BOB_DIAGONAL_PHASE_OFFSET = 0.35;
var gGrassScrollOffset = 0.0;

function isFullAnimationModeEnabled() {
  return gFrontAnimationEnabled && gBackAnimationEnabled && gTailAnimationEnabled;
}

function getGrassMotionStrength() {
  if (gEatingAnimationActive || !gFrontAnimationEnabled || !gBackAnimationEnabled) {
    return 0.0;
  }
  return Math.max(0.0, Math.min(gFrontStrideScale, gBackStrideScale));
}

function updateGrassScroll(dtMs) {
  var motionStrength = getGrassMotionStrength();
  if (motionStrength <= 0.0 || dtMs <= 0.0) {
    return;
  }
  gGrassScrollOffset -= dtMs * 0.001 * GRASS_SCROLL_SPEED * motionStrength;
  while (gGrassScrollOffset <= -MEADOW_REPEAT_WIDTH) {
    gGrassScrollOffset += MEADOW_REPEAT_WIDTH;
  }
}

function wrapGrassX(x) {
  while (x < -MEADOW_HALF_WIDTH) {
    x += MEADOW_REPEAT_WIDTH;
  }
  while (x > MEADOW_HALF_WIDTH) {
    x -= MEADOW_REPEAT_WIDTH;
  }
  return x;
}

function getDiagonalBobPulse(phase, sideOffset) {
  var shifted = shiftPhase(phase, sideOffset);
  var halfStepPhase = getCyclePhase(shifted, 2.0);
  return Math.sin(Math.PI * halfStepPhase);
}

// keyframes — 4-beat walk gait (LH→LF→RH→RF offset 0.25 each)
// Front: push-off 0.00-0.45, swing 0.45-0.75, land 0.75-1.00
var FRONT_UPPER_KEYS = [[0.00, 113], [0.25, 108], [0.45, 95], [0.60, 88], [0.75, 100], [0.90, 114], [1.00, 113]];
var FRONT_LOWER_KEYS = [[0.00, 178], [0.25, 180], [0.45, 155], [0.60, 138], [0.75, 100], [0.90, 170], [1.00, 178]];
var FRONT_FOOT_KEYS  = [[0.00, 158], [0.25, 148], [0.45, 175], [0.60, 182], [0.75, 125], [0.90, 152], [1.00, 158]];
// Hind: same stride shape but bigger hip excursion (digitigrade)
var HIND_UPPER_KEYS  = [[0.00, 112], [0.25, 130], [0.50, 148], [0.70, 105], [0.85, 100], [1.00, 112]];
var HIND_LOWER_KEYS  = [[0.00, 148], [0.25, 140], [0.50, 168], [0.70, 120], [0.85, 112], [1.00, 148]];
var HIND_FOOT_KEYS   = [[0.00, 158], [0.25, 148], [0.50, 180], [0.70, 132], [0.85, 128], [1.00, 158]];


function main() {
  setupWebGL();
  connectVariablesToGLSL();
  setupMouseControls();
  addActionsForHtmlUI();

  gl.clearColor(0.56, 0.72, 0.92, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  if (UNCAPPED_FPS) {
    fpsChannel.port1.onmessage = function() {
      tick(performance.now());
    };
    fpsChannel.port2.postMessage(null);
  } else {
    requestAnimationFrame(tick);
  }
}

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("Failed to load shaders.");
    return;
  }
  
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_UseSpots = gl.getUniformLocation(gl.program, 'u_UseSpots');
  u_SpotScale = gl.getUniformLocation(gl.program, 'u_SpotScale');
  u_SpotThreshold = gl.getUniformLocation(gl.program, 'u_SpotThreshold');
  u_GradientStrength = gl.getUniformLocation(gl.program, 'u_GradientStrength');
  u_UseLighting = gl.getUniformLocation(gl.program, 'u_UseLighting');
  u_LightDirection = gl.getUniformLocation(gl.program, 'u_LightDirection');
  u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
  u_Time = gl.getUniformLocation(gl.program, 'u_Time');
  u_GrassWave = gl.getUniformLocation(gl.program, 'u_GrassWave');
  u_GrassStepStrength = gl.getUniformLocation(gl.program, 'u_GrassStepStrength');

  gl.uniform3f(u_LightDirection, -0.36, 0.82, 0.44);
  gl.uniform3f(u_AmbientLight, 0.38, 0.38, 0.38);
}

function setupMouseControls() {
  canvas.onmousedown = function(ev) {
    if (ev.shiftKey) {
      gPokeAnimationActive = true;
      gPokeStartTime = gSeconds;
    }
    var x = ev.clientX, y = ev.clientY;
    var rect = ev.target.getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
      g_lastX = x;
      g_lastY = y;
      g_mouseDown = true;
    }
  };

  canvas.onmouseup = function(ev) { g_mouseDown = false; };

  canvas.onmousemove = function(ev) {
    if (g_mouseDown) {
      var factor = 100 / canvas.height;
      var dx = factor * (ev.clientX - g_lastX);
      var dy = factor * (ev.clientY - g_lastY);
      gCameraXAngle -= dy;
      gCameraYAngle -= dx;
      g_lastX = ev.clientX;
      g_lastY = ev.clientY;
    }
  };
}

var gPyramidBuffer = null;

function drawPyramidWithColor(matrix, color) {
  if (!gPyramidBuffer) {
    var vertices = new Float32Array([
       // base
       -0.5, 0.0, -0.5,   0.5, 0.0, -0.5,   0.5, 0.0, 0.5,
       -0.5, 0.0, -0.5,   0.5, 0.0, 0.5,   -0.5, 0.0, 0.5,
       // front face
       -0.5, 0.0, 0.5,    0.5, 0.0, 0.5,    0.0, 1.0, 0.0,
       // right face
        0.5, 0.0, 0.5,    0.5, 0.0, -0.5,   0.0, 1.0, 0.0,
       // back face
        0.5, 0.0, -0.5,  -0.5, 0.0, -0.5,   0.0, 1.0, 0.0,
       // left face
       -0.5, 0.0, -0.5,  -0.5, 0.0, 0.5,    0.0, 1.0, 0.0
    ]);
    gPyramidBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gPyramidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_UseSpots, 0.0); // No spots on horns
  gl.uniform1f(u_GradientStrength, gIsDrawingShadow ? 0.0 : FUR_GRADIENT_STRENGTH);
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, gPyramidBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  
  gl.drawArrays(gl.TRIANGLES, 0, 18);
}


function tick(timestamp) {
  if (gLastFrameTimestamp === 0) gLastFrameTimestamp = timestamp;
  var dt = timestamp - gLastFrameTimestamp;
  gLastFrameTimestamp = timestamp;
  
  gSeconds = timestamp * 0.001;
  gWalkPhase = getCyclePhase(gSeconds, WALK_CYCLE_HZ);
  updateGrassScroll(dt);

  updateAnimationAngles();
  updatePerformanceHud(timestamp);
  renderScene();
  
  // continue loop based on toggle
  if (UNCAPPED_FPS) {
    fpsChannel.port2.postMessage(null);
  } else {
    requestAnimationFrame(tick);
  }
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var globalRotMat = new Matrix4();
  // Apply mouse rotation first, then slider rotation
  globalRotMat.rotate(gCameraXAngle, 1, 0, 0);
  globalRotMat.rotate(gCameraYAngle, 0, 1, 0);
  globalRotMat.rotate(gAnimalGlobalRotation, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotation, false, globalRotMat.elements);
  if (u_Time) gl.uniform1f(u_Time, gSeconds);

  drawGround();

  var root = new Matrix4();
  var fullAnimBob = 0.0;
  if (isFullAnimationModeEnabled() && !gEatingAnimationActive) {
    var bodyBobPulse = getDiagonalBobPulse(gWalkPhase, BOB_DIAGONAL_PHASE_OFFSET);
    fullAnimBob = FULL_ANIM_BODY_BOB_AMPLITUDE * bodyBobPulse;
  }
  root.translate(0.0, -0.324 + fullAnimBob, 0.0);
  root.scale(0.64, 0.64, 0.64);

  var eatPose = getEatingPose();
  handleGrassBite(eatPose.bite);

  drawCowShadow(root, eatPose);
  drawMeadow();
  drawEatingGrassPatch(eatPose);
  drawCow(root, false, eatPose);
}


function updateAnimationAngles() {
  var phaseBackLeft = shiftPhase(gWalkPhase, 0.00);
  var phaseFrontLeft = shiftPhase(gWalkPhase, 0.15);
  var phaseBackRight = shiftPhase(gWalkPhase, 0.50);
  var phaseFrontRight = shiftPhase(gWalkPhase, 0.65);

  var effectiveFrontStride = gEatingAnimationActive ? 0.0 : gFrontStrideScale;
  var effectiveBackStride = gEatingAnimationActive ? 0.0 : gBackStrideScale;

  if (gFrontAnimationEnabled) {
    var frontLeft = getFrontLegRotationFromPhase(phaseFrontLeft, effectiveFrontStride);
    var frontRight = getFrontLegRotationFromPhase(phaseFrontRight, effectiveFrontStride);
    
    gFrontLeftHipAngle = frontLeft.hip;
    gFrontLeftKneeAngle = frontLeft.knee;
    gFrontLeftAnkleAngle = frontLeft.ankle;
    
    gFrontRightHipAngle = frontRight.hip;
    gFrontRightKneeAngle = frontRight.knee;
    gFrontRightAnkleAngle = frontRight.ankle;
  }

  if (gBackAnimationEnabled) {
    var backLeft = getHindLegRotationFromPhase(phaseBackLeft, effectiveBackStride);
    var backRight = getHindLegRotationFromPhase(phaseBackRight, effectiveBackStride);
    
    gBackLeftHipAngle = backLeft.hip;
    gBackLeftKneeAngle = backLeft.knee;
    gBackLeftAnkleAngle = backLeft.ankle;
    
    gBackRightHipAngle = backRight.hip;
    gBackRightKneeAngle = backRight.knee;
    gBackRightAnkleAngle = backRight.ankle;
  }
  
  syncJointSliderUi();
}

function getCyclePhase(seconds, frequencyHz) { 
  var t = seconds * frequencyHz; 
  return t - Math.floor(t); 
}

function shiftPhase(phase, offset) { 
  var shifted = phase + offset; 
  return shifted - Math.floor(shifted); 
}

function smoothStep01(t) { 
  return t * t * (3.0 - 2.0 * t); 
}

function clamp01(value) {
  return Math.max(0.0, Math.min(1.0, value));
}

function startEatingGrassAnimation() {
  gEatingAnimationActive = true;
  gEatStartTime = gSeconds;
  gBiteHasTriggered = false;
  var button = document.getElementById('eatGrassButton');
  if (button) {
    button.classList.add('active');
    button.textContent = 'Eating...';
  }
}

function finishEatingGrassAnimation() {
  gEatingAnimationActive = false;
  var button = document.getElementById('eatGrassButton');
  if (button) {
    button.classList.remove('active');
    button.textContent = 'Eat Grass';
  }
}

function getEatingPose() {
  if (!gEatingAnimationActive) {
    return { blend: 0.0, neckAngle: 0.0, headAngle: 0.0, jawAngle: 0.0, frontHip: 0.0, frontKnee: 0.0, frontAnkle: 0.0, bite: 0.0 };
  }

  var elapsed = gSeconds - gEatStartTime;
  if (elapsed >= EAT_ANIMATION_DURATION) {
    finishEatingGrassAnimation();
    return { blend: 0.0, neckAngle: 0.0, headAngle: 0.0, jawAngle: 0.0, frontHip: 0.0, frontKnee: 0.0, frontAnkle: 0.0, bite: 0.0 };
  }

  var t = elapsed / EAT_ANIMATION_DURATION;
  var lowerIn = smoothStep01(clamp01(t / 0.28));
  var liftOut = smoothStep01(clamp01((1.0 - t) / 0.24));
  var blend = Math.min(lowerIn, liftOut);
  var chewWindow = smoothStep01(clamp01((t - 0.24) / 0.16)) * smoothStep01(clamp01((0.86 - t) / 0.16));
  var jawPulse = 0.5 + 0.5 * Math.sin(elapsed * 18.0);
  var bite = blend * smoothStep01(clamp01((t - 0.35) / 0.24));

  return {
    blend: blend,
    neckAngle: -66.0 * blend,
    headAngle: -10.0 * blend,
    jawAngle: chewWindow * (8.0 + 20.0 * jawPulse),
    frontHip: -5.0 * blend,
    frontKnee: 15.0 * blend,
    frontAnkle: -7.0 * blend,
    bite: bite
  };
}

function handleGrassBite(bite) {
  if (!gEatingAnimationActive || gBiteHasTriggered || bite < 0.90) return;
  gBiteHasTriggered = true;
  ensureInteractiveGrass();
  var mouthX = 0.93;
  var mouthZ = 0.0;
  var closestDist = Infinity;
  var closestIdx = -1;
  for (var bi = 0; bi < gInteractiveGrass.length; bi++) {
    var blade = gInteractiveGrass[bi];
    if (blade.height <= 0.001) continue;
    var dx = blade.x - mouthX;
    var dz = blade.z - mouthZ;
    var dist = dx * dx + dz * dz;
    if (dist < closestDist) { closestDist = dist; closestIdx = bi; }
  }
  if (closestIdx >= 0) {
    gInteractiveGrass[closestIdx].height = 0.0;
  }
}

function getKeyframeValue(keys, phase) {
  for (var i = 0; i < keys.length - 1; i++) {
    var p0 = keys[i][0], v0 = keys[i][1];
    var p1 = keys[i + 1][0], v1 = keys[i + 1][1];
    
    if (phase >= p0 && phase <= p1) {
      var localT = (phase - p0) / (p1 - p0);
      var lerpT = p0 >= 0.6 ? smoothStep01(localT) : localT;
      return v0 + (v1 - v0) * lerpT;
    }
  }
  return keys[keys.length - 1][1];
}

function getFrontLegRotationFromPhase(phase, strideScale) {
  return {
    hip: (getKeyframeValue(FRONT_UPPER_KEYS, phase) - 110.0) * strideScale * FRONT_HIP_SWING_GAIN,
    knee: -(180.0 - getKeyframeValue(FRONT_LOWER_KEYS, phase)) * strideScale,
    ankle: -(160.0 - getKeyframeValue(FRONT_FOOT_KEYS, phase)) * strideScale
  };
}

function getHindLegRotationFromPhase(phase, strideScale) {
  return {
    hip: (125.0 - getKeyframeValue(HIND_UPPER_KEYS, phase)) * strideScale * HIND_HIP_SWING_GAIN,
    knee: (150.0 - getKeyframeValue(HIND_LOWER_KEYS, phase)) * strideScale,
    ankle: (160.0 - getKeyframeValue(HIND_FOOT_KEYS, phase)) * strideScale
  };
}


function drawCubeWithColor(matrix, color, useSpots) {
  setMaterialUniforms(color, useSpots, true);
  drawCube(matrix);
}

function drawMeshPart(baseMatrix, tx, ty, tz, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, mesh, color, useSpots) {
  var partMatrix = new Matrix4(baseMatrix);
  partMatrix.translate(tx, ty, tz);
  partMatrix.rotate(rotX, 1, 0, 0);
  partMatrix.rotate(rotY, 0, 1, 0);
  partMatrix.rotate(rotZ, 0, 0, 1);
  partMatrix.scale(scaleX, scaleY, scaleZ);

  drawMeshWithColor(mesh, partMatrix, color, useSpots, true);
}

function drawPart(baseMatrix, tx, ty, tz, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, color, useSpots) {
  var partMatrix = new Matrix4(baseMatrix);
  partMatrix.translate(tx, ty, tz);
  partMatrix.rotate(rotX, 1, 0, 0); 
  partMatrix.rotate(rotY, 0, 1, 0); 
  partMatrix.rotate(rotZ, 0, 0, 1);
  partMatrix.scale(scaleX, scaleY, scaleZ);
  
  drawCubeWithColor(partMatrix, color, useSpots);
}

function createJointMatrix(baseMatrix, tx, ty, tz, rotX, rotY, rotZ) {
  var joint = new Matrix4(baseMatrix);
  joint.translate(tx, ty, tz);
  joint.rotate(rotX, 1, 0, 0); 
  joint.rotate(rotY, 0, 1, 0); 
  joint.rotate(rotZ, 0, 0, 1);
  return joint;
}

function drawGround() {
  var ground = new Matrix4();
  ground.translate(0.0, GROUND_Y + 0.01, 0.0);
  ground.scale(3.5, 0.001, 3.5);
  drawCubeWithColor(ground, GROUND_COLOR, false);
}

function drawCowShadow(rootMatrix, eatPose) {
  var shadowProjection = new Matrix4();
  shadowProjection.dropShadowDirectionally(0, 1, 0, 0, GROUND_Y, 0, 1.2, 2.0, 1.0);
  shadowProjection.translate(0.0, 0.02, 0.0);
  
  var shadowRoot = new Matrix4(shadowProjection);
  shadowRoot.multiply(rootMatrix);
  
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gIsDrawingShadow = true;
  drawCow(shadowRoot, true, eatPose);
  gIsDrawingShadow = false;
  gl.enable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

function drawCow(rootMatrix, isShadow, eatPose) {
  eatPose = eatPose || getEatingPose();
  var ellipsoidMesh = getEllipsoidMesh();
  var lowEllipsoidMesh = getLowEllipsoidMesh();
  var cowBodyMesh = getCowBodyMesh();
  var cowHeadMesh = getCowHeadMesh();
  var neckSegmentMesh = getNeckSegmentMesh();
  var cylinderMesh = getCylinderMesh();
  var coneMesh = getConeMesh();
  var bodyColor = isShadow ? SHADOW_COLOR : BODY_COLOR;
  var headColor = isShadow ? SHADOW_COLOR : HEAD_COLOR;
  var noseColor = isShadow ? SHADOW_COLOR : NOSE_COLOR;
  var legColor = isShadow ? SHADOW_COLOR : LEG_COLOR;
  var hoofColor = isShadow ? SHADOW_COLOR : HOOF_COLOR;
  var earColor = isShadow ? SHADOW_COLOR : EAR_COLOR;
  var hornColor = isShadow ? SHADOW_COLOR : HORN_COLOR;
  var tailColor = isShadow ? SHADOW_COLOR : TAIL_COLOR;
  var tailTuftColor = isShadow ? SHADOW_COLOR : TAIL_TUFT_COLOR;
  var eyeWhiteColor = isShadow ? SHADOW_COLOR : EYE_WHITE_COLOR;
  var pupilColor = isShadow ? SHADOW_COLOR : PUPIL_COLOR;
  var udderColor = isShadow ? SHADOW_COLOR : UDDER_COLOR;
  var patchColor = isShadow ? SHADOW_COLOR : BLACK_PATCH_COLOR;
  var bodyUseFurSpots = !isShadow;
  var headUseFurSpots = !isShadow;
  var limbUseFurSpots = !isShadow;

  drawMeshPart(rootMatrix, -0.05, -0.01, 0.0, 0, 0, 0, 1.42, 1.05, 0.74, cowBodyMesh, bodyColor, bodyUseFurSpots);

  if (!isShadow) {
    // no flat circle patches — FBM shader handles all spot coloring
  }
  
  var headTilt = 0;
  if (gPokeAnimationActive) {
    var elapsed = gSeconds - gPokeStartTime;
    if (elapsed < 0.5) {
      headTilt = Math.sin(elapsed * Math.PI * 2) * 28;
    } else {
      gPokeAnimationActive = false;
    }
  }

  var neckJoint = createJointMatrix(rootMatrix, 0.51, 0.14, 0.0, 0, 0, eatPose.neckAngle * 0.72 + headTilt * 0.30 - 6.0);
  var neckLengths = [0.13, 0.13, 0.12];
  var neckRadii = [0.205, 0.185, 0.165];
  var neckAngles = [-8.0, 7.0, 9.0];
  for (var neckIndex = 0; neckIndex < neckLengths.length; neckIndex++) {
    var neckBend = createJointMatrix(neckJoint, 0.0, 0.0, 0.0, 0, 0, neckAngles[neckIndex]);
    var neckSegment = new Matrix4(neckBend);
    neckSegment.translate(neckLengths[neckIndex] * 0.5, 0.0, 0.0);
    neckSegment.rotate(-90, 0, 0, 1);
    neckSegment.scale(neckRadii[neckIndex], neckLengths[neckIndex], neckRadii[neckIndex] * 0.92);
    drawMeshWithColor(neckSegmentMesh, neckSegment, bodyColor, headUseFurSpots, true);
    neckJoint = createJointMatrix(neckBend, neckLengths[neckIndex], 0.0, 0.0, 0, 0, 0);
  }

  var headJoint = createJointMatrix(neckJoint, 0.0, 0.0, 0.0, 0, 0, eatPose.headAngle + headTilt * 0.65);

  // Skull — wedge mesh gives natural low-poly bovine silhouette. Z=0.48 matches body proportions.
  drawMeshPart(headJoint, 0.18, -0.010, 0.0, 0, 0, 0, 0.58, 0.47, 0.48, cowHeadMesh, bodyColor, headUseFurSpots);
  // Muzzle — smaller and tucked closer to the skull.
  drawMeshPart(headJoint, 0.395, -0.046, 0.0, 0, 0, -90, 0.094, 0.128, 0.128, cylinderMesh, noseColor, false);
  // Nostrils — compact and higher on the muzzle face.
  drawMeshPart(headJoint, 0.428, -0.036, 0.042, 0, 0, 0, 0.014, 0.028, 0.018, lowEllipsoidMesh, patchColor, false);
  drawMeshPart(headJoint, 0.428, -0.036, -0.042, 0, 0, 0, 0.014, 0.028, 0.018, lowEllipsoidMesh, patchColor, false);
  // Jaw — animated lower lip kept tighter under the muzzle.
  var jawJoint = createJointMatrix(headJoint, 0.278, -0.070, 0.0, 0, 0, -eatPose.jawAngle);
  drawMeshPart(jawJoint, 0.045, 0.0, 0.0, 0, 0, -90, 0.084, 0.114, 0.114, cylinderMesh, noseColor, false);
  // Eyes — larger and tucked closer into the side of the skull.
  drawMeshPart(headJoint, 0.154, 0.062, 0.124, 0, 0, 0, 0.032, 0.027, 0.007, lowEllipsoidMesh, eyeWhiteColor, false);
  drawMeshPart(headJoint, 0.154, 0.062, -0.124, 0, 0, 0, 0.032, 0.027, 0.007, lowEllipsoidMesh, eyeWhiteColor, false);
  drawMeshPart(headJoint, 0.166, 0.061, 0.127, 0, 0, 0, 0.012, 0.016, 0.004, lowEllipsoidMesh, pupilColor, false);
  drawMeshPart(headJoint, 0.166, 0.061, -0.127, 0, 0, 0, 0.012, 0.016, 0.004, lowEllipsoidMesh, pupilColor, false);
  // Ears — larger and sunk inward so they attach to the poll instead of floating off the head.
  drawMeshPart(headJoint, -0.055, 0.118, 0.176, 10, -14, -8, 0.098, 0.052, 0.148, ellipsoidMesh, earColor, false);
  drawMeshPart(headJoint, -0.055, 0.118, -0.176, -10, 14, -8, 0.098, 0.052, 0.148, ellipsoidMesh, earColor, false);
  // Horns at poll
  drawMeshPart(headJoint, -0.055, 0.188, 0.096, 0, 25, -30, 0.034, 0.110, 0.034, coneMesh, hornColor, false);
  drawMeshPart(headJoint, -0.055, 0.188, -0.096, 0, -25, -30, 0.034, 0.110, 0.034, coneMesh, hornColor, false);

  // legs (w joints)
  drawFrontLeg(rootMatrix, 0.34, 0.175, gFrontRightHipAngle + eatPose.frontHip, gFrontRightKneeAngle + eatPose.frontKnee, gFrontRightAnkleAngle + eatPose.frontAnkle, isShadow, legColor, hoofColor, limbUseFurSpots);
  drawFrontLeg(rootMatrix, 0.34, -0.175, gFrontLeftHipAngle + eatPose.frontHip, gFrontLeftKneeAngle + eatPose.frontKnee, gFrontLeftAnkleAngle + eatPose.frontAnkle, isShadow, legColor, hoofColor, limbUseFurSpots);
  drawHindLeg(rootMatrix, -0.43, 0.180, gBackRightHipAngle, gBackRightKneeAngle, gBackRightAnkleAngle, isShadow, legColor, hoofColor, limbUseFurSpots);
  drawHindLeg(rootMatrix, -0.43, -0.180, gBackLeftHipAngle, gBackLeftKneeAngle, gBackLeftAnkleAngle, isShadow, legColor, hoofColor, limbUseFurSpots);

  drawMeshPart(rootMatrix, -0.17, -0.30, 0.0, 0, 0, 0, 0.25, 0.12, 0.18, lowEllipsoidMesh, udderColor, false);
  drawMeshPart(rootMatrix, -0.24, -0.39, 0.055, 0, 0, 0, 0.026, 0.085, 0.026, cylinderMesh, udderColor, false);
  drawMeshPart(rootMatrix, -0.24, -0.39, -0.055, 0, 0, 0, 0.026, 0.085, 0.026, cylinderMesh, udderColor, false);
  drawMeshPart(rootMatrix, -0.10, -0.39, 0.052, 0, 0, 0, 0.024, 0.078, 0.024, cylinderMesh, udderColor, false);
  drawMeshPart(rootMatrix, -0.10, -0.39, -0.052, 0, 0, 0, 0.024, 0.078, 0.024, cylinderMesh, udderColor, false);

  drawTail(rootMatrix, isShadow, tailColor, tailTuftColor, limbUseFurSpots);
}

function drawLegSegment(jointMatrix, length, radiusScale, mesh, color, useFurSpots) {
  var segment = new Matrix4(jointMatrix);
  segment.translate(0.0, -length * 0.5, 0.0);
  segment.scale(radiusScale, length, radiusScale);
  drawMeshWithColor(mesh, segment, color, useFurSpots, true);
}

function drawLegJoint(jointMatrix, scaleX, scaleY, scaleZ, color, useFurSpots) {
  var jointMesh = getLowEllipsoidMesh();
  var cap = new Matrix4(jointMatrix);
  cap.scale(scaleX, scaleY, scaleZ);
  drawMeshWithColor(jointMesh, cap, color, useFurSpots, true);
}

function drawHoofAtJoint(jointMatrix, hoofColor, isShadow) {
  var hoof = new Matrix4(jointMatrix);
  hoof.translate(0.0, -0.065, 0.025);
  hoof.scale(0.165, 0.080, 0.190);
  drawMeshWithColor(getHoofMesh(), hoof, isShadow ? SHADOW_COLOR : hoofColor, false, true);
}

function drawFrontLeg(rootMatrix, x, z, hipAngle, kneeAngle, ankleAngle, isShadow, legColor, hoofColor, useFurSpots) {
  var upperMesh = getUpperLegMesh();
  var lowerMesh = getLowerLegMesh();
  var jm = getLowEllipsoidMesh();
  var upperLength = 0.295;
  var lowerLength = 0.262;
  // Cylinder widths (scaleX = diameter in cow-local units before the root scale is applied)
  var upperW = 0.200;  // thigh diameter
  var lowerW = 0.150;  // shin diameter
  // Joint sphere scales: must be >= cylinder diameter at that cross-section
  // getUpperLegMesh topRadius=1.18 so hip end = 1.18*0.5*upperW = 0.118 radius → scale 0.240
  // knee: upper bottom = 1.0*0.5*0.200=0.100, lower top = 1.0*0.5*0.150=0.075 → cover with 0.220
  // ankle: lower bottom = 0.58*0.5*0.150=0.0435 → scale 0.110

  var hip = createJointMatrix(rootMatrix, x, -0.162, z, 0, 0, hipAngle);
  var hipJ = new Matrix4(hip); hipJ.scale(0.240, 0.210, 0.240);
  drawMeshWithColor(jm, hipJ, legColor, useFurSpots, true);
  var upperSeg = new Matrix4(hip);
  upperSeg.translate(0.0, -upperLength * 0.5, 0.0);
  upperSeg.scale(upperW, upperLength, upperW);
  drawMeshWithColor(upperMesh, upperSeg, legColor, useFurSpots, true);

  var knee = createJointMatrix(hip, 0.0, -upperLength, 0.0, 0, 0, kneeAngle);
  var kneeJ = new Matrix4(knee); kneeJ.scale(0.220, 0.190, 0.220);
  drawMeshWithColor(jm, kneeJ, legColor, useFurSpots, true);
  var lowerSeg = new Matrix4(knee);
  lowerSeg.translate(0.0, -lowerLength * 0.5, 0.0);
  lowerSeg.scale(lowerW, lowerLength, lowerW);
  drawMeshWithColor(lowerMesh, lowerSeg, legColor, useFurSpots, true);

  var ankle = createJointMatrix(knee, 0.0, -lowerLength, 0.0, 0, 0, ankleAngle);
  var ankleJ = new Matrix4(ankle); ankleJ.scale(0.110, 0.095, 0.110);
  drawMeshWithColor(jm, ankleJ, legColor, useFurSpots, true);
  var hoof = new Matrix4(ankle);
  hoof.translate(0.0, -0.052, 0.020);
  hoof.scale(0.148, 0.068, 0.168);
  drawMeshWithColor(getHoofMesh(), hoof, isShadow ? SHADOW_COLOR : hoofColor, false, true);
}

function drawHindLeg(rootMatrix, x, z, hipAngle, kneeAngle, ankleAngle, isShadow, legColor, hoofColor, useFurSpots) {
  var upperMesh = getUpperLegMesh();
  var lowerMesh = getLowerLegMesh();
  var cannonMesh = getCannonBoneMesh();
  var jm = getLowEllipsoidMesh();
  // Bone lengths calibrated so total vertical drop ≈ front leg (0.509) despite digitigrade bend
  var femurLength  = 0.190;
  var tibiaLength  = 0.195;
  var cannonLength = 0.198;
  // Cylinder widths
  var femurW  = 0.190;
  var tibiaW  = 0.140;
  var cannonW = 0.100;
  // Joint sphere scales (2 × cylinder cross-section radius, with 20% coverage margin)
  // Hip end of femur: 1.18*0.5*0.190=0.112 → scale 0.240
  // Stifle: femur bottom=0.5*0.190=0.095, tibia top=0.5*0.140=0.070 → scale 0.210
  // Hock: tibia bottom=0.58*0.5*0.140=0.041, cannon top=0.76*0.5*0.100=0.038 → scale 0.130
  // Fetlock: cannon bottom=0.52*0.5*0.100=0.026 → scale 0.090
  // Small base angles give the digitigrade silhouette without large vertical offset errors
  var hipRot    = 10.0 + hipAngle   * 0.55;
  var stifleRot = -20.0 + kneeAngle  * 0.70;
  var hockRot   =  14.0 + ankleAngle * 0.55;

  var hip = createJointMatrix(rootMatrix, x, -0.148, z, 0, 0, hipRot);
  var hipJ = new Matrix4(hip); hipJ.scale(0.240, 0.210, 0.240);
  drawMeshWithColor(jm, hipJ, legColor, useFurSpots, true);
  var femurSeg = new Matrix4(hip);
  femurSeg.translate(0.0, -femurLength * 0.5, 0.0);
  femurSeg.scale(femurW, femurLength, femurW);
  drawMeshWithColor(upperMesh, femurSeg, legColor, useFurSpots, true);

  var stifle = createJointMatrix(hip, 0.0, -femurLength, 0.0, 0, 0, stifleRot);
  var stifleJ = new Matrix4(stifle); stifleJ.scale(0.210, 0.185, 0.210);
  drawMeshWithColor(jm, stifleJ, legColor, useFurSpots, true);
  var tibiaSeg = new Matrix4(stifle);
  tibiaSeg.translate(0.0, -tibiaLength * 0.5, 0.0);
  tibiaSeg.scale(tibiaW, tibiaLength, tibiaW);
  drawMeshWithColor(lowerMesh, tibiaSeg, legColor, useFurSpots, true);

  var hock = createJointMatrix(stifle, 0.0, -tibiaLength, 0.0, 0, 0, hockRot);
  var hockJ = new Matrix4(hock); hockJ.scale(0.130, 0.115, 0.130);
  drawMeshWithColor(jm, hockJ, legColor, useFurSpots, true);
  var cannonSeg = new Matrix4(hock);
  cannonSeg.translate(0.0, -cannonLength * 0.5, 0.0);
  cannonSeg.scale(cannonW, cannonLength, cannonW);
  drawMeshWithColor(cannonMesh, cannonSeg, legColor, useFurSpots, true);

  var fetlock = createJointMatrix(hock, 0.0, -cannonLength, 0.0, 0, 0, -6.0);
  var fetlockJ = new Matrix4(fetlock); fetlockJ.scale(0.090, 0.078, 0.090);
  drawMeshWithColor(jm, fetlockJ, legColor, useFurSpots, true);
  var hoof = new Matrix4(fetlock);
  hoof.translate(0.0, -0.048, 0.018);
  hoof.scale(0.142, 0.062, 0.158);
  drawMeshWithColor(getHoofMesh(), hoof, isShadow ? SHADOW_COLOR : hoofColor, false, true);
}

function drawTail(rootMatrix, isShadow, tailColor, tailTuftColor, useFurSpots) {
  var tailMesh = getTaperedCylinderMesh();
  var tuftMesh = getLowEllipsoidMesh();
  var effectiveTailBase = gTailAnimationEnabled ? TAIL_PRESET_BASE_ANGLE : gTailBaseAngle;
  var effectiveTailCurl = gTailAnimationEnabled ? TAIL_PRESET_CURL_OFFSET : gTailCurlOffset;
  var effectiveTailSway = gTailSwayScale;

  var tailRootSwing = 0;
  var phaseAngle = 2.0 * Math.PI * gWalkPhase;
  if (gTailAnimationEnabled) {
    tailRootSwing = effectiveTailSway * Math.sin(phaseAngle - TAIL_ROOT_PHASE_DELAY);
  }

  var joint = createJointMatrix(rootMatrix, -0.66, 0.08, 0.0, 0, 0, effectiveTailBase + tailRootSwing);
  var lengths = [0.11, 0.10, 0.09, 0.08, 0.07, 0.06];
  var thicks = [0.09, 0.08, 0.074, 0.068, 0.062, 0.056];
  var angles = [-2, -4, -7, -10, -13, -17];

  for (var i = 0; i < lengths.length; i++) {
    var segmentWave = 0;
    if (gTailAnimationEnabled) {
      var segmentAmp = effectiveTailSway * (0.32 - i * 0.035);
      segmentWave = segmentAmp * Math.sin(phaseAngle - TAIL_ROOT_PHASE_DELAY - i * TAIL_SEGMENT_LAG);
    }
    
    var bentJoint = createJointMatrix(joint, 0.0, 0.0, 0.0, 0, 0, angles[i] + effectiveTailCurl + segmentWave);
    var segment = new Matrix4(bentJoint);
    segment.translate(-lengths[i] * 0.5, 0.0, 0.0);
    segment.rotate(90, 0, 0, 1);
    segment.scale(thicks[i], lengths[i], thicks[i]);
    
    drawMeshWithColor(tailMesh, segment, isShadow ? SHADOW_COLOR : tailColor, useFurSpots, true);
    
    joint = createJointMatrix(bentJoint, -lengths[i], 0.0, 0.0, 0, 0, 0);
  }

  var tuft = new Matrix4(joint);
  tuft.translate(-0.035, 0.0, 0.0);
  tuft.scale(0.12, 0.09, 0.11);
  drawMeshWithColor(tuftMesh, tuft, isShadow ? SHADOW_COLOR : tailTuftColor, false, true);
}

function isAnyLegTargetSelected() {
  for (var i = 0; i < LEG_TARGET_KEYS.length; i++) {
    if (gSelectedControlTargets[LEG_TARGET_KEYS[i]]) return true;
  }
  return false;
}

function getPrimarySelectedLegTarget() {
  for (var i = 0; i < LEG_TARGET_KEYS.length; i++) {
    var key = LEG_TARGET_KEYS[i];
    if (gSelectedControlTargets[key]) return key;
  }
  return null;
}

function getLegAnglesByKey(targetKey) {
  if (targetKey === 'frontRight') {
    return { hip: gFrontRightHipAngle, knee: gFrontRightKneeAngle, ankle: gFrontRightAnkleAngle };
  }
  if (targetKey === 'frontLeft') {
    return { hip: gFrontLeftHipAngle, knee: gFrontLeftKneeAngle, ankle: gFrontLeftAnkleAngle };
  }
  if (targetKey === 'backRight') {
    return { hip: gBackRightHipAngle, knee: gBackRightKneeAngle, ankle: gBackRightAnkleAngle };
  }
  if (targetKey === 'backLeft') {
    return { hip: gBackLeftHipAngle, knee: gBackLeftKneeAngle, ankle: gBackLeftAnkleAngle };
  }
  return null;
}

function setLegJointAngleByKey(targetKey, jointName, value) {
  if (targetKey === 'frontRight') {
    if (jointName === 'hip') gFrontRightHipAngle = value;
    if (jointName === 'knee') gFrontRightKneeAngle = value;
    if (jointName === 'ankle') gFrontRightAnkleAngle = value;
    return;
  }

  if (targetKey === 'frontLeft') {
    if (jointName === 'hip') gFrontLeftHipAngle = value;
    if (jointName === 'knee') gFrontLeftKneeAngle = value;
    if (jointName === 'ankle') gFrontLeftAnkleAngle = value;
    return;
  }

  if (targetKey === 'backRight') {
    if (jointName === 'hip') gBackRightHipAngle = value;
    if (jointName === 'knee') gBackRightKneeAngle = value;
    if (jointName === 'ankle') gBackRightAnkleAngle = value;
    return;
  }

  if (targetKey === 'backLeft') {
    if (jointName === 'hip') gBackLeftHipAngle = value;
    if (jointName === 'knee') gBackLeftKneeAngle = value;
    if (jointName === 'ankle') gBackLeftAnkleAngle = value;
  }
}

function applyJointToSelectedLegs(jointName, value) {
  for (var i = 0; i < LEG_TARGET_KEYS.length; i++) {
    var key = LEG_TARGET_KEYS[i];
    if (gSelectedControlTargets[key]) {
      setLegJointAngleByKey(key, jointName, value);
    }
  }
}

function updateTargetButtonsUi() {
  var selectedLegLabels = [];
  for (var i = 0; i < LEG_TARGET_KEYS.length; i++) {
    var legKey = LEG_TARGET_KEYS[i];
    if (gSelectedControlTargets[legKey]) {
      selectedLegLabels.push(TARGET_LABELS[legKey]);
    }
  }

  var allKeys = ['frontRight', 'frontLeft', 'backRight', 'backLeft', 'tail'];
  for (var j = 0; j < allKeys.length; j++) {
    var key = allKeys[j];
    var button = document.getElementById(TARGET_BUTTON_IDS[key]);
    if (button) {
      button.classList.toggle('active', !!gSelectedControlTargets[key]);
    }
  }

  var legend = document.getElementById('jointControlsLegend');
  if (legend) {
    if (selectedLegLabels.length > 0) {
      legend.textContent = 'Joint Angles (' + selectedLegLabels.join(', ') + ')';
    } else if (gSelectedControlTargets.tail) {
      legend.textContent = 'Joint Angles (Tail Only Selected)';
    } else {
      legend.textContent = 'Joint Angles (Front Right)';
    }
  }

  var hipSlider = document.getElementById('hipSlider');
  var kneeSlider = document.getElementById('kneeSlider');
  var ankleSlider = document.getElementById('ankleSlider');
  var legSliderPanel = document.getElementById('legJointSliders');
  var tailSliderPanel = document.getElementById('tailJointSliders');
  var hasLegTarget = selectedLegLabels.length > 0;
  if (hipSlider) hipSlider.disabled = !hasLegTarget;
  if (kneeSlider) kneeSlider.disabled = !hasLegTarget;
  if (ankleSlider) ankleSlider.disabled = !hasLegTarget;

  if (legSliderPanel) legSliderPanel.style.display = hasLegTarget ? '' : 'none';
  if (tailSliderPanel) tailSliderPanel.style.display = gSelectedControlTargets.tail ? '' : 'none';

  var tailSlider = document.getElementById('tailSwaySlider');
  var tailControlsEnabled = gSelectedControlTargets.tail && !gTailAnimationEnabled;
  if (tailSlider) {
    tailSlider.disabled = !gSelectedControlTargets.tail;
  }

  var tailBaseSlider = document.getElementById('tailBaseSlider');
  var tailCurlSlider = document.getElementById('tailCurlSlider');
  if (tailBaseSlider) tailBaseSlider.disabled = !tailControlsEnabled;
  if (tailCurlSlider) tailCurlSlider.disabled = !tailControlsEnabled;
}

function toggleControlTarget(targetKey) {
  if (!(targetKey in gSelectedControlTargets)) return;

  if (targetKey === 'tail') {
    var enableTail = !gSelectedControlTargets.tail;
    gSelectedControlTargets.tail = enableTail;
    for (var i = 0; i < LEG_TARGET_KEYS.length; i++) {
      gSelectedControlTargets[LEG_TARGET_KEYS[i]] = false;
    }
    if (!enableTail) {
      gSelectedControlTargets.frontRight = true;
    }
  } else {
    if (gSelectedControlTargets.tail) {
      gSelectedControlTargets.tail = false;
      for (var j = 0; j < LEG_TARGET_KEYS.length; j++) {
        gSelectedControlTargets[LEG_TARGET_KEYS[j]] = false;
      }
      gSelectedControlTargets[targetKey] = true;
    } else {
      gSelectedControlTargets[targetKey] = !gSelectedControlTargets[targetKey];
    }
  }

  // keep at least one selectable target active so controls never dead-end
  if (!isAnyLegTargetSelected() && !gSelectedControlTargets.tail) {
    gSelectedControlTargets.frontRight = true;
  }

  updateTargetButtonsUi();
  syncJointSliderUi();
}


function addActionsForHtmlUI() {
  var bind = (id, event, cb) => { 
    var el = document.getElementById(id); 
    if(el) el.addEventListener(event, cb); 
  };
  
  bind('globalRotationSlider', 'input', function() { 
    gAnimalGlobalRotation = Number(this.value); 
    document.getElementById('globalRotationValue').textContent = this.value; 
  });
  bind('hipSlider', 'input', function() { 
    applyJointToSelectedLegs('hip', Number(this.value));
    syncJointSliderUi();
  });
  bind('kneeSlider', 'input', function() { 
    applyJointToSelectedLegs('knee', Number(this.value));
    syncJointSliderUi();
  });
  bind('ankleSlider', 'input', function() { 
    applyJointToSelectedLegs('ankle', Number(this.value));
    syncJointSliderUi();
  });
  bind('frontStrideSlider', 'input', function() { 
    gFrontStrideScale = Number(this.value); 
    document.getElementById('frontStrideValue').textContent = gFrontStrideScale.toFixed(2); 
  });
  bind('backStrideSlider', 'input', function() { 
    gBackStrideScale = Number(this.value); 
    document.getElementById('backStrideValue').textContent = gBackStrideScale.toFixed(2); 
  });
  bind('tailSwaySlider', 'input', function() { 
    if (gSelectedControlTargets.tail) {
      gTailSwayScale = Number(this.value);
    }
    syncJointSliderUi();
  });
  bind('tailBaseSlider', 'input', function() {
    if (gSelectedControlTargets.tail) {
      gTailBaseAngle = Number(this.value);
    }
    syncJointSliderUi();
  });
  bind('tailCurlSlider', 'input', function() {
    if (gSelectedControlTargets.tail) {
      gTailCurlOffset = Number(this.value);
    }
    syncJointSliderUi();
  });

  bind('targetFrontRight', 'click', function() { toggleControlTarget('frontRight'); });
  bind('targetFrontLeft', 'click', function() { toggleControlTarget('frontLeft'); });
  bind('targetBackRight', 'click', function() { toggleControlTarget('backRight'); });
  bind('targetBackLeft', 'click', function() { toggleControlTarget('backLeft'); });
  bind('targetTail', 'click', function() { toggleControlTarget('tail'); });

  bind('frontAnimButton', 'click', function() { 
    gFrontAnimationEnabled = !gFrontAnimationEnabled; 
    this.textContent = gFrontAnimationEnabled ? 'Front Anim: On' : 'Front Anim: Off'; 
  });
  bind('backAnimButton', 'click', function() { 
    gBackAnimationEnabled = !gBackAnimationEnabled; 
    this.textContent = gBackAnimationEnabled ? 'Back Anim: On' : 'Back Anim: Off'; 
  });
  bind('tailAnimButton', 'click', function() { 
    gTailAnimationEnabled = !gTailAnimationEnabled; 
    this.textContent = gTailAnimationEnabled ? 'Tail Anim: On' : 'Tail Anim: Off'; 
    syncJointSliderUi();
  });
  bind('eatGrassButton', 'click', function() {
    startEatingGrassAnimation();
  });

  updateTargetButtonsUi();
  syncJointSliderUi();
}

function syncJointSliderUi() {
  var h = document.getElementById('hipSlider');
  var k = document.getElementById('kneeSlider');
  var a = document.getElementById('ankleSlider');
  var hv = document.getElementById('hipValue');
  var kv = document.getElementById('kneeValue');
  var av = document.getElementById('ankleValue');
  var t = document.getElementById('tailSwaySlider');
  var tv = document.getElementById('tailSwayValue');
  var tb = document.getElementById('tailBaseSlider');
  var tbv = document.getElementById('tailBaseValue');
  var tc = document.getElementById('tailCurlSlider');
  var tcv = document.getElementById('tailCurlValue');
  var displayTailBase = gTailAnimationEnabled ? TAIL_PRESET_BASE_ANGLE : gTailBaseAngle;
  var displayTailCurl = gTailAnimationEnabled ? TAIL_PRESET_CURL_OFFSET : gTailCurlOffset;
  var displayTailSway = gTailSwayScale;

  var primaryLeg = getPrimarySelectedLegTarget();
  var angles = primaryLeg ? getLegAnglesByKey(primaryLeg) : null;

  if (angles) {
    if (h) h.value = angles.hip;
    if (k) k.value = angles.knee;
    if (a) a.value = angles.ankle;
    if (hv) hv.textContent = String(Math.round(angles.hip));
    if (kv) kv.textContent = String(Math.round(angles.knee));
    if (av) av.textContent = String(Math.round(angles.ankle));
  } else {
    if (hv) hv.textContent = '-';
    if (kv) kv.textContent = '-';
    if (av) av.textContent = '-';
  }

  if (t) t.value = displayTailSway;
  if (tv) tv.textContent = String(Math.round(displayTailSway));
  if (tb) tb.value = displayTailBase;
  if (tbv) tbv.textContent = String(Math.round(displayTailBase));
  if (tc) tc.value = displayTailCurl;
  if (tcv) tcv.textContent = String(Math.round(displayTailCurl));

  updateTargetButtonsUi();
}

function updatePerformanceHud(timestamp) {
  gFrameCount++;
  var elapsedMs = timestamp - gLastFpsUpdateTime;

  // only update the HTML if 1 second has passed
  if (elapsedMs >= 1000.0) {
    var fps = document.getElementById('fpsValue');
    var ft = document.getElementById('frameTimeValue');

    // calculate the true average frames over the last second
    var actualFps = (gFrameCount * 1000.0) / elapsedMs;
    var avgFrameTime = elapsedMs / gFrameCount;

    if (fps) fps.textContent = actualFps.toFixed(1);
    if (ft) ft.textContent = avgFrameTime.toFixed(2);

    // reset counters for the next second
    gLastFpsUpdateTime = timestamp;
    gFrameCount = 0;
  }
}