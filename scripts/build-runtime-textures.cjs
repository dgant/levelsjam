const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const rootDir = path.resolve(__dirname, '..')

const runtimeTextureSpecs = [
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_ambientocclusion-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_ambientocclusion-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_basecolor-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_basecolor-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_height-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_height-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_normal-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_normal-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_roughness-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_roughness-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_ambientocclusion-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_ambientocclusion-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_basecolor-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_basecolor-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_height-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_height-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_normal-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_normal-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_roughness-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_roughness-1K.png'
  }
]

const fireFlipbookSpec = {
  crop: {
    maxX: 0.6187683284457478,
    maxY: 0.8123167155425219,
    minX: 0.25806451612903225,
    minY: 0.18621700879765396
  },
  grid: 6,
  source: 'public/textures/fire/CampFire_l_nosmoke_front_Loop_01_4K_6x6.png',
  target: 'public/textures/runtime/fire/CampFire_l_nosmoke_front_Loop_01_4K_6x6_cropped.png'
}

function writeIfChanged(filePath, bytes) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath)

    if (existing.length === bytes.length && existing.equals(bytes)) {
      return false
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, bytes)
  return true
}

function buildCroppedFireFlipbook(spec) {
  const sourcePath = path.join(rootDir, spec.source)
  const sourceBytes = fs.readFileSync(sourcePath)
  const sourcePng = PNG.sync.read(sourceBytes)
  const sourceCellWidth = sourcePng.width / spec.grid
  const sourceCellHeight = sourcePng.height / spec.grid
  const cropX0 = Math.round(spec.crop.minX * sourceCellWidth)
  const cropY0 = Math.round(spec.crop.minY * sourceCellHeight)
  const cropX1 = Math.round(spec.crop.maxX * sourceCellWidth)
  const cropY1 = Math.round(spec.crop.maxY * sourceCellHeight)
  const cropWidth = cropX1 - cropX0
  const cropHeight = cropY1 - cropY0
  const targetPng = new PNG({
    width: cropWidth * spec.grid,
    height: cropHeight * spec.grid,
    colorType: 6
  })

  for (let row = 0; row < spec.grid; row += 1) {
    for (let column = 0; column < spec.grid; column += 1) {
      const sourceBaseX = Math.round(column * sourceCellWidth) + cropX0
      const sourceBaseY = Math.round(row * sourceCellHeight) + cropY0
      const targetBaseX = column * cropWidth
      const targetBaseY = row * cropHeight

      for (let y = 0; y < cropHeight; y += 1) {
        const sourceY = sourceBaseY + y
        const targetY = targetBaseY + y

        for (let x = 0; x < cropWidth; x += 1) {
          const sourceIndex = ((sourceY * sourcePng.width) + sourceBaseX + x) * 4
          const targetIndex = ((targetY * targetPng.width) + targetBaseX + x) * 4
          targetPng.data[targetIndex] = sourcePng.data[sourceIndex]
          targetPng.data[targetIndex + 1] = sourcePng.data[sourceIndex + 1]
          targetPng.data[targetIndex + 2] = sourcePng.data[sourceIndex + 2]
          targetPng.data[targetIndex + 3] = sourcePng.data[sourceIndex + 3]
        }
      }
    }
  }

  const targetBytes = PNG.sync.write(targetPng, { colorType: 6 })
  const written = writeIfChanged(path.join(rootDir, spec.target), targetBytes)

  console.log(
    `[build-runtime-textures] ${spec.target} ${sourceBytes.length} -> ${targetBytes.length}${written ? '' : ' (unchanged)'}`
  )

  return written
}

let writtenCount = 0

for (const spec of runtimeTextureSpecs) {
  const sourcePath = path.join(rootDir, spec.source)
  const targetPath = path.join(rootDir, spec.target)
  const sourceBytes = fs.readFileSync(sourcePath)
  const png = PNG.sync.read(sourceBytes)
  const targetBytes = PNG.sync.write(png, {
    colorType: png.colorType === 0 ? 0 : 6
  })
  const written = writeIfChanged(targetPath, targetBytes)
  writtenCount += written ? 1 : 0
  console.log(
    `[build-runtime-textures] ${spec.target} ${sourceBytes.length} -> ${targetBytes.length}${written ? '' : ' (unchanged)'}`
  )
}

writtenCount += buildCroppedFireFlipbook(fireFlipbookSpec) ? 1 : 0

console.log(
  `[build-runtime-textures] wrote ${writtenCount}/${runtimeTextureSpecs.length + 1} runtime textures`
)
