import { describe, expect, it } from 'vitest'
import {
  EXPRESSION_HELPER_NAMES,
  buildExpressionHelpers,
  datasourceRefName,
  rewriteExpression,
} from './expressions'

describe('rewriteExpression', () => {
  it('$datasource 保留 .data，模板模式不 .value', () => {
    expect(rewriteExpression('count($datasource.userList.data)', ['userList'], [], 'template')).toBe(
      'count(userList?.data)',
    )
    expect(rewriteExpression('$datasource.userList.length > 0', ['userList'], [], 'template')).toBe(
      'userList?.length > 0',
    )
  })

  it('脚本模式补 .value', () => {
    expect(rewriteExpression('count($datasource.userList.data)', ['userList'], [], 'script')).toBe(
      'count(userList.value?.data)',
    )
    expect(rewriteExpression('$page.status', [], ['status'], 'script')).toBe('status.value')
  })

  it('$datasource 单独引用不产生可选链 / xState', () => {
    expect(rewriteExpression('$datasource.userList', ['userList'], [], 'template')).toBe('userList')
    expect(rewriteExpression('$datasource.userList', ['userList'], [], 'script')).toBe(
      'userList.value',
    )
  })

  it('长 id 优先，避免 users 污染 users2', () => {
    const ids = ['users', 'users2']
    expect(
      rewriteExpression('$datasource.users2.data + $datasource.users.data', ids, [], 'template'),
    ).toBe('users2?.data + users?.data')
  })

  it('页面变量在模板/脚本分别解包', () => {
    expect(rewriteExpression('$page.count + 1', [], ['count'], 'template')).toBe('count + 1')
    expect(rewriteExpression('$page.count + 1', [], ['count'], 'script')).toBe('count.value + 1')
  })

  it('数据源 id 转成 camelCase ref', () => {
    expect(datasourceRefName('user-list')).toBe('userList')
    expect(rewriteExpression('$datasource.user-list', ['user-list'], [], 'template')).toBe('userList')
  })
})

describe('buildExpressionHelpers', () => {
  it('生成 core 同名辅助函数', () => {
    const code = buildExpressionHelpers()
    for (const name of EXPRESSION_HELPER_NAMES) {
      expect(code).toContain(`function ${name}`)
    }
  })
})
