# The Backrooms: Entity Survival
**CSE 160 - Assignment 3 (Building a Virtual World)**

A first-person survival horror game set in a 48×48 procedurally-textured maze.
You spawn in the west end of the main corridor; an entity (a 6-part articulated
"bacteria man" mesh) spawns in the south-east corner and chases you through
the maze using BFS pathfinding. Find the wooden exit door on the north-east
wall and click on it within 2 minutes - or you'll be caught.

## How to run
1. Open the project folder in VS Code.
2. Right-click `index.html` and choose **Open with Live Server** (any static
   HTTP server works; the OBJ baking is already done so no Python is needed).
3. Click the canvas to enter pointer-lock mode and start the game.

## Controls
| Key                | Action                                         |
| ------------------ | ---------------------------------------------- |
| `W` `A` `S` `D`    | Walk forward / strafe left / back / strafe right |
| **Shift** (hold)   | Sprint (1.7× speed, drains the stamina bar)    |
| Mouse              | Look around (yaw + pitch)                      |
| `Q` / `E`          | Pan camera left / right (keyboard fallback)    |
| Left mouse button  | Interact - click the wooden door to escape    |
| `Esc`              | Release mouse                                  |

The game does not start until you click the canvas - the timer and the entity
both freeze on the lock-screen.

## Rubric coverage
| Requirement                                   | Where it lives                                                      |
| --------------------------------------------- | ------------------------------------------------------------------- |
| ≥ 32×32 textured map                          | [world.js](world.js) - 48×48 grid `g_Map[x][z]`, four texture groups |
| Perspective camera + WASD + Q/E + mouse look  | [camera.js](camera.js), [main.js](main.js#L327) (`setupInput`, `processInput`) |
| ≥ 3 textures with NEAREST filtering           | [main.js](main.js#L114) - 4 samplers (sandstone-side, mossy cobble, sandstone-top, oak-door) |
| Procedural fallback when texture image is missing | [main.js](main.js#L253) (`loadTexture`, `generateFallbackTexture`) |
| Hierarchical animated character (multi-part)  | [entity.js](entity.js) (`drawEntity`), [animSystem.js](animSystem.js), [anim.json](anim.json) |
| Loaded `.obj` mesh                            | [models/](models/) (7 OBJs) baked into [entity_model.js](entity_model.js) by `models/bake_entity.py` |
| Lighting / shading                            | [shaders.js](shaders.js) - 4 flickering point lights, sickly-yellow fog |
| FPS counter                                   | [main.js](main.js#L429) (`updateFps`) - element `#fps`               |
| Mouse interaction with the world              | [main.js](main.js#L362) (`onMouseDown` → `getTargetCell` → `triggerWin`) |
| Storyline / theme / audio                     | Backrooms theme: heartbeat-style proximity tone + 60/120 Hz hum (`initAudio` in main.js) |

## Architecture (file-by-file)

**Rendering pipeline**
- [shaders.js](shaders.js) - vertex + fragment GLSL. Vertex passes interleaved
  `(position, uv, normal)`. Fragment does 4 point-light diffuse + attenuation
  with per-light flicker, sickly-yellow fog (near = 4, far = 14), and a
  `u_texColorWeight` mode switch between textured world and solid-colour entity.
- [cube.js](cube.js) - interleaved 8-float-per-vertex cube with 6 face indices
  used to build the world, plus a single shared cube buffer used by the
  fallback skybox/debug primitives.
- [world.js](world.js) - `initMap()` carves the 48×48 maze; `buildWorldGeometry()`
  batches all visible faces into 4 VBOs (one per texture group). Hidden-face
  culling: a wall face is only emitted if the neighbouring cell is shorter.
  The exit door is rendered as a partial-height door texture (only `y < 2`),
  with the wall texture continuing above it - so the door visibly looks like
  a short doorway in a tall wall.
- [camera.js](camera.js) - yaw/pitch first-person camera. `updateViewMatrix()`
  rebuilds the lookAt; `panLeft`/`panRight`/`lookVertical` steer it.

**Entity system**
- [entity_model.js](entity_model.js) - auto-generated. Six per-part typed
  arrays (interleaved `(x,y,z,u,v,nx,ny,nz)`, stride 32 bytes) plus a
  merged fallback mesh + bounding-box constants for centering. Pre-baked
  from the OBJs in [models/](models/) so the game has zero OBJ-parse cost
  at startup.
- [animSystem.js](animSystem.js) - JSON keyframe loader (`loadAnim`) and
  per-node interpolator (`getInterpolatedTransform`) that returns a `Matrix4`
  `T(translation) · T(pivot) · Rz · Ry · Rx · T(-pivot)` after lerping
  between bracketing keyframes. Time wraps modulo `duration` for seamless loops.
- [anim.json](anim.json) - 1-second walk cycle with 6 nodes (body, head,
  arm-left, arm-right, leg-left, leg-right), each defined by a pivot point
  and a list of `{time, translation, rotation}` keyframes. Head uses
  intentionally non-uniform keyframe spacing for unpredictable creepy twitching.
- [entity.js](entity.js) - entity AI + drawing.
  - `initEntityModel()` uploads one VBO per body part plus a merged fallback.
  - `_recomputePath()` runs BFS from the player's grid cell every 0.25 s
    across the maze, building a flow-field `nextDir[ix][iz]` that points
    toward the player - so the entity navigates corridors instead of going
    in a straight line through walls.
  - `_hasLineOfSightToPlayer()` is a cheap DDA grid raycast; when the player
    is in sight within 9 units, the entity gets a 1.45× **burst speed**.
  - `drawEntity()` uses a manual matrix stack: body is the root
    (`M_world · M_body_anim`), the other 5 parts are children
    (`M_world · M_body_anim · M_child_anim`).

**Game loop**
- [main.js](main.js) - WebGL boot, attribute/uniform binding, texture loading
  (with procedural pixel-art fallback), input wiring, and the per-frame
  `tick()`. Also owns the sprint stamina state (`g_sprint`, drains while
  Shift+move, regenerates while idle), the 120 s countdown, the lose/win
  triggers, and the heartbeat-modulated proximity audio.

## Notes for the grader
- **All required rubric features are implemented in vanilla WebGL 1** - no
  Three.js, no Babylon.js, no glTF runtime loaders. The OBJ data is baked
  into a JS file at build time so the game has zero file-IO at startup
  beyond textures + `anim.json`.
- The "animal" requirement is satisfied by the **hierarchical 6-part entity**
  with a keyframe walk cycle and a manual matrix stack - see
  `_drawEntityHierarchical` in [entity.js](entity.js).
- World-modification interaction is satisfied by the **door click**: the
  `onMouseDown` handler casts a 1.7-unit forward ray, finds the target grid
  cell, checks `isDoor()`, and triggers the win. (The door is a "block"
  marked with `g_MapType = DOOR_TYPE`.)
- FPS is shown top-left and stays >150 on a typical laptop with the
  full 48×48 maze (~900 open cells).
- The empty-canvas grace period (game pauses until first pointer-lock click)
  prevents the entity from killing you while you're reading the prompt.

## Asset credits
- All wall / floor / ceiling / door textures: Minecraft Wiki public-domain
  16×16 tile dumps in [textures/](textures/). When a texture file is missing
  or fails to decode, a procedural pixel-art canvas of the same style is
  generated at runtime so the scene is always renderable.
- Entity OBJ mesh: original work, modelled in Blender, exported per-part
  with shared origin-coordinates so the joint-rotation pivot trick works.
