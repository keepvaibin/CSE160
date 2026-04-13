class Triangle {
  constructor() {
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
    this.vertices = null;
    this.isRainbow = false;
    this.rainbowPhase = 0;
  }

  render() {
    const xy = this.position;
    const rgba = getShapeRenderColor(this);

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(u_Size, this.size);

    if (this.vertices) {
      drawTriangle(this.vertices);
      return;
    }

    const radius = sizeToRadius(this.size);
    drawTriangle([
      xy[0], xy[1] + radius,
      xy[0] - radius, xy[1] - radius,
      xy[0] + radius, xy[1] - radius,
    ]);
  }
}

function drawTriangle(vertices) {
  if (!g_vertexBuffer) {
    g_vertexBuffer = gl.createBuffer();
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}