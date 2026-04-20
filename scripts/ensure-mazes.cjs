const path = require('path')
const { spawnSync } = require('node:child_process')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runScript(scriptName) {
  const result = spawnSync(npmCommand, ['run', scriptName], {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with code ${result.status ?? 1}`)
  }
}

async function main() {
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
    ensureMazeFiles
  } = await import('../src/lib/mazePersistence.js')
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({ directory: mazeDirectory })

  runScript('build:pages')
  runScript('export:maze-probes')

  console.log(`Ensured ${files.length} persisted mazes in ${mazeDirectory}`)
  console.log(`Wrote maze artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
