// global variables
var canvas;
var gl;
var a_Position;
var u_ModelMatrix;
var u_GlobalRotation;
var u_FragColor;
var u_UseSpots;
var u_SpotScale;
var u_SpotThreshold;
var u_GradientStrength;
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

// animation scales
var gFrontStrideScale = 1.0;
var gBackStrideScale = 1.0;
var gTailSwayScale = 12.0;
var gTailBaseAngle = -15.0;
var gTailCurlOffset = 0.0;

// preset tail animation profile (base/curl remain fixed while animating)
var TAIL_PRESET_BASE_ANGLE = -15.0;
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
var SHADOW_COLOR = [0.15, 0.18, 0.15, 1.0];
var GROUND_COLOR = [0.24, 0.28, 0.23, 1.0];
var BODY_COLOR = [0.68, 0.5, 0.37, 1.0];
var HEAD_COLOR = [0.68, 0.5, 0.37, 1.0];
var NOSE_COLOR = [0.24, 0.22, 0.20, 1.0];
var LEG_COLOR = [0.68, 0.5, 0.37, 1.0];
var HOOF_COLOR = [0.18, 0.16, 0.14, 1.0];
var EAR_COLOR = [0.24, 0.22, 0.20, 1.0];
var HORN_COLOR = [0.92, 0.90, 0.78, 1.0];
var TAIL_COLOR = [0.58, 0.5, 0.37, 1.0];
var EYE_WHITE_COLOR = [0.95, 0.95, 0.95, 1.0];
var PUPIL_COLOR = [0.08, 0.08, 0.08, 1.0];

// shader constants
var FUR_SPOT_SCALE = 20.0, FUR_SPOT_THRESHOLD = 0.98, FUR_GRADIENT_STRENGTH = 0.1;

// animation kinematics
var WALK_CYCLE_HZ = 0.7;
var FRONT_HIP_SWING_GAIN = 1.45, HIND_HIP_SWING_GAIN = 0.62;
var TAIL_ROOT_PHASE_DELAY = 1.0, TAIL_SEGMENT_LAG = 0.6;
var FULL_ANIM_BODY_BOB_AMPLITUDE = 0.032;
var FULL_ANIM_LEG_JOINT_BOB_AMPLITUDE = 0.005;
var BOB_DIAGONAL_PHASE_OFFSET = 0.35;

function isFullAnimationModeEnabled() {
  return gFrontAnimationEnabled && gBackAnimationEnabled && gTailAnimationEnabled;
}

function getDiagonalBobPulse(phase, sideOffset) {
  var shifted = shiftPhase(phase, sideOffset);
  var halfStepPhase = getCyclePhase(shifted, 2.0);
  return Math.sin(Math.PI * halfStepPhase);
}

// keyframes
var FRONT_UPPER_KEYS = [[0.00, 120], [0.30, 110], [0.60, 90], [0.80, 115], [1.00, 120]];
var FRONT_LOWER_KEYS = [[0.00, 175], [0.30, 180], [0.60, 160], [0.80, 90], [1.00, 175]];
var FRONT_FOOT_KEYS  = [[0.00, 160], [0.30, 140], [0.60, 180], [0.80, 110], [1.00, 160]];
var HIND_UPPER_KEYS  = [[0.00, 110], [0.30, 125], [0.60, 150], [0.80, 100], [1.00, 110]];
var HIND_LOWER_KEYS  = [[0.00, 150], [0.30, 145], [0.60, 165], [0.80, 115], [1.00, 150]];
var HIND_FOOT_KEYS   = [[0.00, 160], [0.30, 145], [0.60, 180], [0.80, 130], [1.00, 160]];


function main() {
  setupWebGL();
  connectVariablesToGLSL();
  setupMouseControls();
  addActionsForHtmlUI();

  gl.clearColor(0.1, 0.1, 0.12, 1.0);
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
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_UseSpots = gl.getUniformLocation(gl.program, 'u_UseSpots');
  u_SpotScale = gl.getUniformLocation(gl.program, 'u_SpotScale');
  u_SpotThreshold = gl.getUniformLocation(gl.program, 'u_SpotThreshold');
  u_GradientStrength = gl.getUniformLocation(gl.program, 'u_GradientStrength');
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

  drawGround();

  var root = new Matrix4();
  var fullAnimBob = 0.0;
  if (isFullAnimationModeEnabled()) {
    var bodyBobPulse = getDiagonalBobPulse(gWalkPhase, BOB_DIAGONAL_PHASE_OFFSET);
    fullAnimBob = FULL_ANIM_BODY_BOB_AMPLITUDE * bodyBobPulse;
  }
  root.translate(0.0, -0.08 + fullAnimBob, 0.0);
  root.scale(0.85, 0.85, 0.85);

  drawCowShadow(root);
  drawCow(root, false);
}


function updateAnimationAngles() {
  var phaseBackLeft = shiftPhase(gWalkPhase, 0.00);
  var phaseFrontLeft = shiftPhase(gWalkPhase, 0.15);
  var phaseBackRight = shiftPhase(gWalkPhase, 0.50);
  var phaseFrontRight = shiftPhase(gWalkPhase, 0.65);

  if (gFrontAnimationEnabled) {
    var frontLeft = getFrontLegRotationFromPhase(phaseFrontLeft, gFrontStrideScale);
    var frontRight = getFrontLegRotationFromPhase(phaseFrontRight, gFrontStrideScale);
    
    gFrontLeftHipAngle = frontLeft.hip;
    gFrontLeftKneeAngle = frontLeft.knee;
    gFrontLeftAnkleAngle = frontLeft.ankle;
    
    gFrontRightHipAngle = frontRight.hip;
    gFrontRightKneeAngle = frontRight.knee;
    gFrontRightAnkleAngle = frontRight.ankle;
  }

  if (gBackAnimationEnabled) {
    var backLeft = getHindLegRotationFromPhase(phaseBackLeft, gBackStrideScale);
    var backRight = getHindLegRotationFromPhase(phaseBackRight, gBackStrideScale);
    
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
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_UseSpots, useSpots ? 1.0 : 0.0);
  gl.uniform1f(u_SpotScale, FUR_SPOT_SCALE);
  gl.uniform1f(u_SpotThreshold, FUR_SPOT_THRESHOLD);
  gl.uniform1f(u_GradientStrength, gIsDrawingShadow ? 0.0 : FUR_GRADIENT_STRENGTH);
  
  drawCube(matrix);
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

function drawCowShadow(rootMatrix) {
  var shadowProjection = new Matrix4();
  shadowProjection.dropShadowDirectionally(0, 1, 0, 0, GROUND_Y, 0, 1.2, 2.0, 1.0);
  shadowProjection.translate(0.0, 0.02, 0.0);
  
  var shadowRoot = new Matrix4(shadowProjection);
  shadowRoot.multiply(rootMatrix);
  
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gIsDrawingShadow = true;
  drawCow(shadowRoot, true);
  gIsDrawingShadow = false;
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

function drawCow(rootMatrix, isShadow) {
  var bodyColor = isShadow ? SHADOW_COLOR : BODY_COLOR;
  var headColor = isShadow ? SHADOW_COLOR : HEAD_COLOR;
  var noseColor = isShadow ? SHADOW_COLOR : NOSE_COLOR;
  var legColor = isShadow ? SHADOW_COLOR : LEG_COLOR;
  var hoofColor = isShadow ? SHADOW_COLOR : HOOF_COLOR;
  var earColor = isShadow ? SHADOW_COLOR : EAR_COLOR;
  var hornColor = isShadow ? SHADOW_COLOR : HORN_COLOR;
  var tailColor = isShadow ? SHADOW_COLOR : TAIL_COLOR;
  var eyeWhiteColor = isShadow ? SHADOW_COLOR : EYE_WHITE_COLOR;
  var pupilColor = isShadow ? SHADOW_COLOR : PUPIL_COLOR;
  var useFurSpots = false;

  // body
  drawPart(rootMatrix, 0.0, 0.0, 0.0, 0, 0, 0, 0.95, 0.45, 0.48, bodyColor, useFurSpots);
  
  // head and snout
  var headTilt = 0;
  if (gPokeAnimationActive) {
    var elapsed = gSeconds - gPokeStartTime;
    if (elapsed < 0.5) {
      headTilt = Math.sin(elapsed * Math.PI * 2) * 30;
    } else {
      gPokeAnimationActive = false;
    }
  }

  var neckJoint = createJointMatrix(rootMatrix, 0.66, 0.08, 0.0, 0, 0, headTilt);
  var headScaleMat = new Matrix4(neckJoint);
  headScaleMat.scale(0.38, 0.32, 0.32);
  drawCubeWithColor(headScaleMat, headColor, useFurSpots);
  
  var snoutMat = new Matrix4(neckJoint);
  snoutMat.translate(0.2, -0.07, 0.0);
  snoutMat.scale(0.1, 0.1, 0.1);
  drawCubeWithColor(snoutMat, noseColor, useFurSpots);

  // legs (w joints)
  drawLeg(rootMatrix, 0.32, 0.18, gFrontRightHipAngle, gFrontRightKneeAngle, gFrontRightAnkleAngle, isShadow, legColor, hoofColor, useFurSpots);
  drawLeg(rootMatrix, 0.32, -0.18, gFrontLeftHipAngle, gFrontLeftKneeAngle, gFrontLeftAnkleAngle, isShadow, legColor, hoofColor, useFurSpots);
  drawLeg(rootMatrix, -0.32, 0.18, gBackRightHipAngle, gBackRightKneeAngle, gBackRightAnkleAngle, isShadow, legColor, hoofColor, useFurSpots);
  drawLeg(rootMatrix, -0.32, -0.18, gBackLeftHipAngle, gBackLeftKneeAngle, gBackLeftAnkleAngle, isShadow, legColor, hoofColor, useFurSpots);

  // ears
  drawPart(neckJoint, -0.03, 0.10, 0.17, 0, -70, 10, 0.22, 0.08, 0.08, earColor, useFurSpots);
  drawPart(neckJoint, -0.03, 0.10, -0.17, 0, 70, 10, 0.22, 0.08, 0.08, earColor, useFurSpots);

  drawTail(rootMatrix, isShadow, tailColor, useFurSpots);

  // horns (pyramids)
  var hornMatR = new Matrix4(neckJoint);
  hornMatR.translate(0.16, 0.10, 0.12);
  hornMatR.rotate(15, 0, 0, 1);
  hornMatR.scale(0.06, 0.22, 0.06);
  drawPyramidWithColor(hornMatR, hornColor);

  var hornMatL = new Matrix4(neckJoint);
  hornMatL.translate(0.16, 0.10, -0.12);
  hornMatL.rotate(15, 0, 0, 1);
  hornMatL.scale(0.06, 0.22, 0.06);
  drawPyramidWithColor(hornMatL, hornColor);

  // eyes
  drawPart(neckJoint, 0.19, 0.06, 0.13, 0, 0, 0, 0.01, 0.05, 0.05, eyeWhiteColor, false);
  drawPart(neckJoint, 0.19, 0.06, -0.13, 0, 0, 0, 0.01, 0.05, 0.05, eyeWhiteColor, false);
  drawPart(neckJoint, 0.20, 0.06, 0.13, 0, 0, 0, 0.02, 0.02, 0.02, pupilColor, false);
  drawPart(neckJoint, 0.20, 0.06, -0.13, 0, 0, 0, 0.02, 0.02, 0.02, pupilColor, false);
}

function drawLeg(rootMatrix, x, z, hipAngle, kneeAngle, ankleAngle, isShadow, legColor, hoofColor, useFurSpots) {
  var jointVisualBob = 0.0;
  if (isFullAnimationModeEnabled()) {
    var isFrontRightBackLeft = (x * z) > 0.0;
    var legSideOffset = isFrontRightBackLeft ? BOB_DIAGONAL_PHASE_OFFSET : (BOB_DIAGONAL_PHASE_OFFSET + 0.5);
    var legBobPulse = getDiagonalBobPulse(gWalkPhase, legSideOffset);
    jointVisualBob = FULL_ANIM_LEG_JOINT_BOB_AMPLITUDE * legBobPulse;
  }

  var hip = createJointMatrix(rootMatrix, x, -0.20, z, 0, 0, hipAngle);
  var upperLeg = new Matrix4(hip);
  upperLeg.translate(0.0, -0.16 + jointVisualBob, 0.0); 
  upperLeg.scale(0.14, 0.32, 0.14);
  drawCubeWithColor(upperLeg, legColor, useFurSpots);

  var knee = createJointMatrix(hip, 0.0, -0.32, 0.0, 0, 0, kneeAngle);
  var lowerLeg = new Matrix4(knee);
  lowerLeg.translate(0.0, -0.14 + jointVisualBob * 0.9, 0.0); 
  lowerLeg.scale(0.12, 0.28, 0.12);
  drawCubeWithColor(lowerLeg, legColor, useFurSpots);

  var ankle = createJointMatrix(knee, 0.0, -0.28, 0.0, 0, 0, ankleAngle);
  var hoof = new Matrix4(ankle);
  hoof.translate(0.0, -0.06, 0.02); 
  hoof.scale(0.16, 0.08, 0.18);
  drawCubeWithColor(hoof, isShadow ? SHADOW_COLOR : hoofColor, false);
}

function drawTail(rootMatrix, isShadow, tailColor, useFurSpots) {
  var effectiveTailBase = gTailAnimationEnabled ? TAIL_PRESET_BASE_ANGLE : gTailBaseAngle;
  var effectiveTailCurl = gTailAnimationEnabled ? TAIL_PRESET_CURL_OFFSET : gTailCurlOffset;
  var effectiveTailSway = gTailSwayScale;

  var tailRootSwing = 0;
  var phaseAngle = 2.0 * Math.PI * gWalkPhase;
  if (gTailAnimationEnabled) {
    tailRootSwing = effectiveTailSway * Math.sin(phaseAngle - TAIL_ROOT_PHASE_DELAY);
  }

  var joint = createJointMatrix(rootMatrix, -0.475, 0.10, 0.0, 0, 0, effectiveTailBase + tailRootSwing);
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
    segment.scale(lengths[i], thicks[i], thicks[i]);
    
    drawCubeWithColor(segment, isShadow ? SHADOW_COLOR : tailColor, useFurSpots);
    
    joint = createJointMatrix(bentJoint, -lengths[i], 0.0, 0.0, 0, 0, 0);
  }
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