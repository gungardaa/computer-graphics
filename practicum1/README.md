# Practicum 1 — Graphics Playground

**Author:** Anak Agung Putu Arda Nareswara<br>
**NRP:** 5025241074<br>
**Class:** B

Web: https://ardanareswara-computer-graphics.vercel.app

This is my first assignment for Computer Graphics. It is an interactive webpage built on the HTML Canvas 2D API, where every shape on screen is just data: a type, a few coordinates, and a colour. The assignment asked for a canvas playground that shows primitives, colours, a triangle built from three vertices, moving objects, keyboard translation, and live mouse coordinates. This page covers all of it, plus all five challenges and the optional experiments.

Open `index.html` in a browser and everything runs. There is no build step and no server required.

## The one idea that explains the whole page

Everything the page does comes down to a single rule. A shape lives in data on one side and becomes an image on the other:

```
data → coordinate → primitive → draw → frame → pixels
```

The interactive parts follow the same cycle, with input in front:

```
user input → update data → draw frame → display → repeat
```

Each canvas runs its own `draw()` function scheduled with `requestAnimationFrame()`, which asks the browser to repaint roughly 60 times a second. Because every frame redraws from the current data, changing the data is the only thing you need to do to change the picture. Mouse moves update positions, clicks update colours, held keys update positions again, and the next frame shows the result. That one rule appears again and again in this project.

## How the code is organised

`main.js` is split into one self-contained block per canvas, each wrapped in an IIFE so no block leaks variables into another. A few shared helpers keep the blocks consistent:

- `point()` turns a pointer event into canvas coordinates and scales for CSS, so drawing lines up with the cursor even on responsive or high-DPI screens.
- `grid()` draws the faint grid, the x and y axes, and a pixel ruler on every canvas, which makes the coordinate system visible instead of implied.
- `hud()` renders the small monospace readout in the corner (frame number, position, velocity, held keys).
- `row()` produces one key/value line for the live data panels.

The palette is one array reused everywhere:

```js
var PALETTE = ["#4DF3FF", "#6BE4D2", "#76A8FF", "#70B2E6", "#D9E6F2"];
```

## The main playground

The core canvas is 800 × 500 pixels. Four shapes are seeded into it when the page loads, one per primitive:

```js
{ type: "rect",     x: 120, y: 90,  w: 64, h: 64, color: "#70B2E6", stroke: 2 }
{ type: "line",     x1: 320, y1: 80, x2: 430, y2: 250, color: "#76A8FF", stroke: 3 }
{ type: "circle",   x: 620, y: 130, r: 30, color: "#D9E6F2", stroke: 2 }
{ type: "triangle", ax: 170, ay: 350, bx: 170, by: 440, cx: 300, cy: 440, color: "#6BE4D2", stroke: 2 }
```

A rectangle is a position plus a width and height. A line is two points. A circle is a center and a radius. A triangle is three vertices, A, B and C.

The `paint()` function branches on `type` and builds the right canvas path. The triangle is the interesting case, because a triangle is not a built-in canvas shape. It is drawn by moving the pen to three vertices, connecting them, and closing the path:

```js
ctx.moveTo(s.ax, s.ay);
ctx.lineTo(s.bx, s.by);
ctx.lineTo(s.cx, s.cy);
ctx.closePath();
```

### Drawing shapes by dragging

Pressing on the canvas records the start point. As you drag, a dashed ghost preview follows the cursor. On release, `make()` turns the drag into a concrete shape for the active tool:

```js
if (tool === "rect") return { type: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y), color: color, stroke: stroke };
```

A triangle is the odd one out, because a drag gives only two points but a triangle needs three. The start point becomes vertex A, the straight vertical leg gives B, and the drag end gives C. It is the same coordinate-to-shape idea, taken one step further.

The toolbar writes to the same variables the next draw will read. Choosing Rect, a swatch, and the stroke slider changes `tool`, `color`, and `stroke`. Undo pops the last shape off the `shapes` array, and Clear empties the array. Nothing on screen is ever tracked like a snapshot; the draw loop simply repaints whatever is in the array at that moment.

## Moving objects

The motion canvas, also 800 × 500, combines three interactions on one screen.

The square follows the mouse. On every pointer move its position is set to the cursor, then clamped so it never leaves the canvas:

```js
square.x = Math.max(0, Math.min(W - square.s, p.x - square.s / 2));
```

This `Math.max`/`Math.min` clamp appears all over the page. It is one line and it keeps objects from walking off the edges.

The circle answers the keyboard, and it uses the state-based pattern the assignment specifically asked for. Instead of reacting once per key press, the page records which keys are currently held:

```js
window.addEventListener("keydown", function (e) { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
window.addEventListener("blur", function () { keys = {}; });
```

Then, once per frame inside `draw()`, the held keys are read and the position moves while they stay down:

```js
if (keys.w || keys.arrowup) circle.y -= speed;
if (keys.s || keys.arrowdown) circle.y += speed;
```

The `blur` listener clears the state when the window loses focus, so a key stuck down cannot leave the circle drifting on its own.

Clicking the square cycles its colour. A click is a single event, handled the event-based way: a simple hit test checks whether the click landed inside the square, and if it did, an index advances through the palette:

```js
if (p.x >= square.x && p.x <= square.x + square.s && p.y >= square.y && p.y <= square.y + square.s) {
  ci = (ci + 1) % PALETTE.length;
}
```

The two input styles sit side by side on purpose. A click is discrete, one colour change for one click. A held key is continuous, motion for as long as it is down. The right pattern drops out of that difference naturally.

## Challenge A: bouncing object

The smallest animation that can exist, built from exactly three parts: position, velocity, and a boundary check.

```js
x += vx; y += vy;                     // position += velocity
if (x - r < 0 || x + r > W) vx = -vx; // wall hit? velocity flips
if (y - r < 0 || y + r > H) vy = -vy;
```

Each frame the dot moves by its velocity. When an edge is crossed, the matching velocity component is negated, so the dot heads back the other way. Clicking anywhere teleports the dot by overwriting its position, which shows that position is just a number in memory.

## Challenge B: follow the mouse

A circle follows the cursor because its position is assigned from the pointer position on every move:

```js
cx = Math.max(r, Math.min(W - r, p.x));
cy = Math.max(r, Math.min(H - r, p.y));
```

The clamp keeps the circle's center at least one radius away from the edges. The demo also draws dashed guides from the circle down to the x axis and across to the y axis, so you can read the exact coordinate pair the circle is sitting on.

## Challenge C: click to change colour

A colour list and an index into it. Each click advances the index and wraps back to zero at the end:

```js
canvas.addEventListener("click", function () { i = (i + 1) % PALETTE.length; });
```

The frame loop then simply draws with `PALETTE[i]`. The event only edits the data. Drawing code is unchanged.

## Challenge D: move with the keyboard

This is the same state-based technique used on the motion canvas, demonstrated on its own. Each frame, the square moves by `speed` for every directional key currently held:

```js
if (keys.w || keys.arrowup) y -= speed;  // read held keys each frame
if (keys.s || keys.arrowdown) y += speed;
if (keys.a || keys.arrowleft) x -= speed;
if (keys.d || keys.arrowright) x += speed;
```

Because both W/A/S/D and the arrow keys feed the same state map, you can hold W and the right arrow together and the square moves diagonally. That multi-key behaviour is a direct result of reading a state map instead of responding to individual key press events.

## Challenge E: mouse coordinates in real time

Every point on a canvas is a pair of numbers, and this demo makes that visible. `pointermove` stores the cursor position, and each frame the pair is drawn large in the middle of the canvas:

```js
canvas.addEventListener("pointermove", function (e) {
  var p = point(canvas, e, W, H);
  mx = p.x; my = p.y;
});
```

Because `point()` accounts for CSS scaling, the reported numbers are the actual canvas coordinates, with no mismatch on high-DPI or responsive screens.

## The optional experiments

Three extra demos reuse the same engine, which is the point of them.

### Click to create circles

Every click pushes a new circle object into an array, and the draw loop paints every entry:

```js
circles.push({ x: p.x, y: p.y, r: 20, color: PALETTE[circles.length % PALETTE.length] });
```

Multiple objects on screen is just multiple entries in one array.

### Trail mode

The animation loop always clears the canvas each frame. Trail mode stores the last 60 positions in an array and draws them with increasing opacity, older dots more transparent, newer ones closer to full:

```js
trailPoints.push({ x: x, y: y });
if (trailPoints.length > maxTrail) trailPoints.shift();
```

Each stored point is drawn with an alpha that scales from nearly invisible to half opaque:

```js
var alpha = (i + 1) / trailPoints.length * 0.5;
ctx.fillStyle = "rgba(107, 228, 210, " + alpha + ")";
```

The trail fades naturally because older points sit at the front of the array with lower alpha values. The spacebar toggles the flag and clears the stored points.

### Multiple moving objects

Four objects, each carrying its own position, radius, colour, and velocity:

```js
{ x: 50,  y: 60,  vx: 2,    vy: 0,    r: 12, color: "#4DF3FF" },
{ x: 120, y: 150, vx: 0,    vy: 1.5,  r: 16, color: "#6BE4D2" }
```

The loop updates and draws them all with identical code. The motion differs only because the data differs. Swap the numbers in an object and its behaviour changes without touching the loop, which is the lesson the assignment is trying to land.

## Where each requirement is met

| Requirement | Where it is implemented |
|---|---|
| Canvas of at least 800 × 500 | `drawCanvas` and `motionCanvas` are both 800 × 500 |
| At least 3 primitive types | Four: `rect`, `line`, `circle`, `triangle` |
| At least 4 colours visible | `PALETTE` holds 5 colours, used across every canvas |
| A triangle from three vertex coordinates | The seeded triangle and drag-created triangles, whose data is `ax, ay, bx, by, cx, cy` |
| At least one moving object | The bouncing dot, the keyboard-driven circle, and the four moving circles |
| Keyboard translation using state-based input | A `keys` map written by `keydown`/`keyup` and read every frame in `draw()` |
| Mouse coordinate display | Challenge E, plus the live data panels and corner HUDs on every demo |
| Source split into `index.html` and `app.js` | The site is split across `index.html`/`app.js`; the practicum page has its own `index.html`/`main.js` |
| Comments on important parts | Every block and every non-obvious line has a short comment |
| Runs directly in the browser | Static files, no build step |

The interactions the assignment asked for are all present too. An object follows the mouse (the motion square and Challenge B), a colour changes on click (the motion square and Challenge C), and an object moves from the keyboard (the motion circle and Challenge D).

## The mechanics, in short

The assignment also requires being able to explain how the whole thing works, so here is the compressed version.

- **Where does an object's position live?** In plain data, like `square.x` and `square.y`. The drawing code never moves an object; it only reads the data.
- **What is the canvas coordinate system?** The origin `(0, 0)` is the top-left corner. x grows to the right and y grows downward. The grid, axes, and ruler on every canvas make this visible.
- **How is the triangle formed?** From three vertices connected with `lineTo`, closed with `closePath()`.
- **How is a frame updated?** `requestAnimationFrame(draw)` schedules the next repaint roughly 60 times a second.
- **How does input change data?** Input handlers write to variables, and the draw loop reads them on the next frame.
- **How does data become an image?** Each primitive is drawn with its current coordinates and colour, and the pixels last only until the next `clearRect`.

## Running it

Open `index.html` directly in any modern browser. If you prefer a local server, from this folder run:

```
python -m http.server 8000
```

and open `http://localhost:8000/`.