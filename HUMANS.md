# How To Work On This Project

## Current State
The repository contains a runnable browser game prototype for GitHub Pages. The intended build serves a three.js scene with immediate mouse-look, WASD movement, hold-space vertical thrust, a local Poly Haven `overcast_soil` HDRI used for the visible skybox and IBL, an infinite `puddle-ground` base plane plus a maze-local lit floor patch, one randomly selected persisted maze built from `stone-wall-29` wall meshes, maze-mounted metal sconces with animated torch billboards, baked per-maze torch lightmaps, static local reflection probes for in-maze specular response, and a backquote visual-controls panel with exposure, IBL intensity, torch candela, ambient-occlusion mode, tone-mapper, post-effect controls, and build metadata in the FPS overlay.

## Local Setup
- Install Node.js 20 or newer.
- Install dependencies with `npm install`.
- Start the dev server with `npm run dev`.
- Start one reusable headless Vite instance with `npm run dev:bg`.
- Check that background instance with `npm run dev:bg:status`.
- Stop that background instance with `npm run dev:bg:stop`.
- Open the local URL printed by the dev server.
- For agent work, prefer one long-lived headless Vite instance instead of repeatedly opening new visible windows.

## Build
- Create a production build with `npm run build`.
- Verify the root-published production build with `npm run preview`.
- Refresh the legacy GitHub Pages publishable files with `npm run build:pages`.

## Testing
- Run the production build before handoff.
- Run `npm run test:unit` to verify player spawn and collision math.
- Run `npm run test:smoke` to exercise the built page through Playwright.
- Run `npm run test:smoke:runner` when `npm run build:pages` has already prepared the root-published bundle.
- Treat a scene that shows only the HDRI skybox and flame billboards as a render failure; the smoke test now checks that a real maze wall writes visible beauty-pass color.
- `npm run test:perf` is temporarily disabled while the static baked-lightmap torch-lighting evaluation is under way.
- Run the maze-generation validation script or its test entrypoint whenever maze files or maze rules change so persisted mazes keep their baked lightmaps in sync.
- Verify the main page renders the 3D scene without console errors.
- Verify the loading overlay appears with `MINOTAUR` and `Entering the labyrinth...` before the scene fades in.
- Verify `W`, `A`, `S`, and `D` move the camera.
- Verify the top-right overlay shows the active maze ID, Git revision, and revision timestamp.
- Verify `F9` toggles the top-right overlay.
- Verify the ground, walls, and sconces are using their full requested PBR material stacks when the current task calls for full-fidelity rendering rather than compatibility simplification.
- Verify mouse movement changes view direction after an explicit click locks the pointer to the canvas.
- Verify holding `Space` applies upward thrust and releasing it stops the ascent.
- Verify the player starts 1 meter above the ground plane.
- Verify ground contact is stable: the character should rest on collision instead of popping upward and falling again in a loop.
- Verify the player collides with maze walls and can slide along them instead of repeatedly stopping on corners.
- Verify horizontal speed, vertical speed, fall speed, acceleration, deceleration, and gravity match the documented targets.
- Verify horizontal motion follows the current camera-relative input direction and that directly opposing input decelerates rather than accelerates through the turn.
- Verify mouse lock releases on escape-style modifier keys and only re-engages after an explicit click on the scene canvas.
- Verify the visible skybox comes from local `overcast_soil_1k.hdr`.
- Verify `IBL Intensity 1.00x` is the canonical authored HDRI baseline rather than a corrective fudge factor.
- Verify the visible skybox brightness tracks the same calibrated HDRI path as the environment lighting.
- Verify the ground, maze walls, and sconces load the committed PBR texture packs instead of preview images.
- Verify the torch billboard uses the linked flipbook asset rather than a generated placeholder atlas.
- Verify the torch billboard uses the linked `CampFire_l_nosmoke_front_Loop_01_4K_6x6.png` atlas.
- Verify each sconce renders with the requested `metal-13` PBR textures rather than a debug material.
- Verify the sconces are visibly readable outside the maze walls rather than disappearing into the surface behind them.
- Verify the torch billboards animate and stay camera-facing even on walls whose parent groups are rotated.
- Verify the visible flame fills the 0.5m billboard and that the billboard bottom edge is flush with the sconce top.
- Verify each persisted maze includes baked torch lightmap data.
- Verify the baked lightmap visibly affects the maze walls and the maze-local lit floor patch in the rendered scene.
- Verify the infinite base ground remains present outside the lit floor patch.
- Verify baked wall lighting in a wall-facing view, not only in a broad maze overview where the floor can dominate the image.
- Verify the wall-facing view is on the torch-facing side of the wall, not the dark back face.
- Verify the baked wall and floor lighting reads as grayscale intensity carried through the wall and ground PBR materials rather than as a colored post-tonemap overlay.
- Verify the baked floor patch extends beyond the maze footprint by the authored torch-light radius margin.
- Verify the maze floor patch preserves the same puddle-ground world texture scale as the surrounding infinite ground.
- Verify the scene does not rely on realtime torch point lights for maze illumination.
- Verify reflective maze materials respond to the local maze reflection probes rather than only to the global HDRI.
- Verify disabling `Reflection Captures` removes the local probe contribution from the puddled maze floor while leaving the global HDRI environment intact.
- Verify enabling `Show Reflection Probes` draws a probe sphere at each maze probe position.
- Verify `window.__levelsjamDebug.getReflectionProbeState()` reports a nonzero probe count and becomes `ready: true` after load.
- Verify moving the camera between maze cells does not change `window.__levelsjamDebug.getReflectionProbeState().activeProbeId` from `null` or make the scene lighting flicker.
- Verify the fire flipbook runs at the updated faster rate.
- Verify the tone mapper is `AgX` by default.
- Verify the visual controls panel exposes `Exposure`, `IBL Intensity`, `Torch Candelas`, `Ambient Occlusion`, `AO Intensity`, the tone mapper, and the enabled/intensity controls for Bloom, Depth Of Field, Lens Flares, SSR, and Vignette.
- Verify the visual controls panel also exposes `Baked Lightmaps`, `Reflection Captures`, and `Show Reflection Probes`.
- Verify the visual controls panel also exposes `Bloom Kernel`, `AO Radius`, `DOF Focus Distance`, `DOF Focal Length`, `Depth Of Field Bokeh Scale`, and the volumetric fog controls.
- Verify the visual controls panel exposes `Move Speed`, `Accel Distance`, and `Decel Distance`.
- Verify the `DOF Focus Distance` slider reaches 8 meters.
- Verify the `IBL Intensity` and `Torch Candelas` sliders each cover a wide enough range to rebalance the HDRI and torches without touching the exposure stops control.
- Verify Bloom, Depth Of Field, Lens Flares, and SSR start disabled.
- Verify the default `Exposure` value is `-4.5`.
- Verify each sconce, billboard, and torch light sits one sconce radius outside the wall face rather than intersecting the wall.
- After `npm run test:smoke`, inspect any saved rendering artifacts if the smoke checks fail.
- Verify changing `Exposure` changes rendered brightness by stop differences.
- Verify changing `Exposure` updates `canvas[data-renderer-exposure]`.
- Verify the `Ambient Occlusion` dropdown switches between `Off`, `N8AO`, and `SSAO` and that both AO modes visibly darken contact areas compared with `Off`.
- Verify `Ambient Occlusion` starts at `Off` in the default scene.
- Verify the `AO Radius` control produces a visible radius change in the selected AO mode.
- Verify enabling SSR from the visual controls panel does not introduce page errors or halt rendering.
- Verify enabling SSR visibly changes reflective surfaces.
- Verify enabling SSR does not make the visible HDRI skybox jump brighter.
- Verify enabling SSR does not reflect the torch billboards or their transparent pixels.
- Verify enabling SSR with `0` intensity produces no visible scene change.
- Verify enabling lens flares produces a visible flare around a visible torch.
- Verify changing lens-flare opacity visibly changes the flare strength.
- Verify the smallest nonzero lens-flare setting is still subtle enough to be useful.
- Verify lens flares do not flicker between arbitrary torches from frame to frame.
- Verify enabling lens flares with `0` intensity produces no visible scene change.
- Verify the Bloom kernel-size control produces a visible bloom change.
- Verify SSAO now produces a visible change where contact darkening should occur.
- Verify the volumetric-lighting controls produce visible changes in the full-scene fog volume rather than in per-torch cone meshes.
- Verify the fog volume occupies the maze footprint from ground level up to roughly 6 meters.
- Verify enabling Depth Of Field with `0` bokeh scale produces no visible scene change.
- Verify each control row in the visual controls panel keeps the value, label, and control on one line in that order.
- Verify the FPS counter appears in the top-right corner and includes the Git revision and revision timestamp.
- Verify pressing backquote opens the visual controls panel.
- Verify the panel no longer exposes obsolete atmosphere or sun controls.
- Verify opening the panel releases mouse lock and clicking inside the panel does not relock the pointer.
- Verify the loading subtitle width stays visually stable while the animated dots change.
- Verify the loaded scene uses one of the persisted maze files instead of the previous random wall field.
- Verify the repository contains at least five valid maze files, that each maze file includes baked lightmap data, and that maze topology generation remains under 100ms before the later bake step.
- Benchmark startup with `npm run bench:startup` and test duration with `npm run bench:tests` before handoff.
- Treat duration regressions as blocking issues.
- Treat the temporary `test:perf` disablement as intentional until the static baked-lightmap torch-lighting evaluation ends.
- Keep `npm run test:unit` under 20 seconds.
- Keep the prepared smoke runner `npm run test:smoke:runner` under 1 minute after a single `npm run build:pages`.
- Latest measured benchmark on April 17, 2026: `npm run bench:startup` on the dev server reached the first rendered frame in about `1.14s`; `npm run build` took about `4.1s`; `npm run test:unit` took about `1.8m`; `npm run test:perf:runner` remains intentionally skipped during the static baked-lightmap evaluation; and `npm run test:smoke` took about `2.3m` including `build:pages`.

## Deployment
- The project is intended for GitHub Pages hosting.
- The current GitHub Pages setup publishes directly from the repository root on `main`.
- Run `npm run build:pages` before pushing when the live site needs updated production assets.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
