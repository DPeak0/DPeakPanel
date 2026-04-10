<script setup lang="ts">
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { Search, LoaderCircle, X, Plus, Pencil, Trash2, Check, FolderCog } from 'lucide-vue-next'
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
  clearTemplateSourceSearchCache,
  downloadImageAsDataUrlOrKeepUrl,
  loadRemoteIcons,
  type RemoteIconSearchItem
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
const isSearching = ref(false)
const errorMessage = ref('')
const sourceErrorMessage = ref('')
const sources = ref<SiteIconSource[]>([])
const editingSourceKey = ref<string | null>(null)
const allRemoteIcons = ref<RemoteIconSearchItem[]>([])
const selectedBrowseSourceKey = ref<'all' | string>('all')
let searchAbortController: AbortController | null = null

const sourceForm = reactive({
  key: '',
  name: '',
  type: 'simple-icons' as SiteIconSourceType,
  urlTemplate: DEFAULT_SITE_ICON_SOURCES[0].urlTemplate,
  description: '',
  enabled: true
})

const enabledSources = computed(() => sources.value.filter(item => item.enabled))
const browseSourceOptions = computed(() => [
  { key: 'all', name: '全部' },
  ...enabledSources.value.map(source => ({
    key: source.key,
    name: source.name
  }))
])
const activeBrowseSources = computed(() => {
  if (selectedBrowseSourceKey.value === 'all') {
    return enabledSources.value
  }
  return enabledSources.value.filter(source => source.key === selectedBrowseSourceKey.value)
})
const filteredRemoteIcons = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) {
    return allRemoteIcons.value
  }

  return allRemoteIcons.value.filter(item =>
    item.name.toLowerCase().includes(search) ||
    item.collectionName.toLowerCase().includes(search) ||
    item.sourceName.toLowerCase().includes(search) ||
    item.id.toLowerCase().includes(search) ||
    (item.relativePath || '').toLowerCase().includes(search)
  )
})

function loadSources() {
  sources.value = loadSiteIconSources()
  clearTemplateSourceSearchCache()
  if (
    selectedBrowseSourceKey.value !== 'all' &&
    !sources.value.some(source => source.enabled && source.key === selectedBrowseSourceKey.value)
  ) {
    selectedBrowseSourceKey.value = 'all'
  }
}

function saveSources() {
  saveSiteIconSources(sources.value)
  clearTemplateSourceSearchCache()
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
}

function close() {
  if (searchAbortController) {
    searchAbortController.abort()
    searchAbortController = null
  }
  activeTab.value = 'browse'
  keyword.value = ''
  selectedBrowseSourceKey.value = 'all'
  allRemoteIcons.value = []
  isSearching.value = false
  errorMessage.value = ''
  sourceErrorMessage.value = ''
  emit('close')
}

function getPreviewUrl(icon: RemoteIconSearchItem) {
  return icon.previewUrl
}

async function selectIcon(icon: RemoteIconSearchItem) {
  const iconUrl = icon.downloadUrl
  if (!iconUrl) {
    errorMessage.value = '图标地址生成失败'
    return
  }

  loadingKey.value = icon.id
  errorMessage.value = ''

  try {
    const iconValue = await downloadImageAsDataUrlOrKeepUrl(iconUrl)
    emit('select', iconValue)
    close()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图标下载失败'
  } finally {
    loadingKey.value = ''
  }
}

async function loadBrowseIcons() {
  if (searchAbortController) {
    searchAbortController.abort()
  }

  if (activeBrowseSources.value.length === 0) {
    allRemoteIcons.value = []
    isSearching.value = false
    errorMessage.value = ''
    return
  }

  searchAbortController = new AbortController()
  isSearching.value = true
  errorMessage.value = ''

  try {
    allRemoteIcons.value = await loadRemoteIcons(activeBrowseSources.value, searchAbortController.signal)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }
    errorMessage.value = error instanceof Error ? error.message : '远程搜索失败'
  } finally {
    isSearching.value = false
    searchAbortController = null
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    loadSources()
    resetSourceForm()
    keyword.value = ''
    selectedBrowseSourceKey.value = 'all'
    allRemoteIcons.value = []
    errorMessage.value = ''
    loadBrowseIcons()
  },
  { immediate: true }
)

watch(activeTab, (tab) => {
  if (tab !== 'browse') return
  loadBrowseIcons()
})

watch(selectedBrowseSourceKey, () => {
  if (!props.open || activeTab.value !== 'browse') return
  loadBrowseIcons()
})

onBeforeUnmount(() => {
  if (searchAbortController) {
    searchAbortController.abort()
  }
})
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
          <div class="browse-source-filters">
            <button
              v-for="option in browseSourceOptions"
              :key="option.key"
              class="browse-source-btn"
              :class="{ active: selectedBrowseSourceKey === option.key }"
              @click="selectedBrowseSourceKey = option.key"
            >
              {{ option.name }}
            </button>
          </div>
          <button class="manage-link" @click="activeTab = 'sources'">
            <FolderCog class="icon-sm" />
            管理图标源
          </button>
        </div>

        <div class="search-bar">
          <Search class="search-icon" />
          <input v-model.trim="keyword" class="search-input" type="text" placeholder="搜索图标，例如 github / docker / media / cloudflare" />
        </div>

        <p class="helper-text">
          当前会直接加载所选来源的全部图标。搜索框仅用于在已加载结果里筛选，`全部` 会同时展示所有已启用图标源。
        </p>
        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <div v-if="activeBrowseSources.length === 0" class="empty-search-state">
          当前没有可用的已启用图标源，请先到“管理图标源”里启用至少一个来源。
        </div>

        <div v-else-if="isSearching" class="search-loading-state">
          <LoaderCircle class="icon-loading large" />
          <span>正在加载图标...</span>
        </div>

        <div v-else-if="filteredRemoteIcons.length === 0" class="empty-search-state">
          {{ keyword.trim() ? '未找到匹配图标，试试别的关键词。' : '当前来源下没有可显示的图标。' }}
        </div>

        <div v-else class="icon-grid">
          <button
            v-for="item in filteredRemoteIcons"
            :key="item.id"
            class="icon-card"
            :disabled="loadingKey === item.id"
            @click="selectIcon(item)"
          >
            <div class="icon-preview">
              <LoaderCircle v-if="loadingKey === item.id" class="icon-loading" />
              <img v-else :src="getPreviewUrl(item)" :alt="item.id" class="icon-image" loading="lazy" />
            </div>
            <span class="icon-title">{{ item.name }}</span>
            <span class="icon-subtitle">{{ item.collectionName }}</span>
            <span class="icon-source">{{ item.sourceName }}</span>
            <span class="icon-key">{{ item.id }}</span>
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

.browse-source-filters {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.browse-source-btn {
  border: 1px solid hsl(var(--glass-border));
  background: transparent;
  color: hsl(var(--text-secondary));
  cursor: pointer;
  padding: 0.6rem 0.9rem;
  border-radius: 999px;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.browse-source-btn.active {
  background: hsl(var(--primary) / 0.16);
  border-color: hsl(var(--primary) / 0.34);
  color: hsl(var(--text-primary));
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

.empty-search-state,
.search-loading-state {
  margin: 0 1.25rem;
  padding: 1rem 1.1rem;
  border-radius: 16px;
  border: 1px dashed hsl(var(--glass-border));
  background: hsl(var(--glass-bg-hover));
  color: hsl(var(--text-secondary));
  font-size: 0.9rem;
}

.search-loading-state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
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
  color: hsl(var(--text-primary));
  word-break: break-word;
}

.icon-subtitle {
  font-size: 0.72rem;
  color: hsl(var(--text-secondary));
  text-align: center;
  word-break: break-word;
}

.icon-source {
  font-size: 0.7rem;
  color: hsl(var(--primary));
  text-align: center;
  word-break: break-word;
}

.icon-key {
  font-size: 0.68rem;
  color: hsl(var(--text-muted));
  text-align: center;
  word-break: break-word;
}

.icon-loading.large {
  width: 1.2rem;
  height: 1.2rem;
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
