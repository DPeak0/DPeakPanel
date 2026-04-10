<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Search, LoaderCircle, X, Plus, Pencil, Trash2, Check, FolderCog } from 'lucide-vue-next'
import { SITE_ICON_LIBRARY } from '@/data/siteIconLibrary'
import {
  DEFAULT_SITE_ICON_SOURCES,
  buildSiteIconSourcePayload,
  ensureSiteIconSourceKey,
  loadSiteIconSources,
  saveSiteIconSources,
  type SiteIconSource,
  type SiteIconSourceType
} from '@/data/siteIconSources'
import {
  buildSiteIconSourceUrl,
  downloadImageAsDataUrlOrKeepUrl
} from '@/utils/siteIcons'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [iconValue: string]
}>()

const activeTab = ref<'browse' | 'sources'>('browse')
const keyword = ref('')
const loadingKey = ref('')
const errorMessage = ref('')
const sourceErrorMessage = ref('')
const sources = ref<SiteIconSource[]>([])
const selectedSourceKey = ref('')
const editingSourceKey = ref<string | null>(null)

const sourceForm = reactive({
  key: '',
  name: '',
  type: 'simple-icons' as SiteIconSourceType,
  urlTemplate: DEFAULT_SITE_ICON_SOURCES[0].urlTemplate,
  description: '',
  enabled: true
})

const filteredIcons = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return SITE_ICON_LIBRARY

  return SITE_ICON_LIBRARY.filter(item =>
    item.title.toLowerCase().includes(search) ||
    item.slug.toLowerCase().includes(search) ||
    item.keywords.some(word => word.toLowerCase().includes(search))
  )
})

const enabledSources = computed(() => sources.value.filter(item => item.enabled))
const selectedSource = computed(() => {
  return enabledSources.value.find(item => item.key === selectedSourceKey.value)
    || enabledSources.value[0]
    || sources.value[0]
    || null
})

function loadSources() {
  sources.value = loadSiteIconSources()

  if (!sources.value.some(item => item.key === selectedSourceKey.value)) {
    selectedSourceKey.value = enabledSources.value[0]?.key || sources.value[0]?.key || ''
  }
}

function saveSources() {
  saveSiteIconSources(sources.value)
}

function resetSourceForm() {
  Object.assign(sourceForm, {
    key: '',
    name: '',
    type: 'simple-icons',
    urlTemplate: DEFAULT_SITE_ICON_SOURCES[0].urlTemplate,
    description: '',
    enabled: true
  })
  editingSourceKey.value = null
  sourceErrorMessage.value = ''
}

function startCreateSource() {
  resetSourceForm()
}

function startEditSource(source: SiteIconSource) {
  Object.assign(sourceForm, {
    key: source.key,
    name: source.name,
    type: source.type,
    urlTemplate: source.urlTemplate,
    description: source.description || '',
    enabled: source.enabled
  })
  editingSourceKey.value = source.key
  sourceErrorMessage.value = ''
}

function persistSource() {
  const nextSource = buildSiteIconSourcePayload({
    ...sourceForm,
    key: ensureSiteIconSourceKey(sourceForm.key)
  })

  if (!nextSource) {
    sourceErrorMessage.value = '请填写有效的别名、名称和地址模板'
    return
  }

  const duplicate = sources.value.find(item => item.key === nextSource.key)
  if (duplicate && editingSourceKey.value !== nextSource.key) {
    sourceErrorMessage.value = '别名已存在，请换一个'
    return
  }

  if (editingSourceKey.value) {
    sources.value = sources.value.map(item => item.key === editingSourceKey.value ? nextSource : item)
  } else {
    sources.value = [...sources.value, nextSource]
  }

  saveSources()
  selectedSourceKey.value = nextSource.enabled ? nextSource.key : (enabledSources.value[0]?.key || nextSource.key)
  resetSourceForm()
}

function removeSource(source: SiteIconSource) {
  if (sources.value.length === 1) {
    sourceErrorMessage.value = '至少保留一个图标源'
    return
  }

  if (!window.confirm(`确认删除图标源“${source.name}”吗？`)) {
    return
  }

  sources.value = sources.value.filter(item => item.key !== source.key)
  saveSources()

  if (selectedSourceKey.value === source.key) {
    selectedSourceKey.value = enabledSources.value[0]?.key || sources.value[0]?.key || ''
  }

  if (editingSourceKey.value === source.key) {
    resetSourceForm()
  }
}

function toggleSourceEnabled(source: SiteIconSource) {
  const enabledCount = sources.value.filter(item => item.enabled).length
  if (source.enabled && enabledCount <= 1) {
    sourceErrorMessage.value = '至少启用一个图标源'
    return
  }

  sources.value = sources.value.map(item =>
    item.key === source.key
      ? { ...item, enabled: !item.enabled }
      : item
  )
  saveSources()

  if (!enabledSources.value.some(item => item.key === selectedSourceKey.value)) {
    selectedSourceKey.value = enabledSources.value[0]?.key || ''
  }
}

function close() {
  activeTab.value = 'browse'
  keyword.value = ''
  errorMessage.value = ''
  sourceErrorMessage.value = ''
  emit('close')
}

function getPreviewUrl(itemKey: string) {
  const item = SITE_ICON_LIBRARY.find(entry => entry.key === itemKey)
  if (!selectedSource.value || !item) return ''
  return buildSiteIconSourceUrl(selectedSource.value, item)
}

async function selectIcon(itemKey: string) {
  const item = SITE_ICON_LIBRARY.find(entry => entry.key === itemKey)
  if (!selectedSource.value || !item) {
    errorMessage.value = '当前没有可用的图标源'
    return
  }

  loadingKey.value = itemKey
  errorMessage.value = ''

  try {
    const iconValue = await downloadImageAsDataUrlOrKeepUrl(
      buildSiteIconSourceUrl(selectedSource.value, item)
    )
    emit('select', iconValue)
    close()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图标下载失败'
  } finally {
    loadingKey.value = ''
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    loadSources()
    resetSourceForm()
  },
  { immediate: true }
)
</script>

<template>
  <Transition
    enter-active-class="overlay-enter"
    enter-from-class="overlay-enter-from"
    enter-to-class="overlay-enter-to"
    leave-active-class="overlay-leave"
    leave-from-class="overlay-leave-from"
    leave-to-class="overlay-leave-to"
  >
    <div v-if="open" class="library-overlay" @click="close" />
  </Transition>

  <Transition
    enter-active-class="panel-enter"
    enter-from-class="panel-enter-from"
    enter-to-class="panel-enter-to"
    leave-active-class="panel-leave"
    leave-from-class="panel-leave-from"
    leave-to-class="panel-leave-to"
  >
    <div v-if="open" class="library-panel">
      <div class="library-header">
        <h3 class="library-title">图标库</h3>
        <button class="close-btn" @click="close">
          <X class="icon-sm" />
        </button>
      </div>

      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'browse' }" @click="activeTab = 'browse'">浏览图标</button>
        <button class="tab-btn" :class="{ active: activeTab === 'sources' }" @click="activeTab = 'sources'">管理图标源</button>
      </div>

      <template v-if="activeTab === 'browse'">
        <div class="toolbar">
          <label class="source-select-wrap">
            <span class="source-label">图标源</span>
            <select v-model="selectedSourceKey" class="source-select">
              <option v-for="source in enabledSources" :key="source.key" :value="source.key">
                {{ source.name }}
              </option>
            </select>
          </label>
          <button class="manage-link" @click="activeTab = 'sources'">
            <FolderCog class="icon-sm" />
            管理图标源
          </button>
        </div>

        <div class="search-bar">
          <Search class="search-icon" />
          <input v-model.trim="keyword" class="search-input" type="text" placeholder="搜索图标，例如 github / docker / media" />
        </div>

        <p v-if="selectedSource" class="helper-text">
          当前图标源：{{ selectedSource.name }}。选择时优先下载为本地 data URL，失败时自动回退为远程地址。通用模板支持 `{path}`，会同时作为旧图标路径的远程资源根地址。
        </p>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <div class="icon-grid">
          <button
            v-for="item in filteredIcons"
            :key="item.key"
            class="icon-card"
            :disabled="loadingKey === item.key || !selectedSource"
            @click="selectIcon(item.key)"
          >
            <div class="icon-preview">
              <LoaderCircle v-if="loadingKey === item.key" class="icon-loading" />
              <img v-else :src="getPreviewUrl(item.key)" :alt="item.title" class="icon-image" loading="lazy" />
            </div>
            <span class="icon-title">{{ item.title }}</span>
          </button>
        </div>
      </template>

      <template v-else>
        <div class="sources-layout">
          <div class="sources-list">
            <div class="sources-toolbar">
              <h4 class="section-title">图标源列表</h4>
              <button class="primary-btn" @click="startCreateSource">
                <Plus class="icon-sm" />
                添加图标源
              </button>
            </div>

            <div class="source-table">
              <div class="source-row source-head">
                <span>别名</span>
                <span>名称</span>
                <span>操作</span>
              </div>
              <div v-for="source in sources" :key="source.key" class="source-row">
                <div class="source-meta">
                  <strong>{{ source.key }}</strong>
                  <span class="source-enabled" :class="{ off: !source.enabled }">{{ source.enabled ? '已启用' : '已停用' }}</span>
                </div>
                <div class="source-name">{{ source.name }}</div>
                <div class="source-actions">
                  <button class="table-btn" @click="startEditSource(source)">
                    <Pencil class="icon-sm" />
                  </button>
                  <button class="table-btn" @click="toggleSourceEnabled(source)">
                    <Check class="icon-sm" />
                  </button>
                  <button class="table-btn danger" @click="removeSource(source)">
                    <Trash2 class="icon-sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="source-editor">
            <div class="sources-toolbar">
              <h4 class="section-title">{{ editingSourceKey ? '编辑图标源' : '新增图标源' }}</h4>
            </div>

            <label class="field">
              <span class="field-label">别名</span>
              <input v-model.trim="sourceForm.key" class="field-input" type="text" placeholder="例如 simple_icons / custom_http" />
            </label>

            <label class="field">
              <span class="field-label">名称</span>
              <input v-model.trim="sourceForm.name" class="field-input" type="text" placeholder="例如 Simple Icons CDN" />
            </label>

            <label class="field">
              <span class="field-label">类型</span>
              <select v-model="sourceForm.type" class="field-input">
                <option value="simple-icons">Simple Icons</option>
                <option value="template">通用模板</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">地址模板</span>
              <input
                v-model.trim="sourceForm.urlTemplate"
                class="field-input"
                type="text"
                placeholder="支持 {slug} / {key} / {title} / {path}，也可直接填写基础 URL"
              />
            </label>

            <p class="helper-text">
              示例：`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg` 或 `https://icons.example.com/{path}`。模板类型直接填基础 URL 时，会自动补成 `{path}`。
            </p>

            <label class="field">
              <span class="field-label">描述</span>
              <input v-model.trim="sourceForm.description" class="field-input" type="text" placeholder="可选说明" />
            </label>

            <label class="toggle-row">
              <span class="field-label">启用</span>
              <input v-model="sourceForm.enabled" type="checkbox" class="toggle-input" />
            </label>

            <p v-if="sourceErrorMessage" class="error-text">{{ sourceErrorMessage }}</p>

            <div class="editor-actions">
              <button class="primary-btn" @click="persistSource">保存</button>
              <button class="secondary-btn" @click="resetSourceForm">重置</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.library-overlay {
  position: fixed;
  inset: 0;
  background: rgb(5 10 20 / 0.45);
  backdrop-filter: blur(8px);
  z-index: 100;
}

.library-panel {
  position: fixed;
  inset: 6vh 8vw;
  z-index: 101;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(24px) saturate(140%);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.35);
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid hsl(var(--glass-border));
}

.library-title,
.section-title {
  margin: 0;
  color: hsl(var(--text-primary));
}

.library-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.tab-bar,
.toolbar,
.sources-toolbar,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tab-bar {
  padding: 1rem 1.25rem 0;
}

.toolbar {
  padding: 1rem 1.25rem 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem 0;
}

.search-icon,
.icon-sm,
.icon-loading {
  width: 1rem;
  height: 1rem;
}

.tab-btn,
.icon-card,
.close-btn,
.manage-link,
.primary-btn,
.secondary-btn,
.table-btn {
  border: 1px solid hsl(var(--glass-border));
  background: transparent;
  color: hsl(var(--text-primary));
  cursor: pointer;
}

.tab-btn {
  padding: 0.65rem 1rem;
  border-radius: 999px;
}

.tab-btn.active {
  background: hsl(var(--primary) / 0.16);
  border-color: hsl(var(--primary) / 0.34);
}

.close-btn,
.manage-link,
.primary-btn,
.secondary-btn,
.table-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 12px;
  padding: 0.7rem 0.95rem;
}

.close-btn {
  border-radius: 999px;
  padding: 0.65rem;
}

.primary-btn {
  background: hsl(var(--primary) / 0.16);
}

.source-select-wrap,
.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-row {
  justify-content: space-between;
  padding: 1rem 1rem 0;
}

.source-label,
.field-label,
.helper-text,
.source-head {
  color: hsl(var(--text-secondary));
}

.source-select,
.field-input,
.search-input {
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  outline: none;
}

.source-select,
.field-input {
  width: 100%;
  min-width: 0;
  border-radius: 14px;
  padding: 0.8rem 1rem;
}

.search-input {
  flex: 1;
  border-radius: 999px;
  padding: 0.8rem 1rem;
}

.search-input:focus,
.source-select:focus,
.field-input:focus {
  border-color: hsl(var(--neon-cyan) / 0.5);
}

.helper-text,
.error-text {
  padding: 0 1.25rem;
  font-size: 0.85rem;
}

.error-text {
  color: hsl(var(--danger));
}

.icon-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 0.9rem;
  padding: 1rem 1.25rem 1.25rem;
}

.icon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  padding: 0.9rem 0.75rem;
  border-radius: 18px;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.icon-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: hsl(var(--neon-cyan) / 0.4);
  box-shadow: 0 0 0 2px hsl(var(--neon-cyan) / 0.08);
}

.icon-card:disabled {
  opacity: 0.7;
  cursor: wait;
}

.icon-preview {
  width: 2.6rem;
  height: 2.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: hsl(var(--glass-bg-hover));
}

.icon-image {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
}

.icon-title {
  font-size: 0.82rem;
  text-align: center;
}

.sources-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
  gap: 1rem;
  padding: 1rem 1.25rem 1.25rem;
}

.sources-list,
.source-editor {
  min-height: 0;
  border: 1px solid hsl(var(--glass-border));
  border-radius: 20px;
  background: hsl(var(--glass-bg-hover));
}

.sources-toolbar {
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--glass-border));
}

.source-table {
  padding: 0.75rem 1rem 1rem;
}

.source-row {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.15fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid hsl(var(--glass-border) / 0.7);
}

.source-row:last-child {
  border-bottom: none;
}

.source-meta {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.source-enabled {
  font-size: 0.75rem;
  color: hsl(var(--success));
}

.source-enabled.off {
  color: hsl(var(--text-muted));
}

.source-name {
  color: hsl(var(--text-primary));
  word-break: break-word;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.table-btn {
  padding: 0.55rem;
}

.table-btn.danger {
  color: hsl(var(--danger));
}

.source-editor {
  display: flex;
  flex-direction: column;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1rem 1rem 0;
}

.toggle-input {
  width: 1.1rem;
  height: 1.1rem;
}

.editor-actions {
  padding: 1rem;
  margin-top: auto;
}

.overlay-enter,
.overlay-leave,
.panel-enter,
.panel-leave {
  transition: all 220ms ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@media (max-width: 960px) {
  .library-panel {
    inset: 4vh 4vw;
  }

  .tab-bar,
  .toolbar,
  .sources-toolbar,
  .editor-actions {
    flex-wrap: wrap;
  }

  .sources-layout {
    grid-template-columns: 1fr;
  }

  .source-row {
    grid-template-columns: 1fr;
  }

  .source-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .library-panel {
    inset: 2vh 2vw;
  }

  .icon-grid {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
}
</style>
