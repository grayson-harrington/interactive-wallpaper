// WebGL2 drawing for Nested Orbits, done directly on p5's WEBGL context.
//
// Each sphere is one full-screen fragment pass: a ray from the camera hits the
// sphere, and the hit direction walks the containment tree (grid lookup for the
// top-level circle, then a scan of each circle's children) to find the
// innermost circle there. Circle data lives in float textures: static layout,
// plus a per-frame texture of centres from updatePose().
//
// Passes per frame: the wall into a half-resolution target (half of CSS
// pixels), upscaled to the screen; the ball on top at full device resolution; then, during a reseed, the
// frozen last frame of the old layout fading out.

import { TEX_W, GRID_CELL, GRID_NLAT, GRID_NAZ } from './layout.js';

export const EYE = 3.4; // camera distance from the ball's centre (ball radius 1)
export const FOCAL = 1.2; // ball spans ~74% of the screen's short side
export const WALL_RADIUS = 9;
const WALL_SCALE = 0.5; // of CSS pixels, whatever the screen's density
const WALL_DIM = 0.6;

const VERT = `#version 300 es
void main() {
  // one triangle that covers the viewport
  gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
}`;

const sceneFrag = (inside) => `#version 300 es
precision highp float;
precision highp int;
${inside ? '#define INSIDE' : ''}
uniform highp sampler2D uDyn;   // per circle: centre.xyz (sphere frame), cos(radius)
uniform highp sampler2D uStat;  // per circle, 2 texels: [centre, kidStart], [colour, kidCount]
uniform highp sampler2D uCells; // per grid cell: (start, count) into uItems
uniform highp sampler2D uItems; // top-level circle indices
uniform vec2 uRes;
uniform float uEye, uFocal, uRadius, uDim;
uniform mat3 uToLocal;          // world -> sphere frame
uniform vec3 uGap;
out vec4 frag;

const float PI = 3.14159265;
const float CELL = ${GRID_CELL.toFixed(6)};
const int NLAT = ${GRID_NLAT};
const int NAZ = ${GRID_NAZ};

ivec2 at(int i) { return ivec2(i & ${TEX_W - 1}, i >> ${Math.log2(TEX_W)}); }

int rootAt(vec3 q) {
  float lat = asin(clamp(q.z, -1.0, 1.0));
  float az = atan(q.y, q.x);
  int b = min(NLAT - 1, int((lat + 0.5 * PI) / CELL));
  int a = min(NAZ - 1, int((az + PI) / CELL));
  vec2 cell = texelFetch(uCells, at(b * NAZ + a), 0).xy;
  int end = int(cell.x) + int(cell.y);
  for (int k = int(cell.x); k < end; k++) {
    int i = int(texelFetch(uItems, at(k), 0).x);
    vec4 d = texelFetch(uDyn, at(i), 0);
    if (dot(q, d.xyz) > d.w) return i;
  }
  return -1;
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;
  vec3 ro = vec3(0.0, 0.0, uEye);
  vec3 rd = normalize(vec3(uv, -uFocal));
  float b = dot(ro, rd);
  float h = b * b - (uEye * uEye - uRadius * uRadius);
#ifdef INSIDE
  float t = -b + sqrt(max(h, 0.0)); // far hit: the inner wall around us
  float cov = 1.0;
#else
  float t = -b - sqrt(max(h, 0.0));
  float cov = smoothstep(0.0, fwidth(h) * 1.5 + 1e-6, h); // soft silhouette
#endif
  vec3 p = normalize(ro + t * rd);            // direction from the centre = point on the layout
  float pw = max(length(fwidth(p)), 1e-5);    // one pixel, as an angle on the layout
  if (cov <= 0.0) discard;

  // Walk down the nesting, feathering each circle's edge over about a pixel.
  vec3 q = uToLocal * p;
  vec3 col = uGap;
  int cur = rootAt(q);
  for (int depth = 0; depth < 32 && cur >= 0; depth++) {
    vec4 d = texelFetch(uDyn, at(cur), 0);
    vec4 s0 = texelFetch(uStat, at(2 * cur), 0);
    vec4 s1 = texelFetch(uStat, at(2 * cur + 1), 0);
    float inset = (dot(q, d.xyz) - d.w) / sqrt(max(1.0 - d.w * d.w, 1e-8)); // ~angle inside the edge
    col = mix(col, s1.rgb, clamp(inset / pw + 0.5, 0.0, 1.0));
    int next = -1;
    int end = int(s0.w) + int(s1.w);
    for (int j = int(s0.w); j < end; j++) {
      vec4 dj = texelFetch(uDyn, at(j), 0);
      if (dot(q, dj.xyz) > dj.w) { next = j; break; }
    }
    cur = next;
  }

  // Key light from the upper left, sky fill fading to dark below, faint rim.
#ifdef INSIDE
  vec3 n = -p;
#else
  vec3 n = p;
#endif
  vec3 L = normalize(vec3(-0.5, 0.55, 0.68));
  float hemi = smoothstep(-1.0, 0.7, p.y);
  vec3 amb = mix(vec3(0.03, 0.03, 0.04), vec3(0.40, 0.41, 0.44), hemi);
  float direct = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L - rd)), 0.0), 70.0) * 0.1;
#ifdef INSIDE
  // the ball's soft shadow on the wall
  vec3 P = p * uRadius;
  float along = dot(P, L);
  float sh = along < 0.0 ? mix(0.15, 1.0, smoothstep(0.7, 2.6, length(P - along * L))) : 1.0;
  direct *= sh;
  spec *= sh;
#endif
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.08 * hemi;
  frag = vec4((col * (amb + 0.5 * direct) + spec + fres) * uDim, cov);
}`;

const BLIT = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uAlpha;
out vec4 frag;
void main() { frag = vec4(texture(uTex, gl_FragCoord.xy / uRes).rgb, uAlpha); }`;

export function createRenderer(gl) {
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fragSrc, uniforms) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(pr, name);
    return { pr, u };
  }
  const SCENE_UNIFORMS = ['uDyn', 'uStat', 'uCells', 'uItems', 'uRes', 'uEye', 'uFocal',
    'uRadius', 'uDim', 'uToLocal', 'uGap'];
  const wallProg = program(sceneFrag(true), SCENE_UNIFORMS);
  const ballProg = program(sceneFrag(false), SCENE_UNIFORMS);
  const blitProg = program(BLIT, ['uTex', 'uRes', 'uAlpha']);
  const vao = gl.createVertexArray(); // empty: the vertex shader needs no attributes

  function texture(filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const FORMATS = { 1: [gl.R32F, gl.RED], 2: [gl.RG32F, gl.RG], 4: [gl.RGBA32F, gl.RGBA] };
  function unpackDefaults() {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }
  function dataTexture(data, comps) {
    const t = texture(gl.NEAREST);
    const [internal, format] = FORMATS[comps];
    unpackDefaults();
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, TEX_W, data.length / comps / TEX_W, 0, format, gl.FLOAT, data);
    return t;
  }

  // One entry per sphere: its textures and the layout they were built from.
  const layers = { ball: null, wall: null };

  function setLayout(which, L) {
    const old = layers[which];
    if (old) for (const t of old.tex) gl.deleteTexture(t);
    layers[which] = {
      L,
      tex: [dataTexture(L.dyn, 4), dataTexture(L.stat, 4), dataTexture(L.cells, 2), dataTexture(L.items, 1)],
    };
  }

  function uploadPose(which) {
    const { L, tex } = layers[which];
    gl.bindTexture(gl.TEXTURE_2D, tex[0]);
    unpackDefaults();
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEX_W, L.dyn.length / 4 / TEX_W, gl.RGBA, gl.FLOAT, L.dyn);
  }

  // Screen-sized targets: the half-res wall, and the frozen frame for crossfades.
  let w = 0, h = 0, ww = 0, wh = 0;
  let wallTex = null, wallFbo = null, snapTex = null;
  function resize(width, height, density) {
    w = width; h = height;
    ww = Math.max(1, Math.round((w / density) * WALL_SCALE));
    wh = Math.max(1, Math.round((h / density) * WALL_SCALE));
    if (wallTex) gl.deleteTexture(wallTex);
    if (snapTex) gl.deleteTexture(snapTex);
    if (wallFbo) gl.deleteFramebuffer(wallFbo);
    wallTex = texture(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ww, wh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    wallFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, wallFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, wallTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    snapTex = texture(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
  }

  const toLocal = new Float32Array(9);
  function drawSphere(prog, which, rot, radius, dim, resW, resH) {
    const { L, tex } = layers[which];
    const u = prog.u;
    gl.useProgram(prog.pr);
    tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
    });
    gl.uniform1i(u.uDyn, 0);
    gl.uniform1i(u.uStat, 1);
    gl.uniform1i(u.uCells, 2);
    gl.uniform1i(u.uItems, 3);
    gl.uniform2f(u.uRes, resW, resH);
    gl.uniform1f(u.uEye, EYE);
    gl.uniform1f(u.uFocal, FOCAL);
    gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uDim, dim);
    // rot is row-major sphere -> world; read as column-major it is its transpose, world -> sphere
    toLocal.set(rot);
    gl.uniformMatrix3fv(u.uToLocal, false, toLocal);
    gl.uniform3fv(u.uGap, L.gap);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function blit(tex, alpha) {
    gl.useProgram(blitProg.pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(blitProg.u.uTex, 0);
    gl.uniform2f(blitProg.u.uRes, w, h);
    gl.uniform1f(blitProg.u.uAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // fade: opacity of the frozen old frame over the new scene (0 = none).
  function draw(ballRot, wallRot, fade) {
    gl.bindVertexArray(vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true);

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, wallFbo);
    gl.viewport(0, 0, ww, wh);
    drawSphere(wallProg, 'wall', wallRot, WALL_RADIUS, WALL_DIM, ww, wh);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    blit(wallTex, 1);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    drawSphere(ballProg, 'ball', ballRot, 1, 1, w, h);
    if (fade > 0) blit(snapTex, fade);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // Copy what was just drawn, to fade out over the next layout.
  function snapshot() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, snapTex);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);
  }

  return { setLayout, uploadPose, resize, draw, snapshot };
}
