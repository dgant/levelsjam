# Performance Profile

Captured: 2026-04-28T14:40:09.394Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.811ms (59.486 FPS)
- Min/max frame: 4.200ms / 133.300ms
- Samples: 2677
- Long frames over 50ms: 3

## Diagnosis

- App-owned JavaScript/render scopes account for 1.453ms/frame of the 16.811ms average frame interval.
- The remaining 15.358ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 0/3.
- No long frame in this sample coincided with a tracked render-loop resource-count change.
- Largest app CPU scopes: Composer/RenderPass 0.823ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.784ms; Composer/N8AO 0.380ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.228ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.182ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.154ms; Composer/BillboardCompositePass 0.107ms.

## Frame-Time Tree

- Live traversal frame: 16.811ms (59.486 FPS)
  - Instrumented frame work: 1.453ms
    - Composer: 1.331ms
      - RenderPass: 0.823ms
        - Renderer: 0.784ms
          - WebGLRenderer.render submission: 0.784ms
            - render target 800x450: 0.784ms avg, 87.300ms max, 2677 calls
      - N8AO: 0.380ms
        - Renderer: 0.274ms
          - WebGLRenderer.render submission: 0.274ms
            - render target 800x450: 0.228ms avg, 1.600ms max, 16062 calls
        - self/uninstrumented child work: 0.106ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.358ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 133.300ms at +1054.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":43,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 133.300ms at +1354.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":43,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +1554.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":236,"rendererPrograms":47,"rendererTextures":74,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.675 | 1481.481 | 1.100 | 47.000 | 193.000 | 16 |
| Post disabled | 0.356 | 2807.018 | 0.500 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.331 | 3018.868 | 0.400 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.406 | 2461.538 | 0.700 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.344 | 2909.091 | 0.400 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.182 | 15.831 | 2677 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.154 | 5.550 | 2677 |
| Composer/BillboardCompositePass | 0.107 | 5.720 | 2677 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.405 | 769.274 | 179 | 174163 | 2677 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.448 | 15.895 | 35 | 71 | 16062 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10708 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.970 | 0.970 | 1 | 1 | 2677 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.242 | 0.515 | 17 | 35 | 2677 |

## Hierarchical Deltas

- All optional postprocessing: 0.319ms/frame (Default -> Post disabled)

## Loop Populations

- rendererGeometries: 218
- rendererPrograms: 45
- rendererTextures: 64
- mountedLevels: 2
- residentReflectionProbes: 16
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
  "programs": 45,
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

- Best current answer: 16.811ms/frame of 16.811ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.453ms/frame, while 15.358ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.823ms/frame CPU scope; 29.405 draw calls/frame; 769.274 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.592ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.453 | 8.644% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.447 | 2.661% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.097 | 0.579% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.028 | 0.168% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.144 | 0.859% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.358 | 91.356% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.823ms/frame avg; 87.400ms max; 2677 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.784ms/frame avg; 87.300ms max; 2677 calls
- Composer/N8AO: 0.380ms/frame avg; 2.600ms max; 2677 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.228ms/frame avg; 1.600ms max; 16062 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.447ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.439ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.357ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.227ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.220ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.216ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.216ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.216ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.215ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.215ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.447 | 3.648 | 2 |
| Browser worker-pool work | 0.127 | 0.215 | 25 |
| GPU process and driver work | 0.097 | 0.793 | 1 |
| Compositor and presentation work | 0.028 | 0.147 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (19256:33972) busy: 0.443ms/frame union; 0.443ms/frame top-level trace events
  - RunTask: 0.443ms/frame inclusive; 90.574ms max; 4089 events
    - ThreadControllerImpl::RunTask: 0.435ms/frame inclusive; 90.549ms max; 2548 events
      - ProxyMain::BeginMainFrame: 0.227ms/frame inclusive; 90.546ms max; 109 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.216ms/frame inclusive; 89.980ms max; 109 events
          - Blink.Animate.UpdateTime: 0.216ms/frame inclusive; 89.975ms max; 109 events
            - PageAnimator::serviceScriptedAnimations: 0.216ms/frame inclusive; 89.973ms max; 109 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.215ms/frame inclusive; 89.949ms max; 109 events
                - FireAnimationFrame: 0.215ms/frame inclusive; 89.885ms max; 311 events
                  - AsyncTask Run: 0.214ms/frame inclusive; 89.883ms max; 311 events
                    - v8.callFunction: 0.214ms/frame inclusive; 89.870ms max; 311 events
                      - FunctionCall: kz: 0.211ms/frame inclusive; 89.859ms max; 109 events
                        - self/untraced child work: 0.148ms/frame
      - MessagePort::Accept: 0.114ms/frame inclusive; 58.837ms max; 52 events
        - v8.callFunction: 0.113ms/frame inclusive; 58.821ms max; 52 events
          - FunctionCall: O: 0.113ms/frame inclusive; 57.683ms max; 52 events
            - self/untraced child work: 0.102ms/frame
