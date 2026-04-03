# Lessons Learned

- React Three Fiber scene content must be rendered inside a `<Canvas>` host. A production build can succeed while the runtime still fails if hooks like `useFrame` and `useThree` are mounted outside the canvas context.
- The Vite `base` setting should stay relative for this project unless the repository name is fixed. `base: './'` keeps GitHub Pages assets working under either `/levelsjam/` or a future `/jam2026/` path.
- This repository's current GitHub Pages token cannot switch Pages to workflow mode. The reliable publish path is legacy `main` root hosting with committed built assets at the repository root.
- Runtime-served textures must live under `public/` in source. The root-level `textures/` directory is generated Pages output and gets replaced by `npm run build:pages`.
- When movement tuning is specified in both speed and distance terms, preserve both constraints in the spec so tests can validate the intended feel instead of a single derived number.
