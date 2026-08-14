import type { DeviceType } from './types'

/** 各设备画布宽度；pc 返回 null 表示自适应 */
export const DEVICE_WIDTH: Record<DeviceType, string | null> = {
  pc: null,
  pad: '768px',
  h5: '375px',
}

/** 取设备画布宽度 */
export function deviceWidth(device: DeviceType): string | null {
  return DEVICE_WIDTH[device]
}
