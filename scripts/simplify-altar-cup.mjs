import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { Jimp } from 'jimp'
import { MeshoptSimplifier } from 'meshoptimizer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const sourcePath = path.join(rootDir, 'public', 'models', 'droop_cup_4th_century_bc', 'scene.gltf')
const outputDir = path.join(rootDir, 'public', 'models', 'droop_cup_runtime')
const outputPath = path.join(outputDir, 'scene.gltf')
const TARGET_TRIANGLES = 5_000
const MIN_PRIMITIVE_TRIANGLES = 12
const MAX_ERROR = 0.2
const SIMPLIFY_FLAGS = []
const MISSING_INDEX = 0xffffffff
const MAX_TEXTURE_DIMENSION = 1024

function getPrimitiveTriangleCount(primitive) {
  const indices = primitive.getIndices()

  return indices
    ? Math.floor(indices.getCount() / 3)
    : Math.floor((primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3)
}

function getDocumentTriangleCount(document) {
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + getPrimitiveTriangleCount(primitive), 0)
}

function ensureIndices(primitive, document) {
  const existing = primitive.getIndices()

  if (existing) {
    return existing
  }

  const position = primitive.getAttribute('POSITION')

  if (!position) {
    throw new Error('Primitive is missing POSITION')
  }

  const indexArray = new Uint32Array(position.getCount())

  for (let index = 0; index < indexArray.length; index += 1) {
    indexArray[index] = index
  }

  const accessor = document
    .createAccessor()
    .setType('SCALAR')
    .setArray(indexArray)

  primitive.setIndices(accessor)
  return accessor
}

function buildAttributeStream(primitive, vertexCount) {
  const attributes = []
  const weights = []

  for (const semantic of primitive.listSemantics()) {
    if (semantic === 'POSITION') {
      continue
    }

    const accessor = primitive.getAttribute(semantic)
    const array = accessor?.getArray()

    if (!accessor || !(array instanceof Float32Array)) {
      continue
    }

    const weight =
      semantic === 'NORMAL' || semantic.startsWith('TANGENT')
        ? 0.5
        : semantic.startsWith('COLOR')
          ? 0.15
          : 0.25

    attributes.push({
      accessor,
      array,
      elementSize: accessor.getElementSize(),
      weight
    })
  }

  const stride = attributes.reduce((sum, attribute) => sum + attribute.elementSize, 0)

  if (stride === 0) {
    return {
      attributes,
      stream: new Float32Array(0),
      stride,
      weights
    }
  }

  const stream = new Float32Array(vertexCount * stride)

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    let offset = vertexIndex * stride

    for (const attribute of attributes) {
      const sourceOffset = vertexIndex * attribute.elementSize

      stream.set(
        attribute.array.subarray(sourceOffset, sourceOffset + attribute.elementSize),
        offset
      )
      offset += attribute.elementSize
    }
  }

  for (const attribute of attributes) {
    for (let element = 0; element < attribute.elementSize; element += 1) {
      weights.push(attribute.weight)
    }
  }

  return {
    attributes,
    stream,
    stride,
    weights
  }
}

function remapAttributeArray(sourceArray, elementSize, remap, nextVertexCount) {
  const outputArray = new sourceArray.constructor(nextVertexCount * elementSize)

  for (let sourceVertex = 0; sourceVertex < remap.length; sourceVertex += 1) {
    const targetVertex = remap[sourceVertex]

    if (targetVertex === MISSING_INDEX || targetVertex >= nextVertexCount) {
      continue
    }

    const sourceOffset = sourceVertex * elementSize
    const targetOffset = targetVertex * elementSize

    outputArray.set(
      sourceArray.subarray(sourceOffset, sourceOffset + elementSize),
      targetOffset
    )
  }

  return outputArray
}

function isOutputFresh() {
  try {
    const sourceStat = fs.statSync(sourcePath)
    const outputStat = fs.statSync(outputPath)

    return outputStat.mtimeMs >= sourceStat.mtimeMs
  } catch {
    return false
  }
}

async function resizeOutputTexturesIfNeeded() {
  const texturesDirectory = path.join(outputDir, 'textures')

  if (!fs.existsSync(texturesDirectory)) {
    return false
  }

  let resized = false

  for (const entry of fs.readdirSync(texturesDirectory)) {
    const extension = path.extname(entry).toLowerCase()

    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      continue
    }

    const texturePath = path.join(texturesDirectory, entry)
    const image = await Jimp.read(texturePath)
    const largest = Math.max(image.bitmap.width, image.bitmap.height)

    if (largest <= MAX_TEXTURE_DIMENSION) {
      continue
    }

    const scale = MAX_TEXTURE_DIMENSION / largest
    const width = Math.max(1, Math.round(image.bitmap.width * scale))
    const height = Math.max(1, Math.round(image.bitmap.height * scale))

    image.resize({ h: height, w: width })
    await image.write(texturePath)
    resized = true
    console.log(
      `[simplify-altar-cup] resized ${entry} to ${width}x${height}`
    )
  }

  return resized
}

async function main() {
  await MeshoptSimplifier.ready

  const io = new NodeIO()

  if (isOutputFresh()) {
    const existing = await io.read(outputPath)
    const existingTriangles = getDocumentTriangleCount(existing)

    if (existingTriangles <= TARGET_TRIANGLES * 1.1) {
      await resizeOutputTexturesIfNeeded()
      console.log(
        `[simplify-altar-cup] runtime cup is fresh at ${existingTriangles.toLocaleString()} triangles`
      )
      return
    }
  }

  const document = await io.read(sourcePath)
  const totalTriangles = getDocumentTriangleCount(document)

  console.log(
    `[simplify-altar-cup] source triangles: ${totalTriangles.toLocaleString()}`
  )

  for (
    let simplificationPass = 0;
    simplificationPass < 6 && getDocumentTriangleCount(document) > TARGET_TRIANGLES * 1.1;
    simplificationPass += 1
  ) {
    const primitives = document
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
    const passTotalTriangles = getDocumentTriangleCount(document)
    let allocatedTriangles = 0
    const primitiveTargets = primitives.map((primitive, primitiveIndex) => {
      const primitiveTriangles = getPrimitiveTriangleCount(primitive)
      const remainingPrimitives = primitives.length - primitiveIndex - 1
      const proportionalTarget = Math.floor(
        (primitiveTriangles / passTotalTriangles) * TARGET_TRIANGLES
      )
      const maxAvailable =
        TARGET_TRIANGLES - allocatedTriangles - (remainingPrimitives * MIN_PRIMITIVE_TRIANGLES)
      const nextTarget = Math.max(
        MIN_PRIMITIVE_TRIANGLES,
        Math.min(primitiveTriangles, Math.max(MIN_PRIMITIVE_TRIANGLES, maxAvailable), proportionalTarget)
      )

      allocatedTriangles += nextTarget
      return nextTarget
    })

    for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex += 1) {
      const primitive = primitives[primitiveIndex]
      const positionAccessor = primitive.getAttribute('POSITION')

      if (!positionAccessor) {
        continue
      }

      const indicesAccessor = ensureIndices(primitive, document)
      const positionArray = positionAccessor.getArray()
      const indexArray = indicesAccessor.getArray()

      if (!(positionArray instanceof Float32Array)) {
        throw new Error('Expected POSITION accessor to be Float32Array')
      }

      if (!(indexArray instanceof Uint16Array) && !(indexArray instanceof Uint32Array)) {
        throw new Error('Expected indices accessor to be Uint16Array or Uint32Array')
      }

      const vertexCount = positionAccessor.getCount()
      const { attributes } = buildAttributeStream(primitive, vertexCount)
      const targetIndexCount = Math.max(3, primitiveTargets[primitiveIndex] * 3)
      const simplifyResult = MeshoptSimplifier.simplify(
        new Uint32Array(indexArray),
        positionArray,
        3,
        targetIndexCount,
        MAX_ERROR,
        SIMPLIFY_FLAGS
      )
      const simplifiedIndices = simplifyResult[0].slice()
      const [remap, nextVertexCount] = MeshoptSimplifier.compactMesh(simplifiedIndices)
      const outputIndices =
        nextVertexCount <= 65_535
          ? Uint16Array.from(simplifiedIndices)
          : Uint32Array.from(simplifiedIndices)

      positionAccessor.setArray(
        remapAttributeArray(positionArray, 3, remap, nextVertexCount)
      )
      indicesAccessor.setArray(outputIndices)

      for (const attribute of attributes) {
        attribute.accessor.setArray(
          remapAttributeArray(
            attribute.array,
            attribute.elementSize,
            remap,
            nextVertexCount
          )
        )
      }
    }
  }

  fs.rmSync(outputDir, { force: true, recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })
  await io.write(outputPath, document)
  await resizeOutputTexturesIfNeeded()
  fs.copyFileSync(
    path.join(rootDir, 'public', 'models', 'droop_cup_4th_century_bc', 'license.txt'),
    path.join(outputDir, 'license.txt')
  )

  const simplified = await io.read(outputPath)
  const simplifiedTriangles = getDocumentTriangleCount(simplified)

  if (simplifiedTriangles > TARGET_TRIANGLES * 1.1) {
    throw new Error(
      `Runtime altar cup has ${simplifiedTriangles.toLocaleString()} triangles; expected roughly ${TARGET_TRIANGLES.toLocaleString()}`
    )
  }

  console.log(
    `[simplify-altar-cup] wrote ${outputPath} with ${simplifiedTriangles.toLocaleString()} triangles`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
