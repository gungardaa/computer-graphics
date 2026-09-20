# Practicum 3 — Transformation Playground

**Author:** Anak Agung Putu Arda Nareswara<br>
**NRP:** 5025241074<br>
**Class:** B

Web: https://ardanareswara-computer-graphics.vercel.app

This is my third assignment for Computer Graphics. Where Practicum 2 moved
shapes by adding offsets by hand, this one moves them the proper way, with a
3x3 transformation matrix sent to the GPU as a uniform. Every object on screen
reuses one triangle stored in local space. Position, angle, and scale live in
plain JavaScript state, one matrix is composed per object per frame, and the
vertex shader applies it in a single multiply.

Open `index.html` directly in any modern browser and everything runs. There is
no build step and no server required. `matrix3.js` and `main.js` are classic
scripts on purpose, so `file://` works exactly like Practicums 1 and 2.

## The one idea that explains the whole page

Geometry describes a shape. A matrix places it in the world:

```
local vertex → GPU buffer → model matrix → vertex shader → world position → pixels
```

The triangle points never change. Only the matrix changes, and changing the
matrix is the only thing needed to change the picture. Held keys edit position
and angle and scale, one composed matrix per object is uploaded with
`uniformMatrix3fv`, and the next frame shows the result. That single rule
drives the stage and all three labs.

## How the code is organised

- `matrix3.js` defines a global `Mat3` with `identity`, `translation`,
  `rotation`, `scaling`, and `multiply`. Column-vector convention,
  column-major storage, matching `uniformMatrix3fv` with transpose false.
- `main.js` holds shared WebGL helpers plus four self-contained canvas blocks:
  the main stage, the order lab, the door lab, and the family lab.
- `makeGL()` builds one WebGL2 context per canvas with one program, one VAO,
  and one VBO. Each canvas owns its context, so no canvas can disturb another.
- `trs()` composes translate times rotate times scale explicitly through
  nested `multiply` calls, so the intended order never depends on call order.
- `rtOrder()` composes rotate times translate as the contrasting order.
- `drawAxes()` draws both axes plus the origin marker with the identity matrix,
  and `drawPivot()` draws the local origin through the object's own matrix, so
  the pivot is always visible exactly where rotation happens.
- Shaders live in `index.html` inside `<script type="x-shader">` tags, the same
  pattern as Practicum 2, so GLSL reads as GLSL.

The vertex shader turns each 2D point into a homogeneous coordinate and applies
the model matrix:

```glsl
vec3 p = u_matrix * vec3(a_position, 1.0);
gl_Position = vec4(p.xy, 0.0, 1.0);
```

The fragment shader paints one flat color per draw, taken from a `u_color`
uniform.

## The main stage

The stage canvas is 800 by 500. The cyan triangle is fully interactive and the
orange triangle runs an automatic loop of rotation plus breathing scale. Both
draw from the same triangle buffer.

Keyboard input follows two patterns. Continuous motion is state-based: `keydown`
and `keyup` maintain a held-key map that `update(dt)` reads every frame with
delta time, clamped to 0.05 seconds. Discrete actions are event-based: R resets,
T flips the transform order, 1/2/3 jump to presets, M logs the live matrix with
`console.table`, and Space pauses. Clicking the canvas converts the cursor from
pixels to NDC and writes the cyan triangle position directly.

The telemetry strip under the canvas reports position, rotation, scale, and the
active order every frame. Lab D mirrors the live 3x3 matrix behind the cyan
triangle as three columns.

## Lab A: order changes everything

Two triangles share identical numbers: offset 0.45 on x, the same animated
angle, and scale (1.3, 0.7). The left one uses translate times rotate times
scale and spins where it stands. The right one uses rotate times translate, so
its offset gets rotated around the origin and it travels in a circle instead.
The live panel shows both pivot positions to prove the numbers match while the
pictures differ.

## Lab B: door hinge

A rectangle swings around its left edge instead of its center. The composed
matrix is base position times hinge offset times rotation times inverse hinge
offset. The bright dot is the hinge transformed by the same matrix, so it sits
exactly on the pivot. The panel also draws the hinge edge as a bright line.

## Lab C: family plus orbit

Two hierarchy ideas share one view. A small mint triangle is parented to the
cyan one through `childWorld = parentWorld times childLocal`, so it follows the
parent everywhere while spinning on its own. An orange orbiter circles the
middle through rotate times shift times spin composition. The sun at the center
only breathes and never translates.

## Lab D: matrix readout

Lab D is a debugging aid, not a canvas. It mirrors the live 3x3 matrix behind
the cyan stage triangle as three columns, updating every frame. Pressing M logs
the same matrix to the console twice: once as the flat 9-element list from the
modul, once as three labeled rows that read as a real matrix. Comparing the
readout before and after T shows exactly how the order flip rewrites the
numbers.

## Challenges

The modul asks for at least two challenges. All six are done, each named
exactly as in the modul.

### Challenge A: Reset Transform

Keyboard R and the Reset button on the stage restore the home pose: position
(-0.35, 0.0), rotation 0, scale (1, 1). Implemented as `reset()` in the stage
block of `main.js`.

### Challenge B: Transform Preset

Keyboard 1, 2, 3 and the three preset buttons on the stage jump to fixed
poses. Preset 1 is (-0.40, 0.20) with no turn and unit scale. Preset 2 is the
origin with 45 degrees and uniform scale (1.5, 1.5). Preset 3 is (0.30, -0.20)
with 90 degrees and non-uniform scale (1.8, 0.6). Implemented as `preset()` in
the stage block of `main.js`.

### Challenge C: Toggle Transform Order

Keyboard T and the Flip order button on the stage switch the cyan triangle
between translate times rotate times scale and rotate times translate times
scale. The active order shows in the HUD, the telemetry strip, and the live
data panel. Lab A serves as the permanent visual comparison of both orders side
by side.

### Challenge D: Mouse Translation

Clicking the stage canvas converts the cursor from pixels to NDC with
`pixelToNdc()` and writes the result straight into the cyan triangle position,
clamped to the stage bounds. Translation flows through the matrix like every
other motion, never by editing vertices.

### Challenge E: Parent and Child

Lab C carries a small mint triangle parented to the cyan one through
`childWorld = parentWorld times childLocal`. Moving the parent carries the
child along while the child keeps its own fast local spin on top. The live
panel reports the computed child world position every frame.

### Challenge F: Simple Orbit

Lab C carries an orbiter circling the middle through rotate times shift times
spin composition, with no physics involved. The live panel reports the computed
orbiter position every frame, tracing a circle of radius 0.62 around the
breathing sun.

## Where each requirement is met

| Requirement | Where it is implemented |
|---|---|
| WebGL2 context | Every canvas via `makeGL()`, with a fallback message |
| Geometry in local coordinates | `TRI` centered on the origin, never edited per frame |
| GPU buffer | One VBO per canvas, re-uploaded per draw |
| Homogeneous coordinate in shader | `vec3(a_position, 1.0)` in the vertex shader |
| Translation, rotation, scaling matrices | `Mat3.translation`, `rotation`, `scaling` |
| Uniform and non-uniform scaling | Plus/minus keys scale both axes, Z/X and C/V scale one axis |
| Matrix multiplication and model matrix | `Mat3.multiply`, `trs()` and `rtOrder()` |
| Matrix sent as uniform | `gl.uniformMatrix3fv(g.uM, false, matrix)` before every draw |
| At least two objects sharing geometry | Cyan plus orange on the stage, more in every lab |
| Keyboard translation, rotation, scaling | Arrows/WASD, Q/E, plus/minus, Z/X/C/V |
| State-based input and delta time | Held-key map read in `update(dt)`, dt clamped at 0.05 |
| Automatic animation | Orange stage object, orbiting lab object, swinging door, breathing sun |
| Two different transform orders | T flip on the stage plus the side-by-side order lab |
| HUD with position, rotation, scale | Overlay div plus telemetry strip plus live data panel |
| Axes, origin, and pivot markers | P1 colors everywhere: 32px grid at 0.07 alpha, axes at 0.18 alpha, NDC rulers. Stage uses thick 3px center axes, labs use edge axes. `drawPivot()` on every object |
| Shapes | P1 style: translucent fill at 0.5 alpha plus full-alpha `LINE_LOOP` outline in the same color |
| All six challenges A to F | See the Challenges section: reset, presets, and order toggle on the stage, mouse move on the stage, parent/child and orbit in Lab C |
| Clean console | All element lookups guarded, shader errors throw with messages |

## Analysis Questions

### What is the difference between local and world coordinates?

Local coordinates describe the shape around its own origin. World coordinates describe where that shape sits in the scene. The model matrix converts one into the other.

### What is the function of the object origin?

The origin is the pivot. Rotation and scaling happen around it, so moving the origin changes how an object turns even when its points stay the same.

### What is the function of the model matrix?

One matrix that packs translate, rotate, and scale for an object. The shader multiplies every vertex by it, so per-object placement costs one uniform per draw instead of re-uploading points.

### Why should geometry stay in local space?

One shape can then serve many objects. Two triangles on screen share a single buffer and differ only by matrix and color, which is less memory and less code.

### What is the difference between translation, rotation, and scaling?

Translation adds an offset and preserves shape and orientation. Rotation turns points around the pivot by an angle and preserves distances. Scaling multiplies distances from the pivot per axis and can change proportions.

### What is the difference between uniform and non-uniform scaling?

Uniform scaling uses equal x and y factors and keeps proportions. Non-uniform scaling uses different factors and stretches the shape along one axis.

### Why are homogeneous coordinates needed?

A 2D point becomes (x, y, 1) so translation joins rotation and scaling in one consistent 3x3 matrix form. Without the extra component, translation cannot be expressed as matrix multiplication.

### Why does a point use w equal to 1?

The third row of a translation matrix adds tx and ty multiplied by w. With w at 1 the offset applies fully, which is correct for positions.

### Why can a direction vector use w equal to 0?

A direction should rotate and scale but never translate. With w at 0 the translation terms multiply to zero and drop out.

### Why is the transformation matrix 3x3 for this 2D case?

Two rows hold the linear part (rotation and scale), the third column holds translation, and the bottom row keeps the homogeneous form closed. A 2x2 matrix cannot translate.

### Why does rotation need sin and cos?

Rotating a point mixes its x and y coordinates along a circle, and sine and cosine are exactly the circle projection functions for a given angle.

### Why does JavaScript need a degree to radian conversion?

JavaScript `Math.sin` and `Math.cos` take radians. Degrees are friendlier for humans, so `degree times PI over 180` bridges the two before the math.

### What is transform composition?

Several transforms merge into one matrix by multiplication, so the GPU applies the whole chain in a single step per vertex.

### Why does T times R differ from R times T?

Matrix multiplication is not commutative. Translating first moves the offset itself under rotation, which turns placement into orbit. Order selects meaning, not just efficiency.

### What is the function of the matrix uniform?

One value shared by all vertices of a draw call. Every vertex of an object needs the same transform, so a uniform fits exactly.

### What is the difference between an attribute and a uniform?

An attribute varies per vertex, like position. A uniform stays constant for the whole draw, like the model matrix or flat color.

### Why is a matrix uniform better than editing vertices on the CPU?

Rewriting a buffer every frame costs a full upload per object per frame. A 9-float uniform achieves the same picture with almost no bandwidth, and the original geometry stays reusable.

### Why can one geometry buffer serve several objects?

Buffers hold shape, uniforms hold placement. Binding the same buffer with different uniforms draws the same shape in different places for free.

### What is the relationship between pivot, rotation, and scaling?

Both operate relative to the pivot. A center pivot spins in place, an edge pivot swings like a door, and scaling from a corner grows away from that corner.

### What is the relationship between the model matrix and local and world coordinates?

The matrix is the bridge. Local points go in, world positions come out, and the geometry itself never leaves local space.

### What are the functions of the view and projection matrices, conceptually?

The view matrix places the camera in the world. The projection matrix maps the camera view into clip space. Both come after the model matrix and are the topic of the next meeting.

### What are clip coordinates, NDC, the perspective divide, and the viewport transform?

Clip coordinates are the homogeneous result of projection. Dividing by w (the perspective divide) yields NDC in the -1 to 1 cube. The viewport transform maps NDC to screen pixels.

### Why is state-based keyboard input right for continuous control?

Held keys write a map on keydown and clear it on keyup, and the frame loop reads the map. Motion lasts exactly as long as the press, and multiple keys combine naturally.

### Why is delta time needed?

Frame time varies, so multiplying speed by seconds per frame keeps motion consistent at any frame rate. The 0.05 clamp avoids jumps after lag spikes.

### How does a parent transform affect its child?

The child world matrix equals parent world times child local. Moving the parent carries the child along while the child keeps its own local motion on top.

### Why must the matrix convention stay consistent?

Row-vector and column-vector math transpose order and storage. Mixing them silently flips compositions, so every helper, multiplication, and shader on this page uses column vectors only.

## Reflection

Translation was the easiest part because adding an offset reads exactly like it
looks. Rotation direction was the hardest to trust until the pivot dots made
every turn visible. My first composition draft nested the multiplies in the
wrong sequence and the stage triangle orbited when it should have spun, which
is precisely the bug the order lab now demonstrates on purpose. The hinge made
pivots click: who the parent is and where the origin sits decides the whole
motion. Next I want to see how Three.js hides this same matrix behind friendly
`position` and `rotation` fields, and how Unity chains it through its Transform
hierarchy.

## Running it

Open `index.html` directly in any modern browser. If you prefer a local server,
from this folder run:

```
python -m http.server 8000
```

and open `http://localhost:8000/`.
