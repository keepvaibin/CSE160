var VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec3 a_Normal;
uniform mat4 u_ModelMatrix;
uniform mat4 u_GlobalRotation;
uniform mat4 u_NormalMatrix;
uniform float u_Time;
uniform float u_GrassWave;
uniform float u_GrassStepStrength;
varying vec3 v_LocalPos;
varying vec3 v_Normal;
varying vec3 v_WorldPos;

void main() {
  vec4 animatedPosition = a_Position;

  if (u_GrassWave > 0.5) {
    float bladeWeight = clamp((a_Position.y + 0.85) * 5.0, 0.0, 1.0);
    float motionStrength = clamp(u_GrassStepStrength, 0.0, 1.5);
    if (motionStrength > 0.001) {
      float wind = sin(u_Time * 1.8 + a_Position.x * 2.6 + a_Position.z * 3.8) * (0.010 * motionStrength);
      animatedPosition.z += wind * bladeWeight;
    }
  }

  v_LocalPos = animatedPosition.xyz;
  v_Normal = normalize((u_NormalMatrix * vec4(a_Normal, 0.0)).xyz);
  vec4 worldPosition = u_ModelMatrix * animatedPosition;
  v_WorldPos = worldPosition.xyz;
  gl_Position = u_GlobalRotation * worldPosition;
}
`;

var FSHADER_SOURCE = `
precision mediump float;
uniform vec4 u_FragColor;
uniform float u_UseSpots;
uniform float u_SpotScale;
uniform float u_SpotThreshold;
uniform float u_GradientStrength;
uniform float u_UseLighting;
uniform vec3 u_LightDirection;
uniform vec3 u_AmbientLight;
varying vec3 v_LocalPos;
varying vec3 v_Normal;
varying vec3 v_WorldPos;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.07 + vec3(5.2, 1.3, 3.7);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 color = u_FragColor.rgb;

  // Mild top-to-bottom gradient keeps flat cubes from looking too uniform.
  float gradient = mix(1.0 - u_GradientStrength, 1.0 + u_GradientStrength, clamp(v_LocalPos.y + 0.5, 0.0, 1.0));
  color *= gradient;

  if (u_UseSpots > 0.5) {
    vec3 p = v_LocalPos * u_SpotScale + vec3(2.1, 5.4, 1.7);
    float broadPatch = fbm(p);
    float edgeBreakup = fbm(p * 2.35 + vec3(4.8, 0.6, 2.9));
    float patchNoise = broadPatch * 0.82 + edgeBreakup * 0.18;
    float blackSpotMask = smoothstep(u_SpotThreshold - 0.028, u_SpotThreshold + 0.010, patchNoise);
    color = mix(color, vec3(0.06, 0.065, 0.07), blackSpotMask);
  }

  if (u_UseLighting > 0.5) {
    vec3 n = normalize(v_Normal);
    vec3 lightDirection = normalize(u_LightDirection);
    vec3 viewDirection = normalize(vec3(0.0, 0.12, 2.2) - v_WorldPos);
    vec3 halfwayDirection = normalize(lightDirection + viewDirection);
    float diffuse = max(dot(n, lightDirection), 0.0);
    float wrap = max(dot(n, lightDirection) * 0.5 + 0.5, 0.0);
    float specular = pow(max(dot(n, halfwayDirection), 0.0), 26.0) * 0.16;
    vec3 light = u_AmbientLight + vec3(0.72) * diffuse + vec3(0.16) * wrap;
    color *= light;
    color += vec3(specular);
  }

  gl_FragColor = vec4(color, u_FragColor.a);
}
`;
