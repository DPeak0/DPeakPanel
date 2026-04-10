import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { SiteIconLibraryItem } from '@/data/siteIconLibrary'
import {
  SITE_ICON_SOURCES_UPDATED_EVENT,
  loadSiteIconSources,
  type SiteIconSource
} from '@/data/siteIconSources'

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

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
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
  for (const source of enabledTemplateSources) {
    const baseUrl = getTemplateSourceBaseUrl(source)
    if (!baseUrl) continue
    return joinUrl(baseUrl, normalizedPath)
  }

  return `./backend/iconlibs/${normalizedPath}`
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
