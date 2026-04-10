import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConfigStore } from './config'
import type {
  NavConfig,
  SitesData,
  DockerData,
  DockerStatsResponse,
  DockerStat,
  Site,
  DockerContainer,
  Group,
  NetworkType,
  SiteEditorInput
} from '@/types'

// API 路径
const API = {
  nav: './backend/nav.json',
  sites: './backend/sites.json',
  docker: ['./backend/runtime/docker.json', './backend/docker.json'],
  dockerStats: ['./backend/runtime/docker-stats.json', './backend/docker-stats.json'],
  networkType: './backend/api/network-type',
  config: './backend/default-config.json'
}

const SITES_OVERRIDE_STORAGE_KEY = 'lightpanel_sites_override'

function cloneSitesData(data: SitesData): SitesData {
  return {
    networkType: data.networkType,
    clientIP: data.clientIP,
    groups: (data.groups || []).map(group => ({ ...group })),
    sites: (data.sites || []).map(site => ({
      ...site,
      frontendUrls: [...(site.frontendUrls || [])],
      backendUrls: [...(site.backendUrls || [])]
    }))
  }
}

function slugify(value: string, fallback: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-_]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

function ensureUniqueKey(preferredKey: string, usedKeys: Set<string>, currentKey?: string) {
  if (currentKey && preferredKey === currentKey) {
    return currentKey
  }

  if (!usedKeys.has(preferredKey)) {
    return preferredKey
  }

  let index = 2
  let candidate = `${preferredKey}-${index}`
  while (usedKeys.has(candidate)) {
    index += 1
    candidate = `${preferredKey}-${index}`
  }

  return candidate
}

function normalizeUrlList(urls: string[] | undefined) {
  return (urls || [])
    .map(url => url.trim())
    .filter(Boolean)
}

function sortSitesInGroup(sites: Site[], groupKey?: string) {
  return sites
    .filter(site => (site.groupKey || '') === (groupKey || ''))
    .sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
}

function normalizeSiteOrders(groups: Group[], sites: Site[]) {
  const normalized: Site[] = []
  const handledKeys = new Set<string>()
  const orderedGroups = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0))

  orderedGroups.forEach(group => {
    sortSitesInGroup(sites, group.key).forEach((site, index) => {
      normalized.push({
        ...site,
        order: index
      })
      handledKeys.add(site.key)
    })
  })

  const remainingSites = sites
    .filter(site => !handledKeys.has(site.key))
    .sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })

  remainingSites.forEach((site, index) => {
    normalized.push({
      ...site,
      order: index
    })
  })

  return normalized
}

export const useNavStore = defineStore('nav', () => {
  // 加载状态
  const isLoading = ref(true)
  const loadError = ref<string | null>(null)

  // 全局配置
  const navConfig = ref<NavConfig | null>(null)

  // 站点数据
  const serverSitesData = ref<SitesData | null>(null)
  const sitesData = ref<SitesData | null>(null)
  const networkType = ref<NetworkType>('external')
  const networkTypeFetchFailed = ref(false)  // 网络类型查询是否失败
  const clientIP = ref('')
  const hasLocalSitesOverride = ref(false)

  // Docker 数据
  const dockerData = ref<DockerData | null>(null)
  const dockerStats = ref<Map<string, DockerStat>>(new Map())
  const dockerStatsTimer = ref<ReturnType<typeof setInterval> | null>(null)

  // 配置数据
  const serverConfig = ref<Record<string, any>>({}) // 服务器下发的用户配置

  // 计算属性：站点分组
  const siteGroups = computed<Group[]>(() => {
    return sitesData.value?.groups || []
  })

  const editableSites = computed<Site[]>(() => {
    const sites = sitesData.value?.sites || []
    return [...sites].sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
  })

  // 计算属性：所有站点
  const allSites = computed<Site[]>(() => {
    const sites = sitesData.value?.sites || []
    return sites.filter((s: Site) => s.enable !== false).sort((a: Site, b: Site) => (a.order || 0) - (b.order || 0))
  })

  // 计算属性：Docker 分组
  const dockerGroups = computed<Group[]>(() => {
    return dockerData.value?.groups || []
  })

  // 计算属性：所有 Docker 容器
  const allContainers = computed<DockerContainer[]>(() => {
    const containers = dockerData.value?.containers || []
    return containers.filter((c: DockerContainer) => c.enable !== false).sort((a: DockerContainer, b: DockerContainer) => (a.order || 0) - (b.order || 0))
  })

  // 计算属性：面板标题
  const panelTitle = computed(() => {
    return navConfig.value?.settings?.title || '轻面板'
  })

  // 计算属性：面板副标题
  const panelSubtitle = computed(() => {
    return navConfig.value?.settings?.subtitle || ''
  })

  // 计算属性：面板 Logo
  const panelLogo = computed(() => {
    return navConfig.value?.settings?.logo || ''
  })

  // 计算属性：面板 Favicon
  const panelFavicon = computed(() => {
    return navConfig.value?.settings?.favicon || ''
  })

  // 计算属性：模块启用状态
  const sitesEnabled = computed(() => navConfig.value?.sitesEnabled !== false)
  const dockerEnabled = computed(() => navConfig.value?.dockerEnabled === true)

  // 异步加载 JSON
  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      return await response.json()
    } catch {
      return null
    }
  }

  async function fetchJsonFromSources<T>(urls: string | string[]): Promise<T | null> {
    const candidates = Array.isArray(urls) ? urls : [urls]
    for (const url of candidates) {
      const data = await fetchJson<T>(url)
      if (data) {
        return data
      }
    }
    return null
  }

  function readSitesOverride(): Pick<SitesData, 'groups' | 'sites'> | null {
    try {
      const raw = localStorage.getItem(SITES_OVERRIDE_STORAGE_KEY)
      if (!raw) {
        hasLocalSitesOverride.value = false
        return null
      }

      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.sites)) {
        localStorage.removeItem(SITES_OVERRIDE_STORAGE_KEY)
        hasLocalSitesOverride.value = false
        return null
      }

      hasLocalSitesOverride.value = true
      return {
        groups: parsed.groups,
        sites: parsed.sites
      }
    } catch {
      localStorage.removeItem(SITES_OVERRIDE_STORAGE_KEY)
      hasLocalSitesOverride.value = false
      return null
    }
  }

  function applySitesOverride(baseData: SitesData): SitesData {
    const override = readSitesOverride()
    if (!override) {
      return cloneSitesData(baseData)
    }

    return {
      networkType: baseData.networkType,
      clientIP: baseData.clientIP,
      groups: (override.groups || []).map(group => ({ ...group })),
      sites: (override.sites || []).map(site => ({
        ...site,
        frontendUrls: [...(site.frontendUrls || [])],
        backendUrls: [...(site.backendUrls || [])]
      }))
    }
  }

  function persistSitesOverride(groups: Group[], sites: Site[]) {
    localStorage.setItem(
      SITES_OVERRIDE_STORAGE_KEY,
      JSON.stringify({
        groups,
        sites
      })
    )
    hasLocalSitesOverride.value = true
  }

  function pruneEmptyGroups(groups: Group[], sites: Site[]) {
    const usedGroupKeys = new Set(sites.map(site => site.groupKey).filter(Boolean))
    return groups.filter(group => usedGroupKeys.has(group.key))
  }

  function replaceEditableSitesData(groups: Group[], sites: Site[]) {
    if (!sitesData.value) return

    const nextGroups = pruneEmptyGroups(
      groups.map(group => ({ ...group })),
      sites
    )
    const nextSites = normalizeSiteOrders(nextGroups, sites).map(site => ({
      ...site,
      frontendUrls: normalizeUrlList(site.frontendUrls),
      backendUrls: normalizeUrlList(site.backendUrls)
    }))

    sitesData.value = {
      ...sitesData.value,
      groups: nextGroups,
      sites: nextSites
    }

    persistSitesOverride(nextGroups, nextSites)
  }

  // 加载基础配置（nav.json）
  async function loadNavConfig() {
    const config = await fetchJson<NavConfig>(API.nav)
    if (config) {
      navConfig.value = config
      // 设置服务器背景图片
      const configStore = useConfigStore()
      const bgImages = config.settings?.backgroundImages || []
      configStore.setServerBackgrounds(bgImages)
    }
    return config
  }

  // 加载站点数据
  async function loadSitesData() {
    const data = await fetchJson<SitesData>(API.sites)
    if (data) {
      serverSitesData.value = cloneSitesData(data)
      const resolvedData = applySitesOverride(data)
      sitesData.value = resolvedData
      networkType.value = resolvedData.networkType || 'external'
      clientIP.value = resolvedData.clientIP || ''
    }
    return data
  }

  function saveSite(input: SiteEditorInput) {
    if (!sitesData.value) return

    const name = input.name.trim()
    if (!name) {
      throw new Error('站点名称不能为空')
    }

    const frontendUrls = normalizeUrlList(input.frontendUrls)
    const backendUrls = normalizeUrlList(input.backendUrls)

    if (frontendUrls.length === 0 && backendUrls.length === 0) {
      throw new Error('请至少填写一个内网或外网链接')
    }

    const groups = [...(sitesData.value.groups || [])].map(group => ({ ...group }))
    const sites: Site[] = [...(sitesData.value.sites || [])].map(site => ({
      ...site,
      frontendUrls: [...(site.frontendUrls || [])],
      backendUrls: [...(site.backendUrls || [])]
    }))

    const editingIndex = input.originalKey
      ? sites.findIndex(site => site.key === input.originalKey)
      : -1

    const usedSiteKeys = new Set(
      sites
        .filter((_, index) => index !== editingIndex)
        .map(site => site.key)
    )

    const groupName = (input.groupName || '').trim() || '未分组'
    let targetGroup = groups.find(group => group.name === groupName)

    if (!targetGroup) {
      const usedGroupKeys = new Set(groups.map(group => group.key))
      const groupKey = ensureUniqueKey(slugify(groupName, 'group'), usedGroupKeys)
      targetGroup = {
        key: groupKey,
        name: groupName,
        icon: '',
        order: groups.length + 1
      }
      groups.push(targetGroup)
    }

    const manualKey = input.key?.trim()
    const preferredSiteKey = editingIndex >= 0 && !manualKey
      ? (input.originalKey || slugify(name, 'site'))
      : slugify(manualKey || name, 'site')
    const siteKey = ensureUniqueKey(preferredSiteKey, usedSiteKeys, input.originalKey)
    const currentSite = editingIndex >= 0 ? sites[editingIndex] : null
    const nextGroupSites = sortSitesInGroup(
      sites.filter(site => site.key !== currentSite?.key),
      targetGroup.key
    )

    const nextSite: Site = {
      key: siteKey,
      name,
      description: input.description?.trim() || '',
      iconUrl: input.iconUrl?.trim() || '',
      frontendUrls,
      backendUrls,
      groupKey: targetGroup.key,
      order: Number.isFinite(input.order)
        ? Number(input.order)
        : currentSite?.groupKey === targetGroup.key
          ? currentSite.order || 0
          : nextGroupSites.length,
      enable: input.enable !== false,
      target: input.target === '_self' ? '_self' : '_blank'
    }

    if (editingIndex >= 0) {
      sites.splice(editingIndex, 1, nextSite)
    } else {
      sites.push(nextSite)
    }

    replaceEditableSitesData(groups, sites)
    return nextSite.key
  }

  function deleteSite(siteKey: string) {
    if (!sitesData.value) return

    const sites = (sitesData.value.sites || []).filter(site => site.key !== siteKey)
    const groups = [...(sitesData.value.groups || [])]
    replaceEditableSitesData(groups, sites)
  }

  function moveSite(siteKey: string, targetGroupKey: string, targetSiteKey?: string, position: 'before' | 'after' | 'end' = 'end') {
    if (!sitesData.value) return

    const groups = [...(sitesData.value.groups || [])].map(group => ({ ...group }))
    const sites = [...(sitesData.value.sites || [])].map(site => ({
      ...site,
      frontendUrls: [...(site.frontendUrls || [])],
      backendUrls: [...(site.backendUrls || [])]
    }))

    const movingIndex = sites.findIndex(site => site.key === siteKey)
    if (movingIndex < 0) return

    const movingSite = sites[movingIndex]
    const sourceGroupKey = movingSite.groupKey || ''
    const remainingSites = sites.filter(site => site.key !== siteKey)

    const targetSites = sortSitesInGroup(remainingSites, targetGroupKey)
    let insertIndex = targetSites.length

    if (targetSiteKey) {
      const targetIndex = targetSites.findIndex(site => site.key === targetSiteKey)
      if (targetIndex >= 0) {
        insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
      }
    }

    const nextTargetSites = [...targetSites]
    nextTargetSites.splice(insertIndex, 0, {
      ...movingSite,
      groupKey: targetGroupKey
    })

    const unaffectedSites = remainingSites.filter(site => {
      const groupKey = site.groupKey || ''
      return groupKey !== sourceGroupKey && groupKey !== targetGroupKey
    })

    const nextSourceSites = sourceGroupKey && sourceGroupKey !== targetGroupKey
      ? sortSitesInGroup(remainingSites, sourceGroupKey)
      : []

    replaceEditableSitesData(groups, [
      ...unaffectedSites,
      ...nextSourceSites,
      ...nextTargetSites
    ])
  }

  function reorderVisibleSites(nextGroups: Array<{ groupKey: string; sites: Site[] }>) {
    if (!sitesData.value) return

    const groups = [...(sitesData.value.groups || [])].map(group => ({ ...group }))
    const currentSites = [...(sitesData.value.sites || [])].map(site => ({
      ...site,
      frontendUrls: [...(site.frontendUrls || [])],
      backendUrls: [...(site.backendUrls || [])]
    }))

    const visibleSiteKeys = new Set(
      nextGroups.flatMap(group => group.sites.map(site => site.key))
    )

    const hiddenSites = currentSites.filter(site => !visibleSiteKeys.has(site.key))
    const reorderedSites = nextGroups.flatMap(group =>
      group.sites.map((site, index) => ({
        ...site,
        groupKey: group.groupKey,
        order: index,
        frontendUrls: [...(site.frontendUrls || [])],
        backendUrls: [...(site.backendUrls || [])]
      }))
    )

    replaceEditableSitesData(groups, [
      ...hiddenSites,
      ...reorderedSites
    ])
  }

  function resetSitesOverride() {
    localStorage.removeItem(SITES_OVERRIDE_STORAGE_KEY)
    hasLocalSitesOverride.value = false

    if (serverSitesData.value) {
      const restored = cloneSitesData(serverSitesData.value)
      sitesData.value = restored
      networkType.value = restored.networkType || 'external'
      clientIP.value = restored.clientIP || ''
    }
  }

  // 加载 Docker 数据
  async function loadDockerData() {
    const data = await fetchJsonFromSources<DockerData>(API.docker)
    if (data) {
      dockerData.value = data
    }
    return data
  }

  // 加载所有数据（兼容旧调用）
  async function loadAllData() {
    isLoading.value = true
    loadError.value = null

    try {
      // 先加载基础配置
      await loadNavConfig()
      // 同时加载所有数据源
      await Promise.all([
        loadSitesData(),
        loadDockerData()
      ])
    } catch (e) {
      loadError.value = String(e)
    } finally {
      isLoading.value = false
    }
  }

  // 获取网络类型（用于自动/混合模式）
  async function fetchNetworkType() {
    try {
      const response = await fetch(API.networkType)
      if (response.ok) {
        const data = await response.json()
        if (data.networkType) {
          networkType.value = data.networkType
          clientIP.value = data.clientIP || ''
          networkTypeFetchFailed.value = false  // 查询成功
          console.log('Network type updated:', networkType.value, 'Client IP:', clientIP.value)
          return
        }
      }
      // 响应不 ok 或没有 networkType 数据，视为失败
      networkTypeFetchFailed.value = true
      console.warn('Failed to fetch network type: invalid response')
    } catch (error) {
      networkTypeFetchFailed.value = true  // 查询失败
      console.warn('Failed to fetch network type:', error)
    }
  }

  // 获取服务器配置
  // 注意：此接口可能不存在（如开发模式或旧版本后端），需要优雅降级
  async function fetchServerConfig(): Promise<Record<string, any> | null> {
    try {
      const response = await fetch(API.config)
      if (!response.ok) {
        // 404/500 等情况，静默失败，使用默认配置
        console.log('Server config not available (HTTP %d), using defaults', response.status)
        return null
      }
      const data = await response.json()
      if (data.ret === 0) {
        const config = data.config
        // 检查配置是否有效（存在、非空对象、内容长度足够）
        if (!config || typeof config !== 'object' || Object.keys(config).length === 0 || JSON.stringify(config).length < 20) {
          console.log('Server config is empty or invalid, using defaults')
          return null
        }
        serverConfig.value = config
        console.log('Server config loaded:', serverConfig.value)
        return config
      } else {
        console.log('Server config returned error (ret=%d), using defaults', data.ret)
      }
    } catch (error) {
      // 网络错误、JSON解析错误等，静默失败
      console.log('Failed to fetch server config, using defaults:', error instanceof Error ? error.message : error)
    }
    return null
  }

  // 加载 Docker 统计
  async function loadDockerStats() {
    const data = await fetchJsonFromSources<DockerStatsResponse>(API.dockerStats)
    if (data?.ret === 0 && data.stats) {
      const newStats = new Map<string, DockerStat>()
      data.stats.forEach(stat => {
        newStats.set(stat.containerName, stat)
      })
      dockerStats.value = newStats
    }
  }

  // 开始 Docker 统计轮询
  function startDockerStatsPolling() {
    stopDockerStatsPolling()
    loadDockerStats()
    dockerStatsTimer.value = setInterval(loadDockerStats, 5000)
  }

  // 停止 Docker 统计轮询
  function stopDockerStatsPolling() {
    if (dockerStatsTimer.value) {
      clearInterval(dockerStatsTimer.value)
      dockerStatsTimer.value = null
    }
  }

  // 获取容器统计
  function getContainerStats(containerName: string): DockerStat | undefined {
    return dockerStats.value.get(containerName)
  }

  return {
    // 状态
    isLoading,
    loadError,
    navConfig,
    serverSitesData,
    sitesData,
    networkType,
    networkTypeFetchFailed,
    clientIP,
    hasLocalSitesOverride,
    dockerData,
    dockerStats,
    serverConfig,

    // 计算属性
    siteGroups,
    editableSites,
    allSites,
    dockerGroups,
    allContainers,
    panelTitle,
    panelSubtitle,
    panelLogo,
    panelFavicon,
    sitesEnabled,
    dockerEnabled,

    // 方法
    loadAllData,
    loadNavConfig,
    loadSitesData,
    saveSite,
    deleteSite,
    moveSite,
    reorderVisibleSites,
    resetSitesOverride,
    loadDockerData,
    fetchNetworkType,
    fetchServerConfig,
    loadDockerStats,
    startDockerStatsPolling,
    stopDockerStatsPolling,
    getContainerStats
  }
})
