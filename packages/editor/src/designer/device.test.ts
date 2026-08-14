import { describe, expect, it } from 'vitest'
import { DEVICE_BORDER, DEVICE_RADIUS, deviceDimension } from './device'

describe('deviceDimension 设备尺寸', () => {
  it('pc 返回 null（铺满自适应）', () => {
    expect(deviceDimension('pc')).toBeNull()
  })

  it('pad 返回 1100×750（横向平板）', () => {
    expect(deviceDimension('pad')).toEqual({ width: 1100, height: 750 })
  })

  it('h5 返回 515×750（竖向手机）', () => {
    expect(deviceDimension('h5')).toEqual({ width: 515, height: 750 })
  })

  it('设备边框 10px、圆角 22px', () => {
    expect(DEVICE_BORDER).toBe(10)
    expect(DEVICE_RADIUS).toBe(22)
  })
})
