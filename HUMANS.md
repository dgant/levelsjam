# How To Work On This Project

## Current State
The repository contains a runnable browser game prototype for GitHub Pages. The intended build serves a three.js scene with immediate mouse-look, WASD movement, hold-space vertical thrust, a local Poly Haven `overcast_soil` HDRI used for the visible skybox and IBL, a large `puddle-ground` floor plane, one randomly selected persisted maze built from `stone-wall-29` wall meshes, maze-mounted metal sconces with animated torch billboards, and a backquote visual-controls panel with exposure, IBL intensity, torch candela, torch flicker, ambient-occlusion mode, tone-mapper, post-effect controls, and build metadata in the FPS overlay.

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
- `npm run test:perf` is temporarily disabled while the baked-all-shadows lighting configuration is under evaluation.
- Run the maze-generation validation script or its test entrypoint whenever maze files or maze rules change.
- Verify the main page renders the 3D scene without console errors.
- Verify the loading overlay appears with `MINOTAUR` and `Entering the labyrinth...` before the scene fades in.
- Verify `W`, `A`, `S`, and `D` move the camera.
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
- Verify each maze light location has a warm torch point light and the lights cast shadows.
- Verify torch point lights remain enabled with a 16m light distance.
- Verify torch point lights keep shadows enabled instead of being camera-distance culled.
- Verify every torch shadow map uses the same fixed resolution.
- Verify torch shadow maps bake once and then stop updating while the scene remains static.
- Verify the default `Torch Flicker` value is `0.15`.
- Verify the torch flicker runs at the updated faster rate and that reducing `Torch Flicker` toward `0.00` steadies the torch brightness.
- Verify the fire flipbook runs at the updated faster rate.
- Verify the tone mapper is `AgX` by default.
- Verify the visual controls panel exposes `Exposure`, `IBL Intensity`, `Torch Candelas`, `Torch Flicker`, `Ambient Occlusion`, `AO Intensity`, the tone mapper, and the enabled/intensity controls for Bloom, Depth Of Field, Lens Flares, SSR, and Vignette.
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
- Verify enabling lens flares produces a visible flare around a visible torch.
- Verify changing lens-flare opacity visibly changes the flare strength.
- Verify the smallest nonzero lens-flare setting is still subtle enough to be useful.
- Verify lens flares do not flicker between arbitrary torches from frame to frame.
- Verify the Bloom kernel-size control produces a visible bloom change.
- Verify SSAO now produces a visible change where contact darkening should occur.
- Verify the volumetric-lighting controls produce visible changes in the full-scene fog volume rather than in per-torch cone meshes.
- Verify the fog volume occupies the maze footprint from ground level up to roughly 6 meters.
- Verify each control row in the visual controls panel keeps the value, label, and control on one line in that order.
- Verify the FPS counter appears in the top-right corner and includes the Git revision and revision timestamp.
- Verify pressing backquote opens the visual controls panel.
- Verify the panel no longer exposes obsolete atmosphere or sun controls.
- Verify opening the panel releases mouse lock and clicking inside the panel does not relock the pointer.
- Verify the loading subtitle width stays visually stable while the animated dots change.
- Verify the loaded scene uses one of the persisted maze files instead of the previous random wall field.
- Verify the repository contains at least five valid maze files and that maze validation remains under 100ms per generated maze.
- Benchmark startup with `npm run bench:startup` and test duration with `npm run bench:tests` before handoff.
- Treat duration regressions as blocking issues.
- Treat the temporary `test:perf` disablement as intentional until the baked-all-shadows lighting evaluation ends.
- Keep `npm run test:unit` under 20 seconds.
- Keep the prepared smoke runner `npm run test:smoke:runner` under 1 minute after a single `npm run build:pages`.
- Latest measured benchmark on April 5, 2026: `node scripts/benchmark-startup.cjs` reached the first bright frame in about `268.2ms` on the background dev server, `npm run test:unit` took about `4626ms`, `npm run test:perf:runner` took about `5100ms`, and the prepared `npm run test:smoke:runner` took about `28479ms`.

## Deployment
- The project is intended for GitHub Pages hosting.
- The current GitHub Pages setup publishes directly from the repository root on `main`.
- Run `npm run build:pages` before pushing when the live site needs updated production assets.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
