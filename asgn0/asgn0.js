var canvas;
var ctx;

function main() {
  canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.log('Failed to retrieve the 2D context');
    return false;
  }

  document.getElementById('drawButton').addEventListener('click', handleDrawEvent);
  document.getElementById('operationButton').addEventListener('click', handleDrawOperationEvent);

  clearCanvas();
  handleDrawEvent();
}

function clearCanvas() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawVector(v, color) {
  var x = canvas.width / 2;
  var y = canvas.height / 2;
  var e = v.elements;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + e[0] * 20, y - e[1] * 20);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function handleDrawEvent() {
  clearCanvas();

  var v1 = getVector('v1x', 'v1y');
  var v2 = getVector('v2x', 'v2y');

  drawVector(v1, 'red');
  drawVector(v2, 'blue');
}

function handleDrawOperationEvent() {
  clearCanvas();

  var v1 = getVector('v1x', 'v1y');
  var v2 = getVector('v2x', 'v2y');
  var scalar = parseFloat(document.getElementById('scalar').value) || 0;
  var operation = document.getElementById('operation').value;

  drawVector(v1, 'red');
  drawVector(v2, 'blue');

  if (operation === 'add') {
    var v3 = copyVector(v1);
    v3.add(v2);
    drawVector(v3, 'green');
  } else if (operation === 'sub') {
    var v4 = copyVector(v1);
    v4.sub(v2);
    drawVector(v4, 'green');
  } else if (operation === 'div') {
    var v5 = copyVector(v1);
    var v6 = copyVector(v2);
    v5.div(scalar);
    v6.div(scalar);
    drawVector(v5, 'green');
    drawVector(v6, 'green');
  } else if (operation === 'mul') {
    var v7 = copyVector(v1);
    var v8 = copyVector(v2);
    v7.mul(scalar);
    v8.mul(scalar);
    drawVector(v7, 'green');
    drawVector(v8, 'green');
  } else if (operation === 'magnitude') {
    console.log('v1 magnitude:', v1.magnitude());
    console.log('v2 magnitude:', v2.magnitude());
  } else if (operation === 'normalize') {
    var v9 = copyVector(v1);
    var v10 = copyVector(v2);
    v9.normalize();
    v10.normalize();
    drawVector(v9, 'green');
    drawVector(v10, 'green');
  } else if (operation === 'angle') {
    console.log('Angle:', angleBetween(v1, v2));
  } else if (operation === 'area') {
    console.log('Area:', areaTriangle(v1, v2));
  }
}

function getVector(xId, yId) {
  var x = parseFloat(document.getElementById(xId).value) || 0;
  var y = parseFloat(document.getElementById(yId).value) || 0;
  return new Vector3([x, y, 0]);
}

function copyVector(v) {
  return new Vector3([v.elements[0], v.elements[1], v.elements[2]]);
}

function angleBetween(v1, v2) {
  var m1 = v1.magnitude();
  var m2 = v2.magnitude();
  var value;

  if (m1 === 0 || m2 === 0) {
    return NaN;
  }

  value = Vector3.dot(v1, v2) / (m1 * m2);
  if (value > 1) {
    value = 1;
  }
  if (value < -1) {
    value = -1;
  }

  return Math.acos(value) * 180 / Math.PI;
}

function areaTriangle(v1, v2) {
  return Vector3.cross(v1, v2).magnitude() / 2;
}
