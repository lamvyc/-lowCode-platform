import type { HttpClient, HttpRequestConfig } from '../datasource/manager'
import type { AuthProvider } from './provider'

/** HTTP 错误：带可选状态码，用于 401 检测 */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** 是否为 401 未授权错误 */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401
}

export interface AuthenticatedHttpClientOptions {
  auth: AuthProvider
  /** 刷新后仍 401（或刷新失败）时回调，用于跳转登录 */
  onUnauthorized?: () => void
}

/**
 * 认证 HttpClient 装饰器：为每个请求注入 Bearer token；
 * 遇到 401 时刷新令牌并重试一次，二次失败触发 onUnauthorized。
 */
export function authenticatedHttpClient(
  base: HttpClient,
  options: AuthenticatedHttpClientOptions,
): HttpClient {
  let refreshing: Promise<string> | null = null

  return {
    async request(config: HttpRequestConfig): Promise<unknown> {
      const current = await options.auth.getToken()
      const headers = withAuth(config.headers, current)
      try {
        return await base.request({ ...config, headers })
      } catch (error) {
        if (!isUnauthorizedError(error)) throw error

        try {
          const token = await (refreshing ??= options.auth
            .refresh()
            .finally(() => {
              refreshing = null
            }))
          return await base.request({ ...config, headers: withAuth(config.headers, token) })
        } catch (retryError) {
          options.onUnauthorized?.()
          throw retryError
        }
      }
    },
  }
}

function withAuth(
  headers: Record<string, string> | undefined,
  token: string | null,
): Record<string, string> {
  const next = { ...(headers ?? {}) }
  if (token) next.Authorization = `Bearer ${token}`
  return next
}
