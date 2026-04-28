# Performance Profile

Captured: 2026-04-28T04:13:01.025Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 16.867ms (59.286 FPS)
- Min/max frame: 4.200ms / 266.600ms
- Samples: 2668
- Long frames over 50ms: 8

## Diagnosis

- App-owned JavaScript/render scopes account for 1.797ms/frame of the 16.867ms average frame interval.
- The remaining 15.070ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 5/8.
- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.
- Largest app CPU scopes: Composer/RenderPass 1.005ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 0.958ms; Composer/N8AO 0.574ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.347ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.021ms; Composer/RenderPass 0.149ms; Composer/EffectPass[FogVolumeEffect] 0.118ms.

## Frame-Time Tree

- Live traversal frame: 16.867ms (59.286 FPS)
  - Instrumented frame work: 1.797ms
    - Composer: 1.738ms
      - RenderPass: 1.005ms
        - Renderer: 0.958ms
          - WebGLRenderer.render submission: 0.958ms
            - render target 800x450: 0.958ms avg, 213.700ms max, 2668 calls
      - N8AO: 0.574ms
        - Renderer: 0.402ms
          - WebGLRenderer.render submission: 0.402ms
            - render target 800x450: 0.347ms avg, 1.400ms max, 16008 calls
        - self/uninstrumented child work: 0.173ms
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 15.070ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 266.600ms at +1154.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":43,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.700ms at +1220.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":47,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1270.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":47,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1320.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":47,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1370.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":320,"rendererPrograms":47,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.600ms at +1470.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":47,"rendererTextures":77,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1520.800ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":-1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":47,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +1604.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":-1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":325,"rendererPrograms":47,"rendererTextures":75,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.881 | 1134.752 | 1.400 | 47.000 | 193.000 | 16 |
| Post disabled | 0.506 | 1975.309 | 0.900 | 30.000 | 168.000 | 16 |
| Post + reflections disabled | 0.444 | 2253.521 | 0.900 | 30.000 | 168.000 | 16 |
| Post + all local lighting disabled | 0.450 | 2222.222 | 0.900 | 30.000 | 168.000 | 16 |
| Unlit baseline | 0.475 | 2105.263 | 1.000 | 30.000 | 168.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.021 | 6.168 | 2668 |
| Composer/RenderPass | 0.149 | 119.397 | 2668 |
| Composer/EffectPass[FogVolumeEffect] | 0.118 | 5.339 | 2668 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 29.877 | 2161.390 | 309 | 392876 | 2668 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 7.442 | 15.883 | 35 | 71 | 16008 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10672 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.970 | 0.970 | 1 | 1 | 2668 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.237 | 0.504 | 17 | 35 | 2668 |

## Hierarchical Deltas

- All optional postprocessing: 0.375ms/frame (Default -> Post disabled)

## Loop Populations

- rendererGeometries: 218
- rendererPrograms: 35
- rendererTextures: 68
- mountedLevels: 2
- residentReflectionProbes: 4
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
    "textures": 68
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
  "programs": 35,
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

- Best current answer: 16.867ms/frame of 16.867ms/frame is explicitly named here (100.000%).
- Interpretation: this capture is cadence-limited, not render-limited. App-owned render work is 1.797ms/frame, while 15.070ms/frame is waiting for browser/GPU/present/next RAF cadence.
- Main forward render pass: 1.005ms/frame CPU scope; 29.877 draw calls/frame; 2161.390 triangles/frame.
- GPU timer-query sum across measured composer passes: 1.424ms/frame. These pass timings are GPU work and can overlap CPU trace work.
- Browser thread rows below are overlap-aware busy-time unions inside each thread category. They are evidence for where time is spent, not additive children of the frame interval.

| Bucket | ms/frame | Frame % | Meaning |
| --- | ---: | ---: | --- |
| App-owned named JavaScript/render scopes | 1.797 | 10.656% | React Three frame callbacks, composer pass wrappers, WebGL render submissions, and hot gameplay/update scopes named by the app profiler. |
| Browser renderer main thread | 0.529 | 3.137% | Chrome trace events on the renderer main thread, including JavaScript callbacks and browser frame tasks. |
| GPU process and driver thread activity | 0.130 | 0.773% | Chrome trace events in GPU-process threads, including command buffer, shader/program validation, draws, and present-related GPU work. |
| Compositor and presentation threads | 0.028 | 0.168% | Chrome trace events in compositor/viz threads that draw, submit, or present frames. |
| Other browser worker/IO threads | 0.193 | 1.145% | Thread-pool, IO, and miscellaneous browser work seen during the same traversal. |
| Wait for browser/GPU/present/next RAF cadence | 15.070 | 89.344% | Wall-clock frame interval not explained by active work on the busiest measured thread; this is the practical idle/blocking/presentation budget. |

### Optimization-Relevant App Work

- Composer/RenderPass: 1.005ms/frame avg; 213.800ms max; 2668 calls
- Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450: 0.958ms/frame avg; 213.700ms max; 2668 calls
- Composer/N8AO: 0.574ms/frame avg; 6.000ms max; 2668 calls
- Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450: 0.347ms/frame avg; 1.400ms max; 16008 calls

### Optimization-Relevant Browser Trace Work

- Browser renderer main-thread work / Browser task runner: 0.528ms/frame inclusive trace event time
- Browser renderer main-thread work / ThreadControllerImpl::RunTask: 0.520ms/frame inclusive trace event time
- Browser renderer main-thread work / v8.callFunction: 0.423ms/frame inclusive trace event time
- Browser renderer main-thread work / ProxyMain::BeginMainFrame: 0.294ms/frame inclusive trace event time
- Browser renderer main-thread work / AsyncTask Run: 0.289ms/frame inclusive trace event time
- Browser renderer main-thread work / WebFrameWidgetImpl::BeginMainFrame: 0.282ms/frame inclusive trace event time
- Browser renderer main-thread work / Blink.Animate.UpdateTime: 0.282ms/frame inclusive trace event time
- Browser renderer main-thread work / PageAnimator::serviceScriptedAnimations: 0.282ms/frame inclusive trace event time
- Browser renderer main-thread work / FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.281ms/frame inclusive trace event time
- Browser renderer main-thread work / FireAnimationFrame: 0.281ms/frame inclusive trace event time

### Trace Thread Busy Summary

| Thread category | Busy ms/frame | Event ms/frame | Threads |
| --- | ---: | ---: | ---: |
| Browser renderer main-thread work | 0.529 | 4.511 | 2 |
| Browser worker-pool work | 0.169 | 0.285 | 37 |
| GPU process and driver work | 0.130 | 1.062 | 1 |
| Compositor and presentation work | 0.028 | 0.141 | 2 |

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (13296:45804) busy: 0.525ms/frame union; 0.525ms/frame top-level trace events
  - RunTask: 0.524ms/frame inclusive; 216.903ms max; 3898 events
    - ThreadControllerImpl::RunTask: 0.516ms/frame inclusive; 216.870ms max; 2728 events
      - ProxyMain::BeginMainFrame: 0.294ms/frame inclusive; 216.866ms max; 106 events
        - WebFrameWidgetImpl::BeginMainFrame: 0.282ms/frame inclusive; 216.310ms max; 106 events
          - Blink.Animate.UpdateTime: 0.281ms/frame inclusive; 216.304ms max; 106 events
            - PageAnimator::serviceScriptedAnimations: 0.281ms/frame inclusive; 216.300ms max; 106 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 0.280ms/frame inclusive; 216.249ms max; 106 events
                - FireAnimationFrame: 0.280ms/frame inclusive; 216.185ms max; 303 events
                  - AsyncTask Run: 0.280ms/frame inclusive; 216.184ms max; 303 events
                    - v8.callFunction: 0.279ms/frame inclusive; 216.156ms max; 303 events
                      - FunctionCall: zz: 0.276ms/frame inclusive; 216.142ms max; 106 events
                        - self/untraced child work: 0.194ms/frame
      - MessagePort::Accept: 0.115ms/frame inclusive; 66.234ms max; 37 events
        - v8.callFunction: 0.115ms/frame inclusive; 66.216ms max; 37 events
          - FunctionCall: z: 0.114ms/frame inclusive; 65.055ms max; 37 events
            - self/untraced child work: 0.102ms/frame
- CrGpuMain (23748:44432) busy: 0.130ms/frame union; 0.130ms/frame top-level trace events
  - RunTask: 0.130ms/frame inclusive; 6.674ms max; 1233 events
    - ThreadControllerImpl::RunTask: 0.129ms/frame inclusive; 6.671ms max; 1233 events
      - Scheduler::RunTask: 0.126ms/frame inclusive; 6.666ms max; 1065 events
        - GpuChannel::ExecuteDeferredRequest: 0.117ms/frame inclusive; 6.662ms max; 846 events
          - GPUTask: 0.116ms/frame inclusive; 6.656ms max; 838 events
            - WebGL: 0.101ms/frame inclusive; 6.600ms max; 818 events
              - CommandBuffer::Flush: 0.101ms/frame inclusive; 6.598ms max; 818 events
                - CommandBufferStub::OnAsyncFlush: 0.101ms/frame inclusive; 6.598ms max; 818 events
