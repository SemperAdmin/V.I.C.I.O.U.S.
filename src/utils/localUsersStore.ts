export type RoleOverride = {
  user_id: string
  org_role: 'Unit_Admin' | 'Company_Manager' | 'Section_Manager' | 'Member'
}

const KEY = 'users_role_overrides'

const load = (): Record<string, RoleOverride> => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const save = (map: Record<string, RoleOverride>) => {
  localStorage.setItem(KEY, JSON.stringify(map))
}

export const getRoleOverride = (user_id: string): RoleOverride | undefined => {
  const map = load()
  return map[user_id]
}

export const setUserRoleOverride = (user_id: string, org_role: 'Unit_Admin' | 'Company_Manager' | 'Section_Manager' | 'Member') => {
  const map = load()
  map[user_id] = { user_id, org_role }
  save(map)
}
