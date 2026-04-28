var gMeshCache = {};

function createMesh(positions, normals) {
  var mesh = {
    positionBuffer: gl.createBuffer(),
    normalBuffer: gl.createBuffer(),
    vertexCount: positions.length / 3
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  return mesh;
}

function getCachedMesh(key, factory) {
  if (!gMeshCache[key]) {
    var data = factory();
    gMeshCache[key] = createMesh(data.positions, data.normals);
  }
  return gMeshCache[key];
}

function setNormalMatrixFromModel(modelMatrix) {
  if (!u_NormalMatrix) return;
  var normalMatrix = new Matrix4();
  normalMatrix.setInverseOf(modelMatrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
}

function setMaterialUniforms(color, useSpots, useLighting) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1f(u_UseSpots, useSpots ? 1.0 : 0.0);
  gl.uniform1f(u_SpotScale, FUR_SPOT_SCALE);
  gl.uniform1f(u_SpotThreshold, FUR_SPOT_THRESHOLD);
  gl.uniform1f(u_GradientStrength, gIsDrawingShadow ? 0.0 : FUR_GRADIENT_STRENGTH);
  if (u_UseLighting) {
    gl.uniform1f(u_UseLighting, useLighting && !gIsDrawingShadow ? 1.0 : 0.0);
  }
}

function drawMeshWithColor(mesh, matrix, color, useSpots, useLighting) {
  setMaterialUniforms(color, useSpots, useLighting !== false);
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
  setNormalMatrixFromModel(matrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
  gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Normal);

  gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
}

function setGrassWaveUniforms(enabled, stepStrength) {
  if (u_GrassWave) {
    gl.uniform1f(u_GrassWave, enabled ? 1.0 : 0.0);
  }
  if (u_GrassStepStrength) {
    gl.uniform1f(u_GrassStepStrength, stepStrength || 0.0);
  }
}

function pushVertex(target, x, y, z) {
  target.push(x, y, z);
}

function getFaceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
  var ux = bx - ax, uy = by - ay, uz = bz - az;
  var vx = cx - ax, vy = cy - ay, vz = cz - az;
  var nx = uy * vz - uz * vy;
  var ny = uz * vx - ux * vz;
  var nz = ux * vy - uy * vx;
  var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
  return [nx / len, ny / len, nz / len];
}

function pushTriangle(positions, normals, a, b, c, normalOverride) {
  var normal = normalOverride || getFaceNormal(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  pushVertex(positions, a[0], a[1], a[2]);
  pushVertex(positions, b[0], b[1], b[2]);
  pushVertex(positions, c[0], c[1], c[2]);
  pushVertex(normals, normal[0], normal[1], normal[2]);
  pushVertex(normals, normal[0], normal[1], normal[2]);
  pushVertex(normals, normal[0], normal[1], normal[2]);
}

function pushSmoothTriangle(positions, normals, a, b, c, na, nb, nc) {
  pushVertex(positions, a[0], a[1], a[2]);
  pushVertex(positions, b[0], b[1], b[2]);
  pushVertex(positions, c[0], c[1], c[2]);
  pushVertex(normals, na[0], na[1], na[2]);
  pushVertex(normals, nb[0], nb[1], nb[2]);
  pushVertex(normals, nc[0], nc[1], nc[2]);
}

function normalize3(x, y, z) {
  var len = Math.sqrt(x * x + y * y + z * z) || 1.0;
  return [x / len, y / len, z / len];
}

function cross3(ax, ay, az, bx, by, bz) {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx
  ];
}

function cowBodyBulge(t, center, width) {
  var distance = (t - center) / width;
  return Math.exp(-distance * distance);
}

function cowBodyPoint(t, theta) {
  var x = -0.5 + t;
  var hip = cowBodyBulge(t, 0.24, 0.25);
  var barrel = cowBodyBulge(t, 0.47, 0.42);
  var shoulder = cowBodyBulge(t, 0.76, 0.22);
  var endRound = 0.70 + 0.30 * Math.sin(Math.PI * t);
  var sinTheta = Math.sin(theta);
  var cosTheta = Math.cos(theta);

  var radiusY = (0.34 + 0.090 * barrel + 0.030 * shoulder - 0.012 * t) * endRound;
  var radiusZ = (0.25 + 0.095 * barrel + 0.105 * hip + 0.030 * shoulder - 0.050 * t) * endRound;
  var centerY = -0.030 - 0.040 * barrel + 0.016 * shoulder;
  var bellyDrop = Math.max(0.0, -sinTheta) * barrel * 0.040;
  var backLift = Math.max(0.0, sinTheta) * shoulder * 0.018;
  var zSkew = Math.sin((t - 0.18) * Math.PI) * 0.012 * barrel;

  return [
    x,
    centerY + sinTheta * radiusY - bellyDrop + backLift,
    zSkew + cosTheta * radiusZ
  ];
}

function cowBodyNormal(t, theta) {
  var dt = 0.01;
  var da = 0.01;
  var t0 = Math.max(0.0, t - dt);
  var t1 = Math.min(1.0, t + dt);
  var px0 = cowBodyPoint(t0, theta);
  var px1 = cowBodyPoint(t1, theta);
  var pa0 = cowBodyPoint(t, theta - da);
  var pa1 = cowBodyPoint(t, theta + da);
  var tx = [px1[0] - px0[0], px1[1] - px0[1], px1[2] - px0[2]];
  var ta = [pa1[0] - pa0[0], pa1[1] - pa0[1], pa1[2] - pa0[2]];
  var normal = cross3(tx[0], tx[1], tx[2], ta[0], ta[1], ta[2]);
  return normalize3(normal[0], normal[1], normal[2]);
}

function createCowBodyData(rings, segments) {
  var positions = [];
  var normals = [];

  for (var ring = 0; ring < rings; ring++) {
    var t0 = ring / rings;
    var t1 = (ring + 1) / rings;

    for (var segment = 0; segment < segments; segment++) {
      var theta0 = 2.0 * Math.PI * segment / segments;
      var theta1 = 2.0 * Math.PI * (segment + 1) / segments;
      var p00 = cowBodyPoint(t0, theta0);
      var p01 = cowBodyPoint(t0, theta1);
      var p10 = cowBodyPoint(t1, theta0);
      var p11 = cowBodyPoint(t1, theta1);
      var n00 = cowBodyNormal(t0, theta0);
      var n01 = cowBodyNormal(t0, theta1);
      var n10 = cowBodyNormal(t1, theta0);
      var n11 = cowBodyNormal(t1, theta1);

      pushSmoothTriangle(positions, normals, p00, p10, p11, n00, n10, n11);
      pushSmoothTriangle(positions, normals, p00, p11, p01, n00, n11, n01);
    }
  }

  var rearSideA = cowBodyPoint(0.0, 0.0);
  var rearSideB = cowBodyPoint(0.0, Math.PI);
  var frontSideA = cowBodyPoint(1.0, 0.0);
  var frontSideB = cowBodyPoint(1.0, Math.PI);
  var rearCenter = [-0.5, (rearSideA[1] + rearSideB[1]) * 0.5, (rearSideA[2] + rearSideB[2]) * 0.5];
  var frontCenter = [0.5, (frontSideA[1] + frontSideB[1]) * 0.5, (frontSideA[2] + frontSideB[2]) * 0.5];
  for (var capSegment = 0; capSegment < segments; capSegment++) {
    var capTheta0 = 2.0 * Math.PI * capSegment / segments;
    var capTheta1 = 2.0 * Math.PI * (capSegment + 1) / segments;
    pushTriangle(positions, normals, rearCenter, cowBodyPoint(0.0, capTheta1), cowBodyPoint(0.0, capTheta0), [-1, 0, 0]);
    pushTriangle(positions, normals, frontCenter, cowBodyPoint(1.0, capTheta0), cowBodyPoint(1.0, capTheta1), [1, 0, 0]);
  }

  return { positions: positions, normals: normals };
}

function cowHeadPoint(t, theta) {
  var x = -0.5 + t;
  var taper = smoothstepNumber(t);
  var sinTheta = Math.sin(theta);
  var cosTheta = Math.cos(theta);
  var endRound = 0.82 + 0.18 * Math.sin(Math.PI * t);
  var cheek = cowBodyBulge(t, 0.22, 0.28);
  var muzzleBridge = cowBodyBulge(t, 0.74, 0.24);

  var radiusY = (0.31 * (1.0 - taper) + 0.155 * taper + 0.020 * cheek) * endRound;
  var radiusZ = (0.255 * (1.0 - taper) + 0.125 * taper + 0.030 * cheek + 0.020 * muzzleBridge) * endRound;
  var centerY = 0.020 - 0.045 * taper;
  var browLift = Math.max(0.0, sinTheta) * (0.025 + 0.020 * cheek);
  var jawPlane = Math.max(0.0, -sinTheta) * (0.035 + 0.025 * taper);

  return [
    x,
    centerY + sinTheta * radiusY + browLift - jawPlane,
    cosTheta * radiusZ
  ];
}

function cowHeadNormal(t, theta) {
  var dt = 0.01;
  var da = 0.01;
  var t0 = Math.max(0.0, t - dt);
  var t1 = Math.min(1.0, t + dt);
  var px0 = cowHeadPoint(t0, theta);
  var px1 = cowHeadPoint(t1, theta);
  var pa0 = cowHeadPoint(t, theta - da);
  var pa1 = cowHeadPoint(t, theta + da);
  var tx = [px1[0] - px0[0], px1[1] - px0[1], px1[2] - px0[2]];
  var ta = [pa1[0] - pa0[0], pa1[1] - pa0[1], pa1[2] - pa0[2]];
  var normal = cross3(tx[0], tx[1], tx[2], ta[0], ta[1], ta[2]);
  return normalize3(normal[0], normal[1], normal[2]);
}

function createCowHeadData(rings, segments) {
  var positions = [];
  var normals = [];

  for (var ring = 0; ring < rings; ring++) {
    var t0 = ring / rings;
    var t1 = (ring + 1) / rings;

    for (var segment = 0; segment < segments; segment++) {
      var theta0 = 2.0 * Math.PI * segment / segments;
      var theta1 = 2.0 * Math.PI * (segment + 1) / segments;
      var p00 = cowHeadPoint(t0, theta0);
      var p01 = cowHeadPoint(t0, theta1);
      var p10 = cowHeadPoint(t1, theta0);
      var p11 = cowHeadPoint(t1, theta1);
      var n00 = cowHeadNormal(t0, theta0);
      var n01 = cowHeadNormal(t0, theta1);
      var n10 = cowHeadNormal(t1, theta0);
      var n11 = cowHeadNormal(t1, theta1);

      pushSmoothTriangle(positions, normals, p00, p10, p11, n00, n10, n11);
      pushSmoothTriangle(positions, normals, p00, p11, p01, n00, n11, n01);
    }
  }

  var backSideA = cowHeadPoint(0.0, 0.0);
  var backSideB = cowHeadPoint(0.0, Math.PI);
  var frontSideA = cowHeadPoint(1.0, 0.0);
  var frontSideB = cowHeadPoint(1.0, Math.PI);
  var backCenter = [-0.5, (backSideA[1] + backSideB[1]) * 0.5, 0.0];
  var frontCenter = [0.5, (frontSideA[1] + frontSideB[1]) * 0.5, 0.0];

  for (var capSegment = 0; capSegment < segments; capSegment++) {
    var capTheta0 = 2.0 * Math.PI * capSegment / segments;
    var capTheta1 = 2.0 * Math.PI * (capSegment + 1) / segments;
    pushTriangle(positions, normals, backCenter, cowHeadPoint(0.0, capTheta1), cowHeadPoint(0.0, capTheta0), [-1, 0, 0]);
    pushTriangle(positions, normals, frontCenter, cowHeadPoint(1.0, capTheta0), cowHeadPoint(1.0, capTheta1), [1, 0, 0]);
  }

  return { positions: positions, normals: normals };
}

function smoothstepNumber(t) {
  return t * t * (3.0 - 2.0 * t);
}

function createEllipsoidData(latSegments, lonSegments) {
  var positions = [];
  var normals = [];

  for (var lat = 0; lat < latSegments; lat++) {
    var phi0 = Math.PI * lat / latSegments;
    var phi1 = Math.PI * (lat + 1) / latSegments;

    for (var lon = 0; lon < lonSegments; lon++) {
      var theta0 = 2.0 * Math.PI * lon / lonSegments;
      var theta1 = 2.0 * Math.PI * (lon + 1) / lonSegments;
      var p00 = spherePoint(phi0, theta0);
      var p01 = spherePoint(phi0, theta1);
      var p10 = spherePoint(phi1, theta0);
      var p11 = spherePoint(phi1, theta1);
      var n00 = normalize3(p00[0], p00[1], p00[2]);
      var n01 = normalize3(p01[0], p01[1], p01[2]);
      var n10 = normalize3(p10[0], p10[1], p10[2]);
      var n11 = normalize3(p11[0], p11[1], p11[2]);

      pushSmoothTriangle(positions, normals, p00, p10, p11, n00, n10, n11);
      pushSmoothTriangle(positions, normals, p00, p11, p01, n00, n11, n01);
    }
  }

  return { positions: positions, normals: normals };
}

function spherePoint(phi, theta) {
  var sinPhi = Math.sin(phi);
  return [
    0.5 * Math.cos(theta) * sinPhi,
    0.5 * Math.cos(phi),
    0.5 * Math.sin(theta) * sinPhi
  ];
}

function createTaperedCylinderData(segments, bottomRadius, topRadius, capTop, capBottom) {
  var positions = [];
  var normals = [];
  var bottomY = -0.5;
  var topY = 0.5;

  for (var i = 0; i < segments; i++) {
    var a0 = 2.0 * Math.PI * i / segments;
    var a1 = 2.0 * Math.PI * (i + 1) / segments;
    var b0 = [Math.cos(a0) * bottomRadius * 0.5, bottomY, Math.sin(a0) * bottomRadius * 0.5];
    var b1 = [Math.cos(a1) * bottomRadius * 0.5, bottomY, Math.sin(a1) * bottomRadius * 0.5];
    var t0 = [Math.cos(a0) * topRadius * 0.5, topY, Math.sin(a0) * topRadius * 0.5];
    var t1 = [Math.cos(a1) * topRadius * 0.5, topY, Math.sin(a1) * topRadius * 0.5];
    var n0 = normalize3(Math.cos(a0), (bottomRadius - topRadius) * 0.35, Math.sin(a0));
    var n1 = normalize3(Math.cos(a1), (bottomRadius - topRadius) * 0.35, Math.sin(a1));

    pushSmoothTriangle(positions, normals, b0, t0, t1, n0, n0, n1);
    pushSmoothTriangle(positions, normals, b0, t1, b1, n0, n1, n1);

    if (capBottom) {
      pushTriangle(positions, normals, [0, bottomY, 0], b1, b0, [0, -1, 0]);
    }
    if (capTop) {
      pushTriangle(positions, normals, [0, topY, 0], t0, t1, [0, 1, 0]);
    }
  }

  return { positions: positions, normals: normals };
}

function createLeafData() {
  var positions = [];
  var normals = [];
  pushTriangle(positions, normals, [-0.5, 0.0, 0.0], [0.0, 1.0, 0.04], [0.5, 0.0, 0.0]);
  pushTriangle(positions, normals, [0.5, 0.0, 0.0], [0.0, 1.0, -0.04], [-0.5, 0.0, 0.0]);
  return { positions: positions, normals: normals };
}

function createHoofData() {
  var positions = [];
  var normals = [];
  var v = [
    [-0.5, -0.5, -0.55], [0.5, -0.5, -0.55], [0.58, -0.5, 0.55], [-0.58, -0.5, 0.55],
    [-0.35, 0.5, -0.35], [0.35, 0.5, -0.35], [0.42, 0.5, 0.42], [-0.42, 0.5, 0.42]
  ];
  var faces = [
    [0, 1, 2, 3], [4, 7, 6, 5], [3, 2, 6, 7], [0, 4, 5, 1], [1, 5, 6, 2], [0, 3, 7, 4]
  ];

  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    pushTriangle(positions, normals, v[f[0]], v[f[1]], v[f[2]]);
    pushTriangle(positions, normals, v[f[0]], v[f[2]], v[f[3]]);
  }

  return { positions: positions, normals: normals };
}

function getEllipsoidMesh() {
  return getCachedMesh('ellipsoid-18-28', function() { return createEllipsoidData(18, 28); });
}

function getLowEllipsoidMesh() {
  return getCachedMesh('ellipsoid-10-16', function() { return createEllipsoidData(10, 16); });
}

function getCylinderMesh() {
  return getCachedMesh('cylinder-18', function() { return createTaperedCylinderData(18, 1.0, 1.0, true, true); });
}

function getTaperedCylinderMesh() {
  return getCachedMesh('tapered-cylinder-18', function() { return createTaperedCylinderData(18, 1.15, 0.75, true, true); });
}

function getUpperLegMesh() {
  return getCachedMesh('upper-leg-24', function() { return createTaperedCylinderData(24, 1.0, 1.18, true, true); });
}

function getLowerLegMesh() {
  return getCachedMesh('lower-leg-24', function() { return createTaperedCylinderData(24, 0.58, 1.0, true, true); });
}

function getCannonBoneMesh() {
  return getCachedMesh('cannon-bone-20', function() { return createTaperedCylinderData(20, 0.52, 0.76, true, true); });
}

function getNeckSegmentMesh() {
  return getCachedMesh('neck-segment-24', function() { return createTaperedCylinderData(24, 0.88, 1.08, true, true); });
}

function getCowBodyMesh() {
  return getCachedMesh('cow-body-28-36', function() { return createCowBodyData(28, 36); });
}

function getCowHeadMesh() {
  return getCachedMesh('cow-head-22-30', function() { return createCowHeadData(22, 30); });
}

function getConeMesh() {
  return getCachedMesh('cone-18', function() { return createTaperedCylinderData(18, 1.0, 0.05, true, true); });
}

function getGrassBladeMesh() {
  return getCachedMesh('grass-blade', createLeafData);
}

function getHoofMesh() {
  return getCachedMesh('hoof', createHoofData);
}