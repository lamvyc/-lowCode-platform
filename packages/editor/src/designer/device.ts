import type { DeviceType } from './types'

/** 设备画布尺寸（白色画布，不含设备边框） */
export interface DeviceDimension {
  width: number
  height: number
}

/** 设备边框厚度（pad/h5） */
export const DEVICE_BORDER = 10

/** 设备圆角半径 */
export const DEVICE_RADIUS = 22

/** 各设备画布尺寸；pc 返回 null 表示铺满自适应 */
export const DEVICE_DIMENSION: Record<DeviceType, DeviceDimension | null> = {
  pc: null,
  pad: { width: 1100, height: 750 },
  h5: { width: 515, height: 750 },
}

/** 取设备画布尺寸 */
export function deviceDimension(device: DeviceType): DeviceDimension | null {
  return DEVICE_DIMENSION[device]
}
