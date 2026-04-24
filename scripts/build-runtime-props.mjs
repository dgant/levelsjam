import fs from 'node:fs/promises'
import path from 'node:path'
import { Jimp } from 'jimp'

const PROJECT_ROOT = process.cwd()
const GLTF_COMPONENT_TYPES = {
  FLOAT: 5126,
  UNSIGNED_INT: 5125
}

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

async function copyDirectory(sourcePath, targetPath) {
  try {
    await fs.rm(targetPath, { force: true, recursive: true })
  } catch {
    // Ignore stale or missing output directories.
  }
  await fs.cp(sourcePath, targetPath, { recursive: true })
}

async function isTargetFresh(sourcePath, targetPath) {
  try {
    const [sourceStat, targetStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(targetPath)
    ])

    return targetStat.mtimeMs >= sourceStat.mtimeMs
  } catch {
    return false
  }
}

async function resizeImageIfStale(sourceImagePath, targetImagePath, targetSize) {
  if (await isTargetFresh(sourceImagePath, targetImagePath)) {
    return
  }

  const sourceBuffer = await fs.readFile(sourceImagePath)
  const jimp = await Jimp.fromBuffer(sourceBuffer, {
    'image/jpeg': { maxMemoryUsageInMB: 2048 },
    'image/png': { maxMemoryUsageInMB: 2048 }
  })

  jimp.resize({ h: targetSize, w: targetSize })

  await ensureDirectory(path.dirname(targetImagePath))
  await jimp.write(targetImagePath)
}

function getAccessorElementSize(type) {
  switch (type) {
    case 'SCALAR':
      return 1
    case 'VEC2':
      return 2
    case 'VEC3':
      return 3
    case 'VEC4':
      return 4
    default:
      throw new Error(`Unsupported accessor type ${type}`)
  }
}

function getComponentInfo(componentType) {
  switch (componentType) {
    case 5121:
      return { ArrayType: Uint8Array, byteSize: 1, read: 'getUint8' }
    case 5123:
      return { ArrayType: Uint16Array, byteSize: 2, read: 'getUint16' }
    case 5125:
      return { ArrayType: Uint32Array, byteSize: 4, read: 'getUint32' }
    case 5126:
      return { ArrayType: Float32Array, byteSize: 4, read: 'getFloat32' }
    default:
      throw new Error(`Unsupported accessor component type ${componentType}`)
  }
}

function readAccessor(gltf, binaryBuffer, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex]
  const bufferView = gltf.bufferViews[accessor.bufferView]
  const componentInfo = getComponentInfo(accessor.componentType)
  const elementSize = getAccessorElementSize(accessor.type)
  const stride = bufferView.byteStride ?? (componentInfo.byteSize * elementSize)
  const sourceOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const output = new componentInfo.ArrayType(accessor.count * elementSize)
  const view = new DataView(
    binaryBuffer.buffer,
    binaryBuffer.byteOffset,
    binaryBuffer.byteLength
  )

  for (let elementIndex = 0; elementIndex < accessor.count; elementIndex += 1) {
    for (let componentIndex = 0; componentIndex < elementSize; componentIndex += 1) {
      const byteOffset =
        sourceOffset +
        (elementIndex * stride) +
        (componentIndex * componentInfo.byteSize)
      output[(elementIndex * elementSize) + componentIndex] =
        view[componentInfo.read](byteOffset, true)
    }
  }

  return {
    array: output,
    componentType: accessor.componentType,
    count: accessor.count,
    elementSize,
    normalized: Boolean(accessor.normalized),
    type: accessor.type
  }
}

function getNodeLocalMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return [...node.matrix]
  }

  const translation = node.translation ?? [0, 0, 0]
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const scale = node.scale ?? [1, 1, 1]
  const [x, y, z, w] = rotation
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  const sx = scale[0]
  const sy = scale[1]
  const sz = scale[2]

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    translation[0],
    translation[1],
    translation[2],
    1
  ]
}

function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0)

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) {
        result[(column * 4) + row] +=
          a[(k * 4) + row] * b[(column * 4) + k]
      }
    }
  }

  return result
}

function transformPoint(matrix, x, y, z) {
  return [
    (matrix[0] * x) + (matrix[4] * y) + (matrix[8] * z) + matrix[12],
    (matrix[1] * x) + (matrix[5] * y) + (matrix[9] * z) + matrix[13],
    (matrix[2] * x) + (matrix[6] * y) + (matrix[10] * z) + matrix[14]
  ]
}

function transformDirection(matrix, x, y, z) {
  const nx = (matrix[0] * x) + (matrix[4] * y) + (matrix[8] * z)
  const ny = (matrix[1] * x) + (matrix[5] * y) + (matrix[9] * z)
  const nz = (matrix[2] * x) + (matrix[6] * y) + (matrix[10] * z)
  const length = Math.hypot(nx, ny, nz) || 1

  return [nx / length, ny / length, nz / length]
}

function computeNodeWorldMatrices(gltf) {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const matrices = new Map()

  const visit = (nodeIndex, parentMatrix) => {
    if (matrices.has(nodeIndex)) {
      return
    }

    const node = gltf.nodes[nodeIndex]
    const worldMatrix = multiplyMatrices(parentMatrix, getNodeLocalMatrix(node))
    matrices.set(nodeIndex, worldMatrix)

    for (const childIndex of node.children ?? []) {
      visit(childIndex, worldMatrix)
    }
  }

  const scene = gltf.scenes?.[gltf.scene ?? 0]
  for (const nodeIndex of scene?.nodes ?? []) {
    visit(nodeIndex, identity)
  }

  return matrices
}

function pushVector(target, vector) {
  for (const value of vector) {
    target.push(value)
  }
}

function alignBufferOffset(offset, alignment = 4) {
  const remainder = offset % alignment
  return remainder === 0 ? offset : offset + (alignment - remainder)
}

function makeBufferView(binaryChunks, typedArray) {
  let byteOffset = binaryChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const alignedOffset = alignBufferOffset(byteOffset)

  if (alignedOffset > byteOffset) {
    binaryChunks.push(Buffer.alloc(alignedOffset - byteOffset))
    byteOffset = alignedOffset
  }

  const buffer = Buffer.from(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength
  )
  binaryChunks.push(buffer)

  return {
    buffer: 0,
    byteLength: buffer.byteLength,
    byteOffset
  }
}

function getVec3Bounds(array) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]

  for (let index = 0; index < array.length; index += 3) {
    for (let component = 0; component < 3; component += 1) {
      const value = array[index + component]
      min[component] = Math.min(min[component], value)
      max[component] = Math.max(max[component], value)
    }
  }

  return { max, min }
}

async function buildJoinedStaticRuntimeModel({
  sourceDirectory,
  targetDirectory
}) {
  const sourceGltfPath = path.join(sourceDirectory, 'scene.gltf')
  const sourceGltf = JSON.parse(await fs.readFile(sourceGltfPath, 'utf8'))
  const sourceBufferUri = sourceGltf.buffers?.[0]?.uri

  if (!sourceBufferUri) {
    throw new Error(`Runtime model source ${sourceGltfPath} has no external buffer`)
  }

  const sourceBinary = await fs.readFile(path.join(sourceDirectory, sourceBufferUri))
  const worldMatrices = computeNodeWorldMatrices(sourceGltf)
  const positions = []
  const normals = []
  const tangents = []
  const texcoords = []
  const indices = []
  let vertexOffset = 0
  let materialIndex = null

  for (let nodeIndex = 0; nodeIndex < sourceGltf.nodes.length; nodeIndex += 1) {
    const node = sourceGltf.nodes[nodeIndex]

    if (typeof node.mesh !== 'number') {
      continue
    }

    const mesh = sourceGltf.meshes[node.mesh]
    const worldMatrix = worldMatrices.get(nodeIndex)

    if (!mesh || !worldMatrix) {
      continue
    }

    for (const primitive of mesh.primitives ?? []) {
      const positionAccessor = readAccessor(
        sourceGltf,
        sourceBinary,
        primitive.attributes.POSITION
      )
      const normalAccessor =
        typeof primitive.attributes.NORMAL === 'number'
          ? readAccessor(sourceGltf, sourceBinary, primitive.attributes.NORMAL)
          : null
      const tangentAccessor =
        typeof primitive.attributes.TANGENT === 'number'
          ? readAccessor(sourceGltf, sourceBinary, primitive.attributes.TANGENT)
          : null
      const texcoordAccessor =
        typeof primitive.attributes.TEXCOORD_0 === 'number'
          ? readAccessor(sourceGltf, sourceBinary, primitive.attributes.TEXCOORD_0)
          : null
      const indexAccessor =
        typeof primitive.indices === 'number'
          ? readAccessor(sourceGltf, sourceBinary, primitive.indices)
          : null

      materialIndex = materialIndex ?? primitive.material ?? 0

      for (let vertexIndex = 0; vertexIndex < positionAccessor.count; vertexIndex += 1) {
        const sourcePositionOffset = vertexIndex * 3
        pushVector(
          positions,
          transformPoint(
            worldMatrix,
            positionAccessor.array[sourcePositionOffset],
            positionAccessor.array[sourcePositionOffset + 1],
            positionAccessor.array[sourcePositionOffset + 2]
          )
        )

        if (normalAccessor) {
          const sourceNormalOffset = vertexIndex * 3
          pushVector(
            normals,
            transformDirection(
              worldMatrix,
              normalAccessor.array[sourceNormalOffset],
              normalAccessor.array[sourceNormalOffset + 1],
              normalAccessor.array[sourceNormalOffset + 2]
            )
          )
        }

        if (tangentAccessor) {
          const sourceTangentOffset = vertexIndex * 4
          const tangentDirection = transformDirection(
            worldMatrix,
            tangentAccessor.array[sourceTangentOffset],
            tangentAccessor.array[sourceTangentOffset + 1],
            tangentAccessor.array[sourceTangentOffset + 2]
          )
          pushVector(
            tangents,
            [
              tangentDirection[0],
              tangentDirection[1],
              tangentDirection[2],
              tangentAccessor.array[sourceTangentOffset + 3]
            ]
          )
        }

        if (texcoordAccessor) {
          const sourceTexcoordOffset = vertexIndex * 2
          texcoords.push(
            texcoordAccessor.array[sourceTexcoordOffset],
            texcoordAccessor.array[sourceTexcoordOffset + 1]
          )
        }
      }

      if (indexAccessor) {
        for (const index of indexAccessor.array) {
          indices.push(vertexOffset + index)
        }
      } else {
        for (let index = 0; index < positionAccessor.count; index += 1) {
          indices.push(vertexOffset + index)
        }
      }

      vertexOffset += positionAccessor.count
    }
  }

  const outputPositions = Float32Array.from(positions)
  const outputNormals = Float32Array.from(normals)
  const outputTangents = Float32Array.from(tangents)
  const outputTexcoords = Float32Array.from(texcoords)
  const outputIndices = Uint32Array.from(indices)
  const positionBounds = getVec3Bounds(outputPositions)
  const chunks = []
  const bufferViews = []
  const accessors = []

  const appendAccessor = (typedArray, accessor) => {
    const bufferView = makeBufferView(chunks, typedArray)
    const bufferViewIndex = bufferViews.length
    const accessorIndex = accessors.length

    bufferViews.push(bufferView)
    accessors.push({
      ...accessor,
      bufferView: bufferViewIndex,
      byteOffset: 0
    })
    return accessorIndex
  }

  const positionAccessorIndex = appendAccessor(outputPositions, {
    componentType: GLTF_COMPONENT_TYPES.FLOAT,
    count: outputPositions.length / 3,
    max: positionBounds.max,
    min: positionBounds.min,
    type: 'VEC3'
  })
  const normalAccessorIndex = appendAccessor(outputNormals, {
    componentType: GLTF_COMPONENT_TYPES.FLOAT,
    count: outputNormals.length / 3,
    type: 'VEC3'
  })
  const tangentAccessorIndex = outputTangents.length > 0
    ? appendAccessor(outputTangents, {
        componentType: GLTF_COMPONENT_TYPES.FLOAT,
        count: outputTangents.length / 4,
        type: 'VEC4'
      })
    : null
  const texcoordAccessorIndex = appendAccessor(outputTexcoords, {
    componentType: GLTF_COMPONENT_TYPES.FLOAT,
    count: outputTexcoords.length / 2,
    type: 'VEC2'
  })
  const indexAccessorIndex = appendAccessor(outputIndices, {
    componentType: GLTF_COMPONENT_TYPES.UNSIGNED_INT,
    count: outputIndices.length,
    type: 'SCALAR'
  })
  const outputBinary = Buffer.concat(chunks)

  await fs.rm(targetDirectory, { force: true, recursive: true })
  await ensureDirectory(targetDirectory)
  await copyDirectory(
    path.join(sourceDirectory, 'textures'),
    path.join(targetDirectory, 'textures')
  )
  await copyFileIfChanged(
    path.join(sourceDirectory, 'license.txt'),
    path.join(targetDirectory, 'license.txt')
  )
  await fs.writeFile(path.join(targetDirectory, 'scene.bin'), outputBinary)

  const outputGltf = {
    asset: sourceGltf.asset,
    accessors,
    bufferViews,
    buffers: [
      {
        byteLength: outputBinary.byteLength,
        uri: 'scene.bin'
      }
    ],
    images: sourceGltf.images,
    materials: sourceGltf.materials,
    meshes: [
      {
        name: 'awil_werewolf_runtime_joined',
        primitives: [
          {
            attributes: {
              NORMAL: normalAccessorIndex,
              POSITION: positionAccessorIndex,
              TANGENT: tangentAccessorIndex,
              TEXCOORD_0: texcoordAccessorIndex
            },
            indices: indexAccessorIndex,
            material: materialIndex ?? 0
          }
        ]
      }
    ],
    nodes: [
      {
        mesh: 0,
        name: 'awil_werewolf_runtime'
      }
    ],
    samplers: sourceGltf.samplers,
    scene: 0,
    scenes: [
      {
        nodes: [0]
      }
    ],
    textures: sourceGltf.textures
  }

  if (tangentAccessorIndex === null) {
    delete outputGltf.meshes[0].primitives[0].attributes.TANGENT
  }

  await fs.writeFile(
    path.join(targetDirectory, 'scene.gltf'),
    `${JSON.stringify(outputGltf, null, 2)}\n`
  )
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
    await resizeImageIfStale(sourceImagePath, targetImagePath, targetSize)
  }

  await fs.writeFile(
    path.join(targetDirectory, 'scene.gltf'),
    `${JSON.stringify(gltf, null, 2)}\n`
  )
}

async function buildTrophyRuntimeAssets() {
  const sourceDirectory = path.join(PROJECT_ROOT, 'public', 'models', 'head_of_a_bull')
  const targetDirectory = path.join(PROJECT_ROOT, 'public', 'models', 'head_of_a_bull_runtime')
  const targetTextureDirectory = path.join(targetDirectory, 'textures')
  const targetSize = 1024
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
    await resizeImageIfStale(sourceImagePath, targetImagePath, targetSize)
  }

  await fs.writeFile(
    path.join(targetDirectory, 'scene.gltf'),
    `${JSON.stringify(gltf, null, 2)}\n`
  )
}

async function buildWerewolfRuntimeAssets() {
  await buildJoinedStaticRuntimeModel({
    sourceDirectory: path.join(PROJECT_ROOT, 'public', 'models', 'awil_werewolf'),
    targetDirectory: path.join(PROJECT_ROOT, 'public', 'models', 'awil_werewolf_runtime')
  })
}

async function main() {
  await buildGateRuntimeAssets()
  await buildTrophyRuntimeAssets()
  await buildWerewolfRuntimeAssets()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
