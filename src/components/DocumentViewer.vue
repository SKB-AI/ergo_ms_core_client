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
            @click="goPage(page - 1)"
          >
            <ChevronLeft :size="18" aria-hidden="true" />
          </button>
        </HoverTooltip>
        <span class="document-viewer__page">
          {{ t('components.documentViewer.pageOf', { current: page, total: pageCount }) }}
        </span>
        <HoverTooltip :text="t('components.documentViewer.nextPage')" wrap>
          <button
            type="button"
            class="document-viewer__icon-btn"
            :disabled="page >= pageCount"
            :aria-label="t('components.documentViewer.nextPage')"
            @click="goPage(page + 1)"
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
      >
        <canvas
          ref="pdfCanvas"
          class="document-viewer__canvas"
          v-csp-style="pdfCanvasStyle"
          :aria-label="t('components.documentViewer.pdfPage', { current: page, total: pageCount })"
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
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from '@lucide/vue'
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
const pdfCanvas = ref(null)
const pdfCanvasStyle = ref({})
const docxHost = ref(null)
const stageRef = ref(null)

let pdfDoc = null
let pdfPage = null
let loadToken = 0
let renderToken = 0
let wheelAt = 0
let resizeTimer = 0
let scrollAfterRender = 'top'
let stageObserver = null

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)

function goPage(next) {
  const safe = Math.min(Math.max(1, Number(next) || 1), pageCount.value)
  page.value = safe
}

function changeZoom(delta) {
  const stepped = Math.round((zoom.value + delta) / ZOOM_STEP) * ZOOM_STEP
  zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(stepped * 100) / 100))
}

function pageFitScale(pdfPageEl) {
  const stage = stageRef.value
  if (!pdfPageEl || !stage) {
    return 1
  }
  const base = pdfPageEl.getViewport({ scale: 1 })
  // offsetWidth не сжимается из‑за полосы прокрутки, иначе fit и зум начинают прыгать.
  const availW = Math.max(80, stage.offsetWidth - STAGE_PAD)
  const availH = Math.max(80, stage.offsetHeight - STAGE_PAD)
  if (base.width <= 0 || base.height <= 0) {
    return 1
  }
  return Math.min(availW / base.width, availH / base.height)
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
    (goingDown && atBottom && page.value < pageCount.value)
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
  goPage(page.value + (goingDown ? 1 : -1))
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
  pdfPage = null
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
  const { renderPdfPage } = await import('@/js/utils/documentViewerPdf.js')
  const current = await pdfDoc.getPage(page.value)
  if (token !== renderToken) {
    return
  }
  pdfPage = current
  await nextTick()
  if (!stageRef.value?.offsetHeight) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
  }
  if (!pdfCanvas.value || token !== renderToken) {
    return
  }
  const scale = pageFitScale(current) * zoom.value
  const size = await renderPdfPage(current, pdfCanvas.value, scale)
  if (size && token === renderToken) {
    pdfCanvasStyle.value = {
      width: `${size.width}px`,
      height: `${size.height}px`,
    }
    await nextTick()
    const stage = stageRef.value
    if (stage && scrollAfterRender) {
      stage.scrollTop = scrollAfterRender === 'bottom' ? stage.scrollHeight : 0
      scrollAfterRender = null
    }
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
watch([page, zoom], () => {
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
  pdfPage = null
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
.document-viewer__zoom {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.document-viewer__page,
.document-viewer__zoom-label {
  min-width: 5.5rem;
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
  display: flex;
  justify-content: center;
  padding: 0.75rem;
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
