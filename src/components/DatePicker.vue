<template>
  <div ref="rootRef" class="date-picker" :class="{ 'date-picker--invalid': invalid }">
    <VueDatePicker :model-value="pickerDate" :text-input="textInputConfig" :month-picker="monthPicker" :year-range="yearRange" :prevent-min-max-navigation="Boolean(minDateParsed || maxDateParsed)" :locale="pickerLocale" :formats="pickerFormats" :input-attrs="inputAttrs" :placeholder="resolvedPlaceholder" :time-config="timeConfig" auto-apply six-weeks :teleport="true" :dark="isDark" :floating="floatingConfig" :config="pickerConfig" :min-date="minDateParsed" :max-date="maxDateParsed" :disabled="disabled" @update:model-value="onPickerUpdate">
      <template #input-icon>
        <span class="date-picker__glyph">
          <LucideIcon name="Calendar" :size="ICON_SIZE" aria-hidden="true" />
        </span>
      </template>
      <template #clear-icon="{ clear }">
        <HoverTooltip :text="t('components.datePicker.clear')">
          <button type="button" class="date-picker__glyph" :aria-label="t('components.datePicker.clear')" @click.stop="clear">
            <LucideIcon name="X" :size="ICON_SIZE" aria-hidden="true" />
          </button>
        </HoverTooltip>
      </template>
    </VueDatePicker>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { enUS } from 'date-fns/locale/en-US'
import { fr } from 'date-fns/locale/fr'
import { ru } from 'date-fns/locale/ru'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import HoverTooltip from '@/components/HoverTooltip.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { useAppI18n } from '@/i18n/useAppI18n.js'
import { useThemeMode } from '@/composables/useThemeMode.js'
import { advanceCaretToNextDateSection, applyDigitToDateInput, applyPastedDigitsToDateInput, normalizeDateInputMask, } from '@/js/utils/dateInputMask.js'
import { toISODate, toISODateTime } from '@/js/utils/timeUtils.js'

const DATE_CHARS_PATTERN = /[^\d.]/
const DATETIME_CHARS_PATTERN = /[^\d.:\s]/
const DATE_ALLOWED_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Tab',
  'Enter',
  'Home',
  'End',
])

const DATE_FNS_LOCALES = { ru, en: enUS, fr }
const ICON_SIZE = 16

const pickerConfig = {
  allowPreventDefault: true,
}

const floatingConfig = {
  placement: 'bottom-start',
  offset: 4,
}

const rootRef = ref(null)

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  minDate: {
    type: [String, Date],
    default: null,
  },
  maxDate: {
    type: [String, Date],
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '',
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: '',
  },
  enableTime: {
    type: Boolean,
    default: false,
  },
  timeFormat: {
    type: String,
    default: '24',
    validator: (value) => value === '12' || value === '24',
  },
  monthPicker: {
    type: Boolean,
    default: false,
  },
  inputFormat: {
    type: String,
    default: '',
  },
  editFormat: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const { t, getLocale } = useAppI18n()
const { isDark } = useThemeMode()

const pickerLocale = computed(() => DATE_FNS_LOCALES[getLocale()] || ru)
const is12Hour = computed(() => props.enableTime && props.timeFormat === '12' && !props.monthPicker)
const isInputFocused = ref(false)

const defaultInputFormat = computed(() => {
  if (props.monthPicker) return 'LLLL yyyy'
  if (!props.enableTime) return 'dd.MM.yyyy'
  return is12Hour.value ? 'dd.MM.yyyy hh:mm aa' : 'dd.MM.yyyy HH:mm'
})

const activeInputFormat = computed(() => {
  if (isInputFocused.value && props.editFormat) return props.editFormat
  return props.inputFormat || defaultInputFormat.value
})

const isNumericInputFormat = computed(() => (
  !/[ML]{3,}/.test(activeInputFormat.value) && !activeInputFormat.value.includes('aa')
))

const useShortYearMask = computed(() => (
  activeInputFormat.value.includes('yy') && !activeInputFormat.value.includes('yyyy')
))

const useDigitMask = computed(() => (
  !props.monthPicker && !is12Hour.value && isNumericInputFormat.value
))

const textInputConfig = computed(() => {
  if (props.monthPicker) return false
  if (!props.editFormat) return true
  return {
    format: props.editFormat,
    selectOnFocus: true,
  }
})

const resolvedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  if (props.monthPicker) return t('components.datePicker.placeholderMonth')
  if (!props.enableTime) return t('components.datePicker.placeholder')
  return is12Hour.value
    ? t('components.datePicker.placeholderDateTime12')
    : t('components.datePicker.placeholderDateTime')
})

const pickerFormats = computed(() => ({
  input: activeInputFormat.value,
}))

const timeConfig = computed(() => ({
  enableTimePicker: props.enableTime && !props.monthPicker,
  enableSeconds: false,
  is24: !is12Hour.value,
}))

const pickerDate = computed(() => (
  props.monthPicker ? parseModelToMonth(props.modelValue) : parseModelToDate(props.modelValue)
))

const inputAttrs = computed(() => ({
  inputmode: props.monthPicker || is12Hour.value || !useDigitMask.value ? 'text' : 'numeric',
  autocomplete: 'off',
  hideInputIcon: Boolean(pickerDate.value) && !props.disabled,
  ...(props.id ? { id: props.id } : {}),
}))

function parseYearMonthKey(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

function parseModelToMonth(value) {
  const parsed = parseYearMonthKey(value)
  if (!parsed) return null
  return { year: parsed.year, month: parsed.month - 1 }
}

function monthModelToKey(value) {
  if (!value || typeof value !== 'object') return ''
  const year = Number(value.year)
  const monthIndex = Number(value.month)
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return ''
  const month = monthIndex + 1
  if (month < 1 || month > 12) return ''
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseModelToDate(value) {
  if (!value) return null
  if (props.enableTime) {
    const iso = toISODateTime(value)
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const iso = toISODate(value)
  if (!iso) return null
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseBoundDate(value, bound) {
  if (!value) return undefined
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const monthKey = parseYearMonthKey(value)
  if (monthKey) {
    const { year, month } = monthKey
    if (bound === 'max') return new Date(year, month, 0, 23, 59, 59)
    return new Date(year, month - 1, 1, 12, 0, 0)
  }
  return parseModelToDate(value) ?? undefined
}

const minDateParsed = computed(() => parseBoundDate(props.minDate, 'min'))
const maxDateParsed = computed(() => parseBoundDate(props.maxDate, 'max'))

const yearRange = computed(() => {
  const minY = minDateParsed.value?.getFullYear()
  const maxY = maxDateParsed.value?.getFullYear()
  if (minY == null && maxY == null) return [1900, 2100]
  return [minY ?? maxY, maxY ?? minY]
})

function onPickerUpdate(value) {
  if (value == null) {
    emit('update:modelValue', '')
    return
  }
  if (props.monthPicker) {
    emit('update:modelValue', monthModelToKey(value))
    return
  }
  emit('update:modelValue', props.enableTime ? toISODateTime(value) : toISODate(value))
}

function isDateInputTarget(target) {
  return target instanceof HTMLInputElement && (
    target.classList.contains('dp__input') || target.classList.contains('dp--input')
  )
}

function isNumericDateInputValue(value) {
  return !/[^\d.:,\s]/.test(String(value ?? ''))
}

function applyMaskDigit(input, digit) {
  applyDigitToDateInput(input, digit, props.enableTime, useShortYearMask.value)
}

function onKeydown(event) {
  if (!useDigitMask.value) return
  if (!isDateInputTarget(event.target)) return
  if (event.ctrlKey || event.metaKey || event.altKey) return

  const input = event.target

  if (!isNumericDateInputValue(input.value) && input.value) {
    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      input.value = ''
      applyMaskDigit(input, event.key)
    }
    return
  }

  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    applyMaskDigit(input, event.key)
    return
  }

  if (event.key === '.' || (props.enableTime && (event.key === ':' || event.key === ' '))) {
    event.preventDefault()
    advanceCaretToNextDateSection(input, props.enableTime, useShortYearMask.value)
    return
  }

  if (DATE_ALLOWED_KEYS.has(event.key)) return
  event.preventDefault()
}

function onInput(event) {
  if (!useDigitMask.value) return
  if (!isDateInputTarget(event.target)) return
  if (!isNumericDateInputValue(event.target.value)) return
  const input = event.target
  if (normalizeDateInputMask(input, props.enableTime, useShortYearMask.value)) {
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function onPaste(event) {
  if (!useDigitMask.value) return
  if (!isDateInputTarget(event.target)) return
  const pasted = event.clipboardData?.getData('text') ?? ''
  const invalidChars = props.enableTime ? DATETIME_CHARS_PATTERN : DATE_CHARS_PATTERN
  if (!invalidChars.test(pasted)) return

  event.preventDefault()
  applyPastedDigitsToDateInput(event.target, pasted, props.enableTime, useShortYearMask.value)
}

function isPickerOverlay(target) {
  return target instanceof Element && Boolean(target.closest('.dp__menu, .dp--menu, .dp__overlay'))
}

function onFocusIn(event) {
  if (isDateInputTarget(event.target)) isInputFocused.value = true
}

function onFocusOut(event) {
  if (isPickerOverlay(event.relatedTarget)) return
  if (rootRef.value?.contains(event.relatedTarget)) return
  isInputFocused.value = false
}

onMounted(() => {
  const el = rootRef.value
  if (!el) return
  el.addEventListener('keydown', onKeydown)
  el.addEventListener('input', onInput)
  el.addEventListener('paste', onPaste)
  el.addEventListener('focusin', onFocusIn)
  el.addEventListener('focusout', onFocusOut)
})

onBeforeUnmount(() => {
  const el = rootRef.value
  if (!el) return
  el.removeEventListener('keydown', onKeydown)
  el.removeEventListener('input', onInput)
  el.removeEventListener('paste', onPaste)
  el.removeEventListener('focusin', onFocusIn)
  el.removeEventListener('focusout', onFocusOut)
})
</script>

<style scoped lang="scss">
@import '@/scss/vue-datepicker-theme';

.date-picker {
  width: 100%;

  @include vue-datepicker-theme;

  :deep(.dp__input),
  :deep(.dp--input) {
    padding: 0.375rem 2.5rem 0.375rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.5;
    background: var(--color-primary-background);
    color: var(--color-primary-text);
    border: 1px solid var(--color-border);
    box-shadow: none;

    &:hover {
      border-color: var(--color-border);
    }

    &:focus,
    &:focus-visible,
    &.dp__input_focus,
    &.dp--input-focus {
      outline: none;
      background: var(--color-primary-background);
      border-color: var(--ui-accent, var(--color-accent, var(--bs-primary)));
      box-shadow: none;
    }

    &::placeholder {
      color: var(--color-secondary-text);
      opacity: 0.75;
    }
  }

  :deep(.dp__input_icon_pad),
  :deep(.dp--input-icon-pad) {
    padding-left: 0.75rem;
    padding-right: 2.5rem;
    padding-inline-start: 0.75rem;
    padding-inline-end: 2.5rem;
  }

  :deep(.dp__input_icon),
  :deep(.dp--input-icon),
  :deep(.dp--clear-btn) {
    left: auto;
    right: 0.5rem;
    inset-inline-start: auto;
    inset-inline-end: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    box-sizing: border-box;
    color: var(--color-secondary-text);
    cursor: pointer;
    transition: color 0.15s ease;

    &:hover {
      color: var(--color-accent, var(--bs-primary));
    }
  }

  :deep(.dp--clear-btn:focus-visible) {
    outline: 2px solid var(--color-primary-text);
    outline-offset: 1px;
  }
}

:deep(.hover-tooltip) {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
}

.date-picker__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;

  :deep(svg) {
    display: block;
    width: 1rem;
    height: 1rem;
  }
}

.date-picker--invalid :deep(.dp__input),
.date-picker--invalid :deep(.dp--input) {
  border-color: var(--bs-form-invalid-border-color, var(--bs-danger, #dc3545));
}
</style>

<style lang="scss">
@import '@/scss/vue-datepicker-theme';

@include vue-datepicker-overlay-theme;

.dp__menu,
.dp__menu_inner,
.dp--menu {
  max-height: none !important;
  overflow: visible !important;
}
</style>