var VSHADER_SOURCE = `
attribute vec4 a_Position;
uniform mat4 u_ModelMatrix;
uniform mat4 u_GlobalRotation;
varying vec3 v_LocalPos;

void main() {
  v_LocalPos = a_Position.xyz + vec3(0.5, 0.5, 0.5);
  gl_Position = u_GlobalRotation * u_ModelMatrix * a_Position;
}
`;

var FSHADER_SOURCE = `
precision mediump float;
uniform vec4 u_FragColor;
uniform float u_UseSpots;
uniform float u_SpotScale;
uniform float u_SpotThreshold;
uniform float u_GradientStrength;
varying vec3 v_LocalPos;

float hash33(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
  vec3 color = u_FragColor.rgb;

  // Mild top-to-bottom gradient keeps flat cubes from looking too uniform.
  float gradient = mix(1.0 - u_GradientStrength, 1.0 + u_GradientStrength, clamp(v_LocalPos.y, 0.0, 1.0));
  color *= gradient;

  if (u_UseSpots > 0.5) {
    float spotNoise = hash33(floor(v_LocalPos * u_SpotScale));
    float blackSpotMask = step(u_SpotThreshold, spotNoise);
    color = mix(color, vec3(0.0), blackSpotMask);
  }

  gl_FragColor = vec4(color, u_FragColor.a);
}
`;
