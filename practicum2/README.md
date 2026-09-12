# Practicum 2 — WebGL Primitive Playground

**Author:** Anak Agung Putu Arda Nareswara<br>
**NRP:** 5025241074<br>
**Class:** B

Web: https://ardanareswara-computer-graphics.vercel.app

This is my second assignment for Computer Graphics. Where the first practicum drew everything with the Canvas 2D API, this one talks directly to the GPU through WebGL2. Every shape on screen starts as numbers in JavaScript, gets uploaded to GPU memory, is connected to a shader program, and finally appears through a draw call. The page covers the full fundamental pipeline: context, buffers, shaders, attributes, uniforms, primitive assembly, animation, and mouse plus keyboard input. It includes all six challenges and the extra best-practice tasks.

Open `index.html` in a browser and everything runs. There is no build step and no server required.

## The one idea that explains the whole page

Everything the page does comes down to a single chain. Data lives on the CPU side first and becomes an image on the GPU side last:

```
data → buffer → attribute → vertex shader → primitive assembly → rasterization → fragment shaders → pixels
```

The interactive parts follow the same chain, with input and a frame loop around it:

```
user input → uniforms / vertex data → draw calls → display → repeat
```

Each canvas runs its own `render()` function scheduled with `requestAnimationFrame()`, which asks the browser to repaint roughly 60 times a second. Because every frame re-uploads or re-sends only what changed and then re-issues its draw calls, changing a uniform or a buffer is the only thing needed to change the picture. Held keys update an offset, sliders update brightness and wave amounts, clicks append vertices, and the next frame shows the result. That one rule appears again and again in this project.

## How the code is organised

`main.js` is split into one self-contained block per canvas, each wrapped in an IIFE so no block leaks variables into another. A few shared helpers keep the blocks consistent:

- `initGL()` takes a canvas id and returns the context, the compiled program, one VAO, one buffer, and every attribute and uniform location. Each canvas owns its own context and program, so one canvas can never disturb another.
- `setupInterleaved()` uploads one `Float32Array` and describes its layout once. Two floats of position, then three floats of colour, repeating every five floats.
- `setUniforms()` sends one frame of parameters: time, offset, point size, wave amount, brightness, and global brightness.
- `pixelToNdc()` turns a mouse event into Normalized Device Coordinates, accounting for CSS scaling, so clicks land exactly where the cursor is.
- `row()` produces one key/value line for the live data panels.

The shaders live in `index.html` inside `<script type="x-shader">` tags instead of long JavaScript strings, so GLSL reads as GLSL. JavaScript fetches the source with `getShaderSource()`, compiles each stage with `createShader()`, and links both stages with `createProgram()`. Keeping the languages visually separate made every shader mistake far easier to spot.

The palette is converted once to the 0 to 1 range WebGL expects:

```js
var PALETTE_HEX = ["#4DF3FF", "#6BE4D2", "#76A8FF", "#70B2E6", "#D9E6F2"];
```

Reusing the palette keeps both practicums visibly part of one site, and every canvas draws from it.

## Coordinates: why the GPU uses its own space

Canvas 2D grows x to the right and y downward in pixels. WebGL instead works in Normalized Device Coordinates, where both axes run from -1 to 1 and y points up. The GPU needs one standard space so the same vertex data renders identically on any canvas size, which is why the conversion happens at the boundary:

```js
return { x: (x / r.width) * 2 - 1, y: 1 - (y / r.height) * 2 };
```

A click on the right edge becomes x close to 1, a click at the top becomes y close to 1, and the centre is exactly (0, 0). Everything drawn on this page, static or user-made, is expressed in that space. To keep the space readable, every canvas shows faint lines every 32 pixels with brighter axes along the left and bottom edges, plus NDC ruler numbers from -1 to 1. The grid is plain background chrome drawn first and dim, never counted as a primitive.

## Buffers, attributes, and why data takes this route

The GPU cannot read a plain JavaScript array, so vertex data is packed into a `Float32Array`. Floats of 32 bits are exactly what the graphics hardware consumes, and the typed array guarantees that layout with no surprises.

`bindBuffer()` selects which GPU buffer later commands refer to, and `bufferData()` copies the array into it. Static geometry uses `STATIC_DRAW` because it is uploaded once, while user-drawn shapes use `DYNAMIC_DRAW` because they are re-uploaded whenever a drag finishes.

Position and colour share one buffer in interleaved order: x, y, r, g, b, x, y, r, g, b, and so on. One vertex therefore spans five floats, which is expressed as a stride, with the colour starting two floats in:

```js
var stride = 5 * Float32Array.BYTES_PER_ELEMENT;
gl.vertexAttribPointer(st.a_position, 2, gl.FLOAT, false, stride, 0);
gl.vertexAttribPointer(st.a_color, 3, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
```

The position attribute reads two components, the colour attribute reads three, and both step forward by the same stride. Getting that stride or offset wrong makes colours appear as positions, which is immediately visible as garbage on screen. Each canvas stores this whole description in its VAO, so drawing later is just binding the VAO and issuing draw calls.

## Shaders: two small programs with two different jobs

The vertex shader runs once per vertex. It positions the point, adds a small sine wave and the keyboard offset, sets the point size, and forwards the colour:

```glsl
in vec2 a_position;
in vec3 a_color;
uniform float u_time;
uniform vec2 u_offset;
uniform float u_pointSize;
uniform float u_waveAmount;
out vec3 v_color;
```

The fragment shader runs once per pixel. It multiplies the incoming colour by the per-draw brightness and the global slider value:

```glsl
in vec3 v_color;
uniform float u_brightness;
uniform float u_globalBrightness;
out vec4 outColor;
```

There are always far more fragments than vertices, because one triangle of three vertices can cover thousands of pixels, and each of those pixels needs its own colour. The varying `v_color` is what connects the two stages. Declared as `out` in the vertex shader and as `in` with the same name and type in the fragment shader, it is interpolated automatically across the surface. That interpolation is why a triangle with a red, a green, and a blue corner blends smoothly between them.

The names follow one convention everywhere. `a_` for per-vertex attributes, `u_` for per-draw uniforms, `v_` for values passed between shaders. The string in JavaScript must match the GLSL name exactly, or the location comes back null and that input silently does nothing.

## The main playground

The core canvas is 800 × 500. Its static geometry is 33 interleaved vertices covering every primitive family. Three bottom triangles, three points, two separate lines, one line strip, one closed loop, one triangle strip, and one triangle fan. Points sit at y 0.32 so their larger sizes clear the strip and fan below them.

Draw mode, not data, decides what appears. The same buffer is drawn more than fifteen times per frame with different uniforms. The three bottom triangles use brightness 0.45, 1.0, and 1.45, which changes only intensity, never hue. The three points use sizes 10, 24, and 40. Point size has no effect on triangles or lines; it is only read when the assembled primitive is a point.

Every filled shape is drawn twice. A dimmer `TRIANGLES` fill plus a brighter `LINE_LOOP` outline over the same vertices. The strip and fan get the same treatment, so the whole canvas reads as soft fills with crisp edges.

### Drawing with the mouse

Three tool buttons select exactly one draw tool, Triangles by default. Six swatches select the draw colour. The five site colours plus an RGB swatch whose triangles carry red, green, and blue corners. Dragging on the canvas draws the active tool with a dashed cyan ghost preview. WebGL has no dashed-line state, so the dashes are built as short `LINES` segments sized to about five screen pixels each. Releasing commits an equilateral triangle sized by the drag length, a line from drag start to end, or a point at the release position. A plain click still works and drops a small shape. Reset clears every user shape.

### Movement, wave, and the keyboard

Three of the bottom triangles drift on their own with independent velocities and bounce inside a small range, which demonstrates per-object motion without any matrix. Each draw simply adds that object's offset to the shared keyboard offset. The wave slider feeds `u_waveAmount` into `sin(u_time + x * 8.0)`, so strips, loops, and the fan ripple. The animation lives in the vertex shader because that is where positions exist; the fragment shader only ever sees colours.

The keyboard uses the state-based pattern. `keydown` and `keyup` maintain a map of held keys, and each frame the map is read to move the shared offset, clamped to a small range so the composition never falls apart:

```js
if (keys.ArrowLeft || keys.a) offsetX -= ms;
if (keys.ArrowRight || keys.d) offsetX += ms;
```

Discrete actions stay event-based: R resets the offset, Space or P pauses, C re-randomises the point colours, and the buttons mirror all three. Brightness and speed sliders behave like the reference program, scaling output intensity and the animation clock.

## Challenge A: primitive selector

Three vertices drawn three ways. The Triangle, Points, and Lines buttons only change the first argument of `drawArrays`; the buffer and the shaders never change. Points render at size 26 so the three dots are easy to see, and the triangle gets its bright outline while the other modes do not. The lesson is that assembly is a draw-time choice.

## Challenge B: colour control

One triangle whose three corners start red, green, and blue. The colour buttons rewrite the colour half of the buffer, while the brightness slider only scales the global uniform, which keeps the data-versus-parameter distinction visible. Random shuffles all three corners at once, and pressing it several times is the fastest way to see interpolation at work. The outline follows at a fixed step above the fill so the edge stays legible at any brightness.

## Challenge C: spawn primitive

Each click converts the cursor to NDC, appends one vertex with the next palette colour, and re-uploads a dynamic buffer capped at thirty points. Clear empties the array. The whole feature is three ideas: convert, append, redraw.

## Challenge D: multiple moving objects

Three identical triangles with three velocities and three brightness levels share one buffer and one program. Each carries its own offset, and the bounce test accounts for the triangle's half size, flipping velocity when a corner would cross NDC ±1 (offsets clamp at ±0.85 horizontally and -0.88 to 0.84 vertically). Same code path, different numbers, different motion.

## Challenge E: procedural pattern

No vertex is typed by hand. One loop builds a dim 10 by 4 dotted grid along the bottom, and a second loop builds a bright centred ring above it with cosine and sine around (0, 0.45) at radius 0.28. The gap between them is deliberate so nothing collides. Two loops, two draw calls, and changing one number reshapes the entire composition, which is the whole point of procedural geometry.

## Challenge F: uniforms and HUD

One small triangle drawn three times with brightness 0.35, 1.0, and 1.6 and wave 0.0, 0.03, and 0.06. It is the clearest proof that one program serves many objects. The geometry and the shaders never change, only the uniforms sent before each draw. The overlay box is plain HTML positioned over the canvas, because WebGL has no text rendering. It reports the three uniform sets, the global slider, and the pause state every frame.

## Where each requirement is met

| Requirement | Where it is implemented |
|---|---|
| WebGL2 context | Every canvas via `initGL()`; a message replaces the canvas if unavailable |
| Shader source in `<script>` tags | `vertex-shader` and `fragment-shader` blocks in `index.html`, GLSL ES 3.00 |
| At least 2 attributes | `a_position` (vec2) and `a_color` (vec3) on every canvas |
| At least 4 uniforms | Six: `u_time`, `u_offset`, `u_pointSize`, `u_waveAmount`, `u_brightness`, `u_globalBrightness` |
| At least 1 varying | `v_color`, `out` in the vertex shader and `in` in the fragment shader |
| VAO plus interleaved data | One VAO per canvas; stride of five floats with position and colour offsets |
| At least 4 draw calls | The main canvas issues 15+, each challenge at least 2 |
| At least 3 primitive types | Seven: `TRIANGLES`, `POINTS`, `LINES`, `LINE_STRIP`, `LINE_LOOP`, `TRIANGLE_STRIP`, `TRIANGLE_FAN` |
| At least 3 colours | Five palette colours plus red-green-blue, with interpolation visible wherever corners differ |
| At least 1 simple animation | Wave, three drifting triangles, bouncing movers, procedural ring shimmer; no MVP matrix anywhere |
| At least 1 keyboard or mouse interaction | State-based WASD/arrows, R/Space/C/P, drag-to-draw with ghost, click-to-spawn, sliders, toggles |
| No MVP, lighting, or textures | Movement is offsets and sine waves only; colour is vertex colour times uniforms |
| Structured code and clear names | One module per canvas plus `initGL`, `setupInterleaved`, `setUniforms`, `drawScene`, `render` |

## Analysis Questions

### Why does WebGL use NDC?

WebGL uses Normalized Device Coordinates (NDC) so that the same vertex data renders identically regardless of the canvas size. Both axes range from -1 to 1, with the y-axis pointing upward. The GPU requires a standardized coordinate space that is independent of pixel dimensions. The conversion happens at the boundary: pixel x is converted to `(x / width) * 2 - 1`, and pixel y is converted to `1 - (y / height) * 2`.

### What is the function of Float32Array?

`Float32Array` stores vertex data as 32-bit floating-point values, which is exactly the format consumed by graphics hardware. A typed array guarantees a predictable memory layout. A regular JavaScript array cannot be read directly by the GPU.

### Why does vertex data need to be placed in a buffer?

The GPU cannot read a regular JavaScript array directly. The data must be copied into GPU memory through a buffer object. The buffer resides in graphics memory, where the vertex shader can access the vertex data efficiently.

### What is the function of `gl.bindBuffer()`?

`gl.bindBuffer()` selects which buffer object is referenced by subsequent commands. The selected buffer becomes the active target for operations such as `bufferData()` and `vertexAttribPointer()`.

### What is the function of `gl.bufferData()`?

`gl.bufferData()` copies client-side array data into the currently bound GPU buffer. The usage hint (`STATIC_DRAW` or `DYNAMIC_DRAW`) tells the driver how the data will be accessed, allowing it to optimize the buffer's placement and usage.

### What is the difference between a vertex shader and a fragment shader?

The vertex shader runs once for each vertex. It positions points, applies animation offsets, sets point size, and passes color information to the next stage. The fragment shader runs for each fragment (potential pixel). It receives the interpolated color and applies brightness scaling. The vertex stage handles geometry, while the fragment stage handles pixel color.

### Why can there be more fragments than vertices?

A single triangle with three vertices can cover thousands of pixels. Every covered pixel can invoke the fragment shader once. Therefore, the number of fragments scales with the area covered on the screen, while the number of vertices remains fixed.

### What is the function of `vertexAttribPointer()`?

`vertexAttribPointer()` tells the GPU how to read the currently bound buffer for a specific vertex attribute. It specifies the number of components, data type, normalization, stride, and offset. The position reads two floats starting at offset 0. The color reads three floats starting at an offset of 2 floats (8 bytes). Both attributes advance using the same 20-byte stride.

### What does `gl.TRIANGLES` mean?

`gl.TRIANGLES` tells the primitive assembly stage to group every three vertices into one independent triangle. The first triangle uses vertices 0, 1, and 2; the next uses vertices 3, 4, and 5; and so on. It is the most basic filled primitive.

### Why is a rectangle represented using triangles?

The GPU natively renders points, lines, and triangles. A rectangle requires two triangles (six vertices) or can be represented using a triangle strip (four vertices). There is no native rectangle primitive.

### What is the benefit of a rendering loop?

`requestAnimationFrame()` schedules a callback approximately 60 times per second. Each frame can upload changed data, update uniforms, and issue another draw call. Changing a uniform or buffer is enough to change the rendered image. The loop makes animation and interaction possible.

### Why do mouse pixel coordinates need to be converted to NDC?

Canvas coordinates increase to the right along the x-axis and downward along the y-axis in pixel space. WebGL works in NDC, where both axes range from -1 to 1 and the y-axis points upward. The conversion also accounts for CSS scaling so that the click position corresponds precisely to the cursor position. Without the conversion, the mouse position would not match the vertex coordinate space.

### What is the relationship between a buffer and an attribute?

A buffer stores raw bytes. An attribute describes how those bytes should be interpreted as input for the vertex shader. `vertexAttribPointer()` connects the two by specifying the stride and offset. A VAO stores these bindings, so later rendering only requires binding the VAO.

### What happens when a draw call is executed?

The GPU reads the bound VAO, fetches vertices from the buffer according to the attribute layout, runs the vertex shader for each vertex, assembles the primitives, rasterizes them into fragments, runs the fragment shader for each fragment, and writes the resulting pixels to the framebuffer.

## Analysis of Attributes, Uniforms, and Varyings

### What is the function of `a_position`?

`a_position` is a per-vertex attribute that contains the 2D coordinates of each vertex in NDC space. It is declared as a `vec2` in the vertex shader and receives the first two floats of each interleaved vertex.

### What is the function of `a_color`?

`a_color` is a per-vertex attribute that contains the RGB color of each vertex. It is declared as a `vec3` and receives the next three floats of each interleaved vertex. The vertex shader passes it to the fragment shader through `v_color`.

### Why does `a_position` use `vec2`?

The playground operates in 2D, so only the x and y coordinates are required. The vertex shader explicitly sets z to 0 and w to 1. Using `vec2` matches the data layout and avoids unused components.

### Why does `a_color` use `vec3`?

The color uses only RGB components. Alpha remains 1.0 in the fragment shader. The three components correspond directly to the three floats stored for each vertex in the interleaved buffer.

### What is the function of `u_brightness`?

`u_brightness` is a per-draw uniform that scales the interpolated vertex color for a single draw call. It allows the same shader to render the same geometry at different brightness levels without modifying the vertex data.

### What is the function of `u_globalBrightness`?

`u_globalBrightness` is a per-frame uniform controlled by a global slider. It scales the brightness of every draw call uniformly, acting as a master brightness control over the individual per-draw brightness.

### What is the function of `u_pointSize`?

`u_pointSize` controls the size of rendered points in pixels. Its value is assigned to `gl_PointSize` in the vertex shader. It only affects draw calls where the primitive mode is `POINTS`.

### What is the function of `u_time`?

`u_time` drives the wave animation. Its value increases every frame and is used in `sin(u_time + x * 8.0)` inside the vertex shader. The strip and fan shapes move or vibrate based on this value.

### What is the function of `u_offset`?

`u_offset` is a `vec2` uniform that translates all vertices in a single draw call. The main playground uses it for keyboard-controlled movement. Challenges D and F use it for per-object movement. The vertex shader adds it to the animated position.

### What is the function of `v_color`?

`v_color` is a varying that carries color information from the vertex shader to the fragment shader. The vertex shader writes the vertex color to it, and the fragment shader reads the interpolated result.

### Why is `v_color` declared as `out` in the vertex shader?

The vertex shader produces a color value for each vertex. Declaring `v_color` as `out` makes it an output that can be interpolated by the graphics pipeline across the primitive. Each vertex has its own color value.

### Why is `v_color` declared as `in` in the fragment shader?

The fragment shader receives the interpolated color for each fragment. Declaring `v_color` as `in` with the same name and type makes it a matching input for the vertex shader's output. The hardware automatically interpolates the colors of the vertices across the surface.


## Reflection

The hardest part to internalise was the interleaved layout, because the stride and offset numbers look arbitrary until a wrong one visibly scrambles the image. The most useful insight was that uniforms are per-draw settings. One compiled program can paint a dim triangle, a huge point, and a rippling strip in the same frame simply because different values are sent before each call. The NDC conversion finally explained why mouse code always divides by canvas size first. The ghost preview taught me the most about WebGL limits, since dashed lines do not exist and each dash has to be constructed as real geometry. I would next like to try genuine transforms with matrices, so offsets stop being added by hand and start flowing through a single uniform matrix instead.

## Running it

Open `index.html` directly in any modern browser. If you prefer a local server, from this folder run:

```
python -m http.server 8000
```

and open `http://localhost:8000/`.
