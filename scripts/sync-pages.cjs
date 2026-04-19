const fs = require('node:fs')
const path = require('node:path')

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')
const publicDir = path.join(rootDir, 'public')

function removeTarget(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true })
}

function copyDirectory(sourcePath, targetPath) {
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true })
}

for (const { sourcePath, targetPath } of [
  {
    sourcePath: path.join(distDir, 'assets'),
    targetPath: path.join(rootDir, 'assets')
  },
  {
    sourcePath: path.join(publicDir, 'textures'),
    targetPath: path.join(rootDir, 'textures')
  }
]) {
  removeTarget(targetPath)
  copyDirectory(sourcePath, targetPath)
}
