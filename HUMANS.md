# How To Work On This Project

## Current State
The repository contains a runnable browser game prototype for GitHub Pages. The current build serves a three.js scene with immediate mouse-look, WASD movement, hold-space vertical thrust, a local Poly Haven `overcast_soil` HDRI used for the visible skybox and IBL, a large `puddle-ground` floor plane, ten deterministic stone walls with metal sconces and animated torch billboards, and a backquote visual-controls panel with exposure EV100, IBL intensity, torch candela, tone-mapper, and post-effect controls.

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
- Verify the main page renders the 3D scene without console errors.
- Verify the loading overlay appears with `MINOTAUR` and `Entering the labyrinth...` before the scene fades in.
- Verify `W`, `A`, `S`, and `D` move the camera.
- Verify mouse movement changes view direction without a preliminary click.
- Verify holding `Space` applies upward thrust and releasing it stops the ascent.
- Verify the player starts 1 meter above the ground plane.
- Verify ground contact is stable: the character should rest on collision instead of popping upward and falling again in a loop.
- Verify the player collides with the walls and can land on top of them.
- Verify horizontal speed, vertical speed, fall speed, acceleration, deceleration, and gravity match the documented targets.
- Verify horizontal motion follows the current camera-relative input direction and that directly opposing input decelerates rather than accelerates through the turn.
- Verify mouse lock releases on escape-style modifier keys and re-engages on ordinary input.
- Verify the visible skybox comes from local `overcast_soil_1k.hdr`.
- Verify the ground, walls, and sconces load the committed PBR texture packs instead of preview images.
- Verify the torch billboards animate and face the camera.
- Verify each wall has a warm torch point light and the lights cast shadows.
- Verify the tone mapper is `AgX` by default.
- Verify the visual controls panel exposes `Exposure EV100`, `IBL Intensity`, `Torch Candelas`, the tone mapper, and the enabled/intensity controls for Bloom, Depth Of Field, Lens Flares, N8AO, SSR, and Vignette.
- Verify Bloom, Depth Of Field, Lens Flares, and SSR start disabled.
- Verify changing `Exposure EV100` updates `canvas[data-renderer-exposure]`.
- Verify the FPS counter appears in the top-right corner.
- Verify pressing backquote opens the visual controls panel.
- Verify the panel no longer exposes obsolete atmosphere or sun controls.
- Verify opening the panel releases mouse lock and clicking inside the panel does not relock the pointer.
- Benchmark startup with `npm run bench:startup` and test duration with `npm run bench:tests` before handoff.
- Treat duration regressions as blocking issues.
- Keep `npm run test:unit` under 20 seconds.
- Keep the prepared smoke runner `npm run test:smoke:runner` under 1 minute after a single `npm run build:pages`.
- Latest measured benchmark on April 4, 2026: `npm run bench:startup` reached the first bright frame in about `330.4ms` on the background dev server, `npm run test:unit` took about `975ms`, and the prepared `npm run test:smoke:runner` took about `23.5s`.

## Deployment
- The project is intended for GitHub Pages hosting.
- The current GitHub Pages setup publishes directly from the repository root on `main`.
- Run `npm run build:pages` before pushing when the live site needs updated production assets.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
