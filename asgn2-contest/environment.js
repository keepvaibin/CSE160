var gMeadowMeshes = null;
var gInteractiveGrass = null;

var GRASS_COLORS = [
  [0.18, 0.42, 0.14, 1.0],
  [0.28, 0.56, 0.20, 1.0],
  [0.38, 0.65, 0.22, 1.0]
];

var FLOWER_COLORS = [
  [0.96, 0.32, 0.42, 1.0],
  [0.98, 0.82, 0.22, 1.0],
  [0.56, 0.42, 0.95, 1.0],
  [0.96, 0.72, 0.88, 1.0]
];

var STEM_COLOR = [0.18, 0.44, 0.15, 1.0];
var FLOWER_CENTER_COLOR = [0.23, 0.16, 0.08, 1.0];
var GRASS_HEIGHT_SCALE = 0.86;
var GRASS_WIDTH_SCALE = 0.90;

function seededRandom(seed) {
  var value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function addEnvironmentTriangle(group, a, b, c) {
  var n = getFaceNormal(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  pushVertex(group.positions, a[0], a[1], a[2]);
  pushVertex(group.positions, b[0], b[1], b[2]);
  pushVertex(group.positions, c[0], c[1], c[2]);
  pushVertex(group.normals, n[0], n[1], n[2]);
  pushVertex(group.normals, n[0], n[1], n[2]);
  pushVertex(group.normals, n[0], n[1], n[2]);
}

function addGrassBlade(group, x, z, height, width, yaw, lean) {
  var baseY = GROUND_Y + 0.015;
  var sideX = Math.cos(yaw) * width;
  var sideZ = Math.sin(yaw) * width;
  var leanX = Math.cos(yaw + 1.7) * lean;
  var leanZ = Math.sin(yaw + 1.7) * lean;
  var a = [x - sideX, baseY, z - sideZ];
  var b = [x + sideX, baseY, z + sideZ];
  var c = [x + leanX, baseY + height, z + leanZ];
  addEnvironmentTriangle(group, a, c, b);

  var yaw2 = yaw + Math.PI * 0.5;
  sideX = Math.cos(yaw2) * width * 0.7;
  sideZ = Math.sin(yaw2) * width * 0.7;
  a = [x - sideX, baseY, z - sideZ];
  b = [x + sideX, baseY, z + sideZ];
  addEnvironmentTriangle(group, a, c, b);
}

function addStem(group, x, z, height) {
  addGrassBlade(group, x, z, height, 0.006, seededRandom(x * 19.0 + z * 7.0) * Math.PI, 0.01);
}

function addFlower(group, x, z, y, radius, petals) {
  for (var i = 0; i < petals; i++) {
    var a0 = 2.0 * Math.PI * i / petals;
    var a1 = 2.0 * Math.PI * (i + 0.46) / petals;
    var center = [x, y, z];
    var p0 = [x + Math.cos(a0) * radius, y + Math.sin(a0) * radius * 0.25, z + Math.sin(a0) * radius];
    var p1 = [x + Math.cos(a1) * radius * 0.85, y + 0.006, z + Math.sin(a1) * radius * 0.85];
    addEnvironmentTriangle(group, center, p0, p1);
  }
}

function buildMeadowMeshes() {
  var grassGroups = [];
  for (var i = 0; i < GRASS_COLORS.length; i++) {
    grassGroups.push({ positions: [], normals: [], color: GRASS_COLORS[i] });
  }

  var stemGroup = { positions: [], normals: [], color: STEM_COLOR };
  var centerGroup = { positions: [], normals: [], color: FLOWER_CENTER_COLOR };
  var flowerGroups = [];
  for (var f = 0; f < FLOWER_COLORS.length; f++) {
    flowerGroups.push({ positions: [], normals: [], color: FLOWER_COLORS[f] });
  }

  var fieldHalfSize = 1.68;
  var grassCount = 950;
  for (var g = 0; g < grassCount; g++) {
    var rx = seededRandom(g + 1.0);
    var rz = seededRandom(g + 77.0);
    var x = -fieldHalfSize + rx * fieldHalfSize * 2.0;
    var z = -fieldHalfSize + rz * fieldHalfSize * 2.0;
    var cowClearance = Math.max(0.0, 1.0 - Math.sqrt((x * x) / 0.95 + (z * z) / 0.38));
    var height = 0.10 + seededRandom(g + 122.0) * 0.18;
    height *= 1.0 - cowClearance * 0.48;
    var width = 0.009 + seededRandom(g + 311.0) * 0.012;
    height *= GRASS_HEIGHT_SCALE;
    width *= GRASS_WIDTH_SCALE;
    var yaw = seededRandom(g + 409.0) * Math.PI * 2.0;
    var lean = (seededRandom(g + 511.0) - 0.5) * 0.10;
    addGrassBlade(grassGroups[g % grassGroups.length], x, z, height, width, yaw, lean);
  }

  var flowerCount = 82;
  for (var j = 0; j < flowerCount; j++) {
    var fx = -fieldHalfSize + seededRandom(j + 901.0) * fieldHalfSize * 2.0;
    var fz = -fieldHalfSize + seededRandom(j + 1201.0) * fieldHalfSize * 2.0;
    if (Math.abs(fx) < 0.72 && Math.abs(fz) < 0.38) {
      fx += fx < 0 ? -0.45 : 0.45;
    }
    var stemHeight = 0.14 + seededRandom(j + 1401.0) * 0.13;
    addStem(stemGroup, fx, fz, stemHeight);
    addFlower(flowerGroups[j % flowerGroups.length], fx, fz, GROUND_Y + stemHeight + 0.03, 0.035 + seededRandom(j + 1501.0) * 0.018, 5);
    addFlower(centerGroup, fx, fz, GROUND_Y + stemHeight + 0.031, 0.012, 6);
  }

  var groups = grassGroups.concat([stemGroup, centerGroup]).concat(flowerGroups);
  var meshes = [];
  for (var m = 0; m < groups.length; m++) {
    if (groups[m].positions.length > 0) {
      meshes.push({ mesh: createMesh(groups[m].positions, groups[m].normals), color: groups[m].color });
    }
  }
  return meshes;
}

function ensureMeadowMeshes() {
  if (!gMeadowMeshes) {
    gMeadowMeshes = buildMeadowMeshes();
  }
}

function drawMeadow() {
  ensureMeadowMeshes();
  var motionStrength = getGrassMotionStrength();
  setGrassWaveUniforms(true, motionStrength);
  for (var copy = -1; copy <= 1; copy++) {
    var meadowMatrix = new Matrix4();
    meadowMatrix.translate(gGrassScrollOffset + copy * MEADOW_REPEAT_WIDTH, 0.0, 0.0);
    for (var i = 0; i < gMeadowMeshes.length; i++) {
      drawMeshWithColor(gMeadowMeshes[i].mesh, meadowMatrix, gMeadowMeshes[i].color, false, true);
    }
  }
  setGrassWaveUniforms(false, 0.0);
}

function ensureInteractiveGrass() {
  if (gInteractiveGrass) return;
  gInteractiveGrass = [];
  for (var i = 0; i < 26; i++) {
    gInteractiveGrass.push({
      x: 0.93 + (seededRandom(i + 2001.0) - 0.5) * 0.24,
      z: (seededRandom(i + 2101.0) - 0.5) * 0.26,
      height: (0.17 + seededRandom(i + 2201.0) * 0.14) * GRASS_HEIGHT_SCALE,
      width: (0.018 + seededRandom(i + 2301.0) * 0.014) * GRASS_WIDTH_SCALE,
      yaw: seededRandom(i + 2401.0) * Math.PI * 2.0,
      lean: (seededRandom(i + 2501.0) - 0.5) * 24.0,
      color: GRASS_COLORS[i % GRASS_COLORS.length]
    });
  }
}

function drawEatingGrassPatch(eatPose) {
  if (!gEatingAnimationActive) return;
  ensureInteractiveGrass();
  var bladeMesh = getGrassBladeMesh();
  var bite = eatPose ? eatPose.bite : 0.0;
  var bend = eatPose ? eatPose.blend * 42.0 : 0.0;
  var motionStrength = getGrassMotionStrength();

  setGrassWaveUniforms(true, motionStrength);
  for (var i = 0; i < gInteractiveGrass.length; i++) {
    var blade = gInteractiveGrass[i];
    var matrix = new Matrix4();
    var heightScale = blade.height * (1.0 - bite * 0.72);
    // Keep the biteable patch anchored in front of the cow so the visible grass
    // matches the mouth target used by the eating animation and bite selection.
    matrix.translate(blade.x, GROUND_Y + 0.015, blade.z);
    matrix.rotate(blade.yaw * 180.0 / Math.PI, 0, 1, 0);
    matrix.rotate(blade.lean + bend, 0, 0, 1);
    matrix.scale(blade.width, heightScale, blade.width);
    drawMeshWithColor(bladeMesh, matrix, blade.color, false, true);
  }
  setGrassWaveUniforms(false, 0.0);
}