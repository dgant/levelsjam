# Performance Profile

Captured: 2026-04-27T22:00:21.357Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.812ms (59.481 FPS)
- Min/max frame: 7.800ms / 183.400ms
- Samples: 2677
- Long frames over 50ms: 4

## Diagnosis

- App-owned JavaScript/render scopes account for 1.715ms/frame of the 16.812ms average frame interval.
- The remaining 15.097ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 3/4.
- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.
- Largest app CPU scopes: Composer/RenderPass 0.959ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.912ms; Composer/N8AO 0.528ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.320ms.
- Largest GPU timer-query scopes: Composer/N8AO 0.631ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.111ms; Composer/BillboardCompositePass 0.104ms.

## Frame-Time Tree

- Live traversal frame: 16.812ms (59.481 FPS)
  - Instrumented frame work: 1.715ms
    - Composer: 1.661ms
      - RenderPass: 0.959ms
        - Renderer: 0.912ms
          - WebGLRenderer.render submission: 0.912ms
            - render target 800x450: 0.912ms avg, 145.000ms max, 2677 calls
      - N8AO: 0.528ms
        - Renderer: 0.371ms
          - WebGLRenderer.render submission: 0.371ms
            - render target 800x450: 0.320ms avg, 1.300ms max, 16062 calls
        - self/uninstrumented child work: 0.157ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.097ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 183.400ms at +1041.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":45,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.600ms at +1107.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":49,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1157.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":49,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1307.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":-1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":318,"rendererPrograms":52,"rendererTextures":91,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.837 | 1194.030 | 1.400 | 45.000 | 169.000 | 16 |
| Post disabled | 0.494 | 2025.316 | 1.000 | 29.000 | 145.000 | 16 |
| Post + reflections disabled | 0.475 | 2105.263 | 1.000 | 29.000 | 145.000 | 16 |
| Post + all local lighting disabled | 0.387 | 2580.645 | 0.800 | 29.000 | 145.000 | 16 |
| Unlit baseline | 0.413 | 2424.242 | 0.800 | 29.000 | 145.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 0.631 | 29.523 | 2677 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.111 | 4.491 | 2677 |
| Composer/BillboardCompositePass | 0.104 | 5.457 | 2677 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 27.978 | 2481.548 | 306 | 371989 | 2677 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.448 | 51.031 | 36 | 7911 | 16062 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10708 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.970 | 0.970 | 1 | 1 | 2677 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.238 | 0.507 | 17 | 35 | 2677 |

## Hierarchical Deltas

- All optional postprocessing: 0.344ms/frame (Default -> Post disabled)

## Loop Populations

- rendererGeometries: 215
- rendererPrograms: 42
- rendererTextures: 63
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
    "torch-billboard": 20
  },
  "memory": {
    "geometries": 215,
    "textures": 63
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
  "programs": 42,
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

## Frame-Time Accounting

- Best current answer: 16.812ms/frame of 16.812ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.715ms/frame, while 15.097ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.959ms/frame CPU scope; 27.978 draw calls/frame; 2481.548 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.021ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.715 | 10.202% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.475 | 2.824% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.138 | 0.818% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.026 | 0.157% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.247 | 1.472% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.097 | 89.798% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.959ms/frame avg; 145.100ms max; 2677 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.912ms/frame avg; 145.000ms max; 2677 calls
- Composer/N8AO: 0.528ms/frame avg; 2.000ms max; 2677 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.320ms/frame avg; 1.300ms max; 16062 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.475ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.468ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.430ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.288ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.282ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.277ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.277ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.276ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.274ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.274ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.475 | 4.366 | 2 |
| Browser worker-pool work | 0.223 | 0.442 | 37 |
| GPU process and driver work | 0.138 | 1.132 | 1 |
| Compositor and presentation work | 0.026 | 0.131 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (42696:45072) busy: 0.470ms/frame union; 0.470ms/frame top-level trace events
  - RunTask: 0.470ms/frame inclusive; 147.512ms max; 1974 events
    - ThreadControllerImpl::RunTask: 0.463ms/frame inclusive; 147.489ms max; 1703 events
      - ProxyMain::BeginMainFrame: 0.288ms/frame inclusive; 147.487ms max; 108 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.277ms/frame inclusive; 146.982ms max; 108 events
          - Blink.Animate.UpdateTime: 0.277ms/frame inclusive; 146.977ms max; 108 events
            - PageAnimator::serviceScriptedAnimations: 0.276ms/frame inclusive; 146.973ms max; 108 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.274ms/frame inclusive; 146.948ms max; 108 events
                - FireAnimationFrame: 0.274ms/frame inclusive; 146.875ms max; 310 events
                  - AsyncTask Run: 0.274ms/frame inclusive; 146.874ms max; 310 events
                    - v8.callFunction: 0.273ms/frame inclusive; 146.859ms max; 310 events
                      - FunctionCall: Gz: 0.270ms/frame inclusive; 146.851ms max; 108 events
                        - self/untraced child work: 0.184ms/frame
      - MessagePort::Accept: 0.125ms/frame inclusive; 59.764ms max; 33 events
        - v8.callFunction: 0.125ms/frame inclusive; 59.746ms max; 33 events
          - FunctionCall: U: 0.124ms/frame inclusive; 58.563ms max; 33 events
            - self/untraced child work: 0.114ms/frame
- CrGpuMain (43680:45588) busy: 0.138ms/frame union; 0.138ms/frame top-level trace events
  - RunTask: 0.138ms/frame inclusive; 28.307ms max; 1227 events
    - ThreadControllerImpl::RunTask: 0.137ms/frame inclusive; 28.303ms max; 1227 events
      - Scheduler::RunTask: 0.133ms/frame inclusive; 28.300ms max; 1051 events
        - GpuChannel::ExecuteDeferredRequest: 0.125ms/frame inclusive; 28.295ms max; 830 events
          - GPUTask: 0.124ms/frame inclusive; 28.292ms max; 822 events
            - WebGL: 0.110ms/frame inclusive; 28.225ms max; 801 events
              - CommandBuffer::Flush: 0.110ms/frame inclusive; 28.222ms max; 801 events
                - CommandBufferStub::OnAsyncFlush: 0.110ms/frame inclusive; 28.222ms max; 801 events
                  - CommandBufferService:PutChanged: 0.109ms/frame inclusive; 28.215ms max; 801 events
                    - self/untraced child work: 0.108ms/frame
