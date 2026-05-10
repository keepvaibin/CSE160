

const FACE_FRONT  = 0;
const FACE_BACK   = 1;
const FACE_LEFT   = 2;
const FACE_RIGHT  = 3;
const FACE_TOP    = 4;
const FACE_BOTTOM = 5;

const FACE_NORMALS = [
  [ 0,  0,  1],
  [ 0,  0, -1],
  [-1,  0,  0],
  [ 1,  0,  0],
  [ 0,  1,  0],
  [ 0, -1,  0],
];

const FACE_VERTS = [

  [[0,0,1, 0,0],[1,0,1, 1,0],[1,1,1, 1,1],[0,0,1, 0,0],[1,1,1, 1,1],[0,1,1, 0,1]],

  [[1,0,0, 0,0],[0,0,0, 1,0],[0,1,0, 1,1],[1,0,0, 0,0],[0,1,0, 1,1],[1,1,0, 0,1]],

  [[0,0,0, 0,0],[0,0,1, 1,0],[0,1,1, 1,1],[0,0,0, 0,0],[0,1,1, 1,1],[0,1,0, 0,1]],

  [[1,0,1, 0,0],[1,0,0, 1,0],[1,1,0, 1,1],[1,0,1, 0,0],[1,1,0, 1,1],[1,1,1, 0,1]],

  [[0,1,0, 0,0],[1,1,0, 1,0],[1,1,1, 1,1],[0,1,0, 0,0],[1,1,1, 1,1],[0,1,1, 0,1]],

  [[0,0,1, 0,0],[1,0,1, 1,0],[1,0,0, 1,1],[0,0,1, 0,0],[1,0,0, 1,1],[0,0,0, 0,1]],
];

function pushFace(arr, bx, by, bz, face) {
  const n  = FACE_NORMALS[face];
  const vs = FACE_VERTS[face];
  for (let i = 0; i < 6; i++) {
    const v = vs[i];
    arr.push(
      bx + v[0], by + v[1], bz + v[2],
      v[3], v[4],
      n[0], n[1], n[2]
    );
  }
}

const SINGLE_CUBE_DATA = new Float32Array([

  -0.5,-0.5, 0.5,  0,0,  0, 0, 1,
   0.5,-0.5, 0.5,  1,0,  0, 0, 1,
   0.5, 0.5, 0.5,  1,1,  0, 0, 1,
  -0.5,-0.5, 0.5,  0,0,  0, 0, 1,
   0.5, 0.5, 0.5,  1,1,  0, 0, 1,
  -0.5, 0.5, 0.5,  0,1,  0, 0, 1,

   0.5,-0.5,-0.5,  0,0,  0, 0,-1,
  -0.5,-0.5,-0.5,  1,0,  0, 0,-1,
  -0.5, 0.5,-0.5,  1,1,  0, 0,-1,
   0.5,-0.5,-0.5,  0,0,  0, 0,-1,
  -0.5, 0.5,-0.5,  1,1,  0, 0,-1,
   0.5, 0.5,-0.5,  0,1,  0, 0,-1,

  -0.5,-0.5,-0.5,  0,0, -1, 0, 0,
  -0.5,-0.5, 0.5,  1,0, -1, 0, 0,
  -0.5, 0.5, 0.5,  1,1, -1, 0, 0,
  -0.5,-0.5,-0.5,  0,0, -1, 0, 0,
  -0.5, 0.5, 0.5,  1,1, -1, 0, 0,
  -0.5, 0.5,-0.5,  0,1, -1, 0, 0,

   0.5,-0.5, 0.5,  0,0,  1, 0, 0,
   0.5,-0.5,-0.5,  1,0,  1, 0, 0,
   0.5, 0.5,-0.5,  1,1,  1, 0, 0,
   0.5,-0.5, 0.5,  0,0,  1, 0, 0,
   0.5, 0.5,-0.5,  1,1,  1, 0, 0,
   0.5, 0.5, 0.5,  0,1,  1, 0, 0,

  -0.5, 0.5,-0.5,  0,0,  0, 1, 0,
   0.5, 0.5,-0.5,  1,0,  0, 1, 0,
   0.5, 0.5, 0.5,  1,1,  0, 1, 0,
  -0.5, 0.5,-0.5,  0,0,  0, 1, 0,
   0.5, 0.5, 0.5,  1,1,  0, 1, 0,
  -0.5, 0.5, 0.5,  0,1,  0, 1, 0,

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

function bindSingleCubeBuffer() {
  const STRIDE = 32;
  gl.bindBuffer(gl.ARRAY_BUFFER, g_singleCubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE,  0);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, STRIDE, 12);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 20);
  gl.enableVertexAttribArray(a_Position);
  gl.enableVertexAttribArray(a_TexCoord);
  gl.enableVertexAttribArray(a_Normal);
}
