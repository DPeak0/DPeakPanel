export type SiteIconSourceType = 'simple-icons' | 'template'

export interface SiteIconSource {
  key: string
  name: string
  type: SiteIconSourceType
  urlTemplate: string
  description?: string
  enabled: boolean
}

const STORAGE_KEY = 'lightpanel_site_icon_sources'
export const SITE_ICON_SOURCES_UPDATED_EVENT = 'lightpanel:site-icon-sources-updated'

export const DEFAULT_SITE_ICON_SOURCES: SiteIconSource[] = [
  {
    key: 'simple_icons',
    name: 'Simple Icons CDN',
    type: 'simple-icons',
    urlTemplate: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg',
    description: '默认 Simple Icons 图标源',
    enabled: true
  }
]

function normalizeSourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeUrlTemplate(value: string, type: SiteIconSourceType) {
  const template = value.trim()
  if (!template) return ''

  if (template.includes('{slug}') || template.includes('{key}') || template.includes('{title}') || template.includes('{path}')) {
    return template
  }

  if (type === 'simple-icons') {
    return `${template.replace(/\/+$/, '')}/{slug}.svg`
  }

  return `${template.replace(/\/+$/, '')}/{path}`
}

function normalizeSource(source: Partial<SiteIconSource>): SiteIconSource | null {
  const key = normalizeSourceKey(source.key || '')
  const type = source.type === 'template' ? 'template' : 'simple-icons'
  const urlTemplate = normalizeUrlTemplate(source.urlTemplate || '', type)

  if (!key || !source.name?.trim() || !urlTemplate) {
    return null
  }

  return {
    key,
    name: source.name.trim(),
    type,
    urlTemplate,
    description: source.description?.trim() || '',
    enabled: source.enabled !== false
  }
}

export function ensureSiteIconSourceKey(value: string) {
  return normalizeSourceKey(value)
}

export function buildSiteIconSourcePayload(source: Partial<SiteIconSource>) {
  return normalizeSource(source)
}

export function loadSiteIconSources() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [...DEFAULT_SITE_ICON_SOURCES]
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_SITE_ICON_SOURCES]
    }

    const deduped = new Map<string, SiteIconSource>()
    parsed.forEach((item) => {
      const normalized = normalizeSource(item)
      if (!normalized) return

      let candidateKey = normalized.key
      let suffix = 2
      while (deduped.has(candidateKey)) {
        candidateKey = `${normalized.key}_${suffix}`
        suffix += 1
      }

      deduped.set(candidateKey, { ...normalized, key: candidateKey })
    })

    return deduped.size > 0 ? Array.from(deduped.values()) : [...DEFAULT_SITE_ICON_SOURCES]
  } catch {
    return [...DEFAULT_SITE_ICON_SOURCES]
  }
}

export function saveSiteIconSources(sources: SiteIconSource[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SITE_ICON_SOURCES_UPDATED_EVENT))
  }
}
