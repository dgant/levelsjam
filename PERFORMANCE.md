# Performance Profile

Captured: 2026-04-27T17:48:24.390Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 25.073ms (39.884 FPS)
- Min/max frame: 7.700ms / 3799.900ms
- Samples: 1795
- Long frames over 50ms: 20

## Frame-Time Tree

- Live traversal frame: 25.073ms (39.884 FPS)
  - Instrumented frame work: 12.301ms
    - Renderer: 12.209ms
      - WebGLRenderer.render submission: 12.209ms
        - render target 800x450: 12.129ms avg, 3134.300ms max, 17694 calls
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 12.772ms
    - Not reasonably breakable from app-level JavaScript instrumentation below this point.

## Long Frames

- 233.300ms at +1307.600ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":2,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":4}
- 1033.200ms at +2357.600ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +2407.600ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +2490.900ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +2540.900ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 516.700ms at +3090.900ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +3190.900ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 83.300ms at +3274.200ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 333.400ms at +3607.600ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 350.000ms at +4007.500ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 366.700ms at +4374.200ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 3799.900ms at +8224.100ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 316.700ms at +9090.700ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 1299.900ms at +10807.200ms; maze=entrance; programs=n/a; fire=n/a; loops={"mountedLevels":2,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":4}
- 2016.500ms at +13690.400ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.700ms at +13757.100ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 250.000ms at +14007.100ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.700ms at +14173.800ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +14223.800ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +14273.800ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |

## Hierarchical Deltas


## Loop Populations


## Scene Object Counts
