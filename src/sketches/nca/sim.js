// WebGL2 growing neural cellular automaton (Mordvintsev et al., Distill 2020),
// run on p5's WEBGL context. Weights come from the NCAs repo's `nca-export`.
//
// The 24-channel state lives in six RGBA32F textures (channel 4k+i is
// component i of texture k; texture 0 is premultiplied RGB + alpha). One step
// is two passes, matching GrowingNCA.step:
//   update  cur -> tmp  dead neighbourhoods (3x3 max alpha <= threshold) write
//                       zeros without touching the MLP; cells that don't fire
//                       copy themselves; the rest add perception -> MLP.
//   mask    tmp -> cur  zero cells whose new 3x3 neighbourhood has died.
// Edits (seed, erase, collapse, clear) go cur -> tmp and swap. A stats pass
// sums 8x8 blocks (live cells, change since the last snapshot, centroid) for
// an occasional readback; nothing is read back per frame.

const BLOCK = 8;
const N = 6; // state textures

const VERT = `#version 300 es
void main() {
  gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform ivec2 uSize;
uniform float uThr;
${Array.from({ length: N }, (_, k) => `uniform sampler2D uS${k};`).join('\n')}
${Array.from({ length: N }, (_, k) => `layout(location = ${k}) out vec4 o${k};`).join('\n')}

vec4 at(sampler2D s, ivec2 c) {
  return all(greaterThanEqual(c, ivec2(0))) && all(lessThan(c, uSize)) ? texelFetch(s, c, 0) : vec4(0.0);
}
bool alive(sampler2D s, ivec2 c) {
  float m = 0.0;
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++) m = max(m, at(s, c + ivec2(dx, dy)).a);
  return m > uThr;
}
void zero() { ${Array.from({ length: N }, (_, k) => `o${k} = vec4(0.0);`).join(' ')} }
void copy(ivec2 c) { ${Array.from({ length: N }, (_, k) => `o${k} = texelFetch(uS${k}, c, 0);`).join(' ')} }
`;

const sumTerms = (k) => `
  { vec4 v;
    v = at(uS${k}, c + ivec2(-1, -1)); sx -= v; sy -= v;
    v = at(uS${k}, c + ivec2( 0, -1)); sy -= 2.0 * v;
    v = at(uS${k}, c + ivec2( 1, -1)); sx += v; sy -= v;
    v = at(uS${k}, c + ivec2(-1,  0)); sx -= 2.0 * v;
    v = at(uS${k}, c + ivec2( 1,  0)); sx += 2.0 * v;
    v = at(uS${k}, c + ivec2(-1,  1)); sx -= v; sy += v;
    v = at(uS${k}, c + ivec2( 0,  1)); sy += 2.0 * v;
    v = at(uS${k}, c + ivec2( 1,  1)); sx += v; sy += v;
    P[${k}] = texelFetch(uS${k}, c, 0); P[${N + k}] = sx * 0.125; P[${2 * N + k}] = sy * 0.125; }`;

const UPDATE = `${HEAD}
uniform sampler2D uW;   // one row per hidden unit: 18 W1 vec4s, 6 W2 vec4s, bias
uniform int uHidden;
uniform float uFire;
uniform uint uStep;
uniform bool uCap;      // over the live-cell budget: dead cells may not come alive

uint hash(uvec3 v) { // pcg3d
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (!alive(uS0, c)) { zero(); return; }
  float a = texelFetch(uS0, c, 0).a;
  bool fire = float(hash(uvec3(c, uStep)) >> 8u) * (1.0 / 16777216.0) < uFire;
  if (!fire || (uCap && a <= uThr)) { copy(c); return; }

  vec4 P[${3 * N}];
  ${Array.from({ length: N }, (_, k) => `{ vec4 sx = vec4(0.0), sy = vec4(0.0); ${sumTerms(k)} }`).join('\n  ')}

  vec4 d[${N}];
  for (int k = 0; k < ${N}; k++) d[k] = vec4(0.0);
  for (int j = 0; j < uHidden; j++) {
    float h = texelFetch(uW, ivec2(${4 * N}, j), 0).x;
    for (int i = 0; i < ${3 * N}; i++) h += dot(texelFetch(uW, ivec2(i, j), 0), P[i]);
    if (h <= 0.0) continue;
    for (int k = 0; k < ${N}; k++) d[k] += h * texelFetch(uW, ivec2(${3 * N} + k, j), 0);
  }
  ${Array.from({ length: N }, (_, k) => `o${k} = P[${k}] + d[${k}];`).join(' ')}
}`;

const MASK = `${HEAD}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (alive(uS0, c)) copy(c); else zero();
}`;

// uOp: 0 erase inside the disc, 1 keep only inside the disc, 2 plant a seed at
// uCentre, 3 clear everything
const EDIT = `${HEAD}
uniform int uOp;
uniform vec2 uCentre;
uniform float uRadius;
uniform vec3 uSeed;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 q = vec2(c) + 0.5 - uCentre;
  bool inside = dot(q, q) <= uRadius * uRadius;
  if (uOp == 3 || (uOp == 0 && inside) || (uOp == 1 && !inside)) { zero(); return; }
  copy(c);
  if (uOp == 2 && c == ivec2(floor(uCentre))) {
    o0 = vec4(uSeed, 1.0);
    ${Array.from({ length: N - 1 }, (_, k) => `o${k + 1} = vec4(1.0);`).join(' ')}
  }
}`;

const STATS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uS0;
uniform sampler2D uSnap;
uniform ivec2 uSize;
uniform float uThr;
out vec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * ${BLOCK};
  float n = 0.0, act = 0.0, sx = 0.0, sy = 0.0;
  for (int y = 0; y < ${BLOCK}; y++)
    for (int x = 0; x < ${BLOCK}; x++) {
      ivec2 c = b + ivec2(x, y);
      if (c.x >= uSize.x || c.y >= uSize.y) continue;
      vec4 v = clamp(texelFetch(uS0, c, 0), 0.0, 1.0);
      vec4 w = clamp(texelFetch(uSnap, c, 0), 0.0, 1.0);
      act += dot(abs(v - w), vec4(1.0));
      if (v.a > uThr) { n += 1.0; sx += float(c.x); sy += float(c.y); }
    }
  o = vec4(n, act, sx, sy);
}`;

const RENDER = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uS0;
uniform ivec2 uSize;
uniform vec2 uRes;      // drawing buffer, device px
uniform vec2 uOrigin;   // device px of cell (0, 0)'s top-left corner, y down
uniform float uCell;    // device px per cell
uniform vec3 uPaper;
uniform vec3 uRing;     // brush ring: centre (device px, y down), radius; radius 0 = none
uniform float uDpr;
out vec4 o;
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  ivec2 c = ivec2(floor((px - uOrigin) / uCell));
  vec3 col = uPaper;
  if (all(greaterThanEqual(c, ivec2(0))) && all(lessThan(c, uSize))) {
    vec4 v = clamp(texelFetch(uS0, c, 0), 0.0, 1.0);
    col = clamp(uPaper * (1.0 - v.a) + v.rgb, 0.0, 1.0);
  }
  if (uRing.z > 0.0) {
    float e = abs(length(px - uRing.xy) - uRing.z);
    col = mix(col, vec3(0.25), 0.6 * (1.0 - smoothstep(0.5 * uDpr, 1.5 * uDpr, e)));
  }
  o = vec4(col, 1.0);
}`;

export async function loadModel(base) {
  const meta = await (await fetch(`${base}nca-model.json`)).json();
  const buf = await (await fetch(`${base}nca-model.bin`)).arrayBuffer();
  return { meta, weights: new Float32Array(buf) };
}

export function createSim(gl, { meta, weights }) {
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets unsupported');
  if (meta.channels !== 4 * N) throw new Error(`expected ${4 * N} channels, got ${meta.channels}`);

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(src) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, src));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = new Proxy({}, { get: (cache, name) => (cache[name] ??= gl.getUniformLocation(pr, name)) });
    return { pr, u };
  }
  const update = program(UPDATE);
  const mask = program(MASK);
  const edit = program(EDIT);
  const stats = program(STATS);
  const render = program(RENDER);
  const vao = gl.createVertexArray();

  // p5 leaves UNPACK_PREMULTIPLY_ALPHA on, which would scale every weight vec4 by its w
  function unpackDefaults() {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  function texture(w, h, data = null) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    unpackDefaults();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    return t;
  }
  function framebuffer(texs) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    texs.forEach((t, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, k) => gl.COLOR_ATTACHMENT0 + k));
    return fb;
  }

  const wTex = texture(meta.texture.width, meta.texture.height, weights);
  const threshold = meta.alive_threshold;

  let W = 0, H = 0;
  let sets = []; // [{ texs, fb }] x2: cur and tmp
  let cur = 0;
  let snap = null; // { tex, fb } copy of texture 0 for the activity measure
  let statTex = null, statFb = null, statBuf = null;
  let step = 0;

  function free() {
    for (const s of sets) {
      s.texs.forEach((t) => gl.deleteTexture(t));
      gl.deleteFramebuffer(s.fb);
    }
    if (snap) {
      gl.deleteTexture(snap.tex);
      gl.deleteFramebuffer(snap.fb);
    }
    if (statTex) {
      gl.deleteTexture(statTex);
      gl.deleteFramebuffer(statFb);
    }
  }

  function resize(w, h) {
    free();
    W = w;
    H = h;
    sets = [0, 1].map(() => {
      const texs = Array.from({ length: N }, () => texture(W, H));
      return { texs, fb: framebuffer(texs) };
    });
    cur = 0;
    const st = texture(W, H);
    snap = { tex: st, fb: framebuffer([st]) };
    const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
    statTex = texture(bw, bh);
    statFb = framebuffer([statTex]);
    statBuf = new Float32Array(bw * bh * 4);
    clear();
  }

  // Run `prog` over the grid reading set `src`, writing `fb`.
  function pass(prog, src, fb, w = W, h = H) {
    gl.useProgram(prog.pr);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    for (let k = 0; k < N; k++) {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, src.texs[k]);
      gl.uniform1i(prog.u[`uS${k}`], k);
    }
    gl.uniform2i(prog.u.uSize, W, H);
    gl.uniform1f(prog.u.uThr, threshold);
  }
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  function stepOnce({ fire = meta.fire_rate, cap = false } = {}) {
    const a = sets[cur], b = sets[1 - cur];
    pass(update, a, b.fb);
    gl.activeTexture(gl.TEXTURE0 + N);
    gl.bindTexture(gl.TEXTURE_2D, wTex);
    gl.uniform1i(update.u.uW, N);
    gl.uniform1i(update.u.uHidden, meta.hidden);
    gl.uniform1f(update.u.uFire, fire);
    gl.uniform1ui(update.u.uStep, Math.imul(step++, 2654435761) >>> 0);
    gl.uniform1i(update.u.uCap, cap ? 1 : 0);
    draw();
    pass(mask, b, a.fb);
    draw();
  }

  function runEdit(op, cx = 0, cy = 0, r = 0, rgb = [0, 0, 0]) {
    const a = sets[cur], b = sets[1 - cur];
    pass(edit, a, b.fb);
    gl.uniform1i(edit.u.uOp, op);
    gl.uniform2f(edit.u.uCentre, cx, cy);
    gl.uniform1f(edit.u.uRadius, r);
    gl.uniform3f(edit.u.uSeed, rgb[0], rgb[1], rgb[2]);
    draw();
    cur = 1 - cur;
  }

  function clear() {
    runEdit(3);
    takeSnapshot();
  }

  function takeSnapshot() {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sets[cur].fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, snap.fb);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  return {
    get width() {
      return W;
    },
    get height() {
      return H;
    },
    resize,
    step: stepOnce,
    clear,
    // Cells are (col, row), row 0 at the top; positions are in cell units.
    seed(col, row, rgb) {
      runEdit(2, Math.floor(col) + 0.5, Math.floor(row) + 0.5, 0, rgb);
    },
    erase(x, y, r) {
      runEdit(0, x, y, r);
    },
    keepDisc(x, y, r) {
      runEdit(1, x, y, r);
    },

    // Live cells, change since the last call (sum of |delta RGBA|), and the
    // live cells' centroid; plus per-block counts for picking a bite.
    stats() {
      const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
      gl.useProgram(stats.pr);
      gl.bindVertexArray(vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, statFb);
      gl.viewport(0, 0, bw, bh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sets[cur].texs[0]);
      gl.uniform1i(stats.u.uS0, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, snap.tex);
      gl.uniform1i(stats.u.uSnap, 1);
      gl.uniform2i(stats.u.uSize, W, H);
      gl.uniform1f(stats.u.uThr, threshold);
      draw();
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.FLOAT, statBuf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      takeSnapshot();
      let alive = 0, activity = 0, sx = 0, sy = 0;
      for (let i = 0; i < statBuf.length; i += 4) {
        alive += statBuf[i];
        activity += statBuf[i + 1];
        sx += statBuf[i + 2];
        sy += statBuf[i + 3];
      }
      return {
        alive,
        activity,
        cx: alive ? sx / alive : W / 2,
        cy: alive ? sy / alive : H / 2,
        blocks: statBuf,
        blockW: bw,
        block: BLOCK,
      };
    },

    // view: { cell, ox, oy } in device px; ring: [x, y, r] device px or null
    render(bufW, bufH, view, paper, ring, dpr) {
      gl.useProgram(render.pr);
      gl.bindVertexArray(vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, bufW, bufH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sets[cur].texs[0]);
      gl.uniform1i(render.u.uS0, 0);
      gl.uniform2i(render.u.uSize, W, H);
      gl.uniform2f(render.u.uRes, bufW, bufH);
      gl.uniform2f(render.u.uOrigin, view.ox, view.oy);
      gl.uniform1f(render.u.uCell, view.cell);
      gl.uniform3f(render.u.uPaper, paper[0], paper[1], paper[2]);
      gl.uniform3f(render.u.uRing, ring ? ring[0] : 0, ring ? ring[1] : 0, ring ? ring[2] : 0);
      gl.uniform1f(render.u.uDpr, dpr);
      draw();
    },

    // Debug/parity helpers: whole state as float32 (C, H, W), row 0 first.
    setState(chw) {
      const plane = W * H;
      const px = new Float32Array(plane * 4);
      unpackDefaults();
      for (let k = 0; k < N; k++) {
        for (let i = 0; i < plane; i++)
          for (let j = 0; j < 4; j++) px[i * 4 + j] = chw[(4 * k + j) * plane + i];
        gl.bindTexture(gl.TEXTURE_2D, sets[cur].texs[k]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, px);
      }
    },
    getState() {
      const plane = W * H;
      const out = new Float32Array(4 * N * plane);
      const px = new Float32Array(plane * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sets[cur].fb);
      for (let k = 0; k < N; k++) {
        gl.readBuffer(gl.COLOR_ATTACHMENT0 + k);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
        for (let i = 0; i < plane; i++)
          for (let j = 0; j < 4; j++) out[(4 * k + j) * plane + i] = px[i * 4 + j];
      }
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return out;
    },
  };
}
