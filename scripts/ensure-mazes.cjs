const path = require('path')
const { spawnSync } = require('node:child_process')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runScript(scriptName) {
  const startedAt = Date.now()

  console.log(`[ensure:mazes] starting ${scriptName}`)
  const result = spawnSync(npmCommand, ['run', scriptName], {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with code ${result.status ?? 1}`)
  }

  console.log(
    `[ensure:mazes] finished ${scriptName} in ${Date.now() - startedAt}ms`
  )
}

async function main() {
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
    ensureMazeFiles
  } = await import('../src/lib/mazePersistence.js')
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const ensureStartedAt = Date.now()
  const files = await ensureMazeFiles({
    directory: mazeDirectory,
    onProgress(progress) {
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

  console.log(
    `[ensure:mazes] ensured maze files in ${Date.now() - ensureStartedAt}ms`
  )

  runScript('build:pages')
  runScript('export:maze-probes')
  console.log(`Ensured ${files.length} persisted mazes in ${mazeDirectory}`)
  console.log(`Wrote maze artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
