# Performance Profile

Captured: 2026-04-28T15:11:33.612Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.804ms (59.511 FPS)
- Min/max frame: 2.100ms / 116.700ms
- Samples: 2678
- Long frames over 50ms: 5

## Diagnosis

- App-owned JavaScript/render scopes account for 1.470ms/frame of the 16.804ms average frame interval.
- The remaining 15.333ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 0/5.
- No long frame in this sample coincided with a tracked render-loop resource-count change.
- Largest app CPU scopes: Composer/RenderPass 0.812ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.774ms; Composer/N8AO 0.398ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.240ms.
- Largest GPU timer-query scopes: Composer/N8AO 0.939ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.162ms; Composer/BillboardCompositePass 0.120ms.

## Frame-Time Tree

- Live traversal frame: 16.804ms (59.511 FPS)
  - Instrumented frame work: 1.470ms
    - Composer: 1.342ms
      - RenderPass: 0.812ms
        - Renderer: 0.774ms
          - WebGLRenderer.render submission: 0.774ms
            - render target 800x450: 0.774ms avg, 80.300ms max, 2678 calls
      - N8AO: 0.398ms
        - Renderer: 0.286ms
          - WebGLRenderer.render submission: 0.286ms
            - render target 800x450: 0.240ms avg, 1.400ms max, 16068 calls
        - self/uninstrumented child work: 0.113ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.333ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 116.700ms at +1018.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1068.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 116.600ms at +1352.000ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +1402.000ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +1602.000ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":227,"rendererPrograms":44,"rendererTextures":74,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.819 | 1221.374 | 1.800 | 47.000 | 193.000 | 16 |
| Post disabled | 0.319 | 3137.255 | 0.400 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.412 | 2424.242 | 1.200 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.331 | 3018.868 | 0.500 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.375 | 2666.667 | 0.500 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 0.939 | 16.210 | 2678 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.162 | 4.180 | 2678 |
| Composer/BillboardCompositePass | 0.120 | 4.072 | 2678 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.382 | 323.857 | 179 | 167379 | 2678 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.448 | 15.896 | 35 | 71 | 16068 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10712 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.971 | 0.971 | 1 | 1 | 2678 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.250 | 0.528 | 17 | 35 | 2678 |

## Hierarchical Deltas

- All optional postprocessing: 0.500ms/frame (Default -> Post disabled)

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

- Best current answer: 16.804ms/frame of 16.804ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.470ms/frame, while 15.333ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.812ms/frame CPU scope; 29.382 draw calls/frame; 323.857 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.380ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.470 | 8.751% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.464 | 2.759% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.095 | 0.568% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.029 | 0.172% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.169 | 1.003% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.333 | 91.249% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.812ms/frame avg; 80.400ms max; 2678 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.774ms/frame avg; 80.300ms max; 2678 calls
- Composer/N8AO: 0.398ms/frame avg; 3.000ms max; 2678 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.240ms/frame avg; 1.400ms max; 16068 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.464ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.456ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.368ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.228ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.221ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.217ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.217ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.217ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.215ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.215ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.464 | 3.733 | 2 |
| Browser worker-pool work | 0.146 | 0.254 | 32 |
| GPU process and driver work | 0.095 | 0.769 | 1 |
| Compositor and presentation work | 0.029 | 0.149 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (41992:31684) busy: 0.459ms/frame union; 0.459ms/frame top-level trace events
  - RunTask: 0.459ms/frame inclusive; 83.812ms max; 4188 events
    - ThreadControllerImpl::RunTask: 0.452ms/frame inclusive; 83.788ms max; 2761 events
      - ProxyMain::BeginMainFrame: 0.228ms/frame inclusive; 83.785ms max; 105 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.217ms/frame inclusive; 83.177ms max; 105 events
          - Blink.Animate.UpdateTime: 0.217ms/frame inclusive; 83.171ms max; 105 events
            - PageAnimator::serviceScriptedAnimations: 0.217ms/frame inclusive; 83.167ms max; 105 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.215ms/frame inclusive; 83.143ms max; 105 events
                - FireAnimationFrame: 0.215ms/frame inclusive; 83.032ms max; 297 events
                  - AsyncTask Run: 0.215ms/frame inclusive; 83.030ms max; 297 events
                    - v8.callFunction: 0.214ms/frame inclusive; 83.016ms max; 297 events
                      - FunctionCall: kz: 0.211ms/frame inclusive; 83.006ms max; 105 events
                        - self/untraced child work: 0.155ms/frame
      - MessagePort::Accept: 0.123ms/frame inclusive; 57.587ms max; 55 events
        - v8.callFunction: 0.122ms/frame inclusive; 57.571ms max; 55 events
          - FunctionCall: O: 0.122ms/frame inclusive; 56.526ms max; 55 events
            - self/untraced child work: 0.110ms/frame
