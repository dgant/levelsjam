# Performance Profile

Captured: 2026-04-27T18:12:56.682Z
Renderer: Google Inc. (NVIDIA) ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)

## Live End-To-End Traversal

- Average frame: 19.441ms (51.439 FPS)
- Min/max frame: 6.900ms / 2533.200ms
- Samples: 2315
- Long frames over 50ms: 20

## Frame-Time Tree

- Live traversal frame: 19.441ms (51.439 FPS)
  - Instrumented frame work: 5.805ms
    - Renderer: 5.738ms
      - WebGLRenderer.render submission: 5.738ms
        - render target 800x450: 5.666ms avg, 2526.400ms max, 23150 calls
  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: 13.636ms
    - App-level JavaScript instrumentation stops here; the Chrome Trace Event Tree below breaks this bucket down from browser trace events.

## Long Frames

- 1949.900ms at +2823.400ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.700ms at +2890.100ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 133.300ms at +3023.400ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":99,"sceneChildren":8}
- 66.600ms at +3206.700ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.700ms at +3273.400ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +3323.400ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 66.600ms at +3523.400ms; maze=chamber-1; programs=n/a; fire=true; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 2533.200ms at +11056.400ms; maze=maze-001; programs=n/a; fire=n/a; loops={"mountedLevels":2,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":4}
- 183.300ms at +12156.400ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.100ms at +12473.100ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 83.400ms at +12573.100ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 183.400ms at +17472.900ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +17656.200ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 99.900ms at +17872.800ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 83.300ms at +17956.100ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 166.700ms at +24005.900ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +24055.900ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":8}
- 50.000ms at +24189.300ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":4,"residentVolumetricProbes":295,"sceneChildren":8}
- 99.900ms at +24439.200ms; maze=chamber-1; programs=n/a; fire=n/a; loops={"mountedLevels":6,"residentReflectionProbes":12,"residentVolumetricProbes":295,"sceneChildren":8}
- 50.000ms at +28355.700ms; maze=maze-005; programs=n/a; fire=n/a; loops={"mountedLevels":2,"residentReflectionProbes":4,"residentVolumetricProbes":139,"sceneChildren":4}

## Controlled Render Cost

| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |

## Hierarchical Deltas


## Loop Populations


## Scene Object Counts


## Chrome Trace Event Tree

- Durations are normalized to the same live traversal frame count as the FPS sample.
- Thread trees can overlap each other; use them to locate expensive work, not as additive wall-clock children.
- Every captured thread with at least 0.1ms/frame of busy work is included.
- Leaves above 0.1ms/frame are marked as trace leaves when Chrome did not expose lower-level child events.

- CrRendererMain (36132:36288) busy: 8.484ms/frame union; 8.484ms/frame top-level trace events
  - RunTask: 8.484ms/frame inclusive; 2530.495ms max; 14329 events
    - ThreadControllerImpl::RunTask: 8.434ms/frame inclusive; 2530.464ms max; 13720 events
      - ProxyMain::BeginMainFrame: 6.081ms/frame inclusive; 2530.461ms max; 1561 events
        - WebFrameWidgetImpl::BeginMainFrame: 5.899ms/frame inclusive; 2529.604ms max; 1561 events
          - Blink.Animate.UpdateTime: 5.896ms/frame inclusive; 2529.599ms max; 1561 events
            - PageAnimator::serviceScriptedAnimations: 5.894ms/frame inclusive; 2529.596ms max; 1561 events
              - FrameRequestCallbackCollection::ExecuteFrameCallbacks: 5.876ms/frame inclusive; 2529.567ms max; 1561 events
                - FireAnimationFrame: 5.874ms/frame inclusive; 2529.528ms max; 4485 events
                  - AsyncTask Run: 5.871ms/frame inclusive; 2529.527ms max; 4485 events
                    - v8.callFunction: 5.860ms/frame inclusive; 2529.511ms max; 4485 events
                      - FunctionCall: Bz: 5.821ms/frame inclusive; 2529.463ms max; 1561 events
                        - GLES2Implementation::GetProgramiv: 2.169ms/frame inclusive; 2525.180ms max; 803 events
                          - ImplementationBase::GetBucketContents: 2.168ms/frame inclusive; 2525.127ms max; 77 events
                            - ImplementationBase::WaitForCmd: 2.168ms/frame inclusive; 2525.123ms max; 77 events
                              - CommandBufferHelper::Finish: 2.168ms/frame inclusive; 2525.121ms max; 77 events
                                - CommandBufferProxyImpl::WaitForGetOffset: 2.168ms/frame inclusive; 2525.052ms max; 77 events
                                  - trace leaf; browser did not expose smaller child events: 2.168ms/frame
                        - ImageDecoder::DecodeFrameBufferAtIndex: 0.183ms/frame inclusive; 15.037ms max; 40 events
                          - Decode Image: 0.183ms/frame inclusive; 15.032ms max; 40 events
                            - trace leaf; browser did not expose smaller child events: 0.183ms/frame
                        - self/untraced child work: 3.367ms/frame
        - WebFrameWidgetImpl::UpdateLifecycle: 0.127ms/frame inclusive; 0.735ms max; 1561 events
      - MessagePort::Accept: 1.511ms/frame inclusive; 62.744ms max; 366 events
        - v8.callFunction: 1.507ms/frame inclusive; 62.727ms max; 366 events
          - FunctionCall: U: 1.503ms/frame inclusive; 61.865ms max; 366 events
            - self/untraced child work: 1.412ms/frame
      - SimpleWatcher::OnHandleReady: 0.627ms/frame inclusive; 21.553ms max; 295 events
        - MessagePort::Accept: 0.618ms/frame inclusive; 21.545ms max; 145 events
          - v8.callFunction: 0.616ms/frame inclusive; 21.520ms max; 145 events
            - FunctionCall: U: 0.614ms/frame inclusive; 21.462ms max; 145 events
              - self/untraced child work: 0.600ms/frame
- CrGpuMain (38368:23240) busy: 3.541ms/frame union; 3.541ms/frame top-level trace events
  - RunTask: 3.541ms/frame inclusive; 2524.826ms max; 16731 events
    - ThreadControllerImpl::RunTask: 3.527ms/frame inclusive; 2524.822ms max; 16731 events
      - Scheduler::RunTask: 3.505ms/frame inclusive; 2524.817ms max; 16588 events
        - GpuChannel::ExecuteDeferredRequest: 3.388ms/frame inclusive; 2524.812ms max; 13461 events
          - GPUTask: 3.371ms/frame inclusive; 2524.809ms max; 13425 events
            - WebGL: 3.279ms/frame inclusive; 2524.701ms max; 13306 events
              - CommandBuffer::Flush: 3.273ms/frame inclusive; 2524.699ms max; 13306 events
                - CommandBufferStub::OnAsyncFlush: 3.269ms/frame inclusive; 2524.698ms max; 13306 events
                  - CommandBufferService:PutChanged: 3.250ms/frame inclusive; 2524.665ms max; 13306 events
                    - self/untraced child work: 3.247ms/frame
- ThreadPoolForegroundWorker (38368:28816) busy: 1.385ms/frame union; 1.385ms/frame top-level trace events
  - ThreadPool_RunTask: 1.385ms/frame inclusive; 2507.181ms max; 64 events
    - ANGLEPlatformImpl::RunWorkerTask: 1.384ms/frame inclusive; 2507.157ms max; 64 events
      - trace leaf; browser did not expose smaller child events: 1.384ms/frame
- ThreadPoolForegroundWorker (38368:20552) busy: 0.775ms/frame union; 0.775ms/frame top-level trace events
  - ThreadPool_RunTask: 0.775ms/frame inclusive; 1755.455ms max; 52 events
    - ANGLEPlatformImpl::RunWorkerTask: 0.774ms/frame inclusive; 1755.433ms max; 51 events
      - trace leaf; browser did not expose smaller child events: 0.774ms/frame
- ThreadPoolForegroundWorker (36132:28164) busy: 0.539ms/frame union; 0.539ms/frame top-level trace events
  - ThreadPool_RunTask: 0.539ms/frame inclusive; 31.493ms max; 4017 events
    - self/untraced child work: 0.373ms/frame
- Compositor (36132:18524) busy: 0.249ms/frame union; 0.249ms/frame top-level trace events
  - RunTask: 0.178ms/frame inclusive; 0.546ms max; 19621 events
    - ThreadControllerImpl::RunTask: 0.168ms/frame inclusive; 0.545ms max; 17775 events
- ThreadPoolForegroundWorker (36132:43556) busy: 0.207ms/frame union; 0.207ms/frame top-level trace events
  - ThreadPool_RunTask: 0.207ms/frame inclusive; 32.816ms max; 611 events
- ThreadPoolForegroundWorker (36132:36792) busy: 0.156ms/frame union; 0.156ms/frame top-level trace events
  - ThreadPool_RunTask: 0.156ms/frame inclusive; 33.088ms max; 258 events
- ThreadPoolForegroundWorker (38368:43024) busy: 0.153ms/frame union; 0.153ms/frame top-level trace events
  - ThreadPool_RunTask: 0.153ms/frame inclusive; 48.660ms max; 74 events
    - ANGLEPlatformImpl::RunWorkerTask: 0.153ms/frame inclusive; 48.635ms max; 73 events
      - trace leaf; browser did not expose smaller child events: 0.153ms/frame
- VizCompositorThread (38368:24180) busy: 0.149ms/frame union; 0.149ms/frame top-level trace events
  - RunTask: 0.149ms/frame inclusive; 0.347ms max; 8672 events
    - ThreadControllerImpl::RunTask: 0.142ms/frame inclusive; 0.345ms max; 8667 events
- Chrome_ChildIOThread (38368:38432) busy: 0.131ms/frame union; 0.131ms/frame top-level trace events
  - IOHandler::OnIOCompleted: 0.129ms/frame inclusive; 0.191ms max; 22488 events
- Chrome_ChildIOThread (36132:44044) busy: 0.105ms/frame union; 0.105ms/frame top-level trace events
- ThreadPoolForegroundWorker (36132:21268) busy: 0.103ms/frame union; 0.103ms/frame top-level trace events
  - ThreadPool_RunTask: 0.103ms/frame inclusive; 31.892ms max; 241 events
