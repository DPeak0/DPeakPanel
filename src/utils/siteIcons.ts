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
