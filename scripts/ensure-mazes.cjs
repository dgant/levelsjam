const path = require('path')

async function main() {
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
    ensureMazeFiles
  } = await import('../src/lib/mazePersistence.js')
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({ directory: mazeDirectory })

  console.log(`Ensured ${files.length} persisted mazes in ${mazeDirectory}`)
  console.log(`Wrote lightmap artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
