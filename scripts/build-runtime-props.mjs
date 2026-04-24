import fs from 'node:fs/promises'
import path from 'node:path'
import { Jimp } from 'jimp'

const PROJECT_ROOT = process.cwd()

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true })
}

async function copyFileIfChanged(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath)
  let matches = false

  try {
    const target = await fs.readFile(targetPath)
    matches = Buffer.compare(source, target) === 0
  } catch {
    matches = false
  }

  if (!matches) {
    await fs.writeFile(targetPath, source)
  }
}

async function buildGateRuntimeAssets() {
  const sourceDirectory = path.join(PROJECT_ROOT, 'public', 'models', 'metal_gate')
  const targetDirectory = path.join(PROJECT_ROOT, 'public', 'models', 'metal_gate_runtime')
  const targetTextureDirectory = path.join(targetDirectory, 'textures')
  const targetSize = 512
  const gltf = JSON.parse(
    await fs.readFile(path.join(sourceDirectory, 'scene.gltf'), 'utf8')
  )

  await ensureDirectory(targetTextureDirectory)
  await copyFileIfChanged(
    path.join(sourceDirectory, 'license.txt'),
    path.join(targetDirectory, 'license.txt')
  )
  await copyFileIfChanged(
    path.join(sourceDirectory, 'scene.bin'),
    path.join(targetDirectory, 'scene.bin')
  )

  for (const image of gltf.images ?? []) {
    if (typeof image.uri !== 'string' || image.uri.length === 0) {
      continue
    }

    const sourceImagePath = path.join(sourceDirectory, image.uri)
    const targetImagePath = path.join(targetDirectory, image.uri)
    const sourceBuffer = await fs.readFile(sourceImagePath)
    const jimp = await Jimp.fromBuffer(sourceBuffer, {
      'image/jpeg': { maxMemoryUsageInMB: 2048 },
      'image/png': { maxMemoryUsageInMB: 2048 }
    })

    jimp.resize({ h: targetSize, w: targetSize })

    await ensureDirectory(path.dirname(targetImagePath))
    await jimp.write(targetImagePath)
  }

  await fs.writeFile(
    path.join(targetDirectory, 'scene.gltf'),
    `${JSON.stringify(gltf, null, 2)}\n`
  )
}

async function main() {
  await buildGateRuntimeAssets()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
