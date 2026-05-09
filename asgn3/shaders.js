// ─────────────────────────────────────────────────────────────────────────────
// shaders.js — GLSL source strings for The Backrooms: Entity Survival
//
// Vertex shader: MVP transform, passes world-pos/UV/normal/dist to fragment.
// Fragment shader:
//   • 4 texture groups: 0=wall (blue-tinted), 1=ceiling/floor, 2=light tile
//                       (emissive), 3=door
//   • Up to 8 point lights — placed by world.js at every "fixture" cell
//   • Per-fixture flicker (sine hum + hash noise + rare dropouts), with a
//     uniform toggle (u_flickerEnabled) for accessibility
//   • Sickly yellow distance fog (depth-based; v_Dist = -viewPos.z)
//   • Solid-color mode for the entity
// ─────────────────────────────────────────────────────────────────────────────

var VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
attribute vec3 a_Normal;

uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;

varying vec2  v_TexCoord;
varying vec3  v_Normal;
varying vec3  v_WorldPos;
varying float v_Dist;

void main() {
  vec4 worldPos = u_ModelMatrix * a_Position;
  vec4 viewPos  = u_ViewMatrix  * worldPos;
  gl_Position   = u_ProjectionMatrix * viewPos;

  v_TexCoord = a_TexCoord;
  v_Normal   = normalize(mat3(u_ModelMatrix) * a_Normal);
  v_WorldPos = worldPos.xyz;
  v_Dist     = -viewPos.z;
}
`;

var FSHADER_SOURCE = `
precision mediump float;

#define MAX_LIGHTS 8

// ── Texture samplers (4 groups) ───────────────────────────────────────────
uniform sampler2D u_Sampler0;  // walls         (wall.png)
uniform sampler2D u_Sampler1;  // floor+ceiling (ceiling_floor.png)
uniform sampler2D u_Sampler2;  // ceiling light (light.png — emissive tile)
uniform sampler2D u_Sampler3;  // door          (oak door)
uniform sampler2D u_Sampler4;  // goop decals   (goop_arrow.png etc.)

// ── Rendering mode ────────────────────────────────────────────────────────
uniform int   u_whichTexture;    // 0-3: selects sampler
uniform float u_texColorWeight;  // 0.0 = solid baseColor, 1.0 = texture
uniform vec4  u_baseColor;

// ── Time + flicker control ────────────────────────────────────────────────
uniform float u_time;
uniform int   u_flickerEnabled;  // 1 = flicker, 0 = steady (accessibility)
// when 1, output is treated as self-lit (used for the tv screen)
uniform int   u_emissive;

// ── Point lights (variable-length, max MAX_LIGHTS) ────────────────────────
uniform int  u_numLights;
uniform vec3 u_lightPos[MAX_LIGHTS];

// ── Fog ───────────────────────────────────────────────────────────────────
uniform float u_fogNear;
uniform float u_fogFar;
uniform vec3  u_fogColor;

// ── Varyings ──────────────────────────────────────────────────────────────
varying vec2  v_TexCoord;
varying vec3  v_Normal;
varying vec3  v_WorldPos;
varying float v_Dist;

// One point-light contribution (attenuation + diffuse, slightly softer
// quadratic falloff so lights fade out within ~20 units = one fog-far away).
float pointLight(vec3 lPos, vec3 nrm) {
  vec3  toL  = lPos - v_WorldPos;
  float dist = length(toL);
  float att  = 1.0 / (1.0 + 0.20 * dist + 0.06 * dist * dist);
  float dif  = max(dot(nrm, normalize(toL)), 0.0);
  return att * (0.40 + 0.60 * dif);
}

// Cheap pseudo-random hash for the noise flicker.
float hash12(vec2 p) {
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

// Per-fixture intensity in [0, 1.3].
//   base  : steady-state output
//   speed : sine-hum rate
//   id    : per-fixture seed for the noise/dropout terms
//
// When u_flickerEnabled == 0 we return 'base' flat (still scales lighting,
// just stops the buzzing/dropouts so photosensitive players are safe).
float fluorescent(float base, float speed, float phase, float id) {
  if (u_flickerEnabled == 0) return base;
  float t       = u_time * speed + phase;
  float hum     = 0.06 * sin(t);                                    // ±6%
  float flutter = 0.18 * (hash12(vec2(id, floor(u_time * 28.0))) - 0.5);
  float dropRng = hash12(vec2(id * 7.31, floor(u_time * 9.0)));
  float dropout = step(0.93, dropRng);                              // 7% chance/frame
  return clamp((base + hum + flutter) * (1.0 - dropout), 0.0, 1.3);
}

// Slightly blurry wall sample — averages 5 taps so the same 16/32-px wall
// texture doesn't look pixel-sharp and hyper-repetitive on a 96×96 grid.
vec4 sampleWallBlurred(vec2 uv) {
  float r = 0.012;
  vec4 a = texture2D(u_Sampler0, uv);
  vec4 b = texture2D(u_Sampler0, uv + vec2( r, 0.0));
  vec4 c = texture2D(u_Sampler0, uv + vec2(-r, 0.0));
  vec4 d = texture2D(u_Sampler0, uv + vec2(0.0,  r));
  vec4 e = texture2D(u_Sampler0, uv + vec2(0.0, -r));
  return (a + b + c + d + e) * 0.2;
}

void main() {
  vec4 texColor;
  if      (u_whichTexture == 0) texColor = sampleWallBlurred(v_TexCoord);
  else if (u_whichTexture == 1) texColor = texture2D(u_Sampler1, v_TexCoord);
  else if (u_whichTexture == 2) texColor = texture2D(u_Sampler2, v_TexCoord);
  else if (u_whichTexture == 4) texColor = texture2D(u_Sampler4, v_TexCoord);
  else                          texColor = texture2D(u_Sampler3, v_TexCoord);

  // goop tiles: transparent background shows underlying floor/wall through blending
  if (u_whichTexture == 4 && texColor.a < 0.05) discard;

  vec3 albedo;
  if (u_whichTexture == 0 && u_texColorWeight > 0.5) {
    albedo = texColor.rgb;
  } else {
    albedo = mix(u_baseColor, texColor, clamp(u_texColorWeight, 0.0, 1.0)).rgb;
  }

  vec3  nrm   = normalize(v_Normal);
  float light = 0.20;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_numLights) break;
    float fid   = float(i);
    float baseI = 0.78 + 0.04 * sin(fid * 1.9);
    float speed = 5.0  + 2.4  * fid;
    float phase = fid  * 1.37;
    light += fluorescent(baseI, speed, phase, fid) * pointLight(u_lightPos[i], nrm) * 0.62;
  }
  light = clamp(light, 0.0, 1.4);
  vec3 lit = albedo * light;

  if (u_whichTexture == 2) {
    float tileId  = floor(v_WorldPos.x) * 7.13 + floor(v_WorldPos.z) * 3.71;
    float emissive = 1.05;
    if (u_flickerEnabled == 1)
      emissive *= fluorescent(1.0, 8.5 + mod(tileId, 3.0),
                              v_WorldPos.x * 0.7 + v_WorldPos.z * 0.4, tileId);
    lit = mix(lit, texColor.rgb * emissive, 0.85);
  }

  if (u_emissive == 1) {
    float ee = 1.0;
    if (u_flickerEnabled == 1)
      ee = 0.55 + 0.55 * fluorescent(1.0, 11.0, v_WorldPos.x * 1.3, 21.0);
    lit = albedo * ee;
  }

  float fogFactor = clamp((v_Dist - u_fogNear) / (u_fogFar - u_fogNear), 0.0, 1.0);
  float outAlpha  = (u_whichTexture == 4) ? texColor.a : 1.0;
  gl_FragColor = vec4(mix(lit, u_fogColor, fogFactor), outAlpha);
}
`;
