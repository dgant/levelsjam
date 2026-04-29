const path = require('path')
const { spawn } = require('node:child_process')
const { BakeTimingRecorder } = require('./bake-timing.cjs')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const buildPagesTimeoutMs = Number(process.env.LEVELSJAM_BUILD_PAGES_TIMEOUT_MS ?? '180000')
const exportMazeProbesTimeoutMs = Number(process.env.LEVELSJAM_EXPORT_MAZE_PROBES_TIMEOUT_MS ?? '600000')
let activeRecorder = null

function killProcessTree(processId) {
  if (!processId) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(processId), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })

      killer.on('close', resolve)
      killer.on('error', resolve)
      return
    }

    try {
      process.kill(-processId, 'SIGTERM')
    } catch {
      try {
        process.kill(processId, 'SIGTERM')
      } catch {
        resolve()
        return
      }
    }
    setTimeout(resolve, 1000)
  })
}

function runScript(scriptName, { recorder, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const stepId = recorder.beginStep(`npm:${scriptName}`, {
      stepKind: 'wrapper',
      timeoutMs
    })
    let settled = false
    let timedOut = false

    console.log(`[ensure:mazes] starting ${scriptName} (timeout ${timeoutMs}ms)`)
    const child = spawn(npmCommand, ['run', scriptName], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LEVELSJAM_BAKE_TIMING_FILE: recorder.filePath
      },
      stdio: 'inherit',
      windowsHide: true
    })
    const timeout = setTimeout(async () => {
      timedOut = true
      console.error(
        `[ensure:mazes] ${scriptName} timed out after ${timeoutMs}ms; killing process tree`
      )
      await killProcessTree(child.pid)
    }, timeoutMs)

    child.on('error', async (error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      await killProcessTree(child.pid)
      recorder.reload()
      recorder.endStep(stepId, 'failed', {
        error: error.message
      })
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      recorder.reload()
      if (timedOut) {
        recorder.endStep(stepId, 'timeout', {
          durationMs: Date.now() - startedAt
        })
        reject(new Error(`${scriptName} timed out after ${timeoutMs}ms`))
        return
      }
      if (code !== 0) {
        recorder.endStep(stepId, 'failed', {
          exitCode: code ?? 1
        })
        reject(new Error(`${scriptName} exited with code ${code ?? 1}`))
        return
      }

      recorder.endStep(stepId, 'completed')
      console.log(
        `[ensure:mazes] finished ${scriptName} in ${Date.now() - startedAt}ms`
      )
      resolve()
    })
  })
}

async function main() {
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
    ensureMazeFiles
  } = await import('../src/lib/mazePersistence.js')
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const recorder = process.env.LEVELSJAM_BAKE_TIMING_FILE
    ? BakeTimingRecorder.open(process.env.LEVELSJAM_BAKE_TIMING_FILE)
    : new BakeTimingRecorder({ kind: 'ensure:mazes' })
  activeRecorder = recorder
  const ensureStartedAt = Date.now()
  const ensureStepId = recorder.beginStep('ensure-maze-files', {
    directory: mazeDirectory,
    stepKind: 'wrapper'
  })
  const activeLightmapSteps = new Map()
  const activeLightmapGpuSteps = new Map()
  let files = []

  try {
    files = await ensureMazeFiles({
      directory: mazeDirectory,
      onProgress(progress) {
        recorder.recordProgress(
          `${progress.stage}${progress.action ? `:${progress.action}` : ''}`,
          progress
        )
        if (progress.quality) {
          recorder.setQuality('lightmap', progress.quality)
        }

        if (progress.stage === 'inspect-existing') {
          const action = progress.action ? ` ${progress.action}` : ''
          const position =
            progress.index && progress.total
              ? ` ${progress.index}/${progress.total}`
              : ''

          console.log(
            `[ensure:mazes] inspect${position}${action} ${progress.fileName ?? ''}`.trim()
          )
          return
        }

        if (progress.stage === 'bake-lightmap') {
          const action = progress.action ? ` ${progress.action}` : ''
          const mazeLabel = progress.mazeId ?? progress.fileName ?? 'unknown-maze'

          if (progress.action === 'start') {
            activeLightmapSteps.set(
              mazeLabel,
              recorder.beginStep('lightmap', {
                actionReason: progress.actionReason,
                fileName: progress.fileName,
                levelId: mazeLabel,
                stepKind: 'wrapper'
              })
            )
          }
          if (progress.action === 'gpu-job-start') {
            activeLightmapGpuSteps.set(
              mazeLabel,
              recorder.beginStep('lightmap-gpu-job', {
                fileName: progress.fileName,
                levelId: mazeLabel,
                quality: progress.quality,
                workCounts: progress.workCounts
              })
            )
          }
          if (progress.action === 'gpu-job-finish') {
            const gpuStepId = activeLightmapGpuSteps.get(mazeLabel)

            if (gpuStepId) {
              recorder.endStep(gpuStepId, 'completed', {
                renderer: progress.renderer,
                vendor: progress.vendor,
                workCounts: progress.workCounts
              })
              activeLightmapGpuSteps.delete(mazeLabel)
            }
          }
          if (progress.action === 'finish' || progress.action === 'failed') {
            const gpuStepId = activeLightmapGpuSteps.get(mazeLabel)
            const lightmapStepId = activeLightmapSteps.get(mazeLabel)

            if (gpuStepId) {
              recorder.endStep(gpuStepId, progress.action === 'failed' ? 'failed' : 'completed', {
                error: progress.error
              })
              activeLightmapGpuSteps.delete(mazeLabel)
            }
            if (lightmapStepId) {
              recorder.endStep(lightmapStepId, progress.action === 'failed' ? 'failed' : 'completed', {
                error: progress.error,
                lightmap: progress.lightmap
              })
              activeLightmapSteps.delete(mazeLabel)
            }
          }
          console.log(
            `[ensure:mazes] lightmap ${mazeLabel}${action}`.trim()
          )
          return
        }

        if (progress.stage === 'generate-missing') {
          console.log(
            `[ensure:mazes] generated ${progress.fileName} (${progress.validCount} valid mazes ready)`
          )
          return
        }

        if (progress.stage === 'dump-artifacts') {
          console.log(
            `[ensure:mazes] dumping artifacts ${progress.index}/${progress.total} for ${progress.mazeId}`
          )
        }
      }
    })
    recorder.endStep(ensureStepId, 'completed', {
      workCounts: {
        levels: files.length
      }
    })
  } catch (error) {
    recorder.endStep(ensureStepId, 'failed', {
      error: error.message
    })
    throw error
  }

  console.log(
    `[ensure:mazes] ensured maze files in ${Date.now() - ensureStartedAt}ms`
  )

  await runScript('build:pages', {
    recorder,
    timeoutMs: buildPagesTimeoutMs
  })
  await runScript('export:maze-probes', {
    recorder,
    timeoutMs: exportMazeProbesTimeoutMs
  })
  console.log(`Ensured ${files.length} persisted mazes in ${mazeDirectory}`)
  console.log(`Wrote maze artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`)
  console.log(`Wrote bake timing to ${recorder.filePath}`)
  recorder.finish('completed', {
    workCounts: {
      levels: files.length
    }
  })
}

main().catch((error) => {
  console.error(error)
  if (activeRecorder || process.env.LEVELSJAM_BAKE_TIMING_FILE) {
    try {
      const recorder = activeRecorder ?? BakeTimingRecorder.open(process.env.LEVELSJAM_BAKE_TIMING_FILE)

      recorder.finish('failed', {
        error: error.message
      })
    } catch {
      // Preserve the original failure.
    }
  }
  process.exitCode = 1
})
