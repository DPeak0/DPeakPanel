<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import { Trash2, Save, X } from 'lucide-vue-next'
import type { Site } from '@/types'

const props = withDefaults(defineProps<{
  open: boolean
  siteKey?: string | null
  createMode?: boolean
}>(), {
  siteKey: null,
  createMode: false
})

const emit = defineEmits<{
  close: []
}>()

const navStore = useNavStore()
const errorMessage = ref('')

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

const groupOptions = computed(() => navStore.siteGroups.map(group => group.name))
const currentSite = computed(() => {
  return props.siteKey
    ? navStore.editableSites.find(site => site.key === props.siteKey) || null
    : null
})

const panelTitle = computed(() => props.createMode ? '新增站点' : `编辑站点${currentSite.value ? ` · ${currentSite.value.name}` : ''}`)
const panelSubtitle = computed(() => props.createMode
  ? '填写站点信息后保存，即可立即出现在当前页面。'
  : '修改当前站点卡片的信息，保存后会立即刷新展示。'
)

function getNextOrder() {
  return navStore.editableSites.reduce((max, site) => Math.max(max, site.order || 0), 0) + 1
}

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

function fillForm(site: Site | null) {
  if (!site) {
    resetForm()
    return
  }

  const groupName = navStore.siteGroups.find(group => group.key === site.groupKey)?.name || ''
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

function parseUrls(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function closePanel() {
  emit('close')
}

function handleSave() {
  try {
    navStore.saveSite({
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
    closePanel()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败'
  }
}

function handleDelete() {
  if (!form.originalKey) return

  const confirmed = window.confirm(`确认删除站点“${form.name}”吗？`)
  if (!confirmed) return

  navStore.deleteSite(form.originalKey)
  closePanel()
}

watch(
  () => [props.open, props.siteKey, props.createMode, navStore.siteGroups.length] as const,
  ([open]) => {
    if (!open) return
    if (props.createMode) {
      resetForm()
      return
    }
    fillForm(currentSite.value)
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
          <h2 class="editor-title">{{ panelTitle }}</h2>
          <p class="editor-subtitle">{{ panelSubtitle }}</p>
        </div>
        <button class="icon-btn close-btn" @click="closePanel">
          <X class="icon-sm" />
        </button>
      </div>

      <div class="editor-form">
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
          <button class="action-btn primary" @click="handleSave">
            <Save class="icon-sm" />
            保存站点
          </button>
          <button v-if="form.originalKey" class="action-btn danger" @click="handleDelete">
            <Trash2 class="icon-sm" />
            删除站点
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgb(5 10 20 / 0.62);
  backdrop-filter: blur(8px);
  z-index: 90;
}

.editor-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 91;
  width: min(860px, calc(100vw - 2rem));
  max-height: min(88vh, 860px);
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

.editor-form {
  padding: 1.25rem 1.5rem 1.5rem;
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

.action-btn,
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

.action-btn:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

.action-btn.primary {
  background: linear-gradient(135deg, hsl(var(--neon-cyan) / 0.18), hsl(var(--neon-blue) / 0.18));
  color: hsl(var(--text-primary));
  border-color: hsl(var(--neon-cyan) / 0.25);
}

.action-btn.danger,
.icon-btn {
  background: transparent;
  color: hsl(var(--text-primary));
  border-color: hsl(var(--glass-border));
}

.action-btn.danger {
  color: hsl(var(--danger));
}

.close-btn {
  padding: 0.7rem;
}

.icon-sm {
  width: 1rem;
  height: 1rem;
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
  transform: translate(-50%, calc(-50% + 14px)) scale(0.98);
}

@media (max-width: 720px) {
  .editor-panel {
    width: calc(100vw - 1rem);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
