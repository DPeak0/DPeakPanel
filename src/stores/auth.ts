import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AuthRole,
  AuthSession,
  AuthSettings,
  AuthUser,
  TabType,
  UserGroupPermissions
} from '@/types'

const USERS_STORAGE_KEY = 'lightpanel_auth_users'
const SESSION_STORAGE_KEY = 'lightpanel_auth_session'
const SETTINGS_STORAGE_KEY = 'lightpanel_auth_settings'

const DEFAULT_SETTINGS: AuthSettings = {
  requireLogin: false
}

function createEmptyPermissions(): UserGroupPermissions {
  return {
    sites: [],
    docker: []
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizePermissions(input: Partial<UserGroupPermissions> | null | undefined): UserGroupPermissions {
  const sites = Array.isArray(input?.sites) ? input.sites.filter(Boolean) : []
  const docker = Array.isArray(input?.docker) ? input.docker.filter(Boolean) : []
  return {
    sites: Array.from(new Set(sites)),
    docker: Array.from(new Set(docker))
  }
}

function normalizeUser(raw: Partial<AuthUser> | null | undefined): AuthUser | null {
  const username = raw?.username?.trim()
  const password = raw?.password?.trim()
  const role: AuthRole = raw?.role === 'admin' ? 'admin' : 'user'

  if (!raw?.id || !username || !password) {
    return null
  }

  const now = new Date().toISOString()
  return {
    id: raw.id,
    username,
    password,
    role,
    permissions: role === 'admin'
      ? createEmptyPermissions()
      : normalizePermissions(raw.permissions),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  }
}

function createDefaultAdmin(): AuthUser {
  const now = new Date().toISOString()
  return {
    id: createId(),
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    permissions: createEmptyPermissions(),
    createdAt: now,
    updatedAt: now
  }
}

export const useAuthStore = defineStore('auth', () => {
  const users = ref<AuthUser[]>([])
  const session = ref<AuthSession | null>(null)
  const settings = ref<AuthSettings>({ ...DEFAULT_SETTINGS })
  const authDialogOpen = ref(false)
  const initialized = ref(false)

  const currentUser = computed(() => {
    if (!session.value) return null
    return users.value.find(user => user.id === session.value?.userId) || null
  })

  const isLoggedIn = computed(() => !!currentUser.value)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')
  const canManageSettings = computed(() => isAdmin.value)
  const shouldBlockContent = computed(() => settings.value.requireLogin && !isLoggedIn.value)

  function saveUsers() {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.value))
  }

  function saveSession() {
    if (session.value) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session.value))
      return
    }

    localStorage.removeItem(SESSION_STORAGE_KEY)
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings.value))
  }

  function syncSession() {
    if (!session.value) return

    const user = users.value.find(item => item.id === session.value?.userId)
    if (!user) {
      session.value = null
      saveSession()
      return
    }

    session.value = {
      ...session.value,
      username: user.username,
      role: user.role
    }
    saveSession()
  }

  function ensureDefaultAdmin() {
    if (users.value.length > 0) return
    users.value = [createDefaultAdmin()]
    saveUsers()
  }

  function loadAuthState() {
    try {
      const rawUsers = localStorage.getItem(USERS_STORAGE_KEY)
      const parsedUsers = rawUsers ? JSON.parse(rawUsers) : []
      users.value = Array.isArray(parsedUsers)
        ? parsedUsers.map(item => normalizeUser(item)).filter((item): item is AuthUser => item !== null)
        : []
    } catch {
      users.value = []
    }

    ensureDefaultAdmin()

    try {
      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
      const parsedSettings = rawSettings ? JSON.parse(rawSettings) : null
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...(parsedSettings && typeof parsedSettings === 'object' ? parsedSettings : {})
      }
    } catch {
      settings.value = { ...DEFAULT_SETTINGS }
    }

    try {
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY)
      const parsedSession = rawSession ? JSON.parse(rawSession) : null
      session.value = parsedSession && parsedSession.userId ? parsedSession : null
    } catch {
      session.value = null
    }

    syncSession()
    initialized.value = true
  }

  function login(username: string, password: string) {
    const normalizedUsername = username.trim()
    const normalizedPassword = password.trim()
    const matchedUser = users.value.find(
      user => user.username === normalizedUsername && user.password === normalizedPassword
    )

    if (!matchedUser) {
      throw new Error('用户名或密码错误')
    }

    session.value = {
      userId: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      loginAt: new Date().toISOString()
    }
    saveSession()
    authDialogOpen.value = false
  }

  function logout() {
    session.value = null
    saveSession()
    authDialogOpen.value = false
  }

  function toggleAuthDialog(open?: boolean) {
    if (shouldBlockContent.value && open === false) {
      return
    }

    authDialogOpen.value = open ?? !authDialogOpen.value
  }

  function setRequireLogin(value: boolean) {
    settings.value.requireLogin = value
    saveSettings()

    if (value && !isLoggedIn.value) {
      authDialogOpen.value = true
    }
  }

  function upsertUser(input: {
    id?: string
    username: string
    password?: string
    role: AuthRole
    permissions?: Partial<UserGroupPermissions>
  }) {
    const username = input.username.trim()
    if (!username) {
      throw new Error('用户名不能为空')
    }

    const duplicate = users.value.find(user =>
      user.username === username && user.id !== input.id
    )
    if (duplicate) {
      throw new Error('用户名已存在')
    }

    if (input.id) {
      const existing = users.value.find(user => user.id === input.id)
      if (!existing) {
        throw new Error('用户不存在')
      }

      const nextRole: AuthRole = input.role === 'admin' ? 'admin' : 'user'
      if (existing.role === 'admin' && nextRole !== 'admin') {
        const adminCount = users.value.filter(user => user.role === 'admin').length
        if (adminCount <= 1) {
          throw new Error('至少保留一个管理员')
        }
      }

      const nextPassword = input.password?.trim() ? input.password.trim() : existing.password
      if (!nextPassword) {
        throw new Error('密码不能为空')
      }

      users.value = users.value.map(user => {
        if (user.id !== input.id) return user
        return {
          ...user,
          username,
          password: nextPassword,
          role: nextRole,
          permissions: nextRole === 'admin'
            ? createEmptyPermissions()
            : normalizePermissions(input.permissions),
          updatedAt: new Date().toISOString()
        }
      })
    } else {
      const password = input.password?.trim()
      if (!password) {
        throw new Error('密码不能为空')
      }

      const now = new Date().toISOString()
      users.value = [
        ...users.value,
        {
          id: createId(),
          username,
          password,
          role: input.role === 'admin' ? 'admin' : 'user',
          permissions: input.role === 'admin'
            ? createEmptyPermissions()
            : normalizePermissions(input.permissions),
          createdAt: now,
          updatedAt: now
        }
      ]
    }

    saveUsers()
    syncSession()
  }

  function deleteUser(userId: string) {
    const target = users.value.find(user => user.id === userId)
    if (!target) {
      throw new Error('用户不存在')
    }

    if (target.role === 'admin') {
      const adminCount = users.value.filter(user => user.role === 'admin').length
      if (adminCount <= 1) {
        throw new Error('至少保留一个管理员')
      }
    }

    users.value = users.value.filter(user => user.id !== userId)
    saveUsers()

    if (session.value?.userId === userId) {
      logout()
      return
    }

    syncSession()
  }

  function getAllowedGroupKeys(tab: TabType) {
    if (!isLoggedIn.value && !settings.value.requireLogin) {
      return null
    }

    if (isAdmin.value) {
      return null
    }

    if (!currentUser.value) {
      return []
    }

    return currentUser.value.permissions[tab]
  }

  function canAccessGroup(tab: TabType, groupKey: string) {
    const allowedGroupKeys = getAllowedGroupKeys(tab)
    if (allowedGroupKeys === null) {
      return true
    }
    return allowedGroupKeys.includes(groupKey)
  }

  return {
    users,
    session,
    settings,
    authDialogOpen,
    initialized,
    currentUser,
    isLoggedIn,
    isAdmin,
    canManageSettings,
    shouldBlockContent,
    loadAuthState,
    login,
    logout,
    toggleAuthDialog,
    setRequireLogin,
    upsertUser,
    deleteUser,
    getAllowedGroupKeys,
    canAccessGroup
  }
})
