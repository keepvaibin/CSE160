class Circle {
  constructor() {
    this.position = [0, 0];
    this.color = [1, 1, 1, 1];
    this.size = 10;
    this.segments = 12;
    this.isRainbow = false;
    this.rainbowPhase = 0;
  }

  render() {
    const xy = this.position;
    const rgba = getShapeRenderColor(this);
    const radius = sizeToRadius(this.size);
    const angleStep = 360 / this.segments;

    gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.uniform1f(u_Size, this.size);

    for (let angle = 0; angle < 360; angle += angleStep) {
      const angle1 = angle * Math.PI / 180;
      const angle2 = (angle + angleStep) * Math.PI / 180;

      drawTriangle([
        xy[0], xy[1],
        xy[0] + Math.cos(angle1) * radius, xy[1] + Math.sin(angle1) * radius,
        xy[0] + Math.cos(angle2) * radius, xy[1] + Math.sin(angle2) * radius,
      ]);
    }
  }
}