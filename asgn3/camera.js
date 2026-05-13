

const EYE_HEIGHT = 1.62;

class Camera {
  constructor(canvas) {
    this.fov   = 70;
    this.yaw   = 0;
    this.pitch = 0;
    this.yVelocity = 0;
    this.isGrounded = true;

    const sx = (typeof SPAWN_X !== 'undefined') ? SPAWN_X : 3.5;
    const sz = (typeof SPAWN_Z !== 'undefined') ? SPAWN_Z : 32.5;
    this.eye = new Vector3([sx, EYE_HEIGHT, sz]);
    this.at  = new Vector3([sx + 1, EYE_HEIGHT, sz]);
    this.up  = new Vector3([0, 1.0,         0]);

    this.viewMatrix       = new Matrix4();
    this.projectionMatrix = new Matrix4();

    this.updateViewMatrix();
    this.updateProjectionMatrix(canvas.width, canvas.height);
  }

  updateViewMatrix() {
    const yRad = this.yaw   * Math.PI / 180;
    const pRad = this.pitch * Math.PI / 180;
    const cosp = Math.cos(pRad);
    const e    = this.eye.elements;
    const fx   = cosp * Math.cos(yRad);
    const fy   = Math.sin(pRad);
    const fz   = cosp * Math.sin(yRad);
    this.at.elements[0] = e[0] + fx;
    this.at.elements[1] = e[1] + fy;
    this.at.elements[2] = e[2] + fz;
    this.viewMatrix.setLookAt(
      e[0], e[1], e[2],
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      0, 1, 0
    );
  }

  updateProjectionMatrix(w, h) {
    this.projectionMatrix.setPerspective(this.fov, w / h, 0.05, 1000);
  }

  _flatFwd() {
    const yRad = this.yaw * Math.PI / 180;
    return [Math.cos(yRad), 0, Math.sin(yRad)];
  }

  moveForward(spd) {
    const [fx, , fz] = this._flatFwd();
    this.eye.elements[0] += fx * spd;
    this.eye.elements[2] += fz * spd;
    this.updateViewMatrix();
  }

  moveBackward(spd) {
    const [fx, , fz] = this._flatFwd();
    this.eye.elements[0] -= fx * spd;
    this.eye.elements[2] -= fz * spd;
    this.updateViewMatrix();
  }

  moveLeft(spd) {
    const [fx, , fz] = this._flatFwd();
    this.eye.elements[0] += fz * spd;
    this.eye.elements[2] -= fx * spd;
    this.updateViewMatrix();
  }

  moveRight(spd) {
    const [fx, , fz] = this._flatFwd();
    this.eye.elements[0] -= fz * spd;
    this.eye.elements[2] += fx * spd;
    this.updateViewMatrix();
  }

  panLeft(deg) {
    this.yaw += (deg !== undefined ? deg : 5);
    this.updateViewMatrix();
  }

  panRight(deg) {
    this.yaw -= (deg !== undefined ? deg : 5);
    this.updateViewMatrix();
  }

  lookVertical(deg) {
    this.pitch = Math.max(-89, Math.min(89, this.pitch + deg));
    this.updateViewMatrix();
  }

  getFwd() {
    const [fx, , fz] = this._flatFwd();
    return new Float32Array([fx, 0, fz]);
  }
}
