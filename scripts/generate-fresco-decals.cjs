const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const outDir = path.resolve(__dirname, '..', 'public', 'textures', 'decals')
const requiredFiles = [
  'minoan-labyrinth-toss.png',
  'minoan-cowering-minotaur.png',
  'minoan-blue-flame-altar.png',
  'minoan-slaying-minotaur.png',
  'minoan-wolf-hunt.png',
  'minoan-gated-minotaur.png',
  'minoan-throne-skulls.png'
]

function validateDecal(fileName) {
  const filePath = path.join(outDir, fileName)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing OpenAI-generated fresco decal asset: ${filePath}`)
  }

  const png = PNG.sync.read(fs.readFileSync(filePath))

  if (png.width !== 1024 || png.height !== 1024) {
    throw new Error(
      `${fileName} must be 1024x1024, got ${png.width}x${png.height}`
    )
  }

  let hasTransparentPixel = false
  let hasOpaquePixel = false

  for (let index = 3; index < png.data.length; index += 4) {
    const alpha = png.data[index]

    hasTransparentPixel ||= alpha === 0
    hasOpaquePixel ||= alpha === 255

    if (hasTransparentPixel && hasOpaquePixel) {
      return
    }
  }

  throw new Error(`${fileName} must include both transparent and opaque alpha`)
}

fs.mkdirSync(outDir, { recursive: true })

for (const fileName of requiredFiles) {
  validateDecal(fileName)
}

console.log(
  `[generate-fresco-decals] verified ${requiredFiles.length} OpenAI-generated decal assets`
)
