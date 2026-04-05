import { Quaternion } from 'three'

export function computeLocalBillboardQuaternion(
  parentWorldQuaternion,
  cameraWorldQuaternion,
  target = new Quaternion()
) {
  return target
    .copy(parentWorldQuaternion)
    .invert()
    .multiply(cameraWorldQuaternion)
}
