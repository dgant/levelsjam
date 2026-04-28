# Performance Profile

Captured: 2026-04-28T13:12:42.330Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.859ms (59.314 FPS)
- Min/max frame: 16.500ms / 216.700ms
- Samples: 2670
- Long frames over 50ms: 7

## Diagnosis

- App-owned JavaScript/render scopes account for 1.605ms/frame of the 16.859ms average frame interval.
- The remaining 15.255ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 2/7.
- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.
- Largest app CPU scopes: Composer/RenderPass 0.915ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.871ms; Composer/N8AO 0.408ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.239ms; lens flare source selection 0.100ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.233ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.146ms; Composer/RenderPass 0.121ms.

## Frame-Time Tree

- Live traversal frame: 16.859ms (59.314 FPS)
  - Instrumented frame work: 1.605ms
    - Composer: 1.455ms
      - RenderPass: 0.915ms
        - Renderer: 0.871ms
          - WebGLRenderer.render submission: 0.871ms
            - render target 800x450: 0.871ms avg, 173.500ms max, 2671 calls
      - N8AO: 0.408ms
        - Renderer: 0.287ms
          - WebGLRenderer.render submission: 0.287ms
            - render target 800x450: 0.239ms avg, 1.100ms max, 16026 calls
        - self/uninstrumented child work: 0.120ms
    - lens flare source selection: 0.100ms avg, 4.900ms max, 2671 calls
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.255ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 216.700ms at +1115.500ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":50,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.600ms at +1182.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":54,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1232.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":54,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.100ms at +1315.500ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":54,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1415.400ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":54,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +1532.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":54,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1732.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":57,"rendererTextures":77,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.669 | 1495.327 | 1.100 | 47.000 | 193.000 | 16 |
| Post disabled | 0.363 | 2758.621 | 0.500 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.363 | 2758.621 | 0.500 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.375 | 2666.667 | 0.600 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.344 | 2909.091 | 0.500 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.233 | 15.900 | 2671 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.146 | 5.052 | 2671 |
| Composer/RenderPass | 0.121 | 57.895 | 2671 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.975 | 2149.617 | 314 | 394244 | 2671 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.450 | 15.900 | 35 | 71 | 16026 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10684 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.971 | 0.971 | 1 | 1 | 2671 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.244 | 0.517 | 17 | 35 | 2671 |

## Hierarchical Deltas

- All optional postprocessing: 0.306ms/frame (Default -> Post disabled)

## Loop Populations

- rendererGeometries: 218
- rendererPrograms: 44
- rendererTextures: 64
- mountedLevels: 2
- residentReflectionProbes: 37
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
    "torch-billboard": 20,
    "maze-door": 2,
    "maze-door-leaf": 4
  },
  "memory": {
    "geometries": 218,
    "textures": 64
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
    "maze-door": 2,
    "maze-door-leaf": 4,
    "held-sword": 2,
    "Object3D": 6,
    "held-trophy": 2
  },
  "programs": 44,
  "totalEffectivelyVisible": 213,
  "totalMounted": 225,
  "totalVisible": 223,
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
    "maze-door": 2,
    "maze-door-leaf": 4,
    "Object3D": 6,
    "held-sword": 1,
    "held-trophy": 1
  }
}
```

## Frame-Time Accounting

- Best current answer: 16.859ms/frame of 16.859ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.605ms/frame, while 15.255ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.915ms/frame CPU scope; 29.975 draw calls/frame; 2149.617 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.655ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.605 | 9.517% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.505 | 2.994% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.117 | 0.694% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.028 | 0.167% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.186 | 1.105% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.255 | 90.483% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.915ms/frame avg; 173.600ms max; 2671 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.871ms/frame avg; 173.500ms max; 2671 calls
- Composer/N8AO: 0.408ms/frame avg; 2.000ms max; 2671 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.239ms/frame avg; 1.100ms max; 16026 calls
- lens flare source selection: 0.100ms/frame avg; 4.900ms max; 2671 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.505ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.498ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.415ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.276ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.269ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.265ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.265ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.265ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.264ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.264ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.505 | 4.338 | 2 |
| Browser worker-pool work | 0.167 | 0.288 | 36 |
| GPU process and driver work | 0.117 | 0.968 | 1 |
| Compositor and presentation work | 0.028 | 0.146 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (18700:2752) busy: 0.501ms/frame union; 0.501ms/frame top-level trace events
  - RunTask: 0.501ms/frame inclusive; 177.005ms max; 4098 events
    - ThreadControllerImpl::RunTask: 0.494ms/frame inclusive; 176.985ms max; 2613 events
      - ProxyMain::BeginMainFrame: 0.276ms/frame inclusive; 176.981ms max; 107 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.265ms/frame inclusive; 176.392ms max; 107 events
          - Blink.Animate.UpdateTime: 0.265ms/frame inclusive; 176.386ms max; 107 events
            - PageAnimator::serviceScriptedAnimations: 0.265ms/frame inclusive; 176.383ms max; 107 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.264ms/frame inclusive; 176.357ms max; 107 events
                - FireAnimationFrame: 0.264ms/frame inclusive; 176.293ms max; 304 events
                  - AsyncTask Run: 0.263ms/frame inclusive; 176.293ms max; 304 events
                    - v8.callFunction: 0.263ms/frame inclusive; 176.278ms max; 304 events
                      - FunctionCall: Bz: 0.260ms/frame inclusive; 176.264ms max; 107 events
                        - self/untraced child work: 0.180ms/frame
      - MessagePort::Accept: 0.130ms/frame inclusive; 58.946ms max; 51 events
        - v8.callFunction: 0.129ms/frame inclusive; 58.930ms max; 51 events
          - FunctionCall: U: 0.128ms/frame inclusive; 57.834ms max; 51 events
            - self/untraced child work: 0.118ms/frame
- CrGpuMain (35208:36704) busy: 0.117ms/frame union; 0.117ms/frame top-level trace events
  - RunTask: 0.117ms/frame inclusive; 22.205ms max; 1124 events
    - ThreadControllerImpl::RunTask: 0.116ms/frame inclusive; 22.203ms max; 1124 events
      - Scheduler::RunTask: 0.114ms/frame inclusive; 22.200ms max; 959 events
        - GpuChannel::ExecuteDeferredRequest: 0.107ms/frame inclusive; 22.195ms max; 745 events
          - GPUTask: 0.106ms/frame inclusive; 22.192ms max; 741 events
