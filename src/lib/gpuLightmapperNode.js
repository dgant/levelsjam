export async function bakeGpuLightmapJob(job) {
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new Error('GPU lightmap baking is only available from Node tooling')
  }

  const [
    childProcess,
    fs,
    os,
    path,
    url
  ] = await Promise.all([
    import('node:child_process'),
    import('node:fs'),
    import('node:os'),
    import('node:path'),
    import('node:url')
  ])
  const moduleDirectory = path.default.dirname(url.default.fileURLToPath(import.meta.url))
  const rootDirectory = path.default.resolve(moduleDirectory, '..', '..')
  const workerPath = path.default.join(rootDirectory, 'scripts', 'gpu-lightmap-worker.mjs')
  const tempDirectory = fs.default.mkdtempSync(
    path.default.join(os.default.tmpdir(), 'minotaur-gpu-lightmap-')
  )
  const jobPath = path.default.join(tempDirectory, 'job.json')
  const resultPath = path.default.join(tempDirectory, 'result.json')
  const timeoutMs = Number(process.env.LEVELSJAM_GPU_LIGHTMAP_TIMEOUT_MS ?? '180000')
  const killProcessTree = (processId) => new Promise((resolve) => {
    if (!processId) {
      resolve()
      return
    }

    if (process.platform === 'win32') {
      const killer = childProcess.default.spawn(
        'taskkill',
        ['/pid', String(processId), '/T', '/F'],
        {
          stdio: 'ignore',
          windowsHide: true
        }
      )

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

  try {
    fs.default.writeFileSync(jobPath, JSON.stringify(job))

    await new Promise((resolve, reject) => {
      const child = childProcess.default.spawn(
        process.execPath,
        [workerPath, jobPath, resultPath],
        {
          cwd: rootDirectory,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )
      let stdout = ''
      let stderr = ''
      let settled = false
      let timedOut = false
      const timeout = setTimeout(async () => {
        timedOut = true
        stderr += `GPU lightmap worker timed out after ${timeoutMs}ms\n`
        await killProcessTree(child.pid)
      }, timeoutMs)

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', async (error) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeout)
        await killProcessTree(child.pid)
        reject(error)
      })
      child.on('close', (code) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeout)
        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(
          timedOut
            ? `GPU lightmap worker timed out after ${timeoutMs}ms\n${stdout}${stderr}`
            : `GPU lightmap worker failed with exit code ${code}\n${stdout}${stderr}`
        ))
      })
    })

    return JSON.parse(fs.default.readFileSync(resultPath, 'utf8'))
  } finally {
    fs.default.rmSync(tempDirectory, {
      force: true,
      recursive: true
    })
  }
}
