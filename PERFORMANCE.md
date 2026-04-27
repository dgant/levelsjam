# Performance Profile

Captured: 2026-04-27T16:31:58.018Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live RAF

- Average frame: 16.530ms (60.498 FPS)
- Min/max frame: 8.200ms / 16.800ms
- Samples: 61

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.813 | 1230.769 | 1.000 | 45.000 | 169.000 | 16 |
| Post disabled | 0.456 | 2191.781 | 1.100 | 29.000 | 145.000 | 16 |
| Post + reflections disabled | 0.494 | 2025.316 | 1.300 | 29.000 | 145.000 | 16 |
| Post + all local lighting disabled | 0.381 | 2622.951 | 0.600 | 29.000 | 145.000 | 16 |
| Unlit baseline | 0.463 | 2162.162 | 1.100 | 29.000 | 145.000 | 16 |

## Hierarchical Deltas

- All optional postprocessing: 0.356ms/frame (Default -> Post disabled)
- Baked/probe lighting: 0.112ms/frame (Post + reflections disabled -> Post + all local lighting disabled)

## Loop Populations

- mountedLevels: 2
- residentReflectionProbes: 40
- residentVolumetricProbes: 99
- sceneChildren: 4

## Scene Object Counts

```json
{
  "effectivelyVisible": {
    "Scene": 1,
    "AmbientLight": 1,
    "Group": 3,
    "maze-ground-lightmap": 95,
    "maze-wall": 47,
    "maze-wall-decal": 24,
    "maze-corner-filler": 6,
    "sconce-body": 10,
    "torch-billboard": 20
  },
  "memory": {
    "geometries": 215,
    "textures": 102
  },
  "mounted": {
    "Scene": 1,
    "AmbientLight": 1,
    "Group": 5,
    "maze-ground-lightmap": 95,
    "maze-wall": 47,
    "maze-wall-decal": 24,
    "maze-corner-filler": 6,
    "sconce-body": 10,
    "torch-billboard": 20,
    "held-sword": 2,
    "Object3D": 6,
    "held-trophy": 2
  },
  "programs": 27,
  "totalEffectivelyVisible": 207,
  "totalMounted": 219,
  "totalVisible": 217,
  "visible": {
    "Scene": 1,
    "AmbientLight": 1,
    "Group": 5,
    "maze-ground-lightmap": 95,
    "maze-wall": 47,
    "maze-wall-decal": 24,
    "maze-corner-filler": 6,
    "sconce-body": 10,
    "torch-billboard": 20,
    "Object3D": 6,
    "held-sword": 1,
    "held-trophy": 1
  }
}
```