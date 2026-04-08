<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, LoaderCircle, X } from 'lucide-vue-next'
import { SITE_ICON_LIBRARY } from '@/data/siteIconLibrary'
import { buildSimpleIconCdnUrl, downloadImageAsDataUrl } from '@/utils/siteIcons'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [dataUrl: string]
}>()

const keyword = ref('')
const loadingKey = ref('')
const errorMessage = ref('')

const filteredIcons = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return SITE_ICON_LIBRARY

  return SITE_ICON_LIBRARY.filter(item =>
    item.title.toLowerCase().includes(search) ||
    item.slug.toLowerCase().includes(search) ||
    item.keywords.some(word => word.toLowerCase().includes(search))
  )
})

function close() {
  keyword.value = ''
  errorMessage.value = ''
  emit('close')
}

async function selectIcon(slug: string) {
  loadingKey.value = slug
  errorMessage.value = ''

  try {
    const dataUrl = await downloadImageAsDataUrl(buildSimpleIconCdnUrl(slug))
    emit('select', dataUrl)
    close()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '图标下载失败'
  } finally {
    loadingKey.value = ''
  }
}
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

      <div class="search-bar">
        <Search class="search-icon" />
        <input v-model.trim="keyword" class="search-input" type="text" placeholder="搜索图标，例如 github / docker / media" />
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <div class="icon-grid">
        <button
          v-for="item in filteredIcons"
          :key="item.key"
          class="icon-card"
          :disabled="loadingKey === item.slug"
          @click="selectIcon(item.slug)"
        >
          <div class="icon-preview">
            <LoaderCircle v-if="loadingKey === item.slug" class="icon-loading" />
            <img v-else :src="buildSimpleIconCdnUrl(item.slug)" :alt="item.title" class="icon-image" loading="lazy" />
          </div>
          <span class="icon-title">{{ item.title }}</span>
        </button>
      </div>
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

.library-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: hsl(var(--text-primary));
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

.search-input {
  flex: 1;
  border: 1px solid hsl(var(--glass-border));
  border-radius: 999px;
  background: hsl(var(--glass-bg));
  color: hsl(var(--text-primary));
  padding: 0.8rem 1rem;
  outline: none;
}

.search-input:focus {
  border-color: hsl(var(--neon-cyan) / 0.5);
}

.error-text {
  padding: 0 1.25rem;
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

.icon-card,
.close-btn {
  border: 1px solid hsl(var(--glass-border));
  background: transparent;
  color: hsl(var(--text-primary));
  cursor: pointer;
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

.close-btn {
  border-radius: 999px;
  padding: 0.65rem;
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

@media (max-width: 720px) {
  .library-panel {
    inset: 2vh 2vw;
  }

  .icon-grid {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
}
</style>
