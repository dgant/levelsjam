const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const sourceDirectory = path.join(rootDir, 'src', 'data', 'mazes')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const mazeFilePattern = /^maze-\d{3}\.js$/

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)
  return imported.default
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true })

  for (const fileName of fs.readdirSync(outputDirectory)) {
    if (fileName.endsWith('.json')) {
      fs.rmSync(path.join(outputDirectory, fileName), { force: true })
    }
  }

  const mazeFileNames = fs.readdirSync(sourceDirectory)
    .filter((fileName) => mazeFilePattern.test(fileName))
    .sort()
  const mazeIds = []

  for (let index = 0; index < mazeFileNames.length; index += 1) {
    const fileName = mazeFileNames[index]
    const filePath = path.join(sourceDirectory, fileName)
    const maze = await importMazeModule(filePath)
    const mazeId = path.basename(fileName, '.js')

    console.log(
      `[sync-maze-runtime-data] writing ${index + 1}/${mazeFileNames.length} ${mazeId}.json`
    )
    fs.writeFileSync(
      path.join(outputDirectory, `${mazeId}.json`),
      JSON.stringify(maze)
    )
    mazeIds.push(mazeId)
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'index.json'),
    JSON.stringify({ mazeIds }, null, 2)
  )

  console.log(
    `[sync-maze-runtime-data] wrote ${mazeIds.length} maze payloads to ${outputDirectory}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
