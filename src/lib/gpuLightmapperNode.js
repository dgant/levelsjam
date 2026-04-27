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

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(
          `GPU lightmap worker failed with exit code ${code}\n${stdout}${stderr}`
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
