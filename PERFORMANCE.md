# Performance Profile

Captured: 2026-04-28T04:58:52.698Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.864ms (59.299 FPS)
- Min/max frame: 10.600ms / 216.600ms
- Samples: 2669
- Long frames over 50ms: 7

## Diagnosis

- App-owned JavaScript/render scopes account for 1.716ms/frame of the 16.864ms average frame interval.
- The remaining 15.147ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 5/7.
- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.
- Largest app CPU scopes: Composer/RenderPass 0.911ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.867ms; Composer/N8AO 0.501ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.305ms.
- Largest GPU timer-query scopes: Composer/N8AO 0.592ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.136ms; Composer/RenderPass 0.129ms.

## Frame-Time Tree

- Live traversal frame: 16.864ms (59.299 FPS)
  - Instrumented frame work: 1.716ms
    - Composer: 1.570ms
      - RenderPass: 0.911ms
        - Renderer: 0.867ms
          - WebGLRenderer.render submission: 0.867ms
            - render target 800x450: 0.867ms avg, 180.800ms max, 2669 calls
      - N8AO: 0.501ms
        - Renderer: 0.359ms
          - WebGLRenderer.render submission: 0.359ms
            - render target 800x450: 0.305ms avg, 1.000ms max, 16014 calls
        - self/uninstrumented child work: 0.142ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.147ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 216.600ms at +1093.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":51,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.700ms at +1160.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":55,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.600ms at +1227.200ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":55,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.100ms at +1393.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":55,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1443.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":-1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":55,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +1527.200ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":-1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":55,"rendererTextures":74,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1710.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":58,"rendererTextures":77,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.675 | 1481.481 | 1.000 | 47.000 | 193.000 | 16 |
| Post disabled | 0.362 | 2758.621 | 0.400 | 31.000 | 169.000 | 16 |
| Post + reflections disabled | 0.356 | 2807.018 | 0.500 | 31.000 | 169.000 | 16 |
| Post + all local lighting disabled | 0.450 | 2222.222 | 0.800 | 31.000 | 169.000 | 16 |
| Unlit baseline | 0.363 | 2758.621 | 0.500 | 31.000 | 169.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 0.592 | 25.788 | 2669 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.136 | 4.176 | 2669 |
| Composer/RenderPass | 0.129 | 99.715 | 2669 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.843 | 2009.078 | 312 | 394230 | 2669 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.430 | 15.860 | 35 | 71 | 16014 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10676 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.972 | 0.972 | 1 | 1 | 2669 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.236 | 0.499 | 17 | 35 | 2669 |

## Hierarchical Deltas

- All optional postprocessing: 0.313ms/frame (Default -> Post disabled)

## Loop Populations

- rendererGeometries: 218
- rendererPrograms: 45
- rendererTextures: 63
- mountedLevels: 2
- residentReflectionProbes: 32
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

- Best current answer: 16.864ms/frame of 16.864ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.716ms/frame, while 15.147ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 0.911ms/frame CPU scope; 29.843 draw calls/frame; 2009.078 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.009ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.716 | 10.178% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.497 | 2.948% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.135 | 0.799% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.026 | 0.157% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.195 | 1.155% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.147 | 89.822% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 0.911ms/frame avg; 180.900ms max; 2669 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.867ms/frame avg; 180.800ms max; 2669 calls
- Composer/N8AO: 0.501ms/frame avg; 1.800ms max; 2669 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.305ms/frame avg; 1.000ms max; 16014 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.497ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.490ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.407ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.269ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.265ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.260ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.260ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.260ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.259ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.259ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.497 | 4.274 | 2 |
| Browser worker-pool work | 0.172 | 0.296 | 24 |
| GPU process and driver work | 0.135 | 1.117 | 1 |
| Compositor and presentation work | 0.026 | 0.132 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (14676:48572) busy: 0.493ms/frame union; 0.493ms/frame top-level trace events
  - RunTask: 0.493ms/frame inclusive; 183.784ms max; 4084 events
    - ThreadControllerImpl::RunTask: 0.486ms/frame inclusive; 183.764ms max; 2684 events
      - ProxyMain::BeginMainFrame: 0.269ms/frame inclusive; 183.760ms max; 103 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.260ms/frame inclusive; 183.270ms max; 103 events
          - Blink.Animate.UpdateTime: 0.260ms/frame inclusive; 183.264ms max; 103 events
            - PageAnimator::serviceScriptedAnimations: 0.260ms/frame inclusive; 183.262ms max; 103 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.259ms/frame inclusive; 183.234ms max; 103 events
                - FireAnimationFrame: 0.259ms/frame inclusive; 183.169ms max; 296 events
                  - AsyncTask Run: 0.259ms/frame inclusive; 183.168ms max; 296 events
                    - v8.callFunction: 0.258ms/frame inclusive; 183.155ms max; 296 events
                      - FunctionCall: kz: 0.255ms/frame inclusive; 183.144ms max; 103 events
                        - self/untraced child work: 0.166ms/frame
      - MessagePort::Accept: 0.128ms/frame inclusive; 58.049ms max; 54 events
        - v8.callFunction: 0.127ms/frame inclusive; 58.026ms max; 54 events
          - FunctionCall: O: 0.126ms/frame inclusive; 56.756ms max; 54 events
            - self/untraced child work: 0.115ms/frame
- CrGpuMain (48372:39656) busy: 0.135ms/frame union; 0.135ms/frame top-level trace events
  - RunTask: 0.135ms/frame inclusive; 24.757ms max; 1065 events
    - ThreadControllerImpl::RunTask: 0.134ms/frame inclusive; 24.754ms max; 1065 events
      - Scheduler::RunTask: 0.132ms/frame inclusive; 24.751ms max; 924 events
        - GpuChannel::ExecuteDeferredRequest: 0.124ms/frame inclusive; 24.746ms max; 718 events
          - GPUTask: 0.123ms/frame inclusive; 24.742ms max; 710 events
            - WebGL: 0.110ms/frame inclusive; 24.650ms max; 693 events
              - CommandBuffer::Flush: 0.109ms/frame inclusive; 24.648ms max; 693 events
                - CommandBufferStub::OnAsyncFlush: 0.109ms/frame inclusive; 24.647ms max; 693 events
                  - CommandBufferService:PutChanged: 0.108ms/frame inclusive; 24.642ms max; 693 events
                    - self/untraced child work: 0.108ms/frame
