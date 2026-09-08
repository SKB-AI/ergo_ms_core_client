<template>
  <ModalCenter
    standalone
    :modal-id="modalId"
    :visible="visible"
    :title="title || t('components.documentViewer.title')"
    size="fullscreen"
    :scrollable="false"
    :centered="false"
    custom-class="document-viewer-modal"
    body-class="p-0"
    @close="emit('close')"
  >
    <DocumentViewer
      v-if="visible"
      :src="src"
      :filename="filename"
    />
  </ModalCenter>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import ModalCenter from '@/components/ModalCenter.vue'
import { useAppI18n } from '@/i18n/useAppI18n.js'

const DocumentViewer = defineAsyncComponent(() => import('@/components/DocumentViewer.vue'))

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  src: {
    type: String,
    default: '',
  },
  filename: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  modalId: {
    type: String,
    default: 'documentViewer',
  },
})

const emit = defineEmits(['close'])
const { t } = useAppI18n()
</script>

<style lang="scss">
.document-viewer-modal .modal-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.document-viewer-modal .document-viewer {
  flex: 1 1 auto;
  min-height: 0;
  border: 0;
  border-radius: 0;
}
</style>
