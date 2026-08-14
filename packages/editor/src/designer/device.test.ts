import { describe, expect, it } from 'vitest'
import { deviceWidth } from './device'

describe('deviceWidth 设备宽度', () => {
  it('pc 返回 null（自适应）', () => {
    expect(deviceWidth('pc')).toBeNull()
  })

  it('pad 返回 768px', () => {
    expect(deviceWidth('pad')).toBe('768px')
  })

  it('h5 返回 375px', () => {
    expect(deviceWidth('h5')).toBe('375px')
  })
})
