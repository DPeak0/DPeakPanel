<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { VueDraggable } from 'vue-draggable-plus'
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

type DraggableGroup = {
  group: Group
  sites: Site[]
}

type SortEventLike = {
  item?: HTMLElement
}

const navStore = useNavStore()
const configStore = useConfigStore()
const { searchKeywords } = storeToRefs(configStore)

const editMode = ref(false)
const siteEditorOpen = ref(false)
const editorCreateMode = ref(false)
const editingSiteKey = ref<string | null>(null)
const isSorting = ref(false)
const draggingSiteKey = ref<string | null>(null)
const draggableGroupedSites = ref<DraggableGroup[]>([])
const draggableSingleSites = ref<Site[]>([])

function cloneSite(site: Site): Site {
  return {
    ...site,
    frontendUrls: [...(site.frontendUrls || [])],
    backendUrls: [...(site.backendUrls || [])]
  }
}

const searchKeyword = computed({
  get: () => searchKeywords.value.sites,
  set: (val: string) => {
    searchKeywords.value.sites = val
  }
})

function matchSearch(site: Site, keyword: string): boolean {
  if (!keyword) return true
  const kw = keyword.toLowerCase()

  if (site.name.toLowerCase().includes(kw)) return true
  if (site.description?.toLowerCase().includes(kw)) return true
  if (site.frontendUrls?.some(url => url.toLowerCase().includes(kw))) return true
  if (site.backendUrls?.some(url => url.toLowerCase().includes(kw))) return true

  return false
}

const filteredSites = computed(() => {
  let sites = navStore.allSites
  const selectedGroups = configStore.currentGroupArray

  if (selectedGroups.length > 0) {
    sites = sites.filter((site: Site) => site.groupKey && selectedGroups.includes(site.groupKey))
  }

  const kw = searchKeyword.value
  if (kw) {
    sites = sites.filter((site: Site) => matchSearch(site, kw))
  }

  return sites
})

const groupedSites = computed(() => {
  const result: DraggableGroup[] = []
  const allSites = navStore.allSites
  const kw = searchKeyword.value
  const selectedGroups = configStore.currentGroupArray
  const groupsToShow = selectedGroups.length > 0
    ? navStore.siteGroups.filter((group: Group) => selectedGroups.includes(group.key))
    : navStore.siteGroups

  for (const group of groupsToShow) {
    let sites = allSites.filter((site: Site) => site.groupKey === group.key)

    if (kw) {
      sites = sites.filter((site: Site) => matchSearch(site, kw))
    }

    if (sites.length > 0 || (editMode.value && !kw)) {
      result.push({ group, sites })
    }
  }

  return result
})

const groups = computed(() => {
  const allSites = navStore.allSites
  const groupsWithCount = navStore.siteGroups
    .map((group: Group) => {
      const count = allSites.filter((site: Site) => site.groupKey === group.key).length
      return { ...group, count }
    })
    .filter(group => group.count > 0)

  return [
    { key: 'all', name: '全部', icon: '', count: allSites.length },
    ...groupsWithCount
  ]
})

watch(groups, (newGroups) => {
  const currentGroup = configStore.currentGroup
  if (currentGroup !== 'all' && !Array.isArray(currentGroup)) {
    const exists = newGroups.some(group => group.key === currentGroup)
    if (!exists) {
      configStore.resetCurrentTabGroup()
    }
  }
}, { immediate: true })

const gridClass = computed(() => {
  switch (configStore.layout) {
    case 'compact':
      return 'site-grid compact'
    case 'large':
      return 'site-grid large'
    case 'list':
      return 'site-grid list'
    case 'minimal':
      return 'site-grid minimal'
    default:
      return 'site-grid normal'
  }
})

const showGroupedView = computed(() => configStore.isAllSelected || configStore.currentGroupArray.length > 1)
const canSortSites = computed(() => editMode.value && searchKeyword.value.trim().length === 0)
const emptyStateText = computed(() => searchKeyword.value.trim() ? '未找到匹配的站点' : '暂无站点')
const sortGroupOptions = computed(() => ({
  name: 'site-cards',
  pull: canSortSites.value,
  put: canSortSites.value
}))

function syncDraggableSites() {
  if (isSorting.value) return

  if (showGroupedView.value) {
    draggableGroupedSites.value = groupedSites.value.map(item => ({
      group: { ...item.group },
      sites: item.sites.map(cloneSite)
    }))
    return
  }

  draggableSingleSites.value = filteredSites.value.map(cloneSite)
}

watch(
  [showGroupedView, groupedSites, filteredSites],
  syncDraggableSites,
  { immediate: true, deep: true }
)

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
    isSorting.value = false
    draggingSiteKey.value = null
    closeSiteEditor()
    syncDraggableSites()
  }
}

function openCreateSiteEditor() {
  openSiteEditor()
}

function handleSiteCardEdit(site: Site) {
  if (!editMode.value) return
  openSiteEditor(site.key)
}

function persistVisibleSort() {
  if (!canSortSites.value) return

  if (showGroupedView.value) {
    navStore.reorderVisibleSites(
      draggableGroupedSites.value.map(item => ({
        groupKey: item.group.key,
        sites: item.sites.map(cloneSite)
      }))
    )
    return
  }

  const activeGroupKey = configStore.currentGroupArray[0]
  if (!activeGroupKey) return

  navStore.reorderVisibleSites([
    {
      groupKey: activeGroupKey,
      sites: draggableSingleSites.value.map(cloneSite)
    }
  ])
}

function handleSortStart(event: SortEventLike) {
  if (!canSortSites.value) return
  isSorting.value = true
  draggingSiteKey.value = event.item?.dataset.siteKey || null
}

function handleSortEnd() {
  if (canSortSites.value) {
    persistVisibleSort()
  }

  draggingSiteKey.value = null
  window.setTimeout(() => {
    isSorting.value = false
  }, 0)
}
</script>

<template>
  <div class="site-section">
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

    <div v-if="editMode && !canSortSites" class="sort-lock-hint">
      搜索结果中已禁用拖拽排序，请先清空搜索关键词再调整卡片顺序。
    </div>

    <template v-if="showGroupedView">
      <div
        v-for="(item, index) in draggableGroupedSites"
        :key="item.group.key"
        class="group-section"
        :class="{ 'has-margin': index < draggableGroupedSites.length - 1 }"
      >
        <h3 class="group-title">{{ item.group.name }}</h3>
        <VueDraggable
          v-model="item.sites"
          item-key="key"
          :animation="220"
          :disabled="!canSortSites"
          :group="sortGroupOptions"
          ghost-class="site-sort-ghost"
          chosen-class="site-sort-chosen"
          drag-class="site-sort-drag"
          class="draggable-site-grid"
          :class="[gridClass, { 'drag-enabled': canSortSites, 'sorting-active': isSorting }]"
          @start="handleSortStart"
          @end="handleSortEnd"
        >
          <div
            v-for="site in item.sites"
            :key="site.key"
            class="site-card-wrap"
            :class="{ editable: editMode, 'is-dragging': draggingSiteKey === site.key }"
            :data-site-key="site.key"
          >
            <SiteCard
              :site="site"
              :editable="editMode"
              @edit="handleSiteCardEdit(site)"
            />
          </div>
          <div v-if="item.sites.length === 0" class="group-empty-dropzone">
            拖动站点到这里
          </div>
        </VueDraggable>
      </div>

      <div v-if="draggableGroupedSites.length === 0" class="empty-state">
        <div class="empty-icon">
          <span>📂</span>
        </div>
        <p class="empty-text">{{ emptyStateText }}</p>
      </div>
    </template>

    <template v-else>
      <VueDraggable
        v-model="draggableSingleSites"
        item-key="key"
        :animation="220"
        :disabled="!canSortSites"
        :group="sortGroupOptions"
        ghost-class="site-sort-ghost"
        chosen-class="site-sort-chosen"
        drag-class="site-sort-drag"
        class="draggable-site-grid"
        :class="[gridClass, { 'drag-enabled': canSortSites, 'sorting-active': isSorting }]"
        @start="handleSortStart"
        @end="handleSortEnd"
      >
        <div
          v-for="site in draggableSingleSites"
          :key="site.key"
          class="site-card-wrap"
          :class="{ editable: editMode, 'is-dragging': draggingSiteKey === site.key }"
          :data-site-key="site.key"
        >
          <SiteCard
            :site="site"
            :editable="editMode"
            @edit="handleSiteCardEdit(site)"
          />
        </div>
      </VueDraggable>

      <div v-if="draggableSingleSites.length === 0" class="empty-state">
        <div class="empty-icon">
          <span>📂</span>
        </div>
        <p class="empty-text">{{ emptyStateText }}</p>
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

.sort-lock-hint {
  padding: 0.75rem 0.9rem;
  border-radius: 1rem;
  border: 1px dashed hsl(var(--neon-cyan) / 0.28);
  background: hsl(var(--glass-bg) / 0.78);
  color: hsl(var(--text-secondary));
  font-size: 0.875rem;
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-section.has-margin {
  margin-bottom: 1rem;
}

.group-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--text-secondary));
}

[data-theme='dark'] .group-title {
  color: hsl(210 40% 85%);
}

[data-theme='sketch-dark'] .group-title {
  color: hsl(40 12% 80%);
}

.draggable-site-grid {
  min-height: 1px;
}

.drag-enabled .site-card-wrap {
  cursor: grab;
  user-select: none;
}

.drag-enabled .site-card-wrap:active {
  cursor: grabbing;
}

.site-card-wrap {
  position: relative;
  transition: filter 180ms ease, opacity 180ms ease;
}

.site-card-wrap.editable {
  touch-action: none;
}

.site-card-wrap.is-dragging {
  z-index: 9;
}

.site-sort-ghost {
  opacity: 0.22;
}

.site-sort-ghost :deep(.cyber-card) {
  border-style: dashed;
  border-color: hsl(var(--neon-cyan) / 0.25);
  box-shadow: inset 0 0 0 1px hsl(var(--neon-cyan) / 0.16);
}

.site-sort-chosen {
  z-index: 12;
}

.site-sort-chosen :deep(.cyber-card) {
  box-shadow:
    0 20px 48px rgb(0 0 0 / 0.32),
    0 0 0 1px hsl(var(--neon-cyan) / 0.22),
    0 0 24px hsl(var(--neon-cyan) / 0.18);
}

.site-sort-drag {
  opacity: 0.98;
}

.site-sort-drag :deep(.cyber-card) {
  transform: rotate(1.4deg) scale(1.015);
  border-color: hsl(var(--neon-cyan) / 0.3);
  box-shadow:
    0 24px 56px rgb(0 0 0 / 0.36),
    0 0 0 1px hsl(var(--neon-cyan) / 0.26);
}

.sorting-active .site-card-wrap :deep(.cyber-card) {
  pointer-events: none;
}

.sorting-active .site-card-wrap:not(.site-sort-drag) {
  filter: none;
}

.group-empty-dropzone {
  min-height: 5.5rem;
  border-radius: var(--radius-lg);
  border: 1px dashed hsl(var(--neon-cyan) / 0.24);
  background: hsl(var(--glass-bg) / 0.56);
  color: hsl(var(--text-muted));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.site-grid {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.site-grid.normal {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.site-grid.compact {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: clamp(0.375rem, 1.5vw, 0.5rem);
}

.site-grid.large {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.site-grid.list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 1400px) {
  .site-grid.list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem 1.5rem;
  }
}

.site-grid.minimal {
  grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
  gap: 1.25rem;
  justify-items: center;
}

.empty-state {
  text-align: center;
  padding: 4rem 0;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: hsl(var(--glass-bg));
  border: 1px solid hsl(var(--glass-border));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}

.empty-text {
  color: hsl(var(--text-secondary));
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

  .group-section {
    gap: 0.5rem;
  }

  .group-section.has-margin {
    margin-bottom: 0.5rem;
  }
}
</style>
