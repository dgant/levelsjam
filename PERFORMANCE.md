# Performance Profile

Captured: 2026-04-28T14:04:18.373Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.805ms (59.508 FPS)
- Min/max frame: 4.300ms / 116.600ms
- Samples: 2678
- Long frames over 50ms: 4

## Diagnosis

- App-owned JavaScript/render scopes account for 1.236ms/frame of the 16.805ms average frame interval.
- The remaining 15.568ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 0/4.
- No long frame in this sample coincided with a tracked render-loop resource-count change.
- Largest app CPU scopes: Composer/RenderPass 0.676ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.651ms; Composer/N8AO 0.359ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.224ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.341ms.

## Frame-Time Tree

- Live traversal frame: 16.805ms (59.508 FPS)
  - Instrumented frame work: 1.236ms
    - Composer: 1.148ms
      - RenderPass: 0.676ms
        - Renderer: 0.651ms
          - WebGLRenderer.render submission: 0.651ms
            - render target 800x450: 0.651ms avg, 79.100ms max, 2678 calls
      - N8AO: 0.359ms
        - Renderer: 0.266ms
          - WebGLRenderer.render submission: 0.266ms
            - render target 800x450: 0.224ms avg, 1.800ms max, 16068 calls
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.568ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 116.600ms at +987.500ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.100ms at +1037.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 100.000ms at +1254.200ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":218,"rendererPrograms":42,"rendererTextures":68,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.400ms at +1537.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":228,"rendererPrograms":45,"rendererTextures":74,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.656 | 1523.810 | 1.100 | 47.000 | 193.000 | 16 |
| Post disabled | 0.344 | 2909.091 | 0.600 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.381 | 2622.951 | 0.600 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.344 | 2909.091 | 0.500 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.350 | 2857.143 | 0.500 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.341 | 21.105 | 2678 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.190 | 317.181 | 179 | 168939 | 2678 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.415 | 15.830 | 35 | 71 | 16068 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10712 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.972 | 0.972 | 1 | 1 | 2678 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.230 | 0.487 | 17 | 35 | 2678 |

## Hierarchical Deltas

- All optional postprocessing: 0.313ms/frame (Default -> Post disabled)

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
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.236ms/frame, while 15.568ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.676ms/frame CPU scope; 29.190 draw calls/frame; 317.181 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.631ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.236 | 7.356% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.420 | 2.497% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.079 | 0.470% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.022 | 0.132% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.163 | 0.968% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.568 | 92.644% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.676ms/frame avg; 79.100ms max; 2678 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.651ms/frame avg; 79.100ms max; 2678 calls
- Composer/N8AO: 0.359ms/frame avg; 2.000ms max; 2678 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.224ms/frame avg; 1.800ms max; 16068 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.420ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.413ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.332ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.191ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.188ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.183ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.183ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.183ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.182ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.182ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.420 | 3.309 | 2 |
| Browser worker-pool work | 0.146 | 0.257 | 37 |
| GPU process and driver work | 0.079 | 0.645 | 1 |
| Compositor and presentation work | 0.022 | 0.114 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (45904:12260) busy: 0.416ms/frame union; 0.416ms/frame top-level trace events
  - RunTask: 0.416ms/frame inclusive; 82.338ms max; 4143 events
    - ThreadControllerImpl::RunTask: 0.409ms/frame inclusive; 82.319ms max; 2594 events
      - ProxyMain::BeginMainFrame: 0.191ms/frame inclusive; 82.317ms max; 101 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.183ms/frame inclusive; 81.875ms max; 101 events
          - Blink.Animate.UpdateTime: 0.183ms/frame inclusive; 81.873ms max; 101 events
            - PageAnimator::serviceScriptedAnimations: 0.183ms/frame inclusive; 81.871ms max; 101 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.182ms/frame inclusive; 81.856ms max; 101 events
                - FireAnimationFrame: 0.182ms/frame inclusive; 81.792ms max; 291 events
                  - AsyncTask Run: 0.182ms/frame inclusive; 81.792ms max; 291 events
                    - v8.callFunction: 0.182ms/frame inclusive; 81.779ms max; 291 events
                      - FunctionCall: kz: 0.180ms/frame inclusive; 81.764ms max; 101 events
                        - self/untraced child work: 0.120ms/frame
      - MessagePort::Accept: 0.124ms/frame inclusive; 57.273ms max; 54 events
        - v8.callFunction: 0.123ms/frame inclusive; 57.257ms max; 54 events
          - FunctionCall: O: 0.122ms/frame inclusive; 56.209ms max; 54 events
            - self/untraced child work: 0.112ms/frame
