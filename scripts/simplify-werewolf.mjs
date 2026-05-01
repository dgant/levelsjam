import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { KHRMaterialsUnlit } from '@gltf-transform/extensions'
import { MeshoptSimplifier } from 'meshoptimizer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const runtimePath = path.join(rootDir, 'public', 'models', 'pale_dread_white_werewolf_runtime', 'scene.gltf')
const TARGET_TRIANGLES = 10_000
const MIN_PRIMITIVE_TRIANGLES = 12
const LOCKED_MAX_ERROR = 0.12
const RELAXED_MAX_ERROR = 1.0
const LOCKED_SIMPLIFY_FLAGS = ['LockBorder']
const RELAXED_SIMPLIFY_FLAGS = ['Permissive', 'Prune']
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
    const array = accessor?.getArray()

    if (!accessor || !(array instanceof Float32Array)) {
      continue
    }

    let weight = 0.25

    if (semantic === 'NORMAL' || semantic.startsWith('TANGENT')) {
      weight = 0.5
    } else if (semantic.startsWith('COLOR')) {
      weight = 0.15
    }

    attributes.push({
      accessor,
      array,
      elementSize: accessor.getElementSize(),
      semantic,
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

function allocatePrimitiveTargets(primitives, totalTriangles) {
  let allocatedTriangles = 0

  return primitives.map((primitive, primitiveIndex) => {
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
}

function simplifyDocument(document, flags, preserveAttributes = true, maxError = LOCKED_MAX_ERROR) {
  const primitives = document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
  const totalTriangles = primitives.reduce(
    (sum, primitive) => sum + getPrimitiveTriangleCount(primitive),
    0
  )

  if (totalTriangles <= TARGET_TRIANGLES) {
    return totalTriangles
  }

  const primitiveTargets = allocatePrimitiveTargets(primitives, totalTriangles)

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
    const targetIndexCount = Math.max(3, primitiveTargets[primitiveIndex] * 3)
    const useAttributeSimplification = preserveAttributes && stride > 0
    const simplifyResult =
      useAttributeSimplification
        ? MeshoptSimplifier.simplifyWithAttributes(
            new Uint32Array(indexArray),
            positionArray,
            3,
            stream,
            stride,
            weights,
            null,
            targetIndexCount,
            maxError,
            flags
          )
        : MeshoptSimplifier.simplifySloppy(
            new Uint32Array(indexArray),
            positionArray,
            3,
            null,
            targetIndexCount,
            maxError
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

  return totalTriangles
}

async function main() {
  await MeshoptSimplifier.ready

  if (!fs.existsSync(runtimePath)) {
    throw new Error(
      `Missing ${runtimePath}; run node scripts/build-runtime-props.mjs before simplifying the werewolf runtime model`
    )
  }

  const io = new NodeIO().registerExtensions([KHRMaterialsUnlit])
  const document = await io.read(runtimePath)
  let sourceTriangles = simplifyDocument(document, LOCKED_SIMPLIFY_FLAGS, true, LOCKED_MAX_ERROR)

  await io.write(runtimePath, document)

  let simplified = await io.read(runtimePath)
  let simplifiedTriangles = simplified
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + getPrimitiveTriangleCount(primitive), 0)

  if (simplifiedTriangles > TARGET_TRIANGLES) {
    console.log(
      `[simplify-werewolf] locked-border pass produced ${simplifiedTriangles.toLocaleString()} triangles; retrying relaxed pass`
    )
    const relaxedDocument = await io.read(runtimePath)
    sourceTriangles = simplifyDocument(relaxedDocument, RELAXED_SIMPLIFY_FLAGS, true, RELAXED_MAX_ERROR)
    await io.write(runtimePath, relaxedDocument)
    simplified = await io.read(runtimePath)
    simplifiedTriangles = simplified
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, primitive) => sum + getPrimitiveTriangleCount(primitive), 0)
  }

  if (simplifiedTriangles > TARGET_TRIANGLES) {
    throw new Error(
      `Runtime werewolf has ${simplifiedTriangles.toLocaleString()} triangles; expected at most ${TARGET_TRIANGLES.toLocaleString()}`
    )
  }

  console.log(
    `[simplify-werewolf] ${sourceTriangles.toLocaleString()} -> ${simplifiedTriangles.toLocaleString()} triangles`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
