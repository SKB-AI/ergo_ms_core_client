/**
 * Ленивая загрузка pdf.js. Worker только из бандла, не с CDN.
 */

let pdfjsLib = null

export async function loadPdfjs() {
  if (pdfjsLib) {
    return pdfjsLib
  }
  const [lib, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  lib.GlobalWorkerOptions.workerSrc = workerUrl.default
  pdfjsLib = lib
  return lib
}

export async function openPdfDocument(data) {
  const pdfjs = await loadPdfjs()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return pdfjs.getDocument({ data: bytes }).promise
}

export async function renderPdfPage(page, canvas, scale) {
  const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const viewport = page.getViewport({ scale })
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
