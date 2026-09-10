export const PAGE_COUNTS = [1, 2, 4]
export const PAGE_GAP = 12

export function visiblePageNumbers(start, perView, total) {
  const last = Math.max(1, Number(total) || 1)
  const from = Math.min(Math.max(1, Number(start) || 1), last)
  const count = Math.min(Math.max(1, Number(perView) || 1), last - from + 1)
  return Array.from({ length: count }, (_, index) => from + index)
}

export function layoutColumns(perView) {
  return Number(perView) >= 2 ? 2 : 1
}

export function pageRotation(orientation) {
  return orientation === 'landscape' ? 90 : 0
}

export function lastVisiblePage(start, perView, total) {
  const pages = visiblePageNumbers(start, perView, total)
  return pages[pages.length - 1] || start
}

export function canGoNext(start, perView, total) {
  return lastVisiblePage(start, perView, total) < total
}

export function stepStartPage(start, direction, perView, total) {
  const last = Math.max(1, Number(total) || 1)
  const next = (Number(start) || 1) + direction * (Number(perView) || 1)
  return Math.min(Math.max(1, next), last)
}

export async function waitForBox(getEl, { minWidth = 160, minHeight = 160, frames = 12 } = {}) {
  for (let step = 0; step < frames; step += 1) {
    const el = getEl()
    if (el && el.offsetWidth >= minWidth && el.offsetHeight >= minHeight) {
      return el
    }
    await new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  }
  return getEl()
}

export function fitPagesScale(sizes, availW, availH, cols, gap = PAGE_GAP) {
  if (!sizes.length) {
    return 1
  }
  const cellW = Math.max(...sizes.map((size) => size.width))
  const cellH = Math.max(...sizes.map((size) => size.height))
  const rows = Math.ceil(sizes.length / Math.max(1, cols))
  const totalW = cols * cellW + Math.max(0, cols - 1) * gap
  const totalH = rows * cellH + Math.max(0, rows - 1) * gap
  if (totalW <= 0 || totalH <= 0) {
    return 1
  }
  return Math.min(availW / totalW, availH / totalH)
}
