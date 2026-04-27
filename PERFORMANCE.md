# Performance Profile

Captured: 2026-04-27T20:24:13.497Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 17.981ms (55.613 FPS)
- Min/max frame: 9.000ms / 233.300ms
- Samples: 2503
- Long frames over 50ms: 20

## Diagnosis

- App-owned JavaScript/render scopes account for 4.680ms/frame of the 17.981ms average frame interval.
- The remaining 13.301ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; use the Chrome trace thread tree below for that residual.
- Long frames with changing render-loop resource counts: 14/20.
- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.
- Largest app CPU scopes: Composer/RenderPass 2.928ms; Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 2.885ms; Composer/N8AO 1.075ms; Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 0.750ms; Composer/BillboardCompositePass 0.253ms.
- Largest GPU timer-query scopes: Composer/N8AO 1.342ms; Composer/BillboardCompositePass 0.259ms; Composer/RenderPass 0.200ms; Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] 0.111ms.

## Frame-Time Tree

- Live traversal frame: 17.981ms (55.613 FPS)
  - Instrumented frame work: 4.680ms
    - Composer: 4.608ms
      - RenderPass: 2.928ms
        - Renderer: 2.885ms
          - WebGLRenderer.render submission: 2.885ms
            - render target 800x450: 2.885ms avg, 165.900ms max, 2503 calls
      - N8AO: 1.075ms
        - Renderer: 0.806ms
          - WebGLRenderer.render submission: 0.806ms
            - render target 800x450: 0.750ms avg, 3.200ms max, 15018 calls
        - self/uninstrumented child work: 0.269ms
      - BillboardCompositePass: 0.253ms
        - torch billboard color pass: 0.222ms
          - Renderer: 0.214ms
            - WebGLRenderer.render submission: 0.214ms
              - render target 800x450: 0.214ms avg, 2.500ms max, 2503 calls
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 13.301ms
    - App-owned CPU scopes stop here; compare against the GPU timer-query and Chrome trace sections below.

## Long Frames

- 216.600ms at +1108.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":53,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1158.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":4,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":57,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 50.000ms at +1208.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":57,"rendererTextures":76,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 83.300ms at +1358.900ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":61,"rendererTextures":92,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +1525.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":-3,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":61,"rendererTextures":92,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 99.900ms at +1675.500ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":-1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":313,"rendererPrograms":62,"rendererTextures":100,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +8175.300ms; maze=maze-001; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":246,"rendererPrograms":53,"rendererTextures":68,"mountedLevels":2,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":4}
- 183.400ms at +9275.300ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":2,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":262,"rendererPrograms":54,"rendererTextures":72,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +9458.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":262,"rendererPrograms":58,"rendererTextures":80,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +9608.600ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":32,"rendererPrograms":0,"rendererTextures":6,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":330,"rendererPrograms":59,"rendererTextures":92,"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 116.700ms at +9775.300ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":-1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":334,"rendererPrograms":61,"rendererTextures":94,"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 100.000ms at +13508.400ms; maze=maze-002; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":235,"rendererPrograms":46,"rendererTextures":64,"mountedLevels":2,"residentReflectionProbes":34,"residentVolumetricProbes":139,"sceneChildren":4}
- 200.000ms at +14691.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":3,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":258,"rendererPrograms":49,"rendererTextures":105,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +14741.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":3,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":258,"rendererPrograms":52,"rendererTextures":105,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +14891.700ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":1,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":258,"rendererPrograms":54,"rendererTextures":114,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":295,"sceneChildren":8}
- 83.300ms at +15058.300ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":14,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":283,"rendererPrograms":55,"rendererTextures":115,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":295,"sceneChildren":8}
- 116.700ms at +15225.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":-1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":308,"rendererPrograms":55,"rendererTextures":123,"mountedLevels":6,"residentReflectionProbes":45,"residentVolumetricProbes":295,"sceneChildren":8}
- 83.300ms at +20074.800ms; maze=maze-003; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":0,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":234,"rendererPrograms":49,"rendererTextures":100,"mountedLevels":2,"residentReflectionProbes":37,"residentVolumetricProbes":139,"sceneChildren":4}
- 183.300ms at +21208.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":271,"rendererPrograms":51,"rendererTextures":104,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +21258.100ms; maze=chamber-1; programs=true; fire=true; delta={"rendererGeometries":0,"rendererPrograms":1,"rendererTextures":0,"mountedLevels":0,"residentReflectionProbes":0,"residentVolumetricProbes":0,"sceneChildren":0}; loops={"rendererGeometries":271,"rendererPrograms":52,"rendererTextures":104,"mountedLevels":6,"residentReflectionProbes":37,"residentVolumetricProbes":139,"sceneChildren":8}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Default | 0.675 | 1481.481 | 0.900 | 45.000 | 169.000 | 16 |
| Post disabled | 0.387 | 2580.645 | 0.800 | 29.000 | 145.000 | 16 |
| Post + reflections disabled | 0.525 | 1904.762 | 0.800 | 29.000 | 145.000 | 16 |
| Post + all local lighting disabled | 0.500 | 2000.000 | 1.100 | 29.000 | 145.000 | 16 |
| Unlit baseline | 0.350 | 2857.143 | 0.500 | 29.000 | 145.000 | 16 |

## GPU Timer Query Steps

| Step | Avg GPU ms/frame | Max GPU ms | Calls |
| --- | ---: | ---: | ---: |
| Composer/N8AO | 1.342 | 91.426 | 2503 |
| Composer/BillboardCompositePass | 0.259 | 5.006 | 2503 |
| Composer/RenderPass | 0.200 | 105.281 | 2503 |
| Composer/EffectPass[PlayerFadeEffect+VignetteEffect+ExposureEffect+ToneMappingEffect+DitherEffect] | 0.111 | 5.225 | 2503 |

## Render Submission Workload

| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Composer/RenderPass/Renderer/WebGLRenderer.render submission/render target 800x450 | 95.777 | 64172.657 | 301 | 353391 | 2503 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 800x450 | 20.580 | 1733.131 | 60 | 7959 | 15018 |
| Composer/BillboardCompositePass/torch billboard color pass/Renderer/WebGLRenderer.render submission/render target 800x450 | 5.560 | 11.729 | 29 | 59 | 2503 |
| Composer/N8AO/Renderer/WebGLRenderer.render submission/render target 400x225 | 1.000 | 1.000 | 1 | 1 | 10012 |
| Composer/BillboardCompositePass/additive fullscreen composite/Renderer/WebGLRenderer.render submission/render target 800x450 | 0.390 | 0.390 | 1 | 1 | 2503 |

## Hierarchical Deltas

- All optional postprocessing: 0.288ms/frame (Default -> Post disabled)
- Local reflections: -0.137ms/frame (Post disabled -> Post + reflections disabled)
- PBR/textured opaque over unlit: 0.150ms/frame (Post + all local lighting disabled -> Unlit baseline)

## Loop Populations

- rendererGeometries: 215
- rendererPrograms: 50
- rendererTextures: 100
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
    "textures": 100
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
  "programs": 50,
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

## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (12844:45064) busy: 7.920ms/frame union; 7.920ms/frame top-level trace events
  - RunTask: 7.920ms/frame inclusive; 168.542ms max; 23242 events
    - ThreadControllerImpl::RunTask: 7.856ms/frame inclusive; 168.526ms max; 20466 events
      - ProxyMain::BeginMainFrame: 4.596ms/frame inclusive; 168.522ms max; 1600 events
        - WebFrameWidgetImpl::BeginMainFrame: 4.417ms/frame inclusive; 167.990ms max; 1600 events
          - Blink.Animate.UpdateTime: 4.415ms/frame inclusive; 167.983ms max; 1600 events
            - PageAnimator::serviceScriptedAnimations: 4.412ms/frame inclusive; 167.978ms max; 1600 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 4.395ms/frame inclusive; 167.939ms max; 1600 events
                - FireAnimationFrame: 4.393ms/frame inclusive; 167.883ms max; 4530 events
                  - AsyncTask Run: 4.390ms/frame inclusive; 167.882ms max; 4530 events
                    - v8.callFunction: 4.378ms/frame inclusive; 167.865ms max; 4530 events
                      - FunctionCall: Gz: 4.336ms/frame inclusive; 167.855ms max; 1600 events
                        - GLES2Implementation::GetProgramiv: 0.375ms/frame inclusive; 89.612ms max; 728 events
                          - ImplementationBase::GetBucketContents: 0.375ms/frame inclusive; 89.603ms max; 76 events
                            - ImplementationBase::WaitForCmd: 0.375ms/frame inclusive; 89.595ms max; 76 events
                              - CommandBufferHelper::Finish: 0.375ms/frame inclusive; 89.593ms max; 76 events
                                - CommandBufferProxyImpl::WaitForGetOffset: 0.374ms/frame inclusive; 89.508ms max; 76 events
                                  - trace leaf; browser did not expose smaller child events: 0.374ms/frame
                        - ImageDecoder::DecodeFrameBufferAtIndex: 0.180ms/frame inclusive; 16.765ms max; 40 events
                          - Decode Image: 0.180ms/frame inclusive; 16.755ms max; 40 events
                            - trace leaf; browser did not expose smaller child events: 0.180ms/frame
                        - self/untraced child work: 3.658ms/frame
        - WebFrameWidgetImpl::UpdateLifecycle: 0.126ms/frame inclusive; 0.970ms max; 1600 events
      - MessagePort::Accept: 1.947ms/frame inclusive; 77.291ms max; 413 events
        - v8.callFunction: 1.944ms/frame inclusive; 77.270ms max; 413 events
          - FunctionCall: U: 1.940ms/frame inclusive; 76.214ms max; 413 events
            - self/untraced child work: 1.829ms/frame
      - SimpleWatcher::OnHandleReady: 1.085ms/frame inclusive; 31.799ms max; 435 events
        - MessagePort::Accept: 1.075ms/frame inclusive; 31.791ms max; 164 events
          - v8.callFunction: 1.074ms/frame inclusive; 31.765ms max; 164 events
            - FunctionCall: U: 1.072ms/frame inclusive; 31.759ms max; 164 events
              - self/untraced child work: 1.036ms/frame
- CrGpuMain (27732:46568) busy: 1.911ms/frame union; 1.911ms/frame top-level trace events
  - RunTask: 1.911ms/frame inclusive; 89.361ms max; 20865 events
    - ThreadControllerImpl::RunTask: 1.894ms/frame inclusive; 89.355ms max; 20861 events
      - Scheduler::RunTask: 1.845ms/frame inclusive; 89.345ms max; 18663 events
        - GpuChannel::ExecuteDeferredRequest: 1.735ms/frame inclusive; 89.339ms max; 15461 events
          - GPUTask: 1.716ms/frame inclusive; 89.328ms max; 15421 events
            - WebGL: 1.538ms/frame inclusive; 89.228ms max; 15295 events
              - CommandBuffer::Flush: 1.531ms/frame inclusive; 89.225ms max; 15295 events
                - CommandBufferStub::OnAsyncFlush: 1.527ms/frame inclusive; 89.225ms max; 15295 events
                  - CommandBufferService:PutChanged: 1.506ms/frame inclusive; 89.201ms max; 15295 events
                    - self/untraced child work: 1.504ms/frame
            - self/untraced child work: 0.146ms/frame
- ThreadPoolForegroundWorker (12844:46456) busy: 0.478ms/frame union; 0.478ms/frame top-level trace events
  - ThreadPool_RunTask: 0.478ms/frame inclusive; 32.738ms max; 4179 events
    - self/untraced child work: 0.259ms/frame
- ThreadPoolForegroundWorker (27732:40420) busy: 0.352ms/frame union; 0.352ms/frame top-level trace events
  - ThreadPool_RunTask: 0.352ms/frame inclusive; 87.860ms max; 56 events
    - ANGLEPlatformImpl::RunWorkerTask: 0.352ms/frame inclusive; 87.848ms max; 56 events
      - trace leaf; browser did not expose smaller child events: 0.352ms/frame
- ThreadPoolForegroundWorker (27732:23124) busy: 0.271ms/frame union; 0.271ms/frame top-level trace events
  - ThreadPool_RunTask: 0.271ms/frame inclusive; 86.916ms max; 66 events
    - ANGLEPlatformImpl::RunWorkerTask: 0.270ms/frame inclusive; 86.892ms max; 66 events
      - trace leaf; browser did not expose smaller child events: 0.270ms/frame
- ThreadPoolForegroundWorker (12844:27124) busy: 0.228ms/frame union; 0.228ms/frame top-level trace events
  - ThreadPool_RunTask: 0.228ms/frame inclusive; 33.413ms max; 571 events
    - V8.GC_SCAVENGER_BACKGROUND_SCAVENGE_PARALLEL: 0.100ms/frame inclusive; 2.144ms max; 270 events
      - trace leaf; browser did not expose smaller child events: 0.100ms/frame
- Compositor (12844:28428) busy: 0.226ms/frame union; 0.226ms/frame top-level trace events
  - RunTask: 0.164ms/frame inclusive; 2.139ms max; 20219 events
    - ThreadControllerImpl::RunTask: 0.155ms/frame inclusive; 2.134ms max; 18237 events
- ThreadPoolForegroundWorker (12844:27576) busy: 0.188ms/frame union; 0.188ms/frame top-level trace events
  - ThreadPool_RunTask: 0.188ms/frame inclusive; 34.134ms max; 355 events
- VizCompositorThread (27732:37516) busy: 0.142ms/frame union; 0.142ms/frame top-level trace events
  - RunTask: 0.142ms/frame inclusive; 0.411ms max; 8544 events
    - ThreadControllerImpl::RunTask: 0.136ms/frame inclusive; 0.411ms max; 8525 events
- ThreadPoolForegroundWorker (12844:41900) busy: 0.141ms/frame union; 0.141ms/frame top-level trace events
  - ThreadPool_RunTask: 0.141ms/frame inclusive; 17.650ms max; 340 events
- Chrome_ChildIOThread (27732:45536) busy: 0.136ms/frame union; 0.136ms/frame top-level trace events
  - IOHandler::OnIOCompleted: 0.134ms/frame inclusive; 0.226ms max; 24312 events
- ThreadPoolForegroundWorker (12844:36600) busy: 0.129ms/frame union; 0.129ms/frame top-level trace events
  - ThreadPool_RunTask: 0.129ms/frame inclusive; 13.612ms max; 307 events
- ThreadPoolForegroundWorker (12844:42896) busy: 0.127ms/frame union; 0.127ms/frame top-level trace events
  - ThreadPool_RunTask: 0.127ms/frame inclusive; 17.460ms max; 295 events
- ThreadPoolForegroundWorker (12844:26424) busy: 0.115ms/frame union; 0.115ms/frame top-level trace events
  - ThreadPool_RunTask: 0.115ms/frame inclusive; 13.413ms max; 235 events
- ThreadPoolForegroundWorker (12844:20328) busy: 0.113ms/frame union; 0.113ms/frame top-level trace events
  - ThreadPool_RunTask: 0.113ms/frame inclusive; 13.366ms max; 284 events
- Chrome_ChildIOThread (12844:45700) busy: 0.110ms/frame union; 0.110ms/frame top-level trace events
