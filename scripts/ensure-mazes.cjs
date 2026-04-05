const path = require('path')

async function main() {
  const { ensureMazeFiles } = await import('../src/lib/mazePersistence.js')
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({ directory: mazeDirectory })

  console.log(`Ensured ${files.length} persisted mazes in ${mazeDirectory}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
