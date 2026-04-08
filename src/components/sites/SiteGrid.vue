<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useNavStore } from '@/stores/nav'
import { useConfigStore } from '@/stores/config'
import SiteCard from './SiteCard.vue'
import SiteEditorPanel from './SiteEditorPanel.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import GroupDropdown from '@/components/common/GroupDropdown.vue'
import NetworkModeDropdown from '@/components/common/NetworkModeDropdown.vue'
import LayoutSwitcher from '@/components/common/LayoutSwitcher.vue'
import { Pencil, Plus, Check } from 'lucide-vue-next'
import type { Site, Group } from '@/types'

const navStore = useNavStore()
const configStore = useConfigStore()
const { searchKeywords } = storeToRefs(configStore)
const editMode = ref(false)
const siteEditorOpen = ref(false)
const editorCreateMode = ref(false)
const editingSiteKey = ref<string | null>(null)
const dragPreviewEl = ref<HTMLElement | null>(null)
const transparentDragImage = ref<HTMLCanvasElement | null>(null)
const dragState = ref<{
  siteKey: string
  sourceGroupKey: string
  targetGroupKey: string | null
  targetSiteKey: string | null
  position: 'before' | 'after' | 'end'
  previewEnabled: boolean
} | null>(null)

type PreviewSiteEntry = {
  site: Site
  previewGhost?: boolean
}

// 搜索关键字
const searchKeyword = computed({
  get: () => searchKeywords.value.sites,
  set: (val: string) => {
    searchKeywords.value.sites = val
  }
})

// 搜索过滤函数
function matchSearch(site: Site, keyword: string): boolean {
  if (!keyword) return true
  const kw = keyword.toLowerCase()
  
  // 匹配名称
  if (site.name.toLowerCase().includes(kw)) return true
  
  // 匹配描述
  if (site.description?.toLowerCase().includes(kw)) return true
  
  // 匹配外网链接
  if (site.frontendUrls?.some(url => url.toLowerCase().includes(kw))) return true
  
  // 匹配内网链接
  if (site.backendUrls?.some(url => url.toLowerCase().includes(kw))) return true
  
  return false
}

// 筛选后的站点列表（用于多选分组模式）
const filteredSites = computed(() => {
  let sites = navStore.allSites
  
  // 按分组筛选（支持多选）
  const selectedGroups = configStore.currentGroupArray
  if (selectedGroups.length > 0) {
    sites = sites.filter((s: Site) => s.groupKey && selectedGroups.includes(s.groupKey))
  }
  
  // 按搜索关键字筛选
  const kw = searchKeyword.value
  if (kw) {
    sites = sites.filter((s: Site) => matchSearch(s, kw))
  }
  
  return sites
})

// 按分组组织的站点（用于全部模式或多选分组模式）
const groupedSites = computed(() => {
  const result: { group: Group; sites: Site[] }[] = []
  const allSites = navStore.allSites
  const kw = searchKeyword.value
  const selectedGroups = configStore.currentGroupArray
  
  // 确定要显示的分组
  const groupsToShow = selectedGroups.length > 0
    ? navStore.siteGroups.filter((g: Group) => selectedGroups.includes(g.key))
    : navStore.siteGroups
  
  for (const group of groupsToShow) {
    let sites = allSites.filter((s: Site) => s.groupKey === group.key)
    // 按搜索关键字筛选
    if (kw) {
      sites = sites.filter((s: Site) => matchSearch(s, kw))
    }
    if (sites.length > 0) {
      result.push({ group, sites })
    }
  }
  
  return result
})

// 分组列表（只显示有站点的分组，并统计数量）
const groups = computed(() => {
  const allSites = navStore.allSites
  const groupsWithCount = navStore.siteGroups
    .map((g: Group) => {
      const count = allSites.filter((s: Site) => s.groupKey === g.key).length
      return { ...g, count }
    })
    .filter(g => g.count > 0)
  return [
    { key: 'all', name: '全部', icon: '', count: allSites.length },
    ...groupsWithCount
  ]
})

// 监听分组列表变化，如果当前分组不存在则自动切换到全部
watch(groups, (newGroups) => {
  const currentGroup = configStore.currentGroup
  if (currentGroup !== 'all') {
    const exists = newGroups.some(g => g.key === currentGroup)
    if (!exists) {
      configStore.resetCurrentTabGroup()
    }
  }
}, { immediate: true })

// 网格类名（根据布局模式）
const gridClass = computed(() => {
  const layout = configStore.layout
  switch (layout) {
    case 'compact':
      return 'site-grid compact'
    case 'large':
      return 'site-grid large'
    case 'list':
      return 'site-grid list'
    case 'minimal':
      return 'site-grid minimal'
    default: // normal
      return 'site-grid normal'
  }
})

function openSiteEditor(siteKey?: string) {
  editingSiteKey.value = siteKey || null
  editorCreateMode.value = !siteKey
  siteEditorOpen.value = true
}

function closeSiteEditor() {
  siteEditorOpen.value = false
  editingSiteKey.value = null
  editorCreateMode.value = false
}

function toggleEditMode() {
  editMode.value = !editMode.value
  if (!editMode.value) {
    closeSiteEditor()
  }
}

function openCreateSiteEditor() {
  openSiteEditor()
}

function handleSiteCardEdit(site: Site) {
  if (!editMode.value) return
  openSiteEditor(site.key)
}

function cleanupDragPreview() {
  if (dragPreviewEl.value?.parentNode) {
    dragPreviewEl.value.parentNode.removeChild(dragPreviewEl.value)
  }
  dragPreviewEl.value = null
}

function createDragPreview(source: HTMLElement) {
  cleanupDragPreview()

  const preview = source.cloneNode(true) as HTMLElement
  preview.classList.add('drag-preview-ghost')
  preview.style.width = `${source.offsetWidth}px`
  preview.style.position = 'fixed'
  preview.style.top = '-1000px'
  preview.style.left = '-1000px'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '9999'
  document.body.appendChild(preview)
  dragPreviewEl.value = preview
  return preview
}

function getTransparentDragImage() {
  if (!transparentDragImage.value) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    transparentDragImage.value = canvas
  }
  return transparentDragImage.value
}

function handleDragStart(event: DragEvent, site: Site) {
  if (!editMode.value) return

  dragState.value = {
    siteKey: site.key,
    sourceGroupKey: site.groupKey || '',
    targetGroupKey: site.groupKey || '',
    targetSiteKey: null,
    position: 'end',
    previewEnabled: false
  }

  const source = event.currentTarget as HTMLElement | null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', site.key)
  }

  if (source && event.dataTransfer) {
    createDragPreview(source)
    event.dataTransfer.setDragImage(getTransparentDragImage(), 0, 0)
  }
}

function handleDragEnd() {
  dragState.value = null
  cleanupDragPreview()
}

function handleGroupDragOver(event: DragEvent, groupKey: string) {
  if (!dragState.value) return
  event.preventDefault()
  dragState.value.previewEnabled = true
  dragState.value.targetGroupKey = groupKey
  dragState.value.targetSiteKey = null
  dragState.value.position = 'end'
}

function handleSiteDragOver(event: DragEvent, site: Site) {
  if (!dragState.value) return
  if (dragState.value.siteKey === site.key) return
  event.preventDefault()
  dragState.value.previewEnabled = true

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const before = event.clientY < rect.top + rect.height / 2

  dragState.value.targetGroupKey = site.groupKey || ''
  dragState.value.targetSiteKey = site.key
  dragState.value.position = before ? 'before' : 'after'
}

function handleDrop() {
  if (!dragState.value || !dragState.value.targetGroupKey) return

  navStore.moveSite(
    dragState.value.siteKey,
    dragState.value.targetGroupKey,
    dragState.value.targetSiteKey || undefined,
    dragState.value.position
  )

  dragState.value = null
}

function isDropTarget(groupKey: string, siteKey?: string) {
  if (!dragState.value) return false
  if (siteKey) {
    return dragState.value.targetGroupKey === groupKey && dragState.value.targetSiteKey === siteKey
  }
  return dragState.value.targetGroupKey === groupKey && !dragState.value.targetSiteKey
}

function buildPreviewEntries(sites: Site[], currentGroupKey?: string) {
  const entries: PreviewSiteEntry[] = sites.map(site => ({ site }))

  if (!editMode.value || !dragState.value?.targetGroupKey || !dragState.value.previewEnabled) {
    return entries
  }

  const movingSite = navStore.allSites.find(site => site.key === dragState.value?.siteKey)
  if (!movingSite) {
    return entries
  }

  const visibleEntries = entries.filter(entry => entry.site.key !== movingSite.key)
  const previewGroupKey = dragState.value.targetGroupKey

  if (currentGroupKey && previewGroupKey !== currentGroupKey) {
    return visibleEntries
  }

  let insertIndex = visibleEntries.length
  if (dragState.value.targetSiteKey) {
    const targetIndex = visibleEntries.findIndex(entry => entry.site.key === dragState.value?.targetSiteKey)
    if (targetIndex >= 0) {
      insertIndex = dragState.value.position === 'after' ? targetIndex + 1 : targetIndex
    }
  }

  const previewSite: Site = {
    ...movingSite,
    groupKey: previewGroupKey
  }

  visibleEntries.splice(insertIndex, 0, {
    site: previewSite,
    previewGhost: true
  })

  return visibleEntries
}

const previewGroupedSites = computed(() => {
  return groupedSites.value
    .map(item => ({
      group: item.group,
      sites: buildPreviewEntries(item.sites, item.group.key)
    }))
    .filter(item => item.sites.length > 0)
})

const previewFilteredSites = computed(() => {
  const selectedGroupKey = configStore.currentGroupArray[0]
  return buildPreviewEntries(filteredSites.value, selectedGroupKey)
})

onBeforeUnmount(() => {
  cleanupDragPreview()
})

</script>

<template>
  <div class="site-section">
    <!-- 分组筛选 -->
    <div class="filter-bar">
      <SearchBox
        v-model="searchKeyword"
        placeholder="搜索站点..."
        color="cyan"
      />
      <div class="filter-bar-right">
        <button class="site-editor-btn" :class="{ active: editMode }" @click="toggleEditMode">
          <Check v-if="editMode" class="toolbar-icon" />
          <Pencil class="toolbar-icon" />
          {{ editMode ? '完成编辑' : '编辑' }}
        </button>
        <button v-if="editMode" class="site-editor-btn secondary" @click="openCreateSiteEditor">
          <Plus class="toolbar-icon" />
          新增站点
        </button>
        <GroupDropdown
          :groups="groups"
          :current="configStore.currentGroup"
          color="cyan"
          @change="configStore.setCurrentGroup"
          @toggle="configStore.toggleGroup"
        />
        <NetworkModeDropdown />
        <LayoutSwitcher />
      </div>
    </div>

    <!-- 全部模式或多选分组模式：按分组显示 -->
    <template v-if="configStore.isAllSelected || configStore.currentGroupArray.length > 1">
      <div 
        v-for="(item, index) in previewGroupedSites" 
        :key="item.group.key" 
        class="group-section"
        :class="{ 'has-margin': index < previewGroupedSites.length - 1 }"
      >
        <!-- 分组标题 -->
        <h3 class="group-title">{{ item.group.name }}</h3>
        <!-- 站点网格 -->
        <TransitionGroup
          name="site-reorder"
          tag="div"
          :class="[gridClass, { 'group-drop-target': editMode && isDropTarget(item.group.key) }]"
          @dragover="handleGroupDragOver($event, item.group.key)"
          @drop.prevent="handleDrop"
        >
          <div
            v-for="entry in item.sites"
            :key="entry.previewGhost ? `${entry.site.key}__ghost` : entry.site.key"
            class="site-card-wrap"
            :class="{
              'preview-ghost': entry.previewGhost,
              editable: editMode
            }"
            :draggable="editMode && !entry.previewGhost"
            @dragstart="handleDragStart($event, entry.site)"
            @dragend="handleDragEnd"
            @dragover="handleSiteDragOver($event, entry.site)"
            @drop.prevent="handleDrop"
          >
            <SiteCard
              :site="entry.site"
              :editable="editMode"
              @edit="handleSiteCardEdit(entry.site)"
            />
          </div>
        </TransitionGroup>
      </div>
      <!-- 空状态 -->
      <div v-if="previewGroupedSites.length === 0" class="empty-state">
        <div class="empty-icon">
          <span>📂</span>
        </div>
        <p class="empty-text">暂无站点</p>
      </div>
    </template>

    <!-- 单个分组模式（只选了一个分组） -->
    <template v-else>
      <!-- 站点网格 -->
      <TransitionGroup
        name="site-reorder"
        tag="div"
        :class="[gridClass, { 'group-drop-target': editMode && configStore.currentGroupArray.length === 1 && isDropTarget(configStore.currentGroupArray[0]) }]"
        @dragover="handleGroupDragOver($event, configStore.currentGroupArray[0])"
        @drop.prevent="handleDrop"
      >
        <div
          v-for="entry in previewFilteredSites"
          :key="entry.previewGhost ? `${entry.site.key}__ghost` : entry.site.key"
          class="site-card-wrap"
          :class="{
            'preview-ghost': entry.previewGhost,
            editable: editMode
          }"
          :draggable="editMode && !entry.previewGhost"
          @dragstart="handleDragStart($event, entry.site)"
          @dragend="handleDragEnd"
          @dragover="handleSiteDragOver($event, entry.site)"
          @drop.prevent="handleDrop"
        >
          <SiteCard
            :site="entry.site"
            :editable="editMode"
            @edit="handleSiteCardEdit(entry.site)"
          />
        </div>
      </TransitionGroup>
      <!-- 空状态 -->
      <div v-if="filteredSites.length === 0" class="empty-state">
        <div class="empty-icon">
          <span>📂</span>
        </div>
        <p class="empty-text">暂无站点</p>
      </div>
    </template>

    <SiteEditorPanel
      :open="siteEditorOpen"
      :site-key="editingSiteKey"
      :create-mode="editorCreateMode"
      @close="closeSiteEditor"
    />
  </div>
</template>

<style scoped>
.site-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  min-width: 0;
}

.filter-bar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.site-editor-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 0.95rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--glass-border));
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  white-space: nowrap;
}

.site-editor-btn {
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.site-editor-btn.active {
  border-color: hsl(var(--neon-cyan) / 0.5);
  background: linear-gradient(135deg, hsl(var(--neon-cyan) / 0.18), hsl(var(--neon-blue) / 0.18));
}

.site-editor-btn.secondary {
  background: transparent;
}

.site-editor-btn:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--neon-cyan) / 0.35);
  box-shadow: 0 0 0 3px hsl(var(--neon-cyan) / 0.08);
}

.toolbar-icon {
  width: 0.95rem;
  height: 0.95rem;
}

.site-card-wrap {
  position: relative;
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 220ms ease;
  will-change: transform, opacity;
}

.site-card-wrap.editable {
  cursor: grab;
  user-select: none;
}

.site-card-wrap.editable:active {
  cursor: grabbing;
}

.site-card-wrap.preview-ghost {
  z-index: 3;
  pointer-events: none;
  transform: scale(1.015);
}

.site-card-wrap.preview-ghost :deep(.cyber-card) {
  opacity: 0.72;
  border-style: dashed;
  border-color: hsl(var(--neon-cyan) / 0.38);
  box-shadow:
    0 18px 40px rgb(0 0 0 / 0.28),
    0 0 0 1px hsl(var(--neon-cyan) / 0.2),
    0 0 24px hsl(var(--neon-cyan) / 0.16);
  background: linear-gradient(
      135deg,
      hsl(var(--neon-cyan) / 0.12),
      hsl(var(--neon-blue) / 0.08)
    ),
    hsl(var(--site-card-bg));
}

.site-card-wrap.preview-ghost :deep(.card-edit-badge) {
  opacity: 0.65;
}

.site-reorder-move {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.site-reorder-enter-active,
.site-reorder-leave-active {
  transition:
    transform 220ms ease,
    opacity 220ms ease;
}

.site-reorder-enter-from,
.site-reorder-leave-to {
  opacity: 0.35;
  transform: scale(0.96);
}

.group-drop-target {
  position: relative;
}

.group-drop-target::after {
  content: '';
  position: absolute;
  inset: -0.35rem;
  border-radius: 20px;
  border: 1px dashed hsl(var(--neon-cyan) / 0.45);
  background: hsl(var(--neon-cyan) / 0.04);
  box-shadow: inset 0 0 0 1px hsl(var(--neon-cyan) / 0.08);
  pointer-events: none;
  animation: dropZonePulse 1.1s ease-in-out infinite;
}

.drag-preview-ghost {
  opacity: 1;
  transform: rotate(2.8deg) scale(1.02);
  filter: drop-shadow(0 18px 36px rgb(0 0 0 / 0.32));
}

.drag-preview-ghost::before,
.drag-preview-ghost::after {
  pointer-events: none;
}

.drag-preview-ghost :deep(.cyber-card) {
  box-shadow:
    0 22px 54px rgb(0 0 0 / 0.34),
    0 0 0 1px hsl(var(--neon-cyan) / 0.22);
  border-color: hsl(var(--neon-cyan) / 0.3);
}

@keyframes dropZonePulse {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .filter-bar :deep(.search-box) {
    max-width: none;
    width: 100%;
  }
  
  .filter-bar-right {
    flex-wrap: wrap;
    justify-content: space-evenly;
    gap: 0.5rem;
  }
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-section.has-margin {
  margin-bottom: 1rem;
}

@media (max-width: 480px) {
  .group-section {
    gap: 0.5rem;
  }
  
  .group-section.has-margin {
    margin-bottom: 0.5rem;
  }
}

.group-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--text-secondary));
}

/* 深色主题分组标题 - 提高亮度增强可读性 */
[data-theme="dark"] .group-title {
  color: hsl(210 40% 85%);
}

/* 素描深色主题分组标题 */
[data-theme="sketch-dark"] .group-title {
  color: hsl(40 12% 80%);
}

/* 网格布局 */
.site-grid {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

/* Normal 布局 - 使用 auto-fill 实现更流畅的响应式 */
.site-grid.normal {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

/* Compact 布局 - 超紧凑横向条 */
.site-grid.compact {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: clamp(0.375rem, 1.5vw, 0.5rem);
}

/* Large 布局（保留向后兼容）*/
.site-grid.large {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

/* List 布局 */
.site-grid.list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 大屏幕下列表模式使用双列 */
@media (min-width: 1400px) {
  .site-grid.list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem 1.5rem;
  }
}

/* Minimal 布局 - 纯图标网格，类似 Dock/Launcher */
.site-grid.minimal {
  grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
  gap: 1.25rem;
  justify-items: center;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 4rem 0;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon span {
  font-size: 1.875rem;
}

.empty-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
}

/* 浅色主题适配 */
[data-theme="light"] .empty-icon {
  background: rgba(0, 0, 0, 0.04);
}

[data-theme="light"] .empty-text {
  color: rgba(0, 0, 0, 0.45);
}

/* 素描浅色主题适配 */
[data-theme="sketch-light"] .empty-icon {
  background: rgba(0, 0, 0, 0.05);
}

[data-theme="sketch-light"] .empty-text {
  color: rgba(100, 110, 120, 0.5);
}
</style>
