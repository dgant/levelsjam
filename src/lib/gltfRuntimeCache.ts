import { Material, Mesh, Texture, type Group } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

const gltfLoader = new GLTFLoader()
const rootPromiseCache = new Map<string, Promise<Group>>()
const rootCache = new Map<string, Group>()

function disposeMaterialTexture(value: unknown) {
  if (value instanceof Texture) {
    value.dispose()
  }
}

function disposeMaterial(material: Material) {
  for (const value of Object.values(material as Record<string, unknown>)) {
    disposeMaterialTexture(value)
  }

  material.dispose()
}

function disposeSceneRoot(root: Group) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }

    object.geometry?.dispose()

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (material instanceof Material) {
        disposeMaterial(material)
      }
    }
  })
}

export async function loadCachedGltfRoot(url: string) {
  const cachedRoot = rootCache.get(url)

  if (cachedRoot) {
    return cachedRoot
  }

  const cachedPromise = rootPromiseCache.get(url)

  if (cachedPromise) {
    return cachedPromise
  }

  const promise = gltfLoader.loadAsync(url)
    .then((gltf) => {
      rootCache.set(url, gltf.scene)
      return gltf.scene
    })
    .catch((error) => {
      rootPromiseCache.delete(url)
      throw error
    })

  rootPromiseCache.set(url, promise)
  return promise
}

export async function cloneCachedGltfRoot(url: string) {
  const root = await loadCachedGltfRoot(url)
  return cloneSkeleton(root)
}

export function unloadCachedGltfRoot(url: string) {
  const root = rootCache.get(url)

  rootPromiseCache.delete(url)
  rootCache.delete(url)

  if (root) {
    disposeSceneRoot(root)
  }
}

export function getCachedGltfRootUrls() {
  return Array.from(rootCache.keys()).sort()
}

export function clearCachedGltfRoots() {
  for (const url of getCachedGltfRootUrls()) {
    unloadCachedGltfRoot(url)
  }
}
