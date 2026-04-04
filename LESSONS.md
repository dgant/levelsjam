# Lessons Learned

- React Three Fiber scene content must be rendered inside a `<Canvas>` host. A production build can succeed while the runtime still fails if hooks like `useFrame` and `useThree` are mounted outside the canvas context.
- The Vite `base` setting should stay relative for this project unless the repository name is fixed. `base: './'` keeps GitHub Pages assets working under either `/levelsjam/` or a future `/jam2026/` path.
- This repository's current GitHub Pages token cannot switch Pages to workflow mode. The reliable publish path is legacy `main` root hosting with committed built assets at the repository root.
- Runtime-served textures must live under `public/` in source. The root-level `textures/` directory is generated Pages output and gets replaced by `npm run build:pages`.
- When movement tuning is specified in both speed and distance terms, preserve both constraints in the spec so tests can validate the intended feel instead of a single derived number.
- When agent workflows need live Vite access, prefer one persistent headless instance over repeatedly starting visible windows.
- If the root `index.html` chooses between source and committed bundle modes, include every approved Vite dev port in that detection. Otherwise a background server can silently serve stale built assets.
- The April 3, 2026 startup benchmark showed that the scene reaches its first rendered frame in about 1-2 seconds on the dev server, while the slowest remaining startup requests are remote `@takram/three-atmosphere` EXR files from `media.githubusercontent.com`.
- Playwright should only match `*.spec.cjs` in this repository. If it scans the Node `--test` files, it wastes time running them inside the browser-test command.
- For rendered-frame smoke checks in this scene, broad brightness sampling across the whole canvas is more reliable than checking a single center pixel.
- In this project, moving the `three-atmosphere` EXRs into `public/textures/atmosphere` cuts startup latency dramatically compared with loading them from `media.githubusercontent.com`.
- The `canvas[data-scene-ready]` marker proved less reliable than the rendered image for startup benchmarking, so the benchmark now waits for a bright canvas frame instead of a custom dataset flag.
- After Playwright diagnostics or benchmarks, explicitly stop the headless browser processes they spawned instead of assuming they will all exit cleanly on their own.
- `@react-three/postprocessing` forces the renderer to `NoToneMapping` while the composer renders, so visible tone-mapper controls must drive a `ToneMapping` post effect rather than `gl.toneMapping`.
- The custom lens flare shader from `@react-three/postprocessing` treats its `opacity` uniform as suppression, not visibility, so app-side code must invert that value or the effect stays hidden.
