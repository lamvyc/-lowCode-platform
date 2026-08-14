/**
 * 认证提供器：承载会话令牌。
 * - getToken：读取当前令牌（同步或异步皆可）
 * - refresh：刷新令牌，返回新令牌
 * 具体实现（localStorage / OIDC / 自定义）由调用方注入。
 */
export interface AuthProvider {
  getToken(): string | null | Promise<string | null>
  refresh(): Promise<string>
}
