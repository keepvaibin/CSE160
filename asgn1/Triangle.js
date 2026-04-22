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

function drawTriangle(vertices, color) {
  if (!g_vertexBuffer) {
    g_vertexBuffer = gl.createBuffer();
  }
  const r = color[0], g = color[1], b = color[2], a = color[3];
  const d = new Float32Array([
    vertices[0], vertices[1], r, g, b, a,
    vertices[2], vertices[3], r, g, b, a,
    vertices[4], vertices[5], r, g, b, a,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 24, 8);
  gl.enableVertexAttribArray(a_Color);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}