const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

let canvas;
let gl;
let a_Position;
let u_FragColor;
let u_Size;
let g_vertexBuffer = null;

let g_selectedType = POINT;
let g_selectedColor = [1.0, 0.25, 0.25, 1.0];
let g_selectedSize = 14;
let g_selectedSegments = 12;
let g_shapesList = [];
let g_pictureShapes = [];
let g_isDragging = false;
let g_lastDragPosition = null;
let g_rainbowPhase = 0;
let g_hasAnimatedShapes = false;

let g_gameActive = false;
let g_gameScore = 0;
let g_gameTime = 0;
let g_gameLastTime = 0;
let g_gameDuration = 30000;
let g_gameGems = [];
let g_gameSpawnTimer = 0;
let g_gameSpawnInterval = 900;
let g_gameMissed = 0;

function main() {
  setupWebGL();
  if (!gl) return;
  if (!connectVariablesToGLSL()) return;
  addActionsForHtmlUI();
  handleClicks();
  setBrushType(POINT);
  renderAllShapes();
  tick();
}

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the WebGL context');
    return;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 1, 1, 1);
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders');
    return false;
  }
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  g_vertexBuffer = gl.createBuffer();
  if (a_Position < 0 || !u_FragColor || !u_Size || !g_vertexBuffer) {
    console.log('Failed to connect variables to GLSL');
    return false;
  }
  return true;
}

function addActionsForHtmlUI() {
  document.getElementById('pointButton').onclick = function() { setBrushType(POINT); };
  document.getElementById('triangleButton').onclick = function() { setBrushType(TRIANGLE); };
  document.getElementById('circleButton').onclick = function() { setBrushType(CIRCLE); };

  document.getElementById('clearButton').onclick = function() {
    g_shapesList = [];
    g_pictureShapes = [];
    g_lastDragPosition = null;
    g_rainbowPhase = 0;
    g_hasAnimatedShapes = false;
    renderAllShapes();
  };

  document.getElementById('pictureButton').onclick = function() {
    g_pictureShapes = createPictureScene();
    renderAllShapes();
  };

  document.getElementById('gameButton').onclick = function() {
    if (g_gameActive) {
      g_gameActive = false;
      document.getElementById('gameButton').textContent = 'Play Game';
      renderAllShapes();
    } else {
      startGame();
    }
  };

  document.getElementById('sizeSlide').oninput = function() {
    g_selectedSize = Number(this.value);
    document.getElementById('sizeValue').textContent = this.value;
  };

  document.getElementById('segmentsSlide').oninput = function() {
    g_selectedSegments = Number(this.value);
    document.getElementById('segmentsValue').textContent = this.value;
  };

  document.getElementById('redSlide').oninput = updateSelectedColor;
  document.getElementById('greenSlide').oninput = updateSelectedColor;
  document.getElementById('blueSlide').oninput = updateSelectedColor;
  document.getElementById('rainbowToggle').onchange = updateColorPreview;
  updateSelectedColor();
}

function handleClicks() {
  canvas.onmousedown = function(ev) {
    if (g_gameActive) { handleGameClick(ev); return; }
    g_isDragging = true;
    g_lastDragPosition = null;
    click(ev);
  };
  canvas.onmousemove = function(ev) {
    if (!g_gameActive && g_isDragging && ev.buttons === 1) click(ev);
  };
  canvas.onmouseleave = stopDrawing;
  window.onmouseup = stopDrawing;
}

function click(ev) {
  const position = convertCoordinatesEventToGL(ev);
  if (isSprayModeEnabled()) {
    const r = sizeToRadius(g_selectedSize) * 2.5;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      addShape([position[0] + Math.cos(angle) * dist, position[1] + Math.sin(angle) * dist]);
    }
  } else {
    const positions = buildStrokePositions(position);
    for (let i = 0; i < positions.length; i++) {
      addShape(positions[i]);
    }
  }
  g_lastDragPosition = position;
  renderAllShapes();
}

function stopDrawing() {
  g_isDragging = false;
  g_lastDragPosition = null;
}

function buildStrokePositions(position) {
  if (!g_lastDragPosition) return [position];
  const dx = position[0] - g_lastDragPosition[0];
  const dy = position[1] - g_lastDragPosition[1];
  const distance = Math.hypot(dx, dy);
  const spacing = Math.max(0.008, sizeToRadius(g_selectedSize) * 0.8);
  if (distance <= spacing) return [position];
  const steps = Math.ceil(distance / spacing);
  const strokePositions = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    strokePositions.push([
      g_lastDragPosition[0] + dx * t,
      g_lastDragPosition[1] + dy * t,
    ]);
  }
  return strokePositions;
}

function addShape(position) {
  const shape = createShape();
  shape.position = [position[0], position[1]];
  shape.size = g_selectedSize;
  if (isRainbowBrushEnabled()) {
    shape.isRainbow = true;
    shape.rainbowPhase = g_rainbowPhase;
    shape.color = getRainbowColor(g_rainbowPhase);
    g_rainbowPhase += 0.38;
    g_hasAnimatedShapes = true;
  } else {
    shape.isRainbow = false;
    shape.rainbowPhase = 0;
    shape.color = g_selectedColor.slice();
  }
  if (shape instanceof Circle) shape.segments = g_selectedSegments;
  g_shapesList.push(shape);
}

function createShape() {
  if (g_selectedType === TRIANGLE) return new Triangle();
  if (g_selectedType === CIRCLE) return new Circle();
  return new Point();
}

function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (let i = 0; i < g_pictureShapes.length; i++) g_pictureShapes[i].render();
  for (let i = 0; i < g_shapesList.length; i++) g_shapesList[i].render();
  document.getElementById('statusText').textContent =
    'Brush shapes: ' + g_shapesList.length + ' | Picture triangles: ' + g_pictureShapes.length;
}

function tick() {
  const now = performance.now();
  if (g_gameActive) {
    tickGame(now);
  } else if (g_hasAnimatedShapes) {
    renderAllShapes();
  }
  requestAnimationFrame(tick);
}

function convertCoordinatesEventToGL(ev) {
  const rect = ev.target.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) - rect.width / 2) / (rect.width / 2);
  const y = (rect.height / 2 - (ev.clientY - rect.top)) / (rect.height / 2);
  return [x, y];
}

function sizeToRadius(size) {
  return size / canvas.height;
}

function setBrushType(type) {
  g_selectedType = type;
  document.getElementById('pointButton').classList.toggle('active', type === POINT);
  document.getElementById('triangleButton').classList.toggle('active', type === TRIANGLE);
  document.getElementById('circleButton').classList.toggle('active', type === CIRCLE);
}

function updateSelectedColor() {
  const red = Number(document.getElementById('redSlide').value);
  const green = Number(document.getElementById('greenSlide').value);
  const blue = Number(document.getElementById('blueSlide').value);
  document.getElementById('redValue').textContent = String(red);
  document.getElementById('greenValue').textContent = String(green);
  document.getElementById('blueValue').textContent = String(blue);
  g_selectedColor = [red / 100, green / 100, blue / 100, 1];
  updateColorPreview();
}

function updateColorPreview() {
  const preview = document.getElementById('colorPreview');
  if (isRainbowBrushEnabled()) {
    preview.style.background =
      'linear-gradient(90deg,#ff5959 0%,#ffd43b 25%,#7ad66f 50%,#5da9ff 75%,#d277ff 100%)';
    return;
  }
  const c = g_selectedColor;
  preview.style.background =
    'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
}

function isRainbowBrushEnabled() {
  return document.getElementById('rainbowToggle').checked;
}

function isSprayModeEnabled() {
  return document.getElementById('sprayToggle').checked;
}

function getRainbowColor(phase) {
  const r = Math.sin(phase) * 0.5 + 0.5;
  const g = Math.sin(phase + 2.09439510239) * 0.5 + 0.5;
  const b = Math.sin(phase + 4.18879020479) * 0.5 + 0.5;
  return [r, g, b, 1];
}

function getShapeRenderColor(shape) {
  if (!shape.isRainbow) return shape.color;
  return getRainbowColor(performance.now() * 0.0014 + shape.rainbowPhase);
}

function startGame() {
  g_gameActive = true;
  g_gameScore = 0;
  g_gameTime = 0;
  g_gameLastTime = performance.now();
  g_gameGems = [];
  g_gameSpawnTimer = 0;
  g_gameSpawnInterval = 900;
  g_gameMissed = 0;
  document.getElementById('gameButton').textContent = 'Stop Game';
}

function tickGame(now) {
  const dt = Math.min(now - g_gameLastTime, 100);
  g_gameLastTime = now;
  g_gameTime += dt;

  if (g_gameTime >= g_gameDuration) {
    g_gameActive = false;
    document.getElementById('gameButton').textContent = 'Play Game';
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    document.getElementById('statusText').textContent =
      'Game Over! Score: ' + g_gameScore + ' | Missed: ' + g_gameMissed;
    return;
  }

  g_gameSpawnTimer += dt;
  if (g_gameSpawnTimer >= g_gameSpawnInterval) {
    g_gameSpawnTimer = 0;
    spawnGem();
    g_gameSpawnInterval = Math.max(300, 900 - g_gameTime * 0.018);
  }

  for (let i = g_gameGems.length - 1; i >= 0; i--) {
    g_gameGems[i].y -= g_gameGems[i].speed * dt / 1000;
    if (g_gameGems[i].y < -1.15) {
      g_gameGems.splice(i, 1);
      g_gameMissed++;
    }
  }

  renderGame();
  const remaining = Math.ceil((g_gameDuration - g_gameTime) / 1000);
  document.getElementById('statusText').textContent =
    'Score: ' + g_gameScore + ' | Time: ' + remaining + 's | Missed: ' + g_gameMissed;
}

function spawnGem() {
  const types = [
    { c: [0.85, 0.08, 0.08, 1], v: 1 },
    { c: [0.10, 0.28, 0.90, 1], v: 2 },
    { c: [0.05, 0.70, 0.18, 1], v: 1 },
    { c: [0.58, 0.05, 0.82, 1], v: 3 },
    { c: [0.05, 0.80, 0.85, 1], v: 2 },
    { c: [1.00, 0.85, 0.10, 1], v: 1 },
    { c: [1.00, 0.40, 0.70, 1], v: 2 },
  ];
  const t = types[Math.floor(Math.random() * types.length)];
  g_gameGems.push({
    x: (Math.random() * 1.7) - 0.85,
    y: 1.1,
    color: t.c,
    size: 0.055 + Math.random() * 0.055,
    speed: 0.35 + Math.random() * 0.45,
    value: t.v,
  });
}

function renderGame() {
  gl.uniform1f(u_Size, 1);
  gl.uniform4f(u_FragColor, 0.06, 0.03, 0.16, 1);
  drawTriangle([-1, -1, 1, -1, 1, 1]);
  drawTriangle([-1, -1, 1, 1, -1, 1]);
  gl.uniform4f(u_FragColor, 0.12, 0.08, 0.28, 1);
  drawTriangle([-1, -0.85, 1, -0.85, 0, -0.55]);
  for (let i = 0; i < g_gameGems.length; i++) {
    const g = g_gameGems[i];
    drawGameGem(g.x, g.y, g.size, g.color);
  }
}

function drawGameGem(x, y, s, c) {
  const light = [Math.min(1, c[0] * 1.4), Math.min(1, c[1] * 1.4), Math.min(1, c[2] * 1.4), 1];
  const dark  = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 1];
  gl.uniform1f(u_Size, 1);
  gl.uniform4f(u_FragColor, light[0], light[1], light[2], 1);
  drawTriangle([x, y + s, x + s * 0.72, y, x - s * 0.72, y]);
  gl.uniform4f(u_FragColor, c[0], c[1], c[2], 1);
  drawTriangle([x, y + s, x + s * 0.72, y, x, y - s]);
  drawTriangle([x, y + s, x - s * 0.72, y, x, y - s]);
  gl.uniform4f(u_FragColor, dark[0], dark[1], dark[2], 1);
  drawTriangle([x + s * 0.72, y, x - s * 0.72, y, x, y - s]);
}

function handleGameClick(ev) {
  const p = convertCoordinatesEventToGL(ev);
  for (let i = g_gameGems.length - 1; i >= 0; i--) {
    const g = g_gameGems[i];
    if (Math.abs(p[0] - g.x) + Math.abs(p[1] - g.y) < g.size * 1.6) {
      g_gameScore += g.value;
      g_gameGems.splice(i, 1);
      return;
    }
  }
}

function createPictureScene() {
  const triangles = [];
  pushCrownMesh(triangles);
  return triangles;
}

function pt(tris, x1, y1, x2, y2, x3, y3, c) {
  pushPictureTriangle(tris, [x1, y1, x2, y2, x3, y3], c);
}

function pushCrownMesh(tris) {
  const G  = [1.00, 0.85, 0.10, 1.0];
  const GD = [0.85, 0.70, 0.05, 1.0];
  const GH = [1.00, 0.93, 0.38, 1.0];
  const GT = [0.88, 0.72, 0.06, 1.0];
  const GS = [0.78, 0.60, 0.03, 1.0];

  pt(tris, -0.900,-0.800, -0.450,-0.727, -0.900, 0.364, G);
  pt(tris, -0.450,-0.727, -0.450, 0.364, -0.900, 0.364, G);
  pt(tris, -0.450,-0.727,  0.000,-0.800, -0.450, 0.364, G);
  pt(tris,  0.000,-0.800,  0.000, 0.364, -0.450, 0.364, G);
  pt(tris,  0.000,-0.800,  0.450,-0.727,  0.000, 0.364, G);
  pt(tris,  0.450,-0.727,  0.450, 0.364,  0.000, 0.364, G);
  pt(tris,  0.450,-0.727,  0.900,-0.800,  0.450, 0.364, G);
  pt(tris,  0.900,-0.800,  0.900, 0.364,  0.450, 0.364, G);

  pt(tris, -0.900, 0.364, -0.900, 0.800, -0.450, 0.364, GD);
  pt(tris, -0.450, 0.364,  0.000, 0.800,  0.450, 0.364, GD);
  pt(tris,  0.450, 0.364,  0.900, 0.800,  0.900, 0.364, GD);

  pt(tris, -0.900, 0.364, -0.900, 0.800, -0.675, 0.364, GH);
  pt(tris, -0.450, 0.364,  0.000, 0.800,  0.000, 0.364, GH);
  pt(tris,  0.450, 0.364,  0.900, 0.800,  0.675, 0.364, GH);

  pt(tris, -0.788, 0.364, -0.563, 0.364, -0.675, 0.218, GT);
  pt(tris, -0.338, 0.364, -0.113, 0.364, -0.225, 0.218, GT);
  pt(tris,  0.113, 0.364,  0.338, 0.364,  0.225, 0.218, GT);
  pt(tris,  0.563, 0.364,  0.788, 0.364,  0.675, 0.218, GT);

  pt(tris, -0.900,-0.800, -0.450,-0.800, -0.450,-0.727, GS);
  pt(tris, -0.450,-0.727, -0.450,-0.800,  0.000,-0.800, GS);
  pt(tris,  0.000,-0.800,  0.450,-0.800,  0.450,-0.727, GS);
  pt(tris,  0.450,-0.727,  0.450,-0.800,  0.900,-0.800, GS);

  pt(tris, -0.675,-0.073, -0.563, 0.073, -0.675, 0.073, [0.80,0.05,0.05,1.0]);
  pt(tris, -0.563, 0.073, -0.675, 0.218, -0.675, 0.073, [1.00,0.30,0.30,1.0]);
  pt(tris, -0.675, 0.218, -0.788, 0.073, -0.675, 0.073, [0.90,0.10,0.10,1.0]);
  pt(tris, -0.788, 0.073, -0.675,-0.073, -0.675, 0.073, [0.65,0.03,0.03,1.0]);

  pt(tris, -0.563,-0.655, -0.450,-0.509, -0.563,-0.509, [0.10,0.20,0.90,1.0]);
  pt(tris, -0.450,-0.509, -0.563,-0.364, -0.563,-0.509, [0.30,0.50,1.00,1.0]);
  pt(tris, -0.563,-0.364, -0.675,-0.509, -0.563,-0.509, [0.15,0.35,0.85,1.0]);
  pt(tris, -0.675,-0.509, -0.563,-0.655, -0.563,-0.509, [0.05,0.10,0.70,1.0]);

  pt(tris,  0.675,-0.073,  0.788, 0.073,  0.675, 0.073, [0.05,0.70,0.15,1.0]);
  pt(tris,  0.788, 0.073,  0.675, 0.218,  0.675, 0.073, [0.20,0.90,0.30,1.0]);
  pt(tris,  0.675, 0.218,  0.563, 0.073,  0.675, 0.073, [0.10,0.80,0.20,1.0]);
  pt(tris,  0.563, 0.073,  0.675,-0.073,  0.675, 0.073, [0.02,0.55,0.10,1.0]);

  pt(tris,  0.056,-0.655,  0.113,-0.582,  0.000,-0.582, [0.50,0.05,0.80,1.0]);
  pt(tris,  0.056,-0.509,  0.113,-0.582,  0.000,-0.582, [0.75,0.30,1.00,1.0]);

  pt(tris,  0.731,-0.509,  0.788,-0.436,  0.675,-0.436, [0.90,0.70,0.05,1.0]);
  pt(tris,  0.731,-0.364,  0.788,-0.436,  0.675,-0.436, [1.00,0.90,0.30,1.0]);

  pt(tris, -0.169, 0.509, -0.113, 0.582, -0.225, 0.582, [0.95,0.30,0.55,1.0]);
  pt(tris, -0.169, 0.655, -0.113, 0.582, -0.225, 0.582, [1.00,0.55,0.75,1.0]);

  pt(tris,  0.169, 0.364,  0.225, 0.436,  0.113, 0.436, [0.05,0.75,0.85,1.0]);
  pt(tris,  0.169, 0.509,  0.225, 0.436,  0.113, 0.436, [0.25,0.95,1.00,1.0]);

  const VI = [0.68, 0.68, 0.08, 1.0];
  pt(tris, -0.450,-0.364, -0.450, 0.218, -0.225,-0.364, VI);
  pt(tris,  0.000,-0.364,  0.000, 0.218, -0.225,-0.364, VI);

  const SD = [0.55, 0.48, 0.05, 1.0];
  pt(tris,  0.450, 0.218,  0.450, 0.073,  0.225, 0.073, SD);
  pt(tris,  0.225, 0.073,  0.169,-0.073,  0.225,-0.073, SD);
  pt(tris,  0.225,-0.073,  0.225,-0.218,  0.450,-0.073, SD);
  pt(tris,  0.450,-0.073,  0.563,-0.291,  0.450,-0.291, SD);
  pt(tris,  0.450,-0.291,  0.225,-0.291,  0.225,-0.436, SD);
}

function pushPictureTriangle(triangles, vertices, color) {
  const triangle = new Triangle();
  triangle.vertices = vertices.slice();
  triangle.color = color.slice();
  triangles.push(triangle);
}

function initShaders(glContext, vertexShaderSource, fragmentShaderSource) {
  const vertexShader = loadShader(glContext, glContext.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = loadShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return false;
  const program = glContext.createProgram();
  glContext.attachShader(program, vertexShader);
  glContext.attachShader(program, fragmentShader);
  glContext.linkProgram(program);
  if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
    console.log(glContext.getProgramInfoLog(program));
    glContext.deleteProgram(program);
    glContext.deleteShader(vertexShader);
    glContext.deleteShader(fragmentShader);
    return false;
  }
  glContext.useProgram(program);
  glContext.program = program;
  return true;
}

function loadShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);
  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    console.log(glContext.getShaderInfoLog(shader));
    glContext.deleteShader(shader);
    return null;
  }
  return shader;
}
