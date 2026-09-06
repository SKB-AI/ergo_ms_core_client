<template>
  <div class="form-field" :class="[ `form-field--align-${align}`, { 'form-field--last': last }, ]">
    <component :is="labelFor ? 'label' : 'div'" v-if="label || $slots.label" class="form-field__label" :for="labelFor || undefined">
      <slot name="label">
        {{ label }}
      </slot>
      <span v-if="required" class="form-field__required" :title="t('common.required')" aria-hidden="true">*</span>
    </component>

    <div class="form-field__control">
      <slot />
      <div v-if="hint || $slots.hint" class="form-field__hint">
        <slot name="hint">{{ hint }}</slot>
      </div>
      <div v-if="error" class="invalid-feedback d-block">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { useAppI18n } from '@/i18n/useAppI18n.js'

defineProps({
  label: {
    type: String,
    default: '',
  },
  labelFor: {
    type: String,
    default: '',
  },
  hint: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  last: {
    type: Boolean,
    default: false,
  },
  align: {
    type: String,
    default: 'start',
    validator: (value) => ['start', 'center'].includes(value),
  },
})

const { t } = useAppI18n()
</script>

<style scoped lang="scss">
.form-field {
  display: grid;
  grid-template-columns: minmax(9.5rem, 12rem) minmax(0, 1fr);
  align-items: start;
  column-gap: 1rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);

  @media (width < $ui-bp-sm) {
    grid-template-columns: 1fr;
    row-gap: 0.5rem;
  }
}

.form-field--last {
  border-bottom: none;
}

.form-field--align-center {
  align-items: center;

  .form-field__label {
    padding-top: 0;
  }

  .form-field__control {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.25rem;

    :deep(.form-check-input) {
      display: block;
      float: none;
      margin: 0;
      vertical-align: middle;
    }
  }

  .form-field__hint {
    margin-top: 0;
    flex: 1 1 10rem;
  }
}

.form-field__label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.35rem;
  min-width: 0;
  padding-top: 0.35rem;
  font-size: 0.875rem;
  line-height: 1.3;
  color: var(--color-secondary-text);
  margin: 0;
  overflow-wrap: anywhere;
}

.form-field__required {
  flex: 0 0 auto;
  color: var(--ui-danger);
  font-weight: 700;
  line-height: 1;
}

.form-field__control {
  min-width: 0;
}

.form-field__hint {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--color-secondary-text);
}

.form-field__control :deep(.form-control) {
  background: var(--color-primary-background);
  color: var(--color-primary-text);
  border: 1px solid var(--color-border);
  box-shadow: none;

  &:focus,
  &:focus-visible {
    outline: none;
    background: var(--color-hover-background);
    border-color: var(--color-border);
    box-shadow: none;
  }

  &::placeholder {
    color: var(--color-secondary-text);
    opacity: 0.75;
  }
}

.form-field__control :deep(textarea.form-control) {
  resize: vertical;
  min-height: 5.5rem;
  line-height: 1.4;
  font-family: inherit;
}

.form-field__control :deep(.decimal-input),
.form-field__control :deep(.date-picker) {
  width: 100%;
}
</style>