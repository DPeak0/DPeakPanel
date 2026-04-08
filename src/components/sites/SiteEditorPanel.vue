<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import { Plus, Pencil, Trash2, RotateCcw, Save, X } from 'lucide-vue-next'
import type { Site } from '@/types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const navStore = useNavStore()

const errorMessage = ref('')
const isCreating = ref(false)
const selectedSiteKey = ref('')

const form = reactive({
  originalKey: '',
  key: '',
  name: '',
  description: '',
  iconUrl: '',
  groupName: '',
  frontendUrlsText: '',
  backendUrlsText: '',
  order: 0,
  enable: true,
  target: '_blank'
})

const siteList = computed(() => navStore.editableSites)
const groupOptions = computed(() => navStore.siteGroups.map(group => group.name))
const hasLocalOverride = computed(() => navStore.hasLocalSitesOverride)

const selectedSite = computed(() => {
  return siteList.value.find(site => site.key === selectedSiteKey.value) || null
})

function resetForm() {
  Object.assign(form, {
    originalKey: '',
    key: '',
    name: '',
    description: '',
    iconUrl: '',
    groupName: groupOptions.value[0] || '',
    frontendUrlsText: '',
    backendUrlsText: '',
    order: getNextOrder(),
    enable: true,
    target: '_blank'
  })
  errorMessage.value = ''
}

function getNextOrder() {
  return siteList.value.reduce((max, site) => Math.max(max, site.order || 0), 0) + 1
}

function fillForm(site: Site | null) {
  if (!site) {
    isCreating.value = true
    resetForm()
    return
  }

  const groupName = navStore.siteGroups.find(group => group.key === site.groupKey)?.name || ''
  isCreating.value = false
  errorMessage.value = ''
  Object.assign(form, {
    originalKey: site.key,
    key: site.key,
    name: site.name,
    description: site.description || '',
    iconUrl: site.iconUrl || '',
    groupName,
    frontendUrlsText: (site.frontendUrls || []).join('\n'),
    backendUrlsText: (site.backendUrls || []).join('\n'),
    order: site.order || 0,
    enable: site.enable !== false,
    target: site.target === '_self' ? '_self' : '_blank'
  })
}

function startCreate() {
  selectedSiteKey.value = ''
  fillForm(null)
}

function selectSite(site: Site) {
  selectedSiteKey.value = site.key
  fillForm(site)
}

function parseUrls(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function handleSave() {
  try {
    const savedKey = navStore.saveSite({
      originalKey: form.originalKey || undefined,
      key: form.key,
      name: form.name,
      description: form.description,
      iconUrl: form.iconUrl,
      groupName: form.groupName,
      frontendUrls: parseUrls(form.frontendUrlsText),
      backendUrls: parseUrls(form.backendUrlsText),
      order: Number(form.order),
      enable: form.enable,
      target: form.target
    })

    selectedSiteKey.value = savedKey || form.originalKey || ''
    if (selectedSite.value) {
      fillForm(selectedSite.value)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败'
  }
}

function handleDelete() {
  if (!form.originalKey) return

  const confirmed = window.confirm(`确认删除站点“${form.name}”吗？`)
  if (!confirmed) return

  navStore.deleteSite(form.originalKey)
  startCreate()
}

function handleResetOverride() {
  const confirmed = window.confirm('确认恢复为服务器原始站点数据吗？本地编辑内容将被清空。')
  if (!confirmed) return

  navStore.resetSitesOverride()
  if (siteList.value[0]) {
    selectSite(siteList.value[0])
  } else {
    startCreate()
  }
}

function closePanel() {
  emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (!open) return

    if (selectedSiteKey.value) {
      const current = siteList.value.find(site => site.key === selectedSiteKey.value)
      if (current) {
        fillForm(current)
        return
      }
    }

    if (siteList.value[0]) {
      selectSite(siteList.value[0])
    } else {
      startCreate()
    }
  },
  { immediate: true }
)

watch(siteList, (sites) => {
  if (!props.open) return

  if (selectedSiteKey.value) {
    const current = sites.find(site => site.key === selectedSiteKey.value)
    if (current) {
      return
    }
  }

  if (sites[0]) {
    selectSite(sites[0])
  } else {
    startCreate()
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
    <div v-if="open" class="editor-overlay" @click="closePanel" />
  </Transition>

  <Transition
    enter-active-class="panel-enter"
    enter-from-class="panel-enter-from"
    enter-to-class="panel-enter-to"
    leave-active-class="panel-leave"
    leave-from-class="panel-leave-from"
    leave-to-class="panel-leave-to"
  >
    <div v-if="open" class="editor-panel">
      <div class="editor-header">
        <div>
          <h2 class="editor-title">站点编辑</h2>
          <p class="editor-subtitle">可直接新增、修改、删除站点，改动保存在当前浏览器。</p>
        </div>
        <button class="icon-btn close-btn" @click="closePanel">
          <X class="icon-sm" />
        </button>
      </div>

      <div class="editor-toolbar">
        <button class="toolbar-btn primary" @click="startCreate">
          <Plus class="icon-sm" />
          新增站点
        </button>
        <button v-if="hasLocalOverride" class="toolbar-btn secondary" @click="handleResetOverride">
          <RotateCcw class="icon-sm" />
          恢复服务器数据
        </button>
      </div>

      <div class="editor-body">
        <aside class="site-list">
          <button
            v-for="site in siteList"
            :key="site.key"
            class="site-list-item"
            :class="{ active: site.key === selectedSiteKey && !isCreating }"
            @click="selectSite(site)"
          >
            <div class="site-list-main">
              <span class="site-list-name">{{ site.name }}</span>
              <span class="site-list-group">
                {{ navStore.siteGroups.find(group => group.key === site.groupKey)?.name || '未分组' }}
              </span>
            </div>
            <Pencil class="icon-xs" />
          </button>
          <div v-if="siteList.length === 0" class="site-list-empty">
            暂无站点，点击“新增站点”开始创建。
          </div>
        </aside>

        <section class="editor-form">
          <div class="form-grid">
            <label class="field">
              <span class="field-label">站点名称</span>
              <input v-model.trim="form.name" class="field-input" type="text" placeholder="例如：GitHub" />
            </label>

            <label class="field">
              <span class="field-label">站点 Key</span>
              <input v-model.trim="form.key" class="field-input" type="text" placeholder="留空时根据名称自动生成" />
            </label>

            <label class="field">
              <span class="field-label">分组名称</span>
              <input
                v-model.trim="form.groupName"
                class="field-input"
                type="text"
                list="site-group-options"
                placeholder="例如：开发工具"
              />
              <datalist id="site-group-options">
                <option v-for="group in groupOptions" :key="group" :value="group" />
              </datalist>
            </label>

            <label class="field">
              <span class="field-label">排序</span>
              <input v-model.number="form.order" class="field-input" type="number" min="0" />
            </label>

            <label class="field field-full">
              <span class="field-label">描述</span>
              <input v-model.trim="form.description" class="field-input" type="text" placeholder="站点说明，可选" />
            </label>

            <label class="field field-full">
              <span class="field-label">图标地址</span>
              <input v-model.trim="form.iconUrl" class="field-input" type="text" placeholder="支持 URL 或 iconlibs 路径" />
            </label>

            <label class="field field-full">
              <span class="field-label">外网链接</span>
              <textarea
                v-model="form.frontendUrlsText"
                class="field-textarea"
                rows="4"
                placeholder="每行一个链接，例如：https://github.com"
              />
            </label>

            <label class="field field-full">
              <span class="field-label">内网链接</span>
              <textarea
                v-model="form.backendUrlsText"
                class="field-textarea"
                rows="4"
                placeholder="每行一个链接，例如：http://192.168.1.10:3000"
              />
            </label>

            <label class="field">
              <span class="field-label">打开方式</span>
              <select v-model="form.target" class="field-input">
                <option value="_blank">新标签页</option>
                <option value="_self">当前页</option>
              </select>
            </label>

            <label class="field toggle-field">
              <span class="field-label">启用站点</span>
              <input v-model="form.enable" class="toggle-input" type="checkbox" />
            </label>
          </div>

          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

          <div class="form-actions">
            <button class="toolbar-btn primary" @click="handleSave">
              <Save class="icon-sm" />
              保存站点
            </button>
            <button v-if="form.originalKey" class="toolbar-btn danger" @click="handleDelete">
              <Trash2 class="icon-sm" />
              删除站点
            </button>
          </div>
        </section>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgb(5 10 20 / 0.6);
  backdrop-filter: blur(8px);
  z-index: 90;
}

.editor-panel {
  position: fixed;
  inset: 4vh 4vw;
  z-index: 91;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(24px) saturate(140%);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.35);
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid hsl(var(--glass-border));
}

.editor-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--text-primary));
}

.editor-subtitle {
  margin: 0.35rem 0 0;
  color: hsl(var(--text-secondary));
  font-size: 0.95rem;
}

.editor-toolbar {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid hsl(var(--glass-border));
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}

.site-list {
  padding: 1rem;
  border-right: 1px solid hsl(var(--glass-border));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.site-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  border: 1px solid hsl(var(--glass-border));
  background: transparent;
  color: hsl(var(--text-primary));
  cursor: pointer;
  transition: all 180ms ease;
  text-align: left;
}

.site-list-item:hover,
.site-list-item.active {
  border-color: hsl(var(--neon-cyan) / 0.45);
  background: hsl(var(--glass-bg-hover));
  box-shadow: 0 0 0 1px hsl(var(--neon-cyan) / 0.15);
}

.site-list-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.site-list-name {
  font-weight: 600;
}

.site-list-group,
.site-list-empty {
  font-size: 0.875rem;
  color: hsl(var(--text-secondary));
}

.editor-form {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-full {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: hsl(var(--text-primary));
}

.field-input,
.field-textarea {
  width: 100%;
  border: 1px solid hsl(var(--glass-border));
  border-radius: 14px;
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  padding: 0.8rem 0.95rem;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.field-input:focus,
.field-textarea:focus {
  border-color: hsl(var(--neon-cyan) / 0.55);
  box-shadow: 0 0 0 3px hsl(var(--neon-cyan) / 0.12);
}

.field-textarea {
  resize: vertical;
  min-height: 104px;
}

.toggle-field {
  justify-content: flex-end;
}

.toggle-input {
  width: 1.1rem;
  height: 1.1rem;
}

.error-text {
  margin: 1rem 0 0;
  color: hsl(var(--danger));
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.toolbar-btn,
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
}

.toolbar-btn:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, hsl(var(--neon-cyan) / 0.18), hsl(var(--neon-blue) / 0.18));
  color: hsl(var(--text-primary));
  border-color: hsl(var(--neon-cyan) / 0.25);
}

.toolbar-btn.secondary,
.icon-btn,
.toolbar-btn.danger {
  background: transparent;
  color: hsl(var(--text-primary));
  border-color: hsl(var(--glass-border));
}

.toolbar-btn.danger {
  color: hsl(var(--danger));
}

.close-btn {
  padding: 0.7rem;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
}

.icon-xs {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
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
  transform: translateY(14px) scale(0.98);
}

@media (max-width: 960px) {
  .editor-panel {
    inset: 1.5vh 1.5vw;
  }

  .editor-body {
    grid-template-columns: 1fr;
  }

  .site-list {
    max-height: 240px;
    border-right: none;
    border-bottom: 1px solid hsl(var(--glass-border));
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
