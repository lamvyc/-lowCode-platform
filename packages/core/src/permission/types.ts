/** 当前用户上下文（角色集合是权限判定的唯一依据） */
export interface UserContext {
  id: string
  name?: string
  roles: string[]
}
