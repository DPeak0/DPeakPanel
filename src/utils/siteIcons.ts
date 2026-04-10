import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { SiteIconLibraryItem } from '@/data/siteIconLibrary'
import {
  SITE_ICON_SOURCES_UPDATED_EVENT,
  loadSiteIconSources,
  type SiteIconSource
} from '@/data/siteIconSources'

export interface RemoteIconSearchItem {
  id: string
  name: string
  collectionName: string
  previewUrl: string
  downloadUrl: string
  sourceKey: string
  sourceName: string
  sourceType: 'simple-icons' | 'template'
  relativePath?: string
}

const ICONIFY_API_BASE = 'https://api.iconify.design'
const TEMPLATE_SOURCE_MAX_DEPTH = 4
const templateSourceIndexCache = new Map<string, Promise<RemoteIconSearchItem[]>>()

const FAVICON_SERVICES = [
  (hostname: string) => `https://icon.horse/icon/${hostname}`,
  (hostname: string) => `https://favicone.com/${hostname}?s=128`
]

const COMMON_ICON_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/android-chrome-192x192.png'
]

function dedupe<T>(list: T[]) {
  return Array.from(new Set(list))
}

function extractHostname(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function extractOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图标转换失败'))
    reader.readAsDataURL(blob)
  })
}

export async function downloadImageAsDataUrl(url: string) {
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) {
    throw new Error(`图标请求失败: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/') && !contentType.includes('svg')) {
    throw new Error('返回内容不是图片')
  }

  const blob = await response.blob()
  return blobToDataUrl(blob)
}

export function buildAutoIconCandidates(urls: string[]) {
  const validUrls = urls.filter(Boolean)
  const origins = dedupe(validUrls.map(extractOrigin).filter(Boolean))
  const hostnames = dedupe(validUrls.map(extractHostname).filter(Boolean))

  const candidates = [
    ...origins.flatMap(origin => COMMON_ICON_PATHS.map(path => `${origin}${path}`)),
    ...hostnames.flatMap(hostname => FAVICON_SERVICES.map(createUrl => createUrl(hostname)))
  ]

  return dedupe(candidates)
}

export async function autoResolveSiteIcon(urls: string[]) {
  const candidates = buildAutoIconCandidates(urls)

  for (const candidate of candidates) {
    try {
      const dataUrl = await downloadImageAsDataUrl(candidate)
      return {
        source: candidate,
        dataUrl
      }
    } catch {
      continue
    }
  }

  throw new Error('未找到可用图标')
}

export function buildSimpleIconCdnUrl(slug: string) {
  return `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`
}

export function buildSiteIconSourceUrl(source: SiteIconSource, item: SiteIconLibraryItem) {
  const replacements: Record<string, string> = {
    '{slug}': item.slug,
    '{key}': item.key,
    '{title}': encodeURIComponent(item.title),
    '{path}': item.slug
  }

  let url = source.urlTemplate
  Object.entries(replacements).forEach(([token, value]) => {
    url = url.split(token).join(value)
  })

  return url
}

export async function downloadImageAsDataUrlOrKeepUrl(url: string) {
  try {
    return await downloadImageAsDataUrl(url)
  } catch {
    return url
  }
}

export function buildIconifyIconUrl(iconId: string) {
  const separatorIndex = iconId.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex >= iconId.length - 1) {
    return ''
  }

  const prefix = iconId.slice(0, separatorIndex)
  const name = iconId.slice(separatorIndex + 1)
  return `${ICONIFY_API_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`
}

function matchesKeyword(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.toLowerCase())
}

function getTemplateSourceRootUrl(source: SiteIconSource) {
  const baseUrl = getTemplateSourceBaseUrl(source)
  if (!baseUrl) return null
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function isImagePath(path: string) {
  return /\.(png|jpe?g|webp|gif|svg|ico|avif)$/i.test(path)
}

async function fetchJsonDirectoryListing(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal
  })

  if (!response.ok) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  const payload = await response.json() as Array<{
    name: string
    url?: string
    is_dir?: boolean
    is_image?: boolean
  }>

  return payload.map(item => ({
    name: item.name,
    isDir: item.is_dir === true,
    isImage: item.is_image === true,
    href: item.url || item.name
  }))
}

function parseHtmlDirectoryListing(html: string) {
  const matches = Array.from(
    html.matchAll(/<a class="text-link file-link" href="([^"]+)" title="([^"]+)"/g)
  )

  return matches.map(match => {
    const href = match[1]
    const name = match[2]
    const isDir = href.endsWith('/')
    return {
      name,
      isDir,
      isImage: !isDir && isImagePath(name),
      href
    }
  })
}

async function fetchHtmlDirectoryListing(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`目录请求失败: ${response.status}`)
  }

  const html = await response.text()
  return parseHtmlDirectoryListing(html)
}

async function fetchDirectoryListing(url: string, signal?: AbortSignal) {
  const jsonEntries = await fetchJsonDirectoryListing(url, signal)
  if (jsonEntries) {
    return jsonEntries
  }

  return fetchHtmlDirectoryListing(url, signal)
}

async function buildTemplateSourceIndex(source: SiteIconSource, signal?: AbortSignal) {
  const rootUrl = getTemplateSourceRootUrl(source)
  if (!rootUrl) {
    return [] as RemoteIconSearchItem[]
  }

  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }]
  const visited = new Set<string>()
  const icons: RemoteIconSearchItem[] = []

  while (queue.length > 0) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const current = queue.shift()
    if (!current) continue

    const normalizedUrl = current.url.endsWith('/') ? current.url : `${current.url}/`
    if (visited.has(normalizedUrl)) continue
    visited.add(normalizedUrl)

    let entries: Awaited<ReturnType<typeof fetchDirectoryListing>> = []
    try {
      entries = await fetchDirectoryListing(normalizedUrl, signal)
    } catch {
      continue
    }

    for (const entry of entries) {
      const absoluteUrl = new URL(entry.href, normalizedUrl).href
      if (entry.isDir) {
        if (current.depth + 1 <= TEMPLATE_SOURCE_MAX_DEPTH) {
          queue.push({ url: absoluteUrl, depth: current.depth + 1 })
        }
        continue
      }

      if (!entry.isImage && !isImagePath(entry.name)) {
        continue
      }

      const relativePath = decodeURIComponent(absoluteUrl.replace(rootUrl, ''))
      icons.push({
        id: `${source.key}:${relativePath}`,
        name: entry.name.replace(/\.[^.]+$/, ''),
        collectionName: source.name,
        previewUrl: absoluteUrl,
        downloadUrl: absoluteUrl,
        sourceKey: source.key,
        sourceName: source.name,
        sourceType: 'template',
        relativePath
      })
    }
  }

  return icons
}

function getTemplateSourceIndex(source: SiteIconSource, signal?: AbortSignal) {
  const cacheKey = `${source.key}:${source.urlTemplate}`
  if (!templateSourceIndexCache.has(cacheKey)) {
    const task = buildTemplateSourceIndex(source, signal).catch((error) => {
      templateSourceIndexCache.delete(cacheKey)
      throw error
    })
    templateSourceIndexCache.set(cacheKey, task)
  }
  return templateSourceIndexCache.get(cacheKey)!
}

export function clearTemplateSourceSearchCache() {
  templateSourceIndexCache.clear()
}

async function searchSimpleIconsSource(source: SiteIconSource, query: string, signal?: AbortSignal, limit = 48) {
  const keyword = query.trim()
  if (keyword.length < 2) {
    return [] as RemoteIconSearchItem[]
  }

  const searchUrl = `${ICONIFY_API_BASE}/search?query=${encodeURIComponent(keyword)}&limit=${limit}`
  const response = await fetch(searchUrl, { signal })
  if (!response.ok) {
    throw new Error(`远程图标搜索失败: ${response.status}`)
  }

  const payload = await response.json() as {
    icons?: string[]
    collections?: Record<string, { name?: string }>
  }

  return (payload.icons || [])
    .map((iconId) => {
      const separatorIndex = iconId.indexOf(':')
      if (separatorIndex <= 0 || separatorIndex >= iconId.length - 1) {
        return null
      }

      const prefix = iconId.slice(0, separatorIndex)
      const name = iconId.slice(separatorIndex + 1)
      const iconUrl = buildIconifyIconUrl(iconId)

      return {
        id: iconId,
        name,
        collectionName: payload.collections?.[prefix]?.name || prefix,
        previewUrl: iconUrl,
        downloadUrl: iconUrl,
        sourceKey: source.key,
        sourceName: source.name,
        sourceType: 'simple-icons'
      }
    })
    .filter((item): item is RemoteIconSearchItem => item !== null)
}

async function searchTemplateIconsSource(source: SiteIconSource, query: string, signal?: AbortSignal, limit = 48) {
  const keyword = query.trim().toLowerCase()
  if (keyword.length < 2) {
    return [] as RemoteIconSearchItem[]
  }

  const icons = await getTemplateSourceIndex(source, signal)
  return icons
    .filter(item =>
      matchesKeyword(item.name, keyword) ||
      matchesKeyword(item.relativePath || '', keyword)
    )
    .slice(0, limit)
}

export async function searchRemoteIcons(
  query: string,
  sources: SiteIconSource[],
  signal?: AbortSignal,
  limit = 48
) {
  const enabledSources = sources.filter(source => source.enabled)
  const keyword = query.trim()
  if (keyword.length < 2 || enabledSources.length === 0) {
    return [] as RemoteIconSearchItem[]
  }

  const perSourceLimit = Math.max(12, Math.ceil(limit / Math.max(enabledSources.length, 1)))
  const resultGroups = await Promise.all(
    enabledSources.map(async (source) => {
      if (source.type === 'template') {
        return searchTemplateIconsSource(source, keyword, signal, perSourceLimit)
      }
      return searchSimpleIconsSource(source, keyword, signal, perSourceLimit)
    })
  )

  return resultGroups
    .flat()
    .slice(0, limit)
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function buildCandidateRelativePaths(path: string) {
  const normalizedPath = path.trim().replace(/^\.\/+/, '')
  if (!normalizedPath) return []

  const candidates = [normalizedPath]
  if (normalizedPath.startsWith('default_http/')) {
    candidates.unshift(normalizedPath.slice('default_http/'.length))
  }

  return Array.from(new Set(candidates.filter(Boolean)))
}

function getTemplateSourceBaseUrl(source: SiteIconSource) {
  if (source.type !== 'template') return null

  const directPathTemplate = source.urlTemplate.match(/^(.*)\{path\}$/)
  if (directPathTemplate) {
    return directPathTemplate[1]
  }

  const trailingTokenTemplate = source.urlTemplate.match(/^(.*)\/\{(?:slug|key|title)\}(?:\.[a-z0-9]+)?$/i)
  if (trailingTokenTemplate) {
    return trailingTokenTemplate[1]
  }

  return null
}

export function resolveRelativeIconUrl(path: string, sources = loadSiteIconSources()) {
  const normalizedPath = path.trim()
  if (!normalizedPath) return null

  const enabledTemplateSources = sources.filter(source => source.enabled && source.type === 'template')
  const candidatePaths = buildCandidateRelativePaths(normalizedPath)

  for (const source of enabledTemplateSources) {
    const baseUrl = getTemplateSourceBaseUrl(source)
    if (!baseUrl) continue

    const matchedPath = candidatePaths[0]
    if (matchedPath) {
      return joinUrl(baseUrl, matchedPath)
    }
  }

  return `./backend/iconlibs/${candidatePaths[0] || normalizedPath}`
}

export function resolveIconUrl(iconPath: string | null | undefined, sources = loadSiteIconSources()) {
  if (!iconPath) return null
  if (
    iconPath.startsWith('http://') ||
    iconPath.startsWith('https://') ||
    iconPath.startsWith('data:')
  ) {
    return iconPath
  }

  return resolveRelativeIconUrl(iconPath, sources)
}

export function useResolvedIconUrl(getIconPath: () => string | null | undefined) {
  const version = ref(0)

  function handleSourcesUpdated() {
    version.value += 1
  }

  onMounted(() => {
    window.addEventListener(SITE_ICON_SOURCES_UPDATED_EVENT, handleSourcesUpdated)
  })

  onUnmounted(() => {
    window.removeEventListener(SITE_ICON_SOURCES_UPDATED_EVENT, handleSourcesUpdated)
  })

  return computed(() => {
    version.value
    return resolveIconUrl(getIconPath())
  })
}
