# Performance Profile

Captured: 2026-04-28T14:43:14.531Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.805ms (59.507 FPS)
- Min/max frame: 4.900ms / 133.200ms
- Samples: 2678
- Long frames over 50ms: 4

## Diagnosis

- App-owned JavaScript/render scopes account for 1.472ms/frame of the 16.805ms average frame interval.
- The remaining 15.333ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 0/4.
- No long frame in this sample coincided with a tracked render-loop resource-count change.
- Largest app CPU scopes: Composer/RenderPass 0.846ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.808ms; Composer/N8AO 0.381ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.230ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.282ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.127ms.

## Frame-Time Tree

- Live traversal frame: 16.805ms (59.507 FPS)
  - Instrumented frame work: 1.472ms
    - Composer: 1.354ms
      - RenderPass: 0.846ms
        - Renderer: 0.808ms
          - WebGLRenderer.render submission: 0.808ms
            - render target 800x450: 0.808ms avg, 81.100ms max, 2678 calls
      - N8AO: 0.381ms
        - Renderer: 0.276ms
          - WebGLRenderer.render submission: 0.276ms
            - render target 800x450: 0.230ms avg, 0.900ms max, 16068 calls
        - self/uninstrumented child work: 0.105ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.333ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 133.200ms at +1038.200ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 116.600ms at +1338.200ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.100ms at +1421.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +1588.300ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":228,"rendererPrograms":45,"rendererTextures":74,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.644 | 1553.398 | 0.900 | 47.000 | 193.000 | 16 |
| Post disabled | 0.356 | 2807.018 | 0.400 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.350 | 2857.143 | 0.500 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.344 | 2909.091 | 0.400 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.325 | 3076.923 | 0.400 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.282 | 19.681 | 2678 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.127 | 4.831 | 2678 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.264 | 320.019 | 179 | 168941 | 2678 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.431 | 15.862 | 35 | 71 | 16068 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10712 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.971 | 0.971 | 1 | 1 | 2678 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.237 | 0.503 | 17 | 35 | 2678 |

## Hierarchical Deltas

- All optional postprocessing: 0.287ms/frame (Default -> Post disabled)

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

- Best current answer: 16.805ms/frame of 16.805ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.472ms/frame, while 15.333ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.846ms/frame CPU scope; 29.264 draw calls/frame; 320.019 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.648ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.472 | 8.757% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.443 | 2.635% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.090 | 0.534% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.027 | 0.160% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.157 | 0.934% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.333 | 91.243% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.846ms/frame avg; 81.500ms max; 2678 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.808ms/frame avg; 81.100ms max; 2678 calls
- Composer/N8AO: 0.381ms/frame avg; 1.600ms max; 2678 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.230ms/frame avg; 0.900ms max; 16068 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.443ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.436ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.354ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.211ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.206ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.201ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.201ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.201ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.200ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.200ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.443 | 3.552 | 2 |
| Browser worker-pool work | 0.139 | 0.244 | 37 |
| GPU process and driver work | 0.090 | 0.728 | 1 |
| Compositor and presentation work | 0.027 | 0.139 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (4204:40708) busy: 0.438ms/frame union; 0.438ms/frame top-level trace events
  - RunTask: 0.438ms/frame inclusive; 84.814ms max; 4039 events
    - ThreadControllerImpl::RunTask: 0.431ms/frame inclusive; 84.788ms max; 2592 events
      - ProxyMain::BeginMainFrame: 0.211ms/frame inclusive; 84.785ms max; 104 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.201ms/frame inclusive; 84.158ms max; 104 events
          - Blink.Animate.UpdateTime: 0.201ms/frame inclusive; 84.154ms max; 104 events
            - PageAnimator::serviceScriptedAnimations: 0.201ms/frame inclusive; 84.150ms max; 104 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.200ms/frame inclusive; 84.126ms max; 104 events
                - FireAnimationFrame: 0.200ms/frame inclusive; 84.061ms max; 298 events
                  - AsyncTask Run: 0.200ms/frame inclusive; 84.060ms max; 298 events
                    - v8.callFunction: 0.199ms/frame inclusive; 84.046ms max; 298 events
                      - FunctionCall: kz: 0.197ms/frame inclusive; 84.035ms max; 104 events
                        - self/untraced child work: 0.139ms/frame
      - MessagePort::Accept: 0.124ms/frame inclusive; 64.937ms max; 55 events
        - v8.callFunction: 0.123ms/frame inclusive; 64.920ms max; 55 events
          - FunctionCall: O: 0.123ms/frame inclusive; 63.702ms max; 55 events
            - self/untraced child work: 0.110ms/frame
