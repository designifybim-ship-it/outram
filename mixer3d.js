/* Outram 3D mixer: a tiny self-contained WebGL scene (no libraries).
   Drag to turn it, the drum spins, and the numbered parts follow the model. */
(() => {
const arts = [...document.querySelectorAll(".spot-art")];
if (!arts.length) return;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- small matrix kit (column-major 4x4) ---------- */
const M = {
  id: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; },
  t: (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
  persp(f, asp, n, fa) { const t = 1 / Math.tan(f / 2); return [t/asp,0,0,0, 0,t,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0]; },
  look(e, c, u) {
    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); }, cr = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const z = nrm(sub(e, c)), x = nrm(cr(u, z)), y = cr(z, x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1];
  },
  app(m, p) { const [x, y, z] = p; return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14], m[3]*x+m[7]*y+m[11]*z+m[15]]; },
};

/* ---------- geometry builders: arrays of [pos, normal, color] ---------- */
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
function Geo() { return { p: [], n: [], c: [] }; }
function tri(g, a, b, c, na, nb, nc, ca, cb, cc) { g.p.push(...a, ...b, ...c); g.n.push(...na, ...nb, ...nc); g.c.push(...ca, ...cb, ...cc); }
function quad(g, a, b, c, d, n, col) { tri(g, a, b, c, n, n, n, col, col, col); tri(g, a, c, d, n, n, n, col, col, col); }
function box(g, cx, cy, cz, w, h, d, col, m = null) {
  const x0 = -w/2, x1 = w/2, y0 = -h/2, y1 = h/2, z0 = -d/2, z1 = d/2;
  const F = [[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]], [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]], [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]], [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]], [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]], [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]]];
  const X = (v) => { let q = m ? M.app(m, v) : [...v, 1]; return [q[0] + cx, q[1] + cy, q[2] + cz]; };
  const N = (v) => { if (!m) return v; const q = M.app(m, v), o = M.app(m, [0,0,0]); return [q[0]-o[0], q[1]-o[1], q[2]-o[2]]; };
  for (const [a, b, c, d, n] of F) quad(g, X(a), X(b), X(c), X(d), N(n), col);
}
// surface of revolution around Y; colFn(theta, y) picks the colour per vertex
function lathe(g, prof, seg, colFn, xf = (p) => p, nf = (n) => n) {
  const pts = prof.map(([r, y], i) => { const a = prof[Math.max(0, i-1)], b = prof[Math.min(prof.length-1, i+1)]; const dy = b[1]-a[1], dr = b[0]-a[0]; const l = Math.hypot(dy, dr) || 1; return { r, y, nr: dy / l, ny: -dr / l }; });
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < seg; s++) {
    const t0 = s / seg * Math.PI * 2, t1 = (s + 1) / seg * Math.PI * 2, A = pts[i], B = pts[i+1];
    const P = (q, t) => xf([q.r * Math.cos(t), q.y, q.r * Math.sin(t)]), Nn = (q, t) => nf([q.nr * Math.cos(t), q.ny, q.nr * Math.sin(t)]), C = (q, t) => colFn(t, q.y);
    tri(g, P(A,t0), P(B,t0), P(B,t1), Nn(A,t0), Nn(B,t0), Nn(B,t1), C(A,t0), C(B,t0), C(B,t1));
    tri(g, P(A,t0), P(B,t1), P(A,t1), Nn(A,t0), Nn(B,t1), Nn(A,t1), C(A,t0), C(B,t1), C(A,t1));
  }
}
function torus(g, R, r, seg, side, col, m) {
  for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) {
    const v = (a, b) => [(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)];
    const nn = (a, b) => [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)];
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, b0 = j / side * Math.PI * 2, b1 = (j + 1) / side * Math.PI * 2;
    const X = (p) => { const q = M.app(m, p); return [q[0], q[1], q[2]]; }, N = (n) => { const q = M.app(m, n), o = M.app(m, [0,0,0]); return [q[0]-o[0], q[1]-o[1], q[2]-o[2]]; };
    tri(g, X(v(a0,b0)), X(v(a1,b0)), X(v(a1,b1)), N(nn(a0,b0)), N(nn(a1,b0)), N(nn(a1,b1)), col, col, col);
    tri(g, X(v(a0,b0)), X(v(a1,b1)), X(v(a0,b1)), N(nn(a0,b0)), N(nn(a1,b1)), N(nn(a0,b1)), col, col, col);
  }
}
const cyl = (g, r, h, col, m, seg = 24) => lathe(g, [[0, -h/2], [r, -h/2], [r, -h/2], [r, h/2], [r, h/2], [0, h/2]], seg, () => col, (p) => { const q = M.app(m, p); return [q[0], q[1], q[2]]; }, (n) => { const q = M.app(m, n), o = M.app(m, [0,0,0]); return [q[0]-o[0], q[1]-o[1], q[2]-o[2]]; });

/* ---------- the mixer ---------- */
const BLACK = hex(0x1a1a1a), DARK = hex(0x2c2c2c), GREY = hex(0x555555), YEL = hex(0xffc000), GOLD = hex(0xe19d1e), TYRE = hex(0x161616), INSIDE = hex(0x0d0d0d);
function buildFrame() {
  const g = Geo();
  box(g, 0.15, 0.62, 0, 2.9, 0.16, 0.56, DARK);                       // chassis
  box(g, -1.75, 0.58, 0, 1.4, 0.1, 0.1, DARK);                        // tow bar
  torus(g, 0.13, 0.04, 20, 8, DARK, M.mul(M.t(-2.5, 0.58, 0), M.id())); // hitch ring
  for (const z of [-0.47, 0.47]) {                                    // wheels
    const m = M.mul(M.t(-0.45, 0.42, z), M.rx(Math.PI / 2));
    torus(g, 0.3, 0.13, 30, 12, TYRE, m);
    cyl(g, 0.19, 0.16, GREY, m);
    cyl(g, 0.08, 0.2, YEL, m);
  }
  cyl(g, 0.05, 1.0, DARK, M.mul(M.t(-0.45, 0.42, 0), M.rx(Math.PI / 2)));   // axle
  box(g, 0.25, 0.44, 0.0, 0.12, 0.32, 0.12, DARK);                          // stand leg
  // A-frame yoke holding the drum
  for (const z of [-0.6, 0.6]) { box(g, -0.05, 1.12, z, 0.14, 1.0, 0.1, BLACK, M.rz(0.25)); box(g, 0.35, 1.12, z, 0.14, 1.0, 0.1, BLACK, M.rz(-0.25)); }
  // engine housing with yellow vents, exhaust and fuel cap
  box(g, 1.18, 1.05, 0, 0.82, 0.7, 0.66, BLACK);
  for (const y of [0.92, 1.04, 1.16]) { box(g, 1.18, y, 0.335, 0.6, 0.05, 0.01, YEL); box(g, 1.18, y, -0.335, 0.6, 0.05, 0.01, YEL); }
  cyl(g, 0.045, 0.42, DARK, M.t(1.42, 1.58, -0.18));
  cyl(g, 0.07, 0.06, GREY, M.t(1.42, 1.8, -0.18));
  cyl(g, 0.07, 0.09, YEL, M.t(1.0, 1.44, 0.15));
  return g;
}
function buildDrum() {
  const g = Geo();
  const base = [[0.0,-1.02],[0.3,-1.0],[0.62,-0.86],[0.8,-0.6],[0.84,-0.2],[0.82,0.25],[0.7,0.62],[0.52,0.92],[0.4,1.08],[0.4,1.12]];
  const rAt = (y) => { for (let i = 0; i < base.length - 1; i++) { const [r0, y0] = base[i], [r1, y1] = base[i+1]; if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); } return base[base.length-1][0]; };
  const bands = [[-0.62, -0.5], [-0.05, 0.07], [0.5, 0.6]];       // crisp black hoops, like the logo's mixer
  const ys = new Set(); for (let y = -1.02; y <= 1.12; y += 0.04) ys.add(+y.toFixed(3)); bands.forEach(([a, b]) => { ys.add(a); ys.add(a + 0.0005); ys.add(b); ys.add(b - 0.0005); }); ys.add(1.12);
  const ysorted = [...ys].sort((a, b) => a - b), prof = ysorted.map((y) => [rAt(y), y]);
  const inBand = (y) => bands.some(([a, b]) => y > a + 0.0002 && y < b - 0.0002);
  lathe(g, prof, 72, (t, y) => inBand(y) ? BLACK : y > 0.72 ? GOLD : YEL);
  // two weld seams make the drum's turning visible
  for (const a of [0, Math.PI]) { const m = M.ry(a); box(g, 0, 0.25, 0.835, 0.03, 0.5, 0.02, DARK, M.mul(m, M.id())); }
  torus(g, 0.4, 0.05, 40, 10, BLACK, M.t(0, 1.12, 0));                // mouth rim
  lathe(g, [[0.36, 1.08], [0.0, 0.95]], 40, () => INSIDE);             // dark inside
  torus(g, 0.855, 0.075, 64, 10, DARK, M.t(0, -0.3, 0));              // ring gear
  return g;
}

/* ---------- WebGL ---------- */
const VS = `attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 uM,uVP;varying vec3 vN,vC,vW;void main(){vec4 w=uM*vec4(p,1.);vW=w.xyz;vN=mat3(uM)*n;vC=c;gl_Position=uVP*w;}`;
const FS = `precision mediump float;varying vec3 vN,vC,vW;uniform vec3 uEye;void main(){vec3 N=normalize(vN);vec3 L=normalize(vec3(.55,.9,.6));vec3 L2=normalize(vec3(-.7,.3,-.5));vec3 V=normalize(uEye-vW);float d=max(dot(N,L),0.);float d2=max(dot(N,L2),0.)*.35;float hemi=.5+.5*N.y;vec3 H=normalize(L+V);float sp=pow(max(dot(N,H),0.),48.)*.55;float rim=pow(1.-max(dot(N,V),0.),3.)*.25;vec3 col=vC*(.28+.22*hemi+.85*d+d2)+vec3(sp)+vec3(1.,.85,.5)*rim;gl_FragColor=vec4(pow(col,vec3(.95)),1.);}`;
const SVS = `attribute vec2 q;uniform mat4 uVP;varying vec2 v;void main(){v=q;gl_Position=uVP*vec4(q.x*2.5+.1,0.,q.y*1.15,1.);}`;
const SFS = `precision mediump float;varying vec2 v;void main(){float a=smoothstep(1.,0.,length(v));gl_FragColor=vec4(.24,.18,.04,a*a*.38);}`;

function setup(art) {
  const cv = document.createElement("canvas"); cv.className = "m3d"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "3D model of a two-bag diesel concrete mixer. Drag to turn it.");
  const gl = cv.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return;
  const prog = (vs, fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
  let P, S;
  try { P = prog(VS, FS); S = prog(SVS, SFS); } catch (e) { return; }
  const upload = (g) => { const b = (arr) => { const x = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, x); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return x; }; return { p: b(g.p), n: b(g.n), c: b(g.c), count: g.p.length / 3 }; };
  const frame = upload(buildFrame()), drum = upload(buildDrum());
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
  const loc = { p: gl.getAttribLocation(P, "p"), n: gl.getAttribLocation(P, "n"), c: gl.getAttribLocation(P, "c"), uM: gl.getUniformLocation(P, "uM"), uVP: gl.getUniformLocation(P, "uVP"), uEye: gl.getUniformLocation(P, "uEye"), q: gl.getAttribLocation(S, "q"), sVP: gl.getUniformLocation(S, "uVP") };

  art.prepend(cv); art.classList.add("is3d");
  const hint = document.createElement("span"); hint.className = "m3d-hint"; hint.textContent = "Drag to turn"; art.appendChild(hint);

  const DRUM_AT = M.mul(M.t(0.15, 1.62, 0), M.rz(0.95));   // drum tilted, mouth up and toward the tow bar
  const parts = [ // hotspot anchors in model space and the view angle that shows them best
    { p: [0.15 + Math.sin(-0.95) * -0.05, 1.62 + 0.86, 0.0], yaw: 0.35, at: "drum" },
    { p: [1.18, 1.05, 0.34], yaw: -0.55 },
    { p: [-2.5, 0.58, 0], yaw: 0.9 },
    { p: [1.0, 1.5, 0.15], yaw: -0.25 },
  ];
  // anchor 1 sits on the drum's upper flank
  parts[0].p = (() => { const q = M.app(DRUM_AT, [0.84, 0.0, 0.3]); return [q[0], q[1], q[2]]; })();

  let yaw = 0.5, pitch = 0.32, tYaw = yaw, spin = 0, dragging = false, lastX = 0, lastY = 0, idle = 0, visible = false, raf = 0, W = 0, H = 0;
  const hs = [...art.querySelectorAll(".hs")];
  const size = () => { const r = art.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); };
  const ro = new ResizeObserver(() => { size(); draw(); }); ro.observe(art);

  function draw() {
    if (!W || !H) return;
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const dist = W < 520 ? 7.4 : 6.3, tgt = [-0.1, 1.05, 0];
    const eye = [tgt[0] + dist * Math.cos(pitch) * Math.sin(yaw), tgt[1] + dist * Math.sin(pitch), tgt[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
    const VP = M.mul(M.persp(0.62, W / H, 0.1, 50), M.look(eye, tgt, [0, 1, 0]));
    // soft ground shadow
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(S); gl.uniformMatrix4fv(loc.sVP, false, VP); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(loc.q); gl.vertexAttribPointer(loc.q, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(loc.q);
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
    gl.useProgram(P); gl.uniformMatrix4fv(loc.uVP, false, VP); gl.uniform3fv(loc.uEye, eye);
    const drawMesh = (m, mdl) => { gl.uniformMatrix4fv(loc.uM, false, mdl); for (const k of ["p", "n", "c"]) { gl.bindBuffer(gl.ARRAY_BUFFER, m[k]); gl.enableVertexAttribArray(loc[k]); gl.vertexAttribPointer(loc[k], 3, gl.FLOAT, false, 0, 0); } gl.drawArrays(gl.TRIANGLES, 0, m.count); };
    drawMesh(frame, M.id());
    drawMesh(drum, M.mul(DRUM_AT, M.ry(spin)));
    // move the numbered buttons with the model; fade those turned away
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
    hs.forEach((b, i) => { const pt = parts[i]; if (!pt) return; const q = M.app(VP, pt.p); const x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (-q[1] / q[3] * 0.5 + 0.5) * H; b.style.left = x + "px"; b.style.top = y + "px"; const facing = (pt.p[0] + 0.1) * fwd[0] + pt.p[2] * fwd[2]; b.classList.toggle("back", facing < -0.9); });
  }
  function loop() {
    raf = 0; if (!visible) return;
    if (!dragging) { idle++; if (idle > 90 && !reduced) tYaw += 0.0025; yaw += (tYaw - yaw) * 0.08; }
    if (!reduced) spin += 0.02;
    draw(); raf = requestAnimationFrame(loop);
  }
  const go = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; go(); }, { rootMargin: "100px" }).observe(art);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden && art.getBoundingClientRect().bottom > 0; go(); });

  cv.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; cv.setPointerCapture(e.pointerId); art.classList.add("grab"); hint.classList.add("gone"); });
  cv.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; yaw -= dx * 0.01; tYaw = yaw; pitch = Math.max(0.05, Math.min(1.0, pitch + dy * 0.006)); idle = 0; if (reduced) draw(); });
  const up = () => { dragging = false; idle = 0; art.classList.remove("grab"); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  // clicking a numbered part (on the model or in the list) turns the mixer to show it
  art.closest(".spot")?.querySelectorAll("[data-hs]").forEach((el) => el.addEventListener("click", () => { const p = parts[+el.dataset.hs]; if (!p) return; let t = p.yaw; while (t - yaw > Math.PI) t -= Math.PI * 2; while (yaw - t > Math.PI) t += Math.PI * 2; tYaw = t; idle = -240; if (reduced) { yaw = t; draw(); } }));
  size(); draw();
}
arts.forEach((a) => { try { setup(a); } catch (e) { /* keep the flat drawing */ } });
})();
