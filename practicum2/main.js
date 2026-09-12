/*
Practical Work in Computer Graphics - Lesson 2
WebGL Primitive Playground (WebGL2 best practice)

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

Covers (modul + pengayaan, all challenges):
- Main: multi-primitive playground, colored primitives, animation, interaction
- A: Primitive Selector | B: Color Control | C: Spawn Primitive
- D: Multiple Moving Objects | E: Procedural Pattern | F: Simple HUD
- Pengayaan: toggle, mouse NDC, procedural, different uniforms per draw
*/

var PALETTE_HEX = ["#4DF3FF", "#6BE4D2", "#76A8FF", "#70B2E6", "#D9E6F2"];

function hexToRgb(hex) {
  var h = hex.replace("#", "");
  return [
    parseInt(h.substr(0, 2), 16) / 255,
    parseInt(h.substr(2, 2), 16) / 255,
    parseInt(h.substr(4, 2), 16) / 255
  ];
}
var PALETTE_RGB = PALETTE_HEX.map(hexToRgb);

function row(k, v) {
  return "<div class='data-line'><span>" + k + "</span><b>" + v + "</b></div>";
}

function getShaderSource(id) {
  var el = document.getElementById(id);
  if (!el) throw new Error("Shader '" + id + "' missing.");
  return el.textContent.trim();
}

function createShader(gl, type, source) {
  var s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    var info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("Shader compile failed:\n" + info);
  }
  return s;
}

function createProgram(gl, vs, fs) {
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    var info = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error("Program link failed:\n" + info);
  }
  return p;
}

// Boilerplate per canvas: context + program + attribute/uniform locations.
function initGL(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    canvas.parentNode.innerHTML = "<p style='padding:20px;color:#A9BFD3'>WebGL2 not available.</p>";
    return null;
  }
  var vs = createShader(gl, gl.VERTEX_SHADER, getShaderSource("vertex-shader"));
  var fs = createShader(gl, gl.FRAGMENT_SHADER, getShaderSource("fragment-shader"));
  var program = createProgram(gl, vs, fs);
  gl.useProgram(program);

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var vbo = gl.createBuffer();

  var loc = {
    canvas: canvas, gl: gl, program: program, vao: vao, vbo: vbo,
    a_position: gl.getAttribLocation(program, "a_position"),
    a_color: gl.getAttribLocation(program, "a_color"),
    u_time: gl.getUniformLocation(program, "u_time"),
    u_offset: gl.getUniformLocation(program, "u_offset"),
    u_pointSize: gl.getUniformLocation(program, "u_pointSize"),
    u_waveAmount: gl.getUniformLocation(program, "u_waveAmount"),
    u_brightness: gl.getUniformLocation(program, "u_brightness"),
    u_globalBrightness: gl.getUniformLocation(program, "u_globalBrightness")
  };
  return loc;
}

// 5 floats × 4 bytes = 20. Named once, used everywhere.
var STRIDE = 5 * Float32Array.BYTES_PER_ELEMENT;

function setupInterleaved(st, vertices, usage, vao, vbo) {
  var gl = st.gl;
  gl.bindVertexArray(vao || st.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo || st.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, usage || gl.STATIC_DRAW);
  gl.enableVertexAttribArray(st.a_position);
  gl.vertexAttribPointer(st.a_position, 2, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(st.a_color);
  gl.vertexAttribPointer(st.a_color, 3, gl.FLOAT, false, STRIDE, 2 * Float32Array.BYTES_PER_ELEMENT);
}

function setUniforms(st, time, ox, oy, pointSize, wave, bright, globalBright) {
  var gl = st.gl;
  gl.uniform1f(st.u_time, time);
  gl.uniform2f(st.u_offset, ox, oy);
  gl.uniform1f(st.u_pointSize, pointSize);
  gl.uniform1f(st.u_waveAmount, wave);
  gl.uniform1f(st.u_brightness, bright);
  gl.uniform1f(st.u_globalBrightness, globalBright);
}

function pixelToNdc(canvas, e) {
  var r = canvas.getBoundingClientRect();
  var x = e.clientX - r.left, y = e.clientY - r.top;
  return { x: (x / r.width) * 2 - 1, y: 1 - (y / r.height) * 2 };
}

// Shared render preamble: viewport + clear + grid + bind program/VAO.
function beginFrame(st, grid) {
  var gl = st.gl, c = st.canvas;
  gl.viewport(0, 0, c.width, c.height);
  gl.clearColor(0.03, 0.05, 0.10, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  drawGrid(st, grid);
  gl.useProgram(st.program); gl.bindVertexArray(st.vao);
}

// Background grid (32px lines, brighter edge axes), drawn first
// and dim so it never competes with the material.
function makeGrid(st) {
  var gl = st.gl, W = st.canvas.width, H = st.canvas.height;
  var dim = [0.16, 0.30, 0.38], ax = [0.30, 0.95, 1.0], pts = [], x, y;
  // Even tiling (~32px) so lines land exactly on every edge, any canvas size.
  var stepX = W / Math.max(1, Math.round(W / 32)), stepY = H / Math.max(1, Math.round(H / 32));
  for (x = 0; x <= W + 0.001; x += stepX) {
    var nx = x / W * 2 - 1;
    pts.push(nx, -1, dim[0], dim[1], dim[2], nx, 1, dim[0], dim[1], dim[2]);
  }
  for (y = 0; y <= H + 0.001; y += stepY) {
    var ny = 1 - y / H * 2;
    pts.push(-1, ny, dim[0], dim[1], dim[2], 1, ny, dim[0], dim[1], dim[2]);
  }
  // Edge axes at viewport boundary (NDC ±1) — bright axes overlap the dim
  // edge grid lines so the grid reads as full-bleed. No inset: the eye
  // would otherwise read the bright axes as an inner box.
  var ex = 1, ey = 1;
  pts.push(-ex, -ey, ax[0], ax[1], ax[2], ex, -ey, ax[0], ax[1], ax[2]);
  pts.push(-ex, -ey, ax[0], ax[1], ax[2], -ex, ey, ax[0], ax[1], ax[2]);
  var vao = gl.createVertexArray(), vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
  var stride = 5 * Float32Array.BYTES_PER_ELEMENT;
  gl.enableVertexAttribArray(st.a_position);
  gl.vertexAttribPointer(st.a_position, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(st.a_color);
  gl.vertexAttribPointer(st.a_color, 3, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
  gl.bindVertexArray(st.vao);
  return { vao: vao, vbo: vbo, count: pts.length / 5 };
}

function drawGrid(st, grid) {
  var gl = st.gl;
  gl.bindVertexArray(grid.vao);
  setUniforms(st, 0, 0, 0, 1.0, 0.0, 0.55, 1.0);
  gl.drawArrays(gl.LINES, 0, grid.count);
  gl.bindVertexArray(st.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
}

// NDC ruler numbers as DOM overlay (text via WebGL).
function addRulers(wrap, W, H) {
  var i, s;
  function label(v) { return v === 0 ? "0" : v.toFixed(1); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  var left = document.createElement("div");
  left.className = "gl-ruler-left";
  var ys = [-0.5, 0, 0.5, 1];
  for (i = 0; i < ys.length; i++) {
    s = document.createElement("span");
    s.style.top = clamp((1 - (ys[i] + 1) / 2) * H / (H - 15) * 100, 5, 95).toFixed(2) + "%";
    s.textContent = label(ys[i]);
    left.appendChild(s);
  }
  var bot = document.createElement("div");
  bot.className = "gl-ruler-bottom";
  var xs = [-0.5, 0, 0.5, 1];
  for (i = 0; i < xs.length; i++) {
    var raw = (xs[i] + 1) / 2 * 100;
    s = document.createElement("span");
    s.style.left = clamp(raw, 4, 96).toFixed(2) + "%";
    if (raw > 96) s.style.transform = "translate(-100%,-50%)";
    s.textContent = label(xs[i]);
    bot.appendChild(s);
  }
  // Single corner label: -1.0 lives only here, anchored hard left.
  var corner = document.createElement("span");
  corner.style.left = "0%";
  corner.style.transform = "translate(0,-50%)";
  corner.textContent = "-1.0";
  bot.appendChild(corner);
  wrap.appendChild(left);
  wrap.appendChild(bot);
}

// ============================================================
// MAIN — full playground (800x500)
// ============================================================
(function () {
  var st = initGL("glMain");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas;
  var CY = PALETTE_RGB[0], MT = PALETTE_RGB[1], BL = PALETTE_RGB[2], SK = PALETTE_RGB[3], WH = PALETTE_RGB[4];

  var vertices = new Float32Array([
    // Tri 1 (0-2) cyan
    -0.92, -0.65, CY[0], CY[1], CY[2],
    -0.55, -0.65, CY[0], CY[1], CY[2],
    -0.74, -0.20, CY[0], CY[1], CY[2],
    // Tri 2 (3-5) mint
    -0.22, -0.65, MT[0], MT[1], MT[2],
     0.22, -0.65, MT[0], MT[1], MT[2],
     0.00, -0.20, MT[0], MT[1], MT[2],
    // Tri 3 (6-8) blue
     0.55, -0.65, BL[0], BL[1], BL[2],
     0.92, -0.65, BL[0], BL[1], BL[2],
     0.74, -0.20, BL[0], BL[1], BL[2],
    // Points (9-11) lifted to y=0.32 so they clear
    // TRIANGLE_STRIP (top y=0.12) and TRIANGLE_FAN (top y=0.14).
    -0.62,  0.32, CY[0], CY[1], CY[2],
     0.00,  0.32, WH[0], WH[1], WH[2],
     0.62,  0.32, SK[0], SK[1], SK[2],
    // LINES (12-15)
    -0.86,  0.50, WH[0], WH[1], WH[2],
    -0.28,  0.50, WH[0], WH[1], WH[2],
     0.28,  0.50, MT[0], MT[1], MT[2],
     0.86,  0.50, MT[0], MT[1], MT[2],
    // LINE_STRIP (16-19)
    -0.86,  0.72, BL[0], BL[1], BL[2],
    -0.58,  0.86, BL[0], BL[1], BL[2],
    -0.30,  0.72, BL[0], BL[1], BL[2],
    -0.02,  0.86, BL[0], BL[1], BL[2],
    // LINE_LOOP (20-23)
     0.18,  0.68, SK[0], SK[1], SK[2],
     0.42,  0.68, SK[0], SK[1], SK[2],
     0.42,  0.88, SK[0], SK[1], SK[2],
     0.18,  0.88, SK[0], SK[1], SK[2],
    // TRIANGLE_STRIP (24-27)
    -0.92, -0.02, MT[0], MT[1], MT[2],
    -0.62, -0.02, MT[0], MT[1], MT[2],
    -0.92,  0.12, MT[0], MT[1], MT[2],
    -0.62,  0.12, MT[0], MT[1], MT[2],
    // TRIANGLE_FAN (28-32)
     0.70,  0.04, CY[0], CY[1], CY[2],
     0.56, -0.10, SK[0], SK[1], SK[2],
     0.84, -0.10, SK[0], SK[1], SK[2],
     0.90,  0.14, SK[0], SK[1], SK[2],
     0.50,  0.14, SK[0], SK[1], SK[2]
  ]);
  setupInterleaved(st, vertices, gl.STATIC_DRAW);
  recolorMover([[1,0,0], [0,1,0], [0,0,1]]);
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);

  // User drawing buffers (own VAO; static VBO above stays intact).
  // Radio tool: triangles | points | lines. Click draws the active tool
  // with the active swatch; RGB swatch draws red-green-blue.
  var userVao = gl.createVertexArray();
  var userVbo = gl.createBuffer();
  var userTris = [];   // flat [x,y,r,g,b ...] 3 verts per triangle
  var userPts = [];    // flat, 1 vert per point
  var userLines = [];  // flat, 2 verts per line
  var dragA = null, dragB = null, dragging = false;
  var rgbCycle = 0;

  function equiTri(cx, cy, r, cols) {
    var a0 = Math.PI / 2, a1 = Math.PI * 7 / 6, a2 = Math.PI * 11 / 6;
    return [
      cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cols[0][0], cols[0][1], cols[0][2],
      cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cols[1][0], cols[1][1], cols[1][2],
      cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, cols[2][0], cols[2][1], cols[2][2]
    ];
  }

  // Dashed segment helper (dashes are built as small LINES pieces).
  function dashedEdge(ax, ay, bx, by, c, parts) {
    var out = [], i, t0, t1;
    for (i = 0; i < parts; i += 2) {
      t0 = i / parts; t1 = (i + 1) / parts;
      out.push(
        ax + (bx - ax) * t0, ay + (by - ay) * t0, c[0], c[1], c[2],
        ax + (bx - ax) * t1, ay + (by - ay) * t1, c[0], c[1], c[2]
      );
    }
    return out;
  }

  function capArr(arr, maxVerts) {
    while (arr.length > maxVerts * 5) arr.splice(0, 5);
  }

  function commitDrag(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.hypot(dx, dy);
    if (activeTool === "triangles") {
      var cols = nextDrawColors(3);
      if (dist < 0.02) {
        capArr(userTris, 90); userTris.push.apply(userTris, equiTri(b.x, b.y, 0.09, cols));
      } else {
        var r = Math.max(0.05, Math.min(0.9, dist / 2));
        capArr(userTris, 90);
        userTris.push.apply(userTris, equiTri((a.x + b.x) / 2, (a.y + b.y) / 2, r, cols));
      }
    } else if (activeTool === "points") {
      var cp = nextDrawColors(1)[0];
      capArr(userPts, 40); userPts.push(b.x, b.y, cp[0], cp[1], cp[2]);
    } else {
      var c1 = nextDrawColors(1)[0], c2 = nextDrawColors(1)[0];
      if (dist < 0.02) {
        var h = 0.09;
        capArr(userLines, 40);
        userLines.push(b.x - h, b.y, c1[0], c1[1], c1[2], b.x + h, b.y, c2[0], c2[1], c2[2]);
      } else {
        capArr(userLines, 40);
        userLines.push(a.x, a.y, c1[0], c1[1], c1[2], b.x, b.y, c2[0], c2[1], c2[2]);
      }
    }
  }

  var keys = {}, offsetX = 0, offsetY = 0, paused = false;
  var activeTool = "triangles", drawColorIdx = 0, rgbMode = false;
  var startTime = performance.now(), pauseTime = 0, frame = 0, fps = 0, lastFpsT = performance.now();
  var mouseNdc = { x: 0, y: 0 };
  // 3 bouncing triangles (own offsets/velocities, NDC bounce).
  var movers = [
    { bx: 0, by: 0, vx: 0.004, vy: 0.003 },
    { bx: 0, by: 0, vx: -0.005, vy: 0.004 },
    { bx: 0, by: 0, vx: 0.003, vy: -0.005 }
  ];

  var brightEl = document.getElementById("mainBrightness"),
      speedEl = document.getElementById("mainSpeed"),
      waveEl = document.getElementById("mainWave");
  var hud = document.getElementById("mainHud"), dataEl = document.getElementById("mainData");

  function bindSlider(el, label) {
    var out = document.getElementById(label);
    el.addEventListener("input", function () { out.textContent = Number(el.value).toFixed(2); });
  }
  bindSlider(brightEl, "mainBrightnessVal");
  bindSlider(speedEl, "mainSpeedVal");
  bindSlider(waveEl, "mainWaveVal");

  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    keys[e.key] = true; keys[k] = true;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].indexOf(e.key) >= 0) e.preventDefault();
    if (k === "r" && !e.repeat) { offsetX = 0; offsetY = 0; }
    if ((e.key === " " || k === "p") && !e.repeat) togglePause();
    if (k === "c" && !e.repeat) randomizePoints();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  function togglePause() {
    paused = !paused;
    document.getElementById("mainPause").textContent = paused ? "Resume" : "Pause";
    if (paused) pauseTime = performance.now();
    else startTime += performance.now() - pauseTime;
  }
  document.getElementById("mainPause").addEventListener("click", togglePause);
  document.getElementById("mainReset").addEventListener("click", function () {
    offsetX = 0; offsetY = 0;
    userTris.length = 0; userPts.length = 0; userLines.length = 0;
    dragA = null; dragB = null; dragging = false;
  });
  document.getElementById("mainRandom").addEventListener("click", randomizePoints);

  // Radio draw tool: exactly one of triangles/points/lines.
  function setTool(name) {
    activeTool = name;
    document.getElementById("tglTri").classList.toggle("active", name === "triangles");
    document.getElementById("tglPts").classList.toggle("active", name === "points");
    document.getElementById("tglLines").classList.toggle("active", name === "lines");
    dragA = null; dragB = null; dragging = false;
  }
  document.getElementById("tglTri").addEventListener("click", function () { setTool("triangles"); });
  document.getElementById("tglPts").addEventListener("click", function () { setTool("points"); });
  document.getElementById("tglLines").addEventListener("click", function () { setTool("lines"); });

  document.querySelectorAll("[data-mcolor]").forEach(function (s) {
    s.addEventListener("click", function () {
      var v = s.getAttribute("data-mcolor");
      document.querySelectorAll("[data-mcolor]").forEach(function (x) { x.classList.toggle("active", x === s); });
      if (v === "rgb") {
        rgbMode = true;
      } else {
        rgbMode = false;
        drawColorIdx = +v;
      }
    });
  });

  var RGB_TRI = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function nextDrawColors(n) {
    if (!rgbMode) {
      var c = PALETTE_RGB[drawColorIdx];
      var out = [];
      for (var i = 0; i < n; i++) out.push(c);
      return out;
    }
    var cols = [];
    for (var j = 0; j < n; j++) { cols.push(RGB_TRI[(rgbCycle + j) % 3]); }
    rgbCycle = (rgbCycle + (n === 1 ? 1 : 0)) % 3;
    return cols;
  }

  function recolorPoints(c) {
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    // Rewrite color of verts 9,10,11 in the interleaved array.
    for (var i = 0; i < 3; i++) {
      var base = (9 + i) * 5;
      vertices[base + 2] = c[0]; vertices[base + 3] = c[1]; vertices[base + 4] = c[2];
    }
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }
  function recolorMover(cols) {
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    for (var i = 0; i < 3; i++) {
      var base = (3 + i) * 5;
      vertices[base + 2] = cols[i][0]; vertices[base + 3] = cols[i][1]; vertices[base + 4] = cols[i][2];
    }
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }
  function randomizePoints() {
    var c = [Math.random() * 0.6 + 0.4, Math.random() * 0.6 + 0.4, Math.random() * 0.6 + 0.4];
    recolorPoints(c);
  }

  // Drag to draw: down stores start, up commits.
  // Ghost preview follows the mouse until release.
  canvas.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragA = pixelToNdc(canvas, e);
    dragB = { x: dragA.x, y: dragA.y };
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener("pointermove", function (e) {
    mouseNdc = pixelToNdc(canvas, e);
    if (dragging && e.buttons) dragB = pixelToNdc(canvas, e);
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!dragging || !dragA) return;
    commitDrag(dragA, pixelToNdc(canvas, e));
    dragA = null; dragB = null; dragging = false;
  });
  canvas.addEventListener("pointercancel", function () {
    dragA = null; dragB = null; dragging = false;
  });

  function updateKeyboard() {
    var sp = Number(speedEl.value);
    var ms = 0.012 * sp;
    if (keys.ArrowLeft || keys.a) offsetX -= ms;
    if (keys.ArrowRight || keys.d) offsetX += ms;
    if (keys.ArrowUp || keys.w) offsetY += ms;
    if (keys.ArrowDown || keys.s) offsetY -= ms;
    offsetX = Math.max(-0.78, Math.min(0.78, offsetX));
    offsetY = Math.max(-0.35, Math.min(1.20, offsetY));
  }

  function updateMovers() {
    for (var i = 0; i < 3; i++) {
      if (i === 1) continue;
      var m = movers[i];
      m.bx += m.vx * Number(speedEl.value);
      m.by += m.vy * Number(speedEl.value);
      if (m.bx > 0.06 || m.bx < -0.06) m.vx = -m.vx;
      if (m.by > 0.06 || m.by < -0.06) m.vy = -m.vy;
    }
  }

  function drawUser(time, gb) {
    var triN = userTris.length / 5, ptN = userPts.length / 5, liN = userLines.length / 5;
    var off = 0, i, n;
    if (triN + ptN + liN) {
      setupInterleaved(st, new Float32Array(userTris.concat(userPts).concat(userLines)), gl.DYNAMIC_DRAW, userVao, userVbo);
    // User triangles: dim fill + bright outline.
    n = triN / 3;
    for (i = 0; i < n; i++) {
      setUniforms(st, time, 0, 0, 1.0, 0.0, 1.0, gb);
      gl.drawArrays(gl.TRIANGLES, off + i * 3, 3);
      setUniforms(st, time, 0, 0, 1.0, 0.0, 1.55, gb);
      gl.drawArrays(gl.LINE_LOOP, off + i * 3, 3);
    }
    off += triN;
    if (ptN) {
      setUniforms(st, time, 0, 0, 18.0, 0.0, 1.2, gb);
      gl.drawArrays(gl.POINTS, off, ptN);
      off += ptN;
    }
    if (liN) {
      setUniforms(st, time, 0, 0, 1.0, 0.0, 1.2, gb);
      gl.drawArrays(gl.LINES, off, liN);
      off += liN;
    }
    }
    // Ghost preview while dragging
    if (dragging && dragA && dragB) {
      var GHOST_C = PALETTE_RGB[0];
      var dx = dragB.x - dragA.x, dy = dragB.y - dragA.y;
      var dist = Math.hypot(dx, dy);
      var ghost = null, gmode = gl.POINTS, gsize = 14.0;
      var edgeParts = function (ax, ay, bx, by) {
        var ex = (bx - ax) * canvas.width / 2, ey = (by - ay) * canvas.height / 2;
        var px = Math.hypot(ex, ey);
        var parts = Math.max(6, Math.round(px / 5));
        if (parts % 2) parts++;
        return parts;
      };
      if (activeTool === "lines" && dist >= 0.02) {
        ghost = dashedEdge(dragA.x, dragA.y, dragB.x, dragB.y, GHOST_C, edgeParts(dragA.x, dragA.y, dragB.x, dragB.y));
        gmode = gl.LINES; gsize = 1.0;
      } else if (activeTool === "triangles" && dist >= 0.02) {
        var gr = Math.max(0.05, Math.min(0.9, dist / 2));
        var mcx = (dragA.x + dragB.x) / 2, mcy = (dragA.y + dragB.y) / 2;
        var tri = equiTri(mcx, mcy, gr, [GHOST_C, GHOST_C, GHOST_C]);
        ghost = dashedEdge(tri[0], tri[1], tri[5], tri[6], GHOST_C, edgeParts(tri[0], tri[1], tri[5], tri[6]))
          .concat(dashedEdge(tri[5], tri[6], tri[10], tri[11], GHOST_C, edgeParts(tri[5], tri[6], tri[10], tri[11])))
          .concat(dashedEdge(tri[10], tri[11], tri[0], tri[1], GHOST_C, edgeParts(tri[10], tri[11], tri[0], tri[1])));
        gmode = gl.LINES; gsize = 1.0;
      } else {
        ghost = [dragB.x, dragB.y, GHOST_C[0], GHOST_C[1], GHOST_C[2]];
        gmode = gl.POINTS; gsize = 14.0;
      }
      setupInterleaved(st, new Float32Array(ghost), gl.DYNAMIC_DRAW, userVao, userVbo);
      setUniforms(st, time, 0, 0, gsize, 0.0, 1.7, gb);
      gl.drawArrays(gmode, 0, ghost.length / 5);
    }
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
  }

  function drawScene(time, gb, waveBase) {
    gl.useProgram(st.program);
    gl.bindVertexArray(st.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    var br = [0.45, 1.0, 1.45], t, m;
    for (t = 0; t < 3; t++) {
      if (t === 1) continue;
      m = movers[t];
      var mx = m.bx, my = m.by;
      setUniforms(st, time, mx, my, 1.0, 0.0, br[t], gb);
      gl.drawArrays(gl.TRIANGLES, t * 3, 3);
      setUniforms(st, time, mx, my, 1.0, 0.0, br[t] + 0.55, gb);
      gl.drawArrays(gl.LINE_LOOP, t * 3, 3);
    }
    setUniforms(st, time, 0, 0, 1.0, waveBase, 1.0, gb);
    gl.drawArrays(gl.TRIANGLE_STRIP, 24, 4);
    setUniforms(st, time, 0, 0, 1.0, waveBase, 1.35, gb);
    gl.drawArrays(gl.LINE_LOOP, 24, 4);
    setUniforms(st, time, 0, 0, 1.0, waveBase, 1.0, gb);
    gl.drawArrays(gl.TRIANGLE_FAN, 28, 5);
    setUniforms(st, time, 0, 0, 1.0, waveBase, 1.35, gb);
    gl.drawArrays(gl.LINE_LOOP, 28, 5);
    var sz = [10.0, 24.0, 40.0], p;
    for (p = 0; p < 3; p++) {
      setUniforms(st, time, 0, 0, sz[p], 0.0, 1.0, gb);
      gl.drawArrays(gl.POINTS, 9 + p, 1);
    }
    setUniforms(st, time, 0, 0, 1.0, 0.0, 0.75, gb);
    gl.drawArrays(gl.LINES, 12, 2);
    setUniforms(st, time, 0, 0, 1.0, 0.0, 1.35, gb);
    gl.drawArrays(gl.LINES, 14, 2);
    setUniforms(st, time, 0, 0, 1.0, waveBase, 1.2, gb);
    gl.drawArrays(gl.LINE_STRIP, 16, 4);
    setUniforms(st, time, 0, 0, 1.0, waveBase * 0.5, 1.1, gb);
    gl.drawArrays(gl.LINE_LOOP, 20, 4);
    drawUser(time, gb);
    // WASD mover — drawn last so it always renders on top.
    m = movers[1];
    setUniforms(st, time, offsetX + m.bx, offsetY + m.by, 1.0, 0.0, br[1], gb);
    gl.drawArrays(gl.TRIANGLES, 3, 3);
    setUniforms(st, time, offsetX + m.bx, offsetY + m.by, 1.0, 0.0, br[1] + 0.55, gb);
    gl.drawArrays(gl.LINE_LOOP, 3, 3);
  }

  function render(now) {
    if (!paused) { updateKeyboard(); updateMovers(); }
    var sp = Number(speedEl.value);
    var time = paused ? (pauseTime - startTime) * 0.001 * sp : (now - startTime) * 0.001 * sp;
    var gb = Number(brightEl.value), waveBase = Number(waveEl.value);
    beginFrame(st, grid);
    drawScene(time, gb, waveBase);
    frame++;
    if (now - lastFpsT > 500) { fps = Math.round(frame * 1000 / (now - lastFpsT)); frame = 0; lastFpsT = now; }
    hud.textContent = "tool " + activeTool + " · off(" + offsetX.toFixed(2) + "," + offsetY.toFixed(2) + ") · fps " + fps;
    if (dataEl) dataEl.innerHTML =
      row("tool", activeTool + (dragging ? " · dragging" : "")) +
      row("color", rgbMode ? "RGB" : PALETTE_HEX[drawColorIdx]) +
      row("offset", offsetX.toFixed(3) + ", " + offsetY.toFixed(3)) +
      row("mouse NDC", mouseNdc.x.toFixed(2) + ", " + mouseNdc.y.toFixed(2)) +
      row("brightness", gb.toFixed(2)) +
      row("user shapes", (userTris.length / 15) + " tri · " + (userPts.length / 5) + " pts · " + (userLines.length / 10) + " lines");
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// A — primitive selector
// ============================================================
(function () {
  var st = initGL("glA");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas, mode = "TRIANGLES", frame = 0;
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  var C = PALETTE_RGB;
  setupInterleaved(st, new Float32Array([
    -0.4, -0.4, C[0][0], C[0][1], C[0][2],
     0.4, -0.4, C[1][0], C[1][1], C[1][2],
     0.0,  0.5, C[2][0], C[2][1], C[2][2]
  ]));
  var hud = document.getElementById("hudA"), dataEl = document.getElementById("dataA");
  document.querySelectorAll("[data-amode]").forEach(function (b) {
    b.addEventListener("click", function () {
      mode = b.getAttribute("data-amode");
      document.querySelectorAll("[data-amode]").forEach(function (x) { x.classList.toggle("active", x === b); });
    });
  });
  function render(now) {
    beginFrame(st, grid);
    var ps = mode === "POINTS" ? 26.0 : 1.0;
    setUniforms(st, now * 0.001, 0, 0, ps, 0.0, 1.0, 1.0);
    gl.drawArrays(gl[mode], 0, 3);
    if (mode === "TRIANGLES") {
      setUniforms(st, now * 0.001, 0, 0, 1.0, 0.0, 1.55, 1.0);
      gl.drawArrays(gl.LINE_LOOP, 0, 3);
    }
    frame++;
    hud.textContent = "mode " + mode + " · first 0 · count 3";
    if (dataEl) dataEl.innerHTML = row("mode", mode) + row("first", "0") + row("count", "3") + row("frame", frame);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// B — color control
// ============================================================
(function () {
  var st = initGL("glB");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas;
  var verts = new Float32Array([
    -0.5, -0.4, 1, 0, 0,
     0.5, -0.4, 0, 1, 0,
     0.0,  0.6, 0, 0, 1
  ]);
  setupInterleaved(st, verts);
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  var hud = document.getElementById("hudB"), dataEl = document.getElementById("dataB");
  var bright = document.getElementById("bBright"), brightVal = document.getElementById("bBrightVal");
  var cur = "#4DF3FF";
  bright.addEventListener("input", function () { brightVal.textContent = Number(bright.value).toFixed(2); });
  function setBase(hex) {
    cur = hex;
    var c = hexToRgb(hex);
    for (var i = 0; i < 3; i++) {
      var shade = 0.55 + i * 0.225;
      verts[(i * 5) + 2] = Math.min(1, c[0] * shade + 0.1);
      verts[(i * 5) + 3] = Math.min(1, c[1] * shade + 0.1);
      verts[(i * 5) + 4] = Math.min(1, c[2] * shade + 0.1);
    }
    gl.bindVertexArray(st.vao); gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  }
  document.querySelectorAll("[data-bcolor]").forEach(function (b) {
    b.addEventListener("click", function () { setBase(b.getAttribute("data-bcolor")); });
  });
  document.getElementById("bRandom").addEventListener("click", function () {
    cur = "random";
    for (var i = 0; i < 3; i++) {
      verts[i * 5 + 2] = Math.random(); verts[i * 5 + 3] = Math.random(); verts[i * 5 + 4] = Math.random();
    }
    gl.bindVertexArray(st.vao); gl.bindBuffer(gl.ARRAY_BUFFER, st.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  });
  function render(now) {
    beginFrame(st, grid);
    setUniforms(st, now * 0.001, 0, 0, 1.0, 0.0, 1.0, Number(bright.value));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    setUniforms(st, now * 0.001, 0, 0, 1.0, 0.0, 1.55, Number(bright.value));
    gl.drawArrays(gl.LINE_LOOP, 0, 3);
    hud.textContent = "base " + cur + " · global " + Number(bright.value).toFixed(2);
    if (dataEl) dataEl.innerHTML = row("base", cur) + row("u_brightness", "1.00") + row("u_global", Number(bright.value).toFixed(2));
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// C — spawn primitive (click)
// ============================================================
(function () {
  var st = initGL("glC");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas;
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  var pts = [];
  var hud = document.getElementById("hudC"), dataEl = document.getElementById("dataC");
  var last = { x: 0, y: 0 };
  canvas.addEventListener("click", function (e) {
    var n = pixelToNdc(canvas, e);
    last = n;
    if (pts.length >= 30) pts.shift();
    var c = PALETTE_RGB[pts.length % PALETTE_RGB.length];
    pts.push([n.x, n.y, c[0], c[1], c[2]]);
  });
  canvas.addEventListener("mousemove", function (e) { last = pixelToNdc(canvas, e); });
  document.getElementById("cClear").addEventListener("click", function () { pts.length = 0; });
  function render() {
    beginFrame(st, grid);
    if (pts.length) {
      var flat = [];
      for (var i = 0; i < pts.length; i++) flat.push(pts[i][0], pts[i][1], pts[i][2], pts[i][3], pts[i][4]);
      setupInterleaved(st, new Float32Array(flat), gl.DYNAMIC_DRAW);
      setUniforms(st, 0, 0, 0, 22.0, 0.0, 1.1, 1.0);
      gl.drawArrays(gl.POINTS, 0, pts.length);
    }
    hud.textContent = "points " + pts.length + " · ndc " + last.x.toFixed(2) + "," + last.y.toFixed(2);
    if (dataEl) dataEl.innerHTML = row("points", pts.length) + row("last NDC", last.x.toFixed(2) + ", " + last.y.toFixed(2));
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// D — multiple moving objects
// ============================================================
(function () {
  var st = initGL("glD");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas, C = PALETTE_RGB;
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  setupInterleaved(st, new Float32Array([
    -0.15, -0.12, C[0][0], C[0][1], C[0][2],
     0.15, -0.12, C[0][0], C[0][1], C[0][2],
     0.00,  0.16, C[0][0], C[0][1], C[0][2]
  ]));
  var objs = [
    { ox: -0.5, oy: 0.3, vx: 0.008, vy: 0.005, c: 1.3 },
    { ox: 0.4, oy: -0.3, vx: -0.006, vy: 0.009, c: 0.7 },
    { ox: 0.0, oy: 0.0, vx: 0.007, vy: -0.007, c: 1.0 }
  ];
  var cols = [C[0], C[1], C[3]];
  var hud = document.getElementById("hudD"), dataEl = document.getElementById("dataD");
  var start = performance.now();
  function render(now) {
    var t = (now - start) * 0.001;
    beginFrame(st, grid);
    for (var i = 0; i < 3; i++) {
      var o = objs[i];
      o.ox += o.vx; o.oy += o.vy;
      // Edge-aware: bounce when a vertex hits NDC ±1 (x: ±0.85, y: -0.88..0.84).
      if (o.ox > 0.85 || o.ox < -0.85) { o.ox = Math.max(-0.85, Math.min(0.85, o.ox)); o.vx = -o.vx; }
      if (o.oy > 0.84 || o.oy < -0.88) { o.oy = Math.max(-0.88, Math.min(0.84, o.oy)); o.vy = -o.vy; }
      setUniforms(st, t, o.ox, o.oy, 1.0, 0.0, o.c, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      setUniforms(st, t, o.ox, o.oy, 1.0, 0.0, o.c + 0.5, 1.0);
      gl.drawArrays(gl.LINE_LOOP, 0, 3);
    }
    hud.textContent = "3 objects · v1 0.008 · v2 -0.006 · v3 0.007";
    if (dataEl) {
      var s = "";
      for (var j = 0; j < 3; j++) s += row("obj " + (j + 1), objs[j].ox.toFixed(2) + ", " + objs[j].oy.toFixed(2));
      dataEl.innerHTML = s;
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// E — procedural pattern
// ============================================================
(function () {
  var st = initGL("glE");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas, C = PALETTE_RGB;
  var gen = [];
  // Bottom dotted grid (dim backdrop): 10x4, x -0.9..0.9, y -0.75..-0.15.
  for (var ix = 0; ix < 10; ix++) {
    for (var iy = 0; iy < 4; iy++) {
      var x = -0.9 + ix * 0.2, y = -0.75 + iy * 0.2;
      gen.push(x, y, C[2][0], C[2][1], C[2][2]);
    }
  }
  var starN = gen.length / 5;
  // Top ring, horizontally centered (0, 0.45), r=0.28 — clear gap above grid.
  for (var k = 0; k <= 12; k++) {
    var a = (k / 12) * Math.PI * 2;
    gen.push(Math.cos(a) * 0.28 + 0.0, Math.sin(a) * 0.28 + 0.45, C[0][0], C[0][1], C[0][2]);
  }
  setupInterleaved(st, new Float32Array(gen));
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  var hud = document.getElementById("hudE"), dataEl = document.getElementById("dataE");
  function render(now) {
    beginFrame(st, grid);
    setUniforms(st, now * 0.001, 0, 0, 7.0, 0.0, 0.55, 1.0);
    gl.drawArrays(gl.POINTS, 0, starN);
    setUniforms(st, now * 0.001, 0, 0, 1.0, 0.01, 1.2, 1.0);
    gl.drawArrays(gl.LINE_STRIP, starN, 13);
    hud.textContent = "grid 40 pts + ring 13 verts · loops only";
    if (dataEl) dataEl.innerHTML = row("grid", "10 x 4 = 40") + row("ring", "13 verts · r 0.28") + row("calls", "2");
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

// ============================================================
// F — uniforms & HUD (same triangles, 3 uniforms)
// ============================================================
(function () {
  var st = initGL("glF");
  if (!st) return;
  var gl = st.gl, canvas = st.canvas, C = PALETTE_RGB;
  var grid = makeGrid(st);
  addRulers(canvas.parentNode, canvas.width, canvas.height);
  // Small centered triangle (width 0.36, centroid x=0) so three
  // copies at xs=[-0.58,0,0.58] have even gaps and sit centered.
  setupInterleaved(st, new Float32Array([
    -0.18, -0.15, C[4][0], C[4][1], C[4][2],
     0.18, -0.15, C[4][0], C[4][1], C[4][2],
     0.00,  0.20, C[4][0], C[4][1], C[4][2]
  ]));
  var hud = document.getElementById("hudF"), dataEl = document.getElementById("dataF");
  var bright = document.getElementById("fBright"), brightVal = document.getElementById("fBrightVal");
  var paused = false, start = performance.now(), pT = 0;
  bright.addEventListener("input", function () { brightVal.textContent = Number(bright.value).toFixed(2); });
  document.getElementById("fPause").addEventListener("click", function () {
    paused = !paused;
    document.getElementById("fPause").textContent = paused ? "Resume" : "Pause";
    if (paused) pT = performance.now(); else start += performance.now() - pT;
  });
  var xs = [-0.58, 0.0, 0.58];
  function render(now) {
    var t = paused ? (pT - start) * 0.001 : (now - start) * 0.001;
    var gb = Number(bright.value);
    var br = [0.35, 1.0, 1.6], wv = [0.0, 0.03, 0.06];
    beginFrame(st, grid);
    for (var i = 0; i < 3; i++) {
      setUniforms(st, t, xs[i], 0, 1.0, wv[i], br[i], gb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      setUniforms(st, t, xs[i], 0, 1.0, wv[i], br[i] + 0.5, gb);
      gl.drawArrays(gl.LINE_LOOP, 0, 3);
    }
    hud.textContent = "A 0.35/0.00 · B 1.00/0.03 · C 1.60/0.06 · global " + gb.toFixed(2);
    if (dataEl) dataEl.innerHTML = row("draws", "3x TRI+LOOP") + row("global", gb.toFixed(2)) + row("paused", paused);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
