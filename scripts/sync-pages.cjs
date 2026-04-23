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

function removeZipFiles(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const entryPath = path.join(targetPath, entry.name)

    if (entry.isDirectory()) {
      removeZipFiles(entryPath)
      continue
    }

    if (entry.name.toLowerCase().endsWith('.zip')) {
      fs.rmSync(entryPath, { force: true })
    }
  }
}

for (const { sourcePath, targetPath } of [
  {
    sourcePath: path.join(distDir, 'assets'),
    targetPath: path.join(rootDir, 'assets')
  },
  {
    sourcePath: path.join(publicDir, 'maze-data'),
    targetPath: path.join(rootDir, 'maze-data')
  },
  {
    sourcePath: path.join(publicDir, 'models'),
    targetPath: path.join(rootDir, 'models')
  },
  {
    sourcePath: path.join(publicDir, 'textures'),
    targetPath: path.join(rootDir, 'textures')
  }
]) {
  removeTarget(targetPath)
  copyDirectory(sourcePath, targetPath)

  if (targetPath === path.join(rootDir, 'models')) {
    removeZipFiles(targetPath)
  }
}
