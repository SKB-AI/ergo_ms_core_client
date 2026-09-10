<template>
  <div class="document-viewer" :class="{ 'document-viewer--compact': compact }">
    <div v-if="showToolbar && !loading && !errorText" class="document-viewer__toolbar">
      <div v-if="kind === 'pdf'" class="document-viewer__nav">
        <HoverTooltip :text="t('components.documentViewer.prevPage')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :disabled="page <= 1"
            :aria-label="t('components.documentViewer.prevPage')"
            @click="goPage(page - pagesPerView)"
          >
            <ChevronLeft :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <span class="document-viewer__page">
          {{ pageLabel }}
        </span>
        <HoverTooltip :text="t('components.documentViewer.nextPage')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :disabled="!canNextPage"
            :aria-label="t('components.documentViewer.nextPage')"
            @click="goPage(page + pagesPerView)"
          >
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
      </div>
      <div v-if="kind === 'pdf'" class="document-viewer__zoom">
        <HoverTooltip :text="t('components.documentViewer.zoomOut')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :disabled="zoom <= ZOOM_MIN"
            :aria-label="t('components.documentViewer.zoomOut')"
            @click="changeZoom(-ZOOM_STEP)"
          >
            <ZoomOut :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <span class="document-viewer__zoom-label">{{ zoomLabel }}</span>
        <HoverTooltip :text="t('components.documentViewer.zoomIn')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :disabled="zoom >= ZOOM_MAX"
            :aria-label="t('components.documentViewer.zoomIn')"
            @click="changeZoom(ZOOM_STEP)"
          >
            <ZoomIn :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
      </div>
      <div v-if="kind === 'pdf'" class="document-viewer__layout">
        <HoverTooltip :text="t('components.documentViewer.portrait')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :class="{ 'document-viewer__icon-btn--active': orientation === 'portrait' }"
            :aria-label="t('components.documentViewer.portrait')"
            :aria-pressed="orientation === 'portrait'"
            @click="orientation = 'portrait'"
          >
            <RectangleVertical :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <HoverTooltip :text="t('components.documentViewer.landscape')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :class="{ 'document-viewer__icon-btn--active': orientation === 'landscape' }"
            :aria-label="t('components.documentViewer.landscape')"
            :aria-pressed="orientation === 'landscape'"
            @click="orientation = 'landscape'"
          >
            <RectangleHorizontal :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <HoverTooltip :text="t('components.documentViewer.pagesOne')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :class="{ 'document-viewer__icon-btn--active': pagesPerView === 1 }"
            :aria-label="t('components.documentViewer.pagesOne')"
            :aria-pressed="pagesPerView === 1"
            @click="pagesPerView = 1"
          >
            <Square :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <HoverTooltip :text="t('components.documentViewer.pagesTwo')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :class="{ 'document-viewer__icon-btn--active': pagesPerView === 2 }"
            :aria-label="t('components.documentViewer.pagesTwo')"
            :aria-pressed="pagesPerView === 2"
            @click="pagesPerView = 2"
          >
            <Columns2 :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <HoverTooltip :text="t('components.documentViewer.pagesFour')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :class="{ 'document-viewer__icon-btn--active': pagesPerView === 4 }"
            :aria-label="t('components.documentViewer.pagesFour')"
            :aria-pressed="pagesPerView === 4"
            @click="pagesPerView = 4"
          >
            <LayoutGrid :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
      </div>
      <HoverTooltip v-if="src" :text="t('components.documentViewer.download')" wrap>
        <button
          type="button"
          class="document-viewer__icon-btn"
          :aria-label="t('components.documentViewer.download')"
          @click="downloadFile"
        >
          <Download :size="18" aria-hidden="true" />
        </button>
      </HoverTooltip>
    </div>

    <div ref="stageRef" class="document-viewer__stage">
      <div v-if="loading" class="document-viewer__state">
        <SpinnerLoading :loading-text="t('components.documentViewer.loading')" />
      </div>
      <div v-else-if="errorText" class="document-viewer__state document-viewer__state--error">
        <p class="mb-2">{{ errorText }}</p>
        <button
          v-if="src"
          type="button"
          class="ui-btn ui-btn--secondary"
          @click="downloadFile"
        >
          {{ t('components.documentViewer.download') }}
        </button>
      </div>
      <div
        v-else-if="kind === 'pdf'"
        class="document-viewer__pdf"
        :class="`document-viewer__pdf--cols-${pdfCols}`"
      >
        <canvas
          v-for="(n, idx) in visiblePages"
          :key="`${n}-${orientation}`"
          :ref="(el) => bindCanvas(idx, el)"
          class="document-viewer__canvas"
          v-csp-style="canvasStyles[idx] || emptyStyle"
          :aria-label="pageAriaLabel"
        />
      </div>
      <div
        v-else-if="kind === 'docx'"
        ref="docxHost"
        class="document-viewer__docx"
      />
      <div v-else class="document-viewer__state">
        <p class="mb-2">{{ t('components.documentViewer.unsupported') }}</p>
        <button
          v-if="src"
          type="button"
          class="ui-btn ui-btn--primary"
          @click="downloadFile"
        >
          {{ t('components.documentViewer.download') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  LayoutGrid,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import HoverTooltip from '@/components/HoverTooltip.vue'
import SpinnerLoading from '@/components/SpinnerLoading.vue'
import { useAppI18n } from '@/i18n/useAppI18n.js'
import { logError } from '@/js/utils/logError.js'
import { downloadMedia } from '@/js/utils/mediaDownload.js'
import {
  DOCUMENT_PREVIEW_KIND,
  detectDocumentPreviewKind,
  fetchMediaBlob,
} from '@/js/utils/mediaPreview.js'
import {
  PAGE_GAP,
  canGoNext,
  fitPagesScale,
  lastVisiblePage,
  layoutColumns,
  pageRotation,
  stepStartPage,
  visiblePageNumbers,
} from '@/js/utils/documentViewerLayout.js'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25
const STAGE_PAD = 24
const WHEEL_PAGE_MS = 320

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
  filename: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  showToolbar: {
    type: Boolean,
    default: true,
  },
})

const { t } = useAppI18n()

const loading = ref(false)
const errorText = ref('')
const kind = ref(DOCUMENT_PREVIEW_KIND.UNSUPPORTED)
const page = ref(1)
const pageCount = ref(1)
const zoom = ref(1)
const orientation = ref('portrait')
const pagesPerView = ref(1)
const canvasStyles = ref([])
const emptyStyle = {}
const docxHost = ref(null)
const stageRef = ref(null)
const canvasEls = []

let pdfDoc = null
let loadToken = 0
let renderToken = 0
let wheelAt = 0
let resizeTimer = 0
let scrollAfterRender = 'top'
let stageObserver = null

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
const visiblePages = computed(() => (
  visiblePageNumbers(page.value, pagesPerView.value, pageCount.value)
))
const pdfCols = computed(() => layoutColumns(pagesPerView.value))
const canNextPage = computed(() => (
  canGoNext(page.value, pagesPerView.value, pageCount.value)
))
const pageEnd = computed(() => (
  lastVisiblePage(page.value, pagesPerView.value, pageCount.value)
))
const pageLabel = computed(() => {
  if (pageEnd.value === page.value) {
    return t('components.documentViewer.pageOf', { current: page.value, total: pageCount.value })
  }
  return t('components.documentViewer.pageRangeOf', {
    from: page.value,
    to: pageEnd.value,
    total: pageCount.value,
  })
})
const pageAriaLabel = computed(() => {
  if (pageEnd.value === page.value) {
    return t('components.documentViewer.pdfPage', { current: page.value, total: pageCount.value })
  }
  return t('components.documentViewer.pdfPageRange', {
    from: page.value,
    to: pageEnd.value,
    total: pageCount.value,
  })
})

function bindCanvas(idx, el) {
  canvasEls[idx] = el
}

function goPage(next) {
  page.value = Math.min(Math.max(1, Number(next) || 1), pageCount.value)
}

function changeZoom(delta) {
  const stepped = Math.round((zoom.value + delta) / ZOOM_STEP) * ZOOM_STEP
  zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(stepped * 100) / 100))
}

function onStageWheel(event) {
  if (kind.value !== DOCUMENT_PREVIEW_KIND.PDF) {
    return
  }
  if (event.ctrlKey) {
    event.preventDefault()
    changeZoom(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
    return
  }
  const stage = stageRef.value
  if (!stage || pageCount.value <= 1) {
    return
  }
  const delta = event.deltaY
  if (delta === 0) {
    return
  }
  const goingDown = delta > 0
  const atTop = stage.scrollTop <= 1
  const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 1
  const canFlip =
    (goingDown && atBottom && canGoNext(page.value, pagesPerView.value, pageCount.value))
    || (!goingDown && atTop && page.value > 1)
  if (!canFlip) {
    return
  }
  event.preventDefault()
  const now = Date.now()
  if (now - wheelAt < WHEEL_PAGE_MS) {
    return
  }
  wheelAt = now
  scrollAfterRender = goingDown ? 'top' : 'bottom'
  goPage(stepStartPage(page.value, goingDown ? 1 : -1, pagesPerView.value, pageCount.value))
}

function bindStage(el) {
  if (!el) {
    return
  }
  el.addEventListener('wheel', onStageWheel, { passive: false })
  if (stageObserver) {
    stageObserver.observe(el)
  }
}

function unbindStage(el) {
  if (!el) {
    return
  }
  el.removeEventListener('wheel', onStageWheel)
  if (stageObserver) {
    stageObserver.unobserve(el)
  }
}

function schedulePdfRerender() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    if (!loading.value && pdfDoc && kind.value === DOCUMENT_PREVIEW_KIND.PDF) {
      renderCurrentPdfPage()
    }
  }, 80)
}

stageObserver = new ResizeObserver(schedulePdfRerender)

async function downloadFile() {
  if (!props.src) {
    return
  }
  try {
    await downloadMedia(props.src, { filename: props.filename || undefined })
  } catch (error) {
    logError('DocumentViewer.downloadFile', error)
  }
}

function resetView() {
  pdfDoc = null
  page.value = 1
  pageCount.value = 1
  zoom.value = 1
  errorText.value = ''
  kind.value = detectDocumentPreviewKind(props.filename)
  if (docxHost.value) {
    docxHost.value.replaceChildren()
  }
}

async function renderCurrentPdfPage() {
  if (!pdfDoc || kind.value !== DOCUMENT_PREVIEW_KIND.PDF) {
    return
  }
  const token = ++renderToken
  const { pdfPageViewport, renderPdfPage } = await import('@/js/utils/documentViewerPdf.js')
  const numbers = visiblePageNumbers(page.value, pagesPerView.value, pageCount.value)
  const loaded = []
  for (const number of numbers) {
    loaded.push(await pdfDoc.getPage(number))
    if (token !== renderToken) {
      return
    }
  }
  await nextTick()
  if (!canvasEls[0]) {
    await nextTick()
  }
  if (!stageRef.value?.offsetHeight) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  }
  const stage = stageRef.value
  if (!stage || token !== renderToken) {
    return
  }
  const rotation = pageRotation(orientation.value)
  const sizes = loaded.map((item) => {
    const view = pdfPageViewport(item, { scale: 1, rotation })
    return { width: view.width, height: view.height }
  })
  // offsetWidth не сжимается из‑за полосы прокрутки, иначе fit и зум начинают прыгать.
  const availW = Math.max(80, stage.offsetWidth - STAGE_PAD)
  const availH = Math.max(80, stage.offsetHeight - STAGE_PAD)
  const scale = fitPagesScale(sizes, availW, availH, layoutColumns(pagesPerView.value), PAGE_GAP) * zoom.value
  const styles = []
  for (let index = 0; index < loaded.length; index += 1) {
    const canvas = canvasEls[index]
    if (!canvas || token !== renderToken) {
      return
    }
    const size = await renderPdfPage(loaded[index], canvas, scale, { rotation })
    styles.push(size ? { width: `${size.width}px`, height: `${size.height}px` } : {})
  }
  if (token !== renderToken) {
    return
  }
  canvasStyles.value = styles
  await nextTick()
  if (stageRef.value && scrollAfterRender) {
    stageRef.value.scrollTop = scrollAfterRender === 'bottom' ? stageRef.value.scrollHeight : 0
    scrollAfterRender = null
  }
}

async function renderDocx(buffer) {
  await nextTick()
  if (!docxHost.value) {
    return
  }
  docxHost.value.replaceChildren()
  const { renderAsync } = await import('docx-preview')
  await renderAsync(buffer, docxHost.value, undefined, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    experimental: true,
  })
}

async function loadDocument() {
  const token = ++loadToken
  resetView()
  if (!props.src) {
    errorText.value = t('components.documentViewer.empty')
    return
  }
  loading.value = true
  try {
    const result = await fetchMediaBlob(props.src, { filename: props.filename })
    if (token !== loadToken) {
      return
    }
    kind.value = result.kind
    let docxBuffer = null
    if (result.kind === DOCUMENT_PREVIEW_KIND.PDF) {
      const { openPdfDocument } = await import('@/js/utils/documentViewerPdf.js')
      pdfDoc = await openPdfDocument(await result.blob.arrayBuffer())
      if (token !== loadToken) {
        return
      }
      pageCount.value = pdfDoc.numPages || 1
    } else if (result.kind === DOCUMENT_PREVIEW_KIND.DOCX) {
      docxBuffer = await result.blob.arrayBuffer()
    }
  } catch (error) {
    if (token !== loadToken) {
      return
    }
    logError('DocumentViewer.loadDocument', error)
    errorText.value = t('components.documentViewer.loadError')
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
  // Полотно и контейнер DOCX спрятаны за v-if="loading": рисовать после finally.
  if (token !== loadToken) {
    return
  }
  if (kind.value === DOCUMENT_PREVIEW_KIND.PDF && pdfDoc) {
    await renderCurrentPdfPage()
  } else if (kind.value === DOCUMENT_PREVIEW_KIND.DOCX && docxBuffer) {
    await renderDocx(docxBuffer)
  }
}

watch(() => [props.src, props.filename], loadDocument, { immediate: true })
watch([page, zoom, orientation, pagesPerView], () => {
  if (!loading.value && kind.value === DOCUMENT_PREVIEW_KIND.PDF && pdfDoc) {
    renderCurrentPdfPage()
  }
})

watch(stageRef, (el, prev) => {
  unbindStage(prev)
  bindStage(el)
})

onUnmounted(() => {
  loadToken += 1
  renderToken += 1
  pdfDoc = null
  window.clearTimeout(resizeTimer)
  unbindStage(stageRef.value)
  if (stageObserver) {
    stageObserver.disconnect()
  }
})
</script>

<style scoped lang="scss">
@use '@/scss/ui/mixins' as *;

.document-viewer {
  display: flex;
  flex-direction: column;
  min-height: 18rem;
  height: 100%;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius, 0.625rem);
  overflow: hidden;
}

.document-viewer--compact {
  min-height: 14rem;
}

.document-viewer__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-surface-2, var(--ui-surface));

  :deep(.hover-tooltip) {
    display: contents;
  }
}

.document-viewer__nav,
.document-viewer__zoom,
.document-viewer__layout {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.document-viewer__page,
.document-viewer__zoom-label {
  min-width: 7rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
}

.document-viewer__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm, 0.375rem);
  background: transparent;
  color: var(--ui-text);
  @include ui-a11y-focus;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--ui-accent) 10%, var(--ui-surface));
  }

  &:disabled {
    opacity: 0.4;
  }

  &--active {
    background: color-mix(in srgb, var(--ui-accent) 14%, var(--ui-surface));
    border-color: var(--ui-border);
  }
}

.document-viewer__stage {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: color-mix(in srgb, var(--ui-text) 4%, var(--ui-surface));
}

.document-viewer__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  padding: 1.25rem;
  text-align: center;
  color: var(--ui-text-muted);
}

.document-viewer__state--error {
  color: var(--ui-danger);
}

.document-viewer__pdf {
  display: grid;
  justify-content: center;
  justify-items: center;
  align-content: start;
  gap: 0.75rem;
  padding: 0.75rem;
}

.document-viewer__pdf--cols-1 {
  grid-template-columns: max-content;
}

.document-viewer__pdf--cols-2 {
  grid-template-columns: repeat(2, max-content);
}

.document-viewer__canvas {
  display: block;
  max-width: none;
  height: auto;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-sm, none);
}

.document-viewer__docx {
  padding: 0.75rem;
  color: var(--ui-text);

  :deep(.docx-wrapper) {
    background: transparent;
    padding: 0;
  }

  :deep(.docx) {
    background: var(--ui-surface);
    color: var(--ui-text);
    box-shadow: var(--ui-shadow-sm, none);
    margin: 0 auto;
  }
}
</style>
