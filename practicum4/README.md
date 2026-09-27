# Practicum 4 - Camera Playground

**Author:** Anak Agung Putu Arda Nareswara<br>
**NRP:** 5025241074<br>
**Class:** B

Web: https://ardanareswara-computer-graphics.vercel.app

This is my fourth assignment for Computer Graphics. Where Practicum 3 placed
flat shapes with a 3x3 model matrix, this one finishes the journey to the
screen. A cube lives in local space, a 4x4 model matrix spins it, a view matrix
places the camera, and a projection matrix flattens everything into clip space.
The page covers the full 3D chain plus camera control, perspective and
orthographic projection, FOV, near and far planes, and the depth test. It
includes all six challenges and all nine mandatory experiments.

Open `index.html` directly in any modern browser and everything runs. There is
no build step and no server required.

## The one idea that explains the whole page

Geometry describes a shape. Three matrices decide where it appears:

```
local vertex → model → world → view → view space → projection → clip → divide → NDC → pixels
```

The cube points never change. Only the matrices change, and changing a matrix
is the only thing needed to change the picture. The frame loop rebuilds model
from the spin angles, view from the camera state, and projection from the lens
state, then uploads all three with `uniformMatrix4fv` before each draw. That
single rule drives the stage and all five labs.

## How the code is organised

- `math3d.js` defines globals `Vec3` with `subtract`, `cross`, `normalize`,
  and `dot`, plus `Mat4` with `identity`, `translation`, `rotationX`,
  `rotationY`, `scaling`, `multiply`, `lookAt`, `perspective`, and
  `orthographic`. Column-vector convention, column-major storage, matching
  `uniformMatrix4fv` with transpose false.
- `main.js` holds shared WebGL helpers plus six canvas blocks in one IIFE.
  One shared `requestAnimationFrame` loop drives every canvas, so all cubes
  spin in sync and each frame costs one loop.
- `makeGL()` builds one WebGL2 context per canvas with one program, one VAO,
  and two static buffers for position and color. Each canvas owns its context,
  so no canvas can disturb another. Geometry uploads once with `STATIC_DRAW`
  and is never rewritten.
- `modelMatrix()` composes identity times rotationX times rotationY from the
  shared spin angles. `stageProj()` picks perspective or orthographic from the
  lens state every frame.
- Shaders live in `index.html` inside `<script type="x-shader">` tags, the same
  pattern as Practicums 2 and 3, so GLSL reads as GLSL.
- `buildGround()` plus `drawGround()` paint a dim 9 by 9 ground grid with two
  brighter axes as background chrome, the P3 idea moved into world space. It
  draws first with `LINES` so cubes always paint over it, and it is never
  counted as an object.

The vertex shader applies the full chain in one multiply:

```glsl
gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
```

The fragment shader paints the interpolated vertex color straight out.

## The main stage

The stage canvas is 800 by 500. One cube spins at 25 degrees per second on X
and 40 on Y from a home pose of 20 and 30 degrees. The camera starts at
(0, 1.5, 4) looking at the origin with up (0, 1, 0). Projection starts as
perspective with FOV 60, near 0.1, and far 100. Depth test starts ON.

Keyboard input follows two patterns. Continuous motion is state-based. Arrow
keys slide the camera on X and Y, W and S dolly on Z, PageUp and PageDown move
height, and bracket keys shrink and widen FOV between 30 and 100. A held-key
map is read every frame with delta time clamped at 0.05 seconds. Discrete
actions are event-based. P flips projection, N steps the clip preset, D flips
depth, O toggles orbit, T steps the target, 1 2 3 jump to FOV 35 60 90, M logs
the live matrices with `console.table`, R resets, and Space pauses.

Every dock button mirrors its key, so the whole stage works with mouse alone.
The HUD overlay plus the telemetry strip report camera, projection, FOV, and
depth every frame, and the live panel adds target, clip values, orbit state,
and the draw count of 36.

## Lab A: camera presets

Three seats share one cube and one target. Seat A is (0, 0, 4), seat B is
(2, 0, 4), and seat C is (0, 2, 4). The cube never moves in the world. Only
the view matrix changes, and the picture follows it. Seat B shows that moving
right reads as looking left from the new seat. Seat C looks down from above.
The live panel states it plainly each time, with world marked as still and
view marked as changed.

## Lab B: target plus up

The camera stays parked at (0, 1.5, 4) while its gaze wanders across (0, 0, 0)
then (1, 0, 0) then (minus 1, 0, 0). Shifting the target steers the forward
vector, which is target minus position normalized. The up toggle swaps a
straight up of (0, 1, 0) for a tilted (0.7, 1, 0) and rolls the whole frame
sideways. That roll is the point. Position plus target aim the camera, but the
up vector decides which way is up in the picture.

## Lab C: split projection

Two views of the same moment in one canvas. The left half draws with
perspective and the right half with orthographic, using one shared model and
one shared camera state with two viewports. Perspective shrinks far geometry
and feels natural, which is why games use it. Orthographic keeps sizes stable
against depth and feels technical, which suits CAD and maps. The live panel
names both halves so the comparison never needs guessing.

## Lab D: depth trio

Three cubes sit at z 0 and minus 1.5 and plus 1.5 in front of a camera at
z 4.5. With depth ON the near cube correctly hides the far ones no matter the
draw order. With depth OFF the last drawn triangle wins and back faces punch
through the front. The clip button steps the same three near and far presets
as the stage, so tight clips visibly slice cubes while loose ones waste
precision. Z-fighting is covered as a concept in the panel. It happens when
two surfaces share nearly equal depth and precision runs out, flickering as
they take turns winning. The presets stay clear of extreme values on purpose,
so the final app never invites it.

## Lab E: FOV plus aspect

The lens bench. FOV steps through 35 then 60 then 90 degrees. Narrow reads as
zoom with a calm frame, wide stretches the edges and bends the corners. The
aspect toggle swaps the canvas between 520 by 320 and 360 by 360. Resizing
resets GL state, so the context is rebuilt on the new size and the projection
is recomputed from the real `width over height` each time. The live panel
shows the canvas size and the resulting aspect next to the FOV, which makes
the distortion source obvious when the numbers mismatch.

## Challenges

The modul asks for at least two challenges. All six are done, each named
exactly as in the modul.

### Challenge A: Orbit Camera

Key O and the Orbit button circle the camera around the target. The radius and
angle are captured from the current position when orbit starts, then the angle
advances at 0.6 radians per second while height stays fixed. Implemented in
`updateStage()` in `main.js`.

### Challenge B: Camera Height Control

PageUp and PageDown raise and lower the camera at the same 2.0 units per
second as the other axes. Height works with orbit off and combines with it
when orbit starts from a raised seat. Implemented in `updateStage()` in
`main.js`.

### Challenge C: Target Control

Key T and the Target button step the look target through origin then
(1, 0, 0) then (minus 1, 0, 0). Position never moves, so only the view
direction changes. Lab B is the permanent visual proof with its own target
buttons. Implemented as `stage.cam.tgt` plus `stageTarget()` in `main.js`.

### Challenge D: Projection Comparison Split Mode

Lab C draws perspective on the left half and orthographic on the right half of
one canvas with one shared model and camera state. Same matrices in, two
projections out, compared in a single glance. Implemented in `drawLabSplit()`
in `main.js`.

### Challenge E: Multiple Cube Depth Test

Lab D draws three cubes at z 0 and minus 1.5 and plus 1.5 through one shared
view and projection. The Depth button flips the test live so visibility with
ON versus OFF is one click apart. Implemented in `drawLabDepth()` in `main.js`.

### Challenge F: FOV Preset

Keys 1 2 3 and the three FOV buttons jump to 35 then 60 then 90 degrees. The
active value shows in the HUD, the telemetry strip, and the live panel, and
Lab E repeats the same three steps with aspect control beside them.
Implemented as direct writes to `stage.proj.fov` in `main.js`.

## Where each requirement is met

| Requirement | Where it is implemented |
|---|---|
| WebGL2 context | Every canvas via `makeGL()`, with a fallback message |
| Cube 3D with 36 vertices | `CUBE_POS`, six faces times two triangles |
| Position vec3 | `vertexAttribPointer` size 3 for `a_position` |
| Vertex color | `CUBE_COL` per face plus `a_color` attribute |
| Model matrix 4x4 | `modelMatrix()` from `rotationX` and `rotationY` |
| View matrix | `Mat4.lookAt()` rebuilt per frame |
| Camera position, target, up vector | Stage state plus Lab A and Lab B presets |
| Perspective projection | `Mat4.perspective()` with live FOV and aspect |
| Orthographic projection | `Mat4.orthographic()` with aspect kept box |
| Projection toggle | Key P and the Projection button |
| Correct aspect ratio | `canvas.width over canvas.height` recomputed per frame |
| FOV control | Bracket keys continuous plus 1 2 3 presets |
| Near and far presets | N key plus clip buttons, 0.1/100 then 1/20 then 2.5/8 |
| Depth test ON and OFF | Key D plus Depth buttons, `setDepth()` per frame |
| Depth buffer cleared per frame | `clearAll()` clears color plus depth |
| Automatic cube rotation | `stepSpin()`, 25 and 40 deg per second |
| State-based camera movement | Held-key map read in `updateStage(dt)` |
| Event-based toggles | P N D R O T 1 2 3 M Space, repeat ignored |
| HUD camera and projection | Overlay plus telemetry plus live panel |
| Ground grid | Background chrome, drawn first with LINES, never counted |
| Modular source | `math3d.js` separate from `main.js` |
| Clean console | Guarded lookups, shader errors throw with messages |
| At least two challenges | All six A to F, see the Challenges section |

One honest deviation. The modul fixes ortho near and far at 0.1 and 100 in
its example while the N presets only clearly drive perspective. Here the clip
presets feed both projections, so near and far clipping stays observable in
ortho mode too, including Lab D. The behavior is documented in the panels.

## Controls

Arrows move the camera on X and Y. W pulls closer and S backs away. PageUp
and PageDown change height. Brackets adjust FOV smoothly. Digits 1 2 3 set
FOV 35 60 90. P flips projection, N steps the clip preset, D flips depth, O
toggles orbit, T steps the target, M logs matrices, R resets, Space pauses.
Projection starts as perspective, FOV starts at 60, clips start at 0.1 over
100, depth starts ON.

## Analysis Questions

### Why is a camera needed in a 3D scene?

The world has no viewpoint by itself. The camera picks where the eye sits and
which way it looks, and everything else is measured against that choice.

### What is the function of camera position?

It anchors the eye in world space. Every forward, right, and up axis derives
from it, so moving it re-aims the whole frame.

### What is the function of target?

It names the point the eye looks at. Position minus target gives the view
direction, so sliding the target steers the gaze without moving the feet.

### What is the function of up vector?

It decides which way is up in the picture. Forward alone leaves roll free,
and up pins it down.

### How is view direction computed conceptually?

Subtract position from target and normalize. The result is a unit forward
vector pointing from the eye into the scene.

### Why does the right vector use a cross product?

Right must sit perpendicular to both forward and up. The cross product builds
exactly that perpendicular axis in one step.

### What is a corrected up vector?

The input up is rarely perfectly perpendicular to forward. Crossing right
with forward rebuilds an up that truly is, so the basis stays square.

### What is the function of the view matrix?

It converts world positions into eye-relative positions. After it runs, the
camera sits at the origin looking down its own axis by definition.

### Why is the camera conceptually at the origin in view space?

Because view space is defined around the eye. The transform subtracts the
camera out, which simplifies every later step to look down one fixed axis.

### Why does the view matrix relate to the inverse camera transform?

Moving the camera right must read as the world sliding left. Inverting the
camera placement produces exactly that opposite motion.

### What is the function of the projection matrix?

It maps the 3D view volume into the clip cube. That mapping is what lets a
flat screen show depth at all.

### What is the difference between perspective and orthographic projection?

Perspective divides by depth, so far things shrink and the picture feels
natural. Orthographic skips the divide, so sizes stay stable and the picture
feels technical.

### What is the function of FOV?

It sets how wide the lens sees. Wider opens the frame and narrower tightens
it, with the cube resizing accordingly.

### What does a small FOV do?

It narrows the view and magnifies the middle. The cube grows calm and flat,
like a zoom lens.

### What does a large FOV do?

It widens the view and exaggerates depth. The cube shrinks back while the
edges stretch and bend.

### What is the function of aspect ratio?

It matches the projection to the canvas shape. Width over height tells the
matrix how much horizontal room each vertical unit gets.

### Why does a wrong aspect ratio distort the object?

The image is stretched to fill a frame it was not built for. Circles become
ellipses and cubes lean, purely from the mismatch.

### What is the function of the near plane?

It clips everything closer than itself. Geometry in front of it never reaches
the screen.

### What is the function of the far plane?

It clips everything farther than itself. Geometry beyond it is cut away no
matter how large it is.

### Why should the near plane not sit too close to zero?

Depth precision crowds near the camera. A near of nearly zero wastes that
precision and invites flicker, so a small but sane value like 0.1 behaves far
better.

### How do near and far relate to depth precision?

The pair squeezes the whole depth range into limited bits. Pulling them tight
around the scene sharpens precision, spreading them wide thins it out.

### What is the function of the depth buffer?

It stores the closest depth per pixel. Each new fragment checks in against
that record before drawing.

### What is the function of the depth test?

It keeps nearer fragments and drops hidden ones. That one check resolves
every overlap correctly regardless of draw order.

### What happens if the depth test is off?

Draw order becomes truth. Later triangles paint over earlier ones even when
they sit behind, and back faces punch through the front.

### What is Z-fighting?

Two surfaces with nearly equal depth take turns winning per pixel. The result
is flicker and unstable patterns where they overlap.

### Why does a cube consist of triangles?

The GPU only assembles points, lines, and triangles. Quads would need hidden
splitting anyway, so twelve explicit triangles say exactly what is meant.

### Why does 3D position use vec3?

A point in space needs three numbers. The vec3 carries x, y, and z straight
into the shader with no packing tricks.

### Why does 3D transformation use a 4x4 matrix?

Three rows hold rotation and scale, one column holds translation, and the
extra row keeps the homogeneous form closed. A 3x3 cannot translate in 3D,
and projection needs the fourth row for its divide.

### What does P times V times M times localPosition mean?

Read right to left. M places the vertex in the world, V moves it relative to
the eye, and P flattens it into clip space for the screen.

### Why does state-based input suit camera movement?

Motion should last exactly as long as the press. A held-key map read each
frame starts and stops cleanly and blends multiple keys at once.

## Experiment Notes

### A, camera position across (0,0,4) then (2,0,4) then (0,2,4)

The cube stays at the origin in world space every time. What changes is the
view matrix, rebuilt from the new seat each frame. The viewpoint shifts
because the eye moved, not the object. Lab A shows exactly this with its
three seat buttons.

### B, target across origin then (1,0,0) then (minus 1,0,0)

The position never moves yet the gaze swings right then left. Each target
rewrites forward, which rewrites the whole view basis. Lab B carries these
three targets plus the up toggle for the full picture.

### C, FOV across 35 then 60 then 90

At 35 the cube fills the frame calmly. At 60 it sits back naturally. At 90 it
shrinks while the corners stretch. Same scene, three lenses. Lab E repeats
these steps beside the aspect toggle.

### D, perspective versus orthographic

Perspective feels like a game, with depth pulling naturally into the screen.
Orthographic feels like a blueprint, with sizes holding steady everywhere.
For 3D games perspective wins because eyes expect far things to shrink. Lab C
runs both side by side so neither half can hide.

### E, depth test ON versus OFF

With ON the near cube wins every pixel it should and the trio reads
correctly. With OFF the last drawn cube wins even from behind and faces bleed
through. Draw order alone cannot know depth, only the buffer can. Lab D flips
this live with one button.

## Reflection

Camera position was the easiest idea because sitting somewhere new is
something I do every day. The view matrix was the hardest, since an inverse
that moves the world opposite the camera only clicked once Lab A showed the
world standing still. Perspective feels alive while orthographic feels exact,
and FOV turned out to be a zoom knob with edge distortion as its price. Depth
testing earned my respect the moment OFF let a back face walk through the
front. My one real bug was a flipped cross product order that mirrored the
camera, and keeping the single convention from `math3d.js` everywhere fixed
every canvas at once.

## Running it

Open `index.html` directly in any modern browser. If you prefer a local server,
from this folder run:

```
python -m http.server 8000
```

and open `http://localhost:8000/`.

## Debugging notes

A missing cube almost always means the camera or the clip range, not the
geometry. Check the context first, then shader compile and program link
messages, then that `a_position` uses size 3, then that all three matrices
upload before the draw with count 36. Keep near above zero and far above near
or the projection silently breaks. If the picture mirrors or rolls oddly,
recheck the cross product order against `math3d.js` and confirm target never
equals position. If the cube stretches, the aspect no longer matches the
canvas, most often right after a resize. If back faces show through, confirm
the test is enabled and the depth buffer clears every frame.
