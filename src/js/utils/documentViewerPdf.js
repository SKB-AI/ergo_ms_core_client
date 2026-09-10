/**
 * Ленивая загрузка pdf.js. Worker только из бандла, не с CDN.
 *
 * Сборка federated remote инлайнит ``?url`` как ``data:`` (у lib нет public path).
 * pdf.js тогда делает ``import(data:…)`` — CSP ``script-src`` без ``data:`` это режет
 * и падает в fake worker. ``blob:`` для worker-src разрешён, origin у blob тот же.
 */

let pdfjsLib = null
let workerBlobSrc = ''

function workerDataUrlToBlobSrc(dataUrl) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) {
    return dataUrl
  }
  const meta = dataUrl.slice(5, comma)
  const payload = dataUrl.slice(comma + 1)
  const isBase64 = /;base64/i.test(meta)
  const bytes = isBase64
    ? Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload))
  return URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
}

function resolvePdfWorkerSrc(raw) {
  const src = typeof raw === 'string' ? raw : ''
  if (!src) {
    return src
  }
  if (src.startsWith('data:')) {
    if (!workerBlobSrc) {
      workerBlobSrc = workerDataUrlToBlobSrc(src)
    }
    return workerBlobSrc
  }
  if (src.startsWith('/') || src.startsWith('blob:') || /^https?:/i.test(src)) {
    return src
  }
  try {
    return new URL(src, import.meta.url).href
  } catch {
    return src
  }
}

export async function loadPdfjs() {
  if (pdfjsLib) {
    return pdfjsLib
  }
  const [lib, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  lib.GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc(workerUrl.default)
  pdfjsLib = lib
  return lib
}

export async function openPdfDocument(data) {
  const pdfjs = await loadPdfjs()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return pdfjs.getDocument({ data: bytes }).promise
}

export function pdfPageViewport(page, { scale = 1, rotation = 0 } = {}) {
  const extra = ((Number(rotation) % 360) + 360) % 360
  const total = ((Number(page.rotate) || 0) + extra) % 360
  return page.getViewport({ scale, rotation: total })
}

export async function renderPdfPage(page, canvas, scale, options = {}) {
  const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const viewport = pdfPageViewport(page, { scale, rotation: options.rotation })
  const context = canvas.getContext('2d', { alpha: false })
  const displayWidth = Math.floor(viewport.width)
  const displayHeight = Math.floor(viewport.height)
  canvas.width = Math.floor(displayWidth * ratio)
  canvas.height = Math.floor(displayHeight * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const task = page.render({ canvasContext: context, viewport })
  await task.promise
  return { width: displayWidth, height: displayHeight }
}
