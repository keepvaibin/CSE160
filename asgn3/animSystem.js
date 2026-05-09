// animSystem.js — JSON keyframe loader + per-node interpolator
//
// Public API:
//   loadAnim(url, onReady)              — async fetch via XHR
//   getInterpolatedTransform(name, t)   — Matrix4 local transform at time t
//   g_animData                          — raw JSON (or null until loaded)
//   g_animLoaded                        — boolean
//
// Math:
//   Each node has a pivot p and a list of keyframes (time, translation, rotation).
//   Time is wrapped via modulo over duration so the cycle loops seamlessly.
//   Translation and Euler rotation are linearly interpolated between the two
//   bracketing keyframes.  The returned matrix performs the rotation about the
//   pivot, then applies the per-frame translation:
//
//      M = T(translation) * T(pivot) * Rz * Ry * Rx * T(-pivot)
//
//   This is the textbook "rotate-around-pivot" trick (translate to origin,
//   rotate, translate back) and gives the joint behaviour the parts were
//   exported for.
// ─────────────────────────────────────────────────────────────────────────────

var g_animData   = null;
var g_animLoaded = false;

// ── Loader ────────────────────────────────────────────────────────────────
function loadAnim(url, onReady) {
  url = url || 'anim.json';
  console.log('[anim] Loading', url, '...');
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onload = function () {
    const ok = (xhr.status === 0) || (xhr.status >= 200 && xhr.status < 300);
    if (!ok) {
      console.warn('[anim] HTTP', xhr.status, '— animations disabled');
      return;
    }
    try {
      g_animData   = JSON.parse(xhr.responseText);
      g_animLoaded = true;
      console.log('[anim] Loaded — duration=' + g_animData.duration + 's, nodes:',
                  Object.keys(g_animData.nodes).join(', '));
      if (onReady) onReady();
    } catch (e) {
      console.error('[anim] JSON parse failed:', e);
    }
  };
  xhr.onerror = function () {
    console.error('[anim] XHR network error — must be served over HTTP');
  };
  xhr.send();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _lerp(a, b, t)       { return a + (b - a) * t; }
function _lerp3(a, b, t)      { return [_lerp(a[0],b[0],t), _lerp(a[1],b[1],t), _lerp(a[2],b[2],t)]; }

// Find the two keyframes bracketing `t` in a sorted keyframe list.
// Returns { k0, k1, alpha } where alpha is the 0..1 interpolation factor.
function _findBracket(keyframes, t) {
  const n = keyframes.length;
  // Clamp into the valid range
  if (t <= keyframes[0].time)        return { k0: keyframes[0],   k1: keyframes[0],   alpha: 0 };
  if (t >= keyframes[n - 1].time)    return { k0: keyframes[n-1], k1: keyframes[n-1], alpha: 0 };
  for (let i = 0; i < n - 1; i++) {
    const a = keyframes[i], b = keyframes[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time;
      const alpha = span > 0 ? (t - a.time) / span : 0;
      return { k0: a, k1: b, alpha: alpha };
    }
  }
  return { k0: keyframes[0], k1: keyframes[0], alpha: 0 };  // unreachable
}

// ── Public: per-node interpolated transform ───────────────────────────────
function getInterpolatedTransform(nodeName, currentTime) {
  const m = new Matrix4();   // identity
  if (!g_animLoaded || !g_animData) return m;

  const node = g_animData.nodes[nodeName];
  if (!node) return m;

  const dur = g_animData.duration;
  // Wrap time into [0, dur) so the cycle loops forever
  const t = ((currentTime % dur) + dur) % dur;

  const { k0, k1, alpha } = _findBracket(node.keyframes, t);
  const tr  = _lerp3(k0.translation, k1.translation, alpha);
  const rot = _lerp3(k0.rotation,    k1.rotation,    alpha);
  const p   = node.pivot || [0, 0, 0];

  // M = T(tr) * T(pivot) * Rz * Ry * Rx * T(-pivot)
  m.setTranslate(tr[0], tr[1], tr[2]);
  m.translate(p[0], p[1], p[2]);
  m.rotate(rot[2], 0, 0, 1);
  m.rotate(rot[1], 0, 1, 0);
  m.rotate(rot[0], 1, 0, 0);
  m.translate(-p[0], -p[1], -p[2]);
  return m;
}
