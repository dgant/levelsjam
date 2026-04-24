import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { MeshoptSimplifier } from 'meshoptimizer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const sourcePath = path.join(rootDir, 'public', 'models', 'minotaur', 'scene.gltf')
const outputDir = path.join(rootDir, 'public', 'models', 'minotaur-runtime')
const outputPath = path.join(outputDir, 'scene.gltf')
const TARGET_TRIANGLES = 7_000
const MIN_PRIMITIVE_TRIANGLES = 12
const MAX_ERROR = 0.16
const MISSING_INDEX = 0xffffffff

function getPrimitiveTriangleCount(primitive) {
  const indices = primitive.getIndices()

  return indices
    ? Math.floor(indices.getCount() / 3)
    : Math.floor((primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3)
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

    if (!accessor) {
      continue
    }

    const array = accessor.getArray()

    if (!(array instanceof Float32Array)) {
      continue
    }

    let defaultWeight = 0.25

    if (semantic === 'NORMAL' || semantic.startsWith('TANGENT')) {
      defaultWeight = 0.5
    } else if (semantic.startsWith('COLOR')) {
      defaultWeight = 0.15
    } else if (semantic.startsWith('TEXCOORD')) {
      defaultWeight = 0.25
    }

    attributes.push({
      accessor,
      array,
      elementSize: accessor.getElementSize(),
      semantic,
      weight: defaultWeight
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

async function main() {
  await MeshoptSimplifier.ready

  const io = new NodeIO()
  const document = await io.read(sourcePath)
  const root = document.getRoot()
  const primitives = root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())

  const totalTriangles = primitives.reduce(
    (sum, primitive) => sum + getPrimitiveTriangleCount(primitive),
    0
  )

  console.log(
    `[simplify-minotaur] source triangles: ${totalTriangles.toLocaleString()}`
  )

  if (totalTriangles <= TARGET_TRIANGLES) {
    fs.mkdirSync(outputDir, { recursive: true })
    await io.write(outputPath, document)
    console.log('[simplify-minotaur] source already meets the triangle budget')
    return
  }

  let allocatedTriangles = 0
  const primitiveTargets = primitives.map((primitive, primitiveIndex) => {
    const primitiveTriangles = getPrimitiveTriangleCount(primitive)
    const remainingPrimitives = primitives.length - primitiveIndex - 1
    const proportionalTarget = Math.floor(
      (primitiveTriangles / totalTriangles) * TARGET_TRIANGLES
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
    const { attributes, stream, stride, weights } = buildAttributeStream(primitive, vertexCount)
    const targetTriangles = primitiveTargets[primitiveIndex]
    const targetIndexCount = Math.max(3, targetTriangles * 3)
    const simplifyResult =
      stride > 0
        ? MeshoptSimplifier.simplifyWithAttributes(
            new Uint32Array(indexArray),
            positionArray,
            3,
            stream,
            stride,
            weights,
            null,
            targetIndexCount,
            MAX_ERROR,
            ['Permissive']
          )
        : MeshoptSimplifier.simplify(
            new Uint32Array(indexArray),
            positionArray,
            3,
            targetIndexCount,
            MAX_ERROR,
            ['Permissive']
          )
    const simplifiedIndices = simplifyResult[0].slice()
    const [remap, nextVertexCount] = MeshoptSimplifier.compactMesh(simplifiedIndices)
    const remappedPositionArray = remapAttributeArray(
      positionArray,
      3,
      remap,
      nextVertexCount
    )
    const outputIndices =
      nextVertexCount <= 65_535
        ? Uint16Array.from(simplifiedIndices)
        : Uint32Array.from(simplifiedIndices)

    positionAccessor.setArray(remappedPositionArray)
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

  fs.rmSync(outputDir, { force: true, recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })
  await io.write(outputPath, document)

  const simplified = await io.read(outputPath)
  const simplifiedTriangles = simplified
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + getPrimitiveTriangleCount(primitive), 0)

  console.log(
    `[simplify-minotaur] wrote ${outputPath} with ${simplifiedTriangles.toLocaleString()} triangles`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
