const fs = require('node:fs')
const path = require('node:path')

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')

function removeTarget(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true })
}

function copyDirectory(sourcePath, targetPath) {
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true })
}

for (const directoryName of ['assets', 'textures']) {
  removeTarget(path.join(rootDir, directoryName))
  copyDirectory(path.join(distDir, directoryName), path.join(rootDir, directoryName))
}
