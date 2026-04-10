<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useConfigStore, PRESET_BACKGROUNDS } from '@/stores/config'
import { useNavStore } from '@/stores/nav'
import { useAuthStore } from '@/stores/auth'
import { X, Sun, Moon, Pencil, Palette, Eye, Check, Image, Github, Search, Globe, ShieldCheck, UserCog, UserRound, Plus, Save, Trash2, LockKeyhole } from 'lucide-vue-next'
import type { AuthRole, ThemeMode, UserGroupPermissions } from '@/types'

// 导入本地图标
import iconBing from '@/assets/icons/bing.png'
import iconGoogle from '@/assets/icons/google.ico'
import iconBaidu from '@/assets/icons/baidu.ico'
import iconSogou from '@/assets/icons/sogou.ico'
import icon360 from '@/assets/icons/so.ico'
import iconGithub from '@/assets/icons/github.ico'

const configStore = useConfigStore()
const navStore = useNavStore()
const authStore = useAuthStore()

const isOpen = computed(() => configStore.settingsPanelOpen && authStore.canManageSettings)

// 服务器背景图片
const serverBackgrounds = computed(() => configStore.serverBackgrounds)

function close() {
  configStore.toggleSettingsPanel(false)
}

// 主题选项
const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun; color: string }[] = [
  { value: 'light', label: '浅色', icon: Sun, color: 'var(--warning)' },
  { value: 'dark', label: '深色', icon: Moon, color: 'var(--neon-purple)' },
  { value: 'sketch-light', label: '素描浅', icon: Pencil, color: 'var(--neon-blue)' },
  { value: 'sketch-dark', label: '素描深', icon: Pencil, color: 'var(--neon-cyan)' }
]

// 是否为素描主题（素描主题不支持自定义背景）
const isSketchTheme = computed(() => 
  configStore.theme === 'sketch-light' || configStore.theme === 'sketch-dark'
)

// 搜索引擎选项（与 SearchBar.vue 保持一致）
const SEARCH_ENGINES = [
  { id: 'bing', name: 'Bing', icon: iconBing },
  { id: 'google', name: 'Google', icon: iconGoogle },
  { id: 'baidu', name: '百度', icon: iconBaidu },
  { id: 'sogou', name: '搜狗', icon: iconSogou },
  { id: '360', name: '360搜索', icon: icon360 },
  { id: 'github', name: 'GitHub', icon: iconGithub }
]

// 自定义搜索 URL 输入
const customSearchUrlInput = ref(configStore.customSearchUrl)
const authErrorMessage = ref('')
const editingUserId = ref<string | null>(null)
const panelDefinition = computed(() => navStore.panelDefinition)
const panelSchemaEntries = computed(() => {
  const schema = panelDefinition.value?.configSchema || {}
  return Object.entries(schema)
})
const jsonOverviewItems = computed(() => [
  {
    key: 'panel-definition',
    title: 'LuckyLightPanel.json',
    value: panelDefinition.value ? `${panelDefinition.value.name} ${panelDefinition.value.version || ''}`.trim() : '未加载',
    description: panelDefinition.value?.description || '前端配置 schema 入口'
  },
  {
    key: 'nav-json',
    title: 'nav.json',
    value: `${navStore.panelTitle || '-'} / ${navStore.panelSubtitle || '无副标题'}`,
    description: `站点模块 ${navStore.sitesEnabled ? '开启' : '关闭'}，Docker 模块 ${navStore.dockerEnabled ? '开启' : '关闭'}`
  },
  {
    key: 'default-config',
    title: 'default-config.json',
    value: `${configStore.theme} / ${configStore.layout}`,
    description: `默认标签页 ${configStore.currentTab}，网络模式 ${configStore.networkMode}`
  },
  {
    key: 'sites-json',
    title: 'sites.json',
    value: `${navStore.siteGroups.length} 个分组`,
    description: `${navStore.allSites.length} 个站点，当前可见 ${navStore.visibleSites.length} 个`
  },
  {
    key: 'docker-json',
    title: 'docker.json',
    value: `${navStore.dockerGroups.length} 个分组`,
    description: `${navStore.allContainers.length} 个容器，当前可见 ${navStore.visibleContainers.length} 个`
  }
])

const userForm = reactive<{
  username: string
  password: string
  role: AuthRole
  permissions: UserGroupPermissions
}>({
  username: '',
  password: '',
  role: 'user',
  permissions: {
    sites: [],
    docker: []
  }
})

const sitePermissionGroups = computed(() => navStore.siteGroups)
const dockerPermissionGroups = computed(() => navStore.dockerGroups)
const managedUsers = computed(() => authStore.users)

// 保存自定义搜索 URL
function saveCustomSearchUrl() {
  configStore.setCustomSearchUrl(customSearchUrlInput.value)
}

function formatSchemaValue(key: string) {
  const rawValue = (configStore.config as Record<string, unknown>)[key]
  if (typeof rawValue === 'boolean') {
    return rawValue ? '开启' : '关闭'
  }
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return '未设置'
  }
  return String(rawValue)
}

function resetUserForm() {
  editingUserId.value = null
  authErrorMessage.value = ''
  Object.assign(userForm, {
    username: '',
    password: '',
    role: 'user' as AuthRole,
    permissions: {
      sites: [],
      docker: []
    }
  })
}

function editUser(userId: string) {
  const user = authStore.users.find(item => item.id === userId)
  if (!user) return

  editingUserId.value = user.id
  authErrorMessage.value = ''
  Object.assign(userForm, {
    username: user.username,
    password: '',
    role: user.role,
    permissions: {
      sites: [...user.permissions.sites],
      docker: [...user.permissions.docker]
    }
  })
}

function togglePermission(tab: keyof UserGroupPermissions, groupKey: string) {
  const current = userForm.permissions[tab]
  if (current.includes(groupKey)) {
    userForm.permissions[tab] = current.filter(item => item !== groupKey)
    return
  }

  userForm.permissions[tab] = [...current, groupKey]
}

function saveUser() {
  authErrorMessage.value = ''

  try {
    authStore.upsertUser({
      id: editingUserId.value || undefined,
      username: userForm.username,
      password: userForm.password,
      role: userForm.role,
      permissions: userForm.permissions
    })
    resetUserForm()
  } catch (error) {
    authErrorMessage.value = error instanceof Error ? error.message : '用户保存失败'
  }
}

function removeUser(userId: string, username: string) {
  authErrorMessage.value = ''
  if (!window.confirm(`确认删除用户“${username}”吗？`)) {
    return
  }

  try {
    authStore.deleteUser(userId)
    if (editingUserId.value === userId) {
      resetUserForm()
    }
  } catch (error) {
    authErrorMessage.value = error instanceof Error ? error.message : '删除用户失败'
  }
}

watch(() => authStore.canManageSettings, (allowed) => {
  if (!allowed) {
    configStore.toggleSettingsPanel(false)
  }
})

</script>

<template>
  <!-- 遮罩层 -->
  <Transition
    enter-active-class="overlay-enter"
    enter-from-class="overlay-enter-from"
    enter-to-class="overlay-enter-to"
    leave-active-class="overlay-leave"
    leave-from-class="overlay-leave-from"
    leave-to-class="overlay-leave-to"
  >
    <div v-if="isOpen" class="settings-overlay" @click="close" />
  </Transition>

  <!-- 设置面板 -->
  <Transition
    enter-active-class="panel-enter"
    enter-from-class="panel-enter-from"
    enter-to-class="panel-enter-to"
    leave-active-class="panel-leave"
    leave-from-class="panel-leave-from"
    leave-to-class="panel-leave-to"
  >
    <div v-if="isOpen" class="settings-panel cyber-panel">
      <!-- 霓虹边框效果 -->
      <div class="panel-border-glow" />
      <div class="panel-border-blur" />
      
      <!-- 头部 -->
      <div class="panel-header">
        <h2 class="panel-title">
          <div class="title-icon-box">
            <span>⚙️</span>
          </div>
          设置
        </h2>
        <button class="close-btn" @click="close">
          <X class="close-icon" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="panel-content">
        <!-- 主题设置 -->
        <section class="settings-section">
          <div class="section-header">
            <Palette class="section-icon cyan" />
            <h3 class="section-title">主题</h3>
          </div>
          <div class="theme-grid">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              class="theme-option"
              :class="{ active: configStore.theme === option.value }"
              @click="configStore.setTheme(option.value)"
            >
              <!-- 选中指示器 -->
              <div 
                v-if="configStore.theme === option.value"
                class="option-check"
                :style="{ backgroundColor: `hsl(${option.color})`, boxShadow: `0 0 10px hsl(${option.color})` }"
              >
                <Check class="check-icon" />
              </div>
              
              <div 
                class="option-icon-box"
                :class="{ active: configStore.theme === option.value }"
                :style="configStore.theme === option.value ? { backgroundColor: `hsl(${option.color})`, boxShadow: `0 0 15px hsl(${option.color} / 0.5)` } : {}"
              >
                <component :is="option.icon" class="option-icon" />
              </div>
              <span class="option-label" :class="{ active: configStore.theme === option.value }">{{ option.label }}</span>
            </button>
          </div>
        </section>

        <!-- 背景设置 -->
        <section v-if="!isSketchTheme" class="settings-section">
          <div class="section-header">
            <span class="section-emoji">🌅</span>
            <h3 class="section-title">背景</h3>
          </div>
          <div class="bg-grid">
            <button
              v-for="bg in PRESET_BACKGROUNDS"
              :key="bg.id"
              class="bg-option"
              :class="{ active: configStore.config.background === bg.id }"
              :style="{ background: bg.value, boxShadow: configStore.config.background === bg.id ? '0 0 15px hsl(var(--neon-cyan) / 0.5)' : 'none' }"
              :title="bg.name"
              @click="configStore.setBackground(bg.id)"
            >
              <!-- 选中标记 -->
              <div v-if="configStore.config.background === bg.id" class="bg-check">
                <Check class="bg-check-icon" />
              </div>
            </button>
          </div>
          
          <!-- 服务器背景图片 -->
          <template v-if="serverBackgrounds.length > 0">
            <div class="section-header sub-header">
              <Image class="section-icon green" />
              <h4 class="section-subtitle">服务器图片</h4>
            </div>
            <div class="bg-grid">
              <button
                v-for="bg in serverBackgrounds"
                :key="bg.id"
                class="bg-option bg-image-option"
                :class="{ active: configStore.config.background === bg.id }"
                :style="{ backgroundImage: `url(${bg.value})`, boxShadow: configStore.config.background === bg.id ? '0 0 15px hsl(var(--neon-cyan) / 0.5)' : 'none' }"
                :title="bg.name"
                @click="configStore.setBackground(bg.id)"
              >
                <!-- 选中标记 -->
                <div v-if="configStore.config.background === bg.id" class="bg-check">
                  <Check class="bg-check-icon" />
                </div>
              </button>
            </div>
          </template>
        </section>

        <!-- 显示设置 -->
        <section class="settings-section">
          <div class="section-header">
            <Eye class="section-icon blue" />
            <h3 class="section-title">显示</h3>
          </div>
          <div class="toggle-options">
            <!-- 显示页头 -->
            <label class="toggle-item">
              <span class="toggle-label">显示页头</span>
              <div 
                class="switch-modern"
                :class="{ active: configStore.showHeader }"
                @click="configStore.updateConfig('showHeader', !configStore.showHeader)"
              />
            </label>
            <!-- 隐藏页头时的提示 -->
            <p v-if="!configStore.showHeader" class="toggle-hint">
              关闭后可在页面右上角找到设置入口
            </p>
            
            <!-- 显示描述 -->
            <label class="toggle-item">
              <span class="toggle-label">显示描述</span>
              <div 
                class="switch-modern"
                :class="{ active: configStore.showDescription }"
                @click="configStore.updateConfig('showDescription', !configStore.showDescription)"
              />
            </label>
            
            <!-- 显示时间 -->
            <label class="toggle-item">
              <span class="toggle-label">显示时间</span>
              <div 
                class="switch-modern"
                :class="{ active: configStore.showTime }"
                @click="configStore.updateConfig('showTime', !configStore.showTime)"
              />
            </label>
          </div>
        </section>

        <!-- 搜索设置 -->
        <section class="settings-section">
          <div class="section-header">
            <Search class="section-icon cyan" />
            <h3 class="section-title">搜索</h3>
          </div>
          
          <!-- 显示搜索栏开关 -->
          <div class="toggle-options">
            <label class="toggle-item">
              <span class="toggle-label">显示搜索栏</span>
              <div 
                class="switch-modern"
                :class="{ active: configStore.showSearch }"
                @click="configStore.updateConfig('showSearch', !configStore.showSearch)"
              />
            </label>
          </div>
          
          <!-- 搜索引擎选择 -->
          <template v-if="configStore.showSearch">
            <div class="section-header sub-header">
              <Globe class="section-icon purple" />
              <h4 class="section-subtitle">搜索引擎</h4>
            </div>
            <div class="engine-grid">
              <button
                v-for="engine in SEARCH_ENGINES"
                :key="engine.id"
                class="engine-option-btn"
                :class="{ active: configStore.searchEngine === engine.id }"
                @click="configStore.setSearchEngine(engine.id)"
              >
                <img :src="engine.icon" :alt="engine.name" class="engine-icon-img" />
                <span class="engine-name">{{ engine.name }}</span>
                <Check v-if="configStore.searchEngine === engine.id" class="engine-check" />
              </button>
            </div>
            
            <!-- 自定义搜索引擎 -->
            <div class="custom-engine-section">
              <button
                class="engine-option-btn custom-btn"
                :class="{ active: configStore.searchEngine === 'custom' }"
                @click="configStore.setSearchEngine('custom')"
              >
                <span class="engine-icon">⚡</span>
                <span class="engine-name">自定义</span>
                <Check v-if="configStore.searchEngine === 'custom'" class="engine-check" />
              </button>
              
              <!-- 自定义 URL 输入框 -->
              <div v-if="configStore.searchEngine === 'custom'" class="custom-url-input">
                <input 
                  v-model="customSearchUrlInput"
                  type="text"
                  class="url-input"
                  placeholder="输入搜索 URL，用 {query} 代替搜索词"
                  @blur="saveCustomSearchUrl"
                  @keyup.enter="saveCustomSearchUrl"
                />
                <p class="url-hint">例如: https://www.bing.com/search?q={query}</p>
              </div>
            </div>
          </template>
        </section>

        <section class="settings-section">
          <div class="section-header">
            <ShieldCheck class="section-icon green" />
            <h3 class="section-title">访问认证</h3>
          </div>

          <div class="toggle-options">
            <label class="toggle-item">
              <span class="toggle-label">必须登录后查看页面</span>
              <div
                class="switch-modern"
                :class="{ active: authStore.settings.requireLogin }"
                @click="authStore.setRequireLogin(!authStore.settings.requireLogin)"
              />
            </label>
          </div>

          <p class="toggle-hint">
            设置图标仅管理员可见。普通用户登录后只会看到自己被授权的站点分组和 Docker 分组。
          </p>

          <div class="auth-users-panel">
            <div class="section-header sub-header">
              <UserCog class="section-icon cyan" />
              <h4 class="section-subtitle">用户管理</h4>
            </div>

            <div class="user-list">
              <div
                v-for="user in managedUsers"
                :key="user.id"
                class="user-card"
                :class="{ active: editingUserId === user.id }"
              >
                <button class="user-card-main" @click="editUser(user.id)">
                  <div class="user-avatar">
                    <UserRound class="small-icon" />
                  </div>
                  <div class="user-meta">
                    <strong>{{ user.username }}</strong>
                    <span>{{ user.role === 'admin' ? '管理员' : '普通用户' }}</span>
                  </div>
                </button>
                <button class="user-delete-btn" @click="removeUser(user.id, user.username)">
                  <Trash2 class="small-icon" />
                </button>
              </div>
            </div>

            <div class="user-editor">
              <div class="user-editor-header">
                <div class="section-header sub-header">
                  <LockKeyhole class="section-icon purple" />
                  <h4 class="section-subtitle">{{ editingUserId ? '编辑用户' : '新增用户' }}</h4>
                </div>
                <button class="mini-action-btn" @click="resetUserForm">
                  <Plus class="small-icon" />
                  新建
                </button>
              </div>

              <label class="settings-field">
                <span class="field-title">用户名</span>
                <input v-model.trim="userForm.username" class="url-input" type="text" placeholder="例如：viewer" />
              </label>

              <label class="settings-field">
                <span class="field-title">{{ editingUserId ? '密码（留空则不修改）' : '密码' }}</span>
                <input v-model="userForm.password" class="url-input" type="password" placeholder="请输入密码" />
              </label>

              <label class="settings-field">
                <span class="field-title">角色</span>
                <select v-model="userForm.role" class="url-input">
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </label>

              <template v-if="userForm.role === 'user'">
                <div class="settings-field">
                  <span class="field-title">可查看站点分组</span>
                  <div class="permission-grid">
                    <button
                      v-for="group in sitePermissionGroups"
                      :key="group.key"
                      class="permission-chip"
                      :class="{ active: userForm.permissions.sites.includes(group.key) }"
                      @click="togglePermission('sites', group.key)"
                    >
                      {{ group.name }}
                    </button>
                  </div>
                </div>

                <div class="settings-field">
                  <span class="field-title">可查看 Docker 分组</span>
                  <div class="permission-grid">
                    <button
                      v-for="group in dockerPermissionGroups"
                      :key="group.key"
                      class="permission-chip"
                      :class="{ active: userForm.permissions.docker.includes(group.key) }"
                      @click="togglePermission('docker', group.key)"
                    >
                      {{ group.name }}
                    </button>
                  </div>
                </div>
              </template>

              <p v-else class="toggle-hint">
                管理员默认拥有所有分组权限，并可看到设置入口。
              </p>

              <p v-if="authErrorMessage" class="auth-error">{{ authErrorMessage }}</p>

              <div class="user-actions">
                <button class="save-user-btn" @click="saveUser">
                  <Save class="small-icon" />
                  保存用户
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-header">
            <Github class="section-icon purple" />
            <h3 class="section-title">前端配置接口</h3>
          </div>

          <div class="json-overview-grid">
            <div v-for="item in jsonOverviewItems" :key="item.key" class="json-overview-card">
              <span class="json-overview-title">{{ item.title }}</span>
              <strong class="json-overview-value">{{ item.value }}</strong>
              <span class="json-overview-desc">{{ item.description }}</span>
            </div>
          </div>

          <div class="schema-panel">
            <div class="section-header sub-header">
              <Globe class="section-icon cyan" />
              <h4 class="section-subtitle">LuckyLightPanel.json 设置项</h4>
            </div>

            <div v-if="panelSchemaEntries.length > 0" class="schema-list">
              <div v-for="[key, field] in panelSchemaEntries" :key="key" class="schema-item">
                <div class="schema-item-head">
                  <div>
                    <strong class="schema-item-title">{{ field.label }}</strong>
                    <p class="schema-item-desc">{{ field.description || '无说明' }}</p>
                  </div>
                  <span class="schema-item-type">{{ field.type }}</span>
                </div>
                <div class="schema-item-meta">
                  <span class="schema-badge">键名 {{ key }}</span>
                  <span class="schema-badge">当前 {{ formatSchemaValue(key) }}</span>
                  <span class="schema-badge">默认 {{ String(field.default) }}</span>
                </div>
              </div>
            </div>

            <p v-else class="toggle-hint">
              当前未读取到 LuckyLightPanel.json 配置 schema。
            </p>
          </div>
        </section>
      </div>

      <!-- 底部 -->
      <div class="panel-footer">
        <!-- 开源地址 -->
        <a 
          href="https://github.com/DPeak0/DPeakPanel" 
          target="_blank" 
          rel="noopener noreferrer"
          class="github-link"
        >
          <Github class="github-icon" />
          <span>开源地址</span>
        </a>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 遮罩层 */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.15);
}

.overlay-enter { transition: opacity 300ms; }
.overlay-enter-from { opacity: 0; }
.overlay-enter-to { opacity: 1; }
.overlay-leave { transition: opacity 200ms; }
.overlay-leave-from { opacity: 1; }
.overlay-leave-to { opacity: 0; }

/* 设置面板 */
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 200;
  height: 100%;
  width: 360px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
}

.cyber-panel {
  background: hsl(var(--bg-elevated));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
}

.panel-enter { transition: all 400ms ease-out; }
.panel-enter-from { transform: translateX(100%); opacity: 0; }
.panel-enter-to { transform: translateX(0); opacity: 1; }
.panel-leave { transition: all 300ms ease-in; }
.panel-leave-from { transform: translateX(0); opacity: 1; }
.panel-leave-to { transform: translateX(100%); opacity: 0; }

/* 霓虹边框效果 */
.panel-border-glow {
  position: absolute;
  inset: 0;
  left: 0;
  width: 1px;
  background: linear-gradient(to bottom, transparent, hsl(var(--neon-cyan) / 0.5), transparent);
}

.panel-border-blur {
  position: absolute;
  inset: 0;
  left: 0;
  width: 2px;
  filter: blur(4px);
  background: linear-gradient(to bottom, transparent, hsl(var(--neon-cyan) / 0.8), transparent);
}

/* 头部 */
.panel-header {
  flex-shrink: 0;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid hsl(var(--neon-cyan) / 0.2);
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--text-primary));
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon-box {
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--neon-purple)));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px hsl(var(--neon-cyan) / 0.4);
}

.title-icon-box span {
  font-size: 0.875rem;
  color: white;
}

.close-btn {
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-muted));
  transition: all 200ms;
}

.close-btn:hover {
  color: hsl(var(--neon-pink));
  border-color: hsl(var(--neon-pink) / 0.4);
  transform: rotate(90deg);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* 内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 设置区块 */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: hsl(var(--text-secondary));
}

.section-icon {
  width: 1rem;
  height: 1rem;
}

.section-icon.blue { color: hsl(var(--neon-blue)); }
.section-icon.green { color: hsl(var(--success)); }

.section-emoji {
  color: hsl(var(--neon-purple));
}

.section-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.sub-header {
  margin-top: 0.5rem;
}

.section-subtitle {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--text-muted));
}

/* 主题网格 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.theme-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  overflow: hidden;
  transition: all 200ms;
}

.theme-option:hover {
  background: hsl(var(--glass-bg-hover));
  border-color: hsl(var(--neon-cyan) / 0.3);
}

.theme-option.active {
  border-color: hsl(var(--neon-cyan) / 0.5);
  background: hsl(var(--neon-cyan) / 0.1);
}

.option-check {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-icon {
  width: 0.625rem;
  height: 0.625rem;
  color: white;
}

.option-icon-box {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms;
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-muted));
}

.option-icon-box.active {
  color: white;
}

.theme-option:hover .option-icon-box {
  transform: scale(1.1);
}

.option-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.option-label {
  font-size: 0.75rem;
  color: hsl(var(--text-muted));
}

.option-label.active {
  color: hsl(var(--text-primary));
}

/* 背景网格 */
.bg-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
}

.bg-option {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 200ms;
  border: 2px solid transparent;
  opacity: 0.7;
}

.bg-option:hover {
  transform: scale(1.05);
  opacity: 1;
}

.bg-option.active {
  border-color: hsl(var(--neon-cyan));
  transform: scale(1.05);
  opacity: 1;
}

.bg-image-option {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.bg-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.bg-check-icon {
  width: 1rem;
  height: 1rem;
  color: white;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.2));
}

/* 开关选项 */
.toggle-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: hsl(var(--glass-bg));
  border: 1px solid hsl(var(--glass-border));
  cursor: pointer;
  transition: background 200ms;
}

.toggle-item:hover {
  background: hsl(var(--glass-bg-hover));
}

.toggle-label {
  font-size: 0.875rem;
  color: hsl(var(--text-secondary));
}

.toggle-hint {
  margin: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: hsl(var(--neon-cyan));
  background: hsl(var(--neon-cyan) / 0.1);
  border-radius: 0.5rem;
  border-left: 2px solid hsl(var(--neon-cyan) / 0.5);
}

/* 搜索引擎网格 */
.engine-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.engine-option-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  cursor: pointer;
  transition: all 200ms;
}

.engine-option-btn:hover {
  background: hsl(var(--glass-bg-hover));
  border-color: hsl(var(--neon-cyan) / 0.3);
}

.engine-option-btn.active {
  border-color: hsl(var(--neon-cyan) / 0.5);
  background: hsl(var(--neon-cyan) / 0.1);
}

.engine-icon-img {
  width: 1rem;
  height: 1rem;
  object-fit: contain;
  flex-shrink: 0;
}

.engine-name {
  flex: 1;
  font-size: 0.75rem;
  color: hsl(var(--text-secondary));
  text-align: left;
}

.engine-option-btn.active .engine-name {
  color: hsl(var(--neon-cyan));
}

.engine-check {
  width: 0.75rem;
  height: 0.75rem;
  color: hsl(var(--neon-cyan));
}

/* 自定义搜索引擎 */
.custom-engine-section {
  margin-top: 0.75rem;
}

.custom-btn {
  width: 100%;
}

.custom-url-input {
  margin-top: 0.625rem;
}

.url-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  font-size: 0.8125rem;
  outline: none;
  transition: all 200ms;
}

.url-input:focus {
  border-color: hsl(var(--neon-cyan) / 0.5);
  box-shadow: 0 0 10px hsl(var(--neon-cyan) / 0.1);
}

.url-input::placeholder {
  color: hsl(var(--text-muted));
}

.url-hint {
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: hsl(var(--text-muted));
}

.auth-users-panel,
.user-editor {
  display: flex;
  flex-direction: column;
}

.auth-users-panel {
  gap: 0.9rem;
}

.user-list,
.permission-grid {
  display: grid;
  gap: 0.55rem;
}

.user-list {
  grid-template-columns: 1fr;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-card-main,
.user-delete-btn,
.mini-action-btn,
.permission-chip,
.save-user-btn {
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  transition: all 200ms;
}

.user-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.875rem;
}

.user-card.active .user-card-main {
  border-color: hsl(var(--neon-cyan) / 0.45);
  background: hsl(var(--neon-cyan) / 0.1);
}

.user-delete-btn,
.mini-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.72rem 0.8rem;
  border-radius: 0.875rem;
}

.user-delete-btn {
  color: hsl(var(--error));
}

.user-avatar {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  background: hsl(var(--glass-bg-hover));
  color: hsl(var(--neon-cyan));
  flex-shrink: 0;
}

.user-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.user-meta strong,
.field-title {
  color: hsl(var(--text-primary));
}

.user-meta span,
.field-title {
  font-size: 0.75rem;
}

.user-meta span {
  color: hsl(var(--text-muted));
}

.user-editor {
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 1rem;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
}

.user-editor-header,
.user-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.permission-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.permission-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0.75rem;
  border-radius: 0.8rem;
  font-size: 0.75rem;
}

.permission-chip.active {
  border-color: hsl(var(--neon-cyan) / 0.45);
  background: hsl(var(--neon-cyan) / 0.12);
  color: hsl(var(--neon-cyan));
}

.save-user-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.875rem;
  background: hsl(var(--primary) / 0.16);
}

.auth-error {
  margin: 0;
  font-size: 0.75rem;
  color: hsl(var(--error));
}

.small-icon {
  width: 0.9rem;
  height: 0.9rem;
}

.json-overview-grid,
.schema-list {
  display: grid;
  gap: 0.65rem;
}

.json-overview-grid {
  grid-template-columns: 1fr;
}

.json-overview-card,
.schema-panel,
.schema-item {
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
}

.json-overview-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.9rem;
}

.json-overview-title,
.json-overview-desc,
.schema-item-desc {
  color: hsl(var(--text-secondary));
}

.json-overview-title {
  font-size: 0.72rem;
}

.json-overview-value,
.schema-item-title {
  color: hsl(var(--text-primary));
}

.json-overview-value {
  font-size: 0.88rem;
}

.json-overview-desc,
.schema-item-desc,
.schema-badge,
.schema-item-type {
  font-size: 0.72rem;
}

.schema-panel {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.9rem;
  border-radius: 1rem;
}

.schema-item {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.8rem;
  border-radius: 0.9rem;
}

.schema-item-head,
.schema-item-meta {
  display: flex;
  gap: 0.55rem;
}

.schema-item-head {
  align-items: flex-start;
  justify-content: space-between;
}

.schema-item-desc {
  margin: 0.25rem 0 0;
  line-height: 1.45;
}

.schema-item-type,
.schema-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--glass-border));
  white-space: nowrap;
}

.schema-item-type {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.12);
}

.schema-item-meta {
  flex-wrap: wrap;
}

.schema-badge {
  color: hsl(var(--text-secondary));
}

/* 图标颜色 */
.section-icon.cyan { color: hsl(var(--neon-cyan)); }
.section-icon.purple { color: hsl(var(--neon-purple)); }

/* 底部 */
.panel-footer {
  flex-shrink: 0;
  padding: 1.25rem;
  border-top: 1px solid hsl(var(--neon-cyan) / 0.2);
}

.reset-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.3);
  color: hsl(var(--error));
  box-shadow: 0 0 10px hsl(var(--error) / 0.1);
  transition: all 200ms;
}

.reset-btn:hover {
  background: hsl(var(--error) / 0.2);
  border-color: hsl(var(--error) / 0.5);
}

.reset-icon {
  width: 1rem;
  height: 1rem;
  transition: transform 500ms;
}

.reset-btn:hover .reset-icon {
  transform: rotate(-180deg);
}

/* 开源地址链接 */
.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: hsl(var(--text-muted));
  text-decoration: none;
  transition: all 200ms;
}

.github-link:hover {
  color: hsl(var(--text-primary));
  background: hsl(var(--glass-bg-hover));
}

.github-icon {
  width: 1rem;
  height: 1rem;
}
</style>
