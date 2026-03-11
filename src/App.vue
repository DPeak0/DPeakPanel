<script setup lang="ts">
import { onMounted, computed, watch, ref, provide } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useConfigStore } from '@/stores/config'
import type { TabType } from '@/types'
import TechBackground from '@/components/common/TechBackground.vue'
import LoadingScreen from '@/components/common/LoadingScreen.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ContentTabs from '@/components/common/ContentTabs.vue'
import SiteGrid from '@/components/sites/SiteGrid.vue'
import DockerGrid from '@/components/docker/DockerGrid.vue'
import ServiceGrid from '@/components/luckyServices/ServiceGrid.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import BackToTop from '@/components/common/BackToTop.vue'
import LinkDropdown from '@/components/common/LinkDropdown.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import { Settings } from 'lucide-vue-next'

const navStore = useNavStore()
const configStore = useConfigStore()

const EMPTY_STATE_CONFIG = {
  icon: '🗂️',
  title: '暂无可用内容',
  description: '当前没有可显示的站点、Docker 容器或 Lucky 服务。'
} as const

// 链接下拉菜单组件引用
const linkDropdownRef = ref<InstanceType<typeof LinkDropdown> | null>(null)

// 提供给子组件
provide('linkDropdown', {
  show: (site: any, urls: any[], target: HTMLElement) => {
    linkDropdownRef.value?.show(site, urls, target)
  }
})

// 计算属性
const isLoading = computed(() => navStore.isLoading)
const currentTab = computed(() => configStore.currentTab)

// 各标签页是否可见
const hasSites = computed(() => navStore.sitesEnabled)
const hasDocker = computed(() => navStore.dockerEnabled && navStore.allContainers.length > 0)
const hasLuckyServices = computed(() => navStore.luckyServicesEnabled && navStore.allLuckyServices.length > 0)
const showHeader = computed(() => configStore.showHeader)
const availableTabs = computed<TabType[]>(() => {
  const tabs: TabType[] = []

  if (hasSites.value) {
    tabs.push('sites')
  }
  if (hasDocker.value) {
    tabs.push('docker')
  }
  if (hasLuckyServices.value) {
    tabs.push('luckyServices')
  }

  return tabs
})
const showGlobalEmptyState = computed(() => !isLoading.value && availableTabs.value.length === 0)

// 获取第一个可用的标签页
function getFirstAvailableTab(): TabType | null {
  return availableTabs.value[0] ?? null
}

// 检查并修正当前标签页
function ensureValidTab() {
  const tab = currentTab.value
  const isCurrentTabValid = availableTabs.value.includes(tab)

  if (!isCurrentTabValid) {
    const firstTab = getFirstAvailableTab()
    if (firstTab) {
      configStore.setCurrentTab(firstTab)
    }
  }
}

// 拼接图标 URL
function getIconUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `./backend/iconlibs/${path}`
}

// 主题切换
watch(
  () => configStore.effectiveTheme,
  (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
  },
  { immediate: true }
)

// 浏览器标题更新
watch(
  () => navStore.panelTitle,
  (title) => {
    if (title) {
      document.title = title
    }
  },
  { immediate: true }
)

// 浏览器 Favicon 更新
watch(
  () => navStore.panelFavicon,
  (favicon) => {
    if (favicon) {
      const faviconUrl = getIconUrl(favicon)
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = faviconUrl
    }
  },
  { immediate: true }
)

// 初始化
onMounted(async () => {
  navStore.isLoading = true

  // 先加载本地配置（包含默认值）
  configStore.loadConfig()

  try {
    // 加载基础配置（nav.json）和服务器配置
    const [, serverConfig] = await Promise.all([
      navStore.loadNavConfig(),
      navStore.fetchServerConfig()
    ])

    // 尝试应用服务器配置
    if (serverConfig) {
      configStore.applyServerConfig(serverConfig)
    }

    // 如果当前是自动或混合模式，调用接口重新识别网络类型
    const mode = configStore.networkMode
    if (mode === 'auto' || mode === 'hybrid') {
      await navStore.fetchNetworkType()
    }

    // 预加载已启用模块的数据，用于决定顶部页签是否显示
    const preloadTasks: Promise<unknown>[] = []

    if (navStore.sitesEnabled) {
      preloadTasks.push(navStore.loadSitesData())
    }
    if (navStore.dockerEnabled) {
      preloadTasks.push(navStore.loadDockerData())
    }
    if (navStore.luckyServicesEnabled) {
      preloadTasks.push(navStore.loadLuckyServicesData())
    }

    await Promise.all(preloadTasks)

    // 检查当前标签页是否有效，无效则切换到第一个可用标签页
    ensureValidTab()
  } finally {
    navStore.isLoading = false
  }
})

watch(availableTabs, () => {
  ensureValidTab()
})
</script>

<template>
  <!-- 素描风格 SVG 滤镜定义 -->
  <svg width="0" height="0" style="position: absolute;">
    <defs>
      <!-- 素描滤镜 - 边缘抖动效果 -->
      <filter id="sketch-filter" filterUnits="objectBoundingBox" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <!-- 素描滤镜 - 悬停时轻微加强 -->
      <filter id="sketch-filter-hover" filterUnits="objectBoundingBox" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>

  <!-- 科技感动态背景 -->
  <TechBackground />

  <!-- 加载屏幕 -->
  <LoadingScreen v-if="isLoading" />

  <!-- 主内容 -->
  <div v-else class="app-main">
    <!-- 页头 -->
    <AppHeader v-if="showHeader" />

    <!-- 浮动设置按钮（仅在隐藏页头时显示） -->
    <button 
      v-if="!showHeader" 
      class="floating-settings-btn"
      @click="configStore.toggleSettingsPanel(true)"
    >
      <Settings class="floating-settings-icon" />
    </button>

    <!-- 搜索栏（仅在站点页面显示） -->
    <SearchBar v-if="configStore.showSearch && currentTab === 'sites' && hasSites" />

    <!-- 主区域 -->
    <main class="main-content" :class="{ 'no-header': !showHeader }">
      <!-- 内容标签页 -->
      <ContentTabs class="mb-16" />

      <!-- 站点网格 -->
      <SiteGrid v-if="currentTab === 'sites' && hasSites" />

      <!-- Docker 网格 -->
      <DockerGrid v-else-if="currentTab === 'docker' && hasDocker" />

      <!-- Lucky 服务网格 -->
      <ServiceGrid v-else-if="currentTab === 'luckyServices' && hasLuckyServices" />

      <div v-else-if="showGlobalEmptyState" class="global-empty-state">
        <div class="global-empty-icon">{{ EMPTY_STATE_CONFIG.icon }}</div>
        <h2 class="global-empty-title">{{ EMPTY_STATE_CONFIG.title }}</h2>
        <p class="global-empty-description">{{ EMPTY_STATE_CONFIG.description }}</p>
      </div>
    </main>

    <!-- 设置面板 -->
    <SettingsPanel />

    <!-- 返回顶部 -->
    <BackToTop />

    <!-- 链接选择下拉菜单 -->
    <LinkDropdown ref="linkDropdownRef" />
  </div>
</template>

<style scoped>
.app-main {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 1rem 2rem;
}

.main-content.no-header {
  padding-top: 1rem;
}

.global-empty-state {
  min-height: min(48vh, 420px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1.5rem;
  text-align: center;
  border: 1px solid hsl(var(--glass-border));
  border-radius: 1.5rem;
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.global-empty-icon {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 1.25rem;
  background: linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary-dark) / 0.08) 100%);
  font-size: 2rem;
}

.global-empty-title {
  margin: 0;
  color: hsl(var(--text-primary));
  font-size: clamp(1.25rem, 2vw, 1.6rem);
  font-weight: 700;
}

.global-empty-description {
  margin: 0;
  max-width: 32rem;
  color: hsl(var(--text-secondary));
  line-height: 1.6;
}

@media (min-width: 640px) {
  .main-content {
    padding: 0.75rem 1.5rem 2.5rem;
  }
  
  .main-content.no-header {
    padding-top: 1.5rem;
  }
}

/* 移动端 ContentTabs 间距调整 */
@media (max-width: 480px) {
  .main-content .mb-16 {
    margin-bottom: 0.75rem;
  }

  .global-empty-state {
    min-height: 42vh;
    padding: 1.5rem 1rem;
    border-radius: 1.25rem;
  }
}

/* 浮动设置按钮 */
.floating-settings-btn {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 100;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--glass-border) / 0.3);
  background: hsl(var(--glass-bg) / 0.3);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: hsl(var(--text-muted) / 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 300ms ease;
  box-shadow: none;
  opacity: 0.5;
}

.floating-settings-btn:hover {
  opacity: 1;
  color: hsl(var(--neon-cyan));
  border-color: hsl(var(--neon-cyan) / 0.4);
  background: hsl(var(--glass-bg));
  box-shadow: 0 0 15px hsl(var(--neon-cyan) / 0.3);
  transform: scale(1.05);
}

.floating-settings-icon {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 500ms;
}

.floating-settings-btn:hover .floating-settings-icon {
  transform: rotate(90deg);
}
</style>
