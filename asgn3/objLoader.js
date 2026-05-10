

function parseOBJ(text) {
  try {
    const positions = [];
    const normals   = [];
    const uvs       = [];
    const result    = [];

    for (const rawLine of text.split('\n')) {
      const line  = rawLine.trim();
      const parts = line.split(/\s+/);
      if (parts[0] === 'v') {
        positions.push([+parts[1], +parts[2], +parts[3]]);
      } else if (parts[0] === 'vn') {
        normals.push([+parts[1], +parts[2], +parts[3]]);
      } else if (parts[0] === 'vt') {
        uvs.push([+parts[1], +parts[2]]);
      } else if (parts[0] === 'f') {

        const verts = parts.slice(1).map(tok => {
          const ids = tok.split('/');
          return {
            pi: (+ids[0]) - 1,
            ti: ids[1] && ids[1] !== '' ? (+ids[1]) - 1 : -1,
            ni: ids[2] && ids[2] !== '' ? (+ids[2]) - 1 : -1,
          };
        });
        for (let i = 1; i < verts.length - 1; i++) {
          for (const v of [verts[0], verts[i], verts[i + 1]]) {
            const p  = positions[v.pi] || [0, 0, 0];
            const uv = v.ti >= 0 ? uvs[v.ti]     : [0, 0];
            const n  = v.ni >= 0 ? normals[v.ni]  : [0, 1, 0];
            result.push(p[0], p[1], p[2], uv[0], uv[1], n[0], n[1], n[2]);
          }
        }
      }
    }
    return result.length > 0 ? new Float32Array(result) : null;
  } catch (e) {
    console.warn('parseOBJ failed:', e);
    return null;
  }
}
