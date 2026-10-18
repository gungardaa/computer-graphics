# Practicum 7 - Three.js Interactive 3D Application

**Author** Anak Agung Putu Arda Nareswara <br>
**NRP** 5025241074 <br>
**Class** B

Web https://ardanareswara-computer-graphics.vercel.app

This is my seventh assignment for Computer Graphics and the prototype for the
UTS Interactive Web 3D Project. Meeting 6 built a static Mini 3D Scene while
this page turns it into an interactive application. One hierarchy demo group
shows parent and child transforms with live local against world readouts. One
PBR sphere carries live roughness and metalness. One imported GLB robot brings
real hierarchy plus skinning plus fourteen animation clips through an
AnimationMixer. OrbitControls explores the scene with distance and angle
limits while a Raycaster links the pointer to the objects, so hover and click
each hold their own state. All twelve module experiments run inside the Main
Stage and all eight challenges run as separate live labs below it.

Run the lab from this folder with the commands below. A static host serves the
built preview while dev serves the source directly.

```sh
npm install
npm run dev
```

Open the URL printed by Vite and pick Practicum 7 from the home page. From this
folder alone the dev server serves the page at the practicum7 path.

## Scene graph

```text
Scene
├── AmbientLight
├── DirectionalLight with shadows
├── Ground plane plus grid
├── Hierarchy Demo Group
│   ├── Body Mesh
│   │   ├── Head Mesh
│   │   └── Child Object Mesh
│   └── (registered as one selectable entity)
├── PBR Sphere Mesh
└── Imported GLB
    └── RootNode
        └── RobotArmature plus 74 nodes in total
```

## Hierarchy parent child

The hierarchy group holds a body plus a head plus a small child box. The head
and the child are children of the body, not of the scene, so moving or
rotating the group carries every descendant with it. The Group X slider moves
the whole group, the Group rot Y slider turns it, and the Child X slider moves
only the small box. The Live data panel prints the child local position next
to its composed world position every frame, so the contrast stays visible
while the parent turns. The Log button prints both vectors into the Console on
demand.

## GLB model

The imported model is RobotExpressive.glb served from public models. It packs a
skinned robot with a deep bone hierarchy, fourteen animation clips, and three
materials. The loader treats it as a hierarchy, never as one mesh. A traverse
pass turns on castShadow and receiveShadow for every mesh under it and counts
74 nodes plus 14 meshes, and the whole root is registered as one selectable
entity so any child mesh under the ray maps back to the labeled root.

## Asset source

RobotExpressive by Tomas Laulhe with modifications by Don McCurdy, CC0, taken
from the three.js examples asset set at the r160 tag of the three.js
repository. The environment is procedural through RoomEnvironment plus
PMREMGenerator, so no environment image file is needed.

## Animation clips used

The mixer builds one action per clip across Idle, Walking, Running, Dance,
Death, Sitting, Standing, Jump, WalkJump, Yes, No, Wave, Punch, and ThumbsUp.
Idle plus Walking plus Running plus Dance loop, the rest play once and clamp at
the last pose. The stage Clip select crossfades between clips at 0.3 seconds
without a reload. Lab A swaps Idle plus Walking plus Running with buttons or
the 1 2 3 keys, and Lab B plays the Wave gesture once on click then hands
control back to Idle through the finished event. Every clip advances through
mixer.update with delta time clamped at 0.05.

## PBR material

MeshStandardMaterial drives the sphere, the hierarchy meshes, the ground, the
gallery, and the env lab. Roughness and metalness both have a live slider in
the stage plus preset values across the labs.

- Roughness 0.25 in the stage sphere, 0.1 and 0.5 and 0.9 across the gallery
  rows, 0.15 on the polished env lab sphere, and 0.9 on the matte one
- Metalness 0.1 in the stage sphere, 0 and 0.5 and 1 across the gallery
  columns, and 0.95 on the polished env lab sphere

## Interaction

- Drag orbits, scroll zooms, right drag pans through OrbitControls with
  minDistance 3, maxDistance 25, minZoom 0.5, maxZoom 3, and a polar angle
  held above the horizon
- A click raycasts the interactive list and selection persists until the next
  click
- A drag never selects since the pointer gesture flag suppresses selection
  once travel passes 5 pixels, even when the pointer returns to the start
- The Recursive toggle shows why imported models need recursive intersection.
  With it off the robot child meshes fall out of reach while the primitives
  still select
- P swaps the perspective and orthographic cameras while positions plus
  target plus zoom carry across, and Reset restores the perspective camera
  seat, target, and FOV
- E and Space and the buttons mirror the environment, pause, and raycast flags

## Hover and click feedback

Hover is temporary and click is persistent, so they live in two variables. A
hovered object scales to 1.06 and returns to its base when the pointer leaves,
yet a selected object holds 1.12 even under a later hover. The HUD chips name
the hovered label, the selected label, the active clip, and the loading state
at all times. Lab F adds an emissive glow on hover with one material per
sphere so nothing shared is mutated destructively.

## Environment

RoomEnvironment runs through PMREMGenerator into scene.environment while
scene.background stays a flat navy color, which shows the difference directly.
The Env button and the E key flip scene.environment on and off so a metal
surface can be seen losing its reflections. Lab H does the same with a
polished sphere against a matte one. The metal look depends on the
environment, not on the background.

## Challenges done

All eight are live with one canvas each.

- A. Clip switchboard with crossfade across Idle plus Walking plus Running
- B. Click plays the Wave gesture once then returns to Idle
- C. Information panel with name plus position plus rotation plus scale plus
  material type per selected root
- D. Hierarchical solar system with Sun plus Earth orbit plus Earth plus Moon
  orbit plus Moon and live world readouts
- E. PBR gallery with nine spheres across roughness rows and metalness columns
- F. Hover emissive with base colors stored in userData
- G. Selection rotation that spins only the selected shape with delta timing
- H. Environment toggle with E plus a HUD state line

## Debugging notes

- Model missing. Confirm public models model.glb exists and the Console has no
  404 error
- Model dark. Confirm the environment is on and the directional light is up
- Animation still. Walk the chain from clips length to clipAction to play to
  mixer.update delta
- No shadow from the robot. Confirm the traverse pass set castShadow and the
  renderer map flag is on
- Robot selects as whole but child meshes do not hit. Confirm the recursive
  raycast flag is on
- Metal too dark. That is the honest look without environment light, flip the
  Env button to see the difference

## Understanding in brief

The scene graph is one tree where every child inherits the transform of every
ancestor, so a robot part moves with its arm and the arm moves with the body.
Local position lives on the node while world position composes the chain, and
getWorldPosition proves the difference each frame. GLB packs mesh plus
material plus texture plus hierarchy plus animation into one binary and
GLTFLoader rebuilds it asynchronously, which is why logic waits inside the
callback. AnimationMixer plays clips toward object properties and only delta
time moves the pose forward. Raycasting converts the pointer into NDC, builds
a ray through the camera, and reports intersections, which links a 2D pointer
to 3D objects. Hover and click need separate state since one is a passing
glance and one is a decision. Environment light is what gives PBR surfaces
their reflections while the background stays scenery.

## Reflection

Scene graph helped most since one group transform moved three meshes with zero
extra code and the same idea later carried a whole robot. The local against
world readout made matrix composition concrete for me for the first time.
Roughness and metalness felt like two dials that shape light rather than
paint, and flipping the environment off with metalness at 1 showed how much
metal depends on its surroundings. Loading the GLB was the part that needed
patience since everything about the model has to wait for the callback. The
AnimationMixer turned fourteen clips into one action map that swaps with a
crossfade. My main bug was selection firing after an orbit drag, which the
5 pixel gesture flag fixed cleanly. The finished event from the mixer made the
gesture hand back feel natural instead of timed by guess.

## Where each requirement is met

The stage covers every module experiment. Scene plus PerspectiveCamera plus
antialiased renderer open the page with responsive resize. Ground plus ambient
plus directional light plus the four link shadow chain light the set. One
THREE.Group carries the parent child hierarchy with local transforms, and the
world readout demonstrates composition live. MeshStandardMaterial appears with
live roughness and metalness sliders. The GLB robot loads through GLTFLoader,
gets traversed, casts shadow, and runs clips through the AnimationMixer with
delta. The Raycaster with pointer NDC drives hover plus click plus selection
state plus scale feedback plus HUD, with the recursive toggle proving why
recursion matters. RoomEnvironment feeds scene.environment while the
background stays separate. The Console stays clean in normal use.
