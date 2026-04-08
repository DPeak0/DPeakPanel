<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useNavStore } from '@/stores/nav'
import { Trash2, Save, X, Sparkles, ImagePlus, LoaderCircle } from 'lucide-vue-next'
import SiteIconLibraryModal from './SiteIconLibraryModal.vue'
import { autoResolveSiteIcon } from '@/utils/siteIcons'
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
const iconStatus = ref('')
const isResolvingIcon = ref(false)
const iconLibraryOpen = ref(false)

const form = reactive({
  originalKey: '',
  key: '',
  name: '',
  description: '',
  iconUrl: '',
  groupSelection: '',
  customGroupName: '',
  frontendUrlsText: '',
  backendUrlsText: '',
  enable: true,
  target: '_blank'
})

const CUSTOM_GROUP_VALUE = '__custom__'

const groupOptions = computed(() => {
  return Array.from(new Set(navStore.siteGroups.map(group => group.name).filter(Boolean)))
})

const resolvedGroupName = computed(() => {
  return form.groupSelection === CUSTOM_GROUP_VALUE
    ? form.customGroupName.trim()
    : form.groupSelection.trim()
})
const currentSite = computed(() => {
  return props.siteKey
    ? navStore.editableSites.find(site => site.key === props.siteKey) || null
    : null
})

const panelTitle = computed(() => props.createMode ? '新增站点' : `编辑站点${currentSite.value ? ` · ${currentSite.value.name}` : ''}`)
const panelSubtitle = computed(() => props.createMode
  ? '填写站点信息后保存，即可立即出现在当前页面。'
  : '修改当前站点信息，保存后会立即刷新展示。'
)

function resetForm() {
  Object.assign(form, {
    originalKey: '',
    key: '',
    name: '',
    description: '',
    iconUrl: '',
    groupSelection: groupOptions.value[0] || CUSTOM_GROUP_VALUE,
    customGroupName: '',
    frontendUrlsText: '',
    backendUrlsText: '',
    enable: true,
    target: '_blank'
  })
  errorMessage.value = ''
  iconStatus.value = ''
}

function fillForm(site: Site | null) {
  if (!site) {
    resetForm()
    return
  }

  const groupName = navStore.siteGroups.find(group => group.key === site.groupKey)?.name || ''
  const matchesExistingGroup = groupOptions.value.includes(groupName)
  errorMessage.value = ''
  Object.assign(form, {
    originalKey: site.key,
    key: site.key,
    name: site.name,
    description: site.description || '',
    iconUrl: site.iconUrl || '',
    groupSelection: matchesExistingGroup ? groupName : CUSTOM_GROUP_VALUE,
    customGroupName: matchesExistingGroup ? '' : groupName,
    frontendUrlsText: (site.frontendUrls || []).join('\n'),
    backendUrlsText: (site.backendUrls || []).join('\n'),
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

function getCandidateSiteUrls() {
  return parseUrls(form.frontendUrlsText).concat(parseUrls(form.backendUrlsText))
}

async function resolveIconAutomatically() {
  const candidateUrls = getCandidateSiteUrls()
  if (candidateUrls.length === 0) {
    throw new Error('请先填写站点链接')
  }

  isResolvingIcon.value = true
  iconStatus.value = '正在自动查找图标...'

  try {
    const result = await autoResolveSiteIcon(candidateUrls)
    form.iconUrl = result.dataUrl
    iconStatus.value = `已自动保存图标：${result.source}`
  } finally {
    isResolvingIcon.value = false
  }
}

async function handleSave() {
  try {
    if (!form.iconUrl.trim()) {
      try {
        await resolveIconAutomatically()
      } catch {
        iconStatus.value = '未自动找到图标，可继续保存或改用图标库'
      }
    }

    navStore.saveSite({
      originalKey: form.originalKey || undefined,
      key: form.key,
      name: form.name,
      description: form.description,
      iconUrl: form.iconUrl,
      groupName: resolvedGroupName.value,
      frontendUrls: parseUrls(form.frontendUrlsText),
      backendUrls: parseUrls(form.backendUrlsText),
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

async function handleAutoIcon() {
  errorMessage.value = ''

  try {
    await resolveIconAutomatically()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '自动获取图标失败'
  }
}

function handleIconLibrarySelect(dataUrl: string) {
  form.iconUrl = dataUrl
  iconStatus.value = '已从图标库保存到本地'
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
          <label class="field field-full">
            <span class="field-label">站点名称</span>
            <input v-model.trim="form.name" class="field-input" type="text" placeholder="例如：GitHub" />
          </label>

          <label class="field">
            <span class="field-label">分组</span>
            <select v-model="form.groupSelection" class="field-input">
              <option v-for="group in groupOptions" :key="group" :value="group">{{ group }}</option>
              <option :value="CUSTOM_GROUP_VALUE">新建分组</option>
            </select>
          </label>

          <label class="field field-full">
            <span class="field-label">描述</span>
            <input v-model.trim="form.description" class="field-input" type="text" placeholder="站点说明，可选" />
          </label>

          <label v-if="form.groupSelection === CUSTOM_GROUP_VALUE" class="field field-full">
            <span class="field-label">新分组名称</span>
            <input
              v-model.trim="form.customGroupName"
              class="field-input"
              type="text"
              placeholder="例如：开发工具"
            />
          </label>

          <label class="field field-full">
            <span class="field-label">图标地址</span>
            <div class="icon-actions">
              <input
                v-model.trim="form.iconUrl"
                class="field-input"
                type="text"
                placeholder="支持 data URL、远程 URL 或自动识别结果"
              />
              <button class="mini-action" :disabled="isResolvingIcon" @click="handleAutoIcon">
                <LoaderCircle v-if="isResolvingIcon" class="icon-sm spin" />
                <Sparkles v-else class="icon-sm" />
                自动获取
              </button>
              <button class="mini-action" @click="iconLibraryOpen = true">
                <ImagePlus class="icon-sm" />
                图标库
              </button>
            </div>
            <div class="icon-preview-row">
              <div class="icon-preview-box">
                <img v-if="form.iconUrl" :src="form.iconUrl" alt="icon preview" class="icon-preview-image" />
                <span v-else class="icon-preview-placeholder">无图标</span>
              </div>
              <button v-if="form.iconUrl" class="clear-link" @click="form.iconUrl = ''">清空图标</button>
            </div>
            <p v-if="iconStatus" class="helper-text">{{ iconStatus }}</p>
          </label>

          <label class="field field-full">
            <span class="field-label">外网链接</span>
            <textarea
              v-model="form.frontendUrlsText"
              class="field-textarea"
              rows="3"
              placeholder="每行一个链接，例如：https://github.com"
            />
            <p class="helper-text">支持输入多条链接，按回车换行，可拖动右下角调整输入框高度。</p>
          </label>

          <label class="field field-full">
            <span class="field-label">内网链接</span>
            <textarea
              v-model="form.backendUrlsText"
              class="field-textarea"
              rows="3"
              placeholder="每行一个链接，例如：http://192.168.1.10:3000"
            />
            <p class="helper-text">支持输入多条链接，按回车换行，可拖动右下角调整输入框高度。</p>
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

  <SiteIconLibraryModal
    :open="iconLibraryOpen"
    @close="iconLibraryOpen = false"
    @select="handleIconLibrarySelect"
  />
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
  width: min(680px, calc(100vw - 1.5rem));
  max-height: min(84vh, 760px);
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
  padding: 1rem 1.2rem 0.85rem;
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
  font-size: 0.88rem;
}

.editor-form {
  padding: 1rem 1.2rem 1.2rem;
  overflow-y: auto;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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

.icon-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.75rem;
}

.mini-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid hsl(var(--glass-border));
  border-radius: 999px;
  background: transparent;
  color: hsl(var(--text-primary));
  padding: 0.8rem 0.95rem;
  cursor: pointer;
  white-space: nowrap;
}

.mini-action:disabled {
  opacity: 0.7;
  cursor: wait;
}

.icon-preview-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.icon-preview-box {
  width: 3rem;
  height: 3rem;
  border-radius: 14px;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.icon-preview-image {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.icon-preview-placeholder,
.helper-text,
.clear-link {
  font-size: 0.85rem;
}

.helper-text {
  margin: 0.5rem 0 0;
  color: hsl(var(--text-secondary));
}

.clear-link {
  border: none;
  background: transparent;
  color: hsl(var(--warning));
  cursor: pointer;
  padding: 0;
}

.field-input:focus,
.field-textarea:focus {
  border-color: hsl(var(--neon-cyan) / 0.55);
  box-shadow: 0 0 0 3px hsl(var(--neon-cyan) / 0.12);
}

.field-textarea {
  resize: vertical;
  min-height: 88px;
  max-height: 260px;
}

.toggle-field {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
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
  margin-top: 1rem;
  justify-content: flex-end;
  flex-wrap: wrap;
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

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

  .icon-actions {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
