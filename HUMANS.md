# How To Work On This Project

## Current State
The repository is being built as a browser game for GitHub Pages. At the moment the repo contains project documentation only; the runnable app scaffold is added in the implementation work that follows.

## Local Setup
- Install Node.js 20 or newer.
- After the app scaffold exists, install dependencies with `npm install`.
- After the app scaffold exists, start the dev server with `npm run dev`.
- Open the local URL printed by the dev server.

## Build
- After the app scaffold exists, create a production build with `npm run build`.
- If the project uses a preview server, verify the build with `npm run preview`.

## Testing
- Run the production build before handoff.
- Verify the main page renders the 3D scene without console errors.
- Verify `W`, `A`, `S`, and `D` move the camera.
- Verify mouse movement changes view direction.
- Verify holding `Space` applies upward thrust and releasing it stops the ascent.

## Deployment
- The project is intended for GitHub Pages hosting.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
